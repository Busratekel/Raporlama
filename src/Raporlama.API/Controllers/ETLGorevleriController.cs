using Microsoft.AspNetCore.Mvc;

using Raporlama.API.Models;

using Raporlama.API.Services;

using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;



namespace Raporlama.API.Controllers

{

    [ApiController]

    [Route("api/[controller]")]

    public class ETLGorevleriController : ControllerBase

    {

        private readonly ETLGorevService _service;

        private readonly IConfiguration _configuration;

        private readonly IAdminService _adminService;

        private readonly IHttpClientFactory _httpClientFactory;

        private readonly ILogger<ETLGorevleriController> _logger;



        public ETLGorevleriController(

            ETLGorevService service,

            IConfiguration configuration,

            IAdminService adminService,

            IHttpClientFactory httpClientFactory,

            ILogger<ETLGorevleriController> logger)

        {

            _service = service;

            _configuration = configuration;

            _adminService = adminService;

            _httpClientFactory = httpClientFactory;

            _logger = logger;

        }



        [HttpGet("logs")]
        public async Task<IActionResult> GetETLLogs(string? date = null)
        {
            var raw = Request.Query.ContainsKey("raw");

            try
            {
                if (!RequireAdmin(out var denied)) return denied!;

                // Canlı: IIS disk izni gerekmez — ETL servisi (5010) kendi logunu okur
                var fromEtlService = await TryFetchLogsFromEtlServiceAsync(date);
                if (!string.IsNullOrEmpty(fromEtlService))
                {
                    if (raw)
                        return Content(fromEtlService, "text/plain; charset=utf-8");
                    return Ok(ParseStructuredLogs(fromEtlService));
                }

                var logFile = EtlPathHelper.FindLatestLogFileFromCandidates(_configuration, date);
                var logDir = logFile != null
                    ? Path.GetDirectoryName(logFile)
                    : EtlPathHelper.ResolveLogDirectory(_configuration);

                if (logFile == null)
                {
                    var searchReport = EtlPathHelper.DescribeLogSearch(_configuration);

                    if (raw)
                    {
                        var hint = $"ETL log dosyası bulunamadı veya okunamadı.\n\n{searchReport}\n\n" +
                            "Kontrol:\n" +
                            "1. IIS appsettings.json → ETL:LogDirectory = ETL servisinin logs klasörü (ETL appsettings ile aynı yol)\n" +
                            "2. IIS app pool hesabına o klasörde Okuma yetkisi verin\n" +
                            "3. App pool recycle edin";

                        return Content(hint, "text/plain; charset=utf-8");
                    }

                    return Ok(new List<object>());
                }

                if (raw)
                {
                    var text = EtlPathHelper.ReadLogTail(logFile);
                    var header = $"# Dosya: {logFile}\n# Klasör: {logDir}\n\n";
                    return Content(header + text, "text/plain; charset=utf-8");
                }

                return Ok(ParseStructuredLogs(EtlPathHelper.ReadLogTail(logFile)));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "ETL log endpoint hatası");
                if (raw)
                {
                    return Content(
                        $"Log okuma hatası: {ex.Message}\n\n" +
                        "ETL servisi: " + EtlPathHelper.GetEtlServiceUrl(_configuration) + "/api/etl/logs?raw=1\n" +
                        EtlPathHelper.DescribeLogSearch(_configuration),
                        "text/plain; charset=utf-8");
                }
                return StatusCode(500, new { error = ex.Message });
            }
        }

        private async Task<string?> TryFetchLogsFromEtlServiceAsync(string? date)
        {
            try
            {
                var baseUrl = EtlPathHelper.GetEtlServiceUrl(_configuration);
                var url = $"{baseUrl}/api/etl/logs?raw=1";
                if (!string.IsNullOrWhiteSpace(date))
                    url += $"&date={Uri.EscapeDataString(date)}";

                var client = _httpClientFactory.CreateClient();
                client.Timeout = TimeSpan.FromSeconds(20);
                using var response = await client.GetAsync(url);
                if (!response.IsSuccessStatusCode)
                {
                    _logger.LogWarning("ETL log HTTP {StatusCode}: {Url}", (int)response.StatusCode, url);
                    return null;
                }

                return await response.Content.ReadAsStringAsync();
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "ETL servisinden log alınamadı");
                return null;
            }
        }

        private static List<object> ParseStructuredLogs(string logText)
        {
            var lines = logText.Split(new[] { '\r', '\n' }, StringSplitOptions.RemoveEmptyEntries);
            var regex = new System.Text.RegularExpressions.Regex(@"ETL Görevi (Başladı|Bitti): (.+) \((.+)\) \| (Başlangıç|Bitiş): ([0-9\-: ]+)( \| Çekilen Kayıt: (\d+))?");

            return lines
                .Select(l => regex.Match(l))
                .Where(m => m.Success)
                .Select(m => (object)new {
                    Status = m.Groups[1].Value,
                    TaskName = m.Groups[2].Value,
                    Table = m.Groups[3].Value,
                    TimeType = m.Groups[4].Value,
                    Time = m.Groups[5].Value,
                    RecordCount = m.Groups[7].Success ? m.Groups[7].Value : null
                })
                .ToList();
        }



        [HttpGet]

        public async Task<ActionResult<IEnumerable<EtlGorevListDto>>> GetAll()

        {

            if (!RequireAdmin(out var denied)) return denied!;

            var result = await _service.GetAllAsync();

            return Ok(result.Select(EtlGorevListDto.From));

        }



        [HttpGet("{id}")]

        public async Task<ActionResult<EtlGorevListDto>> Get(int id)

        {

            if (!RequireAdmin(out var denied)) return denied!;

            var gorev = await _service.GetByIdAsync(id);

            if (gorev == null) return NotFound();

            return Ok(EtlGorevListDto.From(gorev));

        }



        [HttpPost]

        public async Task<ActionResult> Create([FromBody] ETLGorev gorev)

        {

            if (!RequireAdmin(out var denied)) return denied!;

            await _service.CreateAsync(gorev);

            return Ok();

        }



        [HttpPut("{id}")]

        public async Task<ActionResult> Update(int id, [FromBody] ETLGorev gorev)

        {

            if (!RequireAdmin(out var denied)) return denied!;

            var updated = await _service.UpdateAsync(id, gorev);

            if (!updated) return NotFound();

            return Ok();

        }



        [HttpDelete("{id}")]

        public async Task<ActionResult> Delete(int id)

        {

            if (!RequireAdmin(out var denied)) return denied!;

            var deleted = await _service.DeleteAsync(id);

            if (!deleted) return NotFound();

            return Ok();

        }



        [HttpPost("run/{id}")]

        public async Task<ActionResult> RunManually(int id)

        {

            if (!RequireAdmin(out var denied)) return denied!;

            var result = await _service.RunManuallyAsync(id);

            return Ok(result);

        }



        private bool RequireAdmin(out ActionResult? deniedResult)

        {

            if (_adminService.IsAdmin(User.Identity?.Name))

            {

                deniedResult = null;

                return true;

            }



            deniedResult = StatusCode(403, new { error = "Bu işlem için yönetici yetkisi gerekir." });

            return false;

        }

    }

}


