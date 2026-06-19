using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using Raporlama.API.Configuration;

namespace Raporlama.API.Services;

public sealed record SsoValidationResult(bool Success, string UserName, string ErrorMessage)
{
    public static SsoValidationResult Ok(string userName) => new(true, userName, string.Empty);
    public static SsoValidationResult Fail(string message) => new(false, string.Empty, message);
}

public interface ISsoTokenValidator
{
    Task<SsoValidationResult> ValidateAsync(string ssoToken, CancellationToken cancellationToken = default);
}

/// <summary>
/// SSO token doğrulama: varsayılan olarak yerelde imza kontrolü (Portal HTTP çağrısı gerekmez).
/// </summary>
public sealed class SsoTokenValidator : ISsoTokenValidator
{
    private readonly PortalAuthOptions _options;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ILogger<SsoTokenValidator> _logger;

    public SsoTokenValidator(
        IOptions<PortalAuthOptions> options,
        IHttpClientFactory httpClientFactory,
        ILogger<SsoTokenValidator> logger)
    {
        _options = options.Value;
        _httpClientFactory = httpClientFactory;
        _logger = logger;
    }

    public async Task<SsoValidationResult> ValidateAsync(string ssoToken, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(_options.SsoApiKey))
            return SsoValidationResult.Fail("PortalAuth:SsoApiKey boş. Portal ile aynı gizli anahtarı appsettings.json içine girin.");

        var local = ValidateSignedToken(ssoToken);
        if (local.Success)
            return local;

        if (string.Equals(_options.SsoValidationMode, "Remote", StringComparison.OrdinalIgnoreCase))
            return await ValidateRemoteAsync(ssoToken, cancellationToken);

        return local;
    }

    private SsoValidationResult ValidateSignedToken(string ssoToken)
    {
        var jwt = TryValidateJwt(ssoToken);
        if (jwt.Success)
            return jwt;

        var compact = TryValidateCompactHmac(ssoToken);
        if (compact.Success)
            return compact;

        if (!ssoToken.Contains('.'))
        {
            return SsoValidationResult.Fail(
                "SSO token imzalı formatta değil. Portal, ssoToken'ı SsoApiKey ile imzalı üretmeli " +
                "(PortalIntegration/PortalSsoTokenHelper.example.cs). ValidateSsoToken endpoint'i canlıda yok.");
        }

        return SsoValidationResult.Fail("SSO token geçersiz veya süresi dolmuş. Portaldan yeniden giriş deneyin.");
    }

    private SsoValidationResult TryValidateJwt(string token)
    {
        if (_options.SsoApiKey.Length < 32)
            return SsoValidationResult.Fail(string.Empty);

        try
        {
            var handler = new JwtSecurityTokenHandler();
            if (!handler.CanReadToken(token))
                return SsoValidationResult.Fail(string.Empty);

            var parameters = new TokenValidationParameters
            {
                ValidateIssuer = !string.IsNullOrWhiteSpace(_options.Issuer),
                ValidIssuer = _options.Issuer,
                ValidateAudience = !string.IsNullOrWhiteSpace(_options.Audience),
                ValidAudience = _options.Audience,
                ValidateLifetime = true,
                ClockSkew = TimeSpan.FromSeconds(30),
                ValidateIssuerSigningKey = true,
                IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_options.SsoApiKey))
            };

            var principal = handler.ValidateToken(token, parameters, out _);
            var userName = principal.FindFirst(ClaimTypes.Name)?.Value
                ?? principal.FindFirst(JwtRegisteredClaimNames.Sub)?.Value
                ?? principal.FindFirst("userName")?.Value;

            if (string.IsNullOrWhiteSpace(userName))
                return SsoValidationResult.Fail("JWT doğrulandı ancak kullanıcı adı claim'i bulunamadı.");

            return SsoValidationResult.Ok(userName);
        }
        catch (Exception ex)
        {
            _logger.LogDebug(ex, "JWT SSO doğrulanamadı.");
            return SsoValidationResult.Fail(string.Empty);
        }
    }

    private SsoValidationResult TryValidateCompactHmac(string token)
    {
        var parts = token.Split('.');
        if (parts.Length != 3)
            return SsoValidationResult.Fail(string.Empty);

        try
        {
            if (!long.TryParse(parts[1], out var expUnix))
                return SsoValidationResult.Fail(string.Empty);

            var now = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
            if (expUnix < now)
                return SsoValidationResult.Fail("SSO token süresi dolmuş. Portaldan yeniden giriş deneyin.");

            var payload = $"{parts[0]}.{parts[1]}";
            var expectedSig = ComputeHmacBase64Url(_options.SsoApiKey, payload);
            if (!CryptographicOperations.FixedTimeEquals(
                    Encoding.UTF8.GetBytes(expectedSig),
                    Encoding.UTF8.GetBytes(parts[2])))
            {
                return SsoValidationResult.Fail(string.Empty);
            }

            var userName = Encoding.UTF8.GetString(Base64UrlDecode(parts[0]));
            if (string.IsNullOrWhiteSpace(userName))
                return SsoValidationResult.Fail(string.Empty);

            return SsoValidationResult.Ok(userName);
        }
        catch (Exception ex)
        {
            _logger.LogDebug(ex, "Compact HMAC SSO doğrulanamadı.");
            return SsoValidationResult.Fail(string.Empty);
        }
    }

    private async Task<SsoValidationResult> ValidateRemoteAsync(string ssoToken, CancellationToken cancellationToken)
    {
        var validationUrl = BuildValidationUrl(ssoToken);
        if (validationUrl == null)
            return SsoValidationResult.Fail("Portal SSO doğrulama adresi yapılandırılmamış.");

        var client = _httpClientFactory.CreateClient();
        using var request = new HttpRequestMessage(HttpMethod.Get, validationUrl);
        request.Headers.Add("X-Sso-Api-Key", _options.SsoApiKey);
        request.Headers.Accept.Add(new System.Net.Http.Headers.MediaTypeWithQualityHeaderValue("application/json"));
        using var response = await client.SendAsync(request, cancellationToken);

        if (!response.IsSuccessStatusCode)
        {
            _logger.LogWarning("Portal SSO remote doğrulama başarısız. StatusCode={StatusCode}", response.StatusCode);
            return SsoValidationResult.Fail(
                $"Portal ValidateSsoToken endpoint'i HTTP {(int)response.StatusCode} döndü. Endpoint yayında değil veya URL yanlış.");
        }

        var body = await response.Content.ReadAsStringAsync(cancellationToken);
        using var doc = JsonDocument.Parse(body);
        var root = doc.RootElement;

        var success = root.TryGetProperty("success", out var successProp) && successProp.GetBoolean();
        if (!success)
        {
            var msg = root.TryGetProperty("message", out var m) ? m.GetString()
                : root.TryGetProperty("error", out var e) ? e.GetString() : null;
            return SsoValidationResult.Fail(msg ?? "Portal SSO token'ı reddetti.");
        }

        var userName = root.TryGetProperty("userName", out var u) ? u.GetString() : null;
        if (string.IsNullOrWhiteSpace(userName))
            return SsoValidationResult.Fail("Portal cevabında userName yok.");

        return SsoValidationResult.Ok(userName);
    }

    private Uri? BuildValidationUrl(string ssoToken)
    {
        var configuredUrl = _options.SsoValidationUrl;
        if (string.IsNullOrWhiteSpace(configuredUrl))
        {
            if (string.IsNullOrWhiteSpace(_options.PortalLoginUrl))
                return null;
            configuredUrl = new Uri(new Uri(_options.PortalLoginUrl.TrimEnd('/') + "/"), "Rapor/ValidateSsoToken").ToString();
        }

        var separator = configuredUrl.Contains('?') ? '&' : '?';
        return new Uri($"{configuredUrl}{separator}token={Uri.EscapeDataString(ssoToken)}");
    }

    internal static string ComputeHmacBase64Url(string secret, string payload)
    {
        using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(secret));
        var hash = hmac.ComputeHash(Encoding.UTF8.GetBytes(payload));
        return Base64UrlEncode(hash);
    }

    internal static string Base64UrlEncode(byte[] data) =>
        Convert.ToBase64String(data).TrimEnd('=').Replace('+', '-').Replace('/', '_');

    internal static byte[] Base64UrlDecode(string input)
    {
        var padded = input.Replace('-', '+').Replace('_', '/');
        switch (padded.Length % 4)
        {
            case 2: padded += "=="; break;
            case 3: padded += "="; break;
        }
        return Convert.FromBase64String(padded);
    }
}
