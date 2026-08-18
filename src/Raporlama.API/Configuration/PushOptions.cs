namespace Raporlama.API.Configuration;

public sealed class PushOptions
{
    public const string SectionName = "Push";

    public bool Enabled { get; set; }

    /// <summary>mailto: veya https:// — VAPID subject</summary>
    public string Subject { get; set; } = "mailto:it@bellona.com.tr";

    public string VapidPublicKey { get; set; } = "";

    public string VapidPrivateKey { get; set; } = "";
}
