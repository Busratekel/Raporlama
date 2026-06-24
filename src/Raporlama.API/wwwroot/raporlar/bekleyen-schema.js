// EBA Bekleyen Süreçler — QDMS ile aynı mimari: schema + raporModul.js (ayrı bekleyen.js yok)

function bekleyenEnrichRow(row) {
    const normalized = { ...row };
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (row.SurecBaslangicTarihi) {
        const bas = new Date(String(row.SurecBaslangicTarihi).split('T')[0]);
        if (!isNaN(bas)) {
            bas.setHours(0, 0, 0, 0);
            normalized.YasamDongusu = Math.floor((today - bas) / 86400000);
        }
    }

    if (normalized.BekleyenGun != null && normalized.BekleyenGun !== '') {
        const n = Number(normalized.BekleyenGun);
        if (!isNaN(n)) normalized.BekleyenGun = n;
    }

    return normalized;
}

const bekleyenBeklemeBuckets = [

    { key: '0-7', min: 0, max: 7 },

    { key: '8-15', min: 8, max: 15 },

    { key: '16-30', min: 16, max: 30 },

    { key: '31-60', min: 31, max: 60 },

    { key: '61-180', min: 61, max: 180 },

    { key: '>180', min: 181, max: Infinity }

];



const bekleyenPieLegend = {

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



window.bekleyenSchema = {

    reportKey: 'bekleyen',

    enrichRow: bekleyenEnrichRow,

    beklemeSuresiBuckets: bekleyenBeklemeBuckets,

    bucketFilters: {

        BekleyenGun: {

            buckets: bekleyenBeklemeBuckets,

            fields: ['BekleyenGun']

        }

    },

    filters: [

        { field: 'MudurlukAdi', elementId: 'filterMudurluk', label: 'Müdürlük' },

        { field: 'DirektorlukAdi', elementId: 'filterDirektorluk', label: 'Direktörlük' },

        { field: 'FormuDolduranSirketi', elementId: 'filterDolduranSirket', label: 'Dolduran Şirket' },

        { field: 'FormuBekletenSirketi', elementId: 'filterBekletenSirket', label: 'Bekleten Şirket' },

        { field: 'FormAdi', elementId: 'filterForm', label: 'Form Adı' },

        { field: 'FormuDolduran', elementId: 'filterDolduranKisi', label: 'Dolduran Kişi' },

        { field: 'FormuBekleten', elementId: 'filterBekletenKisi', label: 'Bekleten Kişi' },

        { field: 'SurecBaslangicTarihi', elementId: 'filterTarihBaslangic', label: 'Başlangıç Tarihi', type: 'date', compare: '>=' },

        { field: 'SurecBekleteneGelisTarihi', elementId: 'filterTarihBitis', label: 'Bitiş Tarihi', type: 'date', compare: '<=' }

    ],

    summaries: [

        { type: 'count', elementId: '#totalRecords' },

        { type: 'avg', field: 'BekleyenGun', elementId: '#avgDays' },

        {
            type: 'max',
            field: 'BekleyenGun',
            elementId: '#maxDays',
            detailModal: {
                title: 'En Uzun Bekleme (Gün) — Kayıt Detayı',
                sortField: 'BekleyenGun',
                sortOrder: 'desc',
                nearMaxMargin: null,
                highlightMax: true,
                columns: [
                    'SurecNo',
                    'FormAdi',
                    'FormuDolduran',
                    'FormuBekleten',
                    'SurecBaslangicTarihi',
                    'SurecBekleteneGelisTarihi',
                    'BekleyenGun'
                ]
            }
        },

        { type: 'count', elementId: '#acilGun', calc: function(data) {

            const bugun = new Date().toISOString().split('T')[0];

            return data.filter(d => d.EklenmeTarihi && d.EklenmeTarihi.startsWith(bugun)).length;

        } }

    ],

    columns: [

        { dataField: "SurecNo", caption: "Süreç No" },

        { dataField: "FormAdi", caption: "Form Adı" },

        { dataField: "FormuDolduran", caption: "Formu Dolduran Kişi" },

        { dataField: "FormuBekleten", caption: "Formu Bekleten Kişi" },

        { dataField: "FormuGonderenBolum", caption: "Formu Dolduran Bölüm",visible: false },

        { dataField: "FormuBekletenBolum", caption: "Formu Bekleten Bölüm", visible: false },

        { dataField: "FormuDolduranSirketi", caption: "Formu Dolduran Şirket", visible: false },

        { dataField: "FormuBekletenSirketi", caption: "Formu Bekleten Şirket", visible: false },

        { dataField: "MudurlukAdi", caption: "Bekleten Müdürlük Adı", visible: false },

        { dataField: "SurecBaslangicTarihi", caption: "Süreç Başlangıç Tarihi", dataType: "date", format: "yyyy-MM-dd" },

        { dataField: "SurecBekleteneGelisTarihi", caption: "Süreç Bekletene Geliş Tarihi", dataType: "date", format: "yyyy-MM-dd" },

        { dataField: "YasamDongusu", caption: "Yaşam Döngüsü", dataType: "number" },

        { dataField: "BekleyenGun", caption: "Bekleyen Gün", dataType: "number" }

    ],

    charts: [

        {

            field: 'FormuDolduranSirketi',

            elementId: '#pieChart',

            typeSelector: '#chartTypeDolduran',

            filterElementId: '#filterDolduranSirket',

            defaultType: 'pie',

            legend: bekleyenPieLegend

        },

        {

            field: 'FormuBekletenSirketi',

            elementId: '#pieChartBekleten',

            typeSelector: '#chartTypeBekleten',

            filterElementId: '#filterBekletenSirket',

            defaultType: 'pie',

            legend: bekleyenPieLegend

        },

        {

            field: 'BekleyenGun',

            elementId: '#lineChart',

            typeSelector: '#chartTypeBekleme',

            defaultType: 'bar',

            useBuckets: true,

            legend: bekleyenPieLegend

        },

        {

            field: 'FormuDolduran',

            elementId: '#personChartDolduran',

            typeSelector: '#chartTypePersonDolduran',

            filterElementId: '#filterDolduranKisi',

            defaultType: 'bar',

            limit: 15,

            legend: bekleyenPieLegend

        },

        {

            field: 'FormuBekleten',

            elementId: '#personChartBekleten',

            typeSelector: '#chartTypePersonBekleten',

            filterElementId: '#filterBekletenKisi',

            defaultType: 'bar',

            limit: 15,

            legend: bekleyenPieLegend

        },

        {

            field: 'MudurlukAdi',

            elementId: '#mudurlukChart',

            typeSelector: '#chartTypeMudurluk',

            filterElementId: '#filterMudurluk',

            defaultType: 'pie',

            legend: bekleyenPieLegend

        },

        {

            field: 'FormAdi',

            elementId: '#formChart',

            typeSelector: '#chartTypeForm',

            filterElementId: '#filterForm',

            defaultType: 'bar',

            limit: 15,

            legend: bekleyenPieLegend

        }

    ],

    pivotFields: [

        { dataField: "Mudurluk", area: "row", caption: "Müdürlük" },

        { dataField: "UretimYeri", area: "row", caption: "Üretim Yeri" },

        { dataField: "Yil", area: "column", caption: "Yıl" },

        { dataField: "Hafta", area: "column", caption: "Hafta" },

        { dataField: "Adet", area: "data", summaryType: "sum", caption: "Toplam" }

    ],

    pivotFieldMappings: {

        Mudurluk: ["MudurlukAdi"],

        UretimYeri: ["UretimYeri", "UretimYeriAdi"]

    }

};



document.addEventListener('DOMContentLoaded', function() {

    if (!window.rapor) {

        window.rapor = new RaporModul(bekleyenSchema);

        window.rapor.init();

    }

});

