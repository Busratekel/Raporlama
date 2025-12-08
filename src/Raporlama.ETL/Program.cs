using Raporlama.ETL;
using Serilog;

Log.Logger = new LoggerConfiguration()
    .WriteTo.Console()
    .WriteTo.File("logs/etl-.txt", rollingInterval: RollingInterval.Day)
    .CreateLogger();

try
{
    Log.Information("ETL Service başlatılıyor...");

    var builder = Host.CreateApplicationBuilder(args);
    
    builder.Services.AddHostedService<ETLWorker>();
    builder.Services.AddSingleton<ETLService>();
    
    builder.Services.AddSerilog();

    var host = builder.Build();
    host.Run();
}
catch (Exception ex)
{
    Log.Fatal(ex, "ETL Service başlatılamadı");
}
finally
{
    Log.CloseAndFlush();
}





