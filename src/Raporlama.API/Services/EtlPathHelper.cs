namespace Raporlama.API.Services;

public static class EtlPathHelper
{
    public static string? ResolveLogDirectory(IConfiguration config)
    {
        var candidates = BuildCandidatePaths(config);

        foreach (var dir in candidates)
        {
            if (string.IsNullOrEmpty(dir) || !Directory.Exists(dir))
                continue;
            if (Directory.GetFiles(dir, "etl-*.txt").Length > 0)
                return dir;
        }

        foreach (var dir in candidates)
        {
            if (!string.IsNullOrEmpty(dir) && Directory.Exists(dir))
                return dir;
        }

        var configured = config["ETL:LogDirectory"]?.Trim();
        return string.IsNullOrWhiteSpace(configured) ? null : configured;
    }

    public static IEnumerable<string> BuildCandidatePaths(IConfiguration config)
    {
        var list = new List<string>();

        var configured = config["ETL:LogDirectory"];
        if (!string.IsNullOrWhiteSpace(configured))
            list.Add(configured.Trim());

        list.Add(Path.Combine(AppContext.BaseDirectory, "logs"));
        list.Add(@"C:\Services\Raporlama.ETL\logs");

        for (var dir = AppContext.BaseDirectory; !string.IsNullOrEmpty(dir); dir = Directory.GetParent(dir)?.FullName)
        {
            foreach (var rel in new[]
            {
                "logs",
                Path.Combine("Raporlama.ETL", "logs"),
                Path.Combine("Raporlama.ETL", "bin", "Debug", "net10.0", "logs"),
                Path.Combine("Raporlama.ETL", "bin", "Release", "net10.0", "win-x64", "logs"),
                Path.Combine("src", "Raporlama.ETL", "logs"),
                Path.Combine("src", "Raporlama.ETL", "bin", "Debug", "net10.0", "logs"),
            })
            {
                try { list.Add(Path.GetFullPath(Path.Combine(dir, rel))); } catch { /* ignore */ }
            }
        }

        return list.Distinct(StringComparer.OrdinalIgnoreCase);
    }

    public static string? FindLatestLogFile(string? logDir, string? date = null)
    {
        if (string.IsNullOrEmpty(logDir) || !Directory.Exists(logDir))
            return null;

        if (!string.IsNullOrWhiteSpace(date))
        {
            var dated = Path.Combine(logDir, $"etl-{date}.txt");
            return File.Exists(dated) ? dated : null;
        }

        return Directory.GetFiles(logDir, "etl-*.txt")
            .OrderByDescending(f => f, StringComparer.OrdinalIgnoreCase)
            .FirstOrDefault();
    }

    public static string ReadLogTail(string filePath, int maxBytes = 512_000)
    {
        using var fs = new FileStream(filePath, FileMode.Open, FileAccess.Read, FileShare.ReadWrite);
        if (fs.Length <= maxBytes)
        {
            using var sr = new StreamReader(fs);
            return sr.ReadToEnd();
        }

        fs.Seek(-maxBytes, SeekOrigin.End);
        using var tailReader = new StreamReader(fs);
        return "(… dosyanın son kısmı gösteriliyor …)\n" + tailReader.ReadToEnd();
    }

    public static string GetEtlServiceUrl(IConfiguration config) =>
        (config["ETL:ServiceUrl"] ?? "http://127.0.0.1:5010").TrimEnd('/');
}
