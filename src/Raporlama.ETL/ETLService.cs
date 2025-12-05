using Dapper;
using Microsoft.Data.SqlClient;

namespace Raporlama.ETL;

public class ETLService
{
    private readonly ILogger<ETLService> _logger;
    private readonly IConfiguration _configuration;
    private readonly string _boytasWHConnectionString;
    private readonly string _bellonaRaporConnectionString;

    public ETLService(ILogger<ETLService> logger, IConfiguration configuration)
    {
        _logger = logger;
        _configuration = configuration;
        _boytasWHConnectionString = configuration.GetConnectionString("BoytasWH") 
            ?? throw new Exception("BoytasWH connection string bulunamadı");
        _bellonaRaporConnectionString = configuration.GetConnectionString("BellonaRapor") 
            ?? throw new Exception("BellonaRapor connection string bulunamadı");
    }

    public async Task RunETLAsync()
    {
        _logger.LogInformation("ETL işlemi başlatıldı: {Time}", DateTime.Now);

        try
        {
            // Veritabanı bağlantılarını kontrol et
            if (!await TestConnectionsAsync())
            {
                throw new Exception("Veritabanı bağlantıları başarısız!");
            }

            await LoadBekleyenSureclerAsync();

            _logger.LogInformation("ETL işlemi başarıyla tamamlandı: {Time}", DateTime.Now);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "ETL işlemi sırasında hata oluştu");
            throw;
        }
    }

    private async Task<bool> TestConnectionsAsync()
    {
        try
        {
            _logger.LogInformation("Veritabanı bağlantıları test ediliyor...");
            
            using var kaynakConn = new SqlConnection(_boytasWHConnectionString);
            using var hedefConn = new SqlConnection(_bellonaRaporConnectionString);

            await kaynakConn.OpenAsync();
            await hedefConn.OpenAsync();

            _logger.LogInformation("Veritabanı bağlantıları başarılı");
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Veritabanı bağlantı test başarısız");
            return false;
        }
    }

    private async Task LoadBekleyenSureclerAsync()
    {
        _logger.LogInformation("Bekleyen süreçler yükleniyor...");

        using var kaynakConn = new SqlConnection(_boytasWHConnectionString);
        using var hedefConn = new SqlConnection(_bellonaRaporConnectionString);

        try
        {
            // KAYNAK: SQL sorguları artık config'ten okunuyor; appsettings.json içindeki ETL:Queries altını düzenleyin.
            _logger.LogInformation("ETL: BekleyenSurecler sorgusu config'ten okunuyor...");
            var bekleyenQuery = _configuration["ETL:Queries:BekleyenSurecler"];
            if (string.IsNullOrWhiteSpace(bekleyenQuery))
            {
                _logger.LogWarning("ETL: BekleyenSurecler sorgusu config'te tanımlı değil, varsayılan kullanılacak.");
                bekleyenQuery = @"SELECT TOP (1000) [Süreç No] as SurecNo, [Form Adı] as FormAdi, [Formu Dolduran Sicil] as FormuDolduranSicil, [Formu Dolduran] as FormuDolduran, [Formu Gönderen Bölüm] as FormuGonderenBolum, [Formu Bekleten Sicil] as FormuBekletenSicil, [Formu Bekleten] as FormuBekleten, [Formu Bekleten Bölüm] as FormuBekletenBolum, [Süreç Başlangıç Tarihi] as SurecBaslangicTarihi, [Süreç Bekletene Geliş Tarihi] as SurecBekleteneGelisTarihi, [Bekleyen Gün] as BekleyenGun, [UserName] as UserName, [Mudurluk_Adi] as MudurlukAdi, [Direktorluk_Adi] as DirektorlukAdi FROM [BoytasWH].[dbo].[View_eBABekleyen]";
            }

            var bekleyenSurecler = (await kaynakConn.QueryAsync<dynamic>(bekleyenQuery)).ToList();

            _logger.LogInformation("Çekilen kayıt sayısı: {Count}", bekleyenSurecler.Count);

            if (bekleyenSurecler.Count == 0)
            {
                _logger.LogWarning("Hiçbir kayıt çekilmedi!");
                return;
            }

            _logger.LogInformation("BellonaRapor.dbo.Fact_BekleyenSurecler temizleniyor...");
            await hedefConn.ExecuteAsync("TRUNCATE TABLE Fact_BekleyenSurecler");

            _logger.LogInformation("BellonaRapor.dbo.Fact_BekleyenSurecler'e yazılıyor (bulk insert)...");
            const int batchSize = 1000;
            int totalInserted = 0;

            for (int i = 0; i < bekleyenSurecler.Count; i += batchSize)
            {
                var batch = bekleyenSurecler.Skip(i).Take(batchSize).ToList();
                
                await hedefConn.ExecuteAsync(@"
                    INSERT INTO Fact_BekleyenSurecler (
                        SurecNo, FormAdi,
                        FormuDolduranSicil, FormuDolduran, FormuDolduranSirketi, FormuGonderenBolum,
                        FormuBekletenSicil, FormuBekleten, FormuBekletenSirketi, FormuBekletenBolum,
                        SurecBaslangicTarihi, SurecBekleteneGelisTarihi,
                        BekleyenGun, UserName, MudurlukAdi, DirektorlukAdi
                    )
                    VALUES (
                        @SurecNo, @FormAdi,
                        @FormuDolduranSicil, @FormuDolduran, @FormuDolduranSirketi, @FormuGonderenBolum,
                        @FormuBekletenSicil, @FormuBekleten, @FormuBekletenSirketi, @FormuBekletenBolum,
                        @SurecBaslangicTarihi, @SurecBekleteneGelisTarihi,
                        @BekleyenGun, @UserName, @MudurlukAdi, @DirektorlukAdi
                    )
                ", batch.Select((surec, idx) => new
                {
                    // Eğer kaynakta SurecNo yoksa benzersiz bir fallback oluşturuyoruz: FormAdi + sıraNumarası
                    SurecNo = (surec.SurecNo as string) ?? ($"{(surec.FormAdi as string ?? "FORM")}_{i + idx + 1}"),
                    FormAdi = surec.FormAdi as string,
                    FormuDolduranSicil = surec.FormuDolduranSicil as string,
                    FormuDolduran = surec.FormuDolduran as string,
                    FormuDolduranSirketi = surec.FormuDolduranSirketi as string,
                    FormuGonderenBolum = surec.FormuGonderenBolum as string,
                    FormuBekletenSicil = surec.FormuBekletenSicil as string,
                    FormuBekleten = surec.FormuBekleten as string,
                    FormuBekletenSirketi = surec.FormuBekletenSirketi as string,
                    FormuBekletenBolum = surec.FormuBekletenBolum as string,
                    SurecBaslangicTarihi = surec.SurecBaslangicTarihi as DateTime?,
                    SurecBekleteneGelisTarihi = surec.SurecBekleteneGelisTarihi as DateTime?,
                    BekleyenGun = surec.BekleyenGun as int?,
                    UserName = surec.UserName as string,
                    MudurlukAdi = surec.MudurlukAdi as string,
                    DirektorlukAdi = surec.DirektorlukAdi as string
                }));

                totalInserted += batch.Count;
                _logger.LogInformation("Batch işlendi: {Inserted}/{Total}", totalInserted, bekleyenSurecler.Count);
            }

            _logger.LogInformation("Fact_BekleyenSurecler başarıyla güncellendi: {Count} kayıt", totalInserted);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Bekleyen süreçler yükleme sırasında hata oluştu");
            throw;
        }
    }

    // Çalışanlar yükleme artık proje kapsamında değil; ilgili method kaldırıldı.
}

