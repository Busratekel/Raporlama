using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Raporlama.API.Services;
using Raporlama.API.Data;
using System.Data;
using System.Security.Principal;

namespace Raporlama.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class ReportsController : ControllerBase
    {
        private readonly IReportService _reportService;
        private readonly IDataSourceService _dataSourceService;
        private readonly Services.ICustomAuthorizationService _authorizationService;
        private readonly IDatabaseService _databaseService;
        private readonly ILogger<ReportsController> _logger;

        public ReportsController(
            IReportService reportService,
            IDataSourceService dataSourceService,
            IDatabaseService databaseService,
            ILogger<ReportsController> logger,
            Services.ICustomAuthorizationService authorizationService)
        {
            _reportService = reportService;
            _dataSourceService = dataSourceService;
            _databaseService = databaseService;
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

                if (User.Identity is WindowsIdentity identity)
                {
                    return identity.Name ?? "Unknown";
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
                    return Unauthorized(new { error = "Kullanıcı kimliği alınamadı. Lütfen Windows Authentication ile giriş yapın." });
                }

                var allReports = await _reportService.GetAllReportsAsync();
                
                // Kullanıcının erişebileceği rapor ID'lerini al
                var accessibleReportIds = await _authorizationService.GetUserAccessibleReportIdsAsync(userName);
                var accessibleIdsSet = accessibleReportIds.ToHashSet();

                // Sadece yetkili raporları filtrele
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

        [HttpGet("{reportId}")]
        public async Task<IActionResult> GetReport(int reportId)
        {
            try
            {
                var userName = GetCurrentUserName();
                
                // Kullanıcının bu rapora erişim yetkisi var mı?
                var hasAccess = await _authorizationService.HasReportAccessAsync(reportId, userName);
                if (!hasAccess)
                {
                    return Forbid($"User {userName} does not have access to report {reportId}");
                }

                var report = await _reportService.GetReportAsync(reportId);
                if (report == null)
                    return NotFound(new { error = $"Report {reportId} not found" });

                return Ok(report);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting report {ReportId}", reportId);
                return StatusCode(500, new { error = ex.Message });
            }
        }

        [HttpGet("{reportId}/data")]
        public async Task<IActionResult> GetReportData(int reportId)
        {
            try
            {
                var userName = GetCurrentUserName();
                
                // Kullanıcının bu rapora erişim yetkisi var mı?
                var hasAccess = await _authorizationService.HasReportAccessAsync(reportId, userName);
                if (!hasAccess)
                {
                    return Forbid($"User {userName} does not have access to report {reportId}");
                }

                var data = await _dataSourceService.GetReportDataAsync(reportId, userName, null);
                return Ok(ConvertDataTableToJson(data));
            }
            catch (UnauthorizedAccessException ex)
            {
                _logger.LogWarning(ex, "Unauthorized access attempt for report {ReportId}", reportId);
                return Forbid(ex.Message);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting report data for {ReportId}", reportId);
                return StatusCode(500, new { error = ex.Message });
            }
        }

        [HttpGet("test-connection/{databaseName}")]
        public async Task<IActionResult> TestConnection(string databaseName)
        {
            try
            {
                var isConnected = await _databaseService.TestConnectionAsync(databaseName);
                return Ok(new { database = databaseName, connected = isConnected });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error testing connection for {DatabaseName}", databaseName);
                return StatusCode(500, new { error = ex.Message });
            }
        }

        [HttpGet("tables/{databaseName}")]
        public async Task<IActionResult> GetTables(string databaseName)
        {
            try
            {
                var tables = await _databaseService.GetTableNamesAsync(databaseName);
                return Ok(tables);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting tables for {DatabaseName}", databaseName);
                return StatusCode(500, new { error = ex.Message });
            }
        }

        private object ConvertDataTableToJson(DataTable dataTable)
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
                columns = columns,
                data = rows,
                rowCount = rows.Count
            };
        }
    }
}



