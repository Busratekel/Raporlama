// Satınalma Kabuller — tedarikçi / malzeme / teslimat odaklı dashboard

const skF = {
    werks: 'WERKS',
    ebeln: 'EBELN',
    ebelp: 'EBELP',
    matnr: 'MATNR',
    maktx: 'MAKTX',
    matkl: 'MATKL',
    wgbez: 'WGBEZ',
    lifnr: 'LIFNR',
    name1: 'NAME1',
    netwr: 'NETWR',
    menge: 'MENGE',
    meins: 'MEINS',
    bedat: 'BEDAT',
    eindt: 'EINDT',
    budat: 'BUDAT',
    zzgecgun: 'ZZGECGUN',
    teslmay: 'TESLMAY',
    deliv: 'DELIV',
    waers: 'WAERS',
    ekgrp: 'EKGRP',
    eknam: 'EKNAM',
    zzsorumlu: 'ZZSORUMLU',
    teslimPerformans: 'TeslimPerformans'
};

function skParseNumber(value) {
    if (value == null || value === '') return null;
    const n = Number(String(value).trim().replace(',', '.'));
    return Number.isFinite(n) ? n : null;
}

function skDateOnly(value) {
    if (value == null || value === '') return null;
    return String(value).trim().split('T')[0];
}

function skGecikmeEtiket(gec) {
    if (gec == null || !Number.isFinite(gec)) return '—';
    if (gec < 0) return `${Math.abs(gec)} gün erken`;
    if (gec === 0) return 'Zamanında (0 gün)';
    return `${gec} gün geç`;
}

function skTeslimDurumu(row) {
    const gec = skParseNumber(row[skF.zzgecgun]);
    if (gec != null) {
        if (gec < 0) return 'Erken';
        if (gec === 0) return 'Zamanında';
        return 'Gecikmeli';
    }

    const eindt = skDateOnly(row[skF.eindt]);
    const budat = skDateOnly(row[skF.budat]);
    if (budat && eindt) return budat <= eindt ? 'Zamanında' : 'Gecikmeli';

    const tes = String(row[skF.teslmay] ?? row[skF.deliv] ?? '').trim().toLowerCase();
    if (tes.includes('evet') || tes === 'x' || tes === '1') return 'Zamanında';
    if (tes.includes('hayır') || tes.includes('hayir') || tes === '0') return 'Gecikmeli';

    if (eindt) {
        const today = new Date().toISOString().split('T')[0];
        if (!budat && today > eindt) return 'Gecikmeli (açık)';
        if (!budat) return 'Bekliyor';
    }
    return 'Belirsiz';
}

function skMalzemeEtiket(row) {
    const kod = row[skF.matnr];
    const acik = row[skF.maktx];
    if (kod && acik) return `${kod} — ${acik}`;
    return kod || acik || '—';
}

function skMalGrubuEtiket(row) {
    const acik = row[skF.wgbez];
    if (acik != null && String(acik).trim() !== '') return String(acik).trim();
    const kod = row[skF.matkl];
    return kod != null && String(kod).trim() !== '' ? String(kod).trim() : '—';
}

function skFormatMoney(n) {
    if (!Number.isFinite(n)) return '-';
    return n.toLocaleString('tr-TR', { maximumFractionDigits: 0 });
}

function skFormatMoneyWithCurrency(value, waers) {
    if (!Number.isFinite(value)) return '-';
    const amount = skFormatMoney(value);
    const cur = waers != null && String(waers).trim() !== '' ? String(waers).trim() : '';
    return cur ? `${amount} ${cur}` : amount;
}

function skFormatQty(n) {
    if (!Number.isFinite(n)) return '-';
    return n.toLocaleString('tr-TR', { maximumFractionDigits: 2 });
}

const skMeinsLabels = {
    ADT: 'adet', ST: 'adet', PC: 'adet', PCE: 'adet', EA: 'adet',
    M: 'metre', MTR: 'metre', MT: 'metre',
    KG: 'kg', G: 'gram', GR: 'gram',
    M2: 'm²', M3: 'm³',
    L: 'litre', LT: 'litre', LTR: 'litre'
};

function skMeinsTurkce(meins) {
    if (meins == null || meins === '') return '';
    const k = String(meins).trim().toUpperCase();
    return skMeinsLabels[k] || k.toLowerCase();
}

function skMeinsFilterLabel(meins) {
    const tr = skMeinsTurkce(meins);
    return tr && tr !== meins ? `${meins} — ${tr}` : String(meins);
}

function skFormatMengeWithUnit(value, meins) {
    if (!Number.isFinite(value)) return '-';
    const unit = skMeinsTurkce(meins);
    const code = String(meins || '').trim().toUpperCase();
    const asInteger = ['ADT', 'ST', 'PC', 'PCE', 'EA'].includes(code);
    const n = asInteger
        ? Math.round(value).toLocaleString('tr-TR')
        : value.toLocaleString('tr-TR', { maximumFractionDigits: 2 });
    return unit ? `${n} ${unit}` : n;
}

function skBuildMalzemeMiktarChartData(rows) {
    const grouped = new Map();
    rows.forEach(d => {
        const matnr = String(d[skF.matnr] || '').trim();
        if (!matnr) return;
        const add = skParseNumber(d[skF.menge]) || 0;
        const prev = grouped.get(matnr) || { value: 0, maktx: d[skF.maktx], meins: d[skF.meins] };
        prev.value += add;
        if (!prev.maktx && d[skF.maktx]) prev.maktx = d[skF.maktx];
        if (!prev.meins && d[skF.meins]) prev.meins = d[skF.meins];
        grouped.set(matnr, prev);
    });
    const meins = rows[0]?.[skF.meins] || '';
    return [...grouped.entries()]
        .map(([matnr, o]) => ({
            argument: (o.maktx && String(o.maktx).trim()) || matnr,
            value: o.value,
            meins: o.meins || meins,
            matnr
        }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 15);
}

const skAyAdlari = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];

function skFormatAy(yyyyMm) {
    const parts = String(yyyyMm).split('-');
    if (parts.length < 2) return yyyyMm;
    const y = parts[0];
    const mi = parseInt(parts[1], 10) - 1;
    return `${skAyAdlari[mi] || parts[1]} ${y}`;
}

function skNormalizeTeslimPerf(value) {
    const s = String(value || '').trim();
    if (s === 'Erken') return 'Erken';
    if (s === 'Zamanında') return 'Zamanında';
    if (s.startsWith('Gecikmeli')) return 'Gecikmeli';
    return null;
}

function skBuildAylikBudatTrend(rows) {
    const grouped = new Map();
    rows.forEach(d => {
        const budat = skDateOnly(d[skF.budat]);
        if (!budat) return;
        const month = budat.slice(0, 7);
        grouped.set(month, (grouped.get(month) || 0) + 1);
    });
    return [...grouped.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([monthKey, value]) => ({
            argument: skFormatAy(monthKey),
            value,
            monthKey
        }));
}

function skBuildTedarikciTeslimStacked(rows) {
    const grouped = new Map();
    rows.forEach(d => {
        const name = String(d[skF.name1] || '').trim();
        const perf = skNormalizeTeslimPerf(d[skF.teslimPerformans]);
        if (!name || !perf) return;
        if (!grouped.has(name)) {
            grouped.set(name, { Erken: 0, 'Zamanında': 0, Gecikmeli: 0, total: 0 });
        }
        const g = grouped.get(name);
        g[perf]++;
        g.total++;
    });
    return [...grouped.entries()]
        .sort((a, b) => b[1].total - a[1].total)
        .slice(0, 12)
        .map(([argument, g]) => ({
            argument,
            Erken: g.Erken,
            'Zamanında': g['Zamanında'],
            Gecikmeli: g.Gecikmeli,
            filterValue: argument
        }));
}

function skBuildTedarikciOrtGecikme(rows) {
    const grouped = new Map();
    rows.forEach(d => {
        const name = String(d[skF.name1] || '').trim();
        const gec = skParseNumber(d[skF.zzgecgun]);
        if (!name || gec == null) return;
        if (!grouped.has(name)) grouped.set(name, { sum: 0, count: 0 });
        const g = grouped.get(name);
        g.sum += gec;
        g.count++;
    });
    return [...grouped.entries()]
        .map(([argument, g]) => {
            const avg = Math.round((g.sum / g.count) * 10) / 10;
            let color = '#43a047';
            if (avg > 0) color = '#e53935';
            else if (avg < 0) color = '#29b6f6';
            return { argument, value: avg, color, filterValue: argument };
        })
        .sort((a, b) => b.value - a.value)
        .slice(0, 15);
}

function skFormatGecikmeGun(value) {
    if (!Number.isFinite(value)) return '-';
    const n = value.toLocaleString('tr-TR', { maximumFractionDigits: 1 });
    if (value > 0) return `+${n} gün`;
    if (value < 0) return `${n} gün`;
    return '0 gün';
}

const skWaersPriority = ['TRY', 'EUR', 'USD'];

function skTutarByWaers(data) {
    const byWaers = new Map();
    data.forEach(d => {
        const w = String(d[skF.waers] || '').trim().toUpperCase();
        if (!w) return;
        byWaers.set(w, (byWaers.get(w) || 0) + (skParseNumber(d[skF.netwr]) || 0));
    });
    return [...byWaers.entries()].sort((a, b) => {
        const pa = skWaersPriority.indexOf(a[0]);
        const pb = skWaersPriority.indexOf(b[0]);
        if (pa >= 0 && pb >= 0) return pa - pb;
        if (pa >= 0) return -1;
        if (pb >= 0) return 1;
        return b[1] - a[1];
    });
}

function skFormatTutarKpi(data, modul) {
    const selected = modul?.filterState?.[skF.waers];
    if (selected) {
        const w = String(selected).trim().toUpperCase();
        const sum = data
            .filter(d => String(d[skF.waers] || '').trim().toUpperCase() === w)
            .reduce((a, d) => a + (skParseNumber(d[skF.netwr]) || 0), 0);
        return skFormatMoneyWithCurrency(sum, w);
    }
    const entries = skTutarByWaers(data);
    if (!entries.length) return '-';
    if (entries.length === 1) return skFormatMoneyWithCurrency(entries[0][1], entries[0][0]);
    return entries.map(([w, s]) => skFormatMoneyWithCurrency(s, w)).join(' · ');
}

function skTopTedarikciNames(data, n) {
    const sums = new Map();
    data.forEach(d => {
        const name = String(d[skF.name1] || '').trim();
        if (!name) return;
        sums.set(name, (sums.get(name) || 0) + (skParseNumber(d[skF.netwr]) || 0));
    });
    return [...sums.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, n)
        .map(x => x[0]);
}

/** KPI detay penceresi alt yazısı — toplam kayıt vs listede görünen */
function skKpiDetayAltYazi(opts) {
    const { filterRows, siralama = 'net tutara göre', kapsam } = opts;
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
            return `${kapsamMetni}Toplam ${toplam.toLocaleString('tr-TR')} kayıt — ${siralama} sıralı.`;
        }
        return `${kapsamMetni}Toplam ${toplam.toLocaleString('tr-TR')} kayıt var; ${siralama} en yüksek ${gosterilen.toLocaleString('tr-TR')} tanesi listeleniyor.`;
    };
}

const skKpiTop10Cols = [
    skF.name1,
    skF.eknam,
    skF.matnr,
    skF.maktx,
    skF.netwr,
    skF.waers,
    skF.menge,
    skF.meins,
    skF.teslimPerformans,
    'GecikmeEtiket',
    skF.budat,
    skF.ebeln
];

function skDistinctCount(data, field) {
    const set = new Set();
    data.forEach(d => {
        const v = d[field];
        if (v != null && String(v).trim() !== '') set.add(String(v).trim());
    });
    return set.size;
}

function satinalmaEnrichRow(row) {
    const normalized = { ...row };
    const gecGun = skParseNumber(normalized[skF.zzgecgun]);
    if (gecGun != null) normalized[skF.zzgecgun] = gecGun;
    const waers = normalized[skF.waers];
    if (waers != null && String(waers).trim() !== '') {
        normalized[skF.waers] = String(waers).trim().toUpperCase();
    }
    const meins = normalized[skF.meins];
    if (meins != null && String(meins).trim() !== '') {
        normalized[skF.meins] = String(meins).trim().toUpperCase();
    }
    normalized.GecikmeEtiket = skGecikmeEtiket(gecGun);
    normalized[skF.teslimPerformans] = skTeslimDurumu(normalized);
    normalized.MalzemeEtiket = skMalzemeEtiket(normalized);
    normalized.MalGrubuEtiket = skMalGrubuEtiket(normalized);
    return normalized;
}

const skGecikmeBuckets = [
    { key: 'Erken (>7 gün)', min: -Infinity, max: -8 },
    { key: 'Erken (1-7 gün)', min: -7, max: -1 },
    { key: 'Zamanında (0)', min: 0, max: 0 },
    { key: '1-7 gün geç', min: 1, max: 7 },
    { key: '8-15 gün geç', min: 8, max: 15 },
    { key: '16-30 gün geç', min: 16, max: 30 },
    { key: '31-60 gün geç', min: 31, max: 60 },
    { key: '>60 gün geç', min: 61, max: Infinity }
];

const skTeslimPointColors = {
    'Zamanında': '#43a047',
    Erken: '#29b6f6',
    Gecikmeli: '#e53935',
    Bekliyor: '#fb8c00',
    Belirsiz: '#78909c'
};

const skPieLegend = {
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

const satinalmaSchema = {
    reportKey: 'satinalma-kabuller',
    enrichRow: satinalmaEnrichRow,
    summaryColumnLabels: {
        [skF.name1]: 'Tedarikçi',
        [skF.eknam]: 'Satın Alma Grubu',
        [skF.matnr]: 'Malzeme Kodu',
        [skF.maktx]: 'Malzeme Açıklaması',
        [skF.netwr]: 'Net Tutar',
        [skF.waers]: 'Para Birimi',
        [skF.menge]: 'Miktar',
        [skF.meins]: 'Ölçü Birimi',
        [skF.teslimPerformans]: 'Teslim Durumu',
        GecikmeEtiket: 'Teslim Sapması',
        [skF.budat]: 'Gerçekleşen Tarih',
        [skF.ebeln]: 'Sipariş No',
        [skF.ebelp]: 'Kalem No',
        MalGrubuEtiket: 'Malzeme Grubu'
    },
    fieldAliases: {
        WAERS: ['WAERS', 'Waers', 'waers', 'PARA_BIRIMI', 'ParaBirimi'],
        MEINS: ['MEINS', 'Meins', 'meins']
    },
    pivotValueResolvers: { Adet: () => 1 },
    beklemeSuresiBuckets: skGecikmeBuckets,
    bucketFilters: {
        [skF.zzgecgun]: { buckets: skGecikmeBuckets, fields: [skF.zzgecgun] }
    },
    filters: [
        { field: skF.name1, elementId: 'filterTedarikci', label: 'Tedarikçi' },
        { field: skF.eknam, elementId: 'filterEknam', label: 'Satın Alma Grubu' },
        { field: skF.zzsorumlu, elementId: 'filterZzSorumlu', label: 'Sorumlu' },
        { field: 'MalGrubuEtiket', elementId: 'filterMalGrubu', label: 'Malzeme Grubu' },
        { field: skF.matnr, elementId: 'filterMatnr', label: 'Malzeme Kodu' },
        {
            field: skF.meins,
            elementId: 'filterMeins',
            label: 'Ölçü Birimi (MEINS)',
            emptyLabel: 'Tümü',
            optionLabel: skMeinsFilterLabel,
            normalizeOption: (v) => String(v).trim().toUpperCase(),
            hintElementId: 'filterMeinsHint'
        },
        {
            field: skF.waers,
            elementId: 'filterWaers',
            label: 'Para Birimi (WAERS)',
            emptyLabel: 'Tümü',
            normalizeOption: (v) => String(v).trim().toUpperCase(),
            hintElementId: 'filterWaersHint'
        },
        { field: skF.teslimPerformans, elementId: 'filterTeslimPerf', label: 'Teslim Durumu' },
        { field: skF.werks, elementId: 'filterWerks', label: 'Üretim Yeri' },
        { field: skF.eindt, elementId: 'filterEindtBas', label: 'Plan. teslim (baş.)', type: 'date', compare: '>=' },
        { field: skF.eindt, elementId: 'filterEindtBit', label: 'Plan. teslim (bit.)', type: 'date', compare: '<=' },
        { field: skF.budat, elementId: 'filterBudatBas', label: 'Gerçekleşen (baş.)', type: 'date', compare: '>=' },
        { field: skF.budat, elementId: 'filterBudatBit', label: 'Gerçekleşen (bit.)', type: 'date', compare: '<=' }
    ],
    summaries: [
        {
            elementId: '#totalKalem',
            calc: (data) => data.length.toLocaleString('tr-TR'),
            detailModal: {
                title: 'Sipariş Kalemleri',
                sortField: skF.netwr,
                sortOrder: 'desc',
                topN: 10,
                subtitle: skKpiDetayAltYazi({
                    siralama: 'Net tutara göre',
                    kapsam: 'Filtredeki tüm sipariş kalemleri'
                }),
                columns: skKpiTop10Cols
            }
        },
        {
            elementId: '#totalPo',
            calc: (data) => skDistinctCount(data, skF.ebeln).toLocaleString('tr-TR'),
            detailModal: {
                title: 'Siparişler',
                sortField: skF.netwr,
                sortOrder: 'desc',
                topN: 10,
                subtitle: skKpiDetayAltYazi({
                    siralama: 'Net tutara göre',
                    kapsam: 'Farklı satın alma siparişi numaraları içinden kalemler'
                }),
                columns: [skF.ebeln, skF.ebelp, skF.name1, skF.netwr, skF.waers, skF.budat, skF.teslimPerformans]
            }
        },
        {
            elementId: '#totalMenge',
            calc: (data) => {
                const s = data.reduce((a, d) => a + (skParseNumber(d[skF.menge]) || 0), 0);
                return skFormatQty(s);
            },
            detailModal: {
                title: 'En Yüksek Miktarlı Kalemler',
                sortField: skF.menge,
                sortOrder: 'desc',
                topN: 10,
                subtitle: skKpiDetayAltYazi({
                    siralama: 'Miktara göre',
                    kapsam: 'Filtredeki sipariş kalemleri'
                }),
                columns: [skF.name1, skF.matnr, skF.maktx, skF.menge, skF.meins, skF.netwr, skF.waers]
            }
        },
        {
            elementId: '#totalTutar',
            calc: (data, modul) => skFormatTutarKpi(data, modul),
            detailModal: {
                title: 'En Yüksek Tutarlı Kalemler',
                sortField: skF.netwr,
                sortOrder: 'desc',
                topN: 10,
                subtitle: (rows, _val, modul) => {
                    const all = modul?.filteredWithCalculated || modul?.filtered || rows;
                    const parts = skTutarByWaers(all);
                    const base = skKpiDetayAltYazi({
                        siralama: 'Net tutara göre',
                        kapsam: 'Filtredeki sipariş kalemleri'
                    })(rows, _val, modul);
                    if (parts.length <= 1) return base;
                    const pb = parts.map(([w, s]) => skFormatMoneyWithCurrency(s, w)).join(' · ');
                    return `${base} Para birimi kırılımı: ${pb}.`;
                },
                columns: skKpiTop10Cols
            }
        },
        {
            elementId: '#totalTedarikci',
            calc: (data) => skDistinctCount(data, skF.lifnr).toLocaleString('tr-TR'),
            detailModal: {
                title: 'En Yüksek Tutarlı Tedarikçiler',
                sortField: skF.netwr,
                sortOrder: 'desc',
                topN: 10,
                filterRows: (data) => {
                    const top = skTopTedarikciNames(data, 10);
                    return data.filter(d => top.includes(String(d[skF.name1] || '').trim()));
                },
                subtitle: skKpiDetayAltYazi({
                    siralama: 'Net tutara göre',
                    kapsam: 'Toplam tutarı en yüksek 10 tedarikçiye ait kalemler'
                }),
                columns: skKpiTop10Cols
            }
        },
        {
            elementId: '#zamanindaTeslim',
            calc: (data) => data.filter(d => d[skF.teslimPerformans] === 'Zamanında').length.toLocaleString('tr-TR'),
            detailModal: {
                title: 'Zamanında Teslim Edilen Kalemler',
                sortField: skF.netwr,
                sortOrder: 'desc',
                topN: 10,
                filterRows: (data) => data.filter(d => d[skF.teslimPerformans] === 'Zamanında'),
                subtitle: skKpiDetayAltYazi({
                    filterRows: (data) => data.filter(d => d[skF.teslimPerformans] === 'Zamanında'),
                    siralama: 'Net tutara göre',
                    kapsam: 'Planlanan tarihte (0 gün sapma) teslim edilen kalemler'
                }),
                columns: skKpiTop10Cols
            }
        },
        {
            elementId: '#erkenTeslim',
            calc: (data) => data.filter(d => d[skF.teslimPerformans] === 'Erken').length.toLocaleString('tr-TR'),
            detailModal: {
                title: 'Erken Teslim Edilen Kalemler',
                sortField: skF.zzgecgun,
                sortOrder: 'asc',
                topN: 10,
                filterRows: (data) => data.filter(d => d[skF.teslimPerformans] === 'Erken'),
                subtitle: skKpiDetayAltYazi({
                    filterRows: (data) => data.filter(d => d[skF.teslimPerformans] === 'Erken'),
                    siralama: 'En erken teslim (negatif gün) göre',
                    kapsam: 'Planlanandan önce teslim edilen kalemler'
                }),
                columns: skKpiTop10Cols
            }
        },
        {
            elementId: '#gecikmeliTeslim',
            calc: (data) => data.filter(d => String(d[skF.teslimPerformans] || '').startsWith('Gecikmeli')).length.toLocaleString('tr-TR'),
            detailModal: {
                title: 'Gecikmeli Teslim Edilen Kalemler',
                sortField: skF.zzgecgun,
                sortOrder: 'desc',
                topN: 10,
                highlightMax: true,
                filterRows: (data) => data.filter(d => String(d[skF.teslimPerformans] || '').startsWith('Gecikmeli')),
                subtitle: skKpiDetayAltYazi({
                    filterRows: (data) => data.filter(d => String(d[skF.teslimPerformans] || '').startsWith('Gecikmeli')),
                    siralama: 'En çok gecikme gününe göre',
                    kapsam: 'Planlanandan sonra teslim edilen kalemler'
                }),
                columns: skKpiTop10Cols
            }
        },
        {
            elementId: '#totalMalGrubu',
            calc: (data) => skDistinctCount(data, skF.matkl).toLocaleString('tr-TR'),
            detailModal: {
                title: 'Malzeme Grubu — En Yüksek Tutarlı Kalemler',
                sortField: skF.netwr,
                sortOrder: 'desc',
                topN: 10,
                subtitle: skKpiDetayAltYazi({
                    siralama: 'Net tutara göre',
                    kapsam: 'Filtredeki malzeme gruplarından kalemler'
                }),
                columns: ['MalGrubuEtiket', skF.matnr, skF.maktx, skF.name1, skF.netwr, skF.waers, skF.menge, skF.meins]
            }
        }
    ],
    columns: [
        { dataField: skF.ebeln, caption: 'Sipariş No', forceText: true },
        { dataField: skF.ebelp, caption: 'Kalem No', dataType: 'number' },
        { dataField: skF.ekgrp, caption: 'Satın Alma Grubu Kodu', visible: false, forceText: true },
        { dataField: skF.eknam, caption: 'Satın Alma Grubu' },
        { dataField: skF.zzsorumlu, caption: 'Sorumlu Kişi' },
        { dataField: skF.matnr, caption: 'Malzeme Kodu', forceText: true },
        { dataField: skF.maktx, caption: 'Malzeme Açıklaması' },
        { dataField: skF.matkl, caption: 'Malzeme Grubu Kodu', visible: false },
        { dataField: skF.wgbez, caption: 'Malzeme Grubu' },
        { dataField: 'MalGrubuEtiket', caption: 'Malzeme Grubu' },
        { dataField: 'MalzemeEtiket', caption: 'Malzeme', visible: false },
        { dataField: skF.lifnr, caption: 'Tedarikçi Kodu', visible: false, forceText: true },
        { dataField: skF.name1, caption: 'Tedarikçi' },
        { dataField: skF.menge, caption: 'Miktar', dataType: 'number', format: { type: 'fixedPoint', precision: 2 } },
        { dataField: skF.meins, caption: 'Ölçü Birimi' },
        { dataField: skF.netwr, caption: 'Net Tutar', dataType: 'number', format: { type: 'fixedPoint', precision: 2 } },
        { dataField: skF.waers, caption: 'Para Birimi' },
        { dataField: skF.bedat, caption: 'Sipariş Tarihi', dataType: 'date', format: 'dd.MM.yyyy' },
        { dataField: skF.eindt, caption: 'Planlanan Teslim Tarihi', dataType: 'date', format: 'dd.MM.yyyy' },
        { dataField: skF.budat, caption: 'Gerçekleşen Tarih', dataType: 'date', format: 'dd.MM.yyyy' },
        { dataField: skF.teslimPerformans, caption: 'Teslim Durumu' },
        { dataField: 'GecikmeEtiket', caption: 'Teslim Sapması' },
        { dataField: skF.zzgecgun, caption: 'Sapma Günü', dataType: 'number', visible: false },
        { dataField: skF.teslmay, caption: 'Teslimat Yapıldı mı', visible: false },
        { dataField: skF.deliv, caption: 'Teslim Kodu', visible: false },
        { dataField: skF.werks, caption: 'Üretim Yeri', visible: false }
    ],
    charts: [
        {
            field: skF.eknam,
            elementId: '#eknamTutarChart',
            typeSelector: '#chartTypeEknam',
            filterElementId: '#filterEknam',
            defaultType: 'bar',
            aggregate: 'sum',
            valueField: skF.netwr,
            parseValue: skParseNumber,
            formatValue: skFormatMoneyWithCurrency,
            requiresWaers: true,
            waersField: skF.waers,
            seriesName: 'Net Tutar',
            limit: 12,
            legend: skPieLegend
        },
        {
            field: skF.name1,
            elementId: '#tedarikciTutarChart',
            typeSelector: '#chartTypeTedarikciTutar',
            filterElementId: '#filterTedarikci',
            defaultType: 'bar',
            aggregate: 'sum',
            valueField: skF.netwr,
            parseValue: skParseNumber,
            formatValue: skFormatMoneyWithCurrency,
            requiresWaers: true,
            waersField: skF.waers,
            seriesName: 'Net Tutar',
            limit: 15,
            legend: skPieLegend
        },
        {
            elementId: '#malzemeMiktarChart',
            typeSelector: '#chartTypeMalzemeMiktar',
            filterElementId: '#filterMatnr',
            filterField: skF.matnr,
            field: skF.matnr,
            defaultType: 'bar',
            rotatedBar: true,
            requiresMeins: true,
            meinsField: skF.meins,
            buildData: skBuildMalzemeMiktarChartData,
            formatValue: skFormatMengeWithUnit,
            seriesName: 'Miktar',
            limit: 15,
            legend: { visible: false }
        },
        {
            field: 'MalGrubuEtiket',
            elementId: '#malGrubuTutarChart',
            typeSelector: '#chartTypeMalGrubu',
            filterElementId: '#filterMalGrubu',
            defaultType: 'pie',
            aggregate: 'sum',
            valueField: skF.netwr,
            parseValue: skParseNumber,
            formatValue: skFormatMoneyWithCurrency,
            requiresWaers: true,
            waersField: skF.waers,
            seriesName: 'Net Tutar',
            limit: 12,
            legend: skPieLegend
        },
        {
            field: skF.teslimPerformans,
            elementId: '#teslimPerfChart',
            typeSelector: '#chartTypeTeslimPerf',
            filterElementId: '#filterTeslimPerf',
            defaultType: 'pie',
            seriesName: 'Teslim Durumu',
            pointColors: skTeslimPointColors,
            legend: skPieLegend
        },
        {
            field: skF.zzgecgun,
            elementId: '#gecikmeChart',
            typeSelector: '#chartTypeGecikme',
            defaultType: 'bar',
            useBuckets: true,
            bucketLabelSuffix: '',
            seriesName: 'Kayıt Sayısı',
            legend: skPieLegend
        },
        {
            field: skF.budat,
            elementId: '#aylikBudatChart',
            typeSelector: '#chartTypeAylikBudat',
            defaultType: 'line',
            buildData: skBuildAylikBudatTrend,
            seriesName: 'Kalem Sayısı',
            legend: { visible: false }
        },
        {
            elementId: '#tedarikciTeslimStackChart',
            filterElementId: '#filterTedarikci',
            filterField: skF.name1,
            fixedType: 'bar',
            rotatedBar: true,
            buildData: skBuildTedarikciTeslimStacked,
            stackedSeries: [
                { field: 'Erken', name: 'Erken', color: skTeslimPointColors.Erken },
                { field: 'Zamanında', name: 'Zamanında', color: skTeslimPointColors['Zamanında'] },
                { field: 'Gecikmeli', name: 'Gecikmeli', color: skTeslimPointColors.Gecikmeli }
            ],
            seriesName: 'Teslim Durumu',
            legend: skPieLegend
        },
        {
            elementId: '#tedarikciOrtGecikmeChart',
            typeSelector: '#chartTypeTedarikciOrtGecikme',
            filterElementId: '#filterTedarikci',
            filterField: skF.name1,
            defaultType: 'bar',
            rotatedBar: true,
            buildData: skBuildTedarikciOrtGecikme,
            formatValue: skFormatGecikmeGun,
            useDataPointColors: true,
            seriesName: 'Ort. Sapma (gün)',
            legend: { visible: false }
        }
    ],
    pivotTables: [
        {
            containerId: 'pivotGridContainer',
            fileName: 'TedarikciMalGrubuOzet',
            texts: { grandTotal: 'Genel Toplam', total: 'Alt Toplam' },
            fields: [
                { dataField: skF.name1, area: 'row', caption: 'Tedarikçi' },
                { dataField: skF.wgbez, area: 'column', caption: 'Malzeme Grubu' },
                { dataField: skF.menge, area: 'data', summaryType: 'sum', caption: 'Toplam Miktar' },
                { dataField: skF.netwr, area: 'data', summaryType: 'sum', caption: 'Toplam Tutar' }
            ],
            fieldMappings: {
                [skF.name1]: [skF.name1],
                [skF.wgbez]: [skF.wgbez, skF.matkl]
            }
        }
    ]
};

document.addEventListener('DOMContentLoaded', function () {
    if (!window.rapor) {
        window.rapor = new RaporModul(satinalmaSchema);
        window.rapor.init();
    }
});
