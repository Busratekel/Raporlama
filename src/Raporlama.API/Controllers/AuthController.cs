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
    private readonly PortalAuthOptions _portalOptions;
    private readonly IWebHostEnvironment _environment;
    private readonly ILogger<AuthController> _logger;

    public AuthController(
        ISsoTokenValidator ssoTokenValidator,
        ICustomAuthorizationService authorizationService,
        IOptions<PortalAuthOptions> portalOptions,
        IWebHostEnvironment environment,
        ILogger<AuthController> logger)
    {
        _ssoTokenValidator = ssoTokenValidator;
        _authorizationService = authorizationService;
        _portalOptions = portalOptions.Value;
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
            await SignInUserAsync(normalized);
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
        await HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
        if (!string.IsNullOrWhiteSpace(_portalOptions.PortalLoginUrl))
            return Redirect(_portalOptions.PortalLoginUrl);
        return Redirect("/menu.html");
    }

    [HttpGet("portal-url")]
    [AllowAnonymous]
    public IActionResult PortalUrl() => Ok(new { loginUrl = _portalOptions.PortalLoginUrl });

    [HttpGet("dev-login")]
    [AllowAnonymous]
    public async Task<IActionResult> DevLogin([FromQuery] string? userName = null)
    {
        if (!_environment.IsDevelopment())
            return NotFound();

        var name = NormalizeUserName(string.IsNullOrWhiteSpace(userName) ? Environment.UserName : userName);
        await SignInUserAsync(name);
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

    private async Task SignInUserAsync(string userName)
    {
        await _authorizationService.EnsureUserExistsAsync(userName, userName, "", "");

        var resolved = await _authorizationService.GetUserByUserNameAsync(userName);
        var canonicalName = !string.IsNullOrWhiteSpace(resolved.UserName) ? resolved.UserName : userName;

        var claims = new List<Claim>
        {
            new(ClaimTypes.Name, canonicalName),
            new(ClaimTypes.GivenName, resolved.DisplayName ?? canonicalName)
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
