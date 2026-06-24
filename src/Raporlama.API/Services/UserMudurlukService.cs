using Raporlama.API.Data;

namespace Raporlama.API.Services
{
    public interface IUserMudurlukService
    {
        Task<IReadOnlyList<string>> GetMudurlukAdlariAsync(int userKey);
        Task<IReadOnlyList<string>> GetMudurlukAdlariAsync(int userKey, string? legacyMudurlukAdi);
        Task SetMudurlukAdlariAsync(int userKey, IEnumerable<string> mudurlukAdlari);
        Task<Dictionary<int, List<string>>> GetMudurlukAdlariByUserKeysAsync(IEnumerable<int> userKeys);
    }

    public class UserMudurlukService : IUserMudurlukService
    {
        private readonly IDatabaseService _databaseService;

        public UserMudurlukService(IDatabaseService databaseService)
        {
            _databaseService = databaseService;
        }

        public async Task<IReadOnlyList<string>> GetMudurlukAdlariAsync(int userKey) =>
            await GetMudurlukAdlariAsync(userKey, null);

        public async Task<IReadOnlyList<string>> GetMudurlukAdlariAsync(int userKey, string? legacyMudurlukAdi)
        {
            var rows = await _databaseService.QueryAsync<string>(
                "BellonaRapor",
                @"SELECT MudurlukAdi FROM UserMudurluk
                  WHERE UserKey = @UserKey
                  ORDER BY MudurlukAdi",
                new { UserKey = userKey }
            );

            var list = rows
                .Where(x => !string.IsNullOrWhiteSpace(x))
                .Select(x => x.Trim())
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();

            if (list.Count == 0 && !string.IsNullOrWhiteSpace(legacyMudurlukAdi))
                list.Add(legacyMudurlukAdi.Trim());

            return list;
        }

        public async Task SetMudurlukAdlariAsync(int userKey, IEnumerable<string> mudurlukAdlari)
        {
            var normalized = mudurlukAdlari
                .Where(x => !string.IsNullOrWhiteSpace(x))
                .Select(x => x.Trim())
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();

            await _databaseService.QueryAsync<int>(
                "BellonaRapor",
                "DELETE FROM UserMudurluk WHERE UserKey = @UserKey",
                new { UserKey = userKey }
            );

            foreach (var adi in normalized)
            {
                await _databaseService.QueryAsync<int>(
                    "BellonaRapor",
                    "INSERT INTO UserMudurluk (UserKey, MudurlukAdi) VALUES (@UserKey, @MudurlukAdi)",
                    new { UserKey = userKey, MudurlukAdi = adi }
                );
            }

            var legacyValue = normalized.Count > 0 ? normalized[0] : null;
            await _databaseService.QueryAsync<int>(
                "BellonaRapor",
                "UPDATE [User] SET MudurlukAdi = @MudurlukAdi WHERE UserKey = @UserKey",
                new { UserKey = userKey, MudurlukAdi = legacyValue }
            );
        }

        public async Task<Dictionary<int, List<string>>> GetMudurlukAdlariByUserKeysAsync(IEnumerable<int> userKeys)
        {
            var keys = userKeys.Distinct().ToArray();
            var map = keys.ToDictionary(k => k, _ => new List<string>());

            if (keys.Length == 0)
                return map;

            var rows = await _databaseService.QueryAsync<dynamic>(
                "BellonaRapor",
                @"SELECT UserKey, MudurlukAdi FROM UserMudurluk
                  WHERE UserKey IN @UserKeys
                  ORDER BY MudurlukAdi",
                new { UserKeys = keys }
            );

            foreach (var row in rows)
            {
                int key = (int)row.UserKey;
                string adi = ((string)row.MudurlukAdi).Trim();
                if (!map.TryGetValue(key, out var list))
                    continue;
                if (!list.Any(x => x.Equals(adi, StringComparison.OrdinalIgnoreCase)))
                    list.Add(adi);
            }

            return map;
        }
    }
}
