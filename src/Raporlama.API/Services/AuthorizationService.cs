using Raporlama.API.Data;

namespace Raporlama.API.Services
{
    public interface ICustomAuthorizationService
    {
        Task<UserInfo> GetCurrentUserAsync();
        Task<UserInfo> GetUserByUserNameAsync(string userName);
        Task<bool> HasReportAccessAsync(int reportId, string userName);
        Task<IEnumerable<int>> GetUserAccessibleReportIdsAsync(string userName);
        Task EnsureUserExistsAsync(string userName, string displayName, string email, string groups);
        Task SetUserDefaultReportAsync(int userKey, int reportKey, string? filtersJson = null);
        Task<(int? ReportKey, string? Filters)> GetUserDefaultReportAsync(int userKey, int? reportKey = null);
    }

    public class UserInfo
    {
        public int UserKey { get; set; }
        public string UserName { get; set; } = string.Empty;
        public string DisplayName { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string Groups { get; set; } = string.Empty;
        public string? MudurlukAdi { get; set; }
        public List<string> MudurlukAdlari { get; set; } = new();
        public bool IsActive { get; set; }
        public string? CepTelefonu { get; set; }
        public string? Sicil { get; set; }
    }
    public class AuthorizationService : ICustomAuthorizationService
    {
        private readonly IDatabaseService _databaseService;
        private readonly IUserMudurlukService _userMudurlukService;
        private readonly IHttpContextAccessor _httpContextAccessor;
        private readonly ILogger<AuthorizationService> _logger;

        public AuthorizationService(
            IDatabaseService databaseService,
            IUserMudurlukService userMudurlukService,
            IHttpContextAccessor httpContextAccessor,
            ILogger<AuthorizationService> logger)
        {
            _databaseService = databaseService;
            _userMudurlukService = userMudurlukService;
            _httpContextAccessor = httpContextAccessor;
            _logger = logger;
        }

        // Kullanıcı için varsayılan raporı kaydet
        public async Task SetUserDefaultReportAsync(int userKey, int reportKey, string? filtersJson = null)
        {
            // ReportKey 0 veya null ise kayıt eklenmesin
            if (reportKey <= 0) return;
            // Önce varsa eski kaydı sil
            await _databaseService.QueryAsync<int>(
                "BellonaRapor",
                "DELETE FROM UserDefaultReport WHERE UserKey = @UserKey AND ReportKey = @ReportKey",
                new { UserKey = userKey, ReportKey = reportKey }
            );
            // Sonra yeni kaydı ekle
            await _databaseService.QueryAsync<int>(
                "BellonaRapor",
                "INSERT INTO UserDefaultReport (UserKey, ReportKey, CreatedAt, Filters) VALUES (@UserKey, @ReportKey, GETDATE(), @Filters)",
                new { UserKey = userKey, ReportKey = reportKey, Filters = filtersJson ?? "" }
            );
        }

        // Kullanıcının varsayılan raporunu getir
        public async Task<(int? ReportKey, string? Filters)> GetUserDefaultReportAsync(int userKey, int? reportKey = null)
        {
            var result = await _databaseService.QueryAsync<dynamic>(
                "BellonaRapor",
                "SELECT TOP 1 ReportKey, Filters FROM UserDefaultReport WHERE UserKey = @UserKey" + (reportKey.HasValue ? " AND ReportKey = @ReportKey" : "") + " ORDER BY CreatedAt DESC",
                new { UserKey = userKey, ReportKey = reportKey }
            );
            var row = result.FirstOrDefault();
            if (row == null) return (null, null);
            return ((int?)row.ReportKey, (string?)row.Filters);
        }

        public async Task<UserInfo> GetCurrentUserAsync()
        {
            var userName = GetCurrentUserName();
            return await GetUserByUserNameAsync(userName);
        }

        public async Task<UserInfo> GetUserByUserNameAsync(string userName)
        {
            var userInfo = await FindUserByLoginAsync(userName, requireActive: false);
            if (userInfo != null)
                return userInfo;

            await EnsureUserExistsAsync(userName, userName, "", "");

            userInfo = await FindUserByLoginAsync(userName, requireActive: false);
            return userInfo ?? new UserInfo { UserName = userName };
        }

        /// <summary>
        /// Portal/Windows farklı format gönderebilir (BUSRA.TEKEL vs BELLONA\busra.tekel).
        /// Mevcut kullanıcıyı büyük/küçük harf ve domain bağımsız bulur.
        /// </summary>
        private async Task<UserInfo?> FindUserByLoginAsync(string userName, bool requireActive)
        {
            if (string.IsNullOrWhiteSpace(userName) || userName == "Unknown")
                return null;

            var loginName = userName.Contains('\\')
                ? userName[(userName.IndexOf('\\') + 1)..]
                : userName;

            var activeClause = requireActive ? " AND Aktif = 1" : "";

            var users = await _databaseService.QueryAsync<UserInfo>(
                "BellonaRapor",
                $@"SELECT TOP 1 UserKey, UserName, DisplayName, Email, Groups, MudurlukAdi, CepTelefonu, Sicil, Aktif as IsActive
                   FROM [User]
                   WHERE (
                       UserName COLLATE SQL_Latin1_General_CP1_CI_AS = @UserName
                       OR (
                           CHARINDEX('\', UserName) > 0
                           AND SUBSTRING(UserName, CHARINDEX('\', UserName) + 1, 4000) COLLATE SQL_Latin1_General_CP1_CI_AS = @LoginName
                       )
                       OR UserName COLLATE SQL_Latin1_General_CP1_CI_AS = @LoginName
                   ){activeClause}
                   ORDER BY UserKey",
                new { UserName = userName, LoginName = loginName }
            );

            var found = users.FirstOrDefault();
            if (found != null)
            {
                var mudurlukAdlari = await _userMudurlukService.GetMudurlukAdlariAsync(found.UserKey, found.MudurlukAdi);
                found.MudurlukAdlari = mudurlukAdlari.ToList();
                found.MudurlukAdi = mudurlukAdlari.Count > 0 ? mudurlukAdlari[0] : found.MudurlukAdi;
                _logger.LogInformation("Kullanıcı eşleşti: aranan={Searched}, bulunan={Found}, UserKey={UserKey}",
                    userName, found.UserName, found.UserKey);
            }

            return found;
        }

        private string GetCurrentUserName()
        {
            var httpContext = _httpContextAccessor.HttpContext;
            
            if (httpContext == null)
            {
                _logger.LogWarning("HttpContext is null");
                return "Unknown";
            }

            if (httpContext.User?.Identity == null)
            {
                _logger.LogWarning("User.Identity is null. IsAuthenticated: {IsAuthenticated}", httpContext.User?.Identity?.IsAuthenticated);
                return "Unknown";
            }

            // WindowsIdentity veya cookie (portal SSO) kimliği
            if (!string.IsNullOrWhiteSpace(httpContext.User.Identity.Name))
            {
                _logger.LogInformation("Authenticated user: {UserName}", httpContext.User.Identity.Name);
                return httpContext.User.Identity.Name;
            }

            return "Unknown";
        }

        public async Task<bool> HasReportAccessAsync(int reportId, string userName)
        {
            try
            {
                var userInfo = await FindUserByLoginAsync(userName, requireActive: true);
                if (userInfo == null)
                    return false;

                // Raporun aktif olup olmadığını kontrol et
                var report = await _databaseService.QueryAsync<dynamic>(
                    "BellonaRapor",
                    "SELECT ReportKey FROM [Report] WHERE ReportKey = @ReportKey AND Aktif = 1",
                    new { ReportKey = reportId }
                );

                if (!report.Any())
                    return false;

                // Kullanıcının bu rapora yetkisi var mı?
                var permission = await _databaseService.QueryAsync<dynamic>(
                    "BellonaRapor",
                    @"SELECT PermissionKey FROM UserReportPermission 
                      WHERE UserKey = @UserKey AND ReportKey = @ReportKey AND Aktif = 1",
                    new { UserKey = userInfo.UserKey, ReportKey = reportId }
                );

                return permission.Any();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error checking report access for user {UserName} and report {ReportId}", userName, reportId);
                return false;
            }
        }

        public async Task<IEnumerable<int>> GetUserAccessibleReportIdsAsync(string userName)
        {
            try
            {
                var userInfo = await FindUserByLoginAsync(userName, requireActive: true);
                if (userInfo == null)
                    return Enumerable.Empty<int>();

                var reportIds = await _databaseService.QueryAsync<int>(
                    "BellonaRapor",
                    @"SELECT DISTINCT p.ReportKey 
                      FROM UserReportPermission p
                      INNER JOIN [Report] r ON p.ReportKey = r.ReportKey
                      WHERE p.UserKey = @UserKey AND p.Aktif = 1 AND r.Aktif = 1",
                    new { UserKey = userInfo.UserKey }
                );

                return reportIds;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting accessible reports for user {UserName}", userName);
                return Enumerable.Empty<int>();
            }
        }

        public async Task EnsureUserExistsAsync(string userName, string displayName, string email, string groups)
        {
            try
            {
                var existing = await FindUserByLoginAsync(userName, requireActive: false);
                if (existing != null)
                {
                    await _databaseService.QueryAsync<int>(
                        "BellonaRapor",
                        "UPDATE [User] SET Groups = @Groups, DisplayName = @DisplayName WHERE UserKey = @UserKey",
                        new { UserKey = existing.UserKey, DisplayName = displayName, Groups = groups }
                    );
                    return;
                }

                var userExists = await _databaseService.QueryAsync<int>(
                    "BellonaRapor",
                    "SELECT COUNT(*) FROM [User] WHERE UserName = @UserName",
                    new { UserName = userName }
                );

                if (userExists.FirstOrDefault() == 0)
                {
                    await _databaseService.QueryAsync<int>(
                        "BellonaRapor",
                        "INSERT INTO [User] (UserName, DisplayName, Email, Aktif, Groups) VALUES (@UserName, @DisplayName, @Email, 1, @Groups)",
                        new { UserName = userName, DisplayName = displayName, Email = email, Groups = groups }
                    );
                    _logger.LogInformation("User created: {UserName}", userName);
                }
                else
                {
                    // Kullanıcı varsa grupları güncelle
                    await _databaseService.QueryAsync<int>(
                        "BellonaRapor",
                        "UPDATE [User] SET Groups = @Groups, DisplayName = @DisplayName WHERE UserName = @UserName",
                        new { UserName = userName, DisplayName = displayName, Groups = groups }
                    );
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error ensuring user exists: {UserName}", userName);
                throw;
            }
        }
    }
}

