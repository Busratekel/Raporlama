# Test Adımları

## ✅ Sistem Hazır!

- API çalışıyor: http://localhost:5000
- ETL tamamlandı: 3656 kayıt
- Dashboard hazır: http://localhost:5000/index.html

---

## 🧪 Test Et:

### 1. API Test (Swagger)

**URL:** `http://localhost:5000/swagger`

**Test 1 - Bekleyen Süreçler:**
```
GET /api/dashboard/data/bekleyen-surecler
```
Sonuç: 3656 kayıt gelecek

**Test 2 - Raporlar Listesi:**
```
GET /api/reports
```
Sonuç: 2 rapor göreceksin

---

### 2. Dashboard Test (HTML)

**URL:** `http://localhost:5000/index.html`

veya

**URL:** `http://localhost:5000`

Göreceksin:
- 📊 İstatistikler (3656 süreç, ortalama bekleme, max bekleme)
- 📈 DevExpress DataGrid
- 🔍 Arama kutusu
- 📥 Excel export
- 🎨 Filtreleme, sıralama

---

## 🔧 Sorun Giderme:

### API çalışmıyor:
```bash
cd src/Raporlama.API
dotnet run
```

### Dashboard boş:
- F12 bas (Developer Tools)
- Console sekmesinde hata var mı kontrol et
- API'den veri geliyor mu kontrol et

### CORS hatası:
API'de CORS zaten açık, sorun olmamalı

---

## 📊 Beklenen Sonuç:

Dashboard'da:
- **Toplam:** 3656 bekleyen süreç
- **Ortalama:** ~X gün bekleme
- **Max:** En uzun bekleyen süreç

Tablo:
- Süreç No
- Form Adı
- Formu Bekleten
- Bekleten Bölüm
- Bekleyen Gün (kırmızı/turuncu/yeşil renk kodlu)
- Müdürlük
- Direktörlük

---

## 🚀 Başla!

Tarayıcıda aç: `http://localhost:5000` 🎉

