namespace Raporlama.API.Configuration;

public class AppAuthorizationOptions
{
    public const string SectionName = "Authorization";

    public List<string> AdminAdGroups { get; set; } = new();

    public string? AdDomain { get; set; }

    /// <summary>Acil durum / geliştirme yedek listesi. AD grubu tanımlıysa ikincil kontrol olarak kullanılır.</summary>
    public List<string> AdminUsers { get; set; } = new();
}
