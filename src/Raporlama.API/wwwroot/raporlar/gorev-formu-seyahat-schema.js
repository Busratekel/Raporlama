// Görev Formu Personel Seyahat — Fact_GorevFormuPersonelDetay kolon adları (birebir)

const gfF = {
    sicil: 'Sicil',
    personel: 'İzne Giden Personel',
    unvan: 'Ünvan',
    departman: 'Departman',
    uretimYeri: 'Üretim Yeri',
    baslangic: 'Seyahat Başlangıç Tarihi',
    bitis: 'Seyahat Bitiş Tarihi',
    vekalet: 'Vekalet Edecek Personel',
    tip: 'Seyahat Tipi',
    gidilenYer: 'Gidilen Yer',
    sebep: 'Seyahat Sebebi',
    aciklama: 'Açıklama'
};

function gfParseTrDate(value) {
    if (value == null || value === '') return null;
    const s = String(value).trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.substring(0, 10);
    const m = s.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})/);
    if (m) {
        const d = m[1].padStart(2, '0');
        const mo = m[2].padStart(2, '0');
        return `${m[3]}-${mo}-${d}`;
    }
    const dt = new Date(s);
    if (!isNaN(dt)) return dt.toISOString().split('T')[0];
    return null;
}

function gfFormatTrDate(iso) {
    if (!iso) return '';
    const [y, m, d] = iso.split('-');
    return `${d}.${m}.${y}`;
}

function gfDayDiff(basIso, bitIso) {
    if (!basIso || !bitIso) return null;
    const a = new Date(basIso);
    const b = new Date(bitIso);
    if (isNaN(a) || isNaN(b)) return null;
    return Math.round((b - a) / 86400000) + 1;
}

function gfFindFieldValue(row, field) {
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

function gfEnrichRow(row) {
    const normalized = { ...row };
    Object.values(gfF).forEach(field => {
        const val = gfFindFieldValue(row, field);
        if (val !== undefined) normalized[field] = val;
    });

    const basIso = gfParseTrDate(normalized[gfF.baslangic]);
    const bitIso = gfParseTrDate(normalized[gfF.bitis]);
    normalized.SeyahatBaslangicIso = basIso || '';
    normalized.SeyahatBitisIso = bitIso || '';
    normalized.SeyahatGun = gfDayDiff(basIso, bitIso);
    if (basIso) normalized.AyYil = basIso.substring(0, 7);

    if (basIso) normalized[gfF.baslangic] = gfFormatTrDate(basIso);
    if (bitIso) normalized[gfF.bitis] = gfFormatTrDate(bitIso);
    gfSetYilHafta(normalized, basIso);

    return normalized;
}

function gfSetYilHafta(row, isoDate) {
    if (!isoDate) return;
    const dt = new Date(isoDate);
    if (isNaN(dt)) return;
    row.Yil = dt.getFullYear();
    const jan1 = new Date(dt.getFullYear(), 0, 1);
    const days = Math.floor((dt - jan1) / 86400000);
    row.Hafta = Math.ceil((days + jan1.getDay() + 1) / 7);
}

function gfDistinctCount(data, field) {
    const set = new Set();
    data.forEach(d => {
        const v = d[field];
        if (v != null && String(v).trim() !== '') set.add(String(v).trim());
    });
    return set.size;
}

function gfAvgGun(data) {
    const vals = data.map(d => d.SeyahatGun).filter(n => Number.isFinite(n));
    if (!vals.length) return null;
    return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10;
}

function gfIsYurtIci(row) {
    return String(row[gfF.tip] || '').toLocaleLowerCase('tr-TR').includes('yurt');
}

function gfTopPersonelRows(data, topN) {
    const byPerson = new Map();
    data.forEach(d => {
        const key = String(d[gfF.personel] || '').trim();
        if (!key) return;
        if (!byPerson.has(key)) {
            byPerson.set(key, { ...d, PersonelSeyahatSayisi: 1 });
            return;
        }
        const cur = byPerson.get(key);
        cur.PersonelSeyahatSayisi++;
        if ((d.SeyahatBaslangicIso || '') > (cur.SeyahatBaslangicIso || '')) {
            const cnt = cur.PersonelSeyahatSayisi;
            Object.assign(cur, d);
            cur.PersonelSeyahatSayisi = cnt;
        }
    });
    return [...byPerson.values()]
        .sort((a, b) => b.PersonelSeyahatSayisi - a.PersonelSeyahatSayisi)
        .slice(0, topN);
}

function gfKpiDetayAltYazi(opts) {
    const { filterRows, siralama = 'sıralı', kapsam } = opts;
    return (rows, _val, modul) => {
        const all = modul?.filteredWithCalculated || modul?.filtered || [];
        let havuz = all;
        if (typeof filterRows === 'function') {
            havuz = filterRows([...all], null, modul);
        }
        const toplam = havuz.length;
        const gosterilen = rows.length;
        const kapsamMetni = kapsam ? `${kapsam}. ` : '';
        if (toplam === 0) return 'Seçili filtrelere uygun kayıt yok.';
        if (gosterilen >= toplam) {
            return `${kapsamMetni}Toplam ${toplam.toLocaleString('tr-TR')} kayıt — ${siralama}.`;
        }
        return `${kapsamMetni}Toplam ${toplam.toLocaleString('tr-TR')} kayıt var; ${siralama} en yüksek ${gosterilen.toLocaleString('tr-TR')} tanesi listeleniyor.`;
    };
}

const gfKpiTop10Cols = [
    gfF.personel,
    gfF.sicil,
    gfF.unvan,
    gfF.departman,
    gfF.uretimYeri,
    gfF.baslangic,
    gfF.bitis,
    'SeyahatGun',
    gfF.gidilenYer,
    gfF.sebep,
    gfF.tip,
    gfF.vekalet,
    gfF.aciklama
];

function gfBuildAylikTrend(rows) {
    const grouped = new Map();
    rows.forEach(d => {
        const ay = d.AyYil;
        if (!ay) return;
        grouped.set(ay, (grouped.get(ay) || 0) + 1);
    });
    return [...grouped.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([monthKey, value]) => ({
            argument: monthKey.split('-').reverse().join('.'),
            value,
            monthKey,
            filterValue: monthKey
        }));
}

const gfPieLegend = {
    visible: true,
    orientation: 'horizontal',
    itemTextPosition: 'right',
    columnCount: 2,
    paddingLeftRight: 12,
    paddingTopBottom: 12,
    font: { size: 10 },
    margin: 24,
    verticalAlignment: 'bottom',
    horizontalAlignment: 'center'
};

const gfGunBuckets = [
    { key: '1 gün', min: 1, max: 1 },
    { key: '2-3 gün', min: 2, max: 3 },
    { key: '4-7 gün', min: 4, max: 7 },
    { key: '8-14 gün', min: 8, max: 14 },
    { key: '15+ gün', min: 15, max: Infinity }
];

const gorevFormuSeyahatSchema = {
    reportKey: 'gorev-formu-seyahat',
    enrichRow: gfEnrichRow,
    summaryColumnLabels: {
        [gfF.personel]: 'İzne Giden Personel',
        [gfF.sicil]: 'Sicil',
        [gfF.unvan]: 'Ünvan',
        [gfF.departman]: 'Departman',
        [gfF.uretimYeri]: 'Üretim Yeri',
        [gfF.baslangic]: 'Başlangıç Tarihi',
        [gfF.bitis]: 'Bitiş Tarihi',
        SeyahatGun: 'Süre (gün)',
        PersonelSeyahatSayisi: 'Seyahat Sayısı',
        [gfF.gidilenYer]: 'Gidilen Yer',
        [gfF.sebep]: 'Seyahat Sebebi',
        [gfF.tip]: 'Seyahat Tipi',
        [gfF.vekalet]: 'Vekalet Personeli',
        [gfF.aciklama]: 'Açıklama'
    },
    pivotValueResolvers: { Adet: () => 1 },
    beklemeSuresiBuckets: gfGunBuckets,
    bucketFilters: {
        SeyahatGun: { buckets: gfGunBuckets, fields: ['SeyahatGun'] }
    },
    virtualFilters: {
        AyYil: { fields: ['AyYil'] }
    },
    filters: [
        { field: gfF.departman, elementId: 'filterDepartman', label: 'Departman' },
        { field: gfF.unvan, elementId: 'filterUnvan', label: 'Ünvan' },
        { field: gfF.uretimYeri, elementId: 'filterUretimYeri', label: 'Üretim Yeri' },
        { field: gfF.personel, elementId: 'filterPersonel', label: 'İzne Giden Personel' },
        { field: gfF.tip, elementId: 'filterSeyahatTipi', label: 'Seyahat Tipi' },
        { field: gfF.sebep, elementId: 'filterSebep', label: 'Seyahat Sebebi' },
        { field: 'SeyahatBaslangicIso', elementId: 'filterBaslangic', label: 'Başlangıç Tarihi', type: 'date', compare: '>=' },
        { field: 'SeyahatBitisIso', elementId: 'filterBitis', label: 'Bitiş Tarihi', type: 'date', compare: '<=' }
    ],
    summaries: [
        {
            elementId: '#totalSeyahat',
            calc: (data) => data.length.toLocaleString('tr-TR'),
            detailModal: {
                title: 'Seyahat Kayıtları — Detay',
                sortField: 'SeyahatBaslangicIso',
                sortOrder: 'desc',
                topN: 10,
                subtitle: gfKpiDetayAltYazi({
                    siralama: 'Başlangıç tarihine göre',
                    kapsam: 'Filtredeki seyahat kayıtları'
                }),
                columns: gfKpiTop10Cols
            }
        },
        {
            elementId: '#totalPersonel',
            calc: (data) => gfDistinctCount(data, gfF.personel).toLocaleString('tr-TR'),
            detailModal: {
                title: 'İzne Giden Personel — Top 10',
                sortField: 'PersonelSeyahatSayisi',
                sortOrder: 'desc',
                topN: 10,
                filterRows: (data) => gfTopPersonelRows(data, 10),
                subtitle: (rows, val, modul) => {
                    const all = modul?.filteredWithCalculated || modul?.filtered || [];
                    const distinct = gfDistinctCount(all, gfF.personel);
                    return `Filtrede ${distinct.toLocaleString('tr-TR')} farklı personel var; seyahat sayısına göre en yüksek ${rows.length.toLocaleString('tr-TR')} kişi listeleniyor.`;
                },
                columns: [
                    gfF.personel,
                    gfF.sicil,
                    gfF.unvan,
                    gfF.departman,
                    'PersonelSeyahatSayisi',
                    gfF.baslangic,
                    gfF.gidilenYer,
                    gfF.sebep
                ]
            }
        },
        {
            elementId: '#ortSeyahatGun',
            calc: (data) => {
                const avg = gfAvgGun(data);
                return avg != null ? avg.toLocaleString('tr-TR') : '-';
            },
            detailModal: {
                title: 'En Uzun Süreli Seyahatler — Top 10',
                sortField: 'SeyahatGun',
                sortOrder: 'desc',
                topN: 10,
                subtitle: gfKpiDetayAltYazi({
                    siralama: 'Süre (gün) en uzun',
                    kapsam: 'Filtredeki seyahat kayıtları'
                }),
                columns: gfKpiTop10Cols
            }
        },
        {
            elementId: '#yurtIciSayisi',
            calc: (data) => data.filter(d => gfIsYurtIci(d)).length.toLocaleString('tr-TR'),
            detailModal: {
                title: 'Yurt İçi Seyahatler — Top 10',
                sortField: 'SeyahatBaslangicIso',
                sortOrder: 'desc',
                topN: 10,
                filterRows: (data) => data.filter(d => gfIsYurtIci(d)),
                subtitle: gfKpiDetayAltYazi({
                    filterRows: (data) => data.filter(d => gfIsYurtIci(d)),
                    siralama: 'Başlangıç tarihine göre',
                    kapsam: 'Yurt içi seyahat kayıtları'
                }),
                columns: gfKpiTop10Cols
            }
        }
    ],
    columns: [
        { dataField: gfF.sicil, caption: 'Sicil', forceText: true },
        { dataField: gfF.personel, caption: 'İzne Giden Personel' },
        { dataField: gfF.unvan, caption: 'Ünvan' },
        { dataField: gfF.departman, caption: 'Departman' },
        { dataField: gfF.uretimYeri, caption: 'Üretim Yeri' },
        { dataField: gfF.baslangic, caption: 'Seyahat Başlangıç' },
        { dataField: gfF.bitis, caption: 'Seyahat Bitiş' },
        { dataField: 'SeyahatGun', caption: 'Süre (gün)', dataType: 'number' },
        { dataField: gfF.vekalet, caption: 'Vekalet Edecek Personel' },
        { dataField: gfF.tip, caption: 'Seyahat Tipi' },
        { dataField: gfF.gidilenYer, caption: 'Gidilen Yer' },
        { dataField: gfF.sebep, caption: 'Seyahat Sebebi' },
        { dataField: gfF.aciklama, caption: 'Açıklama' }
    ],
    charts: [
        {
            field: gfF.personel,
            elementId: '#personelChart',
            typeSelector: '#chartTypePersonel',
            filterElementId: '#filterPersonel',
            defaultType: 'bar',
            limit: 20,
            legend: { visible: false }
        },
        {
            field: gfF.tip,
            elementId: '#tipChart',
            typeSelector: '#chartTypeTip',
            filterElementId: '#filterSeyahatTipi',
            defaultType: 'pie',
            limit: 0,
            legend: gfPieLegend
        },
        {
            field: gfF.sebep,
            elementId: '#sebepChart',
            typeSelector: '#chartTypeSebep',
            filterElementId: '#filterSebep',
            defaultType: 'bar',
            limit: 0,
            legend: gfPieLegend
        },
        {
            field: gfF.gidilenYer,
            elementId: '#gidilenYerChart',
            typeSelector: '#chartTypeGidilenYer',
            filterElementId: '#filterGidilenYer',
            defaultType: 'bar',
            limit: 10,
            legend: gfPieLegend
        },
        {
            field: gfF.departman,
            elementId: '#departmanChart',
            typeSelector: '#chartTypeDepartman',
            filterElementId: '#filterDepartman',
            defaultType: 'bar',
            limit: 0,
            legend: gfPieLegend
        },
        {
            elementId: '#aylikTrendChart',
            typeSelector: '#chartTypeAylik',
            defaultType: 'line',
            buildData: gfBuildAylikTrend,
            chartClickFilter: { field: 'AyYil', valueKey: 'monthKey' },
            seriesName: 'Seyahat Sayısı',
            legend: { visible: false }
        },
        {
            field: 'SeyahatGun',
            elementId: '#sureChart',
            typeSelector: '#chartTypeSure',
            defaultType: 'bar',
            useBuckets: true,
            bucketLabelSuffix: '',
            seriesName: 'Kayıt Sayısı',
            legend: gfPieLegend
        }
    ],
    pivotTables: [
        {
            containerId: 'yillikPivotGridContainer',
            fileName: 'DepartmanYillikDagilim',
            texts: { grandTotal: 'Tüm Yılların Toplamı', total: 'O Yıla Ait Alt Toplam' },
            fields: [
                { dataField: gfF.departman, area: 'row', caption: 'Departman' },
                { dataField: 'Yil', area: 'column', caption: 'Yıl' },
                { dataField: 'Hafta', area: 'column', caption: 'Hafta' },
                { dataField: 'Adet', area: 'data', summaryType: 'sum', caption: 'Toplam' }
            ],
            fieldMappings: {
                [gfF.departman]: [gfF.departman]
            }
        }
    ]
};

document.addEventListener('DOMContentLoaded', function () {
    if (!window.rapor) {
        window.rapor = new RaporModul(gorevFormuSeyahatSchema);
        window.rapor.init();
    }
});
