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
    zzgec1: 'ZZGEC1',
    zzgec3: 'ZZGEC3',
    teslmay: 'TESLMAY',
    deliv: 'DELIV',
    waers: 'WAERS',
    ekorg: 'EKORG',
    zzsorumlu: 'ZZSORUMLU',
    teslimPerformans: 'TeslimPerformans',
    aktifTeslim: 'AktifTeslimDurumu',
    toleransKirilim: 'ToleransKirilim',
    satinalmaOrgEtiket: 'SatinalmaOrgEtiket',
    sapmaGun: 'SapmaGun',
    budatAy: 'BudatAy',
    tedarikciEtiket: 'TedarikciEtiket',
    malGrubuEtiket: 'MalGrubuEtiket'
};

const skEkorgMap = {
    '251': 'İç Satınalma',
    '252': 'Dış Satınalma',
    '253': 'Yan Sanayi',
    '254': 'Şirketiçi Satınalma',
    '255': 'İhracat Satınalma'
};

const skEkorgFilterOptions = [
    { value: '', label: 'Tümü' },
    ...Object.entries(skEkorgMap).map(([, label]) => ({ value: label, label }))
];

function skGetField(row, field) {
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

function skResolveEkorgRaw(row) {
    return skGetField(row, skF.ekorg);
}

function skNormalizeEkorgCode(value) {
    if (value == null || value === '') return '';
    if (typeof value === 'number' && Number.isFinite(value)) {
        return String(Math.trunc(value));
    }
    const s = String(value).trim();
    if (!s) return '';
    const asNum = Number(s);
    if (Number.isFinite(asNum) && /^\d+(\.0+)?$/.test(s)) {
        return String(Math.trunc(asNum));
    }
    const trimmed = s.replace(/^0+/, '') || '0';
    return trimmed;
}

function skEkorgEtiket(row) {
    const code = skNormalizeEkorgCode(skResolveEkorgRaw(row));
    if (!code) return '—';
    return skEkorgMap[code] || `${code} (tanımsız)`;
}

function skParseNumber(value) {
    if (value == null || value === '') return null;
    const n = Number(String(value).trim().replace(',', '.'));
    return Number.isFinite(n) ? n : null;
}

function skDateOnly(value) {
    if (value == null || value === '') return null;
    return String(value).trim().split('T')[0];
}

function skParseSapmaGun(value) {
    if (value == null || value === '') return null;
    const s = String(value).trim();
    if (/^\d+-$/.test(s)) return -parseInt(s, 10);
    return skParseNumber(s);
}

function skGecikmeEtiket(gec) {
    if (gec == null || !Number.isFinite(gec)) return '—';
    if (gec < 0) return `${Math.abs(gec)} gün erken`;
    if (gec === 0) return 'Tam gününde (0)';
    return `${gec} gün geç`;
}

function skSapmaGun(row) {
    const gec = skParseSapmaGun(row[skF.zzgecgun]);
    if (gec != null) return gec;
    const budat = skDateOnly(row[skF.budat]);
    const eindt = skDateOnly(row[skF.eindt]);
    if (budat && eindt) {
        const a = new Date(budat);
        const b = new Date(eindt);
        if (!isNaN(a) && !isNaN(b)) {
            return Math.round((a - b) / 86400000);
        }
    }
    return null;
}

function skNormalizeTeslimSap(value) {
    const s = String(value || '').trim();
    if (!s) return null;
    const lower = s.toLocaleLowerCase('tr-TR');
    if (lower === 'zamanında' || lower === 'zamaninda') return 'Zamanında';
    if (lower === 'geç' || lower === 'gec' || lower.startsWith('gecik')) return 'Geç';
    return null;
}

function skTeslimDurumu1(row) {
    const fromSap = skNormalizeTeslimSap(row[skF.zzgec1]);
    if (fromSap) return fromSap;
    const gec = skSapmaGun(row);
    if (gec != null) return gec >= 1 ? 'Geç' : 'Zamanında';

    const tes = String(row[skF.teslmay] ?? row[skF.deliv] ?? '').trim().toLowerCase();
    if (tes.includes('evet') || tes === 'x' || tes === '1') return 'Zamanında';
    if (tes.includes('hayır') || tes.includes('hayir') || tes === '0') return 'Geç';

    const eindt = skDateOnly(row[skF.eindt]);
    const budat = skDateOnly(row[skF.budat]);
    if (eindt) {
        const today = new Date().toISOString().split('T')[0];
        if (!budat && today > eindt) return 'Geç';
        if (!budat) return 'Bekliyor';
    }
    return 'Belirsiz';
}

function skTeslimDurumu3(row) {
    const fromSap = skNormalizeTeslimSap(row[skF.zzgec3]);
    if (fromSap) return fromSap;
    const gec = skSapmaGun(row);
    if (gec != null) return gec > 3 ? 'Geç' : 'Zamanında';
    return null;
}

function skGetToleransMode(modul) {
    return String(modul?.filterState?.[skF.toleransKirilim] ?? '').trim();
}

function skTeslimFromZzgecgun(row) {
    const gec = skParseSapmaGun(row[skF.zzgecgun]);
    if (gec == null || !Number.isFinite(gec)) return null;
    return gec > 0 ? 'Geç' : 'Zamanında';
}

function skActiveTeslimDurumu(row, modul) {
    const mode = skGetToleransMode(modul);
    if (mode === '1') {
        return skNormalizeTeslimSap(row[skF.zzgec1]) || skTeslimDurumu1(row);
    }
    if (mode === '3') {
        return skNormalizeTeslimSap(row[skF.zzgec3]) || skTeslimDurumu3(row);
    }
    return skTeslimFromZzgecgun(row);
}

function skToleransKpiMetinleri(modul) {
    const mode = skGetToleransMode(modul);
    if (mode === '1') {
        return { zamaninda: 'Zamanında Teslim (1 gün tolerans)', gec: 'Geç Teslim (1 gün tolerans)' };
    }
    if (mode === '3') {
        return { zamaninda: 'Zamanında Teslim (3 gün tolerans)', gec: 'Geç Teslim (3 gün tolerans)' };
    }
    return { zamaninda: 'Zamanında Teslim', gec: 'Geç Teslim' };
}

function skToleransKpiDetayBaslik(modul, durum) {
    const mode = skGetToleransMode(modul);
    if (mode === '1') return durum === 'Geç' ? 'Geç Teslim (1 gün tolerans)' : 'Zamanında Teslim (1 gün tolerans)';
    if (mode === '3') return durum === 'Geç' ? 'Geç Teslim (3 gün tolerans)' : 'Zamanında Teslim (3 gün tolerans)';
    return durum === 'Geç' ? 'Geç Teslim' : 'Zamanında Teslim';
}

function skToleransChartMetinleri(modul) {
    const mode = skGetToleransMode(modul);
    if (mode === '1') {
        return {
            teslimPerf: '1 gün toleransına göre zamanında / geç dağılımı. Sol panelden tolerans filtresini değiştirebilirsiniz.',
            tedarikciTeslim: 'En yüksek hacimli ilk 10 tedarikçi — 1 gün toleransına göre zamanında / geç (tam liste için 🔍 büyüt).'
        };
    }
    if (mode === '3') {
        return {
            teslimPerf: '3 gün toleransına göre zamanında / geç dağılımı. Sol panelden tolerans filtresini değiştirebilirsiniz.',
            tedarikciTeslim: 'En yüksek hacimli ilk 10 tedarikçi — 3 gün toleransına göre zamanında / geç (tam liste için 🔍 büyüt).'
        };
    }
    return {
        teslimPerf: 'Gerçek sapma gününe göre zamanında / geç dağılımı (0 ve erken zamanında, pozitif geç). Sol panelden 1 veya 3 gün tolerans seçebilirsiniz.',
        tedarikciTeslim: 'En yüksek hacimli ilk 10 tedarikçi — gerçek sapma gününe göre zamanında / geç (tam liste için 🔍 büyüt).'
    };
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
    return skNormalizeTeslimSap(value);
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
            monthKey,
            filterValue: monthKey
        }));
}

function skTedarikciEtiket(row) {
    const name = String(row[skF.name1] || '').trim();
    if (name) return name;
    const kod = String(row[skF.lifnr] || '').trim();
    return kod || '';
}

function skBuildTedarikciTeslimStacked(rows) {
    const grouped = new Map();
    rows.forEach(d => {
        const name = skTedarikciEtiket(d);
        const perf = skNormalizeTeslimPerf(d[skF.aktifTeslim]);
        if (!name || !perf) return;
        if (!grouped.has(name)) {
            grouped.set(name, { 'Zamanında': 0, 'Geç': 0, total: 0 });
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
            'Zamanında': g['Zamanında'],
            'Geç': g['Geç'],
            filterValue: argument
        }));
}

function skBuildTedarikciOrtGecikme(rows) {
    const grouped = new Map();
    rows.forEach(d => {
        const name = skTedarikciEtiket(d);
        const gec = d.SapmaGun;
        if (!name || gec == null || !Number.isFinite(gec)) return;
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
        .sort((a, b) => b.value - a.value);
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

function skFormatTutarKpiHtml(data, modul) {
    const selected = modul?.filterState?.[skF.waers];
    if (selected) {
        const w = String(selected).trim().toUpperCase();
        const sum = data
            .filter(d => String(d[skF.waers] || '').trim().toUpperCase() === w)
            .reduce((a, d) => a + (skParseNumber(d[skF.netwr]) || 0), 0);
        const line = skFormatMoneyWithCurrency(sum, w);
        return `<span class="stat-kpi-line">${line}</span>`;
    }
    const entries = skTutarByWaers(data);
    if (!entries.length) return '-';
    return entries
        .map(([w, s]) => `<span class="stat-kpi-line">${skFormatMoneyWithCurrency(s, w)}</span>`)
        .join('');
}

function skTopTedarikciNames(data, n) {
    const sums = new Map();
    data.forEach(d => {
        const name = skTedarikciEtiket(d);
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
    skF.satinalmaOrgEtiket,
    skF.matnr,
    skF.maktx,
    skF.netwr,
    skF.waers,
    skF.menge,
    skF.meins,
    skF.aktifTeslim,
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
    const gecGun = skParseSapmaGun(normalized[skF.zzgecgun]);
    if (gecGun != null) normalized[skF.zzgecgun] = gecGun;
    const waers = normalized[skF.waers];
    if (waers != null && String(waers).trim() !== '') {
        normalized[skF.waers] = String(waers).trim().toUpperCase();
    }
    const meins = normalized[skF.meins];
    if (meins != null && String(meins).trim() !== '') {
        normalized[skF.meins] = String(meins).trim().toUpperCase();
    }
    normalized.SapmaGun = skSapmaGun(normalized);
    normalized.GecikmeEtiket = skGecikmeEtiket(normalized.SapmaGun);
    normalized.MalzemeEtiket = skMalzemeEtiket(normalized);
    normalized.MalGrubuEtiket = skMalGrubuEtiket(normalized);
    normalized.TedarikciEtiket = skTedarikciEtiket(normalized);
    const ekorgRaw = skResolveEkorgRaw(normalized);
    if (ekorgRaw != null && String(ekorgRaw).trim() !== '') {
        normalized[skF.ekorg] = skNormalizeEkorgCode(ekorgRaw);
    }
    normalized[skF.satinalmaOrgEtiket] = skEkorgEtiket(normalized);
    const budatIso = skDateOnly(normalized[skF.budat]);
    if (budatIso) normalized.BudatAy = budatIso.slice(0, 7);
    skSetYilHafta(normalized, budatIso);
    return normalized;
}

function skSetYilHafta(row, isoDate) {
    if (!isoDate) return;
    const dt = new Date(isoDate);
    if (isNaN(dt)) return;
    row.Yil = dt.getFullYear();
    const jan1 = new Date(dt.getFullYear(), 0, 1);
    const days = Math.floor((dt - jan1) / 86400000);
    row.Hafta = Math.ceil((days + jan1.getDay() + 1) / 7);
}

const skGecikmeBuckets = [
    { key: 'Erken (≤−1 gün)', min: -Infinity, max: -1 },
    { key: 'Tam gününde (0)', min: 0, max: 0 },
    { key: '1 gün geç', min: 1, max: 1 },
    { key: '2-3 gün geç', min: 2, max: 3 },
    { key: '4-7 gün geç', min: 4, max: 7 },
    { key: '8-15 gün geç', min: 8, max: 15 },
    { key: '16-30 gün geç', min: 16, max: 30 },
    { key: '31-60 gün geç', min: 31, max: 60 },
    { key: '>60 gün geç', min: 61, max: Infinity }
];

const skTeslimPointColors = {
    'Zamanında': '#43a047',
    'Geç': '#e53935',
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
    initialFilters: {
        [skF.meins]: 'ST',
        [skF.waers]: 'TRY'
    },
    enrichRow: satinalmaEnrichRow,
    applyActiveFields(data, modul) {
        return data.map(row => ({
            ...row,
            [skF.aktifTeslim]: skActiveTeslimDurumu(row, modul)
        }));
    },
    afterUpdateAll(modul) {
        const metin = skToleransKpiMetinleri(modul);
        const zEl = document.getElementById('zamanindaTeslimLabel');
        const gEl = document.getElementById('gecikmeliTeslimLabel');
        if (zEl) zEl.textContent = metin.zamaninda;
        if (gEl) gEl.textContent = metin.gec;

        const chartMetin = skToleransChartMetinleri(modul);
        const hintTeslim = document.getElementById('hintTeslimPerf');
        const hintTedarikci = document.getElementById('hintTedarikciTeslim');
        if (hintTeslim) hintTeslim.textContent = chartMetin.teslimPerf;
        if (hintTedarikci) hintTedarikci.textContent = chartMetin.tedarikciTeslim;
    },
    summaryColumnLabels: {
        [skF.name1]: 'Tedarikçi',
        [skF.satinalmaOrgEtiket]: 'Satın Alma Organizasyonu',
        [skF.matnr]: 'Malzeme Kodu',
        [skF.maktx]: 'Malzeme Açıklaması',
        [skF.netwr]: 'Net Tutar',
        [skF.waers]: 'Para Birimi',
        [skF.menge]: 'Miktar',
        [skF.meins]: 'Ölçü Birimi',
        [skF.aktifTeslim]: 'Teslim Durumu',
        GecikmeEtiket: 'Teslim Sapması',
        [skF.sapmaGun]: 'Kayıt Sayısı',
        [skF.budatAy]: 'Aylık Kabul Kaydı',
        [skF.tedarikciEtiket]: 'Tedarikçi',
        [skF.malGrubuEtiket]: 'Malzeme Grubu',
        [skF.zzgecgun]: 'Sapma Günü',
        [skF.budat]: 'Gerçekleşen Tarih',
        [skF.ebeln]: 'Sipariş No',
        [skF.ebelp]: 'Kalem No',
        MalGrubuEtiket: 'Malzeme Grubu'
    },
    fieldAliases: {
        EKORG: ['EKORG', 'Ekorg', 'ekorg'],
        WAERS: ['WAERS', 'Waers', 'waers', 'PARA_BIRIMI', 'ParaBirimi'],
        MEINS: ['MEINS', 'Meins', 'meins']
    },
    pivotValueResolvers: { Adet: () => 1 },
    beklemeSuresiBuckets: skGecikmeBuckets,
    bucketFilters: {
        [skF.sapmaGun]: { buckets: skGecikmeBuckets, fields: [skF.sapmaGun] }
    },
    virtualFilters: {
        [skF.budatAy]: { fields: [skF.budatAy] }
    },
    filters: [
        {
            field: skF.tedarikciEtiket,
            elementId: 'filterTedarikci',
            label: 'Tedarikçi',
            matchFields: [skF.tedarikciEtiket, skF.name1, skF.lifnr]
        },
        {
            field: skF.satinalmaOrgEtiket,
            elementId: 'filterSatinalmaOrg',
            label: 'Satın Alma Organizasyonu',
            staticOptions: skEkorgFilterOptions
        },
        { field: skF.zzsorumlu, elementId: 'filterZzSorumlu', label: 'Sorumlu' },
        { field: skF.malGrubuEtiket, elementId: 'filterMalGrubu', label: 'Malzeme Grubu' },
        { field: skF.matnr, elementId: 'filterMatnr', label: 'Malzeme Kodu' },
        {
            field: skF.meins,
            elementId: 'filterMeins',
            label: 'Ölçü Birimi',
            emptyLabel: 'Tümü',
            optionLabel: skMeinsFilterLabel,
            normalizeOption: (v) => String(v).trim().toUpperCase(),
            hintElementId: 'filterMeinsHint'
        },
        {
            field: skF.waers,
            elementId: 'filterWaers',
            label: 'Para Birimi',
            emptyLabel: 'Tümü',
            normalizeOption: (v) => String(v).trim().toUpperCase(),
            hintElementId: 'filterWaersHint'
        },
        {
            field: skF.toleransKirilim,
            elementId: 'filterTolerans',
            label: 'Teslim Toleransı',
            uiOnly: true,
            staticOptions: [
                { value: '', label: 'Varsayılan (gerçek sapma günü)' },
                { value: '1', label: '1 gün tolerans' },
                { value: '3', label: '3 gün tolerans' }
            ]
        },
        { field: skF.aktifTeslim, elementId: 'filterTeslimPerf', label: 'Teslim Durumu' },
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
                columns: [skF.ebeln, skF.ebelp, skF.name1, skF.netwr, skF.waers, skF.budat, skF.aktifTeslim]
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
            htmlValue: true,
            calc: (data, modul) => skFormatTutarKpiHtml(data, modul),
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
                    return data.filter(d => top.includes(skTedarikciEtiket(d)));
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
            calc: (data) => data.filter(d => d[skF.aktifTeslim] === 'Zamanında').length.toLocaleString('tr-TR'),
            detailModal: {
                title: (rows, _val, modul) => skToleransKpiDetayBaslik(modul, 'Zamanında'),
                sortField: skF.netwr,
                sortOrder: 'desc',
                topN: 10,
                filterRows: (data) => data.filter(d => d[skF.aktifTeslim] === 'Zamanında'),
                subtitle: (rows, _val, modul) => skKpiDetayAltYazi({
                    filterRows: (data) => data.filter(d => d[skF.aktifTeslim] === 'Zamanında'),
                    siralama: 'Net tutara göre',
                    kapsam: skToleransKpiMetinleri(modul).zamaninda
                })(rows, _val, modul),
                columns: skKpiTop10Cols
            }
        },
        {
            elementId: '#gecikmeliTeslim',
            calc: (data) => data.filter(d => d[skF.aktifTeslim] === 'Geç').length.toLocaleString('tr-TR'),
            detailModal: {
                title: (rows, _val, modul) => skToleransKpiDetayBaslik(modul, 'Geç'),
                sortField: skF.zzgecgun,
                sortOrder: 'desc',
                topN: 10,
                highlightMax: true,
                filterRows: (data) => data.filter(d => d[skF.aktifTeslim] === 'Geç'),
                subtitle: (rows, _val, modul) => skKpiDetayAltYazi({
                    filterRows: (data) => data.filter(d => d[skF.aktifTeslim] === 'Geç'),
                    siralama: 'En çok sapma gününe göre',
                    kapsam: skToleransKpiMetinleri(modul).gec
                })(rows, _val, modul),
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
        { dataField: skF.ekorg, caption: 'Satın Alma Organizasyonu Kodu', visible: false, forceText: true },
        { dataField: skF.satinalmaOrgEtiket, caption: 'Satın Alma Organizasyonu' },
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
        { dataField: skF.aktifTeslim, caption: 'Teslim Durumu' },
        { dataField: 'GecikmeEtiket', caption: 'Teslim Sapması' },
        { dataField: skF.zzgecgun, caption: 'Sapma Günü', dataType: 'number', visible: false },
        { dataField: skF.teslmay, caption: 'Teslimat Yapıldı mı', visible: false },
        { dataField: skF.deliv, caption: 'Teslim Kodu', visible: false },
        { dataField: skF.werks, caption: 'Üretim Yeri', visible: false }
    ],
    charts: [
        {
            field: skF.satinalmaOrgEtiket,
            elementId: '#satinalmaOrgTutarChart',
            typeSelector: '#chartTypeEkorg',
            filterElementId: '#filterSatinalmaOrg',
            defaultType: 'pie',
            aggregate: 'sum',
            valueField: skF.netwr,
            parseValue: skParseNumber,
            formatValue: skFormatMoneyWithCurrency,
            requiresWaers: true,
            waersField: skF.waers,
            limit: 12,
            legend: skPieLegend
        },
        {
            field: skF.tedarikciEtiket,
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
            limit: 10,
            legend: skPieLegend
        },
        {
            elementId: '#malzemeMiktarChart',
            typeSelector: '#chartTypeMalzemeMiktar',
            filterElementId: '#filterMatnr',
            filterField: skF.matnr,
            field: skF.menge,
            defaultType: 'bar',
            rotatedBar: true,
            requiresMeins: true,
            meinsField: skF.meins,
            buildData: skBuildMalzemeMiktarChartData,
            formatValue: skFormatMengeWithUnit,
            limit: 12,
            legend: skPieLegend
        },
        {
            field: skF.malGrubuEtiket,
            elementId: '#malGrubuTutarChart',
            typeSelector: '#chartTypeMalGrubu',
            filterElementId: '#filterMalGrubu',
            defaultType: 'bar',
            aggregate: 'sum',
            valueField: skF.netwr,
            parseValue: skParseNumber,
            formatValue: skFormatMoneyWithCurrency,
            requiresWaers: true,
            waersField: skF.waers,
            limit: 10,
            legend: skPieLegend
        },
        {
            field: skF.aktifTeslim,
            elementId: '#teslimPerfChart',
            typeSelector: '#chartTypeTeslimPerf',
            filterElementId: '#filterTeslimPerf',
            defaultType: 'pie',
            pointColors: skTeslimPointColors,
            legend: skPieLegend
        },
        {
            field: skF.sapmaGun,
            elementId: '#gecikmeChart',
            typeSelector: '#chartTypeGecikme',
            defaultType: 'bar',
            useBuckets: true,
            bucketLabelSuffix: '',
            legend: skPieLegend
        },
        {
            field: skF.budatAy,
            elementId: '#aylikBudatChart',
            typeSelector: '#chartTypeAylikBudat',
            defaultType: 'line',
            buildData: skBuildAylikBudatTrend,
            chartClickFilter: { field: skF.budatAy, valueKey: 'monthKey' },
            legend: skPieLegend
        },
        {
            elementId: '#tedarikciTeslimStackChart',
            typeSelector: '#chartTypeTedarikciTeslimStack',
            filterElementId: '#filterTedarikci',
            filterField: skF.tedarikciEtiket,
            defaultType: 'bar',
            rotatedBar: true,
            buildData: skBuildTedarikciTeslimStacked,
            stackedSeries: [
                { field: 'Zamanında', name: 'Zamanında', color: skTeslimPointColors['Zamanında'] },
                { field: 'Geç', name: 'Geç', color: skTeslimPointColors['Geç'] }
            ],
            stackedPieFilterField: skF.aktifTeslim,
            stackedPieFilterElementId: '#filterTeslimPerf',
            limit: 10,
            legend: skPieLegend
        },
        {
            elementId: '#tedarikciOrtGecikmeChart',
            typeSelector: '#chartTypeTedarikciOrtGecikme',
            filterElementId: '#filterTedarikci',
            filterField: skF.tedarikciEtiket,
            field: skF.zzgecgun,
            defaultType: 'bar',
            rotatedBar: true,
            buildData: skBuildTedarikciOrtGecikme,
            formatValue: skFormatGecikmeGun,
            useDataPointColors: true,
            colorBySign: true,
            limit: 12,
            legend: skPieLegend,
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
        },
        {
            containerId: 'yillikPivotGridContainer',
            fileName: 'EknamYillikDagilim',
            texts: { grandTotal: 'Tüm Yılların Toplamı', total: 'O Yıla Ait Alt Toplam' },
            fields: [
                { dataField: skF.satinalmaOrgEtiket, area: 'row', caption: 'Satın Alma Organizasyonu' },
                { dataField: 'Yil', area: 'column', caption: 'Yıl' },
                { dataField: 'Hafta', area: 'column', caption: 'Hafta' },
                { dataField: 'Adet', area: 'data', summaryType: 'sum', caption: 'Kayıt' }
            ],
            fieldMappings: {
                [skF.satinalmaOrgEtiket]: [skF.satinalmaOrgEtiket]
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
