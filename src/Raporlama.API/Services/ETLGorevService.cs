using Dapper;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Raporlama.API.Models;
using System;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace Raporlama.API.Services
{
    public class ETLGorevService
    {
        private readonly IConfiguration _config;
        private readonly ILogger<ETLGorevService> _logger;
        private readonly string _connectionString;
        public ETLGorevService(IConfiguration config, ILogger<ETLGorevService> logger)
        {
            _config = config;
            _logger = logger;
            _connectionString = _config.GetConnectionString("BellonaRapor");
        }

        private const string SelectColumns = @"
                GorevId, GorevAdi, SorguMetni, HedefTablo, Schedule, Aktif,
                OlusturmaTarihi, SonBasariliCalisma";

        public async Task<IEnumerable<ETLGorev>> GetAllAsync()
        {
            using var conn = new SqlConnection(_connectionString);
            var rows = await conn.QueryAsync<ETLGorev>($@"
                SELECT {SelectColumns}
                FROM ETLGorevleri
                ORDER BY GorevId");
            return rows;
        }

        public async Task<ETLGorev?> GetByIdAsync(int id)
        {
            using var conn = new SqlConnection(_connectionString);
            return await conn.QueryFirstOrDefaultAsync<ETLGorev>($@"
                SELECT {SelectColumns}
                FROM ETLGorevleri WHERE GorevId = @id", new { id });
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
            using var http = new System.Net.Http.HttpClient { Timeout = TimeSpan.FromMinutes(30) };
            var etlUrl = $"{EtlPathHelper.GetEtlServiceUrl(_config)}/api/etl/run/{id}";
            try
            {
                var response = await http.PostAsync(etlUrl, null);
                var msg = await response.Content.ReadAsStringAsync();
                if (response.IsSuccessStatusCode)
                {
                    await TryMarkSonBasariliCalismaAsync(id);
                    return msg;
                }

                return $"ETL çalıştırılamadı ({(int)response.StatusCode}): {msg}. ETL servisi ayakta mı? (ETL:ServiceUrl)";
            }
            catch (Exception ex)
            {
                return $"ETL servisine ulaşılamadı ({etlUrl}): {ex.Message}";
            }
        }

        private async Task TryMarkSonBasariliCalismaAsync(int gorevId)
        {
            try
            {
                using var conn = new SqlConnection(_connectionString);
                await conn.ExecuteAsync(
                    "UPDATE ETLGorevleri SET SonBasariliCalisma = GETDATE() WHERE GorevId = @GorevId",
                    new { GorevId = gorevId });
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex,
                    "SonBasariliCalisma güncellenemedi (GorevId={GorevId}). " +
                    "database/13_ETLGorev_SonBasariliCalisma.sql çalıştırın.",
                    gorevId);
            }
        }
    }
}
