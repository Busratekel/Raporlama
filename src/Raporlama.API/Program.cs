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

// tüm authenticated kullanıcılar erişebilir
builder.Services.AddAuthorization(options =>
{
    options.FallbackPolicy = options.DefaultPolicy;
});

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll", policy =>
    {
        policy.WithOrigins("http://localhost:5000", "http://localhost:3000", "http://localhost:8080")
              .AllowAnyMethod()
              .AllowAnyHeader()
              .AllowCredentials();
    });
});

builder.Services.AddMemoryCache();
builder.Services.AddHttpContextAccessor();

builder.Services.AddScoped<IDatabaseService, DatabaseService>();
builder.Services.AddScoped<IReportService, ReportService>();
builder.Services.AddScoped<ICustomAuthorizationService, AuthorizationService>();
builder.Services.AddScoped<IDataSourceService, DataSourceService>();
builder.Services.AddScoped<ETLGorevService>();

builder.Services.AddDevExpressControls();

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseDevExpressControls();

app.UseStaticFiles();

app.MapGet("/", () => Results.Redirect("/menu.html"));

app.UseCors("AllowAll");
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

app.Run();



