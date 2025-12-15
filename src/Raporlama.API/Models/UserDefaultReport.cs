using System.ComponentModel.DataAnnotations;

namespace Raporlama.API.Models
{
    public class UserDefaultReport
    {
        [Key]
        public int UserDefaultReportKey { get; set; }
        public int UserKey { get; set; }
        public int ReportKey { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.Now;
        public string? Filters { get; set; } // JSON olarak filtreler
    }
}
