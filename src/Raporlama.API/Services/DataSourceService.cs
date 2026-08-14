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
        private readonly IAdminService _adminService;
        private readonly IMemoryCache _cache;
        private readonly IConfiguration _configuration;
        private readonly ILogger<DataSourceService> _logger;

        public DataSourceService(
            IDatabaseService databaseService,
            IReportService reportService,
            ICustomAuthorizationService authorizationService,
            IAdminService adminService,
            IMemoryCache cache,
            IConfiguration configuration,
            ILogger<DataSourceService> logger)
        {
            _databaseService = databaseService;
            _reportService = reportService;
            _authorizationService = authorizationService;
            _adminService = adminService;
            _cache = cache;
            _configuration = configuration;
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
                @"SELECT p.RowFilter, p.DepartmentFilterEnabled, c.ColumnName
                  FROM UserReportPermission p
                  LEFT JOIN PermissionColumn c ON p.PermissionKey = c.PermissionKey
                  WHERE p.Aktif = 1 AND p.UserKey = @UserKey AND p.ReportKey = @ReportKey",
                new { UserKey = userInfo.UserKey, ReportKey = reportId }
            );

            // Satır filtresi ve kolon yetkileri
            string rowFilter = "";
            var columnSet = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            var departmentFilterEnabled = true;
            foreach (var item in permission)
            {
                if (item.RowFilter != null) rowFilter = item.RowFilter;
                if (item.ColumnName != null) columnSet.Add((string)item.ColumnName);
                if (item.DepartmentFilterEnabled != null)
                    departmentFilterEnabled = Convert.ToBoolean(item.DepartmentFilterEnabled);
            }

            var meta = ReportPermissionMetadata.Resolve(report.ReportCode, report.ReportName, report.Url);
            if (meta != null)
            {
                foreach (var col in meta.FilterFields.Concat(meta.Columns))
                    columnSet.Add(col);
            }

            rowFilter = AppendDepartmentNameFilter(
                rowFilter,
                meta,
                ResolveDepartmentNames(userInfo),
                departmentFilterEnabled,
                _adminService.IsAdmin(userName));

            string query = report.Query;
            if (columnSet.Count > 0)
            {
                var selectColumns = string.Join(",", columnSet.Select(QuoteSqlColumn));
                var replaced = ReplaceSelectStar(query, selectColumns);
                query = replaced == query
                    ? MergeSelectColumns(query, columnSet)
                    : replaced;
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

            _logger.LogInformation("Report {ReportId} sorgusu çalıştırılıyor (timeout {Timeout}s)",
                reportId, _configuration.GetValue("ReportQuery:CommandTimeoutSeconds", 300));

            var data = await _databaseService.QueryDataTableAsync(report.SourceDatabase, query, parameters);

            _logger.LogInformation("Report {ReportId} tamamlandı: {RowCount} satır", reportId, data.Rows.Count);

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

        private static IReadOnlyList<string> ResolveDepartmentNames(UserInfo userInfo)
        {
            if (userInfo.MudurlukAdlari != null && userInfo.MudurlukAdlari.Count > 0)
            {
                return userInfo.MudurlukAdlari
                    .Where(x => !string.IsNullOrWhiteSpace(x))
                    .Select(x => x.Trim())
                    .Distinct(StringComparer.OrdinalIgnoreCase)
                    .ToList();
            }

            if (!string.IsNullOrWhiteSpace(userInfo.MudurlukAdi))
                return new List<string> { userInfo.MudurlukAdi.Trim() };

            return Array.Empty<string>();
        }

        private static string AppendDepartmentNameFilter(
            string rowFilter,
            ReportPermissionMeta? meta,
            IReadOnlyList<string> mudurlukAdlari,
            bool departmentFilterEnabled,
            bool isAdmin)
        {
            if (isAdmin || !departmentFilterEnabled || mudurlukAdlari.Count == 0)
                return rowFilter;

            var field = meta?.DepartmentNameField;
            if (string.IsNullOrWhiteSpace(field))
                return rowFilter;

            string deptClause;
            if (mudurlukAdlari.Count == 1)
            {
                deptClause = $"{QuoteSqlColumn(field)} = {SqlLiteral(mudurlukAdlari[0])}";
            }
            else
            {
                var literals = string.Join(", ", mudurlukAdlari.Select(SqlLiteral));
                deptClause = $"{QuoteSqlColumn(field)} IN ({literals})";
            }

            if (string.IsNullOrWhiteSpace(rowFilter))
                return deptClause;

            return $"({rowFilter}) AND ({deptClause})";
        }

        private static string SqlLiteral(string value) =>
            "N'" + value.Replace("'", "''") + "'";

        private static string QuoteSqlColumn(string name)
        {
            var trimmed = name.Trim();
            if (trimmed.Length == 0) return trimmed;
            if (trimmed.StartsWith('[')) return trimmed;
            return $"[{trimmed.Replace("]", "]]")}]";
        }

        private static string ReplaceSelectStar(string query, string selectColumns)
        {
            var idx = query.IndexOf("SELECT", StringComparison.OrdinalIgnoreCase);
            if (idx < 0) return query;
            var starIdx = query.IndexOf('*', idx);
            if (starIdx < 0) return query;
            var fromIdx = query.IndexOf("FROM", starIdx, StringComparison.OrdinalIgnoreCase);
            if (fromIdx < 0) return query;
            return query[..idx] + "SELECT " + selectColumns + " " + query[fromIdx..];
        }

        private static string MergeSelectColumns(string query, IReadOnlyCollection<string> requiredColumns)
        {
            var selectIdx = query.IndexOf("SELECT", StringComparison.OrdinalIgnoreCase);
            if (selectIdx < 0) return query;
            var fromIdx = query.IndexOf("FROM", selectIdx + 6, StringComparison.OrdinalIgnoreCase);
            if (fromIdx < 0) return query;

            var existingPart = query.Substring(selectIdx + 6, fromIdx - selectIdx - 6);
            var existingCols = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            foreach (var part in existingPart.Split(','))
            {
                var col = part.Trim();
                if (col.Length == 0) continue;
                var bracket = col.LastIndexOf(']');
                if (col.StartsWith('[') && bracket > 0)
                    existingCols.Add(col[1..bracket]);
                else
                {
                    var token = col.Split(new[] { ' ', '\t', '\r', '\n' }, StringSplitOptions.RemoveEmptyEntries)[0];
                    existingCols.Add(token.Trim('[', ']'));
                }
            }

            var missing = requiredColumns.Where(c => !existingCols.Contains(c)).ToList();
            if (missing.Count == 0) return query;

            var merged = existingPart.TrimEnd().TrimEnd(',')
                + ", "
                + string.Join(", ", missing.Select(QuoteSqlColumn));
            return query[..(selectIdx + 6)] + " " + merged + " " + query[fromIdx..];
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
