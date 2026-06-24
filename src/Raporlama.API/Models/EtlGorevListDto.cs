namespace Raporlama.API.Models;

public class EtlGorevListDto
{
    public int GorevId { get; set; }
    public string GorevAdi { get; set; } = string.Empty;
    public string SorguMetni { get; set; } = string.Empty;
    public string HedefTablo { get; set; } = string.Empty;
    public string? Schedule { get; set; }
    public bool Aktif { get; set; }
    public DateTime OlusturmaTarihi { get; set; }
    public DateTime? SonBasariliCalisma { get; set; }
    public string? SonBasariliCalismaMetin { get; set; }

    public static EtlGorevListDto From(ETLGorev g) => new()
    {
        GorevId = g.GorevId,
        GorevAdi = g.GorevAdi,
        SorguMetni = g.SorguMetni,
        HedefTablo = g.HedefTablo,
        Schedule = g.Schedule,
        Aktif = g.Aktif,
        OlusturmaTarihi = g.OlusturmaTarihi,
        SonBasariliCalisma = g.SonBasariliCalisma,
        SonBasariliCalismaMetin = g.SonBasariliCalisma?.ToString("dd.MM.yyyy HH:mm:ss")
    };
}
