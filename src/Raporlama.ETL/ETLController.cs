using Microsoft.AspNetCore.Mvc;
using System.Threading.Tasks;

namespace Raporlama.ETL
{
    [ApiController]
    [Route("api/etl")]
    public class ETLController : ControllerBase
    {
        private readonly ETLService _etlService;
        public ETLController(ETLService etlService)
        {
            _etlService = etlService;
        }

        [HttpPost("run/{id}")]
        public async Task<IActionResult> RunManually(int id)
        {
            try
            {
                var result = await _etlService.RunTaskManuallyAsync(id);
                return Ok(result);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { error = ex.Message });
            }
        }

        /// <summary>ETL kendi log dosyasını okur (localhost — IIS disk izni gerekmez).</summary>
        [HttpGet("logs")]
        public IActionResult GetLogs(string? date = null)
        {
            try
            {
                var logDir = _etlService.GetLogDirectory();
                var logFile = _etlService.FindLatestLogFile(date);
                if (logFile == null)
                {
                    return Content(
                        $"ETL log dosyası yok.\nKlasör: {logDir}\nVar mı: {Directory.Exists(logDir)}",
                        "text/plain; charset=utf-8");
                }

                var text = ETLService.ReadLogTail(logFile);
                var header = $"# Kaynak: ETL servisi\n# Dosya: {logFile}\n# Klasör: {logDir}\n\n";
                return Content(header + text, "text/plain; charset=utf-8");
            }
            catch (Exception ex)
            {
                return Content($"ETL log okunamadı: {ex.Message}", "text/plain; charset=utf-8");
            }
        }
    }
}
