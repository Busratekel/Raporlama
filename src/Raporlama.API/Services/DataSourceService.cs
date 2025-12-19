using Raporlama.API.Data;
using Microsoft.Extensions.Caching.Memory;
using System.Data;
using System.Security.Principal;
using Microsoft.AspNetCore.Http;

namespace Raporlama.API.Services
{
    public interface IDataSourceService
    {
        Task<DataTable> GetReportDataAsync(int reportId, string userName, Dictionary<string, object>? parameters = null);
    }

    public class DataSourceService : IDataSourceService
    {
        private readonly IDatabaseService _databaseService;
        private readonly IReportService _reportService;
        private readonly ICustomAuthorizationService _authorizationService;
        private readonly IMemoryCache _cache;
        private readonly ILogger<DataSourceService> _logger;

        public DataSourceService(
            IDatabaseService databaseService,
            IReportService reportService,
            ICustomAuthorizationService authorizationService,
            IMemoryCache cache,
            ILogger<DataSourceService> logger)
        {
            _databaseService = databaseService;
            _reportService = reportService;
            _authorizationService = authorizationService;
            _cache = cache;
            _logger = logger;
        }

        public async Task<DataTable> GetReportDataAsync(int reportId, string userName, Dictionary<string, object>? parameters = null)
        {
            // Kullanıcının bu rapora erişim yetkisi var mı kontrol et
            var hasAccess = await _authorizationService.HasReportAccessAsync(reportId, userName);
            if (!hasAccess)
            {
                throw new UnauthorizedAccessException($"User {userName} does not have access to report {reportId}");
            }

            var report = await _reportService.GetReportAsync(reportId);
            if (report == null)
                throw new Exception($"Report {reportId} not found");

            if (!report.IsActive)
                throw new Exception($"Report {reportId} is not active");

            // Kullanıcı bilgilerini al
            var userInfo = await _authorizationService.GetUserByUserNameAsync(userName);

            // Yetki tablosundan satır/kolon yetkilerini çek
            var permission = await _databaseService.QueryAsync<dynamic>(
                "BellonaRapor",
                "SELECT p.RowFilter, c.ColumnName FROM UserReportPermission p LEFT JOIN PermissionColumn c ON p.PermissionKey = c.PermissionKey WHERE p.Aktif = 1 AND p.UserKey = @UserKey AND p.ReportKey = @ReportKey",
                new { UserKey = userInfo.UserKey, ReportKey = reportId }
            );

            // Satır filtresi ve kolon listesi
            string rowFilter = "";
            List<string> columns = new();
            foreach (var item in permission)
            {
                if (item.RowFilter != null) rowFilter = item.RowFilter;
                if (item.ColumnName != null) columns.Add(item.ColumnName);
            }

            // Kolon yetkisi varsa, sadece izinli kolonları seç
            string selectColumns = columns.Count > 0 ? string.Join(",", columns) : "*";

            // Satır yetkisi varsa, WHERE/AND ekle ORDER BY, GROUP BY, HAVING'den önce
            string query = report.Query;
            if (selectColumns != "*")
            {
                // SELECT * yerine izinli kolonlar
                query = query.Replace("SELECT *", $"SELECT {selectColumns}");
            }

            if (!string.IsNullOrWhiteSpace(rowFilter))
            {
                int orderByIdx = query.LastIndexOf("ORDER BY", StringComparison.OrdinalIgnoreCase);
                int groupByIdx = query.LastIndexOf("GROUP BY", StringComparison.OrdinalIgnoreCase);
                int havingIdx = query.LastIndexOf("HAVING", StringComparison.OrdinalIgnoreCase);

                int insertPos = -1;
                if (orderByIdx >= 0 && (orderByIdx > groupByIdx || groupByIdx == -1) && (orderByIdx > havingIdx || havingIdx == -1))
                    insertPos = orderByIdx;
                else if (groupByIdx >= 0 && (groupByIdx > havingIdx || havingIdx == -1))
                    insertPos = groupByIdx;
                else if (havingIdx >= 0)
                    insertPos = havingIdx;

                string before, after;
                if (insertPos >= 0)
                {
                    before = query.Substring(0, insertPos);
                    after = query.Substring(insertPos);
                }
                else
                {
                    before = query;
                    after = string.Empty;
                }

                // WHERE/AND ekle
                if (before.Contains("WHERE", StringComparison.OrdinalIgnoreCase))
                    before += $" AND {rowFilter}";
                else
                    before += $" WHERE {rowFilter}";

                query = before + after;
            }

            var cacheKey = GenerateCacheKey(report.SourceDatabase, query, parameters, userName, reportId);

            if (report.CacheDuration.HasValue && report.CacheDuration.Value > 0)
            {
                if (_cache.TryGetValue(cacheKey, out DataTable? cachedData) && cachedData != null)
                {
                    return cachedData;
                }
            }

            var data = await _databaseService.QueryDataTableAsync(report.SourceDatabase, query, parameters);

            if (report.CacheDuration.HasValue && report.CacheDuration.Value > 0)
            {
                var cacheOptions = new MemoryCacheEntryOptions
                {
                    AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(report.CacheDuration.Value)
                };
                _cache.Set(cacheKey, data, cacheOptions);
            }

            return data;
        }

        private string GenerateCacheKey(string databaseName, string query, Dictionary<string, object>? parameters, string userName, int reportId)
        {
            var paramString = parameters != null
                ? string.Join("_", parameters.OrderBy(p => p.Key).Select(p => $"{p.Key}_{p.Value}"))
                : "no_params";

            var queryHash = query.GetHashCode();
            return $"report_{databaseName}_{reportId}_{userName}_{queryHash}_{paramString}";
        }
    }
}
