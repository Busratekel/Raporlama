using System.DirectoryServices.AccountManagement;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Options;
using Raporlama.API.Configuration;

namespace Raporlama.API.Services;

public interface IAdminService
{
    bool IsAdmin(string? userName);
}

public class AdminService : IAdminService
{
    private static readonly TimeSpan CacheDuration = TimeSpan.FromMinutes(5);

    private readonly AppAuthorizationOptions _options;
    private readonly PortalAuthOptions _portalOptions;
    private readonly IMemoryCache _cache;
    private readonly ILogger<AdminService> _logger;

    public AdminService(
        IOptions<AppAuthorizationOptions> options,
        IOptions<PortalAuthOptions> portalOptions,
        IMemoryCache cache,
        ILogger<AdminService> logger)
    {
        _options = options.Value;
        _portalOptions = portalOptions.Value;
        _cache = cache;
        _logger = logger;
    }

    public bool IsAdmin(string? userName)
    {
        if (string.IsNullOrWhiteSpace(userName) || userName == "Unknown")
            return false;

        var cacheKey = $"admin:{userName.Trim().ToUpperInvariant()}";
        return _cache.GetOrCreate(cacheKey, entry =>
        {
            entry.AbsoluteExpirationRelativeToNow = CacheDuration;
            return IsAdminCore(userName);
        });
    }

    private bool IsAdminCore(string userName)
    {
        if (HasAdGroups() && IsMemberOfAdminGroups(userName))
            return true;

        return IsListedAdminUser(userName);
    }

    private bool HasAdGroups() =>
        _options.AdminAdGroups != null && _options.AdminAdGroups.Any(g => !string.IsNullOrWhiteSpace(g));

    private bool IsListedAdminUser(string userName)
    {
        if (_options.AdminUsers == null || _options.AdminUsers.Count == 0)
            return false;

        var loginName = ExtractAccountName(userName);

        foreach (var admin in _options.AdminUsers)
        {
            if (string.IsNullOrWhiteSpace(admin))
                continue;

            if (string.Equals(admin.Trim(), userName, StringComparison.OrdinalIgnoreCase))
                return true;

            if (string.Equals(ExtractAccountName(admin), loginName, StringComparison.OrdinalIgnoreCase))
                return true;
        }

        return false;
    }

    private bool IsMemberOfAdminGroups(string userName)
    {
        if (!OperatingSystem.IsWindows())
        {
            _logger.LogWarning("AD grup kontrolü yalnızca Windows ortamında çalışır.");
            return false;
        }

        var domain = ResolveDomain();
        if (string.IsNullOrWhiteSpace(domain))
        {
            _logger.LogWarning("AD domain tanımlı değil; AdminAdGroups kontrol edilemedi.");
            return false;
        }

        var samAccountName = ExtractAccountName(userName);

        try
        {
            using var context = new PrincipalContext(ContextType.Domain, domain);
            using var user = UserPrincipal.FindByIdentity(context, IdentityType.SamAccountName, samAccountName);
            if (user == null)
            {
                _logger.LogWarning("AD kullanıcısı bulunamadı: {UserName} (domain: {Domain})", userName, domain);
                return false;
            }

            foreach (var groupSpec in _options.AdminAdGroups!)
            {
                if (string.IsNullOrWhiteSpace(groupSpec))
                    continue;

                var groupSam = ExtractAccountName(groupSpec.Trim());
                using var group = GroupPrincipal.FindByIdentity(context, IdentityType.SamAccountName, groupSam)
                    ?? GroupPrincipal.FindByIdentity(context, IdentityType.Name, groupSam);

                if (group != null && user.IsMemberOf(group))
                {
                    _logger.LogDebug("Admin erişimi AD grubu ile doğrulandı: {UserName} -> {Group}", userName, groupSam);
                    return true;
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "AD grup kontrolü başarısız: {UserName}", userName);
        }

        return false;
    }

    private string ResolveDomain()
    {
        if (!string.IsNullOrWhiteSpace(_options.AdDomain))
            return _options.AdDomain.Trim();

        return _portalOptions.UserNameDomain?.Trim() ?? string.Empty;
    }

    private static string ExtractAccountName(string value)
    {
        var idx = value.IndexOf('\\');
        return idx >= 0 ? value[(idx + 1)..] : value;
    }
}
