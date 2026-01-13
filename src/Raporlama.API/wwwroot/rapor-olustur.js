
const API_BASE = window.location.origin + '/api';

window.onload = async function() {
    await loadTables();
    document.getElementById('tabloSelect').addEventListener('change', async () => {
        await loadColumns();
        updateAxisSelectors();
        updatePreview();
    });
    document.getElementById('grafikTipiSelect').addEventListener('change', () => {
        updateAxisSelectors();
        updatePreview();
    });
    document.getElementById('raporForm').addEventListener('submit', saveReport);
    // Drop alanı kolon değiştikçe önizleme ve eksen güncelle
    const dropArea = document.getElementById('dropArea');
    const observer = new MutationObserver(() => {
        updateAxisSelectors();
        updatePreview();
    });
    observer.observe(dropArea, { childList: true });
};

function getSelectedColumns() {
    return Array.from(document.getElementById('dropArea').children).map(x => x.textContent);
}

function getSampleDataSync() {
    // Son async preview'da alınan veri, axis select için kullanılacak
    return window._lastSampleData || [];
}

function updateAxisSelectors() {
    const kolonlar = getSelectedColumns();
    const grafikTipi = document.getElementById('grafikTipiSelect').value;
    const eksenDiv = document.getElementById('eksensecim');
    if (grafikTipi === 'tablo' || kolonlar.length < 2) {
        eksenDiv.style.display = 'none';
        return;
    }
    // Son örnek veri (varsa) ile sayısal kolonları bul
    let data = getSampleDataSync();
    let numericCols = kolonlar.filter(k => data.length === 0 || data.every(row => row && row[k] !== null && row[k] !== undefined && row[k] !== '' && !isNaN(Number(row[k]))));
    // X ekseni tüm kolonlar, Y ekseni pie/bar için sadece sayısal
    const xSel = document.getElementById('xEkseniSelect');
    const ySel = document.getElementById('yEkseniSelect');
    xSel.innerHTML = kolonlar.map(k => `<option value="${k}">${k}</option>`).join('');
    let yOptions = (grafikTipi === 'pie' || grafikTipi === 'bar') ? numericCols : kolonlar;
    ySel.innerHTML = yOptions.map(k => `<option value="${k}">${k}</option>`).join('');
    // Varsayılan seçim: ilk kolon X, ilk uygun Y
    xSel.value = kolonlar[0] || '';
    ySel.value = yOptions[0] || '';
    eksenDiv.style.display = '';
}

async function loadTables() {
    const res = await fetch(`${API_BASE}/reports/tables`);
    let tables = await res.json();
    tables = tables.filter(t => t.startsWith('Fact_'));
    const select = document.getElementById('tabloSelect');
    select.innerHTML = '<option value="">Tablo Seçiniz</option>' + tables.map(t => `<option value="${t}">${t}</option>`).join('');
    await loadColumns();
}

async function loadColumns() {
    const table = document.getElementById('tabloSelect').value;
    const kolonList = document.getElementById('kolonList');
    kolonList.innerHTML = '';
    if (!table) return;
    const res = await fetch(`${API_BASE}/reports/columns?table=${encodeURIComponent(table)}`);
    const columns = await res.json();
    columns.forEach(col => {
        const li = document.createElement('li');
        li.textContent = col;
        li.draggable = true;
        li.className = 'kolon-item';
        li.style.padding = '8px 12px';
        li.style.margin = '4px';
        li.style.background = '#000000';
        li.style.borderRadius = '6px';
        li.style.cursor = 'grab';
        li.addEventListener('dragstart', e => {
            e.dataTransfer.setData('text/plain', col);
        });
        kolonList.appendChild(li);
    });
}

// --- Canlı Önizleme ---
async function updatePreview() {
    const tablo = document.getElementById('tabloSelect').value;
    const kolonlar = getSelectedColumns();
    const grafikTipi = document.getElementById('grafikTipiSelect').value;
    const grafikDiv = document.getElementById('grafikOnizleme');
    const tabloDiv = document.getElementById('tabloOnizleme');
    grafikDiv.innerHTML = '';
    tabloDiv.innerHTML = '';
    if (!tablo || kolonlar.length === 0) return;
    // Veri çek
    let data = [];
    try {
        const res = await fetch(`${API_BASE}/reports/sample?table=${encodeURIComponent(tablo)}&columns=${encodeURIComponent(kolonlar.join(','))}`);
        if (!res.ok) throw new Error('Veri alınamadı');
        data = await res.json();
        window._lastSampleData = data;
    } catch (e) {
        tabloDiv.innerHTML = '<div style="color:#c00">Veri alınamadı</div>';
        grafikDiv.innerHTML = '';
        return;
    }
    if (!data || (Array.isArray(data) && data.length === 0)) {
        tabloDiv.innerHTML = '<div style="color:#888">Veri yok</div>';
        grafikDiv.innerHTML = '';
        return;
    }
    // Tablo önizleme
    $(tabloDiv).dxDataGrid({
        dataSource: data,
        columns: kolonlar,
        showBorders: true,
        height: 320
    });
    // Grafik önizleme
    if (grafikTipi !== 'tablo' && kolonlar.length >= 2 && data.length > 0) {
        // X ve Y ekseni selectlerinden değer al
        const xField = document.getElementById('xEkseniSelect')?.value || kolonlar[0];
        const yField = document.getElementById('yEkseniSelect')?.value || kolonlar[1];
        // Pie/bar için valueField sayısal mı kontrolü
        let allNumeric = data.every(row => {
            const v = row[yField];
            return v !== null && v !== undefined && v !== '' && !isNaN(Number(v));
        });
        if ((grafikTipi === 'pie' || grafikTipi === 'bar') && !allNumeric) {
            grafikDiv.innerHTML = '<div style="color:#c00">Pie ve Bar grafik için Y ekseni (değer) sayısal olmalı.</div>';
            return;
        }
        if (grafikTipi === 'pie') {
            $(grafikDiv).dxPieChart({
                dataSource: data,
                series: [{ argumentField: xField, valueField: yField }],
                size: { height: 320 },
                legend: { visible: true },
                tooltip: { enabled: true },
                title: 'Grafik Önizleme'
            });
        } else if (grafikTipi === 'line') {
            $(grafikDiv).dxChart({
                dataSource: data,
                series: [{
                    argumentField: xField,
                    valueField: yField,
                    type: 'line'
                }],
                size: { height: 320 },
                legend: { visible: true },
                tooltip: { enabled: true },
                title: 'Grafik Önizleme'
            });
        } else {
            // bar veya diğer
            $(grafikDiv).dxChart({
                dataSource: data,
                series: [{
                    argumentField: xField,
                    valueField: yField,
                    type: 'bar'
                }],
                size: { height: 320 },
                legend: { visible: true },
                tooltip: { enabled: true },
                title: 'Grafik Önizleme'
            });
        }
    } else {
        grafikDiv.innerHTML = '';
    }
    // Grafik ve tablo ortada, konum yok
}

// Drop alanı eventleri
const dropArea = document.getElementById('dropArea');
dropArea.addEventListener('dragover', function(e) {
    e.preventDefault();
    dropArea.style.background = '#dbeafe';
});
dropArea.addEventListener('dragleave', function(e) {
    dropArea.style.background = '#f7f9fc';
});
dropArea.addEventListener('drop', function(e) {
    e.preventDefault();
    dropArea.style.background = '#f7f9fc';
    const col = e.dataTransfer.getData('text/plain');
    if (!Array.from(dropArea.children).some(x => x.textContent === col)) {
        const tag = document.createElement('span');
        tag.textContent = col;
        tag.className = 'selected-colon';
        tag.style.background = '#1976d2';
        tag.style.color = '#fff';
        tag.style.padding = '6px 14px';
        tag.style.borderRadius = '16px';
        tag.style.margin = '4px';
        tag.style.display = 'inline-block';
        tag.style.cursor = 'pointer';
        tag.title = 'Kaldır';
        tag.onclick = () => dropArea.removeChild(tag);
        dropArea.appendChild(tag);
    }
});

async function saveReport(e) {
    e.preventDefault();
    const form = document.getElementById('raporForm');
    const tablo = document.getElementById('tabloSelect').value;
    const kolonlar = Array.from(dropArea.children).map(x => x.textContent);
    if (!tablo || kolonlar.length === 0) {
        alert('Tablo ve en az bir kolon seçmelisiniz!');
        return;
    }
    const data = {
        raporAdi: form.raporAdi.value,
        grafikTipi: form.grafikTipi.value,
        tablo,
        kolonlar
    };
    const res = await fetch(`${API_BASE}/reports/custom`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    if (res.ok) {
        alert('Rapor kaydedildi!');
        window.location.href = 'menu.html';
    } else {
        alert('Rapor kaydedilemedi!');
    }
}
