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
        _logger.LogInformation("ETL Worker başlatıldı");

        var enableScheduling = _configuration.GetValue<bool>("ETL:EnableScheduling");

        if (!enableScheduling)
        {
            _logger.LogInformation("Zamanlama devre dışı. Manuel çalıştırma için API kullanın.");
            
            // İlk çalıştırma (test için)
            _logger.LogInformation("İlk ETL işlemi başlatılıyor...");
            await _etlService.RunETLAsync();
            
            return;
        }

        // Zamanlanmış çalıştırma (her gece saat 2:00)
        while (!stoppingToken.IsCancellationRequested)
        {
            var now = DateTime.Now;
            var nextRun = new DateTime(now.Year, now.Month, now.Day, 2, 0, 0);
            
            if (now > nextRun)
            {
                nextRun = nextRun.AddDays(1);
            }

            var delay = nextRun - now;
            _logger.LogInformation("Sonraki ETL çalışması: {NextRun} ({Delay} sonra)", 
                nextRun, delay);

            await Task.Delay(delay, stoppingToken);

            if (!stoppingToken.IsCancellationRequested)
            {
                await _etlService.RunETLAsync();
            }
        }
    }
}





