window.API_BASE = window.API_BASE || (window.location.origin + '/api');

// Ultra-dinamik rapor modülü: Şema ve alanlar API'den veya JSON'dan alınır
class RaporModul {
        getStorageKey() {
            // Her rapor için benzersiz anahtar
            return 'raporModul_defaultFilters_' + (this.schema.reportKey || 'default');
        }

        async saveDefaultFilters() {
            
            const filters = {};
            (this.schema.filters || []).forEach(f => {
                const elem = document.getElementById(f.elementId);
                if (elem) filters[f.field] = elem.value;
            });
            // Grafik tipleri de şemadan alınabilir
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
            }       await fetch(window.API_BASE + '/authorization/default-report', {
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
                showToast('Varsayılan filtreler localStorage ile kaydedildi!','warning"');
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
            // Filtre inputlarını doldur
            (this.schema.filters || []).forEach(f => {
                const elem = document.getElementById(f.elementId);
                if (elem && filters[f.field] !== undefined) elem.value = filters[f.field];
            });
            // Grafik tiplerini de uygula
            if (this.schema.charts) {
                this.schema.charts.forEach(chart => {
                    if (chart.typeSelector) {
                        const el = document.querySelector(chart.typeSelector);
                        const key = chart.typeSelector.replace('#','');
                        if (el && filters[key] !== undefined) el.value = filters[key];
                    }
                });
            }
            if (typeof this.updateAll === 'function') this.updateAll();
        }
    constructor(schema) {
        this.schema = schema; // Şema: filtreler, özetler, grafikler, kolonlar
        this.data = [];
        this.filtered = [];
        this.columns = [];
    }

    async init() {
        await this.fetchSchemaAndData();
        this.populateFilters();
        this.loadDefaultFilters();
        this.updateAll();
        this.bindEvents();
    }

    async fetchSchemaAndData() {
        // Şema API'den veya window.raporSchema'dan alınabilir
        let schema = this.schema;
        if (typeof schema === 'string') {
            // API'den şema çek
            const resp = await fetch(schema, { credentials: 'include' });
            schema = await resp.json();
        }
        this.schema = schema;
        // Data çek
        let dataUrl = schema.dataUrl;
        if (!dataUrl && schema.reportKey) {
            // Otomatik endpoint
            const reportsResp = await fetch(window.API_BASE + '/reports', { credentials: 'include' });
            const reports = await reportsResp.json();
            let report = reports.find(r => r.reportCode && r.reportCode.toLowerCase().includes(schema.reportKey.toLowerCase()));
            if (report) dataUrl = window.API_BASE + `/reports/${report.reportID}/data`;
        }
        if (!dataUrl) throw new Error('Data endpointi bulunamadı!');
        const dataResp = await fetch(dataUrl, { credentials: 'include' });
        const result = await dataResp.json();
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
        (this.schema.filters || []).forEach(f => {
            const set = new Set(this.data.map(d => d[f.field]).filter(Boolean));
            const select = document.getElementById(f.elementId);
            if (!select) return;
            select.innerHTML = `<option value="">Tümü</option>`;
            set.forEach(val => {
                const opt = document.createElement('option');
                opt.value = val;
                opt.text = val;
                select.appendChild(opt);
            });
        });
    }

    getFilteredData() {
        return this.data.filter(d => {
            let match = true;
            (this.schema.filters || []).forEach(f => {
                const val = document.getElementById(f.elementId)?.value;
                if (val && String(d[f.field] || '').toLowerCase() !== String(val).toLowerCase()) match = false;
            });
            return match;
        });
    }

    updateAll() {
        this.filtered = this.getFilteredData();
        this.renderGrid();
        this.renderSummaries();
        this.renderCharts();
    }

    renderGrid() {
        const gridElem = $("#gridContainer");
        let grid = gridElem.data("dxDataGrid");
        //GeciktiMi kolonunu ekle
        const today = new Date().toISOString().split('T')[0];
        const gridData = this.filtered.map(row => {
            let gecikti = 'Hayır';
            if (row.BitisTarihi) {
                const bitis = row.BitisTarihi.split('T')[0];
                if (bitis < today) gecikti = 'Evet';
            }
            // Bekleme gün hesapla
            let beklemeGun = '';
            if (row.BaslamaTarihi) {
                const bas = new Date(row.BaslamaTarihi.split('T')[0]);
                const now = new Date(today);
                if (!isNaN(bas)) {
                    beklemeGun = Math.floor((now - bas) / (1000 * 60 * 60 * 24));
                }
            }
            //Gecikme Gün hesapla
            let GecikmeGun = '' ;
            if(row.BitisTarihi){
                const bitis = new Date(row.BitisTarihi.split('T')[0]);
                const now = new Date(today);
                if(!isNaN(bitis) && !isNaN(now)){
                    GecikmeGun = Math.floor((bitis - now) / (1000 * 60 * 60 * 24));
                }    
            }
            return { ...row, GeciktiMi: gecikti, BeklemeGun: beklemeGun, GecikmeGun: GecikmeGun };
        });
        if (!grid) {
            gridElem.dxDataGrid({
                dataSource: gridData,
                columns: this.columns,
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
            });
        } else {
            gridElem.dxDataGrid("instance").option("dataSource", gridData);
        }
    }

    renderSummaries() {
        // Şemadaki özetler (istatistik kutuları)
        (this.schema.summaries || []).forEach(summary => {
            let value = '-';
            if (summary.type === 'count') {
                value = this.filtered.length;
            } else if (summary.type === 'max') {
                value = Math.max(...this.filtered.map(d => Number(d[summary.field]) || 0));
            } else if (summary.type === 'avg') {
                const vals = this.filtered.map(d => Number(d[summary.field])).filter(x => !isNaN(x));
                value = vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1) : '-';
            } else if (typeof summary.calc === 'function') {
                value = summary.calc(this.filtered);
            }
            $(summary.elementId).text(value);
        });
    }

    renderCharts() {
        (this.schema.charts || []).forEach(chart => {
            const grouped = {};
            this.filtered.forEach(d => {
                const key = d[chart.field];
                if (!key) return;
                grouped[key] = (grouped[key] || 0) + 1;
            });
            const chartData = Object.entries(grouped).map(([argument, value]) => ({ argument, value }));
            const chartType = $(chart.typeSelector).val() || chart.defaultType || 'pie';
            // Önce eski grafik instance'ını yok et ve container'ı temizle
            if ($(chart.elementId).data('dxPieChart')) {
                $(chart.elementId).dxPieChart('dispose');
                $(chart.elementId).empty();
            }
            if ($(chart.elementId).data('dxChart')) {
                $(chart.elementId).dxChart('dispose');
                $(chart.elementId).empty();
            }
            if (chartType === 'pie') {
                $(chart.elementId).dxPieChart({
                    dataSource: chartData,
                    series: [{ argumentField: 'argument', valueField: 'value', label: { visible: true, connector: { visible: true }, customizeText: function(point) { return point.valueText; } } }],
                    tooltip: { enabled: true },
                    legend: { visible: true },
                    onPointClick: function(e) {
                        const secilen = e.target.originalArgument;
                        if (chart.filterElementId) $(chart.filterElementId).val(secilen);
                        window.rapor.updateAll();
                    }
                });
            } else {
                $(chart.elementId).dxChart({
                    dataSource: chartData,
                    series: [{ argumentField: 'argument', valueField: 'value', type: chartType, color: chart.color || '#00eaff' }],
                    tooltip: { enabled: true },
                    legend: { visible: false },
                    argumentAxis: { label: { font: { color: '#e0e0e0', size: 13 } }, color: '#444' },
                    valueAxis: { label: { font: { color: '#e0e0e0', size: 13 } }, color: '#444' },
                    onPointClick: function(e) {
                        const secilen = e.target.originalArgument;
                        if (chart.filterElementId) $(chart.filterElementId).val(secilen);
                        window.rapor.updateAll();
                    }
                });
            }
        });
    }

    bindEvents() {
        (this.schema.filters || []).forEach(f => {
            const elem = document.getElementById(f.elementId);
            if (elem) elem.addEventListener('change', () => this.updateAll());
        });
        (this.schema.charts || []).forEach(chart => {
            if (chart.typeSelector) $(chart.typeSelector).on('change', () => this.updateAll());
        });
        $('.filter-btn').on('click', () => this.updateAll());
        $('.clear-filters').on('click', () => {
            (this.schema.filters || []).forEach(f => {
                $('#' + f.elementId).val('');
            });
            this.updateAll();
        });
        // Dinamik varsayılan rapor kaydet butonu (her rapor için benzersiz id)
        const saveBtnId = 'saveDefaultReport_' + (this.schema.reportKey || 'default');
        if ($('#' + saveBtnId).length) {
            $('#' + saveBtnId).off('click').on('click', () => this.saveDefaultFilters());
        }
    }
}

// ÖRNEK: Ultra-dinamik şema (bu obje ileride API'den de gelebilir)
const raporSchema = {
    reportKey: 'qdms',
    filters: [
        { field: 'Durum', elementId: 'filterDurum', label: 'Durum' },
        { field: 'MudurlukAdi', elementId: 'filterMudurluk', label: 'Müdürlük' },
        { field: 'Tip', elementId: 'filterTip', label: 'Tip' },
        { field: 'BaslamaTarihi', elementId: 'filterBaslangic', label: 'Başlangıç Tarihi' },
        { field: 'BitisTarihi', elementId: 'filterBitis', label: 'Bitiş Tarihi' },
    ],
    columns: [
        { dataField: 'BekletenSirket', caption: 'Şirket' },
        { dataField: 'Aksiyon', caption: 'Aksiyon No' },
        { dataField: 'KalemNo', caption: 'Kalem No' },
        { dataField: 'BekletenSicilNo', caption: 'Sicil' },
        { dataField: 'BekletenAdSoyad', caption: 'Ad Soyad' },
        { dataField: 'SorumluAdSoyad', caption: 'Yönetici' },
        { dataField: 'MudurlukAdi', caption: 'Müdürlük' },
        { dataField: 'Durum', caption: 'Durum' },
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
        { field: 'Durum', elementId: '#durumChart', typeSelector: '#chartTypeDurum', filterElementId: '#filterDurum', defaultType: 'pie' },
        { field: 'Mudurluk', elementId: '#sorumluChart', typeSelector: '#chartTypeMudurluk', filterElementId: '#filterMudurluk', defaultType: 'pie' }
    ]
};

window.rapor = new RaporModul(raporSchema);
window.rapor.init();

// Yeni rapor eklemek için sadece config tanımla ve RaporModul ile başlat.
