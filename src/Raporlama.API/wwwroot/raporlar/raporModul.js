window.API_BASE = window.API_BASE || (window.location.origin + '/api');

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
            if (!reportId || isNaN(reportId) || reportId <= 0) return;
            let filters = null;
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
            // Fallback: localStorage
            if (!filters) {
                const raw = localStorage.getItem(this.getStorageKey());
                if (raw) {
                    try { filters = JSON.parse(raw); } catch {}
                }
            }
            if (!filters) return;
            // filterState'i güncelle
            this.filterState = { ...filters };
            // Tüm input/select ve grafik tipi değerlerini DOM'a uygula
            (this.schema.filters || []).forEach(f => {
                const elem = document.getElementById(f.elementId);
                if (elem && filters[f.field] !== undefined) elem.value = filters[f.field];
                // Dinamik date filtreleri için de uygula
                if (f.type === 'date') {
                    const dateVal = filters[f.field];
                    if (elem && dateVal) elem.value = dateVal;
                }
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
        this.filtered = [];
        this.columns = [];
        this.filteredWithCalculated = [];
        this.pivotFields = [];
    }

    async init() {
        try {
            await this.fetchSchemaAndData();
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
            const select = document.getElementById(f.elementId);
            if (!select || select.tagName !== 'SELECT') return;
            const current = select.value;
            const options = [...select.options].filter(o => o.value !== '');
            options.sort((a, b) =>
                a.text.localeCompare(b.text, 'tr-TR', { numeric: true, sensitivity: 'base' })
            );
            select.innerHTML = '<option value="">Tümü</option>';
            options.forEach(o => select.appendChild(o));
            if (current) select.value = current;
        });
    }

    populateFilters() {
        const filterData = typeof this.schema.enrichRow === 'function'
            ? this.data.map(r => this.schema.enrichRow(r))
            : this.data;
        (this.schema.filters || []).forEach(f => {
            const set = new Set(filterData.map(d => this.getRowValue(d, f.field)).filter(Boolean));
            const select = document.getElementById(f.elementId);
            if (!select || select.tagName !== 'SELECT') return;
            const saved = this.filterState[f.field] || select.value || '';
            select.innerHTML = `<option value="">Tümü</option>`;
            this.sortFilterOptions([...set]).forEach(val => {
                const opt = document.createElement('option');
                opt.value = val;
                opt.text = val;
                select.appendChild(opt);
            });
            if (saved) select.value = saved;
            this.filterState[f.field] = select.value || '';
        });
        // Grafik tipi select'lerinde mevcut seçimi koru
        this.syncChartTypeSelects();
        // Dinamik tarih filtreleri için filterState başlat
        (this.schema.filters || []).forEach(f => {
            if (f.type === 'date') {
                if (document.getElementById(f.elementId + '_min')) this.filterState[f.field + '_min'] = '';
                if (document.getElementById(f.elementId + '_max')) this.filterState[f.field + '_max'] = '';
            }
        });
    }

    cloneLegend(legend) {
        if (!legend) return { visible: false };
        return JSON.parse(JSON.stringify(legend));
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

    buildChartData(chart, chartSource) {
        const useBuckets = chart.useBuckets || chart.field === 'BekleyenGun';
        if (useBuckets && Array.isArray(this.schema.beklemeSuresiBuckets)) {
            const buckets = this.schema.beklemeSuresiBuckets;
            const grouped = buckets.map(b => ({ bucket: b.key, count: 0, min: b.min, max: b.max }));
            (chartSource || []).forEach(d => {
                const gun = Number(d[chart.field] ?? d.BekleyenGun ?? d.BeklemeGun) || 0;
                const bucket = grouped.find(b => gun >= b.min && gun <= b.max);
                if (bucket) bucket.count++;
            });
            return grouped.map(g => ({ argument: g.bucket + ' gün', value: g.count }));
        }
        const grouped = {};
        (chartSource || []).forEach(d => {
            const key = this.getRowValue(d, chart.field);
            if (key == null || String(key).trim() === '') return;
            grouped[key] = (grouped[key] || 0) + 1;
        });
        const limit = chart.limit || 15;
        return Object.entries(grouped)
            .map(([argument, value]) => ({ argument, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, limit);
    }

    getChartType(chart) {
        return $(chart.typeSelector).val() || chart.defaultType || 'pie';
    }

    createChartClickHandler(chart, useBuckets) {
        return (e) => {
            let secilen = e.target.originalArgument;
            if (useBuckets) secilen = secilen.replace(' gün', '');
            if (typeof secilen === 'string') secilen = secilen.trim();
            this.filterState[chart.field] = secilen;
            const filterField = (this.schema.filters || []).find(f => f.field === chart.field);
            if (filterField) {
                this.filterState[filterField.field] = secilen;
                const filterElem = document.getElementById(filterField.elementId);
                if (filterElem) filterElem.value = secilen;
            }
            if (chart.filterElementId) {
                const elem = document.querySelector(chart.filterElementId);
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

    static COMPACT_PIE_LEGEND_MAX = 6;

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
                    margin: 20
                };
            }
            return { ...base, visible: true, font: { size: 12 } };
        }

        // Kompakt çubuk/çizgi: şemadaki legend ayarları
        if (chartType !== 'pie') {
            return { ...base, visible: true };
        }

        // Kompakt pasta: az kategori varsa legend, çok veride gizle
        if (count > RaporModul.COMPACT_PIE_LEGEND_MAX) {
            return { visible: false };
        }

        return {
            ...base,
            visible: true,
            verticalAlignment: 'bottom',
            horizontalAlignment: 'center',
            margin: 24,
            paddingTopBottom: 8,
            paddingLeftRight: 8,
            columnCount: Math.min(4, Math.max(2, Math.ceil(count / 3))),
            font: { size: 9 }
        };
    }

    renderDxChart($container, chart, chartData, chartType, profile, onPointClick) {
        const isEnlarge = profile === 'enlarge';
        const palette = chart.palette || undefined;
        const legend = this.buildLegend(chart, chartType, chartData, profile);
        const count = chartData.length;
        const size = isEnlarge ? this.getEnlargedChartSize(chartType, count) : null;

        if (isEnlarge) {
            $container.css({ width: size.width, height: size.height, minWidth: size.width, minHeight: size.height });
        } else {
            $container.css({ width: '', height: '340px', minHeight: '340px', maxHeight: '340px' });
        }

        const labelCustomize = isEnlarge
            ? (point) => `${point.argumentText}: ${point.valueText}`
            : (point) => point.valueText;

        if (chartType === 'pie') {
            $container.dxPieChart({
                dataSource: chartData,
                palette,
                size: isEnlarge ? { width: size.width, height: size.height } : undefined,
                series: [{
                    argumentField: 'argument',
                    valueField: 'value',
                    label: {
                        visible: true,
                        connector: { visible: true },
                        customizeText: labelCustomize
                    }
                }],
                tooltip: { enabled: true, contentTemplate: d => `${d.argumentText}: ${d.value}` },
                legend,
                onPointClick: onPointClick || undefined
            });
            return;
        }

        const rotation = count > 6 ? -45 : (count > 4 ? -30 : 0);
        const useRotatedBar = isEnlarge && chartType === 'bar' && count > 8;
        const chartOptions = {
            dataSource: chartData,
            palette,
            size: isEnlarge ? { width: size.width, height: size.height } : undefined,
            rotated: useRotatedBar,
            series: [{ argumentField: 'argument', valueField: 'value', name: chart.field, type: chartType }],
            tooltip: { enabled: true, contentTemplate: d => `${d.argumentText}: ${d.value}` },
            legend,
            onPointClick: onPointClick || undefined
        };
        if (isEnlarge) {
            chartOptions.argumentAxis = {
                label: {
                    visible: true,
                    overlappingBehavior: 'none',
                    rotationAngle: useRotatedBar ? 0 : rotation,
                    font: { size: 11 }
                }
            };
        }
        $container.dxChart(chartOptions);
    }

    enlargeChart(chartId, title) {
        const chart = this.findChartByHostId(chartId);
        if (!chart) {
            RaporModul.enlargeChartLegacy(chartId, title);
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

        const hostId = 'chartDownloadHost';
        let $host = $(`#${hostId}`);
        if (!$host.length) {
            $('body').append(`<div id="${hostId}" style="position:fixed;left:-20000px;top:0;visibility:hidden;"></div>`);
            $host = $(`#${hostId}`);
        }

        this.disposeChartElement(`#${hostId}`);
        const chartData = this.buildChartData(chart, this.getChartSource());
        const chartType = this.getChartType(chart);
        this.renderDxChart($host, chart, chartData, chartType, 'enlarge', null);

        setTimeout(() => {
            const svgElem = document.getElementById(hostId)?.querySelector('svg');
            if (!svgElem) {
                alert('Grafik indirilemedi.');
                this.disposeChartElement(`#${hostId}`);
                $host.empty();
                return;
            }
            RaporModul.saveSvgElement(svgElem, title);
            this.disposeChartElement(`#${hostId}`);
            $host.empty();
        }, 400);
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
            if (document.getElementById(f.elementId)) keys.add(f.field);
        });
        (this.schema.charts || []).forEach(c => {
            if (c.field) keys.add(c.field);
        });
        if (this.schema.bucketFilters) {
            Object.keys(this.schema.bucketFilters).forEach(k => keys.add(k));
        }
        return keys;
    }

    getUiStateKeys() {
        const keys = new Set();
        (this.schema.charts || []).forEach(c => {
            if (c.typeSelector) keys.add(c.typeSelector.replace('#', ''));
        });
        return keys;
    }

    getFilteredData() {
        const dataFilterKeys = this.getDataFilterKeys();
        const uiStateKeys = this.getUiStateKeys();
        const sourceData = typeof this.schema.enrichRow === 'function'
            ? this.data.map(r => this.schema.enrichRow(r))
            : this.data;
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
                    const recValStr = d[key] ? String(d[key]).substring(0,10) : null;
                    const inputValStr = String(val).substring(0,10);
                    if (!recValStr) continue;
                    const recVal = new Date(recValStr);
                    const inputDate = new Date(inputValStr);
                    if (isNaN(recVal) || isNaN(inputDate)) continue;
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
                    if (compare === '>=') {
                        if (recVal < inputDate) match = false;
                    } else if (compare === '<=') {
                        if (recVal > inputDate) match = false;
                    } else if (compare === '=') {
                        if (recVal.getTime() !== inputDate.getTime()) match = false;
                    }
                } else if (this.schema.bucketFilters && this.schema.bucketFilters[key]) {
                    const cfg = this.schema.bucketFilters[key];
                    const bucket = (cfg.buckets || []).find(b => b.key === val);
                    if (bucket) {
                        const fields = cfg.fields || [key];
                        const v = fields.map(f => Number(d[f])).find(n => !isNaN(n)) ?? 0;
                        if (!(v >= bucket.min && v <= bucket.max)) match = false;
                    }
                } else {
                    // Diğer tüm alanlar için trim ve null-safe karşılaştırma
                    if (String(this.getRowValue(d, key) || '').trim().toLowerCase() !== String(val).trim().toLowerCase()) match = false;
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
        if (cfg && cfg.columns && cfg.columns.length) {
            return cfg.columns
                .map(df => colMap.get(df) || { dataField: df, caption: df })
                .filter(Boolean);
        }
        return allCols.filter(c => c.visible !== false);
    }

    getSummaryDetailRows(summary, summaryValue) {
        const cfg = summary.detailModal || {};
        const sortField = cfg.sortField || summary.field;
        const data = [...(this.filteredWithCalculated || this.filtered || [])];
        const sortDir = cfg.sortOrder === 'asc' ? 1 : -1;

        data.sort((a, b) => {
            const na = Number(this.getRowValue(a, sortField));
            const nb = Number(this.getRowValue(b, sortField));
            if (isNaN(na) && isNaN(nb)) return 0;
            if (isNaN(na)) return 1;
            if (isNaN(nb)) return -1;
            return sortDir * (na - nb);
        });

        const maxVal = Number(summaryValue);
        if (summary.type === 'max' && cfg.nearMaxMargin != null && !isNaN(maxVal)) {
            const minVal = maxVal - cfg.nearMaxMargin;
            return data.filter(d => {
                const v = Number(this.getRowValue(d, sortField));
                return !isNaN(v) && v >= minVal;
            });
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

        let subtitle = `${rows.length} kayıt — gün sayısına göre azalan sırada`;
        if (!isNaN(maxVal) && summary.type === 'max') {
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
                <h2 class="chart-modal-title">${cfg.title || 'Detay'}</h2>
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

    renderSummaries() {
        // Şemadaki özetler (istatistik kutuları)
        const data = this.filteredWithCalculated || this.filtered;
        (this.schema.summaries || []).forEach(summary => {
            let value = '-';
            if (summary.type === 'count') {
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
            $el.text(value);

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
                    this.openSummaryDetailModal(summary, value);
                });
            } else {
                if ($icon.length) $icon.hide();
                $card.removeClass('stat-card-clickable').removeAttr('title').off('click.summaryDetail');
            }
        });
    }

    renderCharts() {
        const chartSource = this.getChartSource();
        (this.schema.charts || []).forEach(chart => {
            try {
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
            elem.addEventListener('change', () => {
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
            });
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
                const dateField = d.SurecBaslangicTarihi || d.BaslamaTarihi || d['Başlama Tarihi'];
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

