namespace Raporlama.API.Services;

public static class ReportUrlNormalizer
{
    public static string Normalize(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw))
            return "/menu.html";

        var url = raw.Trim().Replace('\\', '/');

        if (url.StartsWith("http://", StringComparison.OrdinalIgnoreCase)
            || url.StartsWith("https://", StringComparison.OrdinalIgnoreCase))
            return url;

        url = url.TrimStart('/');

        if (!url.StartsWith("raporlar/", StringComparison.OrdinalIgnoreCase))
            url = "raporlar/" + url;

        if (!url.EndsWith(".html", StringComparison.OrdinalIgnoreCase))
            url += ".html";

        return url;
    }
}
