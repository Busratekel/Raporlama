using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using System.Security.Principal;

namespace Raporlama.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class AuthTestController : ControllerBase
    {
        private readonly ILogger<AuthTestController> _logger;

        public AuthTestController(ILogger<AuthTestController> logger)
        {
            _logger = logger;
        }
        [HttpGet("status")]
        public IActionResult GetAuthStatus()
        {
            var result = new
            {
                IsAuthenticated = User.Identity?.IsAuthenticated ?? false,
                AuthenticationType = User.Identity?.AuthenticationType,
                UserName = User.Identity?.Name ?? "Not authenticated",
                IsWindowsIdentity = User.Identity is WindowsIdentity,
                WindowsIdentityName = (User.Identity as WindowsIdentity)?.Name,
                Claims = User.Claims.Select(c => new { c.Type, c.Value }).ToList()
            };

            _logger.LogInformation("Auth status check - IsAuthenticated: {IsAuthenticated}, UserName: {UserName}", 
                result.IsAuthenticated, result.UserName);

            return Ok(result);
        }

        [HttpGet("protected")]
        [Authorize]
        public IActionResult GetProtectedInfo()
        {
            var result = new
            {
                Message = "Bu endpoint'e sadece giriş yapmış kullanıcılar erişebilir",
                IsAuthenticated = User.Identity?.IsAuthenticated ?? false,
                UserName = User.Identity?.Name ?? "Unknown",
                IsWindowsIdentity = User.Identity is WindowsIdentity,
                WindowsIdentityName = (User.Identity as WindowsIdentity)?.Name
            };

            return Ok(result);
        }
    }
}

