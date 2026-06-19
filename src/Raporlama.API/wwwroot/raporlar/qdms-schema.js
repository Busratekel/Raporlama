// QDMS raporu için şema
function qdmsEnrichRow(row) {
    const today = new Date().toISOString().split('T')[0];
    const normalized = { ...row };

    let gecikti = row.GeciktiMi;
    if (gecikti != null && String(gecikti).trim() !== '') {
        const g = String(gecikti).trim().toLowerCase();
        if (g === '1' || g === 'true' || g === 'evet' || g === 'yes') gecikti = 'Evet';
        else if (g === '0' || g === 'false' || g === 'hayır' || g === 'hayir' || g === 'no') gecikti = 'Hayır';
        else gecikti = String(gecikti).trim();
    } else {
        gecikti = 'Hayır';
        if (row.BitisTarihi) {
            const bitis = String(row.BitisTarihi).split('T')[0];
            if (bitis < today) gecikti = 'Evet';
        }
    }

    let beklemeGun = row.BeklemeGun ?? row.BekleyenGun ?? '';
    if ((beklemeGun === '' || beklemeGun == null) && row.BaslamaTarihi) {
        const bas = new Date(String(row.BaslamaTarihi).split('T')[0]);
        const now = new Date(today);
        if (!isNaN(bas)) {
            beklemeGun = Math.floor((now - bas) / (1000 * 60 * 60 * 24));
        }
    }

    let gecikmeGun = row.GecikmeGun ?? '';
    if ((gecikmeGun === '' || gecikmeGun == null) && row.BitisTarihi) {
        const bitis = new Date(String(row.BitisTarihi).split('T')[0]);
        const now = new Date(today);
        if (!isNaN(bitis) && !isNaN(now)) {
            gecikmeGun = Math.floor((bitis - now) / (1000 * 60 * 60 * 24));
        }
    }

    normalized.GeciktiMi = gecikti;
    normalized.BeklemeGun = beklemeGun;
    normalized.GecikmeGun = gecikmeGun;
    return normalized;
}

const qdmsPivotResolvers = {
    Adet: () => 1,
    Aksiyon: (row) => {
        const v = row.Aksiyon;
        if (v == null) return null;
        if (typeof v === 'number') return String(v);
        return String(v);
    }
};

const qdmsPieLegend = {
    visible: true,
    orientation: 'horizontal',
    itemTextPosition: 'right',
    columnCount: 3,
    paddingLeftRight: 16,
    paddingTopBottom: 16,
    font: { size: 10 },
    margin: 32,
    verticalAlignment: 'bottom',
    horizontalAlignment: 'center'
};

const qdmsSchema = {
    reportKey: 'qdms',
    enrichRow: qdmsEnrichRow,
    pivotValueResolvers: qdmsPivotResolvers,
    beklemeSuresiBuckets: [
        { key: '0-7', min: 0, max: 7 },
        { key: '8-15', min: 8, max: 15 },
        { key: '16-30', min: 16, max: 30 },
        { key: '31-60', min: 31, max: 60 },
        { key: '61-180', min: 61, max: 180 },
        { key: '>180', min: 181, max: Infinity }
    ],
    bucketFilters: {
        BeklemeGun: {
            buckets: [
                { key: '0-7', min: 0, max: 7 },
                { key: '8-15', min: 8, max: 15 },
                { key: '16-30', min: 16, max: 30 },
                { key: '31-60', min: 31, max: 60 },
                { key: '61-180', min: 61, max: 180 },
                { key: '>180', min: 181, max: Infinity }
            ],
            fields: ['BeklemeGun', 'BekleyenGun']
        }
    },
    filters: [
        { field: 'Durum', elementId: 'filterDurum', label: 'Durum' },
        { field: 'MudurlukAdi', elementId: 'filterMudurluk', label: 'Müdürlük' },
        { field: 'Tip', elementId: 'filterTip', label: 'Tip' },
        { field: 'BekletenSirket', elementId: 'filterSirket', label: 'Şirket' },
        { field: 'GeciktiMi', elementId: 'filterGecikti', label: 'Gecikti mi?' },
        { field: 'BekletenAdSoyad', elementId: 'filterKisi', label: 'Bekleten Kişi' },
        { field: 'SorumluAdSoyad', elementId: 'filterYonetici', label: 'Yönetici' },
        { field: 'BaslamaTarihi', elementId: 'filterBaslangic', label: 'Başlangıç Tarihi', type: 'date', compare: '>=' },
        { field: 'BitisTarihi', elementId: 'filterBitis', label: 'Bitiş Tarihi', type: 'date', compare: '<=' },
    ],
    columns: [
        { dataField: 'BekletenSirket', caption: 'Şirket' },
        { dataField: 'Aksiyon', caption: 'Aksiyon No', dataType: 'string', forceText: true },
        { dataField: 'KalemNo', caption: 'Kalem No', dataType: 'string', forceText: true },
        { dataField: 'BekletenSicilNo', caption: 'Sicil' },
        { dataField: 'BekletenAdSoyad', caption: 'Ad Soyad' },
        { dataField: 'SorumluAdSoyad', caption: 'Yönetici' },
        { dataField: 'MudurlukAdi', caption: 'Müdürlük' },
        { dataField: 'Durum', caption: 'Durum' },
        { dataField: 'Tip', caption: 'Tip' },
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
        {
            field: 'Durum',
            elementId: '#durumChart',
            typeSelector: '#chartTypeDurum',
            filterElementId: '#filterDurum',
            defaultType: 'pie',
            legend: qdmsPieLegend
        },
        {
            field: 'Tip',
            elementId: '#tipChart',
            typeSelector: '#chartTypeTip',
            filterElementId: '#filterTip',
            defaultType: 'pie',
            legend: qdmsPieLegend
        },
        {
            field: 'MudurlukAdi',
            elementId: '#mudurlukChart',
            typeSelector: '#chartTypeMudurluk',
            filterElementId: '#filterMudurluk',
            defaultType: 'bar',
            legend: qdmsPieLegend
        },
        {
            field: 'BekletenSirket',
            elementId: '#sirketChart',
            typeSelector: '#chartTypeSirket',
            filterElementId: '#filterSirket',
            defaultType: 'pie',
            legend: qdmsPieLegend
        },
        {
            field: 'BekletenAdSoyad',
            elementId: '#kisiChart',
            typeSelector: '#chartTypeKisi',
            filterElementId: '#filterKisi',
            defaultType: 'line',
            limit: 15,
            legend: qdmsPieLegend
        },
        {
            field: 'SorumluAdSoyad',
            elementId: '#yoneticiChart',
            typeSelector: '#chartTypeYonetici',
            filterElementId: '#filterYonetici',
            defaultType: 'bar',
            limit: 15,
            legend: qdmsPieLegend
        },
        {
            field: 'GeciktiMi',
            elementId: '#geciktiChart',
            typeSelector: '#chartTypeGecikti',
            filterElementId: '#filterGecikti',
            defaultType: 'pie',
            legend: qdmsPieLegend
        },
        {
            field: 'BeklemeGun',
            elementId: '#beklemeChart',
            typeSelector: '#chartTypeBekleme',
            defaultType: 'bar',
            useBuckets: true,
            legend: qdmsPieLegend
        }
    ],
    pivotTables: [
        {
            containerId: 'pivotGridContainer',
            fileName: 'HaftalikYillikDagilim',
            texts: {
                grandTotal: 'Tüm Yılların Toplamı',
                total: 'O Yıla Ait Alt Toplam'
            },
            fields: [
                { dataField: 'MudurlukAdi', area: 'row', caption: 'Müdürlük' },
                { dataField: 'Yil', area: 'column', caption: 'Yıl' },
                { dataField: 'UretimYeri', area: 'column', caption: 'Üretim Yeri' },
                { dataField: 'Hafta', area: 'column', caption: 'Hafta' },
                { dataField: 'Adet', area: 'data', summaryType: 'sum', caption: 'Toplam' }
            ],
            fieldMappings: {
                MudurlukAdi: ['MudurlukAdi', 'Departman'],
                UretimYeri: ['UretimYeri', 'BekletenSirket']
            }
        },
        {
            containerId: 'aksiyonPivotGridContainer',
            fileName: 'AksiyonNoDagilimi',
            height: 420,
            fields: [
                { dataField: 'Aksiyon', area: 'row', caption: 'Aksiyon No' },
                { dataField: 'Durum', area: 'column', caption: 'Durum' },
                { dataField: 'Tip', area: 'column', caption: 'Tip' },
                { dataField: 'Adet', area: 'data', summaryType: 'sum', caption: 'Kayıt Sayısı' }
            ],
            fieldMappings: {
                Aksiyon: ['Aksiyon']
            }
        }
    ],
};

document.addEventListener('DOMContentLoaded', function() {
    if (!window.rapor) {
        window.rapor = new RaporModul(qdmsSchema);
        window.rapor.init();
    }
});
