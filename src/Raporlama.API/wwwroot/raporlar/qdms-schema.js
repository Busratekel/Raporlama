// QDMS raporu için şema
const qdmsSchema = {
    reportKey: 'qdms',
    filters: [
        { field: 'Durum', elementId: 'filterDurum', label: 'Durum' },
        { field: 'MudurlukAdi', elementId: 'filterMudurluk', label: 'Müdürlük' },
        { field: 'Tip', elementId: 'filterTip', label: 'Tip' },
        { field: 'BaslamaTarihi', elementId: 'filterBaslangic', label: 'Başlangıç Tarihi', type: 'date' },
        { field: 'BitisTarihi', elementId: 'filterBitis', label: 'Bitiş Tarihi', type: 'date' },
    ],
    columns: [
        { dataField: 'BekletenSirket', caption: 'Şirket' },
        { dataField: 'Aksiyon', caption: 'Aksiyon No' },
        { dataField: 'KalemNo', caption: 'Kalem No' },
        { dataField: 'BekletenSicilNo', caption: 'Sicil' },
        { dataField: 'BekletenAdSoyad', caption: 'Ad Soyad' },
        { dataField: 'SorumluAdSoyad', caption: 'Yönetici' },
        { dataField: 'MudurlukAdi', caption: 'Müdürlük' },
        { dataField: 'Durum', caption: 'Durum' },
        { dataField: 'BitisTarihi', caption: 'Bitiş Tarihi' },
        { dataField: 'GeciktiMi', caption: 'Gecikti mi?' },
        { dataField: 'BeklemeGun', caption: 'Bekleme Gün' },
        { dataField: 'GecikmeGun', caption: 'Gecikme Gün' }, 
        { dataField: 'Tanım', caption: 'Tanım' }
    ],
    summaries: [
        { type: 'avg', field: 'BeklemeGun', elementId: '#ortalamaBekleme' },
        { type: 'max', field: 'BeklemeGun', elementId: '#enUzunBekleme' },
        { type: 'count', elementId: '#bekleyenSurec' }
    ],
    charts: [
        { field: 'Durum', elementId: '#durumChart', typeSelector: '#chartTypeDurum', filterElementId: '#filterDurum', defaultType: 'pie' },
        { field: 'Mudurluk', elementId: '#sorumluChart', typeSelector: '#chartTypeMudurluk', filterElementId: '#filterMudurluk', defaultType: 'pie' }
    ],
    pivotFields: [
        { dataField: 'MudurlukAdi', area: 'row', caption: 'Müdürlük' },
        { dataField: 'Yil', area: 'column', caption: 'Yıl' },
        { dataField: 'UretimYeri', area: 'column', caption: 'Üretim Yeri' },
        { dataField: 'Hafta', area: 'column', caption: 'Hafta' },
        { dataField: 'Adet', area: 'data', summaryType: 'sum', caption: 'Toplam' }
    ],
    pivotFieldMappings: {
        MudurlukAdi: ['MudurlukAdi', 'Departman'],
        UretimYeri: ['UretimYeri', 'BekletenSirket']
    },
};

document.addEventListener('DOMContentLoaded', function() {
    if (!window.rapor) {
        window.rapor = new RaporModul(qdmsSchema);
        window.rapor.init();
    }
});
