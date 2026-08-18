using System.Net;
using System.Text;
using System.Xml.Linq;
using Microsoft.Extensions.Options;
using Raporlama.API.Configuration;

namespace Raporlama.API.Services;

public interface ISmsSender
{
    Task SendAsync(string phoneNumber, string message, CancellationToken cancellationToken = default);
}

public sealed class SmsSender : ISmsSender
{
    private readonly SmsOptions _options;
    private readonly LocalAuthOptions _localAuth;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IWebHostEnvironment _environment;
    private readonly ILogger<SmsSender> _logger;

    public SmsSender(
        IOptions<SmsOptions> options,
        IOptions<LocalAuthOptions> localAuth,
        IHttpClientFactory httpClientFactory,
        IWebHostEnvironment environment,
        ILogger<SmsSender> logger)
    {
        _options = options.Value;
        _localAuth = localAuth.Value;
        _httpClientFactory = httpClientFactory;
        _environment = environment;
        _logger = logger;
    }

    public async Task SendAsync(string phoneNumber, string message, CancellationToken cancellationToken = default)
    {
        var provider = (_options.Provider ?? "DevLog").Trim();

        if (ShouldUseDevLog(provider))
        {
            _logger.LogWarning("SMS (DevLog) → {Phone}: {Message}", MaskPhone(phoneNumber), message);
            return;
        }

        if (string.Equals(provider, "Turatel", StringComparison.OrdinalIgnoreCase))
        {
            await SendTuratelAsync(phoneNumber, message, cancellationToken);
            return;
        }

        if (string.Equals(provider, "Netgsm", StringComparison.OrdinalIgnoreCase))
        {
            await SendNetgsmAsync(phoneNumber, message, cancellationToken);
            return;
        }

        _logger.LogError("Bilinmeyen SMS provider: {Provider}", provider);
        throw new InvalidOperationException($"SMS provider yapılandırılmamış: {provider}");
    }

    private bool ShouldUseDevLog(string provider) =>
        string.Equals(provider, "DevLog", StringComparison.OrdinalIgnoreCase)
        || (_environment.IsDevelopment() && _localAuth.LogOtpInDevelopment);

    private async Task SendTuratelAsync(string phoneNumber, string message, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(_options.ApiUrl)
            || string.IsNullOrWhiteSpace(_options.UserCode)
            || string.IsNullOrWhiteSpace(_options.Password)
            || string.IsNullOrWhiteSpace(_options.ChannelCode))
        {
            throw new InvalidOperationException(
                "Turatel için Sms:ApiUrl, UserCode, Password ve ChannelCode gerekli.");
        }

        var gsm = FormatTuratelNumber(phoneNumber);
        var encodedMessage = WebUtility.HtmlEncode(message);
        var xml = $@"<?xml version=""1.0"" encoding=""utf-8""?>
<MainmsgBody>
<Command>0</Command>
<PlatformID>{EscapeXml(_options.PlatformId)}</PlatformID>
<ChannelCode>{EscapeXml(_options.ChannelCode)}</ChannelCode>
<UserName>{EscapeXml(_options.UserCode)}</UserName>
<PassWord>{EscapeXml(_options.Password)}</PassWord>
<Mesgbody>{encodedMessage}</Mesgbody>
<Numbers>{gsm}</Numbers>
<Type>1</Type>
<Originator>{EscapeXml(_options.Sender ?? "BELLONA")}</Originator>
</MainmsgBody>";

        var client = _httpClientFactory.CreateClient();
        using var content = new StringContent(xml, Encoding.UTF8, "application/xml");
        var response = await client.PostAsync(_options.ApiUrl.Trim(), content, cancellationToken);
        var body = await response.Content.ReadAsStringAsync(cancellationToken);

        if (!response.IsSuccessStatusCode)
        {
            _logger.LogError("Turatel HTTP {Status}: {Body}", response.StatusCode, body);
            throw new InvalidOperationException("SMS gönderilemedi.");
        }

        if (!IsTuratelSuccess(body))
        {
            _logger.LogError("Turatel hata yanıtı: {Body}", body);
            throw new InvalidOperationException("SMS sağlayıcısı mesajı reddetti.");
        }

        _logger.LogInformation("Turatel SMS gönderildi → {Phone}, yanıt: {Body}", MaskPhone(gsm), body);
    }

    private static bool IsTuratelSuccess(string body)
    {
        if (string.IsNullOrWhiteSpace(body))
            return true;

        try
        {
            var doc = XDocument.Parse(body);
            var errorCode = doc.Descendants()
                .FirstOrDefault(e => e.Name.LocalName.Equals("ErrorCode", StringComparison.OrdinalIgnoreCase))
                ?.Value?.Trim();
            if (string.IsNullOrEmpty(errorCode))
                return true;
            return errorCode == "0";
        }
        catch
        {
            var lower = body.ToLowerInvariant();
            if (lower.Contains("error") || lower.Contains("hata") || lower.Contains("fail"))
                return false;
            return true;
        }
    }

    private static string FormatTuratelNumber(string phone)
    {
        var normalized = PhoneNormalizer.Normalize(phone);
        if (normalized.StartsWith("90") && normalized.Length == 12)
            return normalized;
        if (normalized.Length == 10)
            return "90" + normalized;
        return normalized;
    }

    private static string EscapeXml(string value) =>
        new XText(value).ToString();

    private async Task SendNetgsmAsync(string phoneNumber, string message, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(_options.ApiUrl)
            || string.IsNullOrWhiteSpace(_options.UserCode)
            || string.IsNullOrWhiteSpace(_options.Password))
        {
            throw new InvalidOperationException("Netgsm için Sms:ApiUrl, UserCode, Password gerekli.");
        }

        var gsm = PhoneNormalizer.Normalize(phoneNumber);
        var url = $"{_options.ApiUrl.TrimEnd('/')}?usercode={Uri.EscapeDataString(_options.UserCode)}" +
                  $"&password={Uri.EscapeDataString(_options.Password)}" +
                  $"&gsmno={Uri.EscapeDataString(gsm)}" +
                  $"&message={Uri.EscapeDataString(message)}" +
                  $"&msgheader={Uri.EscapeDataString(_options.Sender ?? "BELLONA")}";

        var client = _httpClientFactory.CreateClient();
        var response = await client.GetAsync(url, cancellationToken);
        var body = await response.Content.ReadAsStringAsync(cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            _logger.LogError("Netgsm HTTP {Status}: {Body}", response.StatusCode, body);
            throw new InvalidOperationException("SMS gönderilemedi.");
        }

        _logger.LogInformation("Netgsm yanıt: {Body}", body);
    }

    private static string MaskPhone(string phone)
    {
        var digits = new string(phone.Where(char.IsDigit).ToArray());
        if (digits.Length < 4) return "****";
        return new string('*', digits.Length - 4) + digits[^4..];
    }
}
