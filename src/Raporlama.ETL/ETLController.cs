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
    }
}
