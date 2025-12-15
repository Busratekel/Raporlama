// Basit toast fonksiyonu, sağ üstte gösterir
function showToast(message, type = 'info') {
    let bg = '#23242a';
    if(type==='success') bg = '#00bfae';
    if(type==='error') bg = '#e74c3c';
    if(type==='warning') bg = '#ff9800';
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.style.position = 'fixed';
        container.style.top = '32px';
        container.style.right = '32px';
        container.style.zIndex = 99999;
        container.style.display = 'flex';
        container.style.flexDirection = 'column';
        container.style.alignItems = 'flex-end';
        document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    toast.textContent = message;
    toast.style.background = bg;
    toast.style.color = '#fff';
    toast.style.padding = '16px 32px';
    toast.style.borderRadius = '8px';
    toast.style.fontSize = '16px';
    toast.style.boxShadow = '0 2px 12px rgba(0,0,0,0.2)';
    toast.style.marginTop = '8px';
    toast.style.opacity = 0;
    toast.style.transition = 'opacity 0.3s';
    container.appendChild(toast);
    setTimeout(()=>{ toast.style.opacity = 1; }, 10);
    setTimeout(()=>{
        toast.style.opacity = 0;
        setTimeout(()=>{ container.removeChild(toast); }, 300);
    }, 2500);
}
