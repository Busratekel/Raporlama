(function () {
    'use strict';

    if ('serviceWorker' in navigator) {
        window.addEventListener('load', function () {
            navigator.serviceWorker.register('/service-worker.js', { scope: '/' })
                .catch(function (err) {
                    console.warn('Service worker kaydı başarısız:', err);
                });
        });

        navigator.serviceWorker.addEventListener('message', function (event) {
            if (event.data && event.data.type === 'inbox-changed') {
                window.dispatchEvent(new Event('rapor-inbox-changed'));
            }
        });
    }

    var deferredPrompt = null;
    var pushSupported = ('PushManager' in window) && ('Notification' in window);

    function urlBase64ToUint8Array(base64String) {
        var padding = '='.repeat((4 - (base64String.length % 4)) % 4);
        var base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
        var raw = window.atob(base64);
        var arr = new Uint8Array(raw.length);
        for (var i = 0; i < raw.length; ++i) arr[i] = raw.charCodeAt(i);
        return arr;
    }

    async function getRegistration() {
        return navigator.serviceWorker.ready;
    }

    window.RaporPwa = {
        canInstall: function () { return !!deferredPrompt; },
        isPushSupported: function () { return pushSupported; },

        promptInstall: async function () {
            if (!deferredPrompt) return { outcome: 'unavailable' };
            deferredPrompt.prompt();
            var result = await deferredPrompt.userChoice;
            deferredPrompt = null;
            window.dispatchEvent(new Event('rapor-pwa-install-changed'));
            return result;
        },

        getPushStatus: async function () {
            try {
                var resp = await fetch('/api/push/status', { credentials: 'include' });
                if (!resp.ok) return { enabled: false, subscribed: false, unreadCount: 0 };
                return await resp.json();
            } catch (_) {
                return { enabled: false, subscribed: false, unreadCount: 0 };
            }
        },

        getInbox: async function (limit) {
            try {
                var resp = await fetch('/api/push/inbox?limit=' + (limit || 30), { credentials: 'include' });
                if (!resp.ok) return { unreadCount: 0, items: [] };
                return await resp.json();
            } catch (_) {
                return { unreadCount: 0, items: [] };
            }
        },

        markNotificationRead: async function (notificationKey) {
            var resp = await fetch('/api/push/inbox/' + notificationKey + '/read', {
                method: 'POST',
                credentials: 'include'
            });
            if (!resp.ok) return null;
            return resp.json();
        },

        markAllNotificationsRead: async function () {
            var resp = await fetch('/api/push/inbox/read-all', {
                method: 'POST',
                credentials: 'include'
            });
            if (!resp.ok) return null;
            return resp.json();
        },

        setPushNotificationsEnabled: async function (enabled) {
            var resp = await fetch('/api/push/preferences', {
                method: 'PUT',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pushNotificationsEnabled: enabled })
            });
            if (!resp.ok) {
                var err = await resp.json().catch(function () { return {}; });
                return { ok: false, error: err.error || 'Ayar kaydedilemedi.' };
            }
            if (!enabled) {
                await this.unsubscribePush();
            } else if (this.isPushSupported()) {
                var sub = await this.subscribePush();
                if (!sub.ok) return sub;
            }
            window.dispatchEvent(new Event('rapor-push-changed'));
            return { ok: true };
        },

        subscribePush: async function () {
            if (!pushSupported) return { ok: false, error: 'Bu tarayıcı bildirim desteklemiyor.' };

            var status = await this.getPushStatus();
            if (!status.enabled || !status.publicKey)
                return { ok: false, error: 'Bildirimler şu an kullanılamıyor.' };

            var perm = await Notification.requestPermission();
            if (perm !== 'granted')
                return { ok: false, error: 'Bildirim izni verilmedi.' };

            var reg = await getRegistration();
            var sub = await reg.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(status.publicKey)
            });

            var resp = await fetch('/api/push/subscribe', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(sub.toJSON())
            });
            if (!resp.ok) {
                var err = await resp.json().catch(function () { return {}; });
                return { ok: false, error: err.error || 'Abonelik kaydedilemedi.' };
            }

            window.dispatchEvent(new Event('rapor-push-changed'));
            return { ok: true };
        },

        unsubscribePush: async function () {
            if (!pushSupported) return { ok: false };
            var reg = await getRegistration();
            var sub = await reg.pushManager.getSubscription();
            if (!sub) return { ok: true };

            await fetch('/api/push/unsubscribe', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ endpoint: sub.endpoint })
            }).catch(function () {});

            await sub.unsubscribe();
            window.dispatchEvent(new Event('rapor-push-changed'));
            return { ok: true };
        },

        togglePush: async function () {
            var status = await this.getPushStatus();
            if (status.subscribed) return this.unsubscribePush();
            return this.subscribePush();
        }
    };

    window.addEventListener('beforeinstallprompt', function (e) {
        e.preventDefault();
        deferredPrompt = e;
        window.dispatchEvent(new Event('rapor-pwa-installable'));
    });

    window.addEventListener('appinstalled', function () {
        deferredPrompt = null;
        window.dispatchEvent(new Event('rapor-pwa-install-changed'));
    });
})();
