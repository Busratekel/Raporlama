using Dapper;
using Microsoft.Data.SqlClient;

namespace Raporlama.ETL;

public class ETLService
{
    private readonly ILogger<ETLService> _logger;
    private readonly IConfiguration _configuration;
    private readonly string _bellonaRaporConnectionString;

    public ETLService(ILogger<ETLService> logger, IConfiguration configuration)
    {
        _logger = logger;
        _configuration = configuration;
        _bellonaRaporConnectionString = configuration.GetConnectionString("BellonaRapor") 
            ?? throw new Exception("BellonaRapor connection string bulunamadı");
    }

    public async Task RunETLAsync()
    {
        _logger.LogInformation("ETL işlemi başlatıldı: {Time}", DateTime.Now);
        try
        {
            await LoadFromConfigAsync("BekleyenSurecler", "Fact_BekleyenSurecler");
            await LoadFromConfigAsync("QDMS", "Fact_QDMS");

            _logger.LogInformation("ETL işlemi başarıyla tamamlandı: {Time}", DateTime.Now);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "ETL işlemi sırasında hata oluştu");
            throw;
        }
    }

    public async Task LoadFromConfigAsync(string sorguAdi, string hedefTablo)
    {
        _logger.LogInformation("{Tablo} için ETL başlatılıyor...", hedefTablo);
        using var conn = new SqlConnection(_bellonaRaporConnectionString);
        try
        {
            await conn.OpenAsync();
            const string sorguConfigSql = @"SELECT TOP 1 SorguMetni FROM SorgularConfig WHERE SorguAdi = @SorguAdi AND Aktif = 1 ORDER BY OlusturmaTarihi DESC";
            var sorguMetni = await conn.QueryFirstOrDefaultAsync<string>(sorguConfigSql, new { SorguAdi = sorguAdi });

            if (string.IsNullOrWhiteSpace(sorguMetni))
            {
                _logger.LogError("SorgularConfig tablosunda '{SorguAdi}' için aktif bir sorgu bulunamadı!", sorguAdi);
                return;
            }

            _logger.LogInformation("[ETL] SorgularConfig'ten alınan sorgu:\n{Sorgu}", sorguMetni);

            var dt = new System.Data.DataTable();
            using (var cmd = new Microsoft.Data.SqlClient.SqlCommand(sorguMetni, conn))
            using (var reader = await cmd.ExecuteReaderAsync())
            {
                dt.Load(reader);
            }
            _logger.LogInformation("Çekilen kayıt sayısı: {Count}", dt.Rows.Count);

            if (dt.Rows.Count == 0)
            {
                _logger.LogWarning("Hiçbir kayıt çekilmedi!");
                return;
            }

            _logger.LogInformation("{Tablo} temizleniyor...", hedefTablo);
            await conn.ExecuteAsync($"TRUNCATE TABLE {hedefTablo}");

            _logger.LogInformation("{Tablo}'ya yazılıyor (SqlBulkCopy)...", hedefTablo);
            using (var bulkCopy = new Microsoft.Data.SqlClient.SqlBulkCopy(conn))
            {
                bulkCopy.DestinationTableName = hedefTablo;
                foreach (System.Data.DataColumn col in dt.Columns)
                {
                    bulkCopy.ColumnMappings.Add(col.ColumnName, col.ColumnName);
                }
                await bulkCopy.WriteToServerAsync(dt);
            }

            _logger.LogInformation("{Tablo} başarıyla güncellendi: {Count} kayıt", hedefTablo, dt.Rows.Count);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "{Tablo} yükleme sırasında hata oluştu", hedefTablo);
            throw;
        }
    }

}

