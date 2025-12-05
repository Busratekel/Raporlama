1) # Mimari Karar Dokümanı

## ✅ Alınan Kararlar

### 1. ETL Yaklaşımı
**Seçim: .NET Core ETL Worker Service**
- SSIS yerine .NET Core kullanılacak
- Daha esnek ve özelleştirilebilir
- Cross-platform
- Modern yaklaşım

### 2. Veri Güncelleme Stratejisi
**Seçim: Önceden Hazırlanmış Veri Ambarı (Pre-aggregated)**
- JOIN'ler ETL sırasında yapılacak
- Fact tabloları zaten join'lenmiş verileri içerecek
- Raporlama sırasında sadece SELECT yapılacak
- Performans optimizasyonu için kritik

### 3. Veri Ambarı Tasarımı
**Seçim: Yıldız Şema (Star Schema)**
- Dimension tabloları (boyutlar)
- Fact tabloları (ölçümler - önceden join'lenmiş)
- Raporlama sırasında sadece Fact tablolarından okuma

### 4. Performans Stratejisi
- **ETL Zamanında:** JOIN'ler yapılır, hesaplamalar yapılır
- **Raporlama Zamanında:** Sadece Fact tablolarından SELECT
- **Cache:** Sık kullanılan raporlar için Redis (opsiyonel)

---

## 🏗️ Mimari Akış

```
[Kaynak DB'ler] 
    ↓
[ETL Service - JOIN yapılır, hesaplamalar yapılır]
    ↓
[Veri Ambarı - Fact Tabloları (hazır veriler)]
    ↓
[API - Sadece SELECT, JOIN YOK]
    ↓
[DevExpress Dashboard]
```

---

## 📊 Veri Akışı Detayı

### ETL Süreci (Arka Planda Çalışır)
```sql
-- ETL sırasında yapılan işlemler:
SELECT 
    s.SatisID,
    s.Tutar,
    s.Miktar,
    m.MusteriAdi,
    m.BolgeKodu,
    u.UrunAdi,
    u.Kategori,
    d.Tarih,
    d.Ay,
    d.Yil,
    -- Hesaplanmış alanlar
    s.Tutar * 1.18 as TutarKDVli,
    s.Tutar - s.Maliyet as Kar
FROM KaynakDB1.Satislar s
JOIN KaynakDB2.Musteriler m ON s.MusteriID = m.MusteriID
JOIN KaynakDB1.Urunler u ON s.UrunID = u.UrunID
JOIN Dim_Tarih d ON s.Tarih = d.Tarih
-- ... diğer JOIN'ler
INTO DW.dbo.Fact_Satislar  -- Hazır tabloya yazılır
```

### Raporlama Süreci (Kullanıcı İsteği)
```sql
-- Raporlama sırasında sadece bu:
SELECT 
    BolgeKodu,
    Kategori,
    SUM(TutarKDVli) as ToplamSatis,
    SUM(Kar) as ToplamKar
FROM DW.dbo.Fact_Satislar  -- Zaten join'lenmiş, hazır veri
WHERE Tarih BETWEEN @Baslangic AND @Bitis
GROUP BY BolgeKodu, Kategori
-- JOIN YOK! Çok hızlı!
```

---

## 🎯 Performans Kazanımları

1. **JOIN'ler ETL'de:** Sadece bir kez yapılır (günlük/saatlik)
2. **Raporlama:** Sadece SELECT, çok hızlı
3. **Index'ler:** Fact tablolarda optimize edilmiş index'ler
4. **Partitioning:** Büyük tablolar tarih bazlı partition

---

## 📁 Proje Yapısı

```
Raporlama/
├── src/
│   ├── Raporlama.API/              # ASP.NET Core Web API
│   ├── Raporlama.ETL/              # .NET Core Worker Service
│   ├── Raporlama.Data/             # Entity Framework / Dapper
│   ├── Raporlama.Models/           # Domain modelleri
│   └── Raporlama.Services/         # Business logic
├── database/
│   ├── scripts/
│   │   ├── 01_CreateDW.sql         # Veri ambarı şeması
│   │   ├── 02_Dimensions.sql       # Dimension tabloları
│   │   └── 03_Facts.sql            # Fact tabloları
│   └── migrations/                 # EF Core migrations
└── docs/
    └── MIMARI_ANALIZ.md
```
2) ---MİMARİ ANALİZ....----

# Raporlama Sistemi - Mimari Analiz ve Karar Dokümanı

## 📋 Proje Özeti

**Hedef:** Qlik Sense benzeri yüksek performanslı, self-service raporlama sistemi
**Teknoloji Stack:**
- Backend: .NET Core / ASP.NET Core
- UI: DevExpress Dashboard & Reporting
- Veritabanı: SQL Server
- ETL: SQL Server Integration Services (SSIS)
- Veri Ambarı: SQL Server (Yıldız Şema)

---

## 🎯 Gemini Analizinin Değerlendirmesi

### ✅ Güçlü Yönler

1. **Klasik BI/DW Metodolojisi:** Endüstri standardı yaklaşım, kanıtlanmış
2. **Yıldız Şema Tasarımı:** Raporlama için optimize edilmiş veri modeli
3. **SSIS ile ETL:** Microsoft ekosisteminde güçlü ve olgun çözüm
4. **Adım adım planlama:** Proje yönetimi açısından sağlam

### ⚠️ Dikkat Edilmesi Gerekenler

1. **SSIS Bağımlılığı:** 
   - SSIS sadece SQL Server Enterprise/Standard'da var
   - Alternatif: .NET Core ile custom ETL pipeline (daha esnek, cross-platform)

2. **Gerçek Zamanlı Veri İhtiyacı:**
   - SSIS genelde batch processing için
   - Gerçek zamanlı veri gerekiyorsa: Change Data Capture (CDC) veya streaming

3. **DevExpress Lisansı:**
   - Ticari lisans gerekiyor
   - Alternatif: Açık kaynak alternatifler (ama DevExpress daha güçlü)

4. **Yetkilendirme Karmaşıklığı:**
   - RLS (Row Level Security) + CLS (Column Level Security) birlikte
   - Performans etkisi olabilir

---

## 🏗️ Önerilen Mimari Yaklaşım

### Seçenek 1: Klasik BI/DW Yaklaşımı (Gemini'nin Önerisi)
```
[Kaynak DB'ler] → [SSIS ETL] → [Veri Ambarı (DW)] → [.NET Core API] → [DevExpress Dashboard]
```

**Artıları:**
- ✅ Endüstri standardı
- ✅ SSIS güçlü ETL aracı
- ✅ Veri ambarı ile raporlama ayrı (performans)
- ✅ Batch processing için ideal

**Eksileri:**
- ❌ SSIS sadece Windows + SQL Server
- ❌ Veri gecikmesi (sabah 8'de güncelleniyor)
- ❌ Daha karmaşık altyapı

### Seçenek 2: Modern Hybrid Yaklaşım (Önerilen)
```
[Kaynak DB'ler] → [.NET Core ETL Service] → [Veri Ambarı (DW)] → [.NET Core API] → [DevExpress Dashboard]
                    ↓
              [Real-time Stream] (isteğe bağlı)
```

**Artıları:**
- ✅ Cross-platform (.NET Core)
- ✅ Daha esnek ve özelleştirilebilir
- ✅ Real-time veri desteği eklenebilir
- ✅ Microservice mimarisine uygun
- ✅ SSIS'e bağımlı değil

**Eksileri:**
- ⚠️ SSIS kadar olgun değil (ama yeterli)
- ⚠️ Daha fazla kod yazılması gerekir

---

## 📐 Detaylı Mimari Bileşenler

### 1. Veri Katmanı (Data Layer)

#### 1.1 Veri Ambarı Tasarımı
```
DW Database (SQL Server)
├── Dimension Tables (Boyut Tabloları)
│   ├── Dim_Tarih
│   ├── Dim_Musteri
│   ├── Dim_Urun
│   ├── Dim_Departman
│   └── Dim_Bolge
│
├── Fact Tables (Olay Tabloları)
│   ├── Fact_Satislar
│   ├── Fact_Stok
│   └── Fact_MusteriEtkilesimleri
│
└── Security Tables (Güvenlik Tabloları)
    ├── Users
    ├── Roles
    ├── UserRoles
    ├── RolePermissions
    └── UserDataAccess (RLS için)
```

#### 1.2 Kaynak Veritabanları
- ERP Database (Satış, Stok)
- CRM Database (Müşteri bilgileri)
- Finans Database (Mali veriler)
- (Diğer operasyonel sistemler)

### 2. ETL Katmanı

#### Seçenek A: SSIS (Gemini Önerisi)
- Visual Studio SSIS Project
- SQL Server Agent ile zamanlama
- Batch processing (günlük, saatlik)

#### Seçenek B: .NET Core ETL Service (Önerilen)
- Background Service (.NET Core Worker Service)
- Quartz.NET veya Hangfire ile zamanlama
- Daha esnek ve özelleştirilebilir
- Docker container olarak çalışabilir

### 3. API Katmanı (.NET Core)

```
ASP.NET Core Web API
├── Controllers
│   ├── ReportsController
│   ├── DashboardController
│   ├── DataSourceController
│   └── AuthController
│
├── Services
│   ├── ReportService
│   ├── DataService
│   ├── PermissionService
│   └── ETLService
│
├── Middleware
│   ├── AuthenticationMiddleware
│   ├── AuthorizationMiddleware
│   └── RowLevelSecurityMiddleware
│
└── Models
    ├── ReportDefinition
    ├── DataSource
    └── UserPermission
```

### 4. Güvenlik Katmanı

#### 4.1 Kimlik Doğrulama (Authentication)
- JWT Token tabanlı
- ASP.NET Core Identity (opsiyonel)

#### 4.2 Yetkilendirme (Authorization)
- **RLS (Row Level Security):** Kullanıcı sadece yetkili olduğu satırları görür
  - Örnek: Satış müdürü sadece kendi bölgesinin satışlarını görür
  
- **CLS (Column Level Security):** Kullanıcı sadece yetkili olduğu sütunları görür
  - Örnek: Finans müdürü "Maliyet" sütununu görebilir, satış müdürü göremez

#### 4.3 Yetki Matrisi Örneği
| Rol | Departman Filtresi | Görülebilir Alanlar | Düzenlenebilir Alanlar |
|-----|-------------------|-------------------|----------------------|
| Admin | Tümü | Tümü | Tümü |
| Finans Müdürü | Tümü | Satış, Maliyet, Kar | Maliyet, Kar |
| Satış Müdürü | Kendi Bölgesi | Satış, Müşteri | Satış |
| Bölge Yöneticisi | Kendi Bölgesi | Satış, Müşteri | - |

### 5. Frontend Katmanı (DevExpress)

#### 5.1 Dashboard Designer
- Kullanıcıların kendi raporlarını tasarlaması
- Drag & drop ile alan ekleme/çıkarma
- Grafik tipi seçimi (Bar, Pie, Line, vb.)

#### 5.2 Rapor Şablonları
- Önceden tanımlı rapor şablonları
- Kullanıcılar şablonları özelleştirebilir
- JSON/XML formatında saklama

#### 5.3 Self-Service Özellikleri
- Filtreleme
- Sıralama
- Gruplama
- Hesaplanmış alanlar

---

## 🔄 Veri Akış Senaryoları

### Senaryo 1: Batch ETL (Günlük Güncelleme)
```
1. SQL Server Agent / Quartz.NET tetikler
2. ETL Service başlar
3. Kaynak DB'lerden veri çekilir
4. Transform işlemleri (Join, Hesaplama, Temizleme)
5. DW'ye yazılır
6. Cache temizlenir (opsiyonel)
```

### Senaryo 2: Real-time Veri (İsteğe Bağlı)
```
1. Kaynak DB'de değişiklik olur (CDC veya Trigger)
2. Event/Message Queue'ya gönderilir
3. ETL Service anlık işler
4. DW güncellenir
5. WebSocket ile frontend'e bildirim
```

### Senaryo 3: Rapor İsteği
```
1. Kullanıcı DevExpress Dashboard'da rapor açar
2. Frontend → API'ye istek gönderir
3. API → PermissionService (yetki kontrolü)
4. API → DataService (RLS/CLS filtreleri uygulanır)
5. SQL sorgusu çalıştırılır
6. Sonuç JSON olarak döner
7. DevExpress görselleştirir
```

---

## 🛠️ Teknoloji Stack Detayları

### Backend
- **.NET 8** (veya .NET 7)
- **ASP.NET Core Web API**
- **Entity Framework Core** (veya Dapper - performans için)
- **Quartz.NET** (zamanlama için)
- **Serilog** (logging)

### Veritabanı
- **SQL Server** (Veri Ambarı)
- **SQL Server** (Kaynak DB'ler - örnek)

### Frontend
- **DevExpress Dashboard**
- **DevExpress Reporting**
- **ASP.NET Core MVC** (veya Blazor Server)

### ETL
- **Seçenek 1:** SSIS (Visual Studio)
- **Seçenek 2:** .NET Core Worker Service + Dapper

### Güvenlik
- **JWT Bearer Authentication**
- **ASP.NET Core Authorization Policies**
- **Custom RLS/CLS Middleware**

---

## 📊 Performans Optimizasyonları

1. **Indexing:** DW'deki Fact ve Dimension tablolarda uygun indexler
2. **Partitioning:** Büyük Fact tabloları tarih bazlı partition
3. **Materialized Views:** Sık kullanılan aggregasyonlar için
4. **Caching:** Redis ile API response cache
5. **Query Optimization:** Stored procedure'ler, parametreli sorgular

---

## 🚀 Geliştirme Aşamaları (Önerilen Sıralama)

### Faz 1: Temel Altyapı (2-3 hafta)
1. .NET Core proje yapısı
2. Veritabanı bağlantıları
3. Temel authentication/authorization
4. DevExpress entegrasyonu

### Faz 2: Veri Modeli (2-3 hafta)
1. DW şema tasarımı (Yıldız Şema)
2. Dimension tabloları oluşturma
3. Fact tabloları oluşturma
4. Security tabloları

### Faz 3: ETL Geliştirme (3-4 hafta)
1. ETL Service geliştirme
2. Kaynak DB'lerden veri çekme
3. Transform işlemleri
4. DW'ye yazma
5. Hata yönetimi ve logging

### Faz 4: API ve Güvenlik (2-3 hafta)
1. Report API endpoints
2. RLS implementasyonu
3. CLS implementasyonu
4. Permission service

### Faz 5: Frontend ve Dashboard (3-4 hafta)
1. DevExpress Dashboard entegrasyonu
2. Rapor şablonları
3. Self-service özellikleri
4. Kullanıcı ayarları kaydetme

### Faz 6: Test ve Optimizasyon (2 hafta)
1. Performans testleri
2. Güvenlik testleri
3. Kullanıcı kabul testleri
4. Optimizasyon

---

## ❓ Karar Verilmesi Gereken Noktalar

1. **ETL Yaklaşımı:**
   - [ ] SSIS mi kullanacağız?
   - [ ] .NET Core ETL Service mi?
   - [ ] Hybrid (ikisi de)?

2. **Veri Güncelleme Sıklığı:**
   - [ ] Günlük batch (sabah 8:00)?
   - [ ] Saatlik?
   - [ ] Real-time?

3. **Frontend Teknolojisi:**
   - [ ] ASP.NET Core MVC?
   - [ ] Blazor Server?
   - [ ] SPA (React/Vue) + API?

4. **Lisans:**
   - [ ] DevExpress lisansı mevcut mu?
   - [ ] Alternatif düşünüyor muyuz?

5. **Altyapı:**
   - [ ] On-premise?
   - [ ] Cloud (Azure)?
   - [ ] Hybrid?

---

## 💡 Öneriler

1. **ETL için .NET Core Worker Service öneriyorum:**
   - Daha esnek
   - Cross-platform
   - Modern yaklaşım
   - SSIS'e göre daha kolay özelleştirilebilir

2. **Başlangıç için batch processing:**
   - Real-time daha sonra eklenebilir
   - Daha basit ve güvenilir

3. **Modüler mimari:**
   - Her katman bağımsız geliştirilebilir
   - Test edilebilir
   - Ölçeklenebilir

4. **Incremental Load:**
   - İlk yükleme full load
   - Sonrakiler sadece değişen veriler

---

## 📝 Sonraki Adımlar

1. Bu dokümanı gözden geçir
2. Karar verilmesi gereken noktaları belirle
3. Teknoloji seçimlerini onayla
4. Proje yapısını oluştur
5. İlk fazı başlat

3) --JOİN_ACIKLAMASI----

# JOIN Nedir ve Neden Fact Tablolarında JOIN Yok?

## 🔍 JOIN Nedir?

JOIN, SQL'de **iki veya daha fazla tabloyu birleştirmek** için kullanılan bir işlemdir.

### Örnek Senaryo

Diyelim ki elimizde şu tablolar var:

**Satışlar Tablosu:**
```
SatisID | MusteriID | UrunID | Tutar
--------|-----------|--------|-------
1       | 101       | 501    | 1000
2       | 102       | 502    | 2000
```

**Müşteriler Tablosu:**
```
MusteriID | MusteriAdi    | BolgeKodu
----------|---------------|-----------
101       | Ahmet Yılmaz  | IST
102       | Ayşe Demir    | ANK
```

**Ürünler Tablosu:**
```
UrunID | UrunAdi    | Kategori
-------|------------|----------
501    | Laptop     | Elektronik
502    | Telefon    | Elektronik
```

### JOIN İle Birleştirme (Yavaş Yöntem)

Eğer raporlama sırasında JOIN yaparsak:

```sql
-- Her rapor isteğinde bu JOIN'ler yapılır (YAVAŞ!)
SELECT 
    s.SatisID,
    s.Tutar,
    m.MusteriAdi,      -- Müşteriler tablosundan
    m.BolgeKodu,       -- Müşteriler tablosundan
    u.UrunAdi,         -- Ürünler tablosundan
    u.Kategori         -- Ürünler tablosundan
FROM Satislar s
JOIN Musteriler m ON s.MusteriID = m.MusteriID  -- JOIN 1
JOIN Urunler u ON s.UrunID = u.UrunID           -- JOIN 2
WHERE s.Tarih BETWEEN '2024-01-01' AND '2024-01-31'
```

**Sorun:**
- Her rapor isteğinde 3 tablo birleştiriliyor
- 1 milyon satış kaydı varsa → 1 milyon JOIN işlemi
- Çok yavaş! ⏱️

---

## ✅ Çözüm: Fact Tablosu (JOIN Yok - Hızlı!)

### ETL Zamanında JOIN Yapılır (Bir Kez)

ETL Service arka planda çalışırken (örneğin gece 2'de):

```sql
-- ETL sırasında JOIN'ler yapılır ve hazır tabloya yazılır
SELECT 
    s.SatisID,
    s.Tutar,
    m.MusteriAdi,      -- JOIN ile alındı
    m.BolgeKodu,       -- JOIN ile alındı
    u.UrunAdi,         -- JOIN ile alındı
    u.Kategori         -- JOIN ile alındı
INTO Fact_Satislar    -- Hazır tabloya yazıldı
FROM KaynakDB1.Satislar s
JOIN KaynakDB2.Musteriler m ON s.MusteriID = m.MusteriID
JOIN KaynakDB1.Urunler u ON s.UrunID = u.UrunID
```

**Sonuç - Fact_Satislar Tablosu:**
```
SatisID | Tutar | MusteriAdi    | BolgeKodu | UrunAdi | Kategori
--------|-------|---------------|-----------|---------|----------
1       | 1000  | Ahmet Yılmaz  | IST       | Laptop  | Elektronik
2       | 2000  | Ayşe Demir    | ANK       | Telefon | Elektronik
```

**Artık her şey tek tabloda!** ✅

### Raporlama Zamanında JOIN Yok (Hızlı!)

Kullanıcı rapor istediğinde:

```sql
-- Sadece tek tablodan SELECT (JOIN YOK!)
SELECT 
    BolgeKodu,
    Kategori,
    SUM(Tutar) as ToplamSatis
FROM Fact_Satislar  -- Tek tablo, JOIN yok!
WHERE Tarih BETWEEN '2024-01-01' AND '2024-01-31'
GROUP BY BolgeKodu, Kategori
```

**Avantajlar:**
- ✅ Sadece tek tablo okunuyor
- ✅ JOIN işlemi yok
- ✅ Çok hızlı! ⚡
- ✅ 1 milyon kayıt bile olsa hızlı

---

## 📊 Karşılaştırma

### Senaryo: 1 Milyon Satış Kaydı, 3 Tablo JOIN

| Yöntem | JOIN Sayısı | İşlem Süresi | Açıklama |
|--------|-------------|--------------|----------|
| **Her Rapor İsteğinde JOIN** | 1 milyon × 2 JOIN = 2 milyon JOIN | ~30-60 saniye | Her kullanıcı isteğinde |
| **Fact Tablosu (JOIN Yok)** | 0 JOIN | ~1-2 saniye | Sadece SELECT |

**Performans Farkı: 15-30 kat daha hızlı!** 🚀

---

## 🎯 Özet

### JOIN Var (Yavaş) ❌
```
Kullanıcı rapor ister
    ↓
API: "Satışlar tablosunu oku"
    ↓
API: "Müşteriler tablosunu oku ve JOIN yap"
    ↓
API: "Ürünler tablosunu oku ve JOIN yap"
    ↓
Sonuç döner (YAVAŞ - 30-60 saniye)
```

### JOIN Yok (Hızlı) ✅
```
ETL Service (gece 2'de):
    ↓
Tüm JOIN'leri yap
    ↓
Fact_Satislar tablosuna yaz
    ↓
---
Kullanıcı rapor ister
    ↓
API: "Fact_Satislar tablosundan oku" (JOIN yok!)
    ↓
Sonuç döner (HIZLI - 1-2 saniye)
```

---

## 💡 Basit Benzetme

**JOIN Var:** 
- Her seferinde markete gidip malzemeleri alıp yemek yapmak
- Her yemek için tekrar markete gitmek gerekir

**JOIN Yok (Fact Tablosu):**
- Malzemeleri önceden alıp hazırlamak (ETL)
- Buzdolabında hazır tutmak (Fact tablosu)
- Yemek yapmak istediğinde sadece buzdolabından almak

---

## 🔄 Gerçek Hayat Örneği

### Senaryo: Aylık Satış Raporu

**JOIN Var Yaklaşımı:**
```sql
-- Her kullanıcı bu raporu açtığında:
SELECT 
    m.BolgeKodu,
    u.Kategori,
    SUM(s.Tutar) as Toplam
FROM Satislar s
JOIN Musteriler m ON s.MusteriID = m.MusteriID  -- 1 milyon JOIN
JOIN Urunler u ON s.UrunID = u.UrunID            -- 1 milyon JOIN
WHERE s.Tarih BETWEEN @Baslangic AND @Bitis
GROUP BY m.BolgeKodu, u.Kategori

-- Süre: 30-60 saniye ⏱️
-- 10 kullanıcı aynı anda açarsa: 10 × 30 saniye = 5 dakika!
```

**JOIN Yok Yaklaşımı:**
```sql
-- ETL gece 2'de çalıştı, Fact_Satislar hazır

-- Kullanıcı rapor açtığında:
SELECT 
    BolgeKodu,
    Kategori,
    SUM(Tutar) as Toplam
FROM Fact_Satislar  -- JOIN yok!
WHERE Tarih BETWEEN @Baslangic AND @Bitis
GROUP BY BolgeKodu, Kategori

-- Süre: 1-2 saniye ⚡
-- 10 kullanıcı aynı anda açarsa: Hepsi 1-2 saniyede!
```

---

## ✅ Sonuç

**JOIN = Tabloları birleştirme işlemi**

**JOIN Yok (Fact Tablosunda) =**
- JOIN'ler önceden yapılmış
- Tüm veriler tek tabloda hazır
- Sadece SELECT yapılıyor
- Çok daha hızlı!

Bu yüzden patronunuz haklı: **"Önceden yapılsın, hazır tabloya yazılsın, rapor istediğimde JOIN yapmasın!"** 🎯

4) ---VERİ_KAYNAGI_STRATEJISI---

# Veri Kaynağı Stratejisi - Batch vs Real-Time

## 🎯 Problem

- **Batch Raporlar:** Önceden hazırlanmış Fact tablolarından (JOIN yok, hızlı)
- **Real-Time Raporlar:** Anlık değişen veriler (Stok, Canlı İşlemler, vb.)
- **Sorun:** İkisini nasıl ayırt edeceğiz ve yöneteceğiz?

---

## ✅ Çözüm: Hybrid Veri Kaynağı Yaklaşımı

### 1. Veri Kaynağı Tipleri

Her rapor için **veri kaynağı tipi** belirlenecek:

```csharp
public enum DataSourceType
{
    Batch = 1,        // Önceden hazırlanmış Fact tablosu
    RealTime = 2,     // Anlık kaynak DB'den çekilecek
    Hybrid = 3        // Hem batch hem real-time (karma)
}
```

### 2. Rapor Tanımında Veri Kaynağı Belirtme

```sql
-- Raporlar tablosu
CREATE TABLE Reports (
    ReportID INT PRIMARY KEY,
    ReportName NVARCHAR(255),
    DataSourceType INT,  -- 1=Batch, 2=RealTime, 3=Hybrid
    BatchTableName NVARCHAR(255),  -- Batch ise Fact tablo adı
    RealTimeQuery NVARCHAR(MAX),   -- RealTime ise sorgu
    CacheDuration INT,             -- RealTime için cache süresi (dakika)
    LastUpdated DATETIME
)
```

---

## 📊 Senaryolar ve Çözümler

### Senaryo 1: Batch Raporlar (Satış Raporları, Finansal Raporlar)

**Özellikler:**
- Veri sık değişmez
- Tarihsel veriler
- JOIN'ler ETL'de yapılmış

**Çözüm:**
```sql
-- Rapor tanımı
INSERT INTO Reports VALUES (
    1, 
    'Aylık Satış Raporu',
    1,  -- Batch
    'Fact_Satislar',  -- Fact tablo adı
    NULL,  -- Real-time sorgu yok
    0,     -- Cache yok (zaten hazır)
    GETDATE()
)

-- API'de kullanım
SELECT * FROM Fact_Satislar WHERE ... -- JOIN YOK!
```

### Senaryo 2: Real-Time Raporlar (Stok Durumu, Canlı İşlemler)

**Özellikler:**
- Sürekli değişir
- Anlık bilgi gerekiyor
- JOIN gerekebilir ama optimize edilmiş

**Çözüm 1: Optimize Edilmiş View/Stored Procedure**
```sql
-- Stok için optimize edilmiş view
CREATE VIEW vw_StokDurumu AS
SELECT 
    s.StokID,
    u.UrunAdi,
    s.Miktar,
    s.DepoID,
    d.DepoAdi,
    s.SonGuncelleme
FROM StokDB.dbo.Stok s
INNER JOIN StokDB.dbo.Urunler u ON s.UrunID = u.UrunID
INNER JOIN StokDB.dbo.Depolar d ON s.DepoID = d.DepoID
-- Index'ler optimize edilmiş, hızlı JOIN
```

**Çözüm 2: Kısa Süreli Cache**
```csharp
// Real-time veriler için Redis cache (5 dakika)
// İlk istekte DB'den çek, cache'e yaz
// Sonraki isteklerde cache'den oku
```

**Rapor tanımı:**
```sql
INSERT INTO Reports VALUES (
    2,
    'Anlık Stok Durumu',
    2,  -- RealTime
    NULL,  -- Batch tablo yok
    'SELECT * FROM vw_StokDurumu',  -- Real-time sorgu
    5,  -- 5 dakika cache
    GETDATE()
)
```

### Senaryo 3: Hybrid Raporlar (Stok + Satış Geçmişi)

**Özellikler:**
- Hem anlık veri (stok)
- Hem tarihsel veri (satış geçmişi)

**Çözüm:**
```sql
-- Rapor tanımı
INSERT INTO Reports VALUES (
    3,
    'Ürün Detay Raporu',
    3,  -- Hybrid
    'Fact_UrunSatislari',  -- Batch kısmı
    'SELECT * FROM vw_StokDurumu WHERE UrunID = @UrunID',  -- Real-time kısmı
    5,
    GETDATE()
)

-- API'de birleştirme
-- Batch kısmı: Fact tablosundan
-- Real-time kısmı: View'den
-- Sonuçları birleştir
```

---

## 🏗️ Mimari Çözüm

### 1. Veri Kaynağı Servisi

```csharp
public interface IDataSourceService
{
    Task<DataTable> GetReportDataAsync(int reportId, Dictionary<string, object> parameters);
}

public class DataSourceService : IDataSourceService
{
    public async Task<DataTable> GetReportDataAsync(int reportId, Dictionary<string, object> parameters)
    {
        var report = await _reportRepository.GetByIdAsync(reportId);
        
        switch (report.DataSourceType)
        {
            case DataSourceType.Batch:
                return await GetBatchDataAsync(report, parameters);
                
            case DataSourceType.RealTime:
                return await GetRealTimeDataAsync(report, parameters);
                
            case DataSourceType.Hybrid:
                return await GetHybridDataAsync(report, parameters);
        }
    }
    
    private async Task<DataTable> GetBatchDataAsync(Report report, Dictionary<string, object> parameters)
    {
        // Fact tablosundan direkt SELECT
        // JOIN YOK!
        var query = $"SELECT * FROM DW.dbo.{report.BatchTableName} WHERE ...";
        return await _dwDb.QueryAsync(query, parameters);
    }
    
    private async Task<DataTable> GetRealTimeDataAsync(Report report, Dictionary<string, object> parameters)
    {
        // Cache kontrolü
        var cacheKey = $"report_{report.ReportID}_{string.Join("_", parameters)}";
        var cached = await _cache.GetAsync<DataTable>(cacheKey);
        
        if (cached != null)
            return cached;
        
        // Cache yoksa DB'den çek
        var data = await _sourceDb.QueryAsync(report.RealTimeQuery, parameters);
        
        // Cache'e yaz (belirtilen süre kadar)
        await _cache.SetAsync(cacheKey, data, TimeSpan.FromMinutes(report.CacheDuration));
        
        return data;
    }
}
```

### 2. Rapor Yapılandırma Tablosu

```sql
CREATE TABLE Reports (
    ReportID INT PRIMARY KEY IDENTITY(1,1),
    ReportName NVARCHAR(255) NOT NULL,
    ReportCode NVARCHAR(50) UNIQUE NOT NULL,
    DataSourceType INT NOT NULL,  -- 1=Batch, 2=RealTime, 3=Hybrid
    
    -- Batch için
    BatchTableName NVARCHAR(255) NULL,
    BatchSchema NVARCHAR(50) DEFAULT 'dbo',
    
    -- RealTime için
    RealTimeQuery NVARCHAR(MAX) NULL,
    SourceDatabase NVARCHAR(100) NULL,  -- Hangi kaynak DB
    
    -- Cache ayarları
    CacheDuration INT DEFAULT 0,  -- Dakika cinsinden (0 = cache yok)
    CacheKeyPattern NVARCHAR(255) NULL,
    
    -- Metadata
    Description NVARCHAR(MAX),
    IsActive BIT DEFAULT 1,
    CreatedDate DATETIME DEFAULT GETDATE(),
    UpdatedDate DATETIME DEFAULT GETDATE()
)

-- Örnek veriler
INSERT INTO Reports (ReportName, ReportCode, DataSourceType, BatchTableName) VALUES
('Aylık Satış Raporu', 'RPT_SALES_MONTHLY', 1, 'Fact_Satislar'),
('Yıllık Finansal Rapor', 'RPT_FINANCE_YEARLY', 1, 'Fact_FinansalVeriler'),
('Anlık Stok Durumu', 'RPT_STOCK_REALTIME', 2, NULL),
('Ürün Detay Raporu', 'RPT_PRODUCT_DETAIL', 3, 'Fact_UrunSatislari')
```

### 3. Real-Time Veriler için Optimizasyon Stratejileri

#### Strateji A: Materialized View (SQL Server)
```sql
-- Stok için materialized view (periyodik güncellenir)
CREATE VIEW vw_StokDurumu_Optimized AS
SELECT 
    s.StokID,
    u.UrunAdi,
    s.Miktar,
    s.DepoID,
    d.DepoAdi,
    s.SonGuncelleme
FROM StokDB.dbo.Stok s
INNER JOIN StokDB.dbo.Urunler u ON s.UrunID = u.UrunID
INNER JOIN StokDB.dbo.Depolar d ON s.DepoID = d.DepoID

-- Index'ler
CREATE INDEX IX_Stok_UrunID ON StokDB.dbo.Stok(UrunID)
CREATE INDEX IX_Stok_DepoID ON StokDB.dbo.Stok(DepoID)
```

#### Strateji B: Kısa Süreli Cache (Redis)
```csharp
// Real-time veriler için 1-5 dakika cache
// İlk istek: DB'den çek, cache'e yaz
// Sonraki istekler: Cache'den oku
// Cache expire olunca tekrar DB'den çek
```

#### Strateji C: Change Tracking (SQL Server)
```sql
-- Sadece değişen kayıtları takip et
ALTER TABLE StokDB.dbo.Stok
ENABLE CHANGE_TRACKING;

-- API'de sadece değişen kayıtları çek
SELECT * FROM CHANGETABLE(CHANGES StokDB.dbo.Stok, @lastSyncVersion) AS ct
```

---

## 📋 Karar Matrisi: Hangi Rapor Hangi Tip?

| Rapor Tipi | Veri Değişim Sıklığı | Veri Kaynağı Tipi | Örnek |
|------------|---------------------|-------------------|-------|
| Satış Raporları | Günlük/Saatlik | Batch | Aylık satış, Bölge bazlı satış |
| Finansal Raporlar | Günlük | Batch | Gelir-Gider, Kar-Zarar |
| Stok Durumu | Anlık (sürekli) | RealTime | Mevcut stok miktarı |
| Canlı İşlemler | Anlık | RealTime | Son yapılan işlemler |
| Ürün Detayı | Karma | Hybrid | Stok (real-time) + Satış geçmişi (batch) |
| Müşteri Detayı | Karma | Hybrid | Canlı durum (real-time) + Geçmiş (batch) |

---

## 🔄 ETL Süreci Güncellemesi

### Batch Tablolar için ETL
```csharp
// ETL Service - Günlük çalışır
public class BatchETLService
{
    public async Task ProcessBatchReports()
    {
        // Sadece Batch tipindeki raporlar için Fact tablolarını güncelle
        var batchReports = await _reportRepository.GetByType(DataSourceType.Batch);
        
        foreach (var report in batchReports)
        {
            await ProcessFactTable(report.BatchTableName);
        }
    }
}
```

### Real-Time Tablolar için
```csharp
// Real-time veriler için ETL yok
// Direkt kaynak DB'den okunur
// Ama cache mekanizması var
```

---

## 🎯 API Kullanım Örneği

```csharp
// ReportsController
[HttpGet("{reportId}/data")]
public async Task<IActionResult> GetReportData(int reportId, [FromQuery] ReportParameters parameters)
{
    // Rapor bilgisini al
    var report = await _reportService.GetReportAsync(reportId);
    
    // Veri kaynağı tipine göre veri çek
    var data = await _dataSourceService.GetReportDataAsync(reportId, parameters.ToDictionary());
    
    // Yetki kontrolü (RLS/CLS)
    data = await _permissionService.ApplySecurityFiltersAsync(data, User, report);
    
    return Ok(data);
}
```

---

## ✅ Sonuç

1. **Rapor tanımında DataSourceType belirlenir**
2. **Batch raporlar:** Fact tablolarından (JOIN yok)
3. **Real-time raporlar:** Kaynak DB'den + Cache
4. **Hybrid raporlar:** İkisini birleştir
5. **Performans:** Her tip için optimize edilmiş yaklaşım

Bu yaklaşımla hem performanslı batch raporlar hem de anlık real-time raporlar sorunsuz çalışacak!

5) ----REALTİME_DINAMİK_ALANLAR----

# Real-Time Raporlarda Dinamik Alan Ekleme Sistemi

## 🎯 Senaryo

**Durum:**
- Kullanıcı real-time rapor açıyor (Stok Durumu)
- DevExpress Dashboard'da kendi alanlarını ekliyor/değiştiriyor
- Rapor yenilendiğinde hem veri hem kullanıcı alanları güncellenmeli

**Sorun:**
- Real-time veri kaynağından dinamik sorgu oluşturma
- Kullanıcının seçtiği alanları sorguya ekleme
- Performans optimizasyonu

---

## ✅ Çözüm: Dinamik Sorgu Oluşturma + Rapor Yapılandırması

### 1. Rapor Yapılandırması Tablosu

Kullanıcının seçtiği alanları ve filtreleri saklamak için:

```sql
CREATE TABLE ReportConfigurations (
    ConfigID INT PRIMARY KEY IDENTITY(1,1),
    ReportID INT NOT NULL,
    UserID INT NOT NULL,
    ConfigName NVARCHAR(255),  -- Kullanıcının verdiği isim
    
    -- Seçilen alanlar (JSON formatında)
    SelectedFields NVARCHAR(MAX),  -- ["StokID", "UrunAdi", "Miktar", ...]
    
    -- Filtreler (JSON formatında)
    Filters NVARCHAR(MAX),  -- {"DepoID": [1,2,3], "Kategori": ["Elektronik"]}
    
    -- Sıralama
    SortFields NVARCHAR(MAX),  -- [{"Field": "Miktar", "Direction": "DESC"}]
    
    -- Gruplama
    GroupByFields NVARCHAR(MAX),  -- ["Kategori", "DepoID"]
    
    -- Aggregation (toplam, ortalama vb.)
    Aggregations NVARCHAR(MAX),  -- [{"Field": "Miktar", "Type": "SUM"}]
    
    -- Metadata
    CreatedDate DATETIME DEFAULT GETDATE(),
    UpdatedDate DATETIME DEFAULT GETDATE(),
    IsDefault BIT DEFAULT 0,  -- Varsayılan yapılandırma mı?
    
    FOREIGN KEY (ReportID) REFERENCES Reports(ReportID),
    FOREIGN KEY (UserID) REFERENCES Users(UserID)
)
```

### 2. Dinamik Sorgu Oluşturma Servisi

```csharp
public class DynamicQueryBuilder
{
    public string BuildRealTimeQuery(Report report, ReportConfiguration config)
    {
        var selectedFields = JsonSerializer.Deserialize<List<string>>(config.SelectedFields);
        var filters = JsonSerializer.Deserialize<Dictionary<string, object>>(config.Filters ?? "{}");
        var groupByFields = JsonSerializer.Deserialize<List<string>>(config.GroupByFields ?? "[]");
        var aggregations = JsonSerializer.Deserialize<List<Aggregation>>(config.Aggregations ?? "[]");
        
        var query = new StringBuilder();
        
        // SELECT kısmı
        if (aggregations.Any())
        {
            // Aggregation varsa (SUM, AVG, COUNT vb.)
            query.Append("SELECT ");
            query.Append(string.Join(", ", aggregations.Select(a => 
                $"{a.Type}({a.Field}) AS {a.Type}_{a.Field}")));
            
            if (groupByFields.Any())
            {
                query.Append(", ");
                query.Append(string.Join(", ", groupByFields));
            }
        }
        else
        {
            // Normal SELECT
            query.Append("SELECT ");
            query.Append(string.Join(", ", selectedFields));
        }
        
        // FROM kısmı (Real-time kaynak)
        query.Append($" FROM {report.RealTimeQuery}");
        
        // WHERE kısmı (Filtreler)
        if (filters.Any())
        {
            query.Append(" WHERE ");
            var whereConditions = new List<string>();
            
            foreach (var filter in filters)
            {
                if (filter.Value is JsonElement jsonElement)
                {
                    if (jsonElement.ValueKind == JsonValueKind.Array)
                    {
                        // IN clause
                        var values = jsonElement.EnumerateArray()
                            .Select(v => $"'{v.GetString()}'")
                            .ToList();
                        whereConditions.Add($"{filter.Key} IN ({string.Join(", ", values)})");
                    }
                    else
                    {
                        // Eşitlik
                        whereConditions.Add($"{filter.Key} = '{jsonElement.GetString()}'");
                    }
                }
            }
            
            query.Append(string.Join(" AND ", whereConditions));
        }
        
        // GROUP BY
        if (groupByFields.Any())
        {
            query.Append(" GROUP BY ");
            query.Append(string.Join(", ", groupByFields));
        }
        
        // ORDER BY
        if (!string.IsNullOrEmpty(config.SortFields))
        {
            var sortFields = JsonSerializer.Deserialize<List<SortField>>(config.SortFields);
            query.Append(" ORDER BY ");
            query.Append(string.Join(", ", sortFields.Select(s => 
                $"{s.Field} {s.Direction}")));
        }
        
        return query.ToString();
    }
}
```

---

## 🔄 Sistem Akışı

### Senaryo: Kullanıcı Stok Raporunu Açıyor ve Alan Ekliyor

#### Adım 1: İlk Açılış (Varsayılan Alanlar)

```javascript
// Frontend - DevExpress Dashboard
1. Kullanıcı "Stok Durumu" raporunu açıyor
2. API'ye istek: GET /api/reports/2/data
3. Backend:
   - ReportID=2 (Stok Raporu) bulunur
   - DataSourceType = RealTime
   - Varsayılan yapılandırma yoksa, temel alanlar gönderilir
   - Real-time sorgu çalıştırılır
   - Cache kontrolü (5 dakika)
   - Veri döner
```

#### Adım 2: Kullanıcı Alan Ekliyor

```javascript
// Frontend - DevExpress Dashboard Designer
1. Kullanıcı "Kategori" alanını ekliyor (drag & drop)
2. Frontend: Yeni alan listesi oluşturulur
   ["StokID", "UrunAdi", "Miktar", "DepoAdi", "Kategori"] // Yeni alan eklendi
3. API'ye istek: POST /api/reports/2/config
   {
     "selectedFields": ["StokID", "UrunAdi", "Miktar", "DepoAdi", "Kategori"],
     "filters": {},
     "userId": 123
   }
4. Backend:
   - Yapılandırma kaydedilir (ReportConfigurations tablosuna)
   - Yeni sorgu oluşturulur (Kategori alanı dahil)
   - Real-time veri çekilir
   - Veri döner
```

#### Adım 3: Rapor Yenileniyor

```javascript
// Frontend - Kullanıcı "Yenile" butonuna basıyor
1. API'ye istek: GET /api/reports/2/data?configId=456
2. Backend:
   - ConfigID=456 bulunur (kullanıcının son yapılandırması)
   - SelectedFields alınır: ["StokID", "UrunAdi", "Miktar", "DepoAdi", "Kategori"]
   - Dinamik sorgu oluşturulur:
     SELECT StokID, UrunAdi, Miktar, DepoAdi, Kategori 
     FROM vw_StokDurumu
   - Cache kontrolü:
     - Cache key: "report_2_config_456_fields_StokID,UrunAdi,Miktar,DepoAdi,Kategori"
     - Cache varsa ve 5 dakika içindeyse → Cache'den döner
     - Cache yoksa/yoksa → DB'den çek, cache'e yaz
   - Veri döner (güncel + kullanıcı alanları dahil)
```

---

## 💻 Kod Örneği

### API Controller

```csharp
[ApiController]
[Route("api/reports")]
public class ReportsController : ControllerBase
{
    private readonly IReportService _reportService;
    private readonly IDataSourceService _dataSourceService;
    private readonly IReportConfigurationService _configService;
    
    // Rapor verisi getir (yapılandırma ile)
    [HttpGet("{reportId}/data")]
    public async Task<IActionResult> GetReportData(
        int reportId, 
        [FromQuery] int? configId = null,
        [FromQuery] int? userId = null)
    {
        var report = await _reportService.GetReportAsync(reportId);
        ReportConfiguration config = null;
        
        // Yapılandırma varsa al
        if (configId.HasValue)
        {
            config = await _configService.GetConfigurationAsync(configId.Value);
        }
        else if (userId.HasValue)
        {
            // Kullanıcının son yapılandırmasını al
            config = await _configService.GetUserLastConfigurationAsync(reportId, userId.Value);
        }
        
        // Real-time rapor için dinamik sorgu oluştur
        if (report.DataSourceType == DataSourceType.RealTime)
        {
            string query;
            
            if (config != null && !string.IsNullOrEmpty(config.SelectedFields))
            {
                // Kullanıcının seçtiği alanlarla dinamik sorgu
                var queryBuilder = new DynamicQueryBuilder();
                query = queryBuilder.BuildRealTimeQuery(report, config);
            }
            else
            {
                // Varsayılan sorgu (tüm alanlar veya temel alanlar)
                query = report.RealTimeQuery;
            }
            
            // Cache kontrolü
            var cacheKey = GenerateCacheKey(reportId, config);
            var cached = await _cache.GetAsync<DataTable>(cacheKey);
            
            if (cached != null)
                return Ok(cached);
            
            // Veri çek
            var data = await _dataSourceService.ExecuteQueryAsync(query, report.SourceDatabase);
            
            // Cache'e yaz
            await _cache.SetAsync(cacheKey, data, TimeSpan.FromMinutes(report.CacheDuration));
            
            return Ok(data);
        }
        else
        {
            // Batch rapor (Fact tablosundan)
            var data = await _dataSourceService.GetBatchDataAsync(report, config);
            return Ok(data);
        }
    }
    
    // Yapılandırmayı kaydet
    [HttpPost("{reportId}/config")]
    public async Task<IActionResult> SaveConfiguration(
        int reportId,
        [FromBody] SaveConfigurationRequest request)
    {
        var config = new ReportConfiguration
        {
            ReportID = reportId,
            UserID = request.UserId,
            ConfigName = request.ConfigName,
            SelectedFields = JsonSerializer.Serialize(request.SelectedFields),
            Filters = JsonSerializer.Serialize(request.Filters ?? new Dictionary<string, object>()),
            SortFields = JsonSerializer.Serialize(request.SortFields ?? new List<SortField>()),
            GroupByFields = JsonSerializer.Serialize(request.GroupByFields ?? new List<string>()),
            Aggregations = JsonSerializer.Serialize(request.Aggregations ?? new List<Aggregation>())
        };
        
        var savedConfig = await _configService.SaveConfigurationAsync(config);
        
        return Ok(new { configId = savedConfig.ConfigID });
    }
    
    private string GenerateCacheKey(int reportId, ReportConfiguration config)
    {
        if (config == null)
            return $"report_{reportId}_default";
        
        var fieldsHash = string.Join(",", 
            JsonSerializer.Deserialize<List<string>>(config.SelectedFields ?? "[]"));
        var filtersHash = config.Filters?.GetHashCode() ?? 0;
        
        return $"report_{reportId}_config_{config.ConfigID}_fields_{fieldsHash}_filters_{filtersHash}";
    }
}
```

### Frontend - DevExpress Dashboard Entegrasyonu

```javascript
// DevExpress Dashboard ile entegrasyon
class ReportManager {
    constructor(reportId, userId) {
        this.reportId = reportId;
        this.userId = userId;
        this.currentConfig = null;
    }
    
    // Raporu yükle
    async loadReport() {
        const response = await fetch(`/api/reports/${this.reportId}/data?userId=${this.userId}`);
        const data = await response.json();
        
        // DevExpress Dashboard'a veri yükle
        this.dashboard.dataSource = data;
    }
    
    // Kullanıcı alan eklediğinde
    onFieldAdded(fieldName) {
        const currentFields = this.dashboard.getVisibleFields();
        currentFields.push(fieldName);
        
        // Yapılandırmayı kaydet
        this.saveConfiguration({
            selectedFields: currentFields,
            filters: this.dashboard.getFilters(),
            sortFields: this.dashboard.getSortFields()
        });
    }
    
    // Yapılandırmayı kaydet
    async saveConfiguration(config) {
        const response = await fetch(`/api/reports/${this.reportId}/config`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId: this.userId,
                ...config
            })
        });
        
        const result = await response.json();
        this.currentConfig = result.configId;
    }
    
    // Raporu yenile
    async refreshReport() {
        const configId = this.currentConfig;
        const url = `/api/reports/${this.reportId}/data?configId=${configId}`;
        
        const response = await fetch(url);
        const data = await response.json();
        
        // DevExpress Dashboard'ı güncelle
        this.dashboard.dataSource = data;
        this.dashboard.refresh();
    }
}
```

---

## 🔄 Detaylı Akış Diyagramı

```
Kullanıcı Stok Raporunu Açıyor
    ↓
[1] GET /api/reports/2/data?userId=123
    ↓
Backend: Varsayılan alanlar ile sorgu oluştur
    SELECT StokID, UrunAdi, Miktar FROM vw_StokDurumu
    ↓
Veri döner → DevExpress gösterir
    ↓
─────────────────────────────────────
Kullanıcı "Kategori" Alanını Ekliyor
    ↓
[2] POST /api/reports/2/config
    {
      selectedFields: ["StokID", "UrunAdi", "Miktar", "Kategori"]
    }
    ↓
Backend: Yapılandırma kaydedilir (ConfigID=456)
    ↓
Dinamik sorgu oluşturulur:
    SELECT StokID, UrunAdi, Miktar, Kategori FROM vw_StokDurumu
    ↓
Veri çekilir → Döner
    ↓
─────────────────────────────────────
Kullanıcı "Yenile" Butonuna Basıyor
    ↓
[3] GET /api/reports/2/data?configId=456
    ↓
Backend: ConfigID=456 bulunur
    SelectedFields: ["StokID", "UrunAdi", "Miktar", "Kategori"]
    ↓
Cache kontrolü:
    Key: "report_2_config_456_fields_StokID,UrunAdi,Miktar,Kategori"
    ↓
Cache yoksa/yoksa:
    Dinamik sorgu çalıştırılır
    SELECT StokID, UrunAdi, Miktar, Kategori FROM vw_StokDurumu
    ↓
Veri çekilir → Cache'e yazılır (5 dakika)
    ↓
Veri döner → DevExpress güncellenir
```

---

## 🎯 Önemli Noktalar

### 1. Cache Stratejisi

```csharp
// Cache key'i kullanıcı alanlarına göre oluştur
// Aynı alanlar → Aynı cache
// Farklı alanlar → Farklı cache

Cache Key Format:
"report_{reportId}_config_{configId}_fields_{fieldHash}_filters_{filterHash}"
```

### 2. Performans Optimizasyonu

- **Kullanıcı alanları değişmediyse:** Cache'den döner (çok hızlı)
- **Kullanıcı alanları değiştiyse:** Yeni sorgu oluşturulur, cache'e yazılır
- **Real-time veri:** 5 dakika cache (veri güncelliği için)

### 3. Güvenlik

- **Yetki kontrolü:** Kullanıcı sadece yetkili olduğu alanları ekleyebilir
- **SQL Injection:** Parametreli sorgular kullanılmalı
- **Alan doğrulama:** Sadece izin verilen alanlar sorguya eklenebilir

---

## 📋 Örnek: Kullanıcı Senaryosu

### Senaryo: Ahmet Stok Raporunu Kullanıyor

1. **İlk Açılış:**
   - Varsayılan alanlar: StokID, UrunAdi, Miktar
   - Sorgu: `SELECT StokID, UrunAdi, Miktar FROM vw_StokDurumu`

2. **Alan Ekleme:**
   - Ahmet "DepoAdi" ve "Kategori" ekliyor
   - Yeni sorgu: `SELECT StokID, UrunAdi, Miktar, DepoAdi, Kategori FROM vw_StokDurumu`
   - Yapılandırma kaydedilir (ConfigID=789)

3. **Filtre Ekleme:**
   - Ahmet "Kategori = 'Elektronik'" filtresi ekliyor
   - Yeni sorgu: `SELECT ... FROM vw_StokDurumu WHERE Kategori = 'Elektronik'`
   - Yapılandırma güncellenir

4. **Rapor Yenileme:**
   - Ahmet "Yenile" butonuna basıyor
   - ConfigID=789 ile sorgu çalıştırılır
   - Cache kontrolü yapılır
   - Güncel veri döner (5 dakika içindeyse cache'den)

---

## ✅ Sonuç

1. **Kullanıcı alan ekler** → Yapılandırma kaydedilir
2. **Rapor yenilenir** → Kaydedilen yapılandırma ile dinamik sorgu oluşturulur
3. **Cache mekanizması** → Performans optimizasyonu
4. **Real-time veri** → Her zaman güncel (cache süresi içinde)

Bu sistemle kullanıcılar istediği alanları ekleyebilir ve rapor yenilendiğinde hem veri hem alanlar güncellenir! 🚀



1. Nerelerden alacağız?
Şu anki tasarımda iki ana katman var:
Operasyonel sistemler (kaynak DB’ler)
ERP (satış, stok, sipariş vs.)
CRM (müşteri, segment, bölge vs.)
Diğer varsa: finans, insan kaynakları vb.
Bunlar ham veriyi tuttuğumuz yerler.
Veri Ambarı (DW)
Fact_ tabloları: önceden join’lenmiş, rapora hazır veriler
Dim_ tabloları: tarih, müşteri, ürün, bölge vb. boyutlar
Buraya sadece ETL ile hazırlanmış, raporlanabilir veri geliyor.
> Karar:
> - Batch raporlar → her zaman DW’den (Fact tablolarından) gelecek.
> - Real-time raporlar (ör. stok) → direkt operasyonel DB’den (view/SP üzerinden, cache’li).
2. Nasıl alacağız? (Akış)
Batch (DW’ye giden)
.NET Core ETL Service:
Kaynak SQL Server DB’lere bağlanır (connection string’ler ile)
Gerekli JOIN / hesaplamaları yapar
Sonucu Fact_ ve Dim_ tablolara yazar
Zamanlama: SQL Server Agent / Hangfire / Quartz ile (örn. her gece 02:00 veya her saat)
Real-time
API, operasyonel DB’deki optimize edilmiş view / stored procedure’lardan okur
Örn: vw_StokDurumu
Üstüne kısa süreli (1–5 dk) Redis/memory cache
3. Şimdi senden netleştirmek istediğim şeyler
Bunlara göre veri modelini netleştirebiliriz:
Hangi sistemler kesin var?
ERP: adı / modülleri? (stok, satış, sipariş?)
CRM: var mı, hangi tablolar kritik?
Stok için:
Kaç depo / ürün hacmi yaklaşık ne kadar?
Stok raporlarını kaç saniyede gelsin diye hedefliyorsunuz? (ör. 1–3 sn yeterli mi?)
Batch tarafı için:
Hangi raporlar “gece hazırlanmış olsun, anlık olmasın” sınıfında? (satış, finans vs.)
Bunlara göre sana somut bir “kaynak tablo → DW tablo” haritası çıkarayım (örnek: ERP.dbo.Satislar → DW.dbo.Fact_Satislar).




