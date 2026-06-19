using Raporlama.ETL;
using Serilog;
using Microsoft.AspNetCore.Builder;

var logDir = ETLService.GetLogDirectory();
Directory.CreateDirectory(logDir);

Log.Logger = new LoggerConfiguration()
    .WriteTo.Console()
    .WriteTo.File(Path.Combine(logDir, "etl-.txt"), rollingInterval: RollingInterval.Day)
    .CreateLogger();

try
{
    Log.Information("Raporlama.ETL başlatılıyor...");

    var builder = WebApplication.CreateBuilder(args);
    builder.Host.UseSerilog();
    builder.Host.UseWindowsService(options => options.ServiceName = "Raporlama.ETL");

    builder.Services.AddHostedService<ETLWorker>();
    builder.Services.AddSingleton<ETLService>();
    builder.Services.AddControllers();

    var app = builder.Build();
    app.MapControllers();

    var listenUrl = builder.Configuration["ETL:ListenUrl"] ?? "http://127.0.0.1:5010";
    app.Run(listenUrl);
}
catch (Exception ex)
{
    Log.Fatal(ex, "Raporlama.ETL başlatılamadı");
}
finally
{
    Log.CloseAndFlush();
}
