using Dapper;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Configuration;
using Raporlama.API.Models;
using System;
using System.Collections.Generic;
using System.Data;
using System.Threading.Tasks;

namespace Raporlama.API.Services
{
    public class ETLGorevService
    {
        private readonly IConfiguration _config;
        private readonly string _connectionString;
        public ETLGorevService(IConfiguration config)
        {
            _config = config;
            _connectionString = _config.GetConnectionString("BellonaRapor");
        }

        public async Task<IEnumerable<ETLGorev>> GetAllAsync()
        {
            using var conn = new SqlConnection(_connectionString);
            return await conn.QueryAsync<ETLGorev>("SELECT * FROM ETLGorevleri");
        }

        public async Task<ETLGorev?> GetByIdAsync(int id)
        {
            using var conn = new SqlConnection(_connectionString);
            return await conn.QueryFirstOrDefaultAsync<ETLGorev>("SELECT * FROM ETLGorevleri WHERE GorevId = @id", new { id });
        }

        public async Task CreateAsync(ETLGorev gorev)
        {
            using var conn = new SqlConnection(_connectionString);
            await conn.ExecuteAsync(@"INSERT INTO ETLGorevleri (GorevAdi, SorguMetni, HedefTablo, Schedule, Aktif, OlusturmaTarihi) VALUES (@GorevAdi, @SorguMetni, @HedefTablo, @Schedule, @Aktif, GETDATE())", gorev);
        }

        public async Task<bool> UpdateAsync(int id, ETLGorev gorev)
        {
            using var conn = new SqlConnection(_connectionString);
            var affected = await conn.ExecuteAsync(@"UPDATE ETLGorevleri SET GorevAdi=@GorevAdi, SorguMetni=@SorguMetni, HedefTablo=@HedefTablo, Schedule=@Schedule, Aktif=@Aktif WHERE GorevId=@id", new { gorev.GorevAdi, gorev.SorguMetni, gorev.HedefTablo, gorev.Schedule, gorev.Aktif, id });
            return affected > 0;
        }

        public async Task<bool> DeleteAsync(int id)
        {
            using var conn = new SqlConnection(_connectionString);
            var affected = await conn.ExecuteAsync("DELETE FROM ETLGorevleri WHERE GorevId=@id", new { id });
            return affected > 0;
        }

        public async Task<string> RunManuallyAsync(int id)
        {
            using var http = new System.Net.Http.HttpClient();
            var etlUrl = $"http://localhost:5010/api/etl/run/{id}";
            var response = await http.PostAsync(etlUrl, null);
            var msg = await response.Content.ReadAsStringAsync();
            if (response.IsSuccessStatusCode)
            {
                // ETL servisi string mesaj döndürüyor, onu ilet
                return msg;
            }
            else
            {
                return $"ETL çalıştırılamadı: {msg}";
            }
        }
    }
}
