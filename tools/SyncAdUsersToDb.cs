using System;
using System.Collections.Generic;
using System.DirectoryServices;
using System.Data.SqlClient;

class SyncAdUsersToDb
{
    static void Main(string[] args)
    {
        string ldapPath = "LDAP://DC=bellonaas,DC=local";
        string sqlConnStr = "Server=BLN-KAY-CLSQL2;Database=BellonaRapor;Trusted_Connection=True;"; // Düzenleyin

        var users = new List<(string UserName, string DisplayName, string Email)>();

        using (DirectoryEntry entry = new DirectoryEntry(ldapPath))
        using (DirectorySearcher searcher = new DirectorySearcher(entry))
        {
            searcher.Filter = "(&(objectClass=user)(objectCategory=person))";
            searcher.PropertiesToLoad.Add("sAMAccountName");
            searcher.PropertiesToLoad.Add("displayName");
            searcher.PropertiesToLoad.Add("mail");

            foreach (SearchResult result in searcher.FindAll())
            {
                string userName = result.Properties["sAMAccountName"].Count > 0 ? (string)result.Properties["sAMAccountName"][0] : null;
                string displayName = result.Properties["displayName"].Count > 0 ? (string)result.Properties["displayName"][0] : null;
                string email = result.Properties["mail"].Count > 0 ? (string)result.Properties["mail"][0] : null;
                if (!string.IsNullOrEmpty(userName))
                {
                    users.Add((userName, displayName, email));
                }
            }
        }

        using (var conn = new SqlConnection(sqlConnStr))
        {
            conn.Open();
            foreach (var user in users)
            {
                var cmd = new SqlCommand("IF NOT EXISTS (SELECT 1 FROM [User] WHERE UserName = @UserName) INSERT INTO [User] (UserName, DisplayName, Email, Aktif) VALUES (@UserName, @DisplayName, @Email, 1)", conn);
                cmd.Parameters.AddWithValue("@UserName", user.UserName);
                cmd.Parameters.AddWithValue("@DisplayName", (object)user.DisplayName ?? DBNull.Value);
                cmd.Parameters.AddWithValue("@Email", (object)user.Email ?? DBNull.Value);
                cmd.ExecuteNonQuery();
            }
        }

        Console.WriteLine($"{users.Count} AD kullanıcısı User tablosuna aktarıldı.");
    }
}
