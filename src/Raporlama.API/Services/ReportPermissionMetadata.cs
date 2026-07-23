namespace Raporlama.API.Services;

public record ReportFilterField(string Field, string Label);

public record ReportPermissionMeta(
    string[] FilterFields,
    Dictionary<string, string> FilterLabels,
    string[] Columns,
    Dictionary<string, string> ColumnLabels,
    string? DepartmentNameField = null);

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
        },
        DepartmentNameField: "MudurlukAdi");

    private static readonly ReportPermissionMeta Qdms = new(
        FilterFields:
        [
            "Durum",
            "Sisteme Girenin Müdürlük/Direktörlüğü",
            "Tip",
            "Sorumlu Birim",
            "Gecikti mi?",
            "Sisteme Giren Kişi",
            "İşi Yapacak"
        ],
        FilterLabels: new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            ["Durum"] = "Durum",
            ["Sisteme Girenin Müdürlük/Direktörlüğü"] = "Müdürlük",
            ["Tip"] = "Tip",
            ["Sorumlu Birim"] = "Sorumlu Birim",
            ["Gecikti mi?"] = "Gecikti mi?",
            ["Sisteme Giren Kişi"] = "Sisteme Giren Kişi",
            ["İşi Yapacak"] = "İşi Yapacak"
        },
        Columns:
        [
            "Ana Aksiyon No", "Kalem No", "Sisteme Giren", "Sisteme Giren Kişi",
            "Sisteme Girenin Müdürlük/Direktörlük Kodu", "Sisteme Girenin Müdürlük/Direktörlüğü",
            "İşi Yapacak", "Sorumlu Birim", "Başlama Tarihi", "Bitiş Tarihi", "Gerçekleştirme Tarihi",
            "Tip", "Tanım", "Durum", "Görevlendirme Sebebi", "Gün Sayısı", "Gecikti mi?"
        ],
        ColumnLabels: new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            ["Ana Aksiyon No"] = "Ana Aksiyon No",
            ["Kalem No"] = "Kalem No",
            ["Durum"] = "Durum",
            ["Gün Sayısı"] = "Gün Sayısı",
            ["Gecikti mi?"] = "Gecikti mi?"
        },
        DepartmentNameField: "Sisteme Girenin Müdürlük/Direktörlüğü");

    public static ReportPermissionMeta? Resolve(string? reportCode, string? reportName, string? url)
    {
        var haystack = $"{reportCode} {reportName} {url}".ToLowerInvariant();
        if (haystack.Contains("bekleyen")) return Bekleyen;
        if (haystack.Contains("qdms")) return Qdms;
        return null;
    }
}
