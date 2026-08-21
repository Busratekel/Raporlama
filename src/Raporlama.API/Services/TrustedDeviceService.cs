using System.Security.Cryptography;
using System.Text;
using Dapper;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Options;
using Raporlama.API.Configuration;

namespace Raporlama.API.Services;

public interface ITrustedDeviceService
{
    const string CookieName = "Raporlama.TrustedDevice";

    Task<string?> ValidateTokenAsync(string rawToken, CancellationToken cancellationToken = default);

    Task<string> IssueTokenAsync(string canonicalUserName, CancellationToken cancellationToken = default);

    Task RevokeTokenAsync(string rawToken, CancellationToken cancellationToken = default);
}

public sealed class TrustedDeviceService : ITrustedDeviceService
{
    private readonly LocalAuthOptions _options;
    private readonly IConfiguration _configuration;
    private readonly ILogger<TrustedDeviceService> _logger;

    public TrustedDeviceService(
        IOptions<LocalAuthOptions> options,
        IConfiguration configuration,
        ILogger<TrustedDeviceService> logger)
    {
        _options = options.Value;
        _configuration = configuration;
        _logger = logger;
    }

    public async Task<string?> ValidateTokenAsync(string rawToken, CancellationToken cancellationToken = default)
    {
        if (!_options.TrustedDeviceEnabled || string.IsNullOrWhiteSpace(rawToken))
            return null;

        var hash = HashToken(rawToken.Trim());
        await using var conn = new SqlConnection(_configuration.GetConnectionString("BellonaRapor"));

        var row = await conn.QueryFirstOrDefaultAsync<TrustedDeviceRow>(
            @"SELECT TOP 1 u.UserName, d.ExpiresUtc
              FROM UserTrustedDevice d
              INNER JOIN [User] u ON u.UserKey = d.UserKey
              WHERE d.TokenHash = @TokenHash AND u.Aktif = 1",
            new { TokenHash = hash });

        if (row == null || row.ExpiresUtc <= DateTime.UtcNow)
            return null;

        await conn.ExecuteAsync(
            "UPDATE UserTrustedDevice SET LastUsedUtc = SYSDATETIME() WHERE TokenHash = @TokenHash",
            new { TokenHash = hash });

        return row.UserName;
    }

    public async Task<string> IssueTokenAsync(string canonicalUserName, CancellationToken cancellationToken = default)
    {
        var rawToken = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32));
        if (!_options.TrustedDeviceEnabled)
            return rawToken;

        await using var conn = new SqlConnection(_configuration.GetConnectionString("BellonaRapor"));
        var userKey = await conn.QueryFirstOrDefaultAsync<int?>(
            "SELECT TOP 1 UserKey FROM [User] WHERE UserName = @UserName AND Aktif = 1",
            new { UserName = canonicalUserName });

        if (!userKey.HasValue)
            return rawToken;

        var hash = HashToken(rawToken);
        var expiresUtc = DateTime.UtcNow.AddDays(_options.TrustedDeviceDays);

        await conn.ExecuteAsync(
            @"INSERT INTO UserTrustedDevice (UserKey, TokenHash, ExpiresUtc)
              VALUES (@UserKey, @TokenHash, @ExpiresUtc)",
            new { UserKey = userKey.Value, TokenHash = hash, ExpiresUtc = expiresUtc });

        _logger.LogInformation("Güvenilir cihaz kaydedildi: {User}, {Days} gün",
            canonicalUserName, _options.TrustedDeviceDays);

        return rawToken;
    }

    public async Task RevokeTokenAsync(string rawToken, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(rawToken))
            return;

        await using var conn = new SqlConnection(_configuration.GetConnectionString("BellonaRapor"));
        await conn.ExecuteAsync(
            "DELETE FROM UserTrustedDevice WHERE TokenHash = @TokenHash",
            new { TokenHash = HashToken(rawToken.Trim()) });
    }

    private static string HashToken(string rawToken) =>
        Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(rawToken)));

    private sealed class TrustedDeviceRow
    {
        public string UserName { get; set; } = "";
        public DateTime ExpiresUtc { get; set; }
    }
}
