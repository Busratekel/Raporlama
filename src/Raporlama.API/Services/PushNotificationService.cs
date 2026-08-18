using System.Net;
using Microsoft.Extensions.Options;
using Raporlama.API.Configuration;
using Raporlama.API.Data;
using WebPush;

namespace Raporlama.API.Services;

public interface IPushNotificationService
{
    bool IsEnabled { get; }
    string? PublicKey { get; }
    Task SaveSubscriptionAsync(int userKey, PushSubscriptionRequest subscription, CancellationToken cancellationToken = default);
    Task RemoveSubscriptionAsync(int userKey, string endpoint, CancellationToken cancellationToken = default);
    Task<bool> HasSubscriptionAsync(int userKey, CancellationToken cancellationToken = default);
    Task<bool> IsPushEnabledForUserAsync(int userKey, CancellationToken cancellationToken = default);
    Task SetPushEnabledForUserAsync(int userKey, bool enabled, CancellationToken cancellationToken = default);
    Task NotifyUserAsync(int userKey, string title, string body, string? url = null, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<UserNotificationDto>> GetInboxAsync(int userKey, int limit = 30, CancellationToken cancellationToken = default);
    Task<int> GetUnreadCountAsync(int userKey, CancellationToken cancellationToken = default);
    Task MarkAsReadAsync(int userKey, int notificationKey, CancellationToken cancellationToken = default);
    Task MarkAllAsReadAsync(int userKey, CancellationToken cancellationToken = default);
}

public sealed class PushSubscriptionRequest
{
    public string Endpoint { get; set; } = "";
    public PushSubscriptionKeys Keys { get; set; } = new();
}

public sealed class PushSubscriptionKeys
{
    public string P256dh { get; set; } = "";
    public string Auth { get; set; } = "";
}

public sealed class UserNotificationDto
{
    public int NotificationKey { get; set; }
    public string Title { get; set; } = "";
    public string Body { get; set; } = "";
    public string Url { get; set; } = "/menu.html";
    public bool IsRead { get; set; }
    public DateTime CreatedAt { get; set; }
}

public sealed class PushNotificationService : IPushNotificationService
{
    private readonly PushOptions _options;
    private readonly IDatabaseService _databaseService;
    private readonly ILogger<PushNotificationService> _logger;

    public PushNotificationService(
        IOptions<PushOptions> options,
        IDatabaseService databaseService,
        ILogger<PushNotificationService> logger)
    {
        _options = options.Value;
        _databaseService = databaseService;
        _logger = logger;
    }

    public bool IsEnabled =>
        _options.Enabled
        && !string.IsNullOrWhiteSpace(_options.VapidPublicKey)
        && !string.IsNullOrWhiteSpace(_options.VapidPrivateKey);

    public string? PublicKey => IsEnabled ? _options.VapidPublicKey.Trim() : null;

    public async Task SaveSubscriptionAsync(
        int userKey,
        PushSubscriptionRequest subscription,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(subscription.Endpoint)
            || string.IsNullOrWhiteSpace(subscription.Keys.P256dh)
            || string.IsNullOrWhiteSpace(subscription.Keys.Auth))
        {
            throw new ArgumentException("Geçersiz push aboneliği.");
        }

        await _databaseService.QueryAsync<int>(
            "BellonaRapor",
            @"MERGE PushSubscription AS target
              USING (SELECT @UserKey AS UserKey, @Endpoint AS Endpoint) AS source
              ON target.UserKey = source.UserKey AND target.Endpoint = source.Endpoint
              WHEN MATCHED THEN
                UPDATE SET P256dh = @P256dh, Auth = @Auth
              WHEN NOT MATCHED THEN
                INSERT (UserKey, Endpoint, P256dh, Auth)
                VALUES (@UserKey, @Endpoint, @P256dh, @Auth);",
            new
            {
                UserKey = userKey,
                Endpoint = subscription.Endpoint.Trim(),
                P256dh = subscription.Keys.P256dh.Trim(),
                Auth = subscription.Keys.Auth.Trim()
            });
    }

    public async Task RemoveSubscriptionAsync(
        int userKey,
        string endpoint,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(endpoint)) return;

        await _databaseService.QueryAsync<int>(
            "BellonaRapor",
            "DELETE FROM PushSubscription WHERE UserKey = @UserKey AND Endpoint = @Endpoint",
            new { UserKey = userKey, Endpoint = endpoint.Trim() });
    }

    public async Task<bool> HasSubscriptionAsync(int userKey, CancellationToken cancellationToken = default)
    {
        var rows = await _databaseService.QueryAsync<int>(
            "BellonaRapor",
            "SELECT COUNT(1) FROM PushSubscription WHERE UserKey = @UserKey",
            new { UserKey = userKey });
        return rows.FirstOrDefault() > 0;
    }

    public async Task<bool> IsPushEnabledForUserAsync(int userKey, CancellationToken cancellationToken = default)
    {
        try
        {
            var rows = await _databaseService.QueryAsync<bool?>(
                "BellonaRapor",
                "SELECT PushBildirimleriAcik FROM [User] WHERE UserKey = @UserKey",
                new { UserKey = userKey });
            var value = rows.FirstOrDefault();
            return value ?? true;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "PushBildirimleriAcik okunamadı — varsayılan açık (UserKey={UserKey})", userKey);
            return true;
        }
    }

    public async Task SetPushEnabledForUserAsync(
        int userKey,
        bool enabled,
        CancellationToken cancellationToken = default)
    {
        await _databaseService.QueryAsync<int>(
            "BellonaRapor",
            "UPDATE [User] SET PushBildirimleriAcik = @Enabled WHERE UserKey = @UserKey",
            new { UserKey = userKey, Enabled = enabled });

        if (!enabled)
        {
            await _databaseService.QueryAsync<int>(
                "BellonaRapor",
                "DELETE FROM PushSubscription WHERE UserKey = @UserKey",
                new { UserKey = userKey });
        }
    }

    public async Task NotifyUserAsync(
        int userKey,
        string title,
        string body,
        string? url = null,
        CancellationToken cancellationToken = default)
    {
        var safeUrl = ReportUrlNormalizer.Normalize(url);
        var notificationKey = await SaveInboxNotificationAsync(userKey, title, body, safeUrl, cancellationToken);

        if (!await IsPushEnabledForUserAsync(userKey, cancellationToken))
        {
            _logger.LogDebug("Kullanıcı push kapalı — inbox kaydedildi (UserKey={UserKey})", userKey);
            return;
        }

        if (!IsEnabled)
        {
            _logger.LogDebug("Push kapalı — inbox kaydedildi, push gönderilmedi (UserKey={UserKey})", userKey);
            return;
        }

        var subs = await _databaseService.QueryAsync<PushSubscriptionRow>(
            "BellonaRapor",
            "SELECT SubscriptionKey, Endpoint, P256dh, Auth FROM PushSubscription WHERE UserKey = @UserKey",
            new { UserKey = userKey });

        if (!subs.Any()) return;

        var payload = System.Text.Json.JsonSerializer.Serialize(new
        {
            notificationId = notificationKey,
            title,
            body,
            url = safeUrl
        });

        var vapid = new VapidDetails(
            _options.Subject.Trim(),
            _options.VapidPublicKey.Trim(),
            _options.VapidPrivateKey.Trim());

        var client = new WebPushClient();

        foreach (var sub in subs)
        {
            try
            {
                var pushSub = new PushSubscription(sub.Endpoint, sub.P256dh, sub.Auth);
                await client.SendNotificationAsync(pushSub, payload, vapid, cancellationToken);
            }
            catch (WebPushException ex) when (ex.StatusCode == HttpStatusCode.Gone
                                              || ex.StatusCode == HttpStatusCode.NotFound)
            {
                _logger.LogInformation("Geçersiz push aboneliği siliniyor: {Endpoint}", sub.Endpoint);
                await RemoveSubscriptionAsync(userKey, sub.Endpoint, cancellationToken);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Push gönderilemedi (UserKey={UserKey})", userKey);
            }
        }
    }

    public async Task<IReadOnlyList<UserNotificationDto>> GetInboxAsync(
        int userKey,
        int limit = 30,
        CancellationToken cancellationToken = default)
    {
        limit = Math.Clamp(limit, 1, 100);
        var rows = await _databaseService.QueryAsync<UserNotificationDto>(
            "BellonaRapor",
            @"SELECT TOP (@Limit) NotificationKey, Title, Body, Url, IsRead, CreatedAt
              FROM UserNotification
              WHERE UserKey = @UserKey
              ORDER BY CreatedAt DESC",
            new { UserKey = userKey, Limit = limit });
        var list = rows.ToList();
        foreach (var item in list)
            item.Url = ReportUrlNormalizer.Normalize(item.Url);
        return list;
    }

    public async Task<int> GetUnreadCountAsync(int userKey, CancellationToken cancellationToken = default)
    {
        var rows = await _databaseService.QueryAsync<int>(
            "BellonaRapor",
            "SELECT COUNT(1) FROM UserNotification WHERE UserKey = @UserKey AND IsRead = 0",
            new { UserKey = userKey });
        return rows.FirstOrDefault();
    }

    public async Task MarkAsReadAsync(int userKey, int notificationKey, CancellationToken cancellationToken = default)
    {
        await _databaseService.QueryAsync<int>(
            "BellonaRapor",
            @"UPDATE UserNotification
              SET IsRead = 1, ReadAt = SYSDATETIME()
              WHERE NotificationKey = @NotificationKey AND UserKey = @UserKey AND IsRead = 0",
            new { NotificationKey = notificationKey, UserKey = userKey });
    }

    public async Task MarkAllAsReadAsync(int userKey, CancellationToken cancellationToken = default)
    {
        await _databaseService.QueryAsync<int>(
            "BellonaRapor",
            @"UPDATE UserNotification
              SET IsRead = 1, ReadAt = SYSDATETIME()
              WHERE UserKey = @UserKey AND IsRead = 0",
            new { UserKey = userKey });
    }

    private async Task<int> SaveInboxNotificationAsync(
        int userKey,
        string title,
        string body,
        string url,
        CancellationToken cancellationToken)
    {
        var keys = await _databaseService.QueryAsync<int>(
            "BellonaRapor",
            @"INSERT INTO UserNotification (UserKey, Title, Body, Url)
              OUTPUT INSERTED.NotificationKey
              VALUES (@UserKey, @Title, @Body, @Url)",
            new
            {
                UserKey = userKey,
                Title = Truncate(title, 200),
                Body = Truncate(body, 500),
                Url = Truncate(url, 512)
            });
        return keys.First();
    }

    private static string Truncate(string value, int maxLen) =>
        value.Length <= maxLen ? value : value[..maxLen];

    private sealed class PushSubscriptionRow
    {
        public int SubscriptionKey { get; set; }
        public string Endpoint { get; set; } = "";
        public string P256dh { get; set; } = "";
        public string Auth { get; set; } = "";
    }
}
