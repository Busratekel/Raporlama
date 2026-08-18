using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Raporlama.API.Services;

namespace Raporlama.API.Controllers;

[ApiController]
[Route("api/push")]
[Authorize]
public class PushController : ControllerBase
{
    private readonly IPushNotificationService _pushService;
    private readonly ICustomAuthorizationService _authorizationService;
    private readonly ILogger<PushController> _logger;

    public PushController(
        IPushNotificationService pushService,
        ICustomAuthorizationService authorizationService,
        ILogger<PushController> logger)
    {
        _pushService = pushService;
        _authorizationService = authorizationService;
        _logger = logger;
    }

    [HttpGet("config")]
    public IActionResult GetConfig()
    {
        return Ok(new
        {
            enabled = _pushService.IsEnabled,
            publicKey = _pushService.PublicKey
        });
    }

    [HttpGet("status")]
    public async Task<IActionResult> GetStatus(CancellationToken cancellationToken)
    {
        var user = await _authorizationService.GetUserByUserNameAsync(User.Identity?.Name ?? "");
        if (user.UserKey == 0)
            return Unauthorized(new { error = "Kullanıcı bulunamadı." });

        var subscribed = await _pushService.HasSubscriptionAsync(user.UserKey, cancellationToken);
        var unreadCount = await _pushService.GetUnreadCountAsync(user.UserKey, cancellationToken);
        var pushNotificationsEnabled = await _pushService.IsPushEnabledForUserAsync(user.UserKey, cancellationToken);
        return Ok(new
        {
            enabled = _pushService.IsEnabled,
            subscribed,
            publicKey = _pushService.PublicKey,
            unreadCount,
            pushNotificationsEnabled
        });
    }

    [HttpGet("preferences")]
    public async Task<IActionResult> GetPreferences(CancellationToken cancellationToken)
    {
        var user = await _authorizationService.GetUserByUserNameAsync(User.Identity?.Name ?? "");
        if (user.UserKey == 0)
            return Unauthorized(new { error = "Kullanıcı bulunamadı." });

        var pushNotificationsEnabled = await _pushService.IsPushEnabledForUserAsync(user.UserKey, cancellationToken);
        var subscribed = await _pushService.HasSubscriptionAsync(user.UserKey, cancellationToken);
        return Ok(new
        {
            pushNotificationsEnabled,
            browserSubscribed = subscribed,
            serverPushEnabled = _pushService.IsEnabled
        });
    }

    [HttpPut("preferences")]
    public async Task<IActionResult> SetPreferences(
        [FromBody] PushPreferencesRequest request,
        CancellationToken cancellationToken)
    {
        var user = await _authorizationService.GetUserByUserNameAsync(User.Identity?.Name ?? "");
        if (user.UserKey == 0)
            return Unauthorized(new { error = "Kullanıcı bulunamadı." });

        await _pushService.SetPushEnabledForUserAsync(user.UserKey, request.PushNotificationsEnabled, cancellationToken);
        return Ok(new
        {
            success = true,
            pushNotificationsEnabled = request.PushNotificationsEnabled
        });
    }

    [HttpGet("inbox")]
    public async Task<IActionResult> GetInbox([FromQuery] int limit = 30, CancellationToken cancellationToken = default)
    {
        var user = await _authorizationService.GetUserByUserNameAsync(User.Identity?.Name ?? "");
        if (user.UserKey == 0)
            return Unauthorized(new { error = "Kullanıcı bulunamadı." });

        var items = await _pushService.GetInboxAsync(user.UserKey, limit, cancellationToken);
        var unreadCount = await _pushService.GetUnreadCountAsync(user.UserKey, cancellationToken);
        return Ok(new { unreadCount, items });
    }

    [HttpPost("inbox/{notificationKey:int}/read")]
    public async Task<IActionResult> MarkRead(int notificationKey, CancellationToken cancellationToken)
    {
        var user = await _authorizationService.GetUserByUserNameAsync(User.Identity?.Name ?? "");
        if (user.UserKey == 0)
            return Unauthorized(new { error = "Kullanıcı bulunamadı." });

        await _pushService.MarkAsReadAsync(user.UserKey, notificationKey, cancellationToken);
        var unreadCount = await _pushService.GetUnreadCountAsync(user.UserKey, cancellationToken);
        return Ok(new { success = true, unreadCount });
    }

    [HttpPost("inbox/read-all")]
    public async Task<IActionResult> MarkAllRead(CancellationToken cancellationToken)
    {
        var user = await _authorizationService.GetUserByUserNameAsync(User.Identity?.Name ?? "");
        if (user.UserKey == 0)
            return Unauthorized(new { error = "Kullanıcı bulunamadı." });

        await _pushService.MarkAllAsReadAsync(user.UserKey, cancellationToken);
        return Ok(new { success = true, unreadCount = 0 });
    }

    [HttpPost("subscribe")]
    public async Task<IActionResult> Subscribe(
        [FromBody] PushSubscriptionRequest request,
        CancellationToken cancellationToken)
    {
        if (!_pushService.IsEnabled)
            return BadRequest(new { error = "Push bildirimleri yapılandırılmamış." });

        var user = await _authorizationService.GetUserByUserNameAsync(User.Identity?.Name ?? "");
        if (user.UserKey == 0)
            return Unauthorized(new { error = "Kullanıcı bulunamadı." });

        try
        {
            await _pushService.SaveSubscriptionAsync(user.UserKey, request, cancellationToken);
            return Ok(new { success = true });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Push aboneliği kaydedilemedi.");
            return StatusCode(500, new { error = ex.Message });
        }
    }

    [HttpPost("unsubscribe")]
    public async Task<IActionResult> Unsubscribe(
        [FromBody] UnsubscribeRequest request,
        CancellationToken cancellationToken)
    {
        var user = await _authorizationService.GetUserByUserNameAsync(User.Identity?.Name ?? "");
        if (user.UserKey == 0)
            return Unauthorized(new { error = "Kullanıcı bulunamadı." });

        await _pushService.RemoveSubscriptionAsync(user.UserKey, request.Endpoint ?? "", cancellationToken);
        return Ok(new { success = true });
    }

    public sealed class UnsubscribeRequest
    {
        public string? Endpoint { get; set; }
    }

    public sealed class PushPreferencesRequest
    {
        public bool PushNotificationsEnabled { get; set; }
    }
}
