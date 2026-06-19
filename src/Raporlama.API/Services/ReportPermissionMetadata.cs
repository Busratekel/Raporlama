namespace Raporlama.API.Services;

public record ReportFilterField(string Field, string Label);

public record ReportPermissionMeta(
    string[] FilterFields,
    Dictionary<string, string> FilterLabels,
    string[] Columns,
    Dictionary<string, string> ColumnLabels);

public static class ReportPermissionMetadata
{
    private static readonly ReportPermissionMeta Bekleyen = new(
        FilterFields: ["MudurlukAdi", "DirektorlukAdi", "FormAdi", "FormuDolduranSirketi", "FormuBekletenSirketi", "FormuGonderenBolum"],
        FilterLabels: new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            ["MudurlukAdi"] = "Müdürlük",
            ["DirektorlukAdi"] = "Direktörlük",
            ["FormAdi"] = "Form Adı",
            ["FormuDolduranSirketi"] = "Dolduran Şirket",
            ["FormuBekletenSirketi"] = "Bekleten Şirket",
            ["FormuGonderenBolum"] = "Dolduran Bölüm"
        },
        Columns:
        [
            "SurecNo", "FormAdi", "FormuDolduran", "FormuBekleten", "FormuGonderenBolum",
            "FormuBekletenBolum", "MudurlukAdi", "SurecBaslangicTarihi", "SurecBekleteneGelisTarihi", "BekleyenGun"
        ],
        ColumnLabels: new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            ["SurecNo"] = "Süreç No",
            ["FormAdi"] = "Form Adı",
            ["FormuDolduran"] = "Formu Dolduran",
            ["FormuBekleten"] = "Formu Bekleten",
            ["BekleyenGun"] = "Bekleyen Gün"
        });

    private static readonly ReportPermissionMeta Qdms = new(
        FilterFields: ["Durum", "MudurlukAdi", "Tip", "BekletenSirket", "GeciktiMi", "BekletenAdSoyad", "SorumluAdSoyad"],
        FilterLabels: new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            ["Durum"] = "Durum",
            ["MudurlukAdi"] = "Müdürlük",
            ["Tip"] = "Tip",
            ["BekletenSirket"] = "Şirket",
            ["GeciktiMi"] = "Gecikti mi?",
            ["BekletenAdSoyad"] = "Bekleten Kişi",
            ["SorumluAdSoyad"] = "Yönetici"
        },
        Columns:
        [
            "SurecNo", "Durum", "Tip", "MudurlukAdi", "BekletenSirket", "BekletenAdSoyad",
            "SorumluAdSoyad", "BaslamaTarihi", "BitisTarihi", "BeklemeGun", "GeciktiMi"
        ],
        ColumnLabels: new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            ["SurecNo"] = "Süreç No",
            ["Durum"] = "Durum",
            ["BeklemeGun"] = "Bekleme Gün",
            ["GeciktiMi"] = "Gecikti mi?"
        });

    public static ReportPermissionMeta? Resolve(string? reportCode, string? reportName, string? url)
    {
        var haystack = $"{reportCode} {reportName} {url}".ToLowerInvariant();
        if (haystack.Contains("bekleyen")) return Bekleyen;
        if (haystack.Contains("qdms")) return Qdms;
        return null;
    }
}
