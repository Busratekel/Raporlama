window.onbeforeunload = function() {
    window.scrollTo(0, 0);
};

let currentDataGrid = null;
let allData = [];
let filteredData = [];
let filterState = { dolduranSirket:null, bekletenSirket:null, dolduranKisi: null, bekletenKisi: null, bucket: null, mudurluk: null, form: null };
const API_BASE = 'http://localhost:5000/api';

// Sayfa yüklendiğinde
window.onload = async function() {
    window.scrollTo(0, 0);
    // Rapor ID'sini sadece data attribute üzerinden al
    let reportId = document.getElementById('reportMeta')?.dataset?.reportId;
    if (reportId) reportId = parseInt(reportId, 10);
    // Varsayılan filtreleri backend'den al
    try {
        const resp = await fetch(`${API_BASE}/authorization/default-report?reportKey=${reportId}`, { credentials: 'include' });
        if (resp.ok) {
            const data = await resp.json();
            if (data && data.filters) {
                let filters = {};
                try { filters = JSON.parse(data.filters); } catch(e){}
                if (filters.mudurluk) document.getElementById('filterMudurluk').value = filters.mudurluk;
                if (filters.direktorluk) document.getElementById('filterDirektorluk').value = filters.direktorluk;
                if (filters.tarihBas) document.getElementById('filterTarihBaslangic').value = filters.tarihBas;
                if (filters.tarihBit) document.getElementById('filterTarihBitis').value = filters.tarihBit;
                // Grafik tiplerini uygula
                if (filters.chartTypeDolduran) document.getElementById('chartTypeDolduran').value = filters.chartTypeDolduran;
                if (filters.chartTypeBekleten) document.getElementById('chartTypeBekleten').value = filters.chartTypeBekleten;
                if (filters.chartTypeMudurluk) document.getElementById('chartTypeMudurluk').value = filters.chartTypeMudurluk;
                if (filters.chartTypeForm) document.getElementById('chartTypeForm').value = filters.chartTypeForm;
                if (filters.chartTypeBekleme) document.getElementById('chartTypeBekleme').value = filters.chartTypeBekleme;
                if (filters.chartTypePersonDolduran) document.getElementById('chartTypePersonDolduran').value = filters.chartTypePersonDolduran;
                if (filters.chartTypePersonBekleten) document.getElementById('chartTypePersonBekleten').value = filters.chartTypePersonBekleten;
                Object.assign(filterState, filters);
            }
        }
    } catch(e){}
    loadAllData();
};

// Tüm veriyi yükle
async function loadAllData() {
    try {
        const response = await fetch(`${API_BASE}/dashboard/data/bekleyen-surecler`);
        allData = await response.json();
        // Filtreleri doldur
        populateFilters();
        // Verileri göster
        applyFilters();
    } catch (error) {
        console.error('Veri yükleme hatası:', error);
        alert('Veri yüklenirken hata oluştu! API çalışıyor mu kontrol edin.');
    }
}

// Filtreleri doldur
function populateFilters() {
    const mudurlukler = [...new Set(allData.map(d => d.MudurlukAdi).filter(Boolean))].sort();
    const direktorlukler = [...new Set(allData.map(d => d.DirektorlukAdi).filter(Boolean))].sort();
    const mudSelect = document.getElementById('filterMudurluk');
    const dirSelect = document.getElementById('filterDirektorluk');
    mudSelect.innerHTML = '<option value="">Tümü</option>';
    mudurlukler.forEach(m => {
        const opt = document.createElement('option');
        opt.value = m;
        opt.text = m;
        mudSelect.appendChild(opt);
    });
    // Eğer sadece bir müdürlük varsa otomatik seçili yap
    if (mudurlukler.length === 1) {
        mudSelect.value = mudurlukler[0];
        filterState.mudurluk = mudurlukler[0];
    }
    
    dirSelect.innerHTML = '<option value="">Tümü</option>';
    direktorlukler.forEach(d => {
        const opt = document.createElement('option');
        opt.value = d;
        opt.text = d;
        dirSelect.appendChild(opt);
    });
    if (direktorlukler.length === 1) {
        dirSelect.value = direktorlukler[0];
        filterState.direktorluk = direktorlukler[0];
    }
}

function applyFilters() {
    const mudurluk = document.getElementById('filterMudurluk').value;
    const direktorluk = document.getElementById('filterDirektorluk').value;
    const tarihBas = document.getElementById('filterTarihBaslangic').value;
    const tarihBit = document.getElementById('filterTarihBitis').value;
    filteredData = allData.filter(d => {
        let match = true;
        if (tarihBas || tarihBit) {
            const basDate = tarihBas ? new Date(tarihBas + 'T00:00:00') : null;
            const bitDate = tarihBit ? new Date(tarihBit + 'T00:00:00') : null;
            const recBas = d.SurecBaslangicTarihi ? new Date(d.SurecBaslangicTarihi.substring(0,10) + 'T00:00:00') : null;
            const recBit = d.SurecBekleteneGelisTarihi ? new Date(d.SurecBekleteneGelisTarihi.substring(0,10) + 'T00:00:00') : null;
            if (!recBas || !recBit) {
                match = false;
            } else {
                if (basDate && bitDate) {
                    if (!(recBas >= basDate && recBit <= bitDate)) match = false;
                } else if (basDate) {
                    if (!(recBas >= basDate)) match = false;
                } else if (bitDate) {
                    if (!(recBit <= bitDate)) match = false;
                }
            }
        }
        if (mudurluk && d.MudurlukAdi !== mudurluk) match = false;
        if (direktorluk && d.DirektorlukAdi !== direktorluk) match = false;
        if (filterState.dolduranKisi) {
            if (d.FormuDolduran !== filterState.dolduranKisi) match = false;
        }
        if (filterState.bekletenKisi) {
            if (d.FormuBekleten !== filterState.bekletenKisi) match = false;
        }
        if(filterState.dolduranSirket) {
            if(d.FormuDolduranSirketi !== filterState.dolduranSirket && d.FormuDolduranSicil !== filterState.dolduranSirket) match = false;
        }
        if(filterState.bekletenSirket) {
            if(d.FormuBekletenSirketi !== filterState.bekletenSirket && d.FormuBekletenSicil !== filterState.bekletenSirket) match = false;
        }
        const bekletenKey = d.FormuBekletenSirketi || d.FormuBekletenSicil;
        if (filterState.mudurluk) {
            if (d.MudurlukAdi !== filterState.mudurluk) match = false;
        }
        const dolduranKey = d.FormuDolduranSirketi || d.FormuDolduranSicil;
        if (filterState.mudurluk) {
            if (d.MudurlukAdi !== filterState.mudurluk) match = false;
        }
        if (filterState.form) {
            if (d.FormAdi !== filterState.form) match = false;
        }
        if (filterState.bucket) {
            const ranges = {
                '0-7': [0,7], '8-15': [8,15], '16-30': [16,30], '31-60': [31,60], '61-180': [61,180], '>180': [181, Number.MAX_SAFE_INTEGER]
            };
            const range = ranges[filterState.bucket];
            if (range) {
                const v = Number(d.BekleyenGun) || 0;
                if (!(v >= range[0] && v <= range[1])) match = false;
            }
        }
        return match;
    });
    updateStats(filteredData);
    renderDataGrid(filteredData);
    loadCharts(filteredData);
}

function updateStats(data) {
    if (!data || data.length === 0) {
        document.getElementById('totalRecords').textContent = '0';
        document.getElementById('avgDays').textContent = '0';
        document.getElementById('maxDays').textContent = '0';
        document.getElementById('acilGun').textContent = '0';
        return;
    }
    const totalRecords = data.length;
    const bekleyenGunler = data.map(d => d.BekleyenGun || 0);
    const avgDays = Math.round(bekleyenGunler.reduce((a, b) => a + b, 0) / totalRecords);
    const maxDays = Math.max(...bekleyenGunler);
    const bugun = new Date().toISOString().split('T')[0];
    const acilBugun = data.filter(d => d.EklenmeTarihi && d.EklenmeTarihi.startsWith(bugun)).length;
    document.getElementById('totalRecords').textContent = totalRecords.toLocaleString('tr-TR');
    document.getElementById('avgDays').textContent = avgDays;
    document.getElementById('maxDays').textContent = maxDays;
    document.getElementById('acilGun').textContent = acilBugun;
}

function renderDataGrid(data) {
    if (currentDataGrid) {
        currentDataGrid.dispose();
    }
    $("#dashboard").empty();
    if (!data || data.length === 0) {
        $("#dashboard").html('<div class="no-data">Veri yok</div>');
        return;
    }
    currentDataGrid = $("#dashboard").dxDataGrid({
        dataSource: data,
        showBorders: true,
        columnAutoWidth: true,
        allowColumnResizing: true,
        filterRow: { visible: true },
        searchPanel: { visible: true, width: 240, placeholder: "Ara..." },
        paging: { pageSize: 20 },
        pager: { showPageSizeSelector: true, allowedPageSizes: [10, 20, 50, 100], showInfo: true },
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
        // export: {
        //     enabled: true,
        //     fileName: "BekleyenSurecler"
        // },
        // onExporting: function(e) {
        //     var workbook = new ExcelJS.Workbook();
        //     var worksheet = workbook.addWorksheet("Bekleyen Süreçler");
        //     DevExpress.excelExporter.exportDataGrid({
        //         component: e.component,
        //         worksheet: worksheet,
        //         autoFilterEnabled: true
        //     }).then(function() {
        //         workbook.xlsx.writeBuffer().then(function(buffer) {
        //             saveAs(new Blob([buffer], { type: "application/octet-stream" }), "BekleyenSurecler.xlsx");
        //         });
        //     });
        //     e.cancel = true; // DevExtreme’in kendi exportunu iptal et
        // },
        toolbar: 
        {
          items: [
            "searchPanel",
            //"exportButton"
            ]      
        }
    }).dxDataGrid("instance");
}

// Excel'e Aktar butonu ile manuel export
$(document).on("click", "#excelExportBtn", function() {
    if (currentDataGrid) {
        var workbook = new ExcelJS.Workbook();
        var worksheet = workbook.addWorksheet("Bekleyen Süreçler");
        DevExpress.excelExporter.exportDataGrid({
            component: currentDataGrid,
            worksheet: worksheet,
            autoFilterEnabled: true
        }).then(function() {
            workbook.xlsx.writeBuffer().then(function(buffer) {
                saveAs(new Blob([buffer], { type: "application/octet-stream" }), "BekleyenSurecler.xlsx");
            });
        });
    }
});
// Modal enlarge logic
function enlargeChart(chartId, title) {
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

// Download SVG logic
function downloadSVG(chartId, title) {
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

// Grafikleri yükle ve render
async function loadCharts(data) {
    try {
        const typeDolduran = document.getElementById('chartTypeDolduran')?.value || 'pie';
        const typeBekleten = document.getElementById('chartTypeBekleten')?.value || 'pie';
        const typeMudurluk = document.getElementById('chartTypeMudurluk')?.value || 'pie';
        const typeForm = document.getElementById('chartTypeForm')?.value || 'pie';
        const typeBekleme = document.getElementById('chartTypeBekleme')?.value || 'bar';
        const typePersonDolduran = document.getElementById('chartTypePersonDolduran')?.value || 'bar';
        const typePersonBekleten = document.getElementById('chartTypePersonBekleten')?.value || 'bar';
        renderPieChart(filteredData, typeDolduran);
        renderBarChart(filteredData, typeBekleten);
        renderMudurlukChart(filteredData, typeMudurluk);
        renderFormChart(filteredData, typeForm);
        renderLineChart(filteredData, typeBekleme);
        renderPersonChartDolduran(filteredData, typePersonDolduran);
        renderPersonChartBekleten(filteredData, typePersonBekleten);
    } catch (err) {
        console.warn('Grafik render hatası', err);
    }
}

function renderPieChart(data, chartType) {
    try {
        const grouped = data
            .reduce((acc, d) => {
                const key = d.FormuDolduranSirketi || d.FormuDolduranSicil || 'Bilinmiyor';
                const existing = acc.find(x => x.category === key);
                if (existing) existing.value++;
                else acc.push({ category: key, value: 1 });
                return acc;
            }, [])
            .sort((a, b) => b.value - a.value)
            .slice(0, 10);
        if (chartType === 'pie') {
            new DevExpress.viz.dxPieChart(document.getElementById('pieChart'), {
                dataSource: grouped,
                series: [{ argumentField: 'category', valueField: 'value', label: { visible: true, connector: { visible: true } } }],
                tooltip: { enabled: true, contentTemplate: d => `${d.argumentText}: ${d.value}` },
                legend: { visible: grouped.length <= 7 },
                onPointClick: function(e) {
                    const category = e.target.originalArgument;
                    filterState.dolduranSirket = category;
                    applyFilters();
                }
            });
        } else {
            new DevExpress.viz.dxChart(document.getElementById('pieChart'), {
                dataSource: grouped,
                series: [{
                    argumentField: 'category',
                    valueField: 'value',
                    type: chartType,
                    color: '#00eaff',
                    label: { visible: true, font: { color: '#fff', size: 14 }, backgroundColor: 'rgba(0,0,0,0.7)', customizeText: function(arg) { return arg.valueText; } }
                }],
                argumentAxis: { label: { font: { color: '#fff', size: 13 } }, color: '#444' },
                valueAxis: { label: { font: { color: '#fff', size: 13 } }, color: '#444' },
                tooltip: { enabled: true, customizeTooltip: function(arg) { return { text: `${arg.argumentText}: ${arg.valueText}` }; } },
                palette: ['#00eaff', '#00bfae', '#0081a7', '#005f73'],
                legend: { visible: false },
            });
        }
    } catch (e) {
        console.warn('Pie chart error', e);
    }
}

function renderBarChart(data, chartType) {
    try {
        const grouped = data
            .reduce((acc, d) => {
                const key = d.FormuBekletenSirketi || d.FormuBekletenSicil || 'Bilinmiyor';
                const existing = acc.find(x => x.category === key);
                if (existing) existing.value++;
                else acc.push({ category: key, value: 1 });
                return acc;
            }, [])
            .sort((a, b) => b.value - a.value)
            .slice(0, 15);
        if (chartType === 'pie') {
            new DevExpress.viz.dxPieChart(document.getElementById('pieChartBekleten'), {
                dataSource: grouped,
                series: [{ argumentField: 'category', valueField: 'value', label: { visible: true, connector: { visible: true } } }],
                tooltip: { enabled: true, contentTemplate: d => `${d.argumentText}: ${d.value}` },
                legend: { visible: grouped.length <= 7 },
                onPointClick: function(e) {
                    const category = e.target.originalArgument;
                    filterState.bekletenSirket = category;
                    applyFilters();
                }
            });
        } else {
            new DevExpress.viz.dxChart(document.getElementById('pieChartBekleten'), {
                dataSource: grouped,
                series: [{
                    argumentField: 'category',
                    valueField: 'value',
                    type: chartType,
                    color: '#ff9800',
                    label: { visible: true, font: { color: '#fff', size: 14 }, backgroundColor: 'rgba(0,0,0,0.7)', customizeText: function(arg) { return arg.valueText; } }
                }],
                argumentAxis: { label: { font: { color: '#fff', size: 13 } }, color: '#444' },
                valueAxis: { label: { font: { color: '#fff', size: 13 } }, color: '#444' },
                tooltip: { enabled: true, customizeTooltip: function(arg) { return { text: `${arg.argumentText}: ${arg.valueText}` }; } },
                palette: ['#ff9800', '#ffb300', '#ff6f00', '#c43e00'],
                legend: { visible: false },
            });
        }
    } catch (e) {
        console.warn('Bekleten pie chart error', e);
    }
}

function renderPersonChartDolduran(data, chartType) {
    try {
        const chartElem = document.getElementById('personChartDolduran');
        if (chartElem) chartElem.innerHTML = "";
        if (!data || data.length === 0) return;
        const grouped = data
            .reduce((acc, d) => {
                const key = d.FormuDolduran || 'Bilinmiyor';
                const existing = acc.find(x => x.category === key);
                if (existing) existing.value++;
                else acc.push({ category: key, value: 1 });
                return acc;
            }, [])
            .sort((a, b) => b.value - a.value)
            .slice(0, 15);
        if (chartType === 'pie') {
            new DevExpress.viz.dxPieChart(chartElem, {
                dataSource: grouped,
                series: [{ argumentField: 'category', valueField: 'value', label: { visible: true, connector: { visible: true } } }],
                tooltip: { enabled: true, contentTemplate: d => `${d.argumentText}: ${d.value}` },
                legend: { visible: grouped.length <= 7 },
                onPointClick: function(e) {
                    const category = e.target.originalArgument;
                    filterState.dolduranKisi = category;
                    applyFilters();
                }
            });
        } else {
            new DevExpress.viz.dxChart(chartElem, {
                dataSource: grouped,
                rotated: true,
                animation: { enabled: true, duration: 800, easing: 'easeOutCubic' },
                series: [{
                    argumentField: 'category',
                    valueField: 'value',
                    type: chartType,
                    color: '#00eaff',
                    label: { visible: true, font: { color: '#fff', size: 14 }, backgroundColor: 'rgba(0,0,0,0.7)', customizeText: function(arg) { return arg.valueText; } }
                }],
                argumentAxis: { label: { font: { color: '#fff', size: 13 } }, color: '#444' },
                valueAxis: { label: { font: { color: '#fff', size: 13 } }, color: '#444' },
                tooltip: { enabled: true, customizeTooltip: function(arg) { return { text: `${arg.argumentText}: ${arg.valueText}` }; } },
                palette: ['#00eaff', '#00bfae', '#0081a7', '#005f73'],
                legend: { visible: false },
                onPointClick: function(e) {
                    const category = e.target.originalArgument;
                    filterState.dolduranKisi = category;
                    applyFilters();
                }
            });
        }
    } catch (e) {
        console.warn('Kişilere göre dolduran chart error', e);
    }
}

function renderPersonChartBekleten(data, chartType) {
    try {
        const chartElem = document.getElementById('personChartBekleten');
        if (chartElem) chartElem.innerHTML = "";
        if (!data || data.length === 0) return;
        const grouped = data
            .reduce((acc, d) => {
                const key = d.FormuBekleten || 'Bilinmiyor';
                const existing = acc.find(x => x.category === key);
                if (existing) existing.value++;
                else acc.push({ category: key, value: 1 });
                return acc;
            }, [])
            .sort((a, b) => b.value - a.value)
            .slice(0, 15);
        if (chartType === 'pie') {
            new DevExpress.viz.dxPieChart(chartElem, {
                dataSource: grouped,
                series: [{ argumentField: 'category', valueField: 'value', label: { visible: true, connector: { visible: true } } }],
                tooltip: { enabled: true, contentTemplate: d => `${d.argumentText}: ${d.value}` },
                legend: { visible: grouped.length <= 7 },
                onPointClick: function(e) {
                    const category = e.target.originalArgument;
                    filterState.bekletenKisi = category;
                    applyFilters();
                }
            });
        } else {
            new DevExpress.viz.dxChart(chartElem, {
                dataSource: grouped,
                rotated: true,
                animation: { enabled: true, duration: 800, easing: 'easeOutCubic' },
                series: [{
                    argumentField: 'category',
                    valueField: 'value',
                    type: chartType,
                    color: '#ff9800',
                    label: { visible: true, font: { color: '#fff', size: 14 }, backgroundColor: 'rgba(0,0,0,0.7)', customizeText: function(arg) { return arg.valueText; } }
                }],
                argumentAxis: { label: { font: { color: '#fff', size: 13 } }, color: '#444' },
                valueAxis: { label: { font: { color: '#fff', size: 13 } }, color: '#444' },
                tooltip: { enabled: true, customizeTooltip: function(arg) { return { text: `${arg.argumentText}: ${arg.valueText}` }; } },
                palette: ['#ff9800', '#ffb300', '#ff6f00', '#c43e00'],
                legend: { visible: false },
                onPointClick: function(e) {
                    const category = e.target.originalArgument;
                    filterState.bekletenKisi = category;
                    applyFilters();
                }
            });
        }
    } catch (e) {
        console.warn('Kişilere göre bekleten chart error', e);
    }
}

function renderLineChart(data, chartType) {
    try {
        const buckets = [
            { key: '0-7', min: 0, max: 7 },
            { key: '16-30', min: 16, max: 30 },
            { key: '31-60', min: 31, max: 60 },
            { key: '61-180', min: 61, max: 180 },
            { key: '>180', min: 181, max: Infinity }
        ];
        const grouped = buckets.map(b => ({ bucket: b.key, count: 0, min: b.min, max: b.max }));
        (data || []).forEach(d => {
            const gun = Number(d.BekleyenGun) || 0;
            const bucket = grouped.find(b => gun >= b.min && gun <= b.max);
            if (bucket) bucket.count++;
        });
        const chartData = grouped.map(g => ({ label: g.bucket, value: g.count }));
        if (chartType === 'pie') {
            new DevExpress.viz.dxPieChart(document.getElementById('lineChart'), {
                dataSource: chartData,
                series: [{ argumentField: 'label', valueField: 'value', label: { visible: true, connector: { visible: true } } }],
                tooltip: { enabled: true, contentTemplate: d => `${d.argumentText}: ${d.value}` },
                onPointClick: function(e) {
                    const bucketKey = e.target.originalArgument;
                    filterState.bucket = bucketKey;
                    applyFilters();
                }
            });
        } else {
            new DevExpress.viz.dxChart(document.getElementById('lineChart'), {
                dataSource: chartData,
                rotated: true,
                animation: { enabled: true, duration: 800, easing: 'easeOutCubic' },
                series: [{
                    argumentField: 'label',
                    valueField: 'value',
                    type: chartType,
                    color: '#ff4081',
                    label: { visible: true, font: { color: '#fff', size: 14 }, backgroundColor: 'rgba(0,0,0,0.7)', customizeText: function(arg) { return arg.valueText; } }
                }],
                argumentAxis: { label: { font: { color: '#fff', size: 13 } }, color: '#444' },
                valueAxis: { label: { font: { color: '#fff', size: 13 } }, color: '#444' },
                tooltip: { enabled: true, customizeTooltip: function(arg) { return { text: `${arg.argumentText}: ${arg.valueText}` }; } },
                palette: ['#ff4081', '#ff79b0', '#c60055', '#ffb3de'],
                legend: { visible: false },
                onPointClick: function(e) {
                    const bucketKey = e.target.originalArgument;
                    filterState.bucket = bucketKey;
                    applyFilters();
                }
            });
        }
    } catch (e) {
        console.warn('Histogram chart error', e);
    }
}

function renderMudurlukChart(data, chartType) {
    const chartElem = document.getElementById('mudurlukChart');
    if (chartElem) chartElem.innerHTML = "";
    if (!data || data.length === 0) return;
    const grouped = data.reduce((acc, d) => {
        const key = d.MudurlukAdi || 'Bilinmiyor';
        const existing = acc.find(x => x.category === key);
        if (existing) existing.value++;
        else acc.push({ category: key, value: 1 });
        return acc;
    }, []).sort((a, b) => b.value - a.value).slice(0, 15);
    if (chartType === 'pie') {
        new DevExpress.viz.dxPieChart(chartElem, {
            dataSource: grouped,
            series: [{ argumentField: 'category', valueField: 'value', label: { visible: true, connector: { visible: true } } }],
            tooltip: { enabled: true, contentTemplate: d => `${d.argumentText}: ${d.value}` },
            legend: { visible: grouped.length <= 7 },
            onPointClick: function(e) {
                const category = e.target.originalArgument;
                filterState.mudurluk = category;
                applyFilters();
            }
        });
    } else {
        new DevExpress.viz.dxChart(chartElem, {
            dataSource: grouped,
            rotated: true,
            animation: { enabled: true, duration: 800, easing: 'easeOutCubic' },
            series: [{
                argumentField: 'category',
                valueField: 'value',
                type: chartType,
                color: '#2196f3',
                label: { visible: true, font: { color: '#fff', size: 14 }, backgroundColor: 'rgba(0,0,0,0.7)', customizeText: function(arg) { return arg.valueText; } }
            }],
            argumentAxis: { label: { font: { color: '#fff', size: 13 } }, color: '#444' },
            valueAxis: { label: { font: { color: '#fff', size: 13 } }, color: '#444' },
            tooltip: { enabled: true, customizeTooltip: function(arg) { return { text: `${arg.argumentText}: ${arg.valueText}` }; } },
            palette: ['#2196f3', '#e91e63', '#ff9800', '#4caf50'],
            legend: { visible: false },
            onPointClick: function(e) {
                const category = e.target.originalArgument;
                filterState.mudurluk = category;
                applyFilters();
            }
        });
    }
}

function renderFormChart(data, chartType) {
    const chartElem = document.getElementById('formChart');
    if (chartElem) chartElem.innerHTML = "";
    if (!data || data.length === 0) return;
    const grouped = data.reduce((acc, d) => {
        const key = d.FormAdi || 'Bilinmiyor';
        const existing = acc.find(x => x.category === key);
        if (existing) existing.value++;
        else acc.push({ category: key, value: 1 });
        return acc;
    }, []).sort((a, b) => b.value - a.value).slice(0, 15);
    if (chartType === 'pie') {
        new DevExpress.viz.dxPieChart(chartElem, {
            dataSource: grouped,
            series: [{ argumentField: 'category', valueField: 'value', label: { visible: true, connector: { visible: true } } }],
            tooltip: { enabled: true, contentTemplate: d => `${d.argumentText}: ${d.value}` },
            legend: { visible: grouped.length <= 7 },
            onPointClick: function(e) {
                const category = e.target.originalArgument;
                filterState.form = category;
                applyFilters();
            }
        });
    } else {
        new DevExpress.viz.dxChart(chartElem, {
            dataSource: grouped,
            rotated: true,
            animation: { enabled: true, duration: 800, easing: 'easeOutCubic' },
            series: [{
                argumentField: 'category',
                valueField: 'value',
                type: chartType,
                color: '#9c27b0',
                label: { visible: true, font: { color: '#fff', size: 14 }, backgroundColor: 'rgba(0,0,0,0.7)', customizeText: function(arg) { return arg.valueText; } }
            }],
            argumentAxis: { label: { font: { color: '#fff', size: 13 } }, color: '#444' },
            valueAxis: { label: { font: { color: '#fff', size: 13 } }, color: '#444' },
            tooltip: { enabled: true, customizeTooltip: function(arg) { return { text: `${arg.argumentText}: ${arg.valueText}` }; } },
            palette: ['#9c27b0', '#00bcd4', '#ffc107', '#8bc34a'],
            legend: { visible: false },
            onPointClick: function(e) {
                const category = e.target.originalArgument;
                filterState.form = category;
                applyFilters();
            }
        });
    }
}
// Varsayılan rapor ve filtreleri kaydet
async function saveDefaultReport() {
    let reportId = document.getElementById('reportMeta')?.dataset?.reportId;
    if (reportId) reportId = parseInt(reportId, 10);
    if (!reportId || isNaN(reportId) || reportId <= 0) {
        showToast('Rapor ID bulunamadı, kayıt yapılamaz!', 'error');
        return;
    }
    // Inputlardan güncel değerleri filterState'e yaz
    filterState.mudurluk = document.getElementById('filterMudurluk').value;
    filterState.direktorluk = document.getElementById('filterDirektorluk').value;
    filterState.tarihBas = document.getElementById('filterTarihBaslangic').value;
    filterState.tarihBit = document.getElementById('filterTarihBitis').value;
    // Grafik tiplerini de kaydet
    filterState.chartTypeDolduran = document.getElementById('chartTypeDolduran')?.value;
    filterState.chartTypeBekleten = document.getElementById('chartTypeBekleten')?.value;
    filterState.chartTypeMudurluk = document.getElementById('chartTypeMudurluk')?.value;
    filterState.chartTypeForm = document.getElementById('chartTypeForm')?.value;
    filterState.chartTypeBekleme = document.getElementById('chartTypeBekleme')?.value;
    filterState.chartTypePersonDolduran = document.getElementById('chartTypePersonDolduran')?.value;
    filterState.chartTypePersonBekleten = document.getElementById('chartTypePersonBekleten')?.value;
    try {
        await fetch('http://localhost:5000/api/authorization/default-report', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
                ReportKey: reportId,
                Filters: { ...filterState }
            })
        });
        showToast('Varsayılan rapor ve filtreler kaydedildi!', 'success');
    } catch (e) {
        showToast('Kayıt sırasında hata oluştu.', 'error');
    }
}
// Filtreleri temizle
function clearFilters() {
    document.getElementById('filterMudurluk').value = '';
    document.getElementById('filterDirektorluk').value = '';
    document.getElementById('filterTarihBaslangic').value = '';
    document.getElementById('filterTarihBitis').value = '';
    filterState = { dolduranKisi: null, bekletenKisi: null, bucket: null, mudurluk: null, form: null };
    applyFilters();
}
