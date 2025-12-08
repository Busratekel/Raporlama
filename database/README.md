# Veri Ambarı (Data Warehouse) Kurulum

## Adımlar

### 1. Veri Ambarı Oluştur
```sql
-- SQL Server Management Studio'da çalıştır
sqlcmd -S BLN-KAY-CLSQL2 -i 01_CreateDW.sql
```

Veya manuel:
- `01_CreateDW.sql` dosyasını aç
- SQL Server Management Studio'da çalıştır

### 2. Dimension Tabloları Oluştur
```sql
sqlcmd -S BLN-KAY-CLSQL2 -i 02_CreateDimensions.sql
```

### 3. Fact Tabloları Oluştur
```sql
sqlcmd -S BLN-KAY-CLSQL2 -i 03_CreateFacts.sql
```

### 4. Tarih Dimension'ını Doldur
```sql
sqlcmd -S BLN-KAY-CLSQL2 -i 04_PopulateDimTarih.sql
```

## ETL Service Çalıştırma

```bash
cd src/Raporlama.ETL
dotnet run
```

ETL Service:
- Dimension tablolarını EBA'dan günceller
- Fact tablolarını JOIN'leyerek doldurur
- Her gece saat 02:00'de otomatik çalışır (opsiyonel)

## Veri Akışı

```
EBA Database (aa_AAPersonel, aa_AADepartman, aa_AAPozisyon)
    ↓ (ETL - JOIN'ler burada yapılıyor!)
Raporlama_DW (Dim_Calisan, Dim_Departman, Dim_Pozisyon, Fact_CalisanOzet)
    ↓ (Raporlama - JOIN YOK, sadece SELECT!)
API → DevExpress Dashboard
```

## Performans

- **ETL Zamanı:** JOIN'ler yapılır (yavaş ama sadece gece 1 kez)
- **Raporlama Zamanı:** Sadece SELECT (çok hızlı!)





