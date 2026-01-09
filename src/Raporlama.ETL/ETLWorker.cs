using Cronos;
namespace Raporlama.ETL;
public class ETLWorker : BackgroundService
{
    private readonly ILogger<ETLWorker> _logger;
    private readonly ETLService _etlService;
    private readonly IConfiguration _configuration;

    public ETLWorker(ILogger<ETLWorker> logger, ETLService etlService, IConfiguration configuration)
    {
        _logger = logger;
        _etlService = etlService;
        _configuration = configuration;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        // DEBUG: Şu anki zaman ve cron hesaplamasını logla
        _logger.LogInformation($"[DEBUG] nowLocal: {DateTime.Now:yyyy-MM-dd HH:mm:ss}, nowUtc: {DateTime.UtcNow:yyyy-MM-dd HH:mm:ss}");
        // Log klasörü yoksa oluştur (sabit workspace yolu)
        var logDir = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "src", "Raporlama.ETL", "logs"));
        if (!Directory.Exists(logDir))
        {
            Directory.CreateDirectory(logDir);
            _logger.LogInformation($"Log klasörü oluşturuldu: {logDir}");
        }
        _logger.LogInformation("ETL Worker başlatıldı");

        // Dinamik görev zamanlama
        var nextRunTimes = new Dictionary<int, DateTime?>(); // GorevId -> bir sonraki çalıştırma zamanı
        while (!stoppingToken.IsCancellationRequested)
        {
            var nowLocal = DateTime.Now;
            var nowUtc = DateTime.SpecifyKind(DateTime.UtcNow, DateTimeKind.Utc);
            try
            {
                var gorevler = await _etlService.GetActiveTasksAsync();
                foreach (var gorev in gorevler)
                {
                    _logger.LogInformation($"[DEBUG] Görev: {gorev.GorevAdi}, Schedule: {gorev.Schedule}");
                    if (string.IsNullOrWhiteSpace(gorev.Schedule)) continue;
                    if (string.IsNullOrWhiteSpace(gorev.SorguMetni) || string.IsNullOrWhiteSpace(gorev.HedefTablo))
                    {
                        _logger.LogWarning($"Görev eksik: {gorev.GorevAdi} - Sorgu veya tablo boş!");
                        continue;
                    }
                    var cron = Cronos.CronExpression.Parse(gorev.Schedule);
                    if (!nextRunTimes.ContainsKey(gorev.GorevId) || nextRunTimes[gorev.GorevId] == null)
                    {
                        _logger.LogInformation($"[DEBUG] Cron hesaplanıyor: {gorev.Schedule} için nowUtc: {nowUtc:yyyy-MM-dd HH:mm:ss}");
                        var firstRunUtc = cron.GetNextOccurrence(nowUtc, TimeZoneInfo.Local);
                        var firstRunLocal = firstRunUtc?.ToLocalTime();
                        _logger.LogInformation($"[DEBUG] nextRunLocal: {firstRunLocal:yyyy-MM-dd HH:mm:ss}");
                        nextRunTimes[gorev.GorevId] = firstRunLocal;
                    }
                    var runTime = nextRunTimes[gorev.GorevId];
                    var tolerance = TimeSpan.FromSeconds(10); // döngü aralığı
                    if (runTime.HasValue && nowLocal >= runTime.Value && nowLocal <= runTime.Value + tolerance)
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
                        var nextRunUtc = cron.GetNextOccurrence(DateTime.SpecifyKind(DateTime.UtcNow.AddSeconds(1), DateTimeKind.Utc), TimeZoneInfo.Local);
                        var nextRunLocal = nextRunUtc?.ToLocalTime();
                        _logger.LogInformation($"[DEBUG] nextRunLocal (sonra): {nextRunLocal:yyyy-MM-dd HH:mm:ss}");
                        nextRunTimes[gorev.GorevId] = nextRunLocal;
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





