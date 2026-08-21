using Dapper;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Options;
using Raporlama.API.Configuration;

namespace Raporlama.API.Services;

public sealed class EmployeeDirectoryRecord
{
    public string Sicil { get; set; } = "";
    public string? CellPhone { get; set; }
    public string? FirstName { get; set; }
    public string? LastName { get; set; }
    public string? Email { get; set; }
    public string? DepartmentName { get; set; }

    public string DisplayName =>
        string.Join(" ", new[] { FirstName, LastName }.Where(s => !string.IsNullOrWhiteSpace(s))).Trim();
}

public interface IEmployeeDirectoryService
{
    Task<EmployeeDirectoryRecord?> FindBySicilAsync(string sicil, CancellationToken cancellationToken = default);
}

public sealed class EmployeeDirectoryService : IEmployeeDirectoryService
{
    private readonly LocalAuthOptions _options;
    private readonly IConfiguration _configuration;
    private readonly ILogger<EmployeeDirectoryService> _logger;

    public EmployeeDirectoryService(
        IOptions<LocalAuthOptions> options,
        IConfiguration configuration,
        ILogger<EmployeeDirectoryService> logger)
    {
        _options = options.Value;
        _configuration = configuration;
        _logger = logger;
    }

    public async Task<EmployeeDirectoryRecord?> FindBySicilAsync(
        string sicil, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(sicil))
            return null;

        var normalizedSicil = sicil.Trim();
        var database = SanitizeIdentifier(_options.EmployeePhoneDatabase, "eBA6");
        var table = SanitizeIdentifier(_options.EmployeePhoneTable, "TWOF_CEPTEL");

        var sql = $@"
SELECT TOP 1
    LTRIM(RTRIM(CAST(USERID AS NVARCHAR(50)))) AS Sicil,
    CPTEL AS CellPhone,
    FIRSTNAME AS FirstName,
    LASTNAME AS LastName,
    EMAIL AS Email,
    DEPARTMENTNAME AS DepartmentName
FROM [{database}].[dbo].[{table}]
WHERE LTRIM(RTRIM(CAST(USERID AS NVARCHAR(50)))) = @Sicil";

        try
        {
            await using var conn = new SqlConnection(_configuration.GetConnectionString("BellonaRapor"));
            return await conn.QueryFirstOrDefaultAsync<EmployeeDirectoryRecord>(
                new CommandDefinition(sql, new { Sicil = normalizedSicil }, cancellationToken: cancellationToken));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "TWOF çalışan kaydı okunamadı (Sicil={Sicil})", normalizedSicil);
            return null;
        }
    }

    private static string SanitizeIdentifier(string value, string fallback)
    {
        var candidate = string.IsNullOrWhiteSpace(value) ? fallback : value.Trim();
        foreach (var ch in candidate)
        {
            if (!char.IsLetterOrDigit(ch) && ch != '_')
                return fallback;
        }

        return candidate;
    }
}
