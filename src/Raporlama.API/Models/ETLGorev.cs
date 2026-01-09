using System;

namespace Raporlama.API.Models
{
    public class ETLGorev
    {
        public int GorevId { get; set; }
        public string GorevAdi { get; set; }
        public string SorguMetni { get; set; }
        public string HedefTablo { get; set; }
        public string? Schedule { get; set; }
        public bool Aktif { get; set; }
        public DateTime OlusturmaTarihi { get; set; }
    }
}