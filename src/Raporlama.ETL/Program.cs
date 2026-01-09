
using Raporlama.ETL;
using Serilog;
using Microsoft.AspNetCore.Builder;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

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





