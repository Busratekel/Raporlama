using System.Security.Claims;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Options;
using Raporlama.API.Configuration;
using Raporlama.API.Services;

namespace Raporlama.API.Controllers;

[ApiController]
[Route("[controller]")]
public class AuthController : ControllerBase
{
    private readonly ISsoTokenValidator _ssoTokenValidator;
    private readonly ICustomAuthorizationService _authorizationService;
    private readonly ILoginOtpService _loginOtpService;
    private readonly PortalAuthOptions _portalOptions;
    private readonly LocalAuthOptions _localAuthOptions;
    private readonly IWebHostEnvironment _environment;
    private readonly ILogger<AuthController> _logger;

    public AuthController(
        ISsoTokenValidator ssoTokenValidator,
        ICustomAuthorizationService authorizationService,
        ILoginOtpService loginOtpService,
        IOptions<PortalAuthOptions> portalOptions,
        IOptions<LocalAuthOptions> localAuthOptions,
        IWebHostEnvironment environment,
        ILogger<AuthController> logger)
    {
        _ssoTokenValidator = ssoTokenValidator;
        _authorizationService = authorizationService;
        _loginOtpService = loginOtpService;
        _portalOptions = portalOptions.Value;
        _localAuthOptions = localAuthOptions.Value;
        _environment = environment;
        _logger = logger;
    }

    /// <summary>Portal → /Auth/Sso?ssoToken=... (imzalı token)</summary>
    [HttpGet("Sso")]
    [AllowAnonymous]
    public async Task<IActionResult> Sso(
        [FromQuery] string? ssoToken,
        [FromQuery] string? returnUrl = null)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(ssoToken))
                return Content("ssoToken gerekli. Lütfen portaldan tekrar deneyin.", "text/plain; charset=utf-8");

            var validation = await _ssoTokenValidator.ValidateAsync(ssoToken);
            if (!validation.Success)
                return Content(validation.ErrorMessage, "text/plain; charset=utf-8");

            var normalized = NormalizeUserName(validation.UserName);
            await SignInUserAsync(normalized, "portal");
            _logger.LogInformation("Portal SSO giriş: {UserName}", normalized);

            return Redirect(SafeReturnUrl(returnUrl));
        }
        catch (SqlException ex) when (ex.Number == 18456)
        {
            _logger.LogError(ex, "SQL login hatası SSO sonrası.");
            return Content(
                "Veritabanı bağlantısı kurulamadı. IIS uygulama havuzu hesabının SQL Server erişimi yok. " +
                "IT/DBA ekibinden BellonaRapor veritabanı için app pool hesabına yetki isteyin " +
                "veya appsettings.json connection string'de SQL kullanıcı/parola kullanın.",
                "text/plain; charset=utf-8");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "SSO giriş hatası.");
            return Content($"Giriş hatası: {ex.Message}", "text/plain; charset=utf-8");
        }
    }

    [HttpGet("cikis")]
    [AllowAnonymous]
    public async Task<IActionResult> Cikis()
    {
        var loginSource = User.FindFirst("login_source")?.Value;
        await HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);

        return loginSource switch
        {
            "portal" when !string.IsNullOrWhiteSpace(_portalOptions.PortalLoginUrl)
                => Redirect(_portalOptions.PortalLoginUrl.Trim()),
            "sms" or "dev" => Redirect("/login.html"),
            _ => Redirect("/menu.html")
        };
    }

    /// <summary>Dış giriş adım 1: AD kullanıcı adı + şifre → SMS OTP gönderilir.</summary>
    [HttpPost("login")]
    [AllowAnonymous]
    public async Task<IActionResult> Login([FromBody] LoginRequest request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.UserName) || string.IsNullOrEmpty(request.Password))
            return BadRequest(new { error = "Kullanıcı adı ve şifre gerekli." });

        var result = await _loginOtpService.StartLoginAsync(request.UserName.Trim(), request.Password, cancellationToken);
        if (!result.Success)
            return Unauthorized(new { error = result.Error });

        if (result.RequiresPhoneSetup)
        {
            return Ok(new
            {
                requiresPhoneSetup = true,
                setupChallengeId = result.SetupChallengeId,
                message = "SMS doğrulama için cep telefonunuzu kaydedin."
            });
        }

        return Ok(new
        {
            challengeId = result.ChallengeId,
            maskedPhone = result.MaskedPhone,
            expiresInSeconds = result.ExpiresInSeconds,
            message = "Doğrulama kodu SMS ile gönderildi."
        });
    }

    /// <summary>İlk giriş: cep telefonu kaydet → SMS OTP gönder.</summary>
    [HttpPost("setup-phone")]
    [AllowAnonymous]
    public async Task<IActionResult> SetupPhone([FromBody] SetupPhoneRequest request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.SetupChallengeId) || string.IsNullOrWhiteSpace(request.CepTelefonu))
            return BadRequest(new { error = "Telefon numarası gerekli." });

        var result = await _loginOtpService.RegisterPhoneAndSendOtpAsync(
            request.SetupChallengeId.Trim(), request.CepTelefonu.Trim(), cancellationToken);
        if (!result.Success)
            return Unauthorized(new { error = result.Error });

        return Ok(new
        {
            challengeId = result.ChallengeId,
            maskedPhone = result.MaskedPhone,
            expiresInSeconds = result.ExpiresInSeconds,
            message = "Telefon kaydedildi. Doğrulama kodu SMS ile gönderildi."
        });
    }

    /// <summary>Dış giriş: yeni SMS OTP gönder (cooldown + limit korumalı).</summary>
    [HttpPost("resend-otp")]
    [AllowAnonymous]
    public async Task<IActionResult> ResendOtp([FromBody] ResendOtpRequest request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.ChallengeId))
            return BadRequest(new { error = "Geçersiz oturum." });

        var result = await _loginOtpService.ResendOtpAsync(request.ChallengeId.Trim(), cancellationToken);
        if (!result.Success)
            return Unauthorized(new { error = result.Error });

        return Ok(new
        {
            challengeId = result.ChallengeId,
            maskedPhone = result.MaskedPhone,
            expiresInSeconds = result.ExpiresInSeconds,
            message = "Yeni doğrulama kodu gönderildi."
        });
    }

    /// <summary>Dış giriş adım 2: SMS kodu doğrula → oturum aç.</summary>
    [HttpPost("verify-otp")]
    [AllowAnonymous]
    public async Task<IActionResult> VerifyOtp([FromBody] VerifyOtpRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.ChallengeId) || string.IsNullOrWhiteSpace(request.OtpCode))
            return BadRequest(new { error = "Doğrulama kodu gerekli." });

        var result = await _loginOtpService.VerifyOtpAsync(request.ChallengeId, request.OtpCode);
        if (!result.Success || string.IsNullOrEmpty(result.UserName))
            return Unauthorized(new { error = result.Error });

        await SignInUserAsync(result.UserName, "sms");
        _logger.LogInformation("SMS OTP giriş: {UserName}", result.UserName);

        return Ok(new { success = true, redirectUrl = SafeReturnUrl(request.ReturnUrl) });
    }

    public sealed class LoginRequest
    {
        public string UserName { get; set; } = "";
        public string Password { get; set; } = "";
    }

    public sealed class VerifyOtpRequest
    {
        public string ChallengeId { get; set; } = "";
        public string OtpCode { get; set; } = "";
        public string? ReturnUrl { get; set; }
    }

    public sealed class SetupPhoneRequest
    {
        public string SetupChallengeId { get; set; } = "";
        public string CepTelefonu { get; set; } = "";
    }

    public sealed class ResendOtpRequest
    {
        public string ChallengeId { get; set; } = "";
    }

    [HttpGet("portal-url")]
    [AllowAnonymous]
    public IActionResult PortalUrl() => Ok(new { loginUrl = _portalOptions.PortalLoginUrl });

    [HttpGet("login-options")]
    [AllowAnonymous]
    public IActionResult LoginOptions()
    {
        var portalUrl = string.IsNullOrWhiteSpace(_portalOptions.PortalLoginUrl)
            ? null
            : _portalOptions.PortalLoginUrl.Trim();

        var isLocal = _environment.IsDevelopment() || IsLocalRequest();

        return Ok(new
        {
            portalLoginUrl = portalUrl,
            localAuthEnabled = _localAuthOptions.Enabled,
            isDevelopment = _environment.IsDevelopment(),
            isLocalEnvironment = isLocal
        });
    }

    private bool IsLocalRequest()
    {
        var host = HttpContext.Request.Host.Host;
        if (host.Equals("localhost", StringComparison.OrdinalIgnoreCase) || host == "127.0.0.1")
            return true;

        var remote = HttpContext.Connection.RemoteIpAddress;
        if (remote != null && System.Net.IPAddress.IsLoopback(remote))
            return true;

        return false;
    }

    [HttpGet("dev-login")]
    [AllowAnonymous]
    public async Task<IActionResult> DevLogin([FromQuery] string? userName = null)
    {
        if (!_environment.IsDevelopment())
            return NotFound();

        var name = NormalizeUserName(string.IsNullOrWhiteSpace(userName) ? Environment.UserName : userName);
        await SignInUserAsync(name, "dev");
        return Redirect("/menu.html");
    }

    private string NormalizeUserName(string userName)
    {
        userName = userName.Trim();
        if (userName.Contains('\\'))
            return userName;

        if (!string.IsNullOrWhiteSpace(_portalOptions.UserNameDomain))
            return $"{_portalOptions.UserNameDomain}\\{userName}";

        return userName;
    }

    private async Task SignInUserAsync(string userName, string loginSource = "unknown")
    {
        await _authorizationService.EnsureUserExistsAsync(userName, userName, "", "");

        var resolved = await _authorizationService.GetUserByUserNameAsync(userName);
        var canonicalName = !string.IsNullOrWhiteSpace(resolved.UserName) ? resolved.UserName : userName;

        var claims = new List<Claim>
        {
            new(ClaimTypes.Name, canonicalName),
            new(ClaimTypes.GivenName, resolved.DisplayName ?? canonicalName),
            new("login_source", loginSource)
        };

        var identity = new ClaimsIdentity(claims, CookieAuthenticationDefaults.AuthenticationScheme);
        await HttpContext.SignInAsync(
            CookieAuthenticationDefaults.AuthenticationScheme,
            new ClaimsPrincipal(identity),
            new AuthenticationProperties
            {
                IsPersistent = true,
                ExpiresUtc = DateTimeOffset.UtcNow.AddHours(8)
            });
    }

    private static string SafeReturnUrl(string? returnUrl)
    {
        if (string.IsNullOrWhiteSpace(returnUrl))
            return "/menu.html";
        if (!returnUrl.StartsWith('/') || returnUrl.StartsWith("//"))
            return "/menu.html";
        return returnUrl;
    }
}
