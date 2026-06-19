using Cronos;
namespace Raporlama.ETL;
public class ETLWorker : BackgroundService
{
    private readonly ILogger<ETLWorker> _logger;
    private readonly ETLService _etlService;

    public ETLWorker(ILogger<ETLWorker> logger, ETLService etlService)
    {
        _logger = logger;
        _etlService = etlService;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var logDir = ETLService.GetLogDirectory();
        Directory.CreateDirectory(logDir);
        _logger.LogInformation("Log klasörü: {LogDir}", logDir);

        ETLService.CleanupOldLogs();
        _logger.LogInformation("ETL Worker başlatıldı");

        // Dinamik görev zamanlama
        var nextRunTimes = new Dictionary<int, DateTime?>(); // GorevId -> bir sonraki çalıştırma zamanı
        while (!stoppingToken.IsCancellationRequested)
        {
            var nowLocal = DateTime.Now;
            // Türkiye saatini alma 
            var turkeyTz = TimeZoneInfo.FindSystemTimeZoneById("Turkey Standard Time");
            var nowUtc = DateTime.UtcNow;
            var nowTurkey = TimeZoneInfo.ConvertTime(nowUtc, turkeyTz);
            try
            {
                var gorevler = await _etlService.GetActiveTasksAsync();
                foreach (var gorev in gorevler)
                {
                    if (string.IsNullOrWhiteSpace(gorev.Schedule)) continue;
                    if (string.IsNullOrWhiteSpace(gorev.SorguMetni) || string.IsNullOrWhiteSpace(gorev.HedefTablo))
                    {
                        _logger.LogWarning($"Görev eksik: {gorev.GorevAdi} - Sorgu veya tablo boş!");
                        continue;
                    }
                    var cron = Cronos.CronExpression.Parse(gorev.Schedule);
                    if (!nextRunTimes.ContainsKey(gorev.GorevId) || nextRunTimes[gorev.GorevId] == null)
                    {
                        _logger.LogInformation($"[DEBUG] Cron hesaplanıyor: {gorev.Schedule} için nowUtc: {nowUtc:yyyy-MM-dd HH:mm:ss}, nowTurkey: {nowTurkey:yyyy-MM-dd HH:mm:ss}");
                        var firstRunUtc = cron.GetNextOccurrence(nowUtc, turkeyTz);
                        var firstRunTurkey = firstRunUtc.HasValue ? TimeZoneInfo.ConvertTime(firstRunUtc.Value, turkeyTz) : (DateTime?)null;
                        _logger.LogInformation($"[DEBUG] nextRunTurkey (Türkiye saati): {firstRunTurkey:yyyy-MM-dd HH:mm:ss}");
                        nextRunTimes[gorev.GorevId] = firstRunTurkey;
                    }
                    var runTime = nextRunTimes[gorev.GorevId];
                    var tolerance = TimeSpan.FromSeconds(10); // döngü aralığı
                    // Şu anki Türkiye saatiyle karşılaştır
                    if (runTime.HasValue && nowTurkey >= runTime.Value && nowTurkey <= runTime.Value + tolerance)
                    {
                        _logger.LogInformation($"[DEBUG] TETIKLEME KOŞULU: {runTime.Value:yyyy-MM-dd HH:mm:ss} <= {nowLocal:yyyy-MM-dd HH:mm:ss} <= {runTime.Value + tolerance:yyyy-MM-dd HH:mm:ss}, ETL çalışacak!");
                        var start = DateTime.Now;
                        _logger.LogInformation($"[Otomatik] ETL Görevi Başladı: {gorev.GorevAdi} ({gorev.HedefTablo}) | Başlangıç: {start:yyyy-MM-dd HH:mm:ss}");
                        try
                        {
                            int kayitSayisi = await _etlService.RunCustomETLWithResultAsync(gorev.SorguMetni!, gorev.HedefTablo!);
                            var end = DateTime.Now;
                            _logger.LogInformation($"[Otomatik] ETL Görevi Bitti: {gorev.GorevAdi} ({gorev.HedefTablo}) | Bitiş: {end:yyyy-MM-dd HH:mm:ss} | Çekilen Kayıt: {kayitSayisi}");
                        }
                        catch (Exception ex)
                        {
                            _logger.LogError(ex, $"[Otomatik] {gorev.GorevAdi} ETL çalıştırılırken hata oluştu");
                        }
                        // Sadece ETL çalıştıktan sonra bir sonraki zamanı güncelle
                        var nextRunUtc = DateTime.UtcNow.AddSeconds(1);
                        var nextRunUtcVal = cron.GetNextOccurrence(nextRunUtc, turkeyTz);
                        var nextRunTurkey = nextRunUtcVal.HasValue ? TimeZoneInfo.ConvertTime(nextRunUtcVal.Value, turkeyTz) : (DateTime?)null;
                        _logger.LogInformation($"[DEBUG] nextRunTurkey (sonra, Türkiye saati): {nextRunTurkey:yyyy-MM-dd HH:mm:ss}");
                        nextRunTimes[gorev.GorevId] = nextRunTurkey;
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Dinamik ETL görev zamanlayıcıda hata oluştu");
            }
            await Task.Delay(TimeSpan.FromSeconds(10), stoppingToken);
        }
    }
}





