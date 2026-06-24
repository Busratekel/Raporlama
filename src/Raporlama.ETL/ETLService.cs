using System;
using System.Collections.Generic;
using System.Data;
using System.Globalization;
using System.Threading.Tasks;
using Dapper;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace Raporlama.ETL
{
    public class ETLService
    {
        
        private readonly ILogger<ETLService> _logger;
        private readonly IConfiguration _configuration;
        private readonly string _connectionString;

        public ETLService(ILogger<ETLService> logger, IConfiguration configuration)
        {
            _logger = logger;
            _configuration = configuration;
            _connectionString = _configuration.GetConnectionString("BellonaRapor");
        }

        public string GetLogDirectory() => ResolveLogDirectory(_configuration);

        public static string ResolveLogDirectory(IConfiguration? configuration = null)
        {
            var configured = configuration?["ETL:LogDirectory"];
            if (!string.IsNullOrWhiteSpace(configured))
                return configured.Trim();
            return Path.Combine(AppContext.BaseDirectory, "logs");
        }

        public static void CleanupOldLogs(IConfiguration? configuration = null)
        {
            try
            {
                var logDir = ResolveLogDirectory(configuration);
                Directory.CreateDirectory(logDir);
                var today = DateTime.Now.ToString("yyyyMMdd");
                var files = Directory.GetFiles(logDir, "etl-*.txt");
                foreach (var file in files)
                {
                    var fileName = Path.GetFileNameWithoutExtension(file);
                    if (fileName != $"etl-{today}")
                    {
                        try { File.Delete(file); } catch { }
                    }
                }
            }
            catch { }
        }

        // Aktif görevleri veritabanından çeker
        public async Task<List<ETLGorev>> GetActiveTasksAsync()
        {
            using var conn = new SqlConnection(_connectionString);
            var sql = "SELECT GorevId, GorevAdi, SorguMetni, HedefTablo, Schedule FROM ETLGorevleri WHERE Aktif = 1";
            var result = await conn.QueryAsync<ETLGorev>(sql);
            return result.AsList();
        }

        private static object NormalizeCellValue(object value)
        {
            if (value == null || value == DBNull.Value) return null;

            if (value is string s)
            {
                s = s.Trim();
                if (s.Length == 0) return null;

                // View'den gelen dd.MM.yyyy tarihleri (örn. 08.04.2026) datetime kolonuna yazılabilsin.
                if (DateTime.TryParseExact(s, "dd.MM.yyyy", CultureInfo.InvariantCulture, DateTimeStyles.None, out var trDate))
                    return trDate;
                if (DateTime.TryParseExact(s, "d.M.yyyy", CultureInfo.InvariantCulture, DateTimeStyles.None, out trDate))
                    return trDate;

                return s;
            }

            return value;
        }

        private static string QuoteSqlIdentifier(string name) =>
            $"[{name.Replace("]", "]]")}]";

        private static string NormalizeTableName(string tablo) =>
            tablo.Trim().Trim('[', ']');

        private static async Task InsertRowAsync(
            SqlConnection conn,
            IDbTransaction tx,
            string tablo,
            Dictionary<string, object> dict)
        {
            var dp = new DynamicParameters();
            var columns = new List<string>();
            var parameters = new List<string>();
            var i = 0;
            foreach (var kv in dict)
            {
                var paramName = "p" + i++;
                columns.Add(QuoteSqlIdentifier(kv.Key));
                parameters.Add("@" + paramName);
                dp.Add(paramName, kv.Value);
            }

            var sql = $"INSERT INTO {QuoteSqlIdentifier(NormalizeTableName(tablo))} ({string.Join(",", columns)}) VALUES ({string.Join(",", parameters)})";
            await conn.ExecuteAsync(sql, dp, transaction: tx);
        }

        public async Task<int> RunCustomETLWithResultAsync(string sorgu, string tablo, int? gorevId = null)
        {
            var start = DateTime.Now;
            _logger.LogInformation($"ETL Görevi Başladı: {tablo} ({tablo}) | Başlangıç: {start:yyyy-MM-dd HH:mm:ss}");
            _logger.LogInformation($"[DEBUG] ETL başlatılıyor: {tablo} için sorgu: {sorgu}");

            await using var conn = new SqlConnection(_connectionString);
            await conn.OpenAsync();
            var data = (await conn.QueryAsync(sorgu)).AsList();

            await using var tx = await conn.BeginTransactionAsync();
            try
            {
                await conn.ExecuteAsync($"DELETE FROM {QuoteSqlIdentifier(NormalizeTableName(tablo))}", transaction: tx);
                int count = 0;
                string? loggedColumns = null;
                foreach (var row in data)
                {
                    var source = (IDictionary<string, object>)row;
                    var dict = new Dictionary<string, object>();
                    foreach (var kv in source)
                        dict[kv.Key] = NormalizeCellValue(kv.Value);

                    if (loggedColumns == null)
                    {
                        loggedColumns = string.Join(", ", dict.Keys);
                        _logger.LogInformation("[DEBUG] ETL kolonları: {Columns}", loggedColumns);
                    }

                    await InsertRowAsync(conn, tx, tablo, dict);
                    count++;
                }

                await tx.CommitAsync();
                var end = DateTime.Now;
                _logger.LogInformation($"ETL Görevi Bitti: {tablo} ({tablo}) | Bitiş: {end:yyyy-MM-dd HH:mm:ss} | Çekilen Kayıt: {count}");
                _logger.LogInformation($"[DEBUG] ETL tamamlandı: {tablo}, kayıt: {count}");
                if (gorevId.HasValue)
                    await MarkSuccessfulRunAsync(gorevId.Value);
                return count;
            }
            catch (Exception ex)
            {
                await tx.RollbackAsync();
                _logger.LogError(ex, "ETL hata verdi, DELETE geri alındı: {Tablo}", tablo);
                throw;
            }
        }

        public async Task<string> RunTaskManuallyAsync(int gorevId)
        {
            // Manuel ETL çalıştırmadan önce eski log dosyalarını sil
            CleanupOldLogs();

            using var conn = new SqlConnection(_connectionString);
            var gorev = await conn.QueryFirstOrDefaultAsync<ETLGorev>("SELECT * FROM ETLGorevleri WHERE GorevId = @gorevId", new { gorevId });
            if (gorev == null)
                return $"Görev bulunamadı: {gorevId}";
            var start = DateTime.Now;
            _logger.LogInformation($"ETL Görevi Başladı: {gorev.GorevAdi} ({gorev.HedefTablo}) | Başlangıç: {start:yyyy-MM-dd HH:mm:ss}");
            var affected = await RunCustomETLWithResultAsync(gorev.SorguMetni, gorev.HedefTablo, gorevId);
            var end = DateTime.Now;
            _logger.LogInformation($"ETL Görevi Bitti: {gorev.GorevAdi} ({gorev.HedefTablo}) | Bitiş: {end:yyyy-MM-dd HH:mm:ss} | Çekilen Kayıt: {affected}");
            return $"Görev {gorev.GorevAdi} ({gorevId}) çalıştırıldı. Etkilenen kayıt: {affected}";
        }

        private async Task MarkSuccessfulRunAsync(int gorevId)
        {
            try
            {
                await using var conn = new SqlConnection(_connectionString);
                var rows = await conn.ExecuteAsync(
                    "UPDATE ETLGorevleri SET SonBasariliCalisma = GETDATE() WHERE GorevId = @GorevId",
                    new { GorevId = gorevId });
                if (rows > 0)
                    _logger.LogInformation("SonBasariliCalisma güncellendi: GorevId={GorevId}", gorevId);
                else
                    _logger.LogWarning("SonBasariliCalisma güncellenemedi (kayıt yok): GorevId={GorevId}", gorevId);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex,
                    "SonBasariliCalisma güncellenemedi (GorevId={GorevId}). " +
                    "BellonaRapor'da database/13_ETLGorev_SonBasariliCalisma.sql çalıştırıldı mı?",
                    gorevId);
            }
        }
    }

    public class ETLGorev
    {

        public int GorevId { get; set; }
        public string GorevAdi { get; set; }
        public string SorguMetni { get; set; }
        public string HedefTablo { get; set; }
        public string Schedule { get; set; }
    }
}
