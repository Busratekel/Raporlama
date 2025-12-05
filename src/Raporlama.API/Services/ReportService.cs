using Raporlama.API.Models;

namespace Raporlama.API.Services
{
    public interface IReportService
    {
        Task<IEnumerable<Report>> GetAllReportsAsync();
        Task<Report?> GetReportAsync(int reportId);
        Task<Report> CreateReportAsync(Report report);
    }

    public class ReportService : IReportService
    {
        private readonly List<Report> _reports = new();

        public ReportService()
        {
            _reports.Add(new Report
            {
                ReportID = 1,
                ReportName = "Çalışanlar (örnek)",
                ReportCode = "RPT_CALISANLAR",
                SourceDatabase = "BoytasWH",
                Query = "SELECT TOP 100 1 AS Dummy",
                DataSourceType = null,
                CacheDuration = 5,
                IsActive = true
            });
            
            _reports.Add(new Report
            {
                ReportID = 2,
                ReportName = "Bekleyen Süreçler",
                ReportCode = "RPT_BEKLEYEN",
                SourceDatabase = "BellonaRapor",
                Query = "SELECT * FROM Fact_BekleyenSurecler ORDER BY BekleyenGun DESC",
                DataSourceType = null,
                CacheDuration = 5,
                IsActive = true,
                Description = "VIEW'dan Fact tablosuna kopyalanmış bekleyen süreçler (3656 kayıt)"
            });
        }

        public Task<IEnumerable<Report>> GetAllReportsAsync()
        {
            return Task.FromResult(_reports.AsEnumerable());
        }

        public Task<Report?> GetReportAsync(int reportId)
        {
            var report = _reports.FirstOrDefault(r => r.ReportID == reportId);
            return Task.FromResult(report);
        }

        public Task<Report> CreateReportAsync(Report report)
        {
            report.ReportID = _reports.Count + 1;
            _reports.Add(report);
            return Task.FromResult(report);
        }
    }
}


