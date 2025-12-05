using Microsoft.AspNetCore.Mvc;
using Raporlama.API.Services;
using Raporlama.API.Data;
using System.Data;

namespace Raporlama.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class ReportsController : ControllerBase
    {
        private readonly IReportService _reportService;
        private readonly IDataSourceService _dataSourceService;
        private readonly IDatabaseService _databaseService;
        private readonly ILogger<ReportsController> _logger;

        public ReportsController(
            IReportService reportService,
            IDataSourceService dataSourceService,
            IDatabaseService databaseService,
            ILogger<ReportsController> logger)
        {
            _reportService = reportService;
            _dataSourceService = dataSourceService;
            _databaseService = databaseService;
            _logger = logger;
        }

        [HttpGet]
        public async Task<IActionResult> GetAllReports()
        {
            try
            {
                var reports = await _reportService.GetAllReportsAsync();
                return Ok(reports);
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
                var data = await _dataSourceService.GetReportDataAsync(reportId, null);
                return Ok(ConvertDataTableToJson(data));
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



