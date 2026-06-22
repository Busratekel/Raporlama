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
        // Ortak grafik büyütme fonksiyonu
        static enlargeChart(chartId, title) {
            const oldModal = document.getElementById('chartEnlargeModal');
            if (oldModal) oldModal.remove();
            const chartElem = document.getElementById(chartId);
            if (!chartElem) return;
            const modal = document.createElement('div');
            modal.id = 'chartEnlargeModal';
            modal.style.position = 'fixed';
            modal.style.top = '0';
            modal.style.left = '0';
            modal.style.width = '100vw';
            modal.style.height = '100vh';
            modal.style.background = 'rgba(0,0,0,0.8)';
            modal.style.zIndex = '9999';
            modal.style.display = 'flex';
            modal.style.alignItems = 'center';
            modal.style.justifyContent = 'center';
            modal.innerHTML = `<div style='background:#23242a;padding:32px;border-radius:12px;max-width:90vw;max-height:90vh;overflow:auto;position:relative;'>
                <h2 style='color:#00eaff;text-align:center;margin-bottom:18px;'>${title}</h2>
                <div id='modalChartContent' style='text-align:center;'></div>
                <button onclick='document.body.removeChild(this.parentNode.parentNode)' style='position:absolute;top:12px;right:12px;background:#e74c3c;color:#fff;padding:8px 16px;border:none;border-radius:6px;cursor:pointer;'>Kapat</button>
            </div>`;
            document.body.appendChild(modal);
            const chartContent = chartElem.querySelector('svg') ? chartElem.querySelector('svg').cloneNode(true) : chartElem.querySelector('canvas') ? chartElem.querySelector('canvas').cloneNode(true) : null;
            if (chartContent) {
                chartContent.style.width = '800px';
                chartContent.style.height = '500px';
                document.getElementById('modalChartContent').appendChild(chartContent);
            } else {
                document.getElementById('modalChartContent').innerHTML = '<div style="color:#fff;text-align:center;">Grafik bulunamadı</div>';
            }
        }

        // Ortak SVG indirme fonksiyonu
        static downloadSVG(chartId, title) {
            const chartElem = document.getElementById(chartId);
            if (!chartElem) return;
            const svgElem = chartElem.querySelector('svg');
            if (!svgElem) { alert('SVG bulunamadı!'); return; }
            let svgString = new XMLSerializer().serializeToString(svgElem);
            const parser = new DOMParser();
            const doc = parser.parseFromString(svgString, 'image/svg+xml');
            const svg = doc.documentElement;
            let width = svg.getAttribute('width') || '800';
            let height = svg.getAttribute('height') || '500';
            width = parseInt(width);
            height = parseInt(height);
            const titleFontSize = 28;
            const titleMargin = 24;
            const extraSpace = 32;
            const newHeight = height + titleFontSize + titleMargin + extraSpace;
            svg.setAttribute('height', newHeight);
            if (svg.hasAttribute('viewBox')) {
                const vb = svg.getAttribute('viewBox').split(' ');
                if (vb.length === 4) {
                    vb[3] = String(parseInt(vb[3]) + titleFontSize + titleMargin + extraSpace);
                    svg.setAttribute('viewBox', vb.join(' '));
                }
            }
            const titleText = doc.createElementNS('http://www.w3.org/2000/svg', 'text');
            titleText.setAttribute('x', width/2);
            titleText.setAttribute('y', titleFontSize + titleMargin/2);
            titleText.setAttribute('text-anchor', 'middle');
            titleText.setAttribute('font-size', titleFontSize);
            titleText.setAttribute('font-weight', 'bold');
            titleText.setAttribute('fill', '#00eaff');
            titleText.setAttribute('font-family', 'Segoe UI, Arial, sans-serif');
            titleText.textContent = title;
            svg.setAttribute('style', 'background:#23242a;display:block;margin:auto;');
            Array.from(svg.children).forEach(child => {
                if (child.tagName !== 'text') {
                    let prev = child.getAttribute('transform') || '';
                    let translate = `translate(0,${titleFontSize + titleMargin + extraSpace})`;
                    child.setAttribute('transform', prev ? `${prev} ${translate}` : translate);
                }
            });
            svg.insertBefore(titleText, svg.firstChild);
            svgString = new XMLSerializer().serializeToString(svg);
            const blob = new Blob([svgString], { type: 'image/svg+xml' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${title.replace(/ /g,'_')}.svg`;
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
                            if (filters[key] !== undefined && filters[key] !== null && filters[key] !== "") {
                                el.value = filters[key];
                            } else if (chart.defaultType) {
                                el.value = chart.defaultType;
                            }
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

    populateFilters() {
        const filterData = typeof this.schema.enrichRow === 'function'
            ? this.data.map(r => this.schema.enrichRow(r))
            : this.data;
        (this.schema.filters || []).forEach(f => {
            const set = new Set(filterData.map(d => d[f.field]).filter(Boolean));
            const select = document.getElementById(f.elementId);
            if (!select || select.tagName !== 'SELECT') return;
            select.innerHTML = `<option value="">Tümü</option>`;
            [...set]
                .sort((a, b) => String(a).localeCompare(String(b), 'tr', { sensitivity: 'base' }))
                .forEach(val => {
                const opt = document.createElement('option');
                opt.value = val;
                opt.text = val;
                select.appendChild(opt);
            });
            // filterState'e ilk değerleri ata
            this.filterState[f.field] = '';
        });
        // Grafik tipi select'lerinde defaultType varsa, sadece value ata, option ekleme
        (this.schema.charts || []).forEach(chart => {
            if (chart.typeSelector && chart.defaultType) {
                const el = document.querySelector(chart.typeSelector);
                if (el) {
                    el.value = chart.defaultType;
                    this.filterState[chart.typeSelector.replace('#','')] = chart.defaultType;
                }
            }
        });
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
                    if (String(d[key] || '').trim().toLowerCase() !== String(val).trim().toLowerCase()) match = false;
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

    renderGrid() {
        const gridElem = $("#gridContainer");
        let grid = gridElem.data("dxDataGrid");
        const gridData = this.filteredWithCalculated;
        const gridColumns = this.columns.map(col => {
            if (!col.forceText) return col;
            return {
                ...col,
                calculateCellValue: row => row[col.dataField] != null ? String(row[col.dataField]) : ''
            };
        });
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
                    allowExportHiddenColumns: true,
                    allowExportSelectedData: true,
                    texts: {
                        exportAll: "Tümünü Excel'e Aktar",
                        exportSelectedRows: "Seçileni Aktar",
                        exportTo: "Excel'e Aktar"
                    }
                },
            });
        } else {
            const instance = gridElem.dxDataGrid("instance");
            instance.option("columns", gridColumns);
            instance.option("dataSource", gridData);
        }
    }

    renderSummaries() {
        // Şemadaki özetler (istatistik kutuları)
        const data = this.filteredWithCalculated || this.filtered;
        (this.schema.summaries || []).forEach(summary => {
            let value = '-';
            if (summary.type === 'count') {
                value = data.length;
            } else if (summary.type === 'max') {
                const vals = data.map(d => Number(d[summary.field])).filter(x => !isNaN(x));
                value = vals.length ? Math.max(...vals) : '-';
            } else if (summary.type === 'avg') {
                const vals = data.map(d => Number(d[summary.field])).filter(x => !isNaN(x));
                value = vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1) : '-';
            } else if (typeof summary.calc === 'function') {
                value = summary.calc(data);
            }
            $(summary.elementId).text(value);
        });
    }

    renderCharts() {
        const chartSource = (this.filteredWithCalculated && this.filteredWithCalculated.length)
            ? this.filteredWithCalculated
            : this.filtered;
        (this.schema.charts || []).forEach(chart => {
            try {
            let chartData = [];
            const useBuckets = chart.useBuckets || chart.field === 'BekleyenGun';
            if (useBuckets && Array.isArray(this.schema.beklemeSuresiBuckets)) {
                const buckets = this.schema.beklemeSuresiBuckets;
                const grouped = buckets.map(b => ({ bucket: b.key, count: 0, min: b.min, max: b.max }));
                (chartSource || []).forEach(d => {
                    const gun = Number(d[chart.field] ?? d.BekleyenGun ?? d.BeklemeGun) || 0;
                    const bucket = grouped.find(b => gun >= b.min && gun <= b.max);
                    if (bucket) bucket.count++;
                });
                chartData = grouped.map(g => ({ argument: g.bucket + ' gün', value: g.count }));
            } else {
                const grouped = {};
                (chartSource || []).forEach(d => {
                    const key = d[chart.field];
                    if (!key) return;
                    grouped[key] = (grouped[key] || 0) + 1;
                });
                const limit = chart.limit || 15;
                chartData = Object.entries(grouped)
                    .map(([argument, value]) => ({ argument, value }))
                    .sort((a, b) => b.value - a.value)
                    .slice(0, limit);
            }
            const chartType = $(chart.typeSelector).val() || chart.defaultType || 'pie';
            this.disposeChartElement(chart.elementId);
            const palette = chart.palette || undefined;
            const legend = this.cloneLegend(chart.legend);
            const handleChartClick = (e) => {
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
            if (chartType === 'pie') {
                $(chart.elementId).dxPieChart({
                    dataSource: chartData,
                    palette: palette,
                    series: [{ argumentField: 'argument', valueField: 'value', label: { visible: true, connector: { visible: true }, customizeText: function(point) { return point.valueText; } } }],
                    tooltip: { enabled: true, contentTemplate: d => `${d.argumentText}: ${d.value}` },
                    legend: legend,
                    onPointClick: handleChartClick
                });
            } else {
                $(chart.elementId).dxChart({
                    dataSource: chartData,
                    palette: palette,
                    series: [{ argumentField: 'argument', valueField: 'value', name: chart.field, type: chartType }],
                    tooltip: { enabled: true, contentTemplate: d => `${d.argumentText}: ${d.value}` },
                    legend: legend,
                    onPointClick: handleChartClick
                });
            }
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
                    this.filterState[chart.typeSelector.replace('#','')] = el.value;
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
                const dateField = d.SurecBaslangicTarihi || d.BaslamaTarihi;
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

