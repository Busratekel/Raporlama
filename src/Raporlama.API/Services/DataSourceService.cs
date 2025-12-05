using Raporlama.API.Data;
using Microsoft.Extensions.Caching.Memory;
using System.Data;

namespace Raporlama.API.Services
{
    public interface IDataSourceService
    {
        Task<DataTable> GetReportDataAsync(int reportId, Dictionary<string, object>? parameters = null);
    }

    public class DataSourceService : IDataSourceService
    {
        private readonly IDatabaseService _databaseService;
        private readonly IReportService _reportService;
        private readonly IMemoryCache _cache;
        private readonly ILogger<DataSourceService> _logger;

        public DataSourceService(
            IDatabaseService databaseService,
            IReportService reportService,
            IMemoryCache cache,
            ILogger<DataSourceService> logger)
        {
            _databaseService = databaseService;
            _reportService = reportService;
            _cache = cache;
            _logger = logger;
        }

        public async Task<DataTable> GetReportDataAsync(int reportId, Dictionary<string, object>? parameters = null)
        {
            var report = await _reportService.GetReportAsync(reportId);
            if (report == null)
                throw new Exception($"Report {reportId} not found");

            if (!report.IsActive)
                throw new Exception($"Report {reportId} is not active");

            var cacheKey = GenerateCacheKey(report.SourceDatabase, report.Query, parameters);

            if (report.CacheDuration.HasValue && report.CacheDuration.Value > 0)
            {
                if (_cache.TryGetValue(cacheKey, out DataTable? cachedData) && cachedData != null)
                {
                    _logger.LogInformation("Cache hit for query: {CacheKey}", cacheKey);
                    return cachedData;
                }
            }

            _logger.LogInformation("Executing query on database {DatabaseName}", report.SourceDatabase);
            
            var data = await _databaseService.QueryDataTableAsync(report.SourceDatabase, report.Query, parameters);

            if (report.CacheDuration.HasValue && report.CacheDuration.Value > 0)
            {
                var cacheOptions = new MemoryCacheEntryOptions
                {
                    AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(report.CacheDuration.Value)
                };
                _cache.Set(cacheKey, data, cacheOptions);
                _logger.LogInformation("Data cached for {Duration} minutes", report.CacheDuration.Value);
            }

            return data;
        }

        private string GenerateCacheKey(string databaseName, string query, Dictionary<string, object>? parameters)
        {
            var paramString = parameters != null
                ? string.Join("_", parameters.OrderBy(p => p.Key).Select(p => $"{p.Key}_{p.Value}"))
                : "no_params";

            var queryHash = query.GetHashCode();
            return $"report_{databaseName}_{queryHash}_{paramString}";
        }
    }
}



