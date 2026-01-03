// Bekleyen Süreçler için modüler şema ve başlatıcı
window.bekleyenSchema = {
        // Bekleme süresi için bucket tanımı (grafiklerde ve filtrede ortak kullanılacak)
        beklemeSuresiBuckets: [
            { key: '0-7', min: 0, max: 7 },
            { key: '16-30', min: 16, max: 30 },
            { key: '31-60', min: 31, max: 60 },
            { key: '61-180', min: 61, max: 180 },
            { key: '>180', min: 181, max: Infinity }
        ],
    reportKey: 'bekleyen',
    filters: [
        { field: 'MudurlukAdi', elementId: 'filterMudurluk', label: 'Müdürlük' },
        { field: 'DirektorlukAdi', elementId: 'filterDirektorluk', label: 'Direktörlük' },
        { field: 'FormAdi', elementId: 'filterForm', label: 'Form Adı' },
        { field: 'SurecBaslangicTarihi', elementId: 'filterTarihBaslangic', label: 'Başlangıç Tarihi', type: 'date', compare: '>=' },
        { field: 'SurecBekleteneGelisTarihi', elementId: 'filterTarihBitis', label: 'Bitiş Tarihi', type: 'date', compare: '<=' }
    ],
    summaries: [
        { type: 'count', elementId: '#totalRecords' },
        { type: 'avg', field: 'BekleyenGun', elementId: '#avgDays' },
        { type: 'max', field: 'BekleyenGun', elementId: '#maxDays' },
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
        { dataField: "FormuGonderenBolum", caption: "Formu Dolduran Bölüm" },
        { dataField: "FormuBekletenBolum", caption: "Formu Bekleten Bölüm" },
        { dataField: "FormuDolduranSirketi", caption: "Formu Dolduran Şirket" },
        { dataField: "FormuBekletenSirketi", caption: "Formu Bekleten Şirket" },
        { dataField: "MudurlukAdi", caption: "Müdürlük Adı" },
        { dataField: "SurecBaslangicTarihi", caption: "Süreç Başlangıç Tarihi", dataType: "date", format: "yyyy-MM-dd" },
        { dataField: "SurecBekleteneGelisTarihi", caption: "Süreç Bekletene Geliş Tarihi", dataType: "date", format: "yyyy-MM-dd" }
    ],
    charts: [
        {
            field: 'FormuDolduranSirketi',
            elementId: '#pieChart',
            typeSelector: '#chartTypeDolduran',
            filterElementId: '#filterDolduranSirket',
            defaultType: 'pie',
            // palette: ['#00eaff', '#00bfae', '#0081a7', '#005f73'],
            legend: {
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
            }
        },
        {
            field: 'FormuBekletenSirketi',
            elementId: '#pieChartBekleten',
            typeSelector: '#chartTypeBekleten',
            filterElementId: '#filterBekletenSirket',
            defaultType: 'pie',
            // palette: ['#ff9800', '#ffb300', '#ff6f00', '#c43e00'],
            legend: {
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
            }
        },
        {
            field: 'MudurlukAdi',
            elementId: '#mudurlukChart',
            typeSelector: '#chartTypeMudurluk',
            filterElementId: '#filterMudurluk',
            defaultType: 'pie',
            // palette: ['#2196f3', '#e91e63', '#ff9800', '#4caf50'],
            legend: {
                visible: true,
                orientation: 'horizontal',
                itemTextPosition: 'right',
                columnCount: 3,
                paddingLeftRight: 8,
                paddingTopBottom: 8,
                font: { size: 13 },
                margin: 40,
                verticalAlignment: 'bottom',
                horizontalAlignment: 'center'
            }
        },
        {
            field: 'FormAdi',
            elementId: '#formChart',
            typeSelector: '#chartTypeForm',
            filterElementId: '#filterForm',
            defaultType: 'pie',
            // palette: ['#607d8b', '#795548', '#ff5722', '#009688'],
            legend: {
                visible: true,
                orientation: 'horizontal',
                itemTextPosition: 'right',
                columnCount: 4,
                paddingLeftRight: 8,
                paddingTopBottom: 8,
                font: { size: 13 },
                margin: 40,
                verticalAlignment: 'bottom',
                horizontalAlignment: 'center'
            }
        },
        {
            field: 'BekleyenGun',
            elementId: '#lineChart',
            typeSelector: '#chartTypeBekleme',
            filterElementId: '#filterBucket',
            defaultType: 'bar',
            // palette: ['#ff4081', '#ff79b0', '#c60055', '#ffb3de'],
            legend: {
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
            }
        },
        {
            field: 'FormuDolduran',
            elementId: '#personChartDolduran',
            typeSelector: '#chartTypePersonDolduran',
            filterElementId: '#filterDolduranKisi',
            defaultType: 'bar',
            // palette: ['#00eaff', '#00bfae', '#0081a7', '#005f73'],
            legend: {
                visible: true,
                orientation: 'horizontal',
                itemTextPosition: 'right',
                columnCount: 3,
                paddingLeftRight: 8,
                paddingTopBottom: 8,
                font: { size: 13 },
                margin: 40,
                verticalAlignment: 'bottom',
                horizontalAlignment: 'center'
            }
        },
        {
            field: 'FormuBekleten',
            elementId: '#personChartBekleten',
            typeSelector: '#chartTypePersonBekleten',
            filterElementId: '#filterBekletenKisi',
            defaultType: 'bar',
            // palette: ['#ff9800', '#ffb300', '#ff6f00', '#c43e00'],
            legend: {
                visible: true,
                orientation: 'horizontal',
                itemTextPosition: 'right',
                columnCount: 3,
                paddingLeftRight: 8,
                paddingTopBottom: 8,
                font: { size: 13 },
                margin: 40,
                verticalAlignment: 'bottom',
                horizontalAlignment: 'center'
            }
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
