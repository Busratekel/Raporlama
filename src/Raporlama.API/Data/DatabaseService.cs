using Dapper;
using Microsoft.Data.SqlClient;
using System.Data;

namespace Raporlama.API.Data
{
    public interface IDatabaseService
    {
        Task<IEnumerable<T>> QueryAsync<T>(string databaseName, string query, object? parameters = null);
        Task<DataTable> QueryDataTableAsync(string databaseName, string query, object? parameters = null);
        Task<bool> TestConnectionAsync(string databaseName);
        Task<IEnumerable<string>> GetTableNamesAsync(string databaseName);
    }

    public class DatabaseService : IDatabaseService
    {
        private readonly IConfiguration _configuration;
        private readonly ILogger<DatabaseService> _logger;

        public DatabaseService(IConfiguration configuration, ILogger<DatabaseService> logger)
        {
            _configuration = configuration;
            _logger = logger;
        }

        private string GetConnectionString(string databaseName)
        {
            var connectionString = _configuration.GetConnectionString(databaseName);
            if (string.IsNullOrEmpty(connectionString))
            {
                throw new Exception($"Connection string not found for database: {databaseName}");
            }
            return connectionString;
        }

        public async Task<bool> TestConnectionAsync(string databaseName)
        {
            try
            {
                var connectionString = GetConnectionString(databaseName);
                using var connection = new SqlConnection(connectionString);
                await connection.OpenAsync();
                await connection.QueryAsync("SELECT 1");
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Database connection test failed for {DatabaseName}", databaseName);
                return false;
            }
        }

        public async Task<IEnumerable<T>> QueryAsync<T>(string databaseName, string query, object? parameters = null)
        {
            try
            {
                var connectionString = GetConnectionString(databaseName);
                using var connection = new SqlConnection(connectionString);
                return await connection.QueryAsync<T>(query, parameters);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Query failed for database {DatabaseName}: {Query}", databaseName, query);
                throw;
            }
        }

        public async Task<DataTable> QueryDataTableAsync(string databaseName, string query, object? parameters = null)
        {
            try
            {
                var connectionString = GetConnectionString(databaseName);
                using var connection = new SqlConnection(connectionString);
                await connection.OpenAsync();

                using var command = new SqlCommand(query, connection);
                if (parameters != null)
                {
                    if (parameters is Dictionary<string, object> dictParams)
                    {
                        foreach (var param in dictParams)
                        {
                            command.Parameters.AddWithValue($"@{param.Key}", param.Value ?? DBNull.Value);
                        }
                    }
                    else
                    {
                        foreach (var prop in parameters.GetType().GetProperties())
                        {
                            command.Parameters.AddWithValue($"@{prop.Name}", prop.GetValue(parameters) ?? DBNull.Value);
                        }
                    }
                }

                using var adapter = new SqlDataAdapter(command);
                var dataTable = new DataTable();
                adapter.Fill(dataTable);
                return dataTable;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "QueryDataTable failed for database {DatabaseName}: {Query}", databaseName, query);
                throw;
            }
        }

        public async Task<IEnumerable<string>> GetTableNamesAsync(string databaseName)
        {
            try
            {
                var query = @"
                    SELECT TABLE_NAME 
                    FROM INFORMATION_SCHEMA.TABLES 
                    WHERE TABLE_TYPE = 'BASE TABLE'
                    ORDER BY TABLE_NAME";
                
                var tables = await QueryAsync<string>(databaseName, query);
                return tables;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "GetTableNames failed for database {DatabaseName}", databaseName);
                throw;
            }
        }
    }
}





