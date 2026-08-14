namespace Raporlama.API.Services;

public static class EtlPathHelper
{
    public static string? ResolveLogDirectory(IConfiguration config)
    {
        foreach (var dir in BuildCandidatePaths(config))
        {
            if (TryPickNewestInDirectory(dir, null) != null)
                return dir;
        }

        foreach (var dir in BuildCandidatePaths(config))
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
                Path.Combine("Raporlama.ETL", "bin", "Debug", "net10.0-windows", "logs"),
                Path.Combine("Raporlama.ETL", "bin", "Release", "net10.0", "win-x64", "logs"),
                Path.Combine("src", "Raporlama.ETL", "logs"),
                Path.Combine("src", "Raporlama.ETL", "bin", "Debug", "net10.0", "logs"),
                Path.Combine("src", "Raporlama.ETL", "bin", "Debug", "net10.0-windows", "logs"),
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

        return PickNewestLogFile(Directory.GetFiles(logDir, "etl-*.txt"), date);
    }

    /// <summary>
    /// Önce appsettings ETL:LogDirectory; yoksa aday klasörlerde en güncel dosya.
    /// </summary>
    public static string? FindLatestLogFileFromCandidates(IConfiguration config, string? date = null)
    {
        var configured = config["ETL:LogDirectory"]?.Trim();
        if (!string.IsNullOrWhiteSpace(configured))
        {
            var fromConfigured = TryPickNewestInDirectory(configured, date);
            if (fromConfigured != null)
                return fromConfigured;
        }

        string? bestFile = null;
        var bestTime = DateTime.MinValue;

        foreach (var dir in BuildCandidatePaths(config))
        {
            if (string.IsNullOrWhiteSpace(configured) ||
                !string.Equals(dir, configured, StringComparison.OrdinalIgnoreCase))
            {
                var file = TryPickNewestInDirectory(dir, date);
                if (file == null)
                    continue;

                DateTime writeTime;
                try { writeTime = File.GetLastWriteTimeUtc(file); }
                catch { continue; }

                if (writeTime > bestTime)
                {
                    bestTime = writeTime;
                    bestFile = file;
                }
            }
        }

        return bestFile;
    }

    private static string? TryPickNewestInDirectory(string? dir, string? date)
    {
        if (string.IsNullOrEmpty(dir) || !Directory.Exists(dir))
            return null;

        try
        {
            var files = Directory.GetFiles(dir, "etl-*.txt");
            return PickNewestLogFile(files, date);
        }
        catch
        {
            return null;
        }
    }

    public static string DescribeLogSearch(IConfiguration config)
    {
        var lines = new List<string>();
        var configured = config["ETL:LogDirectory"]?.Trim();
        if (!string.IsNullOrWhiteSpace(configured))
            lines.Add($"Yapılandırılan: {configured} → {(Directory.Exists(configured) ? "var" : "YOK")}");

        foreach (var dir in BuildCandidatePaths(config).Take(8))
        {
            if (string.IsNullOrEmpty(dir))
                continue;
            string status;
            try
            {
                if (!Directory.Exists(dir))
                    status = "yok";
                else
                {
                    var count = Directory.GetFiles(dir, "etl-*.txt").Length;
                    status = count > 0 ? $"{count} dosya" : "boş";
                }
            }
            catch
            {
                status = "erişilemiyor (IIS okuma yetkisi?)";
            }
            lines.Add($"  - {dir} → {status}");
        }

        return string.Join("\n", lines);
    }

    private static string? PickNewestLogFile(string[] files, string? date)
    {
        if (files.Length == 0)
            return null;

        if (!string.IsNullOrWhiteSpace(date))
        {
            var dated = files.FirstOrDefault(f =>
                string.Equals(Path.GetFileNameWithoutExtension(f), $"etl-{date}", StringComparison.OrdinalIgnoreCase));
            return dated;
        }

        return files
            .Select(f => { try { return (f, File.GetLastWriteTimeUtc(f)); } catch { return (f, DateTime.MinValue); } })
            .OrderByDescending(x => x.Item2)
            .ThenByDescending(x => x.f, StringComparer.OrdinalIgnoreCase)
            .Select(x => x.f)
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
