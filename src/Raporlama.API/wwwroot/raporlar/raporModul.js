window.API_BASE = window.API_BASE || (window.location.origin + '/api');

function normalizeDateOnly(value) {
    if (value == null || value === '') return null;
    const s = String(value).trim();
    if (!s) return null;
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.substring(0, 10);
    const tr = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})/);
    if (tr) {
        return `${tr[3]}-${tr[2].padStart(2, '0')}-${tr[1].padStart(2, '0')}`;
    }
    const d = new Date(s);
    if (!isNaN(d.getTime())) {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    }
    return null;
}

function formatTrDate(value) {
    const iso = normalizeDateOnly(value);
    if (!iso) return '';
    const [y, m, d] = iso.split('-');
    return `${d}.${m}.${y}`;
}

async function fetchJsonSafe(url, options = {}) {
    const resp = await fetch(url, { credentials: 'include', ...options });
    const text = await resp.text();
    let payload = null;
    if (text && text.trim()) {
        try {
            payload = JSON.parse(text);
        } catch {
            throw new Error(`Sunucu geçersiz yanıt döndü (HTTP ${resp.status}).`);
        }
    }
    if (!resp.ok) {
        const msg = payload?.error || payload?.message || `İstek başarısız (HTTP ${resp.status}).`;
        if (resp.status === 401) {
            window.location.href = '/menu.html';
            throw new Error('Oturum bulunamadı. Menüye yönlendiriliyorsunuz…');
        }
        throw new Error(msg);
    }
    return payload ?? {};
}

// Ultra-dinamik rapor modülü: Şema ve alanlar API'den veya JSON'dan alınır
class RaporModul {
        static enlargeChart(chartId, title) {
            if (window.rapor && typeof window.rapor.enlargeChart === 'function') {
                window.rapor.enlargeChart(chartId, title);
                return;
            }
            RaporModul.enlargeChartLegacy(chartId, title);
        }

        static downloadSVG(chartId, title) {
            if (window.rapor && typeof window.rapor.downloadChart === 'function') {
                window.rapor.downloadChart(chartId, title);
                return;
            }
            RaporModul.downloadSVGLegacy(chartId, title);
        }

        static enlargeChartLegacy(chartId, title) {
            const oldModal = document.getElementById('chartEnlargeModal');
            if (oldModal) oldModal.remove();
            const chartElem = document.getElementById(chartId);
            if (!chartElem) return;
            const modal = document.createElement('div');
            modal.id = 'chartEnlargeModal';
            modal.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.8);z-index:9999;display:flex;align-items:center;justify-content:center;';
            modal.innerHTML = `<div style='background:#23242a;padding:32px;border-radius:12px;max-width:90vw;max-height:90vh;overflow:auto;position:relative;'>
                <h2 style='color:#00eaff;text-align:center;margin-bottom:18px;'>${title}</h2>
                <div id='modalChartContent' style='text-align:center;'></div>
                <button type="button" id="chartEnlargeCloseBtn" style='position:absolute;top:12px;right:12px;background:#e74c3c;color:#fff;padding:8px 16px;border:none;border-radius:6px;cursor:pointer;'>Kapat</button>
            </div>`;
            document.body.appendChild(modal);
            modal.querySelector('#chartEnlargeCloseBtn').onclick = () => modal.remove();
            const chartContent = chartElem.querySelector('svg')?.cloneNode(true) || chartElem.querySelector('canvas')?.cloneNode(true);
            if (chartContent) {
                chartContent.style.width = '800px';
                chartContent.style.height = '500px';
                document.getElementById('modalChartContent').appendChild(chartContent);
            } else {
                document.getElementById('modalChartContent').innerHTML = '<div style="color:#fff;text-align:center;">Grafik bulunamadı</div>';
            }
        }

        static downloadSVGLegacy(chartId, title) {
            const svgElem = document.getElementById(chartId)?.querySelector('svg');
            if (!svgElem) { alert('SVG bulunamadı!'); return; }
            RaporModul.saveSvgElement(svgElem, title);
        }

        static saveSvgElement(svgElem, title) {
            let svgString = new XMLSerializer().serializeToString(svgElem);
            const parser = new DOMParser();
            const doc = parser.parseFromString(svgString, 'image/svg+xml');
            const svg = doc.documentElement;
            let width = parseInt(svg.getAttribute('width') || '800', 10);
            let height = parseInt(svg.getAttribute('height') || '500', 10);
            const titleFontSize = 28;
            const titleMargin = 24;
            const extraSpace = 32;
            const newHeight = height + titleFontSize + titleMargin + extraSpace;
            svg.setAttribute('height', String(newHeight));
            if (svg.hasAttribute('viewBox')) {
                const vb = svg.getAttribute('viewBox').split(' ');
                if (vb.length === 4) vb[3] = String(parseInt(vb[3], 10) + titleFontSize + titleMargin + extraSpace);
                svg.setAttribute('viewBox', vb.join(' '));
            }
            const titleText = doc.createElementNS('http://www.w3.org/2000/svg', 'text');
            titleText.setAttribute('x', String(width / 2));
            titleText.setAttribute('y', String(titleFontSize + titleMargin / 2));
            titleText.setAttribute('text-anchor', 'middle');
            titleText.setAttribute('font-size', String(titleFontSize));
            titleText.setAttribute('font-weight', 'bold');
            titleText.setAttribute('fill', '#00eaff');
            titleText.setAttribute('font-family', 'Segoe UI, Arial, sans-serif');
            titleText.textContent = title;
            svg.setAttribute('style', 'background:#23242a;display:block;margin:auto;');
            Array.from(svg.children).forEach(child => {
                if (child.tagName !== 'text') {
                    const prev = child.getAttribute('transform') || '';
                    const translate = `translate(0,${titleFontSize + titleMargin + extraSpace})`;
                    child.setAttribute('transform', prev ? `${prev} ${translate}` : translate);
                }
            });
            svg.insertBefore(titleText, svg.firstChild);
            svgString = new XMLSerializer().serializeToString(svg);
            const blob = new Blob([svgString], { type: 'image/svg+xml' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${title.replace(/ /g, '_')}.svg`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }
    // filterState: tüm filtrelerin merkezi kaynağı
    filterState = {};

        getStorageKey() {
            // Her rapor için benzersiz anahtar
            return 'raporModul_defaultFilters_' + (this.schema.reportKey || 'default');
        }

        async saveDefaultFilters() {
            // filterState'i kopyala
            const filters = { ...this.filterState };
            // Tüm input/select değerini de ekle (gizli kalanlar dahil)
            (this.schema.filters || []).forEach(f => {
                const elem = document.getElementById(f.elementId);
                if (elem) filters[f.field] = elem.value;
            });
            // Tüm grafik tipi seçimlerini de ekle
            if (this.schema.charts) {
                this.schema.charts.forEach(chart => {
                    if (chart.typeSelector) {
                        const el = document.querySelector(chart.typeSelector);
                        if (el) filters[chart.typeSelector.replace('#','')] = el.value;
                    }
                });
            }
            try {
                let reportId = document.getElementById('reportMeta')?.dataset?.reportId;
                if (reportId) reportId = parseInt(reportId, 10);
                if (!reportId || isNaN(reportId) || reportId <= 0) {
                    if (typeof toastr === 'function') toastr('Rapor ID bulunamadı, kayıt yapılamaz!', 'error');
                    else alert('Rapor ID bulunamadı, kayıt yapılamaz!');
                    return;
                }
                await fetch(window.API_BASE + '/authorization/default-report', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({
                        ReportKey: reportId,
                        Filters: filters
                    })
                });
                showToast('Varsayılan filtreler kaydedildi!', 'success');
            } catch (e) {
                localStorage.setItem(this.getStorageKey(), JSON.stringify(filters));
                showToast('Varsayılan filtreler localStorage ile kaydedildi!','warning');
            }
        }

        async loadDefaultFilters() {
            let reportId = document.getElementById('reportMeta')?.dataset?.reportId;
            if (reportId) reportId = parseInt(reportId, 10);
            let filters = null;
            if (reportId && !isNaN(reportId) && reportId > 0) {
                try {
                    const resp = await fetch(window.API_BASE + `/authorization/default-report?reportKey=${reportId}`, { credentials: 'include' });
                    if (resp.ok) {
                        const data = await resp.json();
                        if (data && data.filters) {
                            if (typeof data.filters === 'string') {
                                filters = JSON.parse(data.filters);
                            } else {
                                filters = data.filters;
                            }
                        }
                    }
                } catch {}
            }
            // Fallback: localStorage
            if (!filters) {
                const raw = localStorage.getItem(this.getStorageKey());
                if (raw) {
                    try { filters = JSON.parse(raw); } catch {}
                }
            }
            if (!filters && this.schema.initialFilters) {
                filters = { ...this.schema.initialFilters };
            }
            if (!filters) return;
            // filterState'i güncelle
            this.filterState = { ...filters };
            // Tüm input/select ve grafik tipi değerlerini DOM'a uygula
            (this.schema.filters || []).forEach(f => {
                const elem = document.getElementById(f.elementId);
                if (!elem || filters[f.field] === undefined) return;
                const val = filters[f.field];
                if (elem.tagName === 'SELECT' && val !== '' && val != null) {
                    const hasOpt = [...elem.options].some(o => o.value === String(val));
                    if (!hasOpt) {
                        const opt = document.createElement('option');
                        opt.value = val;
                        opt.text = typeof f.optionLabel === 'function' ? f.optionLabel(val) : val;
                        elem.appendChild(opt);
                    }
                }
                elem.value = val;
                // Dinamik date filtreleri için de uygula
                if (f.type === 'date' && val) elem.value = val;
            });
            if (this.schema.charts) {
                this.schema.charts.forEach(chart => {
                    if (chart.typeSelector) {
                        const el = document.querySelector(chart.typeSelector);
                        const key = chart.typeSelector.replace('#','');
                        if (el) {
                            const preferred = (filters[key] !== undefined && filters[key] !== null && filters[key] !== '')
                                ? filters[key]
                                : chart.defaultType;
                            const resolved = this.setChartTypeSelectValue(el, preferred, chart.defaultType);
                            this.filterState[key] = resolved;
                        }
                    }
                });
            }
        }

    constructor(schema) {
        this.schema = schema; // Şema: filtreler, özetler, grafikler, kolonlar
        this.data = [];
        this.baseEnrichedData = null;
        this._baseEnrichedDirty = true;
        this.filtered = [];
        this.columns = [];
        this.filteredWithCalculated = [];
        this.pivotFields = [];
    }

    showLoading(message) {
        let el = document.getElementById('raporLoadingOverlay');
        if (!el) {
            el = document.createElement('div');
            el.id = 'raporLoadingOverlay';
            el.className = 'rapor-loading-overlay';
            el.innerHTML = '<div class="rapor-loading-box"><div class="rapor-loading-spinner"></div><p id="raporLoadingText"></p></div>';
            document.body.appendChild(el);
        }
        const text = document.getElementById('raporLoadingText');
        if (text) text.textContent = message || 'Yükleniyor…';
        el.style.display = 'flex';
    }

    hideLoading() {
        const el = document.getElementById('raporLoadingOverlay');
        if (el) el.style.display = 'none';
    }

    rebuildBaseEnrichedData() {
        if (!this._baseEnrichedDirty && this.baseEnrichedData) return this.baseEnrichedData;
        this.baseEnrichedData = typeof this.schema.enrichRow === 'function'
            ? this.data.map(r => this.schema.enrichRow(r))
            : this.data.slice();
        this._baseEnrichedDirty = false;
        return this.baseEnrichedData;
    }

    getWorkingData() {
        let data = this.rebuildBaseEnrichedData();
        if (typeof this.schema.applyActiveFields === 'function') {
            data = this.schema.applyActiveFields(data, this);
        }
        return data;
    }

    async init() {
        try {
            this.showLoading('Veri indiriliyor…');
            await this.fetchSchemaAndData();
            this.hideLoading();
            this.populateFilters();
            await this.loadDefaultFilters();
            this.sortFilterDropdowns();
            this.bindEvents();
            this.updateAll();
        } catch (err) {
            console.error('Rapor yüklenemedi:', err);
            const msg = err?.message || 'Rapor verisi yüklenirken hata oluştu.';
            if (typeof showToast === 'function') showToast(msg, 'error');
            else alert(msg);
        } finally {
            this.hideLoading();
        }
    }

    async fetchSchemaAndData() {
        // Şema API'den veya window.raporSchema'dan alınabilir
        let schema = this.schema;
        if (typeof schema === 'string') {
            schema = await fetchJsonSafe(schema);
        }
        this.schema = schema;
        // Data çek
        let dataUrl = schema.dataUrl;
        const metaReportId = document.getElementById('reportMeta')?.dataset?.reportId;
        if (!dataUrl && metaReportId) {
            dataUrl = window.API_BASE + `/reports/${metaReportId}/data`;
        }
        if (!dataUrl && schema.reportKey) {
            const reports = await fetchJsonSafe(window.API_BASE + '/reports');
            const list = Array.isArray(reports) ? reports : [];
            let report = list.find(r => r.reportCode && r.reportCode.toLowerCase().includes(schema.reportKey.toLowerCase()));
            if (report) dataUrl = window.API_BASE + `/reports/${report.reportID}/data`;
        }
        if (!dataUrl) throw new Error('Data endpointi bulunamadı!');
        const result = await fetchJsonSafe(dataUrl);
        this.data = result.data || result || [];
        this._baseEnrichedDirty = true;
        this.baseEnrichedData = null;
        // Kolonlar otomatik veya şemadan
        if (schema.columns && schema.columns.length) {
            // Eğer columns dizisinde sadece string varsa, string olarak kullan
            if (typeof schema.columns[0] === 'string') {
                this.columns = schema.columns.map(k => ({ dataField: k, caption: k }));
            } else {
                // Doğru format: { dataField: 'AlanAdı', caption: 'Başlık' }
                this.columns = schema.columns;
            }
        } else {
            // Otomatik olarak tüm alanları göster
            this.columns = Object.keys(this.data[0] || {}).map(k => ({ dataField: k, caption: k }));
        }
    }

    sortFilterOptions(values) {
        return [...values].sort((a, b) =>
            String(a ?? '').trim().localeCompare(String(b ?? '').trim(), 'tr-TR', { numeric: true, sensitivity: 'base' })
        );
    }

    getRowValue(row, field) {
        if (!row || !field) return undefined;
        if (row[field] != null && String(row[field]).trim() !== '') return row[field];
        const norm = String(field).toLocaleLowerCase('tr-TR');
        for (const k of Object.keys(row)) {
            if (k.toLocaleLowerCase('tr-TR') === norm) {
                const v = row[k];
                if (v != null && String(v).trim() !== '') return v;
            }
        }
        const aliases = (this.schema.fieldAliases && this.schema.fieldAliases[field]) || [];
        for (const alt of aliases) {
            const v = this.getRowValue(row, alt);
            if (v != null && String(v).trim() !== '') return v;
        }
        return undefined;
    }

    setChartTypeSelectValue(selectEl, value, fallback) {
        if (!selectEl || selectEl.tagName !== 'SELECT') return fallback || 'pie';
        const allowed = [...selectEl.options].map(o => o.value).filter(Boolean);
        const pick = allowed.includes(value)
            ? value
            : (allowed.includes(fallback) ? fallback : (allowed[0] || 'pie'));
        selectEl.value = pick;
        return pick;
    }

    syncChartTypeSelects() {
        (this.schema.charts || []).forEach(chart => {
            if (!chart.typeSelector) return;
            const el = document.querySelector(chart.typeSelector);
            if (!el) return;
            const key = chart.typeSelector.replace('#', '');
            const preferred = this.filterState[key] || el.value || chart.defaultType;
            const resolved = this.setChartTypeSelectValue(el, preferred, chart.defaultType);
            this.filterState[key] = resolved;
        });
    }

    sortFilterDropdowns() {
        (this.schema.filters || []).forEach(f => {
            if (f.staticOptions && f.staticOptions.length) return;
            const select = document.getElementById(f.elementId);
            if (!select || select.tagName !== 'SELECT') return;
            const current = select.value;
            const options = [...select.options].filter(o => o.value !== '');
            options.sort((a, b) =>
                a.text.localeCompare(b.text, 'tr-TR', { numeric: true, sensitivity: 'base' })
            );
            const emptyLabel = f.emptyLabel || 'Tümü';
            select.innerHTML = `<option value="">${emptyLabel}</option>`;
            options.forEach(o => select.appendChild(o));
            if (current) select.value = current;
        });
    }

    normalizeFilterOptionValue(filterDef, raw) {
        if (raw == null) return '';
        let val = raw;
        if (typeof filterDef.normalizeOption === 'function') {
            val = filterDef.normalizeOption(raw);
        } else {
            val = String(raw).trim();
        }
        return val === '' ? '' : String(val);
    }

    updateFilterHint(filterDef, values) {
        if (!filterDef.hintElementId) return;
        const hint = document.getElementById(filterDef.hintElementId);
        if (!hint) return;
        const list = [...values].sort((a, b) =>
            String(a).localeCompare(String(b), 'tr-TR', { numeric: true, sensitivity: 'base' })
        );
    }

    populateFilters() {
        const filterData = this.getWorkingData();
        (this.schema.filters || []).forEach(f => {
            const select = document.getElementById(f.elementId);
            if (!select || select.tagName !== 'SELECT') return;

            if (f.staticOptions && f.staticOptions.length) {
                const saved = this.filterState[f.field] || select.value || '';
                select.innerHTML = '';
                f.staticOptions.forEach(optDef => {
                    const opt = document.createElement('option');
                    opt.value = optDef.value;
                    opt.text = optDef.label;
                    select.appendChild(opt);
                });
                if (saved && [...select.options].some(o => o.value === saved)) {
                    select.value = saved;
                } else if (saved) {
                    select.value = '';
                }
                this.filterState[f.field] = select.value || '';
                return;
            }

            const set = new Set();
            filterData.forEach(d => {
                const val = this.normalizeFilterOptionValue(f, this.getRowValue(d, f.field));
                if (val) set.add(val);
            });
            const saved = this.filterState[f.field] || select.value || '';
            const emptyLabel = f.emptyLabel || 'Tümü';
            select.innerHTML = `<option value="">${emptyLabel}</option>`;
            this.sortFilterOptions([...set]).forEach(val => {
                const opt = document.createElement('option');
                opt.value = val;
                opt.text = typeof f.optionLabel === 'function' ? f.optionLabel(val) : val;
                select.appendChild(opt);
            });
            if (saved && [...select.options].some(o => o.value === saved)) {
                select.value = saved;
            } else if (saved) {
                select.value = '';
            }
            this.filterState[f.field] = select.value || '';
            this.updateFilterHint(f, set);
        });
        // Grafik tipi select'lerinde mevcut seçimi koru
        this.syncChartTypeSelects();
        // Dinamik tarih filtreleri için filterState başlat
        (this.schema.filters || []).forEach(f => {
            if (f.type === 'date') {
                const dateEl = document.getElementById(f.elementId);
                if (dateEl) this.filterState[f.field] = dateEl.value || '';
                if (document.getElementById(f.elementId + '_min')) this.filterState[f.field + '_min'] = '';
                if (document.getElementById(f.elementId + '_max')) this.filterState[f.field + '_max'] = '';
            }
        });
    }

    cloneLegend(legend) {
        if (!legend) return { visible: false };
        return JSON.parse(JSON.stringify(legend));
    }

    isLightTheme() {
        if (window.RaporTheme && typeof window.RaporTheme.getTheme === 'function') {
            return window.RaporTheme.getTheme() === 'light';
        }
        return document.documentElement.getAttribute('data-theme') === 'light';
    }

    getChartUiColors() {
        const light = this.isLightTheme();
        return {
            axisLabel: light ? '#37474f' : '#e0e0e0',
            seriesLabel: light ? '#263238' : '#f0f0f0',
            grid: light ? '#cfd8dc' : '#3a3a3a'
        };
    }

    mergeChartAxisTheme(chartOptions) {
        const colors = this.getChartUiColors();
        const mergeLabel = (axis) => ({
            ...(axis || {}),
            label: {
                ...(axis && axis.label),
                font: {
                    ...((axis && axis.label && axis.label.font) || {}),
                    color: colors.axisLabel
                }
            },
            grid: {
                ...(axis && axis.grid),
                color: colors.grid
            }
        });
        chartOptions.argumentAxis = mergeLabel(chartOptions.argumentAxis);
        chartOptions.valueAxis = mergeLabel(chartOptions.valueAxis);
        if (chartOptions.legend && chartOptions.legend.visible !== false) {
            chartOptions.legend = {
                ...chartOptions.legend,
                font: {
                    ...(chartOptions.legend.font || {}),
                    color: colors.axisLabel
                }
            };
        }
        return chartOptions;
    }

    resolveChartSeriesName(chart) {
        if (chart.seriesName) return chart.seriesName;
        if (chart.legendLabel) return chart.legendLabel;
        const labels = this.schema.summaryColumnLabels || {};
        if (chart.aggregate === 'sum' && chart.valueField && labels[chart.valueField]) {
            return labels[chart.valueField];
        }
        if (chart.field && labels[chart.field]) return labels[chart.field];
        const col = (this.schema.columns || []).find(c => c.dataField === chart.field);
        if (col && col.caption) return col.caption;
        return chart.field;
    }

    findChartByHostId(chartId) {
        const id = String(chartId).replace(/^#/, '');
        return (this.schema.charts || []).find(c => c.elementId === `#${id}` || c.elementId === id);
    }

    getChartSource() {
        return (this.filteredWithCalculated && this.filteredWithCalculated.length)
            ? this.filteredWithCalculated
            : this.filtered;
    }

    chartUsesPointColors(chart) {
        return !!(chart.pointColors || chart.useDataPointColors
            || typeof chart.resolvePointColor === 'function');
    }

    attachPointColors(chart, items) {
        if (!Array.isArray(items)) return items;
        return items.map(item => {
            if (item.color) return item;
            if (chart.colorBySign && Number.isFinite(item.value)) {
                const color = this.signColor(item.value);
                return color ? { ...item, color } : item;
            }
            if (!this.chartUsesPointColors(chart)) return item;
            const color = this.resolvePointColor(chart, item.argument);
            return color ? { ...item, color } : item;
        });
    }

    buildChartData(chart, chartSource) {
        let items;
        if (typeof chart.buildData === 'function') {
            items = chart.buildData(chartSource, this);
        } else {
            const useBuckets = chart.useBuckets || chart.field === 'BekleyenGun';
            if (useBuckets && Array.isArray(this.schema.beklemeSuresiBuckets)) {
                const buckets = this.schema.beklemeSuresiBuckets;
                const grouped = buckets.map(b => ({ bucket: b.key, count: 0, min: b.min, max: b.max }));
                (chartSource || []).forEach(d => {
                    const raw = d[chart.field] ?? d.SeyahatGun ?? d.BekleyenGun ?? d.BeklemeGun;
                    if (raw == null || raw === '' || !Number.isFinite(Number(raw))) return;
                    const gun = Number(raw);
                    const bucket = grouped.find(b => gun >= b.min && gun <= b.max);
                    if (bucket) bucket.count++;
                });
                items = grouped.map(g => ({
                    argument: chart.bucketLabelSuffix === ''
                        ? g.bucket
                        : g.bucket + (chart.bucketLabelSuffix != null ? chart.bucketLabelSuffix : ' gün'),
                    value: g.count,
                    filterValue: g.bucket
                }));
            } else {
                const grouped = {};
                const aggregate = chart.aggregate || 'count';
                const valueField = chart.valueField;
                (chartSource || []).forEach(d => {
                    const key = this.getRowValue(d, chart.field);
                    if (key == null || String(key).trim() === '') return;
                    let add = 1;
                    if (aggregate === 'sum' && valueField) {
                        const raw = this.getRowValue(d, valueField);
                        if (typeof chart.parseValue === 'function') {
                            add = chart.parseValue(raw);
                        } else {
                            add = Number(raw);
                        }
                        if (!Number.isFinite(add)) add = 0;
                    }
                    grouped[key] = (grouped[key] || 0) + add;
                });
                let entries = Object.entries(grouped)
                    .map(([argument, value]) => ({ argument, value }))
                    .sort((a, b) => b.value - a.value);
                const rawLimit = chart.limit;
                const limit = rawLimit === 0 || rawLimit === false
                    ? null
                    : (rawLimit ?? 15);
                if (limit != null && limit > 0) {
                    entries = entries.slice(0, limit);
                }
                items = entries;
            }
        }
        if (Array.isArray(items)) {
            const rawLimit = chart.limit;
            const limit = rawLimit === 0 || rawLimit === false
                ? null
                : (Number.isFinite(rawLimit) ? rawLimit : null);
            if (limit != null && limit > 0 && items.length > limit) {
                items = items.slice(0, limit);
            }
        }
        return this.attachPointColors(chart, items);
    }

    getChartType(chart) {
        if (chart.fixedType) return chart.fixedType;
        return $(chart.typeSelector).val() || chart.defaultType || 'pie';
    }

    createChartClickHandler(chart, useBuckets) {
        return (e) => {
            const pointData = e.target.data || {};
            if (chart.chartClickFilter) {
                const cfg = chart.chartClickFilter;
                const secilen = pointData[cfg.valueKey] ?? pointData.filterValue ?? pointData.argument;
                if (secilen == null || secilen === '') return;
                this.filterState[cfg.field] = secilen;
                this.updateAll();
                return;
            }
            let secilen = pointData.filterValue ?? pointData.matnr ?? pointData.argument
                ?? e.target.originalArgument;
            if (useBuckets && pointData.filterValue == null && chart.bucketLabelSuffix !== '') {
                secilen = String(secilen).replace(/ gün$/, '');
            }
            if (typeof secilen === 'string') secilen = secilen.trim();
            let filterFieldName = chart.filterField || chart.field;
            let filterElemId = chart.filterElementId;
            if (chart.stackedSeries && chart.stackedPieFilterField && this.getChartType(chart) === 'pie') {
                const perfNames = chart.stackedSeries.map(s => s.name);
                if (perfNames.includes(secilen)) {
                    filterFieldName = chart.stackedPieFilterField;
                    filterElemId = chart.stackedPieFilterElementId || filterElemId;
                }
            }
            if (!filterFieldName) return;
            this.filterState[filterFieldName] = secilen;
            const filterField = (this.schema.filters || []).find(f => f.field === filterFieldName);
            if (filterField) {
                this.filterState[filterField.field] = secilen;
                const filterElem = document.getElementById(filterField.elementId);
                if (filterElem) filterElem.value = secilen;
            }
            if (filterElemId) {
                const elem = document.querySelector(filterElemId);
                if (elem) elem.value = secilen;
            }
            this.updateAll();
        };
    }

    getEnlargedChartSize(chartType, count) {
        if (chartType === 'pie') {
            return {
                width: Math.max(1100, Math.min(count * 70, 1800)),
                height: Math.max(680, 420 + Math.ceil(count / 3) * 28)
            };
        }
        if (chartType === 'bar' && count > 8) {
            return {
                width: 1100,
                height: Math.max(700, count * 44)
            };
        }
        return {
            width: Math.max(1100, Math.min(count * 100, 2400)),
            height: count > 10 ? 680 : 620
        };
    }

    buildChartLabelOptions(chart, profile, chartType, useRotatedBar, formatVal, labelCustomize) {
        const isEnlarge = profile === 'enlarge';
        const showLabels = isEnlarge || useRotatedBar;
        if (!showLabels) return { visible: false };
        const labelColor = this.getChartUiColors().seriesLabel;
        return {
            visible: true,
            overlappingBehavior: 'none',
            position: useRotatedBar ? 'outside' : 'top',
            customizeText: labelCustomize || ((point) => formatVal(point.value, point.data)),
            font: { size: isEnlarge ? 11 : 10, color: labelColor },
            backgroundColor: isEnlarge ? (this.isLightTheme() ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.55)') : undefined
        };
    }

    buildPieLabelOptions(isEnlarge, labelCustomize) {
        return {
            visible: true,
            connector: { visible: true, width: 1, color: '#9e9e9e' },
            resolveLabelOverlapping: isEnlarge ? 'shift' : 'shift',
            customizeText: labelCustomize
        };
    }

    buildCompactVerticalBarAxis(chartData, count) {
        const categories = chartData.map(d => String(d.argument ?? ''));
        const labelColor = this.getChartUiColors().axisLabel;
        return {
            categories,
            type: 'discrete',
            discreteAxisDivisionMode: 'crossLabels',
            label: {
                visible: true,
                overlappingBehavior: 'rotate',
                rotationAngle: count > 8 ? -45 : (count > 4 ? -30 : 0),
                wordWrap: 'none',
                font: { size: 9, color: labelColor },
                customizeText: (info) => {
                    const t = String(info.valueText || '');
                    return t.length > 32 ? `${t.slice(0, 30)}…` : t;
                }
            }
        };
    }

    getCompactChartSize($container) {
        const host = $container[0];
        if (!host) return null;
        const width = host.clientWidth || 320;
        const styleHeight = parseInt(host.style.height, 10);
        const height = host.clientHeight || styleHeight || 340;
        return { width, height };
    }

    getCompactPieSize($container, legend, sliceCount) {
        const host = $container[0];
        if (!host) return null;
        const width = host.clientWidth || 320;
        const styleHeight = parseInt(host.style.height, 10);
        const height = host.clientHeight || styleHeight || 340;
        const legendRows = legend?.visible
            ? Math.ceil(sliceCount / (legend.columnCount || 3))
            : 0;
        // Alt margin: legend satır yüksekliği; pasta–legend arası boşluk legend.margin ile
        const legendSpace = legend?.visible ? legendRows * 18 + 6 : 8;
        return { width, height: Math.max(height, 280), legendSpace, legendRows };
    }

    getCompactPieContainerHeight(legend, sliceCount) {
        if (!legend?.visible) return 340;
        const rows = Math.ceil(sliceCount / (legend.columnCount || 3));
        return Math.min(440, 360 + rows * 24);
    }

    static PIE_LEGEND_GAP = 18;

    static COMPACT_PIE_LEGEND_MAX = 4;

    buildLegend(chart, chartType, chartData, profile) {
        const base = this.cloneLegend(chart.legend);
        const count = chartData.length;

        if (profile === 'enlarge') {
            if (chartType === 'pie') {
                return {
                    visible: true,
                    orientation: 'horizontal',
                    horizontalAlignment: 'center',
                    verticalAlignment: 'bottom',
                    itemTextPosition: 'right',
                    columnCount: Math.min(4, Math.max(2, Math.ceil(count / 6))),
                    paddingLeftRight: 12,
                    paddingTopBottom: 8,
                    font: { size: 12 },
                    margin: 28
                };
            }
            return { ...base, visible: true, font: { size: 12 } };
        }

        // Kompakt çubuk/çizgi: tek seri — pasta legend ayarlarını (columnCount, büyük margin) kullanma
        if (chartType !== 'pie') {
            if (chart.legend && chart.legend.visible === false) {
                return { visible: false };
            }
            return {
                visible: true,
                orientation: 'horizontal',
                horizontalAlignment: 'center',
                verticalAlignment: 'bottom',
                itemTextPosition: 'right',
                margin: 8,
                paddingTopBottom: 4,
                paddingLeftRight: 8,
                font: { size: 10 }
            };
        }

        // Kompakt pasta: çok dilimde legend gizle (tooltip yeterli)
        if (chart.legend && chart.legend.visible === false) {
            return { visible: false };
        }

        if (count > RaporModul.COMPACT_PIE_LEGEND_MAX) {
            return { visible: false };
        }

        return {
            visible: true,
            orientation: 'horizontal',
            verticalAlignment: 'bottom',
            horizontalAlignment: 'center',
            itemTextPosition: 'right',
            columnCount: Math.min(3, Math.max(2, Math.ceil(count / 2))),
            margin: RaporModul.PIE_LEGEND_GAP,
            paddingTopBottom: 6,
            paddingLeftRight: 8,
            font: { size: 9 }
        };
    }

    getChartRequirementBlock(chart) {
        const meinsField = chart.meinsField || 'MEINS';
        if (chart.requiresMeins && !this.filterState[meinsField]) {
            return {
                blocked: true,
                html: '<p class="chart-empty-hint">Miktar grafiği için sol panelden <strong>ölçü birimi</strong> seçin — adet, kg, metre vb. karışmasın diye birim bazında gösterilir.</p>',
                toast: 'Miktar grafiği için ölçü birimi seçin.'
            };
        }
        const waersField = chart.waersField || 'WAERS';
        if (chart.requiresWaers && !this.filterState[waersField]) {
            return {
                blocked: true,
                html: '<p class="chart-empty-hint">Tutar grafiği için sol panelden <strong>para birimi </strong> seçin — TRY, EUR, USD vb. karışmasın diye tek para biriminde gösterilir.</p>',
                toast: 'Tutar grafiği için para birimi (TRY, EUR, USD…) seçin.'
            };
        }
        return { blocked: false };
    }

    formatChartValue(chart, value, pointData) {
        if (typeof chart.formatValue === 'function') {
            const unit = pointData?.waers ?? chart._activeWaers
                ?? pointData?.meins ?? chart._activeMeins;
            return chart.formatValue(value, unit);
        }
        return value;
    }

    buildStackedPieData(chart, chartData) {
        if (!chart.stackedSeries || !chartData.length) return [];
        const filterVal = chart.filterField
            ? String(this.filterState[chart.filterField] || '').trim()
            : '';
        const usePerformanceBreakdown = filterVal !== '' || chartData.length === 1;

        if (usePerformanceBreakdown) {
            const row = filterVal
                ? chartData.find(r => r.argument === filterVal || r.filterValue === filterVal) || chartData[0]
                : chartData[0];
            return chart.stackedSeries.map(s => ({
                argument: s.name,
                value: row[s.field] || 0,
                color: s.color,
                filterValue: s.name
            })).filter(d => d.value > 0);
        }

        return chartData.map(row => ({
            argument: row.argument,
            value: chart.stackedSeries.reduce((sum, s) => sum + (row[s.field] || 0), 0),
            filterValue: row.filterValue || row.argument
        })).filter(d => d.value > 0);
    }

    signColor(value) {
        if (!Number.isFinite(value)) return null;
        if (value > 0) return '#e53935';
        if (value < 0) return '#29b6f6';
        return '#43a047';
    }

    resolveBarPointColor(chart, pointInfo, chartData) {
        const row = pointInfo.data
            || (Number.isInteger(pointInfo.index) ? chartData[pointInfo.index] : null)
            || chartData.find(d => d.argument === pointInfo.argument);
        if (row?.color) return row.color;
        if (chart.colorBySign && Number.isFinite(pointInfo.value)) {
            return this.signColor(pointInfo.value);
        }
        return this.resolvePointColor(chart, pointInfo.argument);
    }

    resolvePointColor(chart, argument) {
        if (argument == null) return null;
        const key = String(argument).trim();
        if (typeof chart.resolvePointColor === 'function') {
            return chart.resolvePointColor(key) || null;
        }
        const map = chart.pointColors;
        if (!map) return null;
        if (map[key]) return map[key];
        const lower = key.toLocaleLowerCase('tr-TR');
        if (lower.startsWith('gecikmeli') || lower === 'geç' || lower === 'gec') return map['Geç'] || map.Gecikmeli || map.gecikmeli;
        if (lower === 'zamanında' || lower === 'zamaninda') return map['Zamanında'] || map.Zamaninda;
        if (lower === 'erken') return map.Erken;
        if (lower.startsWith('bekliyor')) return map.Bekliyor;
        return null;
    }

    getSeriesCustomizePoint(chart) {
        if (!chart.pointColors && typeof chart.resolvePointColor !== 'function') return undefined;
        return (pointInfo) => {
            const color = this.resolvePointColor(chart, pointInfo.argument);
            return color ? { color } : {};
        };
    }

    renderDxChart($container, chart, chartData, chartType, profile, onPointClick) {
        const isEnlarge = profile === 'enlarge';
        const palette = chart.palette || undefined;
        const legend = this.buildLegend(chart, chartType, chartData, profile);
        const count = chartData.length;
        const size = isEnlarge ? this.getEnlargedChartSize(chartType, count) : null;
        const useRotatedBar = chartType === 'bar' && (chart.rotatedBar || (isEnlarge && count > 8));
        chart._activeMeins = chartData[0]?.meins;
        chart._activeWaers = chart.waersField
            ? (this.filterState[chart.waersField] || chartData[0]?.waers)
            : chartData[0]?.waers;

        if (isEnlarge) {
            $container.css({ width: size.width, height: size.height, minWidth: size.width, minHeight: size.height });
        } else if (useRotatedBar && count > 0) {
            const h = Math.max(340, Math.min(count * 38 + 100, 720));
            $container.css({ width: '', height: h + 'px', minHeight: h + 'px', maxHeight: h + 'px' });
        } else if (chartType === 'pie' && !isEnlarge && legend?.visible) {
            const pieH = this.getCompactPieContainerHeight(legend, count);
            $container.css({ width: '', height: pieH + 'px', minHeight: pieH + 'px', maxHeight: pieH + 'px' });
        } else {
            $container.css({ width: '', height: '340px', minHeight: '340px', maxHeight: '340px' });
        }

        const formatVal = (value, pointData) => this.formatChartValue(chart, value, pointData);
        const labelCustomize = (point) => formatVal(point.value, point.data);
        const pieLabelCustomize = isEnlarge
            ? (point) => `${point.argumentText}: ${formatVal(point.value, point.data)}`
            : labelCustomize;
        const pieLabels = this.buildPieLabelOptions(isEnlarge, pieLabelCustomize);
        const compactPieSize = chartType === 'pie' && !isEnlarge
            ? this.getCompactPieSize($container, legend, count)
            : null;
        const compactChartSize = !isEnlarge && (chartType === 'bar' || chartType === 'line') && !useRotatedBar
            ? this.getCompactChartSize($container)
            : null;
        const seriesLabels = this.buildChartLabelOptions(chart, profile, chartType, useRotatedBar, formatVal, labelCustomize);
        const stackedLabelCustomize = (point) => {
            const v = point.value;
            if (v == null || v === 0) return '';
            return formatVal(v, point.data);
        };
        const usesPointColors = this.chartUsesPointColors(chart);
        const needsPointCustomizer = usesPointColors || chart.colorBySign;
        const barCustomizePoint = needsPointCustomizer
            ? (pointInfo) => {
                const color = this.resolveBarPointColor(chart, pointInfo, chartData);
                return color ? { color, hoverStyle: { color } } : {};
            }
            : this.getSeriesCustomizePoint(chart);
        const chartPalette = needsPointCustomizer ? undefined : palette;

        if (chart.stackedSeries && chartType === 'pie') {
            const pieData = this.buildStackedPieData(chart, chartData);
            const stackedPieOptions = {
                dataSource: pieData,
                size: isEnlarge
                    ? { width: size.width, height: size.height }
                    : (compactPieSize ? { width: compactPieSize.width, height: compactPieSize.height } : undefined),
                margin: compactPieSize
                    ? { top: 8, bottom: compactPieSize.legendSpace, left: 8, right: 8 }
                    : undefined,
                series: [{
                    argumentField: 'argument',
                    valueField: 'value',
                    label: pieLabels
                }],
                tooltip: { enabled: true, contentTemplate: d => `${d.argumentText}: ${formatVal(d.value, d.point?.data)}` },
                legend,
                onPointClick: onPointClick || undefined,
                customizePoint: (pointInfo) => {
                    const color = pointInfo.data?.color;
                    return color ? { color, hoverStyle: { color } } : {};
                }
            };
            $container.dxPieChart(this.mergeChartAxisTheme(stackedPieOptions));
            return;
        }

        if (chartType === 'pie') {
            const pieOptions = {
                dataSource: chartData,
                size: isEnlarge
                    ? { width: size.width, height: size.height }
                    : (compactPieSize ? { width: compactPieSize.width, height: compactPieSize.height } : undefined),
                margin: compactPieSize
                    ? { top: 8, bottom: compactPieSize.legendSpace, left: 8, right: 8 }
                    : undefined,
                series: [{
                    argumentField: 'argument',
                    valueField: 'value',
                    label: pieLabels
                }],
                tooltip: { enabled: true, contentTemplate: d => `${d.argumentText}: ${formatVal(d.value, d.point?.data)}` },
                legend,
                onPointClick: onPointClick || undefined
            };
            if (chartPalette) pieOptions.palette = chartPalette;
            // dxPieChart: customizePoint grafik kökünde olmalı (seri içinde çalışmaz)
            if (usesPointColors) {
                pieOptions.customizePoint = (pointInfo) => {
                    const color = pointInfo.data?.color || this.resolvePointColor(chart, pointInfo.argument);
                    return color ? { color, hoverStyle: { color } } : {};
                };
            }
            $container.dxPieChart(this.mergeChartAxisTheme(pieOptions));
            return;
        }

        if (chart.stackedSeries && (chartType === 'bar' || chartType === 'line')) {
            const seriesType = chartType === 'bar' ? 'stackedbar' : 'line';
            const stackedSeries = chart.stackedSeries.map(s => ({
                valueField: s.field,
                name: s.name,
                color: s.color,
                type: seriesType
            }));
            const stackedRotated = chartType === 'bar' && useRotatedBar;
            const stackedOptions = {
                dataSource: chartData,
                size: isEnlarge ? { width: size.width, height: size.height } : undefined,
                rotated: stackedRotated,
                commonSeriesSettings: {
                    argumentField: 'argument',
                    type: seriesType,
                    label: {
                        visible: isEnlarge,
                        overlappingBehavior: 'none',
                        customizeText: stackedLabelCustomize,
                        font: { size: 10, color: this.getChartUiColors().seriesLabel },
                        backgroundColor: isEnlarge
                            ? (this.isLightTheme() ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.55)')
                            : undefined
                    }
                },
                series: stackedSeries,
                legend: {
                    visible: true,
                    orientation: 'horizontal',
                    verticalAlignment: 'bottom',
                    horizontalAlignment: 'center',
                    font: { size: isEnlarge ? 12 : 10 }
                },
                tooltip: {
                    enabled: true,
                    shared: false,
                    customizeTooltip: (info) => ({
                        text: `${info.argumentText}\n${info.seriesName}: ${info.valueText}`
                    })
                },
                onPointClick: onPointClick || undefined
            };
            if (stackedRotated) {
                stackedOptions.argumentAxis = {
                    label: { overlappingBehavior: 'ellipsis', font: { size: 11 } }
                };
            } else {
                const rotation = count > 6 ? -45 : (count > 4 ? -30 : 0);
                stackedOptions.argumentAxis = {
                    label: {
                        visible: true,
                        overlappingBehavior: 'rotate',
                        rotationAngle: rotation,
                        font: { size: 10 }
                    }
                };
            }
            $container.dxChart(this.mergeChartAxisTheme(stackedOptions));
            return;
        }

        const rotation = count > 6 ? -45 : (count > 4 ? -30 : 0);
        const chartOptions = {
            dataSource: chartData,
            palette: chartPalette,
            size: isEnlarge
                ? { width: size.width, height: size.height }
                : (compactChartSize ? { width: compactChartSize.width, height: compactChartSize.height } : undefined),
            rotated: useRotatedBar,
            customizePoint: needsPointCustomizer ? barCustomizePoint : undefined,
            commonSeriesSettings: {
                argumentField: 'argument',
                type: chartType
            },
            series: [{
                valueField: 'value',
                name: this.resolveChartSeriesName(chart),
                type: chartType,
                label: seriesLabels
            }],
            tooltip: { enabled: true, contentTemplate: d => `${d.argumentText}: ${formatVal(d.value, d.point?.data)}` },
            legend,
            onPointClick: onPointClick || undefined
        };
        if (useRotatedBar) {
            chartOptions.argumentAxis = {
                label: { overlappingBehavior: 'ellipsis', font: { size: 11 } }
            };
            chartOptions.valueAxis = {
                label: {
                    customizeText: (info) => {
                        const code = String(chartData[0]?.meins || '').toUpperCase();
                        const asInteger = ['ADT', 'ST', 'PC', 'PCE', 'EA'].includes(code);
                        return asInteger
                            ? Math.round(info.value).toLocaleString('tr-TR')
                            : info.value.toLocaleString('tr-TR', { maximumFractionDigits: 1 });
                    }
                }
            };
        } else if (isEnlarge) {
            chartOptions.argumentAxis = {
                label: {
                    visible: true,
                    overlappingBehavior: 'none',
                    rotationAngle: useRotatedBar ? 0 : rotation,
                    font: { size: 11 }
                }
            };
        } else if (chartType === 'bar' && !useRotatedBar && count > 0) {
            chartOptions.argumentAxis = this.buildCompactVerticalBarAxis(chartData, count);
        } else if (chartType === 'line' && !isEnlarge && count > 4) {
            chartOptions.argumentAxis = this.buildCompactVerticalBarAxis(chartData, count);
        }
        $container.dxChart(this.mergeChartAxisTheme(chartOptions));
    }

    enlargeChart(chartId, title) {
        const chart = this.findChartByHostId(chartId);
        if (!chart) {
            RaporModul.enlargeChartLegacy(chartId, title);
            return;
        }

        const req = this.getChartRequirementBlock(chart);
        if (req.blocked) {
            if (typeof showToast === 'function') showToast(req.toast, 'warning');
            else alert(req.toast);
            return;
        }

        const oldModal = document.getElementById('chartEnlargeModal');
        if (oldModal) oldModal.remove();

        const chartData = this.buildChartData(chart, this.getChartSource());
        const chartType = this.getChartType(chart);
        const size = this.getEnlargedChartSize(chartType, chartData.length);
        const useBuckets = chart.useBuckets || chart.field === 'BekleyenGun';
        const onPointClick = this.createChartClickHandler(chart, useBuckets);

        const modal = document.createElement('div');
        modal.id = 'chartEnlargeModal';
        modal.className = 'chart-modal-backdrop';
        modal.innerHTML = `
            <div class="chart-modal-panel">
                <h2 class="chart-modal-title">${title}</h2>
                <div id="modalChartScroll" style="overflow:auto;max-width:90vw;">
                    <div id="modalChartHost"></div>
                </div>
                <button type="button" id="chartEnlargeCloseBtn" class="chart-modal-close">Kapat</button>
            </div>`;
        document.body.appendChild(modal);

        const close = () => {
            this.disposeChartElement('#modalChartHost');
            modal.remove();
        };
        modal.querySelector('#chartEnlargeCloseBtn').onclick = close;
        modal.addEventListener('click', (e) => { if (e.target === modal) close(); });

        this.renderDxChart($('#modalChartHost'), chart, chartData, chartType, 'enlarge', onPointClick);
    }

    downloadChart(chartId, title) {
        const chart = this.findChartByHostId(chartId);
        if (!chart) {
            RaporModul.downloadSVGLegacy(chartId, title);
            return;
        }

        const req = this.getChartRequirementBlock(chart);
        if (req.blocked) {
            if (typeof showToast === 'function') showToast(req.toast, 'warning');
            else alert(req.toast);
            return;
        }

        const hostId = 'chartDownloadHost';
        let $host = $(`#${hostId}`);
        if (!$host.length) {
            $('body').append(`<div id="${hostId}"></div>`);
            $host = $(`#${hostId}`);
        }

        this.disposeChartElement(`#${hostId}`);
        const chartData = this.buildChartData(chart, this.getChartSource());
        const chartType = this.getChartType(chart);
        const size = this.getEnlargedChartSize(chartType, chartData.length);

        $host.css({
            position: 'fixed',
            left: '-20000px',
            top: '0',
            width: `${size.width}px`,
            height: `${size.height}px`,
            opacity: '0.01',
            pointerEvents: 'none',
            zIndex: '-1',
            overflow: 'visible'
        });

        let exported = false;
        const finish = () => {
            if (exported) return;
            exported = true;
            const svgElem = document.getElementById(hostId)?.querySelector('svg');
            if (!svgElem) {
                alert('Grafik indirilemedi.');
            } else {
                RaporModul.saveSvgElement(svgElem, title);
            }
            this.disposeChartElement(`#${hostId}`);
            $host.css({
                position: '',
                left: '',
                top: '',
                width: '',
                height: '',
                opacity: '',
                pointerEvents: '',
                zIndex: '',
                overflow: ''
            });
        };

        this.renderDxChart($host, chart, chartData, chartType, 'enlarge', null);

        const bindDrawn = () => {
            try {
                const inst = $host.dxPieChart('instance') || $host.dxChart('instance');
                if (!inst) return false;
                inst.off('drawn', finish);
                inst.on('drawn', finish);
                inst.render();
                return true;
            } catch (_) {
                return false;
            }
        };

        if (!bindDrawn()) {
            setTimeout(bindDrawn, 80);
        }
        setTimeout(finish, 1800);
    }

    disposeChartElement(elementId) {
        const $el = $(elementId);
        if (!$el.length) return;
        try {
            const pie = $el.dxPieChart('instance');
            if (pie) pie.dispose();
        } catch (_) {}
        try {
            const bar = $el.dxChart('instance');
            if (bar) bar.dispose();
        } catch (_) {}
        $el.empty();
        $el.css({ width: '', height: '340px', minHeight: '340px', maxHeight: '340px' });
    }

    getDataFilterKeys() {
        const keys = new Set();
        (this.schema.filters || []).forEach(f => {
            if (document.getElementById(f.elementId) && !f.uiOnly) keys.add(f.field);
        });
        (this.schema.charts || []).forEach(c => {
            if (c.field) keys.add(c.field);
            if (c.chartClickFilter?.field) keys.add(c.chartClickFilter.field);
        });
        if (this.schema.bucketFilters) {
            Object.keys(this.schema.bucketFilters).forEach(k => keys.add(k));
        }
        if (this.schema.virtualFilters) {
            Object.keys(this.schema.virtualFilters).forEach(k => keys.add(k));
        }
        return keys;
    }

    getUiStateKeys() {
        const keys = new Set();
        (this.schema.filters || []).forEach(f => {
            if (f.uiOnly) keys.add(f.field);
        });
        (this.schema.charts || []).forEach(c => {
            if (c.typeSelector) keys.add(c.typeSelector.replace('#', ''));
        });
        return keys;
    }

    syncFilterStateFromDom() {
        (this.schema.filters || []).forEach(f => {
            const elem = document.getElementById(f.elementId);
            if (!elem) return;
            this.filterState[f.field] = elem.value || '';
        });
    }

    getFilteredData() {
        this.syncFilterStateFromDom();
        const dataFilterKeys = this.getDataFilterKeys();
        const uiStateKeys = this.getUiStateKeys();
        const sourceData = this.getWorkingData();
        return sourceData.filter(d => {
            let match = true;
            for (const key in this.filterState) {
                if (!this.filterState.hasOwnProperty(key)) continue;
                if (uiStateKeys.has(key)) continue;
                if (!dataFilterKeys.has(key)) continue;
                const val = this.filterState[key];
                if (val === undefined || val === null || val === '') continue;
                // Tarih filtreleri
                const filterDef = (this.schema.filters || []).find(f => f.field === key);
                if (filterDef && filterDef.type === 'date') {
                    const recValStr = normalizeDateOnly(this.getRowValue(d, key));
                    const inputValStr = normalizeDateOnly(val);
                    let compare = filterDef.compare;
                    if (!compare) {
                        const id = (filterDef.elementId || '').toLowerCase();
                        const field = (filterDef.field || '').toLowerCase();
                        if (id.includes('min') || id.includes('start') || id.includes('begin') || field.includes('min') || field.includes('start') || field.includes('begin')) {
                            compare = '>=';
                        } else if (id.includes('max') || id.includes('end') || id.includes('finish') || field.includes('max') || field.includes('end') || field.includes('finish')) {
                            compare = '<=';
                        } else {
                            compare = '=';
                        }
                    }
                    if (!recValStr || !inputValStr) {
                        if (compare === '=') match = false;
                    } else if (compare === '>=') {
                        if (recValStr < inputValStr) match = false;
                    } else if (compare === '<=') {
                        if (recValStr > inputValStr) match = false;
                    } else if (compare === '=') {
                        if (recValStr !== inputValStr) match = false;
                    }
                } else if (this.schema.bucketFilters && this.schema.bucketFilters[key]) {
                    const cfg = this.schema.bucketFilters[key];
                    const bucket = (cfg.buckets || []).find(b => b.key === val);
                    if (bucket) {
                        const fields = cfg.fields || [key];
                        const v = fields.map(f => {
                            const raw = this.getRowValue(d, f);
                            return raw == null || raw === '' ? NaN : Number(raw);
                        }).find(n => !isNaN(n));
                        if (isNaN(v) || !(v >= bucket.min && v <= bucket.max)) match = false;
                    }
                } else if (this.schema.virtualFilters && this.schema.virtualFilters[key]) {
                    const cfg = this.schema.virtualFilters[key];
                    const fields = cfg.fields || [key];
                    const rowVal = fields.map(f => this.getRowValue(d, f)).find(v => v != null && v !== '');
                    if (String(rowVal || '') !== String(val)) match = false;
                } else {
                    const normalizedVal = String(val).trim().toLowerCase();
                    const fields = (filterDef && filterDef.matchFields) || [key];
                    const rowMatch = fields.some(f =>
                        String(this.getRowValue(d, f) || '').trim().toLowerCase() === normalizedVal
                    );
                    if (!rowMatch) match = false;
                }
                if (!match) break;
            }
            return match;
        });
    }

    updateAll() {
        this.filtered = this.getFilteredData();
        this.filteredWithCalculated = this.filtered;
        this.renderGrid();
        this.renderSummaries();
        this.renderCharts();
        this.renderDistributionTable();
        if (typeof this.schema.afterUpdateAll === 'function') {
            this.schema.afterUpdateAll(this);
        }
    }

    buildGridColumns() {
        return this.columns.map(col => {
            const mapped = { ...col };
            if (col.visible === false) {
                mapped.allowExporting = true;
                mapped.showInColumnChooser = false;
            }
            if (!col.forceText) return mapped;
            return {
                ...mapped,
                calculateCellValue: row => row[col.dataField] != null ? String(row[col.dataField]) : ''
            };
        });
    }

    getHiddenExportColumnFields(columns) {
        return columns
            .filter(c => c.visible === false && c.dataField)
            .map(c => c.dataField);
    }

    createGridExportHandlers(hiddenFields) {
        const hideColumns = (component) => {
            hiddenFields.forEach(field => component.columnOption(field, 'visible', false));
        };
        return {
            onExporting: (e) => {
                hiddenFields.forEach(field => e.component.columnOption(field, 'visible', true));
                // onExported eski DevExtreme sürümlerinde tetiklenmeyebilir
                setTimeout(() => hideColumns(e.component), 1500);
            },
            onExported: (e) => hideColumns(e.component)
        };
    }

    renderGrid() {
        const gridElem = $("#gridContainer");
        let grid = gridElem.data("dxDataGrid");
        const gridData = this.filteredWithCalculated;
        const gridColumns = this.buildGridColumns();
        const hiddenExportFields = this.getHiddenExportColumnFields(gridColumns);
        const exportHandlers = this.createGridExportHandlers(hiddenExportFields);
        if (!grid) {
            gridElem.dxDataGrid({
                dataSource: gridData,
                columns: gridColumns,
                noDataText: 'Kayıt bulunamadı. Filtreleri temizleyip tekrar deneyin.',
                showBorders: true,
                filterRow: { visible: true },
                searchPanel: { visible: true, width: 240, placeholder: "Ara..." },
                paging: { pageSize: 10 },
                pager: { showPageSizeSelector: true, allowedPageSizes: [10, 20, 50, 100], showInfo: true },
                columnAutoWidth: false,
                allowColumnResizing: true,
                allowColumnReordering: true,
                rowAlternationEnabled: true,
                scrolling: { mode: "standard" },
                export: {
                    enabled: true,
                    allowExportSelectedData: true,
                    texts: {
                        exportAll: "Tümünü Excel'e Aktar",
                        exportSelectedRows: "Seçileni Aktar",
                        exportTo: "Excel'e Aktar"
                    }
                },
                onExporting: exportHandlers.onExporting,
                onExported: exportHandlers.onExported,
            });
        } else {
            const instance = gridElem.dxDataGrid("instance");
            instance.option("columns", gridColumns);
            instance.option("dataSource", gridData);
            instance.option("onExporting", exportHandlers.onExporting);
            instance.option("onExported", exportHandlers.onExported);
        }
    }

    buildSummaryModalColumns(cfg) {
        const allCols = this.buildGridColumns();
        const colMap = new Map(allCols.map(c => [c.dataField, c]));
        const labelMap = this.schema.summaryColumnLabels || {};
        if (cfg && cfg.columns && cfg.columns.length) {
            return cfg.columns
                .map(df => {
                    const col = colMap.get(df);
                    if (col) return { ...col, visible: true, allowExporting: true };
                    const caption = labelMap[df] || labelMap[String(df)] || df;
                    return { dataField: df, caption, visible: true };
                })
                .filter(Boolean);
        }
        return allCols.filter(c => c.visible !== false);
    }

    getSummaryDetailRows(summary, summaryValue) {
        const cfg = summary.detailModal || {};
        const sortField = cfg.sortField || summary.field;
        let data = [...(this.filteredWithCalculated || this.filtered || [])];

        if (typeof cfg.filterRows === 'function') {
            data = cfg.filterRows(data, summary, this);
        }

        const sortDir = cfg.sortOrder === 'asc' ? 1 : -1;
        if (sortField) {
            data.sort((a, b) => {
                const na = Number(this.getRowValue(a, sortField));
                const nb = Number(this.getRowValue(b, sortField));
                if (!isNaN(na) && !isNaN(nb)) return sortDir * (na - nb);
                const sa = this.getRowValue(a, sortField);
                const sb = this.getRowValue(b, sortField);
                return sortDir * String(sa ?? '').localeCompare(String(sb ?? ''), 'tr-TR', { numeric: true });
            });
        }

        const maxVal = Number(summaryValue);
        if (summary.type === 'max' && cfg.nearMaxMargin != null && !isNaN(maxVal)) {
            const minVal = maxVal - cfg.nearMaxMargin;
            data = data.filter(d => {
                const v = Number(this.getRowValue(d, sortField));
                return !isNaN(v) && v >= minVal;
            });
        }

        if (cfg.topN != null && Number.isFinite(cfg.topN)) {
            data = data.slice(0, cfg.topN);
        }
        return data;
    }

    openSummaryDetailModal(summary, summaryValue) {
        const cfg = summary.detailModal;
        if (!cfg) return;

        const existing = document.getElementById('summaryDetailModal');
        if (existing) existing.remove();

        const sortField = cfg.sortField || summary.field;
        const rows = this.getSummaryDetailRows(summary, summaryValue);
        const maxVal = Number(summaryValue);
        const maxCount = !isNaN(maxVal)
            ? rows.filter(d => Number(this.getRowValue(d, sortField)) === maxVal).length
            : 0;

        let title = 'Detay';
        if (typeof cfg.title === 'function') {
            title = cfg.title(rows, summaryValue, this);
        } else if (typeof cfg.title === 'string' && cfg.title.trim()) {
            title = cfg.title;
        }

        let subtitle = `${rows.length} kayıt`;
        if (typeof cfg.subtitle === 'function') {
            subtitle = cfg.subtitle(rows, summaryValue, this);
        } else if (typeof cfg.subtitle === 'string' && cfg.subtitle.trim()) {
            subtitle = cfg.subtitle;
        } else if (cfg.topN) {
            subtitle = `Listede ${rows.length} kayıt`;
        } else if (!isNaN(maxVal) && summary.type === 'max') {
            subtitle = `En yüksek: ${maxVal} gün`;
            if (maxCount) subtitle += ` (${maxCount} kayıt)`;
            if (cfg.nearMaxMargin != null) {
                subtitle += ` · Son ${cfg.nearMaxMargin} gün aralığındaki kayıtlar`;
            }
            subtitle += ` · Toplam ${rows.length} kayıt`;
        }

        const backdrop = document.createElement('div');
        backdrop.id = 'summaryDetailModal';
        backdrop.className = 'chart-modal-backdrop';
        backdrop.innerHTML = `
            <div class="chart-modal-panel summary-detail-panel">
                <button type="button" class="chart-modal-close" id="summaryDetailCloseBtn">Kapat</button>
                <h2 class="chart-modal-title">${title}</h2>
                <p class="summary-detail-subtitle">${subtitle}</p>
                <div id="summaryDetailGrid"></div>
            </div>
        `;
        document.body.appendChild(backdrop);

        const close = () => {
            const gridHost = $('#summaryDetailGrid');
            if (gridHost.data('dxDataGrid')) gridHost.dxDataGrid('dispose');
            backdrop.remove();
        };
        backdrop.querySelector('#summaryDetailCloseBtn').onclick = close;
        backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close(); });

        const self = this;
        const modalColumns = this.buildSummaryModalColumns(cfg);
        $('#summaryDetailGrid').dxDataGrid({
            dataSource: rows,
            columns: modalColumns,
            showBorders: true,
            filterRow: { visible: true },
            searchPanel: { visible: true, width: 240, placeholder: 'Ara...' },
            paging: { pageSize: 10 },
            pager: {
                showPageSizeSelector: true,
                allowedPageSizes: [10, 20, 50, 100],
                showInfo: true
            },
            sorting: { mode: 'multiple' },
            columnAutoWidth: true,
            allowColumnResizing: true,
            rowAlternationEnabled: true,
            height: 'min(60vh, 520px)',
            onRowPrepared: cfg.highlightMax && !isNaN(maxVal)
                ? (e) => {
                    if (e.rowType !== 'data') return;
                    const v = Number(self.getRowValue(e.data, sortField));
                    if (!isNaN(v) && v === maxVal) {
                        e.rowElement.addClass('summary-detail-row-max');
                    }
                }
                : undefined
        });
    }

    fitStatCardValues() {
        $('.stat-card h3').each(function () {
            const el = this;
            const $el = $(el);
            $el.css('font-size', '');
            if ($el.hasClass('stat-card-value--multi')) {
                $el.find('.stat-kpi-line').each(function () {
                    this.style.fontSize = '';
                });
                const cardW = $el.closest('.stat-card').innerWidth() - 28;
                let minFs = 16;
                $el.find('.stat-kpi-line').each(function () {
                    const line = this;
                    if (line.scrollWidth <= cardW) return;
                    let fs = parseFloat(getComputedStyle(line).fontSize) || 14.7;
                    while (line.scrollWidth > cardW && fs > 10) {
                        fs -= 0.5;
                        line.style.fontSize = `${fs}px`;
                    }
                    minFs = Math.min(minFs, fs);
                });
                if (minFs < 16) {
                    $el.find('.stat-kpi-line').each(function () {
                        this.style.fontSize = `${minFs}px`;
                    });
                }
                return;
            }
            if (el.scrollWidth <= el.clientWidth) return;
            const cardW = $el.closest('.stat-card').innerWidth() - 28;
            let fs = parseFloat(getComputedStyle(el).fontSize) || 18.4;
            while (el.scrollWidth > cardW && fs > 10) {
                fs -= 0.5;
                el.style.fontSize = `${fs}px`;
            }
        });
    }

    renderSummaries() {
        // Şemadaki özetler (istatistik kutuları)
        const data = this.filteredWithCalculated || this.filtered;
        (this.schema.summaries || []).forEach(summary => {
            let value = '-';
            if (typeof summary.calc === 'function') {
                value = summary.calc(data, this);
            } else if (summary.type === 'count') {
                value = data.length;
            } else if (summary.type === 'max') {
                const vals = data.map(d => Number(this.getRowValue(d, summary.field))).filter(x => !isNaN(x));
                value = vals.length ? Math.max(...vals) : '-';
            } else if (summary.type === 'avg') {
                const vals = data.map(d => Number(this.getRowValue(d, summary.field))).filter(x => !isNaN(x));
                value = vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1) : '-';
            } else if (typeof summary.calc === 'function') {
                value = summary.calc(data);
            }
            const $el = $(summary.elementId);
            if (summary.htmlValue) {
                const lineCount = (String(value).match(/stat-kpi-line/g) || []).length;
                $el.toggleClass('stat-card-value--multi', lineCount > 1);
                $el.html(value);
            } else {
                $el.removeClass('stat-card-value--multi').text(value);
            }

            const $card = $el.closest('.stat-card');
            let $icon = $card.find('.stat-card-detail-icon');
            if (summary.detailModal && value !== '-') {
                if (!$icon.length) {
                    $icon = $(`<span class="stat-card-detail-icon" aria-hidden="true">
                        <svg viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                            <circle cx="12" cy="12" r="3"></circle>
                        </svg>
                    </span>`);
                    $card.append($icon);
                }
                $icon.show();
                $card.addClass('stat-card-clickable').attr('title', 'Detay için tıklayın');
                $card.off('click.summaryDetail').on('click.summaryDetail', () => {
                    const modalValue = summary.htmlValue ? $el.text().trim() : value;
                    this.openSummaryDetailModal(summary, modalValue);
                });
            } else {
                if ($icon.length) $icon.hide();
                $card.removeClass('stat-card-clickable').removeAttr('title').off('click.summaryDetail');
            }
        });
        requestAnimationFrame(() => this.fitStatCardValues());
    }

    renderCharts() {
        const chartSource = this.getChartSource();
        (this.schema.charts || []).forEach(chart => {
            try {
                const req = this.getChartRequirementBlock(chart);
                if (req.blocked) {
                    this.disposeChartElement(chart.elementId);
                    $(chart.elementId).html(req.html);
                    return;
                }
                const chartData = this.buildChartData(chart, chartSource);
                const chartType = this.getChartType(chart);
                const useBuckets = chart.useBuckets || chart.field === 'BekleyenGun';
                const handleChartClick = this.createChartClickHandler(chart, useBuckets);
                this.disposeChartElement(chart.elementId);
                this.renderDxChart($(chart.elementId), chart, chartData, chartType, 'compact', handleChartClick);
            } catch (err) {
                console.error('Grafik render hatasi:', chart.elementId, err);
            }
        });
    }

    bindEvents() {
        // Grid yüksekliği ve pencere resize
        const gridElem = $("#gridContainer");
        let grid = gridElem.data("dxDataGrid");
        if (gridElem.length && grid) {
            const headerHeight = $(".dx-datagrid-headers").outerHeight() || 0;
            const footerHeight = $(".dx-datagrid-pager").outerHeight() || 0;
            const gridHeight = $(window).height() - $("#filterContainer").outerHeight() - headerHeight - footerHeight - 40;
            gridElem.dxDataGrid("instance").option("height", gridHeight);
            $(window).off("resize.grid").on("resize.grid", () => {
                const headerHeight = $(".dx-datagrid-headers").outerHeight() || 0;
                const footerHeight = $(".dx-datagrid-pager").outerHeight() || 0;
                const gridHeight = $(window).height() - $("#filterContainer").outerHeight() - headerHeight - footerHeight - 40;
                gridElem.dxDataGrid("instance").option("height", gridHeight);
            });
        }

        // Filtre değişiklikleri (filtrele butonu yok, otomatik çalışıyor)
        (this.schema.filters || []).forEach(f => {
            const elem = document.getElementById(f.elementId);
            if (!elem) return;
            const applyFilter = () => {
                this.filterState[f.field] = elem.value;
                if (f.type === 'date') {
                    if (document.getElementById(f.elementId + '_min')) {
                        this.filterState[f.field + '_min'] = document.getElementById(f.elementId + '_min').value;
                    }
                    if (document.getElementById(f.elementId + '_max')) {
                        this.filterState[f.field + '_max'] = document.getElementById(f.elementId + '_max').value;
                    }
                }
                this.updateAll();
            };
            elem.addEventListener('change', applyFilter);
            if (f.type === 'date') elem.addEventListener('input', applyFilter);
        });

        // Grafik tipi değişiklikleri
        (this.schema.charts || []).forEach(chart => {
            if (chart.typeSelector) {
                const el = document.querySelector(chart.typeSelector);
                if (el) el.addEventListener('change', () => {
                    const key = chart.typeSelector.replace('#', '');
                    const resolved = this.setChartTypeSelectValue(el, el.value, chart.defaultType);
                    this.filterState[key] = resolved;
                    this.renderCharts();
                });
            }
        });

        if (!this._themeBound) {
            this._themeBound = true;
            window.addEventListener('rapor-theme-change', () => this.renderCharts());
        }

        // Temizle butonu
        document.querySelectorAll('.clear-filters').forEach(btn => {
            btn.addEventListener('click', () => {
                // Tüm filtre input/select sıfırla
                (this.schema.filters || []).forEach(f => {
                    const elem = document.getElementById(f.elementId);
                    if (elem) elem.value = '';
                    this.filterState[f.field] = '';
                });
                // Tüm grafik tipi select sıfırla
                (this.schema.charts || []).forEach(chart => {
                    if (chart.typeSelector) {
                        const el = document.querySelector(chart.typeSelector);
                        if (el) el.value = '';
                        this.filterState[chart.typeSelector.replace('#','')] = '';
                    }
                });
                // Dinamik olarak filterState'te kalan diğer alanları da sıfırla
                for (const key in this.filterState) {
                    if (!this.filterState.hasOwnProperty(key)) continue;
                    // filters ve charts dışında kalanları sıfırla
                    const isFilter = (this.schema.filters || []).some(f => f.field === key);
                    const isChartType = (this.schema.charts || []).some(chart => chart.typeSelector && chart.typeSelector.replace('#','') === key);
                    if (!isFilter && !isChartType) {
                        this.filterState[key] = '';
                    }
                }
                this.updateAll();
            });
        });

        // Varsayılan rapor kaydet butonu
        const saveBtnId = 'saveDefaultReport_' + (this.schema.reportKey || 'default');
        if (document.getElementById(saveBtnId)) {
            document.getElementById(saveBtnId).onclick = () => this.saveDefaultFilters();
        }
    }

    buildPivotData(data, fields, fieldMappings) {
        const mappings = fieldMappings || {};
        const resolvers = this.schema.pivotValueResolvers || {};
        return data.map(d => {
            const row = {};
            fields.forEach(f => {
                let val = null;
                if (resolvers[f.dataField]) {
                    val = resolvers[f.dataField](d);
                } else if (mappings[f.dataField]) {
                    for (const key of mappings[f.dataField]) {
                        if (d[key] !== undefined && d[key] !== null) {
                            val = d[key];
                            break;
                        }
                    }
                } else if (d[f.dataField] !== undefined) {
                    val = d[f.dataField];
                }
                const dateField = d.SurecBaslangicTarihi || d.BaslamaTarihi || d['Başlama Tarihi']
                    || d.SeyahatBaslangicIso
                    || (this.schema.pivotDateField ? d[this.schema.pivotDateField] : null)
                    || d.BUDAT;
                if (val == null && f.dataField === 'Yil' && dateField) {
                    const dt = new Date(dateField);
                    if (!isNaN(dt)) val = dt.getFullYear();
                }
                if (val == null && f.dataField === 'Hafta' && dateField) {
                    const dt = new Date(dateField);
                    if (!isNaN(dt)) {
                        const jan1 = new Date(dt.getFullYear(), 0, 1);
                        const days = Math.floor((dt - jan1) / 86400000);
                        val = Math.ceil((days + jan1.getDay() + 1) / 7);
                    }
                }
                if (val == null && f.dataField === 'Adet') val = 1;
                row[f.dataField] = val;
            });
            return row;
        });
    }

    renderPivotTable(cfg) {
        const container = $('#' + cfg.containerId);
        if (!container.length) return;
        const data = (this.filteredWithCalculated && this.filteredWithCalculated.length)
            ? this.filteredWithCalculated
            : this.filtered;
        if (!data || !data.length || !cfg.fields) {
            container.dxPivotGrid({ dataSource: [] });
            return;
        }
        const pivotData = this.buildPivotData(data, cfg.fields, cfg.fieldMappings);
        container.dxPivotGrid({
            dataSource: {
                fields: cfg.fields,
                store: pivotData
            },
            allowSortingBySummary: true,
            allowFiltering: true,
            showBorders: true,
            showColumnGrandTotals: true,
            showColumnTotals: true,
            showRowGrandTotals: true,
            showRowTotals: true,
            texts: cfg.texts || {
                grandTotal: 'Tüm Yılların Toplamı',
                total: 'O Yıla Ait Alt Toplam'
            },
            onCellPrepared: function(e) {
                if (e.area === 'data' && typeof e.cell.value === 'number' && e.cell.value > 7) {
                    e.cellElement.css({ background: '#e57373', color: '#fff', fontWeight: 'bold' });
                }
            },
            height: cfg.height || 500,
            scrolling: { mode: 'both', useNative: true },
            export: { enabled: true, fileName: cfg.fileName || 'OzetTablo' },
            fieldChooser: { enabled: true }
        });
    }

    renderDistributionTable() {
        if (this.schema.pivotTables && this.schema.pivotTables.length) {
            this.schema.pivotTables.forEach(cfg => this.renderPivotTable(cfg));
            return;
        }
        const container = $("#pivotGridContainer");
        if (!container.length || !this.schema.pivotFields) return;
        const data = (this.filteredWithCalculated && this.filteredWithCalculated.length)
            ? this.filteredWithCalculated
            : this.filtered;
        if (!data || !data.length) {
            container.dxPivotGrid({ dataSource: [] });
            return;
        }
        const pivotData = this.buildPivotData(data, this.schema.pivotFields, this.schema.pivotFieldMappings);
        container.dxPivotGrid({
            dataSource: {
                fields: this.schema.pivotFields,
                store: pivotData
            },
            allowSortingBySummary: true,
            allowFiltering: true,
            showBorders: true,
            showColumnGrandTotals: true,
            showColumnTotals: true,
            showRowGrandTotals: true,
            showRowTotals: true,
            texts: {
                grandTotal: 'Tüm Yılların Toplamı',
                total: 'O Yıla Ait Alt Toplam'
            },
            onCellPrepared: function(e) {
                if (e.area === 'data' && typeof e.cell.value === 'number' && e.cell.value > 7) {
                    e.cellElement.css({ background: '#e57373', color: '#fff', fontWeight: 'bold' });
                }
            },
            height: 500,
            scrolling: { mode: 'both', useNative: true },
            export: { enabled: true, fileName: 'OzetTablo' },
            fieldChooser: { enabled: true }
        });
    }
}

