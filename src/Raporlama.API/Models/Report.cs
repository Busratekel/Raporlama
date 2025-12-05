namespace Raporlama.API.Models
{
    public enum DataSourceType
    {
        Batch = 1,
        RealTime = 2,
        Hybrid = 3
    }

    public class Report
    {
        public int ReportID { get; set; }
        public string ReportName { get; set; } = string.Empty;
        public string ReportCode { get; set; } = string.Empty;
        public string SourceDatabase { get; set; } = string.Empty;
        public string Query { get; set; } = string.Empty;
        public DataSourceType? DataSourceType { get; set; }
        public int? CacheDuration { get; set; }
        public bool IsActive { get; set; } = true;
        public string? Description { get; set; }
    }
}





