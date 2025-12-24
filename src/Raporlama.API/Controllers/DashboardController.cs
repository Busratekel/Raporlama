using Microsoft.AspNetCore.Mvc;
using Raporlama.API.Models;
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
        private readonly IReportService _reportService;

        public DashboardController(
            IDataSourceService dataSourceService,
            ILogger<DashboardController> logger,
            IReportService reportService)
        {
            _dataSourceService = dataSourceService;
            _logger = logger;
            _reportService = reportService;
        }
        // ...dashboard'a özel veya genel endpointler burada kalabilir...
    }
}



