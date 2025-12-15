# RowFilter Nedir? - Satır Bazlı Yetkilendirme

## 🎯 RowFilter Ne İşe Yarar?

**RowFilter**, kullanıcıların raporlarda **sadece belirli satırları** görmesini sağlar. SQL WHERE koşulu gibi çalışır.

## 📊 Örnek Senaryolar

### Senaryo 1: Müdürlük Bazlı Yetkilendirme

**Durum:** 
- Ahmet → Sadece IT Müdürlüğü verilerini görebilsin
- Ayşe → Sadece Finans Müdürlüğü verilerini görebilsin
- Admin → Tüm verileri görebilsin

**Çözüm:**

```sql
-- Ahmet için RowFilter
INSERT INTO UserReportPermission (UserKey, ReportKey, RowFilter, Aktif)
VALUES (1, 2, 'MudurlukAdi = ''IT''', 1);

-- Ayşe için RowFilter
INSERT INTO UserReportPermission (UserKey, ReportKey, RowFilter, Aktif)
VALUES (2, 2, 'MudurlukAdi = ''Finans''', 1);

-- Admin için RowFilter YOK (tüm verileri görür)
INSERT INTO UserReportPermission (UserKey, ReportKey, RowFilter, Aktif)
VALUES (3, 2, NULL, 1);
```

**Sonuç:**
- Ahmet raporu açtığında: `SELECT * FROM Fact_BekleyenSurecler WHERE MudurlukAdi = 'IT'`
- Ayşe raporu açtığında: `SELECT * FROM Fact_BekleyenSurecler WHERE MudurlukAdi = 'Finans'`
- Admin raporu açtığında: `SELECT * FROM Fact_BekleyenSurecler` (filtre yok)

---

### Senaryo 2: Tarih Aralığı Bazlı Yetkilendirme

**Durum:**
- Kullanıcı sadece son 30 günün verilerini görebilsin

**Çözüm:**

```sql
INSERT INTO UserReportPermission (UserKey, ReportKey, RowFilter, Aktif)
VALUES (1, 2, 'EklenmeTarihi >= DATEADD(day, -30, GETDATE())', 1);
```

**Sonuç:**
- Kullanıcı raporu açtığında: `SELECT * FROM Fact_BekleyenSurecler WHERE EklenmeTarihi >= DATEADD(day, -30, GETDATE())`

---

### Senaryo 3: Çoklu Koşul (AND)

**Durum:**
- Kullanıcı sadece IT Müdürlüğü'nde ve bekleyen günü 30'dan fazla olan kayıtları görebilsin

**Çözüm:**

```sql
INSERT INTO UserReportPermission (UserKey, ReportKey, RowFilter, Aktif)
VALUES (1, 2, 'MudurlukAdi = ''IT'' AND BekleyenGun > 30', 1);
```

**Sonuç:**
- Kullanıcı raporu açtığında: `SELECT * FROM Fact_BekleyenSurecler WHERE MudurlukAdi = 'IT' AND BekleyenGun > 30`

---

### Senaryo 4: Çoklu Değer (IN)

**Durum:**
- Kullanıcı sadece belirli müdürlükleri görebilsin

**Çözüm:**

```sql
INSERT INTO UserReportPermission (UserKey, ReportKey, RowFilter, Aktif)
VALUES (1, 2, 'MudurlukAdi IN (''IT'', ''Finans'', ''İnsan Kaynakları'')', 1);
```

**Sonuç:**
- Kullanıcı raporu açtığında: `SELECT * FROM Fact_BekleyenSurecler WHERE MudurlukAdi IN ('IT', 'Finans', 'İnsan Kaynakları')`

---

### Senaryo 5: Kullanıcı Adına Göre Filtreleme

**Durum:**
- Kullanıcı sadece kendi oluşturduğu kayıtları görebilsin

**Çözüm:**

```sql
-- Önce kullanıcının AD kullanıcı adını al (örn: DOMAIN\ahmet)
INSERT INTO UserReportPermission (UserKey, ReportKey, RowFilter, Aktif)
VALUES (1, 2, 'FormuDolduran = ''DOMAIN\ahmet''', 1);
```

**Not:** Bu durumda dinamik olarak kullanıcı adını RowFilter'a eklemek gerekir. Bunun için kod tarafında değişiklik yapılabilir.

---

## 🔧 Nasıl Çalışır? (Teknik Detay)

### 1. Rapor Sorgusu
```sql
-- Orijinal rapor sorgusu
SELECT * FROM Fact_BekleyenSurecler ORDER BY BekleyenGun DESC
```

### 2. RowFilter Ekleme
```sql
-- RowFilter: MudurlukAdi = 'IT'
-- Sistem otomatik olarak şunu oluşturur:
SELECT * FROM Fact_BekleyenSurecler 
WHERE MudurlukAdi = 'IT' 
ORDER BY BekleyenGun DESC
```

### 3. Kod İçinde Nasıl İşlenir?

```csharp
// DataSourceService.cs içinde
string query = report.Query; // "SELECT * FROM Fact_BekleyenSurecler ORDER BY BekleyenGun DESC"
string rowFilter = "MudurlukAdi = 'IT'"; // Veritabanından alınan RowFilter

if (!string.IsNullOrWhiteSpace(rowFilter))
{
    if (query.Contains("WHERE", StringComparison.OrdinalIgnoreCase))
        query += $" AND {rowFilter}"; // Zaten WHERE varsa AND ekle
    else
        query += $" WHERE {rowFilter}"; // WHERE yoksa ekle
}

// Sonuç: "SELECT * FROM Fact_BekleyenSurecler WHERE MudurlukAdi = 'IT' ORDER BY BekleyenGun DESC"
```

---

## ⚠️ Önemli Notlar

1. **SQL Injection Riski:** RowFilter doğrudan SQL'e eklenir. Güvenlik için:
   - Kullanıcı girişi kabul etmeyin
   - Sadece admin yetkisi olanlar RowFilter yazabilmeli
   - RowFilter'ları validate edin

2. **Kolon İsimleri:** RowFilter'da kullanılan kolon isimleri, rapor sorgusundaki tablo kolonlarıyla eşleşmeli.

3. **NULL Değerler:** RowFilter NULL ise, kullanıcı tüm satırları görür (eğer rapora erişim yetkisi varsa).

4. **Mevcut WHERE Koşulları:** Rapor sorgusunda zaten WHERE varsa, RowFilter AND ile eklenir.

---

## 📝 Pratik Örnekler (Bekleyen Süreçler Raporu İçin)

### Örnek 1: Sadece Acil Durumlar
```sql
RowFilter = 'BekleyenGun > 60'
```

### Örnek 2: Belirli Formlar
```sql
RowFilter = 'FormAdi IN (''İzin Formu'', ''Harcama Formu'')'
```

### Örnek 3: Belirli Şirketler
```sql
RowFilter = 'FormuDolduranSirketi = ''ABC Şirketi'''
```

### Örnek 4: Tarih Aralığı
```sql
RowFilter = 'EklenmeTarihi BETWEEN ''2024-01-01'' AND ''2024-12-31'''
```

### Örnek 5: Karmaşık Koşul
```sql
RowFilter = 'MudurlukAdi = ''IT'' AND BekleyenGun > 30 AND FormAdi <> ''Test Formu'''
```

---

## 🎯 Özet

- **RowFilter = SQL WHERE koşulu**
- **Amacı:** Kullanıcıların sadece belirli satırları görmesi
- **Kullanım:** `UserReportPermission` tablosundaki `RowFilter` kolonuna SQL WHERE koşulu yazılır
- **Örnek:** `MudurlukAdi = 'IT'` → Sadece IT müdürlüğü verileri gösterilir

