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

public sealed class SicilSetupChallenge
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
    public bool RequiresSicilSetup { get; init; }
    public bool TrustedDeviceLogin { get; init; }
    public string? UserName { get; init; }
    public string? SetupChallengeId { get; init; }
    public string? ChallengeId { get; init; }
    public string? MaskedPhone { get; init; }
    public int ExpiresInSeconds { get; init; }
}

public interface ILoginOtpService
{
    Task<LoginStartResult> StartLoginAsync(
        string userName, string password, string? trustedDeviceToken = null, CancellationToken cancellationToken = default);

    Task<LoginStartResult> RegisterSicilAndSendOtpAsync(
        string setupChallengeId, string sicil, CancellationToken cancellationToken = default);

    Task<(bool Success, string? UserName, string? Error)> VerifyOtpAsync(
        string challengeId, string otpCode, CancellationToken cancellationToken = default);

    Task<LoginStartResult> ResendOtpAsync(
        string challengeId, CancellationToken cancellationToken = default);
}

public sealed class LoginOtpService : ILoginOtpService
{
    private const string CachePrefix = "login-otp:";
    private const string SicilSetupPrefix = "login-sicil-setup:";
    private const string ResendPrefix = "login-resend:";
    private static readonly TimeSpan SicilSetupExpiry = TimeSpan.FromMinutes(10);

    private readonly IActiveDirectoryAuthService _adAuth;
    private readonly IEmployeeDirectoryService _employeeDirectory;
    private readonly ITrustedDeviceService _trustedDeviceService;
    private readonly ISmsSender _smsSender;
    private readonly IMemoryCache _cache;
    private readonly LocalAuthOptions _localAuth;
    private readonly SmsOptions _smsOptions;
    private readonly IConfiguration _configuration;
    private readonly ILogger<LoginOtpService> _logger;

    public LoginOtpService(
        IActiveDirectoryAuthService adAuth,
        IEmployeeDirectoryService employeeDirectory,
        ITrustedDeviceService trustedDeviceService,
        ISmsSender smsSender,
        IMemoryCache cache,
        IOptions<LocalAuthOptions> localAuth,
        IOptions<SmsOptions> smsOptions,
        IConfiguration configuration,
        ILogger<LoginOtpService> logger)
    {
        _adAuth = adAuth;
        _employeeDirectory = employeeDirectory;
        _trustedDeviceService = trustedDeviceService;
        _smsSender = smsSender;
        _cache = cache;
        _localAuth = localAuth.Value;
        _smsOptions = smsOptions.Value;
        _configuration = configuration;
        _logger = logger;
    }

    public async Task<LoginStartResult> StartLoginAsync(
        string userName, string password, string? trustedDeviceToken = null, CancellationToken cancellationToken = default)
    {
        if (!_localAuth.Enabled)
            return Fail("Yerel giriş devre dışı.");

        if (!_adAuth.ValidateCredentials(userName, password))
            return Fail("Kullanıcı adı ve şifre hatalı.");

        var canonical = BuildCanonicalUserName(userName);

        if (_localAuth.TrustedDeviceEnabled && !string.IsNullOrWhiteSpace(trustedDeviceToken))
        {
            var trustedUser = await _trustedDeviceService.ValidateTokenAsync(trustedDeviceToken, cancellationToken);
            if (trustedUser != null
                && string.Equals(trustedUser, canonical, StringComparison.OrdinalIgnoreCase))
            {
                _logger.LogInformation("Güvenilir cihaz ile giriş (SMS atlandı): {User}", canonical);
                return new LoginStartResult { Success = true, TrustedDeviceLogin = true, UserName = canonical };
            }
        }

        var user = await GetUserLoginRecordAsync(canonical);

        if (user != null && !user.IsActive)
            return Fail("Bu kullanıcı pasif durumda. IT yöneticinize başvurun.");

        if (user == null && !_localAuth.AllowSelfSicilRegistration)
            return Fail("Bu kullanıcı raporlama sisteminde tanımlı değil. IT yöneticinize başvurun.");

        var phone = await ResolveLoginPhoneAsync(user, cancellationToken);
        if (!string.IsNullOrWhiteSpace(phone))
            return await SendOtpAsync(canonical, phone, cancellationToken);

        if (!_localAuth.AllowSelfSicilRegistration)
            return Fail("Kayıtlı sicil veya cep telefonu bulunamadı. IT yöneticinize başvurun.");

        var setupId = Guid.NewGuid().ToString("N");
        var expires = DateTime.UtcNow.Add(SicilSetupExpiry);
        _cache.Set(SicilSetupPrefix + setupId, new SicilSetupChallenge
        {
            UserName = canonical,
            ExpiresUtc = expires
        }, expires);

        _logger.LogInformation("Sicil kaydı gerekli: {User}", canonical);
        return new LoginStartResult
        {
            Success = true,
            RequiresSicilSetup = true,
            SetupChallengeId = setupId
        };
    }

    public async Task<LoginStartResult> RegisterSicilAndSendOtpAsync(
        string setupChallengeId, string sicil, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(setupChallengeId))
            return Fail("Oturum süresi doldu. Tekrar giriş yapın.");

        var normalizedSicil = NormalizeSicil(sicil);
        if (string.IsNullOrWhiteSpace(normalizedSicil))
            return Fail("Geçerli bir sicil numarası girin.");

        if (!_cache.TryGetValue(SicilSetupPrefix + setupChallengeId, out SicilSetupChallenge? setup) || setup == null)
            return Fail("Oturum süresi doldu. Tekrar giriş yapın.");

        if (DateTime.UtcNow > setup.ExpiresUtc)
        {
            _cache.Remove(SicilSetupPrefix + setupChallengeId);
            return Fail("Oturum süresi doldu. Tekrar giriş yapın.");
        }

        var employee = await _employeeDirectory.FindBySicilAsync(normalizedSicil, cancellationToken);
        if (employee == null)
            return Fail("Sicil bulunamadı. Numarayı kontrol edip tekrar deneyin.");

        if (!PhoneNormalizer.TryNormalizeForStorage(employee.CellPhone, out var normalizedPhone, out var phoneError))
            return Fail(phoneError ?? "Bu sicile kayıtlı geçerli bir cep telefonu bulunamadı. IT yöneticinize başvurun.");

        if (await IsSicilUsedByAnotherUserAsync(normalizedSicil, setup.UserName))
            return Fail("Bu sicil başka bir kullanıcıya kayıtlı.");

        await EnsureUserWithEmployeeAsync(setup.UserName, normalizedSicil, normalizedPhone!, employee);
        _cache.Remove(SicilSetupPrefix + setupChallengeId);

        _logger.LogInformation("Kullanıcı sicil kaydetti: {User}, Sicil={Sicil}", setup.UserName, normalizedSicil);
        return await SendOtpAsync(setup.UserName, normalizedPhone!, cancellationToken);
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

        var user = await GetUserLoginRecordAsync(session.UserName);
        var phone = await ResolveLoginPhoneAsync(user, cancellationToken);
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

    private async Task<string?> ResolveLoginPhoneAsync(
        UserLoginRecord? user, CancellationToken cancellationToken)
    {
        if (user == null || string.IsNullOrWhiteSpace(user.Sicil))
            return null;

        var employee = await _employeeDirectory.FindBySicilAsync(user.Sicil, cancellationToken);
        if (employee != null
            && PhoneNormalizer.TryNormalizeForStorage(employee.CellPhone, out var fromTwof, out _)
            && !string.IsNullOrWhiteSpace(fromTwof))
        {
            if (!string.Equals(user.CepTelefonu, fromTwof, StringComparison.Ordinal))
                await UpdateUserPhoneAsync(user.UserName, fromTwof!);

            return fromTwof;
        }

        return string.IsNullOrWhiteSpace(user.CepTelefonu) ? null : user.CepTelefonu;
    }

    private async Task EnsureUserWithEmployeeAsync(
        string canonicalUserName,
        string sicil,
        string normalizedPhone,
        EmployeeDirectoryRecord employee)
    {
        var displayName = string.IsNullOrWhiteSpace(employee.DisplayName)
            ? canonicalUserName
            : employee.DisplayName;
        var email = string.IsNullOrWhiteSpace(employee.Email) ? null : employee.Email.Trim();
        var mudurluk = string.IsNullOrWhiteSpace(employee.DepartmentName) ? null : employee.DepartmentName.Trim();

        await using var conn = new SqlConnection(_configuration.GetConnectionString("BellonaRapor"));
        var existingKey = await conn.QueryFirstOrDefaultAsync<int?>(
            "SELECT UserKey FROM [User] WHERE UserName = @UserName",
            new { UserName = canonicalUserName });

        if (existingKey.HasValue)
        {
            await conn.ExecuteAsync(
                @"UPDATE [User]
                  SET Sicil = @Sicil,
                      CepTelefonu = @CepTelefonu,
                      DisplayName = @DisplayName,
                      Email = COALESCE(@Email, Email),
                      MudurlukAdi = COALESCE(@MudurlukAdi, MudurlukAdi),
                      Aktif = 1
                  WHERE UserKey = @UserKey",
                new
                {
                    UserKey = existingKey.Value,
                    Sicil = sicil,
                    CepTelefonu = normalizedPhone,
                    DisplayName = displayName,
                    Email = email,
                    MudurlukAdi = mudurluk
                });
            return;
        }

        await conn.ExecuteAsync(
            @"INSERT INTO [User] (UserName, DisplayName, Email, Aktif, Groups, Sicil, CepTelefonu, MudurlukAdi)
              VALUES (@UserName, @DisplayName, @Email, 1, '', @Sicil, @CepTelefonu, @MudurlukAdi)",
            new
            {
                UserName = canonicalUserName,
                DisplayName = displayName,
                Email = email ?? "",
                Sicil = sicil,
                CepTelefonu = normalizedPhone,
                MudurlukAdi = mudurluk
            });
    }

    private async Task<bool> IsSicilUsedByAnotherUserAsync(string sicil, string canonicalUserName)
    {
        await using var conn = new SqlConnection(_configuration.GetConnectionString("BellonaRapor"));
        var owner = await conn.QueryFirstOrDefaultAsync<string?>(
            @"SELECT TOP 1 UserName FROM [User]
              WHERE Sicil = @Sicil AND Aktif = 1 AND UserName <> @UserName",
            new { Sicil = sicil, UserName = canonicalUserName });

        return !string.IsNullOrWhiteSpace(owner);
    }

    private async Task UpdateUserPhoneAsync(string canonicalUserName, string normalizedPhone)
    {
        await using var conn = new SqlConnection(_configuration.GetConnectionString("BellonaRapor"));
        await conn.ExecuteAsync(
            "UPDATE [User] SET CepTelefonu = @CepTelefonu WHERE UserName = @UserName AND Aktif = 1",
            new { UserName = canonicalUserName, CepTelefonu = normalizedPhone });
    }

    private void RemoveResendSession(string challengeId) => _cache.Remove(ResendPrefix + challengeId);

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

    private static string NormalizeSicil(string sicil) =>
        string.IsNullOrWhiteSpace(sicil) ? "" : sicil.Trim();

    private string BuildCanonicalUserName(string userName)
    {
        var trimmed = userName.Trim();
        if (trimmed.Contains('\\'))
            return trimmed;

        var domain = _localAuth.AdDomain?.Trim();
        return !string.IsNullOrEmpty(domain) ? $"{domain}\\{trimmed}" : trimmed;
    }

    private async Task<UserLoginRecord?> GetUserLoginRecordAsync(string canonicalUserName)
    {
        var loginName = canonicalUserName.Contains('\\')
            ? canonicalUserName[(canonicalUserName.IndexOf('\\') + 1)..]
            : canonicalUserName;

        await using var conn = new SqlConnection(_configuration.GetConnectionString("BellonaRapor"));
        return await conn.QueryFirstOrDefaultAsync<UserLoginRecord>(
            @"SELECT TOP 1 UserName, Sicil, CepTelefonu, Aktif AS IsActive
              FROM [User]
              WHERE UserName = @Full
                 OR SUBSTRING(UserName, CHARINDEX('\', UserName) + 1, 4000) = @Login
              ORDER BY UserKey",
            new { Full = canonicalUserName, Login = loginName });
    }

    private static string HashOtp(string otp) =>
        Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(otp)));

    private static string MaskPhone(string phone)
    {
        var digits = new string(phone.Where(char.IsDigit).ToArray());
        if (digits.Length < 4) return "****";
        return "*** *** " + digits[^2..];
    }

    private sealed class UserLoginRecord
    {
        public string UserName { get; set; } = "";
        public string? Sicil { get; set; }
        public string? CepTelefonu { get; set; }
        public bool IsActive { get; set; }
    }
}
