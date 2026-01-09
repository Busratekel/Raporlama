using System;
using System.Collections.Generic;
using System.Data;
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
            _connectionString = _configuration.GetConnectionString("DefaultConnection");
        }

        // Aktif görevleri veritabanından çeker
        public async Task<List<ETLGorev>> GetActiveTasksAsync()
        {
            using var conn = new SqlConnection(_connectionString);
            var sql = "SELECT GorevId, GorevAdi, SorguMetni, HedefTablo, Schedule FROM ETLGorevleri WHERE Aktif = 1";
            var result = await conn.QueryAsync<ETLGorev>(sql);
            return result.AsList();
        }

        public async Task<int> RunCustomETLWithResultAsync(string sorgu, string tablo)
        {
            var start = DateTime.Now;
            _logger.LogInformation($"ETL Görevi Başladı: {tablo} ({tablo}) | Başlangıç: {start:yyyy-MM-dd HH:mm:ss}");
            _logger.LogInformation($"[DEBUG] ETL başlatılıyor: {tablo} için sorgu: {sorgu}");
            using var conn = new SqlConnection(_connectionString);
            var data = await conn.QueryAsync(sorgu);
            await conn.ExecuteAsync($"DELETE FROM {tablo}");
            int count = 0;
            foreach (var row in data)
            {
                var dict = (IDictionary<string, object>)row;
                var converted = new Dictionary<string, object>();
                foreach (var kvp in dict)
                {
                    object val = kvp.Value;
                    if (val is string s)
                    {
                        // Tarih formatı kontrolü
                        if (DateTime.TryParse(s, out var dt))
                            val = dt;
                        else if (int.TryParse(s, out var i))
                            val = i;
                    }
                    converted[kvp.Key] = val;
                }
                var columns = string.Join(",", converted.Keys);
                var parameters = string.Join(",", converted.Keys.Select(k => "@" + k));
                var sql = $"INSERT INTO {tablo} ({columns}) VALUES ({parameters})";
                await conn.ExecuteAsync(sql, converted);
                count++;
            }
            var end = DateTime.Now;
            _logger.LogInformation($"ETL Görevi Bitti: {tablo} ({tablo}) | Bitiş: {end:yyyy-MM-dd HH:mm:ss} | Çekilen Kayıt: {count}");
            _logger.LogInformation($"[DEBUG] ETL tamamlandı: {tablo}, kayıt: {count}");
            return count;
        }
        public async Task<string> RunTaskManuallyAsync(int gorevId)
        {
            using var conn = new SqlConnection(_connectionString);
            var gorev = await conn.QueryFirstOrDefaultAsync<ETLGorev>("SELECT * FROM ETLGorevleri WHERE GorevId = @gorevId", new { gorevId });
            if (gorev == null)
                return $"Görev bulunamadı: {gorevId}";
            var start = DateTime.Now;
            _logger.LogInformation($"ETL Görevi Başladı: {gorev.GorevAdi} ({gorev.HedefTablo}) | Başlangıç: {start:yyyy-MM-dd HH:mm:ss}");
            var affected = await RunCustomETLWithResultAsync(gorev.SorguMetni, gorev.HedefTablo);
            var end = DateTime.Now;
            _logger.LogInformation($"ETL Görevi Bitti: {gorev.GorevAdi} ({gorev.HedefTablo}) | Bitiş: {end:yyyy-MM-dd HH:mm:ss} | Çekilen Kayıt: {affected}");
            return $"Görev {gorev.GorevAdi} ({gorevId}) çalıştırıldı. Etkilenen kayıt: {affected}";
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
