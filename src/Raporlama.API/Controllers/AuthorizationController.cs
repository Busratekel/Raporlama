using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Raporlama.API.Services;
using Raporlama.API.Data;
using System.Security.Principal;

namespace Raporlama.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class AuthorizationController : ControllerBase
    {
        [HttpPost("default-report")]
            public async Task<IActionResult> SetDefaultReport([FromBody] SetDefaultReportRequest request)
            {
                var userInfo = await _authorizationService.GetUserByUserNameAsync(GetCurrentUserName());
                if (userInfo == null || userInfo.UserKey == 0)
                    return BadRequest(new { error = "Kullanıcı bulunamadı" });
                string? filtersJson = null;
                if (request.Filters != null)
                    filtersJson = System.Text.Json.JsonSerializer.Serialize(request.Filters);
                await _authorizationService.SetUserDefaultReportAsync(userInfo.UserKey, request.ReportKey, filtersJson);
                return Ok(new { message = "Varsayılan rapor kaydedildi" });
            }
            /// Kullanıcının varsayılan raporunu döndürür
            [HttpGet("default-report")]
            public async Task<IActionResult> GetDefaultReport(int? reportKey = null)
            {
                var userInfo = await _authorizationService.GetUserByUserNameAsync(GetCurrentUserName());
                if (userInfo == null || userInfo.UserKey == 0)
                    return Ok(new { reportKey = (int?)null, filters = (string?)null });
                (int? rk, string? filters) = await _authorizationService.GetUserDefaultReportAsync(userInfo.UserKey, reportKey);
                return Ok(new { reportKey = rk, filters });
            }

            public class SetDefaultReportRequest
            {
                public int ReportKey { get; set; }
                public object? Filters { get; set; }
            }
        /// Kullanıcının bir rapora erişim yetkisi olup olmadığını döndürür
        [HttpGet("has-access")]
        public async Task<IActionResult> HasAccess(int reportId)
        {
            var userName = GetCurrentUserName();
            var hasAccess = await _authorizationService.HasReportAccessAsync(reportId, userName);
            return Ok(new { hasAccess });
        }
        private readonly Services.ICustomAuthorizationService _authorizationService;
        private readonly IDatabaseService _databaseService;
        private readonly ILogger<AuthorizationController> _logger;

        public AuthorizationController(
            Services.ICustomAuthorizationService authorizationService,
            IDatabaseService databaseService,
            ILogger<AuthorizationController> logger)
        {
            _authorizationService = authorizationService;
            _databaseService = databaseService;
            _logger = logger;
        }

        private string GetCurrentUserName()
        {
            try
            {
                if (User?.Identity == null)
                {
                    _logger.LogWarning("User.Identity is null in AuthorizationController");
                    return "Unknown";
                }

                if (User.Identity is WindowsIdentity identity)
                {
                    return identity.Name ?? "Unknown";
                }
                
                return User.Identity.Name ?? "Unknown";
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting current user name");
                return "Unknown";
            }
        }
        /// Mevcut kullanıcı bilgilerini döndürür
        [HttpGet("current-user")]
        public async Task<IActionResult> GetCurrentUser()
        {
            try
            {
                var userInfo = await _authorizationService.GetCurrentUserAsync();
                return Ok(userInfo);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting current user");
                return StatusCode(500, new { error = ex.Message });
            }
        }
        /// Kullanıcının erişebileceği rapor ID'lerini döndürür
        [HttpGet("accessible-reports")]
        public async Task<IActionResult> GetAccessibleReports()
        {
            try
            {
                var userName = GetCurrentUserName();
                var reportIds = await _authorizationService.GetUserAccessibleReportIdsAsync(userName);
                return Ok(reportIds);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting accessible reports");
                return StatusCode(500, new { error = ex.Message });
            }
        }
        /// Tüm kullanıcıları listeler (admin)
        [HttpGet("users")]
        public async Task<IActionResult> GetAllUsers()
        {
            try
            {
                var users = await _databaseService.QueryAsync<dynamic>(
                    "BellonaRapor",
                    "SELECT UserKey, UserName, DisplayName, Email, Groups, Aktif as IsActive FROM [User] ORDER BY UserName"
                );
                return Ok(users);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting users");
                return StatusCode(500, new { error = ex.Message });
            }
        }
        /// Tüm raporları listeler (admin)
        [HttpGet("reports")]
        public async Task<IActionResult> GetAllReports()
        {
            try
            {
                var reports = await _databaseService.QueryAsync<dynamic>(
                    "BellonaRapor",
                    "SELECT ReportKey, ReportCode, ReportName, Aktif FROM [Report] ORDER BY ReportName"
                );
                return Ok(reports);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting reports");
                return StatusCode(500, new { error = ex.Message });
            }
        }
        /// Kullanıcıya rapor yetkisi verir (admin)
        [HttpPost("permissions")]
        public async Task<IActionResult> CreatePermission([FromBody] CreatePermissionRequest request)
        {
            try
            {
                // Kullanıcı ve rapor var mı kontrol et
                var user = await _databaseService.QueryAsync<dynamic>(
                    "BellonaRapor",
                    "SELECT UserKey FROM [User] WHERE UserKey = @UserKey",
                    new { UserKey = request.UserKey }
                );

                if (!user.Any())
                {
                    return BadRequest(new { error = "User not found" });
                }

                var report = await _databaseService.QueryAsync<dynamic>(
                    "BellonaRapor",
                    "SELECT ReportKey FROM [Report] WHERE ReportKey = @ReportKey",
                    new { ReportKey = request.ReportKey }
                );

                if (!report.Any())
                {
                    return BadRequest(new { error = "Report not found" });
                }

                // Yetki var mı kontrol et
                var existingPermission = await _databaseService.QueryAsync<dynamic>(
                    "BellonaRapor",
                    "SELECT PermissionKey FROM UserReportPermission WHERE UserKey = @UserKey AND ReportKey = @ReportKey",
                    new { UserKey = request.UserKey, ReportKey = request.ReportKey }
                );

                if (existingPermission.Any())
                {
                    // Varsa güncelle
                    await _databaseService.QueryAsync<int>(
                        "BellonaRapor",
                        @"UPDATE UserReportPermission 
                          SET RowFilter = @RowFilter, Aktif = @Aktif 
                          WHERE UserKey = @UserKey AND ReportKey = @ReportKey",
                        new { UserKey = request.UserKey, ReportKey = request.ReportKey, RowFilter = request.RowFilter ?? "", Aktif = request.Aktif }
                    );

                    var permissionKey = await _databaseService.QueryAsync<int>(
                        "BellonaRapor",
                        "SELECT PermissionKey FROM UserReportPermission WHERE UserKey = @UserKey AND ReportKey = @ReportKey",
                        new { UserKey = request.UserKey, ReportKey = request.ReportKey }
                    );

                    // Kolon yetkilerini güncelle
                    if (request.Columns != null && request.Columns.Any())
                    {
                        // Önce mevcut kolonları sil
                        await _databaseService.QueryAsync<int>(
                            "BellonaRapor",
                            "DELETE FROM PermissionColumn WHERE PermissionKey = @PermissionKey",
                            new { PermissionKey = permissionKey.First() }
                        );

                        // Yeni kolonları ekle
                        foreach (var column in request.Columns)
                        {
                            await _databaseService.QueryAsync<int>(
                                "BellonaRapor",
                                "INSERT INTO PermissionColumn (PermissionKey, ColumnName) VALUES (@PermissionKey, @ColumnName)",
                                new { PermissionKey = permissionKey.First(), ColumnName = column }
                            );
                        }
                    }

                    return Ok(new { message = "Permission updated", PermissionKey = permissionKey.First() });
                }
                else
                {
                    // Yoksa oluştur
                    var permissionKey = await _databaseService.QueryAsync<int>(
                        "BellonaRapor",
                        @"INSERT INTO UserReportPermission (UserKey, ReportKey, RowFilter, Aktif) 
                          OUTPUT INSERTED.PermissionKey
                          VALUES (@UserKey, @ReportKey, @RowFilter, @Aktif)",
                        new { UserKey = request.UserKey, ReportKey = request.ReportKey, RowFilter = request.RowFilter ?? "", Aktif = request.Aktif }
                    );

                    var newPermissionKey = permissionKey.First();

                    // Kolon yetkilerini ekle
                    if (request.Columns != null && request.Columns.Any())
                    {
                        foreach (var column in request.Columns)
                        {
                            await _databaseService.QueryAsync<int>(
                                "BellonaRapor",
                                "INSERT INTO PermissionColumn (PermissionKey, ColumnName) VALUES (@PermissionKey, @ColumnName)",
                                new { PermissionKey = newPermissionKey, ColumnName = column }
                            );
                        }
                    }

                    return Ok(new { message = "Permission created", PermissionKey = newPermissionKey });
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating permission");
                return StatusCode(500, new { error = ex.Message });
            }
        }
        /// Kullanıcının rapor yetkilerini listeler
        [HttpGet("permissions/{userKey}")]
        public async Task<IActionResult> GetUserPermissions(int userKey)
        {
            try
            {
                var permissions = await _databaseService.QueryAsync<dynamic>(
                    "BellonaRapor",
                    @"SELECT p.PermissionKey, p.UserKey, p.ReportKey, p.RowFilter, p.Aktif,
                             r.ReportCode, r.ReportName,
                             STRING_AGG(c.ColumnName, ',') as Columns
                      FROM UserReportPermission p
                      INNER JOIN [Report] r ON p.ReportKey = r.ReportKey
                      LEFT JOIN PermissionColumn c ON p.PermissionKey = c.PermissionKey
                      WHERE p.UserKey = @UserKey
                      GROUP BY p.PermissionKey, p.UserKey, p.ReportKey, p.RowFilter, p.Aktif, r.ReportCode, r.ReportName",
                    new { UserKey = userKey }
                );
                return Ok(permissions);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting user permissions");
                return StatusCode(500, new { error = ex.Message });
            }
        }
        /// Yetkiyi siler (admin)
        [HttpDelete("permissions/{permissionKey}")]
        public async Task<IActionResult> DeletePermission(int permissionKey)
        {
            try
            {
                // Önce kolon yetkilerini sil
                await _databaseService.QueryAsync<int>(
                    "BellonaRapor",
                    "DELETE FROM PermissionColumn WHERE PermissionKey = @PermissionKey",
                    new { PermissionKey = permissionKey }
                );

                // Sonra yetkiyi sil
                await _databaseService.QueryAsync<int>(
                    "BellonaRapor",
                    "DELETE FROM UserReportPermission WHERE PermissionKey = @PermissionKey",
                    new { PermissionKey = permissionKey }
                );

                return Ok(new { message = "Permission deleted" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting permission");
                return StatusCode(500, new { error = ex.Message });
            }
        }
        public class CreatePermissionRequest
        {
            public int UserKey { get; set; }
            public int ReportKey { get; set; }
            public string? RowFilter { get; set; }
            public bool Aktif { get; set; } = true;
            public List<string>? Columns { get; set; }
        }
    }
}

