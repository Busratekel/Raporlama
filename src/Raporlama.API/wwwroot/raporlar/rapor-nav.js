(function () {
    'use strict';

    function initReportNav() {
        if (document.querySelector('.corner-actions')) return;

        document.body.classList.add('has-corner-actions');

        var corner = document.createElement('div');
        corner.className = 'corner-actions';

        var menuLink = document.createElement('a');
        menuLink.href = '/menu.html';
        menuLink.className = 'corner-btn corner-btn--menu';
        menuLink.title = 'Menü';
        menuLink.setAttribute('aria-label', 'Menü');
        menuLink.textContent = '←';
        corner.appendChild(menuLink);

        var themeBtn = document.getElementById('themeToggle');
        if (themeBtn) {
            corner.appendChild(themeBtn);
        }

        var logoutLink = document.createElement('a');
        logoutLink.href = '/Auth/cikis';
        logoutLink.className = 'corner-btn corner-btn--logout';
        logoutLink.title = 'Çıkış yap';
        logoutLink.setAttribute('aria-label', 'Çıkış yap');
        logoutLink.textContent = '🔒';
        corner.appendChild(logoutLink);

        document.body.appendChild(corner);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initReportNav);
    } else {
        initReportNav();
    }
})();
