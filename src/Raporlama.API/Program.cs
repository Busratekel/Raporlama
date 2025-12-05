using Raporlama.API.Services;
using Raporlama.API.Data;
using DevExpress.AspNetCore;
using DevExpress.DashboardWeb;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll", policy =>
    {
        policy.AllowAnyOrigin().AllowAnyMethod().AllowAnyHeader();
    });
});

builder.Services.AddMemoryCache();
builder.Services.AddScoped<IDatabaseService, DatabaseService>();
builder.Services.AddScoped<IReportService, ReportService>();
builder.Services.AddScoped<IDataSourceService, DataSourceService>();

// DevExpress Dashboard
builder.Services.AddDevExpressControls();

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

// DevExpress
app.UseDevExpressControls();

// Static files (wwwroot)
app.UseStaticFiles();

// Default page
app.MapGet("/", () => Results.Redirect("/index.html"));

app.UseCors("AllowAll");
app.UseAuthorization();
app.MapControllers();

app.Run();



