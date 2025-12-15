# Giriş Sorunları Çözüm Kılavuzu

## 🔍 Sorun: Windows Authentication Çalışmıyor

### Adım 1: Test Endpoint'ini Kontrol Edin

Tarayıcıda şu URL'yi açın:
```
http://localhost:5000/api/authtest/status
```

Bu endpoint size şunları gösterecek:
- `isAuthenticated`: Giriş yapılmış mı?
- `userName`: Kullanıcı adı ne?
- `authenticationType`: Hangi authentication tipi kullanılıyor?

### Adım 2: Veritabanında Kullanıcıyı Kontrol Edin

SQL Server'da şu sorguyu çalıştırın:
```sql
USE BellonaRapor;
GO

-- Tüm kullanıcıları listele
SELECT * FROM [User] ORDER BY UserName;

-- Belirli bir kullanıcıyı kontrol et
SELECT * FROM [User] WHERE UserName = 'DOMAIN\kullaniciadi';
```

**Önemli:** `UserName` kolonu tam olarak Windows Authentication'dan gelen kullanıcı adıyla eşleşmeli.
- Örnek: `DOMAIN\busra.tekel` veya `COMPUTERNAME\busra.tekel`

### Adım 3: Kullanıcı Adı Formatını Kontrol Edin

Windows Authentication'dan gelen kullanıcı adı genellikle şu formatta olur:
- Domain ortamında: `DOMAIN\username`
- Workgroup ortamında: `COMPUTERNAME\username`

Veritabanındaki `UserName` kolonu bu formatta olmalı.

### Adım 4: Kullanıcıyı Manuel Olarak Ekleme

Eğer kullanıcı veritabanında yoksa, manuel olarak ekleyebilirsiniz:

```sql
USE BellonaRapor;
GO

-- Kullanıcıyı ekle (UserName'i kendi kullanıcı adınızla değiştirin)
INSERT INTO [User] (UserName, DisplayName, Email, Aktif, Groups)
VALUES ('DOMAIN\busra.tekel', 'Busra Tekel', 'busra.tekel@domain.com', 1, '');

-- Kontrol et
SELECT * FROM [User] WHERE UserName = 'DOMAIN\busra.tekel';
```

### Adım 5: Tarayıcı Ayarları

Windows Authentication için tarayıcı ayarları:

**Internet Explorer / Edge (Legacy):**
- Internet Seçenekleri → Güvenlik → Yerel intranet → Siteler
- `http://localhost` ekleyin

**Chrome:**
- Chrome'da Windows Authentication bazen sorun çıkarabilir
- Edge veya Firefox deneyin

**Firefox:**
- `about:config` → `network.automatic-ntlm-auth.trusted-uris` → `http://localhost`

### Adım 6: IIS veya Kestrel Ayarları

Eğer IIS kullanıyorsanız:
1. IIS Manager'da sitenizi seçin
2. Authentication → Windows Authentication'ı Enable edin
3. Anonymous Authentication'ı Disable edin

Eğer Kestrel kullanıyorsanız (development):
- `launchSettings.json` dosyasında `windowsAuthentication: true` olmalı

### Adım 7: Debug Logging

API'yi çalıştırırken console'da şu logları kontrol edin:
```
[Information] WindowsIdentity found: DOMAIN\username
[Information] User created: DOMAIN\username
```

Eğer `HttpContext is null` veya `User.Identity is null` görüyorsanız, authentication çalışmıyor demektir.

### Adım 8: Test Endpoint'leri

1. **Auth Status (Herkes erişebilir):**
   ```
   GET http://localhost:5000/api/authtest/status
   ```

2. **Protected Endpoint (Sadece giriş yapmış kullanıcılar):**
   ```
   GET http://localhost:5000/api/authtest/protected
   ```

3. **Current User (Sadece giriş yapmış kullanıcılar):**
   ```
   GET http://localhost:5000/api/authorization/current-user
   ```

### Adım 9: Veritabanı Bağlantısı

Eğer kullanıcı bilgileri alınamıyorsa, veritabanı bağlantısını kontrol edin:

```sql
-- Veritabanı bağlantısını test et
USE BellonaRapor;
GO

-- User tablosunu kontrol et
SELECT COUNT(*) as UserCount FROM [User];

-- Son eklenen kullanıcıları gör
SELECT TOP 10 * FROM [User] ORDER BY EklenmeTarihi DESC;
```

### Adım 10: Manuel Test

Postman veya curl ile test edin:

```bash
# Windows Authentication ile istek gönder
curl -u "DOMAIN\username" http://localhost:5000/api/authtest/status
```

## 🐛 Yaygın Hatalar ve Çözümleri

### Hata 1: "Unknown" kullanıcı adı
**Sebep:** Windows Authentication çalışmıyor
**Çözüm:** 
- Tarayıcıyı kapatıp açın
- Edge veya Internet Explorer kullanın
- IIS'de Windows Authentication'ı enable edin

### Hata 2: "User not found" ama kullanıcı tabloda var
**Sebep:** Kullanıcı adı formatı eşleşmiyor
**Çözüm:**
- Veritabanındaki `UserName` kolonunu kontrol edin
- Windows Authentication'dan gelen tam kullanıcı adını kullanın

### Hata 3: 401 Unauthorized
**Sebep:** Authentication başarısız
**Çözüm:**
- `/api/authtest/status` endpoint'ini kontrol edin
- Tarayıcı ayarlarını kontrol edin

### Hata 4: Kullanıcı oluşturulmuyor
**Sebep:** Veritabanı bağlantı hatası veya INSERT hatası
**Çözüm:**
- Veritabanı bağlantı string'ini kontrol edin
- SQL Server loglarını kontrol edin

## 📞 Yardım

Eğer hala sorun yaşıyorsanız:

1. Browser console'u açın (F12)
2. Network tab'ında istekleri kontrol edin
3. API loglarını kontrol edin
4. `/api/authtest/status` endpoint'inin çıktısını paylaşın

