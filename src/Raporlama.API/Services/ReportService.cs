using Raporlama.API.Models;
using Raporlama.API.Data;

namespace Raporlama.API.Services
{
    public interface IReportService
    {
        Task<IEnumerable<Report>> GetAllReportsAsync();
        Task<Report?> GetReportAsync(int reportId);
    }

    public class ReportService : IReportService
    {
        private readonly IDatabaseService _databaseService;
        private readonly ILogger<ReportService> _logger;
        // Hardcoded raporlar kaldırıldı, tüm raporlar veritabanından gelecek

        public ReportService(IDatabaseService databaseService, ILogger<ReportService> logger)
        {
            _databaseService = databaseService;
            _logger = logger;
        }

        public async Task<IEnumerable<Report>> GetAllReportsAsync()
        {
            // Tüm raporlar veritabanından gelecek
            var dbReports = await _databaseService.QueryAsync<dynamic>(
                "BellonaRapor",
                "SELECT ReportKey, ReportCode, ReportName, Aktif, Url, Query FROM [Report] WHERE Aktif = 1"
            );

            var reports = dbReports.Select(r => new Report
            {
                ReportID = r.ReportKey,
                ReportCode = r.ReportCode ?? "",
                ReportName = r.ReportName ?? "",
                IsActive = r.Aktif == true,
                Url = r.Url,
                SourceDatabase = "BellonaRapor",
                Query = r.Query ?? "",
                CacheDuration = 5
            }).ToList();

            return reports;
        }

        public async Task<Report?> GetReportAsync(int reportId)
        {
            // Tüm raporlar veritabanından gelecek
            var dbReport = await _databaseService.QueryAsync<dynamic>(
                "BellonaRapor",
                "SELECT ReportKey, ReportCode, ReportName, Aktif, Url, Query FROM [Report] WHERE ReportKey = @ReportKey AND Aktif = 1",
                new { ReportKey = reportId }
            );

            if (dbReport.Any())
            {
                var r = dbReport.First();
                return new Report
                {
                    ReportID = r.ReportKey,
                    ReportCode = r.ReportCode ?? "",
                    ReportName = r.ReportName ?? "",
                    IsActive = r.Aktif == true,
                    Url = r.Url,
                    SourceDatabase = "BellonaRapor",
                    Query = r.Query ?? "",
                    CacheDuration = 5
                };
            }

            return null;
        }
    }
}


