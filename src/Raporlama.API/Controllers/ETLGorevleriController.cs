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
        [HttpGet("logs")]
        public IActionResult GetETLLogs(string? date = null)
        {
            // Workspace kökünden mutlak yol
            var workspaceRoot = System.IO.Path.GetFullPath(System.IO.Path.Combine(AppContext.BaseDirectory, "..", "..", "..", ".."));
            var logDir = System.IO.Path.Combine(workspaceRoot, "Raporlama.ETL", "logs");
            var logFile = date == null
                ? System.IO.Directory.GetFiles(logDir, "etl-*.txt").OrderByDescending(f => f).FirstOrDefault()
                : System.IO.Path.Combine(logDir, $"etl-{date}.txt");
            if (logFile == null || !System.IO.File.Exists(logFile))
                return StatusCode(200, new List<object>()); // Boş JSON dizi döndür
            try
            {
                // raw=1 parametresi varsa ham metin döndür
                if (Request.Query.ContainsKey("raw"))
                {
                    using (var fs = new System.IO.FileStream(logFile, System.IO.FileMode.Open, System.IO.FileAccess.Read, System.IO.FileShare.ReadWrite))
                    using (var sr = new System.IO.StreamReader(fs))
                    {
                        var text = sr.ReadToEnd();
                        return Content(text, "text/plain; charset=utf-8");
                    }
                }
                string[] lines;
                using (var fs = new System.IO.FileStream(logFile, System.IO.FileMode.Open, System.IO.FileAccess.Read, System.IO.FileShare.ReadWrite))
                using (var sr = new System.IO.StreamReader(fs))
                {
                    var allText = sr.ReadToEnd();
                    lines = allText.Split(new[] { '\r', '\n' }, System.StringSplitOptions.RemoveEmptyEntries);
                }
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
            catch (System.Exception ex)
            {
                return StatusCode(500, new { error = ex.Message });
            }
        }
    
        private readonly ETLGorevService _service;
        public ETLGorevleriController(ETLGorevService service)
        {
            _service = service;
        }

        [HttpGet]
        public async Task<ActionResult<IEnumerable<ETLGorev>>> GetAll()
        {
            var result = await _service.GetAllAsync();
            return Ok(result);
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<ETLGorev>> Get(int id)
        {
            var gorev = await _service.GetByIdAsync(id);
            if (gorev == null) return NotFound();
            return Ok(gorev);
        }

        [HttpPost]
        public async Task<ActionResult> Create([FromBody] ETLGorev gorev)
        {
            await _service.CreateAsync(gorev);
            return Ok();
        }

        [HttpPut("{id}")]
        public async Task<ActionResult> Update(int id, [FromBody] ETLGorev gorev)
        {
            var updated = await _service.UpdateAsync(id, gorev);
            if (!updated) return NotFound();
            return Ok();
        }

        [HttpDelete("{id}")]
        public async Task<ActionResult> Delete(int id)
        {
            var deleted = await _service.DeleteAsync(id);
            if (!deleted) return NotFound();
            return Ok();
        }

        [HttpPost("run/{id}")]
        public async Task<ActionResult> RunManually(int id)
        {
            var result = await _service.RunManuallyAsync(id);
            return Ok(result);
        }
    }
}
