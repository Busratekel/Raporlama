using System.DirectoryServices.AccountManagement;
using Microsoft.Extensions.Options;
using Raporlama.API.Configuration;

namespace Raporlama.API.Services;

public interface IActiveDirectoryAuthService
{
    bool ValidateCredentials(string userName, string password);
}

public sealed class ActiveDirectoryAuthService : IActiveDirectoryAuthService
{
    private readonly LocalAuthOptions _options;
    private readonly ILogger<ActiveDirectoryAuthService> _logger;

    public ActiveDirectoryAuthService(IOptions<LocalAuthOptions> options, ILogger<ActiveDirectoryAuthService> logger)
    {
        _options = options.Value;
        _logger = logger;
    }

    public bool ValidateCredentials(string userName, string password)
    {
        if (string.IsNullOrWhiteSpace(userName) || string.IsNullOrEmpty(password))
            return false;

        if (!OperatingSystem.IsWindows())
        {
            _logger.LogWarning("AD doğrulama yalnızca Windows ortamında çalışır.");
            return false;
        }

        var sam = ExtractSamAccountName(userName);
        var domain = _options.AdDomain?.Trim();
        if (string.IsNullOrEmpty(domain))
        {
            _logger.LogWarning("LocalAuth:AdDomain tanımlı değil.");
            return false;
        }

        try
        {
            using var context = new PrincipalContext(ContextType.Domain, domain);
            var ok = context.ValidateCredentials(sam, password);
            _logger.LogInformation("AD doğrulama {Result}: {User}", ok ? "başarılı" : "başarısız", sam);
            return ok;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "AD doğrulama hatası: {User}", sam);
            return false;
        }
    }

    private static string ExtractSamAccountName(string userName)
    {
        var idx = userName.IndexOf('\\');
        return idx >= 0 ? userName[(idx + 1)..] : userName.Trim();
    }
}
