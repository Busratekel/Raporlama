using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Raporlama.API.Services;
using System.Data;

namespace Raporlama.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class ReportsController : ControllerBase
    {
        private readonly IReportService _reportService;
        private readonly IDataSourceService _dataSourceService;
        private readonly ICustomAuthorizationService _authorizationService;
        private readonly ILogger<ReportsController> _logger;

        public ReportsController(
            IReportService reportService,
            IDataSourceService dataSourceService,
            ILogger<ReportsController> logger,
            ICustomAuthorizationService authorizationService)
        {
            _reportService = reportService;
            _dataSourceService = dataSourceService;
            _logger = logger;
            _authorizationService = authorizationService;
        }

        private string GetCurrentUserName()
        {
            try
            {
                if (User?.Identity == null)
                {
                    _logger.LogWarning("User.Identity is null in ReportsController");
                    return "Unknown";
                }

                return User.Identity.Name ?? "Unknown";
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting current user name");
                return "Unknown";
            }
        }

        [HttpGet]
        public async Task<IActionResult> GetAllReports()
        {
            try
            {
                var userName = GetCurrentUserName();

                if (userName == "Unknown")
                {
                    _logger.LogWarning("Unknown user trying to access reports");
                    return Unauthorized(new { error = "Kullanıcı kimliği alınamadı. Lütfen portaldan giriş yapın." });
                }

                var allReports = await _reportService.GetAllReportsAsync();
                var accessibleReportIds = await _authorizationService.GetUserAccessibleReportIdsAsync(userName);
                var accessibleIdsSet = accessibleReportIds.ToHashSet();
                var accessibleReports = allReports.Where(r => accessibleIdsSet.Contains(r.ReportID)).ToList();

                _logger.LogInformation("User {UserName} has access to {Count} reports", userName, accessibleReports.Count);

                return Ok(accessibleReports);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting reports");
                return StatusCode(500, new { error = ex.Message });
            }
        }

        [HttpGet("{reportId}/data")]
        public async Task<IActionResult> GetReportData(int reportId)
        {
            try
            {
                var userName = GetCurrentUserName();

                var hasAccess = await _authorizationService.HasReportAccessAsync(reportId, userName);
                if (!hasAccess)
                {
                    return StatusCode(403, new { error = $"Bu rapora erişim yetkiniz yok. (Rapor {reportId})" });
                }

                var data = await _dataSourceService.GetReportDataAsync(reportId, userName, null);
                return Ok(ConvertDataTableToJson(data));
            }
            catch (UnauthorizedAccessException ex)
            {
                _logger.LogWarning(ex, "Unauthorized access attempt for report {ReportId}", reportId);
                return StatusCode(403, new { error = ex.Message });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting report data for {ReportId}", reportId);
                return StatusCode(500, new { error = ex.Message });
            }
        }

        private static object ConvertDataTableToJson(DataTable dataTable)
        {
            var columns = dataTable.Columns.Cast<DataColumn>()
                .Select(c => new { name = c.ColumnName, type = c.DataType.Name })
                .ToList();

            var rows = dataTable.Rows.Cast<DataRow>()
                .Select(row => dataTable.Columns.Cast<DataColumn>()
                    .ToDictionary(col => col.ColumnName, col => row[col] == DBNull.Value ? null : row[col]))
                .ToList();

            return new
            {
                columns,
                data = rows,
                rowCount = rows.Count
            };
        }
    }
}
