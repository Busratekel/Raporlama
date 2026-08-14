// QDMS — field/dataField = Fact_QDMS kolon adı (birebir)
// | Amaç              | field / dataField                              |
// | Durum             | Durum                                          |
// | Müdürlük          | Sisteme Girenin Müdürlük/Direktörlüğü          |
// | Tip               | Tip                                            |
// | Sorumlu birim     | Sorumlu Birim                                  |
// | Gecikti mi?       | Gecikti mi?                                    |
// | Sisteme giren     | Sisteme Giren Kişi                             |
// | İşi yapacak       | İşi Yapacak                                    |
// | Başlama / Bitiş   | Başlama Tarihi / Bitiş Tarihi                  |
// | Aksiyon no        | Ana Aksiyon No                                 |
// | Kalem             | Kalem No                                       |
// | Gün               | Gün Sayısı                                     |
// | Sicil (gizli)     | Sisteme Giren                                  |
// | Müdürlük kodu     | Sisteme Girenin Müdürlük/Direktörlük Kodu       |
const qdmsF = {
    durum: 'Durum',
    mudurluk: 'Sisteme Girenin Müdürlük/Direktörlüğü',
    tip: 'Tip',
    sorumluBirim: 'Sorumlu Birim',
    geciktiMi: 'Gecikti mi?',
    sistemeGirenKisi: 'Sisteme Giren Kişi',
    isiYapacak: 'İşi Yapacak',
    baslamaTarihi: 'Başlama Tarihi',
    bitisTarihi: 'Bitiş Tarihi',
    gerceklestirmeTarihi: 'Gerçekleştirme Tarihi',
    anaAksiyonNo: 'Ana Aksiyon No',
    kalemNo: 'Kalem No',
    gunSayisi: 'Gün Sayısı',
    sistemeGiren: 'Sisteme Giren',
    mudurlukKodu: 'Sisteme Girenin Müdürlük/Direktörlük Kodu',
    tanim: 'Tanım',
    gorevlendirmeSebebi: 'Görevlendirme Sebebi'
};

function qdmsFormatDateDisplay(value) {
    if (value == null || value === '') return value;
    const s = String(value).trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
        const [y, m, d] = s.substring(0, 10).split('-');
        return `${d}.${m}.${y}`;
    }
    return value;
}

function qdmsFindFieldValue(row, field) {
    if (!row || !field) return undefined;
    if (row[field] != null && String(row[field]).trim() !== '') return row[field];
    const norm = String(field).toLocaleLowerCase('tr-TR');
    for (const k of Object.keys(row)) {
        if (k.toLocaleLowerCase('tr-TR') === norm) {
            const v = row[k];
            if (v != null && String(v).trim() !== '') return v;
        }
    }
    return undefined;
}

function qdmsNormalizeRow(row) {
    const normalized = { ...row };
    Object.values(qdmsF).forEach(field => {
        const val = qdmsFindFieldValue(row, field);
        if (val !== undefined) normalized[field] = val;
    });
    return normalized;
}

function qdmsEnrichRow(row) {
    const today = new Date().toISOString().split('T')[0];
    const normalized = qdmsNormalizeRow(row);

    let gecikti = normalized[qdmsF.geciktiMi];
    if (gecikti != null && String(gecikti).trim() !== '') {
        const g = String(gecikti).trim().toLowerCase();
        if (g === '1' || g === 'true' || g === 'evet' || g === 'yes' || g === 'e') gecikti = 'Evet';
        else if (g === '0' || g === 'false' || g === 'hayır' || g === 'hayir' || g === 'no' || g === 'h') gecikti = 'Hayır';
        else gecikti = String(gecikti).trim();
    } else {
        gecikti = 'Hayır';
        const bitisVal = normalized[qdmsF.bitisTarihi];
        if (bitisVal) {
            const bitis = String(bitisVal).split('T')[0];
            if (bitis < today) gecikti = 'Evet';
        }
    }

    let gunSayisi = normalized[qdmsF.gunSayisi];
    if ((gunSayisi === '' || gunSayisi == null) && normalized[qdmsF.baslamaTarihi]) {
        const bas = new Date(String(normalized[qdmsF.baslamaTarihi]).split('T')[0]);
        const now = new Date(today);
        if (!isNaN(bas)) {
            gunSayisi = Math.floor((now - bas) / (1000 * 60 * 60 * 24));
        }
    }

    normalized[qdmsF.geciktiMi] = gecikti;
    normalized[qdmsF.gunSayisi] = gunSayisi;

    const gerceklestirme = qdmsFindFieldValue(normalized, qdmsF.gerceklestirmeTarihi);
    if (gerceklestirme != null && String(gerceklestirme).trim() !== '') {
        normalized[qdmsF.gerceklestirmeTarihi] = qdmsFormatDateDisplay(gerceklestirme);
    }

    return normalized;
}

const qdmsPivotResolvers = {
    Adet: () => 1,
    [qdmsF.anaAksiyonNo]: (row) => {
        const v = row[qdmsF.anaAksiyonNo];
        if (v == null) return null;
        return typeof v === 'number' ? String(v) : String(v);
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

const qdmsGunBuckets = [
    { key: '0-7', min: 0, max: 7 },
    { key: '8-15', min: 8, max: 15 },
    { key: '16-30', min: 16, max: 30 },
    { key: '31-60', min: 31, max: 60 },
    { key: '61-180', min: 61, max: 180 },
    { key: '>180', min: 181, max: Infinity }
];

const qdmsSchema = {
    reportKey: 'qdms',
    enrichRow: qdmsEnrichRow,
    pivotValueResolvers: qdmsPivotResolvers,
    beklemeSuresiBuckets: qdmsGunBuckets,
    bucketFilters: {
        [qdmsF.gunSayisi]: {
            buckets: qdmsGunBuckets,
            fields: [qdmsF.gunSayisi]
        }
    },
    filters: [
        { field: qdmsF.durum, elementId: 'filterDurum', label: 'Durum' },
        { field: qdmsF.mudurluk, elementId: 'filterMudurluk', label: 'Müdürlük' },
        { field: qdmsF.tip, elementId: 'filterTip', label: 'Tip' },
        { field: qdmsF.sorumluBirim, elementId: 'filterSirket', label: 'Sorumlu Birim' },
        { field: qdmsF.geciktiMi, elementId: 'filterGecikti', label: 'Gecikti mi?' },
        { field: qdmsF.sistemeGirenKisi, elementId: 'filterKisi', label: 'Sisteme Giren Kişi' },
        { field: qdmsF.isiYapacak, elementId: 'filterIsiYapacak', label: 'İşi Yapacak' },
        { field: qdmsF.baslamaTarihi, elementId: 'filterBaslangic', label: 'Başlama Tarihi', type: 'date', compare: '>=' },
        { field: qdmsF.bitisTarihi, elementId: 'filterBitis', label: 'Bitiş Tarihi', type: 'date', compare: '<=' },
        { field: qdmsF.gerceklestirmeTarihi, elementId: 'filterGerceklestirme', label: 'Gerçekleştirme Tarihi', type: 'date', compare: '=' }
    ],
    columns: [
        { dataField: qdmsF.anaAksiyonNo, caption: 'Ana Aksiyon No', dataType: 'string', forceText: true },
        { dataField: qdmsF.kalemNo, caption: 'Kalem No', dataType: 'string', forceText: true },
        { dataField: qdmsF.sistemeGiren, caption: 'Sicil', visible: false },
        { dataField: qdmsF.mudurlukKodu, caption: 'Müdürlük Kodu', visible: false },
        { dataField: qdmsF.sistemeGirenKisi, caption: 'Sisteme Giren Kişi' },
        { dataField: qdmsF.isiYapacak, caption: 'İşi Yapacak' },
        { dataField: qdmsF.mudurluk, caption: 'Müdürlük', visible: false },
        { dataField: qdmsF.sorumluBirim, caption: 'Sorumlu Birim', visible: false },
        { dataField: qdmsF.durum, caption: 'Durum' },
        { dataField: qdmsF.tip, caption: 'Tip' },
        { dataField: qdmsF.baslamaTarihi, caption: 'Başlama Tarihi' },
        { dataField: qdmsF.bitisTarihi, caption: 'Bitiş Tarihi' },
        { dataField: qdmsF.gerceklestirmeTarihi, caption: 'Gerçekleştirme Tarihi' },
        { dataField: qdmsF.geciktiMi, caption: 'Gecikti mi?' },
        { dataField: qdmsF.gunSayisi, caption: 'Gün Sayısı' },
        { dataField: qdmsF.gorevlendirmeSebebi, caption: 'Görevlendirme Sebebi' },
        { dataField: qdmsF.tanim, caption: 'Tanım' }
    ],
    summaries: [
        { type: 'avg', field: qdmsF.gunSayisi, elementId: '#ortalamaBekleme' },
        {
            type: 'max',
            field: qdmsF.gunSayisi,
            elementId: '#enUzunBekleme',
            detailModal: {
                title: 'En Uzun Gün Sayısı — Kayıt Detayı',
                sortField: qdmsF.gunSayisi,
                sortOrder: 'desc',
                nearMaxMargin: null,
                highlightMax: true,
                columns: [
                    qdmsF.anaAksiyonNo,
                    qdmsF.kalemNo,
                    qdmsF.sistemeGirenKisi,
                    qdmsF.isiYapacak,
                    qdmsF.durum,
                    qdmsF.tip,
                    qdmsF.baslamaTarihi,
                    qdmsF.bitisTarihi,
                    qdmsF.gunSayisi
                ]
            }
        },
        { type: 'count', elementId: '#bekleyenSurec' }
    ],
    charts: [
        { field: qdmsF.durum, elementId: '#durumChart', typeSelector: '#chartTypeDurum', filterElementId: '#filterDurum', defaultType: 'pie', legend: qdmsPieLegend },
        { field: qdmsF.tip, elementId: '#tipChart', typeSelector: '#chartTypeTip', filterElementId: '#filterTip', defaultType: 'pie', legend: qdmsPieLegend },
        { field: qdmsF.mudurluk, elementId: '#mudurlukChart', typeSelector: '#chartTypeMudurluk', filterElementId: '#filterMudurluk', defaultType: 'bar', legend: qdmsPieLegend },
        { field: qdmsF.sorumluBirim, elementId: '#sirketChart', typeSelector: '#chartTypeSirket', filterElementId: '#filterSirket', defaultType: 'pie', legend: qdmsPieLegend },
        { field: qdmsF.sistemeGirenKisi, elementId: '#kisiChart', typeSelector: '#chartTypeKisi', filterElementId: '#filterKisi', defaultType: 'line', limit: 10, legend: qdmsPieLegend },
        { field: qdmsF.isiYapacak, elementId: '#yoneticiChart', typeSelector: '#chartTypeYonetici', filterElementId: '#filterIsiYapacak', defaultType: 'bar', limit: 10, legend: qdmsPieLegend },
        { field: qdmsF.geciktiMi, elementId: '#geciktiChart', typeSelector: '#chartTypeGecikti', filterElementId: '#filterGecikti', defaultType: 'pie', legend: qdmsPieLegend },
        { field: qdmsF.gunSayisi, elementId: '#beklemeChart', typeSelector: '#chartTypeBekleme', defaultType: 'bar', useBuckets: true, legend: qdmsPieLegend }
    ],
    pivotTables: [
        {
            containerId: 'pivotGridContainer',
            fileName: 'HaftalikYillikDagilim',
            texts: { grandTotal: 'Tüm Yılların Toplamı', total: 'O Yıla Ait Alt Toplam' },
            fields: [
                { dataField: qdmsF.mudurluk, area: 'row', caption: 'Müdürlük' },
                { dataField: 'Yil', area: 'column', caption: 'Yıl' },
                { dataField: qdmsF.sorumluBirim, area: 'column', caption: 'Sorumlu Birim' },
                { dataField: 'Hafta', area: 'column', caption: 'Hafta' },
                { dataField: 'Adet', area: 'data', summaryType: 'sum', caption: 'Toplam' }
            ],
            fieldMappings: {
                [qdmsF.mudurluk]: [qdmsF.mudurluk],
                [qdmsF.sorumluBirim]: [qdmsF.sorumluBirim]
            }
        },
        {
            containerId: 'aksiyonPivotGridContainer',
            fileName: 'AksiyonNoDagilimi',
            height: 420,
            fields: [
                { dataField: qdmsF.anaAksiyonNo, area: 'row', caption: 'Ana Aksiyon No' },
                { dataField: qdmsF.durum, area: 'column', caption: 'Durum' },
                { dataField: qdmsF.tip, area: 'column', caption: 'Tip' },
                { dataField: 'Adet', area: 'data', summaryType: 'sum', caption: 'Kayıt Sayısı' }
            ],
            fieldMappings: { [qdmsF.anaAksiyonNo]: [qdmsF.anaAksiyonNo] }
        }
    ]
};

document.addEventListener('DOMContentLoaded', function() {
    if (!window.rapor) {
        window.rapor = new RaporModul(qdmsSchema);
        window.rapor.init();
    }
});
