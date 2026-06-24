using Microsoft.AspNetCore.Mvc;

using Raporlama.API.Models;

using Raporlama.API.Services;

using System.Collections.Generic;

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

        private readonly ILogger<ETLGorevleriController> _logger;



        public ETLGorevleriController(

            ETLGorevService service,

            IConfiguration configuration,

            IAdminService adminService,

            ILogger<ETLGorevleriController> logger)

        {

            _service = service;

            _configuration = configuration;

            _adminService = adminService;

            _logger = logger;

        }



        [HttpGet("logs")]

        public IActionResult GetETLLogs(string? date = null)

        {

            if (!RequireAdmin(out var denied)) return denied!;



            var logDir = EtlPathHelper.ResolveLogDirectory(_configuration);

            var logFile = EtlPathHelper.FindLatestLogFile(logDir, date);

            var raw = Request.Query.ContainsKey("raw");



            if (logFile == null)

            {

                var searched = string.Join("\n  - ", EtlPathHelper.BuildCandidatePaths(_configuration));

                if (raw)

                {

                    var hint = logDir == null

                        ? "ETL log klasörü bulunamadı.\n\nappsettings.json örneği:\n  \"ETL\": { \"LogDirectory\": \"C:\\\\Services\\\\Raporlama.ETL\\\\logs\" }\n\nAranan konumlar:\n  - " + searched

                        : $"ETL log dosyası henüz yok.\nKlasör: {logDir}\n\nETL servisini bir kez çalıştırın; etl-YYYYMMDD.txt oluşur.";

                    return Content(hint, "text/plain; charset=utf-8");

                }

                return Ok(new List<object>());

            }



            try

            {

                if (raw)

                {

                    var text = EtlPathHelper.ReadLogTail(logFile);

                    var header = $"# Dosya: {logFile}\n# Klasör: {logDir}\n\n";

                    return Content(header + text, "text/plain; charset=utf-8");

                }



                var lines = EtlPathHelper.ReadLogTail(logFile)

                    .Split(new[] { '\r', '\n' }, StringSplitOptions.RemoveEmptyEntries);



                var regex = new System.Text.RegularExpressions.Regex(@"ETL Görevi (Başladı|Bitti): (.+) \((.+)\) \| (Başlangıç|Bitiş): ([0-9\-: ]+)( \| Çekilen Kayıt: (\d+))?");

                var result = lines

                    .Select(l => regex.Match(l))

                    .Where(m => m.Success)

                    .Select(m => new {

                        Status = m.Groups[1].Value,

                        TaskName = m.Groups[2].Value,

                        Table = m.Groups[3].Value,

                        TimeType = m.Groups[4].Value,

                        Time = m.Groups[5].Value,

                        RecordCount = m.Groups[7].Success ? m.Groups[7].Value : null

                    })

                    .ToList();

                return Ok(result);

            }

            catch (Exception ex)

            {

                _logger.LogError(ex, "ETL log okunamadı. Klasör: {LogDir}, Dosya: {LogFile}", logDir, logFile);

                if (raw)

                {

                    return Content(

                        $"Log dosyası okunamadı: {ex.Message}\nDosya: {logFile}\nKlasör: {logDir}",

                        "text/plain; charset=utf-8");

                }

                return StatusCode(500, new { error = ex.Message, logDir, logFile });

            }

        }



        [HttpGet]

        public async Task<ActionResult<IEnumerable<ETLGorev>>> GetAll()

        {

            if (!RequireAdmin(out var denied)) return denied!;

            var result = await _service.GetAllAsync();

            return Ok(result);

        }



        [HttpGet("{id}")]

        public async Task<ActionResult<ETLGorev>> Get(int id)

        {

            if (!RequireAdmin(out var denied)) return denied!;

            var gorev = await _service.GetByIdAsync(id);

            if (gorev == null) return NotFound();

            return Ok(gorev);

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


