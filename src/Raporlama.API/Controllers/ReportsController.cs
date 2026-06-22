using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Raporlama.API.Services;
using Raporlama.API.Data;
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
                    return StatusCode(403, new { error = $"Bu rapora erişim yetkiniz yok. (Rapor {reportId})" });
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
         // Kullanıcının kendi kaydettiği raporu çalıştırır ve sonucunu döner
        [HttpGet("my/{id}/run")]
        public async Task<IActionResult> RunMyReport(int id)
{
    try
    {
        var userName = GetCurrentUserName();
        var query = "SELECT Tablo, Kolonlar FROM UserCustomReport WHERE Id = @Id AND UserName = @UserName";
        var rapor = (await _databaseService.QueryAsync<dynamic>("BellonaRapor", query, new { Id = id, UserName = userName })).FirstOrDefault();
        if (rapor == null)
            return NotFound(new { error = "Rapor bulunamadı veya size ait değil." });
        var tablo = rapor.Tablo as string;
        var kolonlar = (rapor.Kolonlar as string)?.Split(',') ?? new string[0];
        if (string.IsNullOrWhiteSpace(tablo) || kolonlar.Length == 0)
            return BadRequest(new { error = "Tablo veya kolonlar eksik." });
        var kolonSql = string.Join(",", kolonlar.Select(k => $"[{k}]").ToArray());
        var data = await _databaseService.QueryDataTableAsync("BellonaRapor", $"SELECT {kolonSql} FROM [{tablo}]", null);
        var columns = kolonlar;
        var rows = new List<Dictionary<string, object>>();
        foreach (System.Data.DataRow row in data.Rows)
        {
            var dict = new Dictionary<string, object>();
            foreach (var col in columns)
                dict[col] = row[col];
            rows.Add(dict);
        }
        return Ok(new { columns, data = rows });
    }
    catch (Exception ex)
    {
        _logger.LogError(ex, "Error running user's own report");
        return StatusCode(500, new { error = ex.Message });
    }
}
        // Kullanıcının kendi kaydettiği raporları döner
        [HttpGet("my")]
        public async Task<IActionResult> GetMyReports()
        {
            try
            {
                var userName = GetCurrentUserName();
                var query = @"SELECT Id, ReportName as RaporAdi, GrafikTipi, Tablo, Kolonlar, CreatedAt FROM UserCustomReport WHERE UserName = @UserName ORDER BY CreatedAt DESC";
                var raporlar = await _databaseService.QueryAsync<dynamic>("BellonaRapor", query, new { UserName = userName });
                return Ok(raporlar);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting user's own reports");
                return StatusCode(500, new { error = ex.Message });
            }
        }
        // Kullanıcıya tablo listesini döner
        [HttpGet("tables")]
        public async Task<IActionResult> GetTables()
        {
            try
            {
                var tables = await _databaseService.GetTableNamesAsync("BellonaRapor");
                return Ok(tables);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting table list");
                return StatusCode(500, new { error = ex.Message });
            }
        }

        // Kullanıcıya seçili tablonun kolonlarını döner
        [HttpGet("columns")]
        public async Task<IActionResult> GetColumns([FromQuery] string table)
        {
            try
            {
                var query = $"SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = @TableName ORDER BY ORDINAL_POSITION";
                var columns = await _databaseService.QueryAsync<string>("BellonaRapor", query, new { TableName = table });
                return Ok(columns);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting columns for table {Table}", table);
                return StatusCode(500, new { error = ex.Message });
            }
        }

        // Kullanıcıdan gelen custom raporu kaydeder
        [HttpPost("custom")]
        public async Task<IActionResult> SaveCustomReport([FromBody] CustomReportDto dto)
        {
            try
            {
                var query = @"INSERT INTO [UserCustomReport] (UserName, ReportName, GrafikTipi, Tablo, Kolonlar, Filters, CreatedAt)
                            VALUES (@UserName, @ReportName, @GrafikTipi, @Tablo, @Kolonlar, @Filters, GETDATE())";
                var userName = GetCurrentUserName();
                await _databaseService.QueryAsync<dynamic>("BellonaRapor", query, new {
                    UserName = userName,
                    ReportName = dto.RaporAdi,
                    GrafikTipi = dto.GrafikTipi,
                    Tablo = dto.Tablo,
                    Kolonlar = string.Join(",", dto.Kolonlar ?? new List<string>()),
                    Filters = "{}"
                });
                return Ok();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error saving custom report");
                return StatusCode(500, new { error = ex.Message });
            }
        }
        // Canlı önizleme için örnek veri döndürür
        [HttpGet("sample")]
        public async Task<IActionResult> GetSample([FromQuery] string table, [FromQuery] string columns)
        {
            if (string.IsNullOrWhiteSpace(table) || string.IsNullOrWhiteSpace(columns))
                return BadRequest("Tablo ve kolonlar zorunlu.");
            var kolonList = columns.Split(',').Select(k => k.Trim()).ToList();
            // Kolonları INFORMATION_SCHEMA.COLUMNS ile doğrula
            var validColumns = await _databaseService.QueryAsync<string>(
                "BellonaRapor",
                "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = @TableName",
                new { TableName = table }
            );
            var eksikKolonlar = kolonList.Where(k => !validColumns.Contains(k)).ToList();
            if (eksikKolonlar.Any())
                return BadRequest($"Tabloda bulunmayan kolon(lar): {string.Join(", ", eksikKolonlar)}");
            var kolonlar = kolonList.Select(k => $"[{k}]").ToArray();
            var kolonSql = string.Join(",", kolonlar);
            // Her kolon için IS NOT NULL filtresi ekle
            var notNullFilter = string.Join(" AND ", kolonList.Select(k => $"[{k}] IS NOT NULL"));
            var sql = $"SELECT TOP 20 {kolonSql} FROM [{table}]" + (notNullFilter.Length > 0 ? $" WHERE {notNullFilter}" : "");
            try
            {
                var data = await _databaseService.QueryDataTableAsync("BellonaRapor", sql, null);
                var rows = new List<Dictionary<string, object>>();
                foreach (System.Data.DataRow row in data.Rows)
                {
                    var dict = new Dictionary<string, object>();
                    foreach (var col in kolonlar)
                        dict[col.Trim('[', ']')] = row[col.Trim('[', ']')];
                    rows.Add(dict);
                }
                return Ok(rows);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Sample veri alınamadı");
                return BadRequest("Veri alınamadı: " + ex.Message);
            }
        }

        public class CustomReportDto
        {
            public string RaporAdi { get; set; }
            public string GrafikTipi { get; set; }
            public string Tablo { get; set; }
            public List<string> Kolonlar { get; set; }
        }
    }
}



