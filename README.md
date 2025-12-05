# Raporlama Sistemi

EBA veritabanı entegrasyonu ile dinamik raporlama sistemi.

## Kurulum

1. **Connection string'i güncelle:**
`src/Raporlama.API/appsettings.json` dosyasında EBA bağlantısını ayarla.

2. **Projeyi çalıştır:**
```bash
cd src/Raporlama.API
dotnet restore
dotnet run
```

3. **Swagger açılacak:**
`http://localhost:5000/swagger`

## API Endpoints

- `GET /api/reports` - Tüm raporlar
- `GET /api/reports/{id}` - Rapor detayı
- `GET /api/reports/{id}/data` - Rapor verisi
- `GET /api/reports/test-connection/EBA` - Bağlantı testi
- `GET /api/reports/tables/EBA` - EBA tabloları

## İlk Adımlar

1. EBA bağlantısını test et
2. Tabloları listele
3. Gerekli tabloları bulun
4. Raporu çalıştır





