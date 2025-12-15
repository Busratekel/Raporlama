using Raporlama.API.Services;
using Raporlama.API.Data;
using DevExpress.AspNetCore;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// Active Directory (Windows) Authentication
builder.Services.AddAuthentication("Negotiate")
    .AddNegotiate();

// Authorization policy - tüm authenticated kullanıcılar erişebilir
builder.Services.AddAuthorization(options =>
{
    options.FallbackPolicy = options.DefaultPolicy;
});

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll", policy =>
    {
        // Windows Authentication için credentials gerekli
        policy.WithOrigins("http://localhost:5000", "http://localhost:3000", "http://localhost:8080")
              .AllowAnyMethod()
              .AllowAnyHeader()
              .AllowCredentials(); // Windows Authentication için gerekli
    });
});

builder.Services.AddMemoryCache();
builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<IDatabaseService, DatabaseService>();
builder.Services.AddScoped<IReportService, ReportService>();
builder.Services.AddScoped<ICustomAuthorizationService, AuthorizationService>();
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
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

app.Run();



