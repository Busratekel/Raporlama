namespace Raporlama.API.Configuration;

public class LocalAuthOptions
{
    public const string SectionName = "LocalAuth";

    /// <summary>Dış giriş (kullanıcı adı + şifre + SMS) açık mı?</summary>
    public bool Enabled { get; set; } = true;

    /// <summary>Active Directory domain (örn. BELLONAAS).</summary>
    public string AdDomain { get; set; } = "BELLONAAS";

    /// <summary>OTP geçerlilik süresi (saniye).</summary>
    public int OtpExpirySeconds { get; set; } = 90;

    /// <summary>OTP maksimum yanlış deneme.</summary>
    public int OtpMaxAttempts { get; set; } = 3;

    /// <summary>OTP yeniden gönderme üst limiti (ilk SMS hariç).</summary>
    public int OtpMaxResends { get; set; } = 3;

    /// <summary>İki SMS gönderimi arası minimum bekleme (saniye).</summary>
    public int OtpResendCooldownSeconds { get; set; } = 30;

    /// <summary>Yeniden gönder oturumu (AD doğrulaması sonrası) geçerlilik süresi (dakika).</summary>
    public int OtpResendSessionMinutes { get; set; } = 10;

    /// <summary>Development ortamında SMS yerine log/consola yaz (OTP asla response'da dönmez).</summary>
    public bool LogOtpInDevelopment { get; set; } = true;

    /// <summary>Telefonu olmayan kullanıcı ilk girişte kendi numarasını kaydedebilir.</summary>
    public bool AllowSelfPhoneRegistration { get; set; } = true;
}

public class SmsOptions
{
    public const string SectionName = "Sms";

    /// <summary>Turatel, Netgsm, DevLog (geliştirme)</summary>
    public string Provider { get; set; } = "DevLog";

    public string? ApiUrl { get; set; }
    public string? UserCode { get; set; }
    public string? Password { get; set; }
    public string? Sender { get; set; }

    /// <summary>Turatel ChannelCode (örn. 583)</summary>
    public string? ChannelCode { get; set; }

    /// <summary>Turatel PlatformID (varsayılan 1)</summary>
    public string PlatformId { get; set; } = "1";

    public string OtpMessageTemplate { get; set; } =
        "Bellona Raporlama giris kodunuz: {0}. {1} dk gecerlidir.";
}
