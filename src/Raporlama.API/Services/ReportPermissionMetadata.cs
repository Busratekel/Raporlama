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

    private static readonly ReportPermissionMeta SatinalmaKabuller = new(
        FilterFields:
        [
            "WERKS", "NAME1", "LIFNR", "EKORG", "ZZSORUMLU",
            "MATNR", "MAKTX", "MATKL", "WGBEZ", "MEINS",
            "EINDT", "BUDAT", "BEDAT", "DELIV", "TESLMAY", "ZZGECGUN", "ZZGEC1", "ZZGEC3", "WAERS"
        ],
        FilterLabels: new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            ["WERKS"] = "Üretim Yeri",
            ["NAME1"] = "Tedarikçi",
            ["LIFNR"] = "Tedarikçi Kodu",
            ["EKORG"] = "Satın Alma Organizasyonu",
            ["ZZSORUMLU"] = "Sorumlu",
            ["MATNR"] = "Malzeme Kodu",
            ["MAKTX"] = "Malzeme Açıklaması",
            ["MATKL"] = "Malzeme Grubu",
            ["WGBEZ"] = "Malzeme Grubu Açıklaması",
            ["MEINS"] = "Ölçü Birimi",
            ["WAERS"] = "Para Birimi",
            ["EINDT"] = "Planlanan Teslim",
            ["BUDAT"] = "Sipariş Tarihi",
            ["BEDAT"] = "Satın Alma Siparişi Tarihi",
            ["DELIV"] = "Teslim Durumu",
            ["TESLMAY"] = "Teslimat Yapıldı mı",
            ["ZZGECGUN"] = "Sapma Günü (ZZGECGUN)",
            ["ZZGEC1"] = "Teslim Durumu 1 gün (ZZGEC1)",
            ["ZZGEC3"] = "Teslim Durumu 3 gün (ZZGEC3)"
        },
        Columns:
        [
            "EBELN", "EBELP", "EKORG", "ZZSORUMLU",
            "MATNR", "MAKTX", "MATKL", "WGBEZ", "LIFNR", "NAME1",
            "MENGE", "MEINS", "NETWR", "WAERS", "BEDAT", "EINDT", "BUDAT",
            "ZZGECGUN", "ZZGEC1", "ZZGEC3", "TESLMAY", "DELIV", "WERKS"
        ],
        ColumnLabels: new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            ["EKORG"] = "Satın Alma Organizasyonu",
            ["ZZSORUMLU"] = "Sorumlu",
            ["MATNR"] = "Malzeme Kodu",
            ["MATKL"] = "Malzeme Grubu",
            ["WGBEZ"] = "Malzeme Grubu Açıklaması",
            ["NAME1"] = "Tedarikçi",
            ["NETWR"] = "Net Tutar",
            ["MENGE"] = "Miktar",
            ["EINDT"] = "Planlanan Teslim",
            ["BUDAT"] = "Gerçekleşen Tarih"
        });

    private static readonly ReportPermissionMeta GorevFormuSeyahat = new(
        FilterFields:
        [
            "Sicil", "İzne Giden Personel", "Ünvan", "Departman", "Üretim Yeri",
            "Seyahat Tipi", "Gidilen Yer", "Seyahat Sebebi",
            "Seyahat Başlangıç Tarihi", "Seyahat Bitiş Tarihi", "Vekalet Edecek Personel"
        ],
        FilterLabels: new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            ["Sicil"] = "Sicil",
            ["İzne Giden Personel"] = "Personel",
            ["Ünvan"] = "Ünvan",
            ["Departman"] = "Departman",
            ["Üretim Yeri"] = "Üretim Yeri",
            ["Seyahat Tipi"] = "Seyahat Tipi",
            ["Gidilen Yer"] = "Gidilen Yer",
            ["Seyahat Sebebi"] = "Seyahat Sebebi",
            ["Seyahat Başlangıç Tarihi"] = "Başlangıç Tarihi",
            ["Seyahat Bitiş Tarihi"] = "Bitiş Tarihi",
            ["Vekalet Edecek Personel"] = "Vekalet Personeli"
        },
        Columns:
        [
            "Sicil", "İzne Giden Personel", "Ünvan", "Departman", "Üretim Yeri",
            "Seyahat Başlangıç Tarihi", "Seyahat Bitiş Tarihi", "Vekalet Edecek Personel",
            "Seyahat Tipi", "Gidilen Yer", "Seyahat Sebebi", "Açıklama"
        ],
        ColumnLabels: new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            ["İzne Giden Personel"] = "Personel",
            ["Seyahat Başlangıç Tarihi"] = "Başlangıç",
            ["Seyahat Bitiş Tarihi"] = "Bitiş",
            ["Vekalet Edecek Personel"] = "Vekalet Personeli",
            ["Seyahat Tipi"] = "Seyahat Tipi",
            ["Gidilen Yer"] = "Gidilen Yer",
            ["Seyahat Sebebi"] = "Seyahat Sebebi"
        },
        DepartmentNameField: "Departman");

    public static ReportPermissionMeta? Resolve(string? reportCode, string? reportName, string? url)
    {
        var haystack = $"{reportCode} {reportName} {url}".ToLowerInvariant();
        if (haystack.Contains("bekleyen")) return Bekleyen;
        if (haystack.Contains("qdms")) return Qdms;
        if (haystack.Contains("satinalma") || haystack.Contains("kabuller")) return SatinalmaKabuller;
        if (haystack.Contains("gorev-formu") || haystack.Contains("seyahat") || haystack.Contains("görev formu"))
            return GorevFormuSeyahat;
        return null;
    }
}
