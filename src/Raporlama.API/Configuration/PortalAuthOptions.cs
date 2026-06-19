namespace Raporlama.API.Configuration;

public class PortalAuthOptions
{
    public const string SectionName = "PortalAuth";

    /// <summary>Signed = yerelde imza doğrula (önerilen). Remote = Portal ValidateSsoToken HTTP çağrısı.</summary>
    public string SsoValidationMode { get; set; } = "Signed";

    /// <summary>Doğrudan siteye gelen kullanıcıları yönlendirmek için portal adresi.</summary>
    public string PortalLoginUrl { get; set; } = string.Empty;

    /// <summary>Remote modda kullanılır. Signed modda gerekmez.</summary>
    public string SsoValidationUrl { get; set; } = string.Empty;

    /// <summary>Portal ile paylaşılan gizli anahtar (imza doğrulama + Remote mod header).</summary>
    public string SsoApiKey { get; set; } = string.Empty;

    /// <summary>JWT modu için (opsiyonel).</summary>
    public string Issuer { get; set; } = "BellonaPortal";

    public string Audience { get; set; } = "Raporlama.API";

    /// <summary>userName'de domain yoksa eklenecek prefix (örn. BELLONA → BELLONA\busra.tekel).</summary>
    public string UserNameDomain { get; set; } = "BELLONA";
}
