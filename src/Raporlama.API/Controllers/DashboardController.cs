using Microsoft.AspNetCore.Mvc;
using Raporlama.API.Services;
using System.Data;
using System.Linq;

namespace Raporlama.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class DashboardController : ControllerBase
    {
        private readonly IDataSourceService _dataSourceService;
        private readonly ILogger<DashboardController> _logger;

        public DashboardController(
            IDataSourceService dataSourceService,
            ILogger<DashboardController> logger)
        {
            _dataSourceService = dataSourceService;
            _logger = logger;
        }

        /// <summary>
        /// Dashboard için veri kaynağı listesi
        /// </summary>
        [HttpGet("datasources")]
        public IActionResult GetDataSources()
        {
            var dataSources = new[]
            {
                new
                {
                    id = "ds_bekleyen_surecler",
                    name = "Bekleyen Süreçler",
                    endpoint = "/api/dashboard/data/bekleyen-surecler"
                }
            };

            return Ok(dataSources);
        }

        /// <summary>
        /// Bekleyen süreçler verisi
        /// </summary>
        [HttpGet("data/bekleyen-surecler")]
        public async Task<IActionResult> GetBekleyenSureclerData()
        {
            try
            {
                var data = await _dataSourceService.GetReportDataAsync(2, null);
                return Ok(ConvertDataTableToDevExpressFormat(data));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting bekleyen surecler data");
                return StatusCode(500, new { error = ex.Message });
            }
        }

        [HttpGet("data/bekleyen-surecler/charts")]
        public async Task<IActionResult> GetBekleyenSureclerCharts()
        {
            try
            {
                var dt = await _dataSourceService.GetReportDataAsync(2, null);

                var pie = ConvertToPieChart(dt, new[] { "FormuDolduranSicil" });
                var bar = ConvertToBarChart(dt, new[] { "FormuBekletenSicil" });
                var line = ConvertToLineChart(dt, new[] { "EklenmeTarihi" }, new[] { "BekleyenGun" });

                return Ok(new { pie, bar, line });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting bekleyen surecler charts");
                return StatusCode(500, new { error = ex.Message });
            }
        }
        private object ConvertDataTableToDevExpressFormat(System.Data.DataTable dataTable)
        {
            var rows = dataTable.Rows.Cast<System.Data.DataRow>()
                .Select(row => dataTable.Columns.Cast<System.Data.DataColumn>()
                    .ToDictionary(col => col.ColumnName, col => row[col] == DBNull.Value ? null : row[col]))
                .ToList();

            return rows;
        }

        // --- Chart conversion helpers ---
        private object ConvertToPieChart(DataTable dt, string[] groupColumnCandidates)
        {
            var rows = dt.Rows.Cast<DataRow>();
            var groups = rows
                .GroupBy(r => GetStringValue(r, groupColumnCandidates))
                .Select(g => new { category = g.Key, value = g.Count() })
                .OrderByDescending(x => x.value)
                .ToList();
            return groups;
        }

        private object ConvertToBarChart(DataTable dt, string[] groupColumnCandidates)
        {
            var rows = dt.Rows.Cast<DataRow>();
            var groups = rows
                .GroupBy(r => GetStringValue(r, groupColumnCandidates))
                .Select(g => new { category = g.Key, value = g.Count() })
                .OrderByDescending(x => x.value)
                .Take(20)
                .ToList();
            return groups;
        }

        private object ConvertToLineChart(DataTable dt, string[] dateColumnCandidates, string[] valueColumnCandidates)
        {
            var rows = dt.Rows.Cast<DataRow>();

            var grouped = rows
                .Select(r => new
                {
                    Date = GetDateValue(r, dateColumnCandidates)?.Date,
                    Value = GetIntValue(r, valueColumnCandidates)
                })
                .Where(x => x.Date.HasValue)
                .GroupBy(x => x.Date!.Value)
                .Select(g => new { date = g.Key.ToString("yyyy-MM-dd"), value = g.Sum(x => x.Value) })
                .OrderBy(x => x.date)
                .ToList();

            return grouped;
        }

        private string GetStringValue(DataRow row, string[] candidates)
        {
            foreach (var c in candidates)
            {
                if (row.Table.Columns.Contains(c))
                {
                    var v = row[c];
                    if (v == DBNull.Value || v == null) return "Unknown";
                    return v?.ToString() ?? "Unknown";
                }
            }
            return "Unknown";
        }

        private DateTime? GetDateValue(DataRow row, string[] candidates)
        {
            foreach (var c in candidates)
            {
                if (row.Table.Columns.Contains(c))
                {
                    var v = row[c];
                    if (v == DBNull.Value || v == null) continue;
                    if (v is DateTime dt) return dt;
                    if (DateTime.TryParse(v.ToString(), out var parsed)) return parsed;
                }
            }
            return null;
        }

        private int GetIntValue(DataRow row, string[] candidates)
        {
            foreach (var c in candidates)
            {
                if (row.Table.Columns.Contains(c))
                {
                    var v = row[c];
                    if (v == DBNull.Value || v == null) continue;
                    if (v is int i) return i;
                    if (int.TryParse(v.ToString(), out var parsed)) return parsed;
                }
            }
            return 0;
        }
    }
}



