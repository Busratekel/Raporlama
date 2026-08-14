using System.Collections.Concurrent;
using System.Data;
using System.Globalization;
using Dapper;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace Raporlama.ETL
{
    public class ETLService
    {
        public const int SkippedAlreadyRunning = -1;

        private static readonly ConcurrentDictionary<string, byte> RunningTables = new(StringComparer.OrdinalIgnoreCase);

        private readonly ILogger<ETLService> _logger;
        private readonly IConfiguration _configuration;
        private readonly string _connectionString;

        public ETLService(ILogger<ETLService> logger, IConfiguration configuration)
        {
            _logger = logger;
            _configuration = configuration;
            _connectionString = _configuration.GetConnectionString("BellonaRapor")
                ?? throw new InvalidOperationException("BellonaRapor connection string bulunamadı.");
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

        public string? FindLatestLogFile(string? date = null)
        {
            var logDir = GetLogDirectory();
            if (!Directory.Exists(logDir))
                return null;

            try
            {
                var files = Directory.GetFiles(logDir, "etl-*.txt");
                if (files.Length == 0)
                    return null;

                if (!string.IsNullOrWhiteSpace(date))
                {
                    var dated = Path.Combine(logDir, $"etl-{date}.txt");
                    return File.Exists(dated) ? dated : null;
                }

                return files
                    .OrderByDescending(f => File.GetLastWriteTimeUtc(f))
                    .FirstOrDefault();
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "ETL log dosyası listelenemedi: {LogDir}", logDir);
                return null;
            }
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

        public async Task<List<ETLGorev>> GetActiveTasksAsync()
        {
            using var conn = new SqlConnection(_connectionString);
            const string sqlWithRunMode = @"SELECT GorevId, GorevAdi, SorguMetni, HedefTablo, Schedule,
                                                   ISNULL(RunMode, N'ReplaceAll') AS RunMode
                                            FROM ETLGorevleri WHERE Aktif = 1";
            const string sqlLegacy = @"SELECT GorevId, GorevAdi, SorguMetni, HedefTablo, Schedule
                                       FROM ETLGorevleri WHERE Aktif = 1";
            try
            {
                var result = await conn.QueryAsync<ETLGorev>(sqlWithRunMode);
                return result.AsList();
            }
            catch (SqlException ex) when (ex.Message.Contains("RunMode", StringComparison.OrdinalIgnoreCase))
            {
                _logger.LogWarning("ETLGorevleri.RunMode kolonu yok — ReplaceAll kullanılıyor. database/18_Satinalma_Incremental_ETL.sql çalıştırın.");
                var legacy = await conn.QueryAsync<ETLGorev>(sqlLegacy);
                foreach (var g in legacy)
                    g.RunMode = "ReplaceAll";
                return legacy.AsList();
            }
        }

        private static string QuoteSqlIdentifier(string name) =>
            $"[{name.Replace("]", "]]")}]";

        private static string NormalizeTableName(string tablo) =>
            tablo.Trim().Trim('[', ']');

        private static string NormalizeRunMode(string? runMode)
        {
            if (string.IsNullOrWhiteSpace(runMode)) return "ReplaceAll";
            return runMode.Trim();
        }

        /// <summary>
        /// INSERT ... SELECT için hedef tablonun identity olmayan kolonları (fact sırası).
        /// View kolon sayısı/sırası bununla eşleşmeli; aksi halde SQL hata verir.
        /// </summary>
        private static async Task<string> GetNonIdentityInsertColumnListAsync(
            SqlConnection conn,
            SqlTransaction tx,
            string tableName)
        {
            const string sql = @"
                SELECT c.name
                FROM sys.columns c
                INNER JOIN sys.tables t ON c.object_id = t.object_id
                WHERE t.name = @tableName AND c.is_identity = 0
                ORDER BY c.column_id";

            var columns = (await conn.QueryAsync<string>(sql, new { tableName }, transaction: tx)).AsList();
            if (columns.Count == 0)
                throw new InvalidOperationException($"Hedef tabloda insert kolonu bulunamadı: {tableName}");

            return string.Join(", ", columns.Select(QuoteSqlIdentifier));
        }

        public async Task<int> RunCustomETLWithResultAsync(string sorgu, string tablo, int? gorevId = null, string? runMode = null)
        {
            var mode = NormalizeRunMode(runMode);
            if (string.Equals(mode, "Merge", StringComparison.OrdinalIgnoreCase)
                || string.Equals(mode, "ExecuteSql", StringComparison.OrdinalIgnoreCase))
            {
                return await RunSqlScriptAsync(sorgu, tablo, gorevId);
            }

            if (string.Equals(mode, "InsertSelect", StringComparison.OrdinalIgnoreCase))
            {
                return await RunInsertSelectAsync(sorgu, tablo, gorevId);
            }

            return await RunReplaceAllAsync(sorgu, tablo, gorevId);
        }

        private async Task<int> RunInsertSelectAsync(string sorgu, string tablo, int? gorevId)
        {
            var tableName = NormalizeTableName(tablo);
            var selectSql = sorgu.Trim();
            if (!selectSql.StartsWith("SELECT", StringComparison.OrdinalIgnoreCase))
                throw new InvalidOperationException("InsertSelect modunda SorguMetni SELECT ile başlamalı.");

            if (!RunningTables.TryAdd(tableName, 0))
            {
                _logger.LogWarning("ETL atlandı — {Tablo} için zaten çalışan bir görev var.", tableName);
                return SkippedAlreadyRunning;
            }

            var start = DateTime.Now;
            _logger.LogInformation("ETL (InsertSelect) başladı: {Tablo} | {Start:yyyy-MM-dd HH:mm:ss}", tableName, start);

            try
            {
                await using var conn = new SqlConnection(_connectionString);
                await conn.OpenAsync();
                await using var tx = (SqlTransaction)await conn.BeginTransactionAsync();
                try
                {
                    await conn.ExecuteAsync(
                        $"DELETE FROM {QuoteSqlIdentifier(tableName)}",
                        transaction: tx,
                        commandTimeout: 0);

                    var insertColumns = await GetNonIdentityInsertColumnListAsync(conn, tx, tableName);
                    var inserted = await conn.ExecuteAsync(
                        $"INSERT INTO {QuoteSqlIdentifier(tableName)} ({insertColumns}) {selectSql}",
                        transaction: tx,
                        commandTimeout: 0);

                    var count = await conn.ExecuteScalarAsync<int>(
                        $"SELECT COUNT(*) FROM {QuoteSqlIdentifier(tableName)}",
                        transaction: tx,
                        commandTimeout: 0);

                    await tx.CommitAsync();

                    _logger.LogInformation(
                        "ETL (InsertSelect) bitti: {Tablo} | INSERT etki: {Inserted} | toplam: {Count}",
                        tableName, inserted, count);

                    if (gorevId.HasValue)
                        await MarkSuccessfulRunAsync(gorevId.Value);

                    return count;
                }
                catch
                {
                    await tx.RollbackAsync();
                    throw;
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "ETL InsertSelect hata verdi, DELETE geri alındı: {Tablo}", tableName);
                throw;
            }
            finally
            {
                RunningTables.TryRemove(tableName, out _);
            }
        }

        private async Task<int> RunSqlScriptAsync(string sorgu, string tablo, int? gorevId)
        {
            var tableName = NormalizeTableName(tablo);
            if (!RunningTables.TryAdd(tableName, 0))
            {
                _logger.LogWarning("ETL atlandı — {Tablo} için zaten çalışan bir görev var.", tableName);
                return SkippedAlreadyRunning;
            }

            var start = DateTime.Now;
            _logger.LogInformation("ETL (Merge/SQL) başladı: {Tablo} | {Start:yyyy-MM-dd HH:mm:ss}", tableName, start);

            try
            {
                await using var conn = new SqlConnection(_connectionString);
                await conn.OpenAsync();
                var deltaRows = await conn.ExecuteAsync(sorgu, commandTimeout: 0);
                var total = await conn.ExecuteScalarAsync<int>(
                    $"SELECT COUNT(*) FROM {QuoteSqlIdentifier(tableName)}", commandTimeout: 0);

                _logger.LogInformation(
                    "ETL (Merge/SQL) bitti: {Tablo} | delta etki: {Delta} | fact toplam: {Total}",
                    tableName, deltaRows, total);

                if (gorevId.HasValue)
                    await MarkSuccessfulRunAsync(gorevId.Value);

                return deltaRows;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "ETL Merge/SQL hata verdi: {Tablo}", tableName);
                throw;
            }
            finally
            {
                RunningTables.TryRemove(tableName, out _);
            }
        }

        private async Task<int> RunReplaceAllAsync(string sorgu, string tablo, int? gorevId)
        {
            var tableName = NormalizeTableName(tablo);
            var selectSql = sorgu.Trim();
            if (selectSql.StartsWith("SELECT", StringComparison.OrdinalIgnoreCase))
                return await RunInsertSelectAsync(selectSql, tablo, gorevId);

            return await RunReplaceAllBulkAsync(selectSql, tableName, gorevId);
        }

        /// <summary>
        /// SELECT olmayan veya istemci tarafı aktarım gerektiren senaryolar için SqlBulkCopy.
        /// </summary>
        private async Task<int> RunReplaceAllBulkAsync(string sorgu, string tableName, int? gorevId)
        {
            if (!RunningTables.TryAdd(tableName, 0))
            {
                _logger.LogWarning("ETL atlandı — {Tablo} için zaten çalışan bir görev var.", tableName);
                return SkippedAlreadyRunning;
            }

            var start = DateTime.Now;
            _logger.LogInformation("ETL görevi başladı: {Tablo} | {Start:yyyy-MM-dd HH:mm:ss}", tableName, start);

            try
            {
                await using var destConn = new SqlConnection(_connectionString);
                await destConn.OpenAsync();

                await using var tx = (SqlTransaction)await destConn.BeginTransactionAsync();
                try
                {
                    await destConn.ExecuteAsync(
                        $"DELETE FROM {QuoteSqlIdentifier(tableName)}",
                        transaction: tx,
                        commandTimeout: 0);

                    await using var sourceConn = new SqlConnection(_connectionString);
                    await sourceConn.OpenAsync();

                    await using var cmd = new SqlCommand(sorgu, sourceConn) { CommandTimeout = 0 };
                    await using var reader = await cmd.ExecuteReaderAsync(CommandBehavior.SequentialAccess);

                    if (!reader.HasRows)
                    {
                        await tx.CommitAsync();
                        _logger.LogInformation("ETL tamamlandı: {Tablo}, kaynak boş.", tableName);
                        if (gorevId.HasValue)
                            await MarkSuccessfulRunAsync(gorevId.Value);
                        return 0;
                    }

                    var columns = new List<string>();
                    for (var i = 0; i < reader.FieldCount; i++)
                        columns.Add(reader.GetName(i));
                    _logger.LogInformation("ETL kolonları: {Columns}", string.Join(", ", columns));

                    var batch = new DataTable { Locale = CultureInfo.GetCultureInfo("tr-TR") };
                    for (var i = 0; i < reader.FieldCount; i++)
                        batch.Columns.Add(reader.GetName(i), reader.GetFieldType(i));

                    using var bulk = new SqlBulkCopy(destConn, SqlBulkCopyOptions.Default, tx)
                    {
                        DestinationTableName = tableName,
                        BatchSize = 5000,
                        BulkCopyTimeout = 0
                    };

                    foreach (var col in columns)
                        bulk.ColumnMappings.Add(col, col);

                    var values = new object[reader.FieldCount];
                    while (await reader.ReadAsync())
                    {
                        reader.GetValues(values);
                        batch.Rows.Add(values);
                        if (batch.Rows.Count >= bulk.BatchSize)
                        {
                            await bulk.WriteToServerAsync(batch);
                            batch.Clear();
                        }
                    }

                    if (batch.Rows.Count > 0)
                        await bulk.WriteToServerAsync(batch);

                    var count = await destConn.ExecuteScalarAsync<int>(
                        $"SELECT COUNT(*) FROM {QuoteSqlIdentifier(tableName)}",
                        transaction: tx,
                        commandTimeout: 0);

                    await tx.CommitAsync();

                    var end = DateTime.Now;
                    _logger.LogInformation(
                        "ETL görevi bitti: {Tablo} | {End:yyyy-MM-dd HH:mm:ss} | Kayıt: {Count}",
                        tableName, end, count);

                    if (gorevId.HasValue)
                        await MarkSuccessfulRunAsync(gorevId.Value);

                    return count;
                }
                catch
                {
                    await tx.RollbackAsync();
                    throw;
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "ETL hata verdi, DELETE geri alındı: {Tablo}", tableName);
                throw;
            }
            finally
            {
                RunningTables.TryRemove(tableName, out _);
            }
        }

        public async Task<string> RunTaskManuallyAsync(int gorevId)
        {
            CleanupOldLogs();

            using var conn = new SqlConnection(_connectionString);
            var gorev = await conn.QueryFirstOrDefaultAsync<ETLGorev>(
                "SELECT * FROM ETLGorevleri WHERE GorevId = @gorevId", new { gorevId });
            if (gorev == null)
                return $"Görev bulunamadı: {gorevId}";

            var affected = await RunCustomETLWithResultAsync(
                gorev.SorguMetni, gorev.HedefTablo, gorevId, gorev.RunMode);
            if (affected == SkippedAlreadyRunning)
                return $"Görev zaten çalışıyor: {gorev.GorevAdi} ({gorev.HedefTablo})";

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
        public string GorevAdi { get; set; } = string.Empty;
        public string SorguMetni { get; set; } = string.Empty;
        public string HedefTablo { get; set; } = string.Empty;
        public string Schedule { get; set; } = string.Empty;
        public string RunMode { get; set; } = "ReplaceAll";
    }
}
