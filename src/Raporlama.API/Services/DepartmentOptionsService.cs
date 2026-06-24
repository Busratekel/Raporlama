using System.Globalization;
using Microsoft.Extensions.Caching.Memory;
using Raporlama.API.Data;

namespace Raporlama.API.Services;

public interface IDepartmentOptionsService
{
    Task<IReadOnlyList<string>> GetMudurlukAdlariAsync();
}

public class DepartmentOptionsService : IDepartmentOptionsService
{
    private const string CacheKey = "auth:mudurluk-adlari";
    private static readonly TimeSpan CacheDuration = TimeSpan.FromMinutes(15);

    private readonly IDatabaseService _databaseService;
    private readonly IMemoryCache _cache;
    private readonly ILogger<DepartmentOptionsService> _logger;

    public DepartmentOptionsService(
        IDatabaseService databaseService,
        IMemoryCache cache,
        ILogger<DepartmentOptionsService> logger)
    {
        _databaseService = databaseService;
        _cache = cache;
        _logger = logger;
    }

    public async Task<IReadOnlyList<string>> GetMudurlukAdlariAsync()
    {
        if (_cache.TryGetValue(CacheKey, out IReadOnlyList<string>? cached) && cached != null)
            return cached;

        var names = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        await CollectDistinctAsync(names, "Fact_BekleyenSurecler", "MudurlukAdi");
        await CollectDistinctAsync(names, "Fact_QDMS", "Sisteme Girenin Müdürlük/Direktörlüğü");

        var sorted = names
            .OrderBy(n => n, StringComparer.Create(new CultureInfo("tr-TR"), false))
            .ToList();

        _cache.Set(CacheKey, sorted, CacheDuration);
        return sorted;
    }

    private async Task CollectDistinctAsync(HashSet<string> names, string table, string column)
    {
        try
        {
            var col = QuoteSqlColumn(column);
            var sql = $@"
                SELECT DISTINCT CAST({col} AS NVARCHAR(4000)) AS Ad
                FROM [{table}]
                WHERE {col} IS NOT NULL
                  AND LTRIM(RTRIM(CAST({col} AS NVARCHAR(4000)))) <> N''";

            var rows = await _databaseService.QueryAsync<string>("BellonaRapor", sql);
            foreach (var row in rows)
            {
                if (!string.IsNullOrWhiteSpace(row))
                    names.Add(row.Trim());
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Müdürlük listesi okunamadı: {Table}.{Column}", table, column);
        }
    }

    private static string QuoteSqlColumn(string name)
    {
        var trimmed = name.Trim();
        if (trimmed.StartsWith('[')) return trimmed;
        return $"[{trimmed.Replace("]", "]]")}]";
    }
}
