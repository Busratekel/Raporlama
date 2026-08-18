using System.Security.Cryptography;
using System.Text;
using Dapper;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Options;
using Raporlama.API.Configuration;

namespace Raporlama.API.Services;

public sealed class LoginChallenge
{
    public required string UserName { get; init; }
    public required string OtpHash { get; init; }
    public int Attempts { get; set; }
    public DateTime ExpiresUtc { get; init; }
}

public sealed class PhoneSetupChallenge
{
    public required string UserName { get; init; }
    public DateTime ExpiresUtc { get; init; }
}

public sealed class OtpResendSession
{
    public required string UserName { get; init; }
    public int ResendCount { get; set; }
    public DateTime LastSentUtc { get; set; }
    public DateTime ExpiresUtc { get; init; }
}

public sealed class LoginStartResult
{
    public bool Success { get; init; }
    public string? Error { get; init; }
    public bool RequiresPhoneSetup { get; init; }
    public string? SetupChallengeId { get; init; }
    public string? ChallengeId { get; init; }
    public string? MaskedPhone { get; init; }
    public int ExpiresInSeconds { get; init; }
}

public interface ILoginOtpService
{
    Task<LoginStartResult> StartLoginAsync(
        string userName, string password, CancellationToken cancellationToken = default);

    Task<LoginStartResult> RegisterPhoneAndSendOtpAsync(
        string setupChallengeId, string cepTelefonu, CancellationToken cancellationToken = default);

    Task<(bool Success, string? UserName, string? Error)> VerifyOtpAsync(
        string challengeId, string otpCode, CancellationToken cancellationToken = default);

    Task<LoginStartResult> ResendOtpAsync(
        string challengeId, CancellationToken cancellationToken = default);
}

public sealed class LoginOtpService : ILoginOtpService
{
    private const string CachePrefix = "login-otp:";
    private const string PhoneSetupPrefix = "login-phone-setup:";
    private const string ResendPrefix = "login-resend:";
    private static readonly TimeSpan PhoneSetupExpiry = TimeSpan.FromMinutes(10);

    private readonly IActiveDirectoryAuthService _adAuth;
    private readonly ISmsSender _smsSender;
    private readonly IMemoryCache _cache;
    private readonly LocalAuthOptions _localAuth;
    private readonly SmsOptions _smsOptions;
    private readonly IConfiguration _configuration;
    private readonly ILogger<LoginOtpService> _logger;

    public LoginOtpService(
        IActiveDirectoryAuthService adAuth,
        ISmsSender smsSender,
        IMemoryCache cache,
        IOptions<LocalAuthOptions> localAuth,
        IOptions<SmsOptions> smsOptions,
        IConfiguration configuration,
        ILogger<LoginOtpService> logger)
    {
        _adAuth = adAuth;
        _smsSender = smsSender;
        _cache = cache;
        _localAuth = localAuth.Value;
        _smsOptions = smsOptions.Value;
        _configuration = configuration;
        _logger = logger;
    }

    public async Task<LoginStartResult> StartLoginAsync(
        string userName, string password, CancellationToken cancellationToken = default)
    {
        if (!_localAuth.Enabled)
            return Fail("Yerel giriş devre dışı.");

        if (!_adAuth.ValidateCredentials(userName, password))
            return Fail("Kullanıcı adı veya şifre hatalı.");

        var canonical = await ResolveCanonicalUserNameAsync(userName);
        if (canonical == null)
            return Fail("Bu kullanıcı raporlama sisteminde tanımlı değil veya pasif.");

        var phone = await GetUserPhoneAsync(canonical);
        if (string.IsNullOrWhiteSpace(phone))
        {
            if (!_localAuth.AllowSelfPhoneRegistration)
                return Fail("Kayıtlı cep telefonu bulunamadı. IT yöneticinize başvurun.");

            var setupId = Guid.NewGuid().ToString("N");
            var expires = DateTime.UtcNow.Add(PhoneSetupExpiry);
            _cache.Set(PhoneSetupPrefix + setupId, new PhoneSetupChallenge
            {
                UserName = canonical,
                ExpiresUtc = expires
            }, expires);

            _logger.LogInformation("Telefon kaydı gerekli: {User}", canonical);
            return new LoginStartResult
            {
                Success = true,
                RequiresPhoneSetup = true,
                SetupChallengeId = setupId
            };
        }

        return await SendOtpAsync(canonical, phone, cancellationToken);
    }

    public async Task<LoginStartResult> RegisterPhoneAndSendOtpAsync(
        string setupChallengeId, string cepTelefonu, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(setupChallengeId))
            return Fail("Oturum süresi doldu. Tekrar giriş yapın.");

        if (!PhoneNormalizer.TryNormalizeForStorage(cepTelefonu, out var normalized, out var phoneError))
            return Fail(phoneError ?? "Geçersiz telefon numarası.");

        if (!_cache.TryGetValue(PhoneSetupPrefix + setupChallengeId, out PhoneSetupChallenge? setup) || setup == null)
            return Fail("Oturum süresi doldu. Tekrar giriş yapın.");

        if (DateTime.UtcNow > setup.ExpiresUtc)
        {
            _cache.Remove(PhoneSetupPrefix + setupChallengeId);
            return Fail("Oturum süresi doldu. Tekrar giriş yapın.");
        }

        await SaveUserPhoneAsync(setup.UserName, normalized!);
        _cache.Remove(PhoneSetupPrefix + setupChallengeId);

        _logger.LogInformation("Kullanıcı cep telefonu kaydetti: {User}", setup.UserName);
        return await SendOtpAsync(setup.UserName, normalized!, cancellationToken);
    }

    public Task<(bool Success, string? UserName, string? Error)> VerifyOtpAsync(
        string challengeId, string otpCode, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(challengeId) || string.IsNullOrWhiteSpace(otpCode))
            return Task.FromResult<(bool, string?, string?)>((false, null, "Doğrulama kodu gerekli."));

        if (!_cache.TryGetValue(CachePrefix + challengeId, out LoginChallenge? challenge) || challenge == null)
            return Task.FromResult<(bool, string?, string?)>((false, null, "Oturum süresi doldu. Tekrar giriş yapın."));

        if (DateTime.UtcNow > challenge.ExpiresUtc)
        {
            _cache.Remove(CachePrefix + challengeId);
            return Task.FromResult<(bool, string?, string?)>((false, null, "Doğrulama kodunun süresi doldu."));
        }

        challenge.Attempts++;
        if (challenge.Attempts > _localAuth.OtpMaxAttempts)
        {
            ClearOtpSession(challengeId);
            return Task.FromResult<(bool, string?, string?)>((false, null, "Çok fazla hatalı deneme."));
        }

        var hash = HashOtp(otpCode.Trim());
        if (!CryptographicOperations.FixedTimeEquals(
                Encoding.UTF8.GetBytes(hash),
                Encoding.UTF8.GetBytes(challenge.OtpHash)))
        {
            _cache.Set(CachePrefix + challengeId, challenge, challenge.ExpiresUtc);
            return Task.FromResult<(bool, string?, string?)>((false, null, "Doğrulama kodu hatalı."));
        }

        _cache.Remove(CachePrefix + challengeId);
        RemoveResendSession(challengeId);
        return Task.FromResult<(bool, string?, string?)>((true, challenge.UserName, null));
    }

    public async Task<LoginStartResult> ResendOtpAsync(
        string challengeId, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(challengeId))
            return Fail("Geçersiz oturum. Tekrar giriş yapın.");

        if (!_cache.TryGetValue(ResendPrefix + challengeId, out OtpResendSession? session) || session == null)
            return Fail("Oturum süresi doldu. Tekrar giriş yapın.");

        if (DateTime.UtcNow > session.ExpiresUtc)
        {
            RemoveResendSession(challengeId);
            return Fail("Oturum süresi doldu. Tekrar giriş yapın.");
        }

        if (session.ResendCount >= _localAuth.OtpMaxResends)
            return Fail("Yeni kod limitine ulaşıldı. Baştan giriş yapın.");

        var waitSeconds = _localAuth.OtpResendCooldownSeconds -
                          (int)(DateTime.UtcNow - session.LastSentUtc).TotalSeconds;
        if (waitSeconds > 0)
            return Fail($"Yeni kod için {waitSeconds} saniye bekleyin.");

        var phone = await GetUserPhoneAsync(session.UserName);
        if (string.IsNullOrWhiteSpace(phone))
            return Fail("Kayıtlı cep telefonu bulunamadı.");

        _cache.Remove(CachePrefix + challengeId);

        var otp = RandomNumberGenerator.GetInt32(100000, 999999).ToString();
        var expiresUtc = DateTime.UtcNow.AddSeconds(_localAuth.OtpExpirySeconds);
        var challenge = new LoginChallenge
        {
            UserName = session.UserName,
            OtpHash = HashOtp(otp),
            Attempts = 0,
            ExpiresUtc = expiresUtc
        };
        _cache.Set(CachePrefix + challengeId, challenge, expiresUtc);

        session.ResendCount++;
        session.LastSentUtc = DateTime.UtcNow;
        _cache.Set(ResendPrefix + challengeId, session, session.ExpiresUtc);

        var expiryLabel = FormatOtpExpiryLabel(_localAuth.OtpExpirySeconds);
        var message = string.Format(_smsOptions.OtpMessageTemplate, otp, expiryLabel);
        await _smsSender.SendAsync(phone, message, cancellationToken);

        _logger.LogInformation("OTP yeniden gönderildi: {User}, resend={Count}", session.UserName, session.ResendCount);
        return new LoginStartResult
        {
            Success = true,
            ChallengeId = challengeId,
            MaskedPhone = MaskPhone(phone),
            ExpiresInSeconds = _localAuth.OtpExpirySeconds
        };
    }

    private void RemoveResendSession(string challengeId)
    {
        _cache.Remove(ResendPrefix + challengeId);
    }

    private void ClearOtpSession(string challengeId)
    {
        _cache.Remove(CachePrefix + challengeId);
        RemoveResendSession(challengeId);
    }

    private async Task<LoginStartResult> SendOtpAsync(
        string canonicalUserName, string phone, CancellationToken cancellationToken)
    {
        var otp = RandomNumberGenerator.GetInt32(100000, 999999).ToString();
        var challengeId = Guid.NewGuid().ToString("N");
        var challenge = new LoginChallenge
        {
            UserName = canonicalUserName,
            OtpHash = HashOtp(otp),
            Attempts = 0,
            ExpiresUtc = DateTime.UtcNow.AddSeconds(_localAuth.OtpExpirySeconds)
        };

        _cache.Set(CachePrefix + challengeId, challenge, challenge.ExpiresUtc);

        var sessionExpiry = DateTime.UtcNow.AddMinutes(_localAuth.OtpResendSessionMinutes);
        _cache.Set(ResendPrefix + challengeId, new OtpResendSession
        {
            UserName = canonicalUserName,
            ResendCount = 0,
            LastSentUtc = DateTime.UtcNow,
            ExpiresUtc = sessionExpiry
        }, sessionExpiry);

        var expiryLabel = FormatOtpExpiryLabel(_localAuth.OtpExpirySeconds);
        var message = string.Format(_smsOptions.OtpMessageTemplate, otp, expiryLabel);
        await _smsSender.SendAsync(phone, message, cancellationToken);

        _logger.LogInformation("OTP gönderildi: {User}", canonicalUserName);
        return new LoginStartResult
        {
            Success = true,
            ChallengeId = challengeId,
            MaskedPhone = MaskPhone(phone),
            ExpiresInSeconds = _localAuth.OtpExpirySeconds
        };
    }

    private static string FormatOtpExpiryLabel(int seconds) =>
        seconds >= 60
            ? (seconds % 60 == 0 ? $"{seconds / 60} dk" : $"{seconds / 60.0:0.#} dk")
            : $"{seconds} sn";

    private static LoginStartResult Fail(string error) =>
        new() { Success = false, Error = error };

    private async Task SaveUserPhoneAsync(string canonicalUserName, string normalizedPhone)
    {
        await using var conn = new SqlConnection(_configuration.GetConnectionString("BellonaRapor"));
        await conn.ExecuteAsync(
            "UPDATE [User] SET CepTelefonu = @CepTelefonu WHERE UserName = @UserName AND Aktif = 1",
            new { UserName = canonicalUserName, CepTelefonu = normalizedPhone });
    }

    private async Task<string?> ResolveCanonicalUserNameAsync(string userName)
    {
        var loginName = userName.Contains('\\') ? userName[(userName.IndexOf('\\') + 1)..] : userName.Trim();
        var domain = _localAuth.AdDomain?.Trim();
        var fullName = !string.IsNullOrEmpty(domain) && !userName.Contains('\\')
            ? $"{domain}\\{loginName}"
            : userName.Trim();

        await using var conn = new SqlConnection(_configuration.GetConnectionString("BellonaRapor"));
        var row = await conn.QueryFirstOrDefaultAsync<string?>(
            @"SELECT TOP 1 UserName FROM [User]
              WHERE Aktif = 1 AND (
                  UserName = @Full OR UserName = @Login OR
                  SUBSTRING(UserName, CHARINDEX('\', UserName) + 1, 4000) = @Login
              )",
            new { Full = fullName, Login = loginName });

        return row;
    }

    private async Task<string?> GetUserPhoneAsync(string canonicalUserName)
    {
        await using var conn = new SqlConnection(_configuration.GetConnectionString("BellonaRapor"));
        return await conn.QueryFirstOrDefaultAsync<string?>(
            "SELECT CepTelefonu FROM [User] WHERE UserName = @UserName AND Aktif = 1",
            new { UserName = canonicalUserName });
    }

    private static string HashOtp(string otp) =>
        Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(otp)));

    private static string MaskPhone(string phone)
    {
        var digits = new string(phone.Where(char.IsDigit).ToArray());
        if (digits.Length < 4) return "****";
        return "*** *** " + digits[^2..];
    }
}
