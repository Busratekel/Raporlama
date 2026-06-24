using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.Extensions.Options;
using Raporlama.API.Configuration;
using Raporlama.API.Services;
using Raporlama.API.Data;

namespace Raporlama.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class AuthorizationController : ControllerBase
    {
        private readonly ICustomAuthorizationService _authorizationService;
        private readonly IDatabaseService _databaseService;
        private readonly IAdminService _adminService;
        private readonly IDepartmentOptionsService _departmentOptionsService;
        private readonly PortalAuthOptions _portalOptions;
        private readonly ILogger<AuthorizationController> _logger;

        public AuthorizationController(
            ICustomAuthorizationService authorizationService,
            IDatabaseService databaseService,
            IAdminService adminService,
            IDepartmentOptionsService departmentOptionsService,
            IOptions<PortalAuthOptions> portalOptions,
            ILogger<AuthorizationController> logger)
        {
            _authorizationService = authorizationService;
            _databaseService = databaseService;
            _adminService = adminService;
            _departmentOptionsService = departmentOptionsService;
            _portalOptions = portalOptions.Value;
            _logger = logger;
        }

        [HttpGet("is-admin")]
        public IActionResult IsAdmin()
        {
            return Ok(new { isAdmin = _adminService.IsAdmin(GetCurrentUserName()) });
        }

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

        [HttpGet("default-report")]
        public async Task<IActionResult> GetDefaultReport(int? reportKey = null)
        {
            var userInfo = await _authorizationService.GetUserByUserNameAsync(GetCurrentUserName());
            if (userInfo == null || userInfo.UserKey == 0)
                return Ok(new { reportKey = (int?)null, filters = (string?)null });
            (int? rk, string? filters) = await _authorizationService.GetUserDefaultReportAsync(userInfo.UserKey, reportKey);
            return Ok(new { reportKey = rk, filters });
        }

        [HttpGet("has-access")]
        public async Task<IActionResult> HasAccess(int reportId)
        {
            var userName = GetCurrentUserName();
            var hasAccess = await _authorizationService.HasReportAccessAsync(reportId, userName);
            return Ok(new { hasAccess });
        }

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

        [HttpGet("mudurluk-options")]
        public async Task<IActionResult> GetMudurlukOptions()
        {
            if (!RequireAdmin(out var denied)) return denied!;
            try
            {
                var options = await _departmentOptionsService.GetMudurlukAdlariAsync();
                return Ok(options);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting mudurluk options");
                return StatusCode(500, new { error = ex.Message });
            }
        }

        [HttpGet("users")]
        public async Task<IActionResult> GetAllUsers()
        {
            if (!RequireAdmin(out var denied)) return denied!;
            try
            {
                var users = await _databaseService.QueryAsync<dynamic>(
                    "BellonaRapor",
                    "SELECT UserKey, UserName, DisplayName, Email, Groups, MudurlukAdi, Aktif as IsActive FROM [User] ORDER BY UserName"
                );
                return Ok(users);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting users");
                return StatusCode(500, new { error = ex.Message });
            }
        }

        [HttpPost("users")]
        public async Task<IActionResult> CreateUser([FromBody] CreateUserRequest request)
        {
            if (!RequireAdmin(out var denied)) return denied!;
            if (string.IsNullOrWhiteSpace(request.UserName))
                return BadRequest(new { error = "Kullanıcı adı gerekli." });

            var userName = NormalizeNewUserName(request.UserName.Trim());
            var displayName = string.IsNullOrWhiteSpace(request.DisplayName) ? userName : request.DisplayName.Trim();

            await _authorizationService.EnsureUserExistsAsync(userName, displayName, request.Email ?? "", "");
            var user = await _authorizationService.GetUserByUserNameAsync(userName);
            return Ok(user);
        }

        [HttpGet("reports/{reportKey}/metadata")]
        public async Task<IActionResult> GetReportMetadata(int reportKey)
        {
            if (!RequireAdmin(out var denied)) return denied!;
            var reports = await _databaseService.QueryAsync<dynamic>(
                "BellonaRapor",
                "SELECT ReportKey, ReportCode, ReportName, Url FROM [Report] WHERE ReportKey = @ReportKey",
                new { ReportKey = reportKey }
            );
            var report = reports.FirstOrDefault();
            if (report == null)
                return NotFound(new { error = "Rapor bulunamadı" });

            string code = report.ReportCode ?? "";
            string name = report.ReportName ?? "";
            string url = report.Url ?? "";
            var meta = ReportPermissionMetadata.Resolve(code, name, url);

            if (meta == null)
            {
                return Ok(new
                {
                    hasMetadata = false,
                    filterFields = Array.Empty<object>(),
                    columns = Array.Empty<object>()
                });
            }

            var filterFields = meta.FilterFields.Select(f => new
            {
                field = f,
                label = meta.FilterLabels.TryGetValue(f, out var lbl) ? lbl : f
            });
            var columns = meta.Columns.Select(c => new
            {
                field = c,
                label = meta.ColumnLabels.TryGetValue(c, out var lbl) ? lbl : c
            });

            return Ok(new { hasMetadata = true, filterFields, columns });
        }

        private string NormalizeNewUserName(string userName)
        {
            if (userName.Contains('\\'))
                return userName;
            if (!string.IsNullOrWhiteSpace(_portalOptions.UserNameDomain))
                return $"{_portalOptions.UserNameDomain}\\{userName}";
            return userName;
        }

        [HttpPatch("users/{userKey}/mudurluk-adi")]
        public async Task<IActionResult> SetUserMudurlukAdi(int userKey, [FromBody] SetUserMudurlukAdiRequest request)
        {
            if (!RequireAdmin(out var denied)) return denied!;
            try
            {
                var adi = string.IsNullOrWhiteSpace(request.MudurlukAdi)
                    ? null
                    : request.MudurlukAdi.Trim();

                await _databaseService.QueryAsync<int>(
                    "BellonaRapor",
                    "UPDATE [User] SET MudurlukAdi = @MudurlukAdi WHERE UserKey = @UserKey",
                    new { UserKey = userKey, MudurlukAdi = adi }
                );
                return Ok(new { message = "Müdürlük adı güncellendi", mudurlukAdi = adi });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating user mudurluk adi");
                return StatusCode(500, new { error = ex.Message });
            }
        }

        [HttpPatch("users/{userKey}/active")]
        public async Task<IActionResult> SetUserActive(int userKey, [FromBody] SetUserActiveRequest request)
        {
            if (!RequireAdmin(out var denied)) return denied!;
            try
            {
                await _databaseService.QueryAsync<int>(
                    "BellonaRapor",
                    "UPDATE [User] SET Aktif = @Aktif WHERE UserKey = @UserKey",
                    new { UserKey = userKey, Aktif = request.Aktif }
                );
                return Ok(new { message = "Kullanıcı durumu güncellendi" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating user active status");
                return StatusCode(500, new { error = ex.Message });
            }
        }

        [HttpGet("reports")]
        public async Task<IActionResult> GetAllReports()
        {
            if (!RequireAdmin(out var denied)) return denied!;
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

        [HttpPost("permissions")]
        public async Task<IActionResult> CreatePermission([FromBody] CreatePermissionRequest request)
        {
            if (!RequireAdmin(out var denied)) return denied!;
            try
            {
                var user = await _databaseService.QueryAsync<dynamic>(
                    "BellonaRapor",
                    "SELECT UserKey FROM [User] WHERE UserKey = @UserKey",
                    new { UserKey = request.UserKey }
                );
                if (!user.Any())
                    return BadRequest(new { error = "Kullanıcı bulunamadı" });

                var report = await _databaseService.QueryAsync<dynamic>(
                    "BellonaRapor",
                    "SELECT ReportKey FROM [Report] WHERE ReportKey = @ReportKey",
                    new { ReportKey = request.ReportKey }
                );
                if (!report.Any())
                    return BadRequest(new { error = "Rapor bulunamadı" });

                var existingPermission = await _databaseService.QueryAsync<dynamic>(
                    "BellonaRapor",
                    "SELECT PermissionKey FROM UserReportPermission WHERE UserKey = @UserKey AND ReportKey = @ReportKey",
                    new { UserKey = request.UserKey, ReportKey = request.ReportKey }
                );

                int permissionKeyId;
                if (existingPermission.Any())
                {
                    await _databaseService.QueryAsync<int>(
                        "BellonaRapor",
                        @"UPDATE UserReportPermission 
                          SET RowFilter = @RowFilter, Aktif = @Aktif, DepartmentFilterEnabled = @DepartmentFilterEnabled
                          WHERE UserKey = @UserKey AND ReportKey = @ReportKey",
                        new
                        {
                            UserKey = request.UserKey,
                            ReportKey = request.ReportKey,
                            RowFilter = request.RowFilter ?? "",
                            Aktif = request.Aktif,
                            DepartmentFilterEnabled = request.DepartmentFilterEnabled
                        }
                    );

                    var permissionKey = await _databaseService.QueryAsync<int>(
                        "BellonaRapor",
                        "SELECT PermissionKey FROM UserReportPermission WHERE UserKey = @UserKey AND ReportKey = @ReportKey",
                        new { UserKey = request.UserKey, ReportKey = request.ReportKey }
                    );
                    permissionKeyId = permissionKey.First();

                    await _databaseService.QueryAsync<int>(
                        "BellonaRapor",
                        "DELETE FROM PermissionColumn WHERE PermissionKey = @PermissionKey",
                        new { PermissionKey = permissionKeyId }
                    );
                }
                else
                {
                    var permissionKey = await _databaseService.QueryAsync<int>(
                        "BellonaRapor",
                        @"INSERT INTO UserReportPermission (UserKey, ReportKey, RowFilter, Aktif, DepartmentFilterEnabled) 
                          OUTPUT INSERTED.PermissionKey
                          VALUES (@UserKey, @ReportKey, @RowFilter, @Aktif, @DepartmentFilterEnabled)",
                        new
                        {
                            UserKey = request.UserKey,
                            ReportKey = request.ReportKey,
                            RowFilter = request.RowFilter ?? "",
                            Aktif = request.Aktif,
                            DepartmentFilterEnabled = request.DepartmentFilterEnabled
                        }
                    );
                    permissionKeyId = permissionKey.First();
                }

                if (request.Columns != null)
                {
                    foreach (var column in request.Columns.Where(c => !string.IsNullOrWhiteSpace(c)))
                    {
                        await _databaseService.QueryAsync<int>(
                            "BellonaRapor",
                            "INSERT INTO PermissionColumn (PermissionKey, ColumnName) VALUES (@PermissionKey, @ColumnName)",
                            new { PermissionKey = permissionKeyId, ColumnName = column.Trim() }
                        );
                    }
                }

                return Ok(new { message = "Yetki kaydedildi", permissionKey = permissionKeyId });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating permission");
                return StatusCode(500, new { error = ex.Message });
            }
        }

        [HttpGet("permissions/{userKey}")]
        public async Task<IActionResult> GetUserPermissions(int userKey)
        {
            if (!RequireAdmin(out var denied)) return denied!;
            try
            {
                var permissions = await _databaseService.QueryAsync<dynamic>(
                    "BellonaRapor",
                    @"SELECT p.PermissionKey, p.UserKey, p.ReportKey, p.RowFilter, p.Aktif, p.DepartmentFilterEnabled,
                             r.ReportCode, r.ReportName,
                             STRING_AGG(c.ColumnName, ',') as Columns
                      FROM UserReportPermission p
                      INNER JOIN [Report] r ON p.ReportKey = r.ReportKey
                      LEFT JOIN PermissionColumn c ON p.PermissionKey = c.PermissionKey
                      WHERE p.UserKey = @UserKey
                      GROUP BY p.PermissionKey, p.UserKey, p.ReportKey, p.RowFilter, p.Aktif, p.DepartmentFilterEnabled, r.ReportCode, r.ReportName
                      ORDER BY r.ReportName",
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

        [HttpDelete("permissions/{permissionKey}")]
        public async Task<IActionResult> DeletePermission(int permissionKey)
        {
            if (!RequireAdmin(out var denied)) return denied!;
            try
            {
                await _databaseService.QueryAsync<int>(
                    "BellonaRapor",
                    "DELETE FROM PermissionColumn WHERE PermissionKey = @PermissionKey",
                    new { PermissionKey = permissionKey }
                );
                await _databaseService.QueryAsync<int>(
                    "BellonaRapor",
                    "DELETE FROM UserReportPermission WHERE PermissionKey = @PermissionKey",
                    new { PermissionKey = permissionKey }
                );
                return Ok(new { message = "Yetki silindi" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting permission");
                return StatusCode(500, new { error = ex.Message });
            }
        }

        private bool RequireAdmin(out IActionResult? deniedResult)
        {
            if (_adminService.IsAdmin(GetCurrentUserName()))
            {
                deniedResult = null;
                return true;
            }
            deniedResult = StatusCode(403, new { error = "Bu işlem için yönetici yetkisi gerekli." });
            return false;
        }

        private string GetCurrentUserName()
        {
            if (User?.Identity == null)
                return "Unknown";
            return User.Identity.Name ?? "Unknown";
        }

        public class CreateUserRequest
        {
            public string UserName { get; set; } = string.Empty;
            public string? DisplayName { get; set; }
            public string? Email { get; set; }
        }

        public class SetDefaultReportRequest
        {
            public int ReportKey { get; set; }
            public object? Filters { get; set; }
        }

        public class SetUserMudurlukAdiRequest
        {
            public string? MudurlukAdi { get; set; }
        }

        public class SetUserActiveRequest
        {
            public bool Aktif { get; set; }
        }

        public class CreatePermissionRequest
        {
            public int UserKey { get; set; }
            public int ReportKey { get; set; }
            public string? RowFilter { get; set; }
            public bool Aktif { get; set; } = true;
            public bool DepartmentFilterEnabled { get; set; } = true;
            public List<string>? Columns { get; set; }
        }
    }
}
