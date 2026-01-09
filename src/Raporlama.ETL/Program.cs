
using Raporlama.ETL;
using Serilog;
using Microsoft.AspNetCore.Builder;



// logs klasöründe bugünün dosyası hariç tüm etl-*.txt dosyalarını sil (klasör yolu workspace'e göre düzeltildi)
var logsDir = Path.Combine(Directory.GetCurrentDirectory(), "logs");
if (!Directory.Exists(logsDir))
    Directory.CreateDirectory(logsDir);
var today = DateTime.Now.ToString("yyyyMMdd");
var files = Directory.GetFiles(logsDir, "etl-*.txt");
foreach (var file in files)
{
    if (!file.Contains($"etl-{today}.txt"))
    {
        try { File.Delete(file); } catch { }
    }
}

Log.Logger = new LoggerConfiguration()
    .WriteTo.Console()
    .WriteTo.File("logs/etl-.txt", rollingInterval: RollingInterval.Day)
    .CreateLogger();

try
{
    Log.Information("ETL Service başlatılıyor...");

    var builder = WebApplication.CreateBuilder(args);
    builder.Host.UseSerilog();

    builder.Services.AddHostedService<ETLWorker>();
    builder.Services.AddSingleton<ETLService>();
    builder.Services.AddControllers();

    var app = builder.Build();

    app.MapControllers();

    app.Run("http://0.0.0.0:5010");
}
catch (Exception ex)
{
    Log.Fatal(ex, "ETL Service başlatılamadı");
}
finally
{
    Log.CloseAndFlush();
}





