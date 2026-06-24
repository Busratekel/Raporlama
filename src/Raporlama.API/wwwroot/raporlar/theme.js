(function () {
    const STORAGE_KEY = 'raporlama-theme';

    function getTheme() {
        return localStorage.getItem(STORAGE_KEY) === 'light' ? 'light' : 'dark';
    }

    function dxFile(theme) {
        return theme === 'light' ? 'dx.light.css' : 'dx.dark.css';
    }

    window.RaporTheme = {
        getTheme,
        init(options) {
            this._dxBase = (options && options.dxBase) || '../lib/css/';
            const theme = getTheme();
            document.documentElement.setAttribute('data-theme', theme);
            const link = document.getElementById('dxThemeCss');
            if (link) link.href = this._dxBase + dxFile(theme);
        },
        applyTheme(theme) {
            theme = theme === 'light' ? 'light' : 'dark';
            localStorage.setItem(STORAGE_KEY, theme);
            document.documentElement.setAttribute('data-theme', theme);
            const link = document.getElementById('dxThemeCss');
            if (link) link.href = (this._dxBase || '../lib/css/') + dxFile(theme);
            this.updateToggleButton();
            window.dispatchEvent(new CustomEvent('rapor-theme-change', { detail: { theme } }));
        },
        toggle() {
            this.applyTheme(getTheme() === 'dark' ? 'light' : 'dark');
        },
        bindToggle(buttonId) {
            const btn = document.getElementById(buttonId || 'themeToggle');
            if (!btn) return;
            btn.addEventListener('click', () => this.toggle());
            this.updateToggleButton(btn);
        },
        updateToggleButton(btn) {
            btn = btn || document.getElementById('themeToggle');
            if (!btn) return;
            const isDark = getTheme() === 'dark';
            btn.textContent = isDark ? '☀️ Açık Tema' : '🌙 Koyu Tema';
            btn.setAttribute('aria-label', isDark ? 'Açık temaya geç' : 'Koyu temaya geç');
        },
        cssVar(name, fallback) {
            const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
            return v || fallback;
        }
    };
})();
