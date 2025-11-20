/**
 * Manages daily notifications for the Pulse app.
 * Uses experimental Notification Triggers API when available, with a fallback to setTimeout.
 * This is a client-side implementation that works when the app is open in a browser tab.
 */
class NotificationManager {
    constructor() {
        this.notificationToggle = document.getElementById('notifications-toggle');
        this.timeSettingDiv = document.getElementById('notification-time-setting');
        this.disclaimerEl = document.getElementById('notification-disclaimer');
        this.timeInput = document.getElementById('notification-time');
        this.lastNotificationDateKey = 'pulse-last-notification-date';
        this.notificationEnabledKey = 'pulse-notifications-enabled';
        this.notificationTimeKey = 'pulse-notification-time';
        this.notificationTag = 'pulse-daily-reminder';
        this.timeoutId = null;
        this.checkInterval = null;
    }

    /**
     * Initializes the notification manager, sets up event listeners, and starts the scheduler if enabled.
     */
    init() {
        if (!this.notificationToggle || !this.timeSettingDiv || !this.timeInput || !this.disclaimerEl) return;

        this.registerServiceWorker();

        // Load saved preference
        const isEnabled = localStorage.getItem(this.notificationEnabledKey) === 'true';
        this.notificationToggle.checked = isEnabled;
        this.updateTimeSettingVisibility(isEnabled);

        // Load saved time
        const savedTime = localStorage.getItem(this.notificationTimeKey) || '20:00';
        this.timeInput.value = savedTime;

        // If enabled, ensure we have permission and start the scheduler
        if (isEnabled) {
            this.enableNotifications(); // This is the single entry point needed.
        }

        // Listen for changes on the toggle
        this.notificationToggle.addEventListener('change', (event) => {
            if (event.target.checked) {
                this.enableNotifications();
            } else {
                this.disableNotifications();
            }
        });

        // Listen for changes on the time input
        this.timeInput.addEventListener('change', (event) => {
            localStorage.setItem(this.notificationTimeKey, event.target.value);
            // Restart scheduler with new time
            if (this.notificationToggle.checked) {
                this.disableNotifications(); // Stops current interval
                this.enableNotifications();  // Starts new one
            }
        });
    }

    async registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            try {
                await navigator.serviceWorker.register('/sw.js');
                console.log('Service Worker registered successfully.');
            } catch (error) {
                console.error('Service Worker registration failed:', error);
            }
        }
    }

    updateTimeSettingVisibility(isEnabled) {
        this.timeSettingDiv.classList.toggle('hidden', !isEnabled);
        this.updateDisclaimer();
    }

    async updateDisclaimer() {
        const supportsTriggers = await this.checkTriggerSupport();
        this.disclaimerEl.textContent = supportsTriggers ?
            'Notifications are scheduled with your OS and will be delivered even if the browser is closed.' :
            'Your browser must have this page open in a tab for the notification to be delivered.';
    }

    /**
     * Handles the process of enabling notifications, including requesting permission.
     */
    async enableNotifications() {
        if (!('Notification' in window)) {
            alert('This browser does not support desktop notifications.');
            this.notificationToggle.checked = false;
            return;
        }

        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            localStorage.setItem(this.notificationEnabledKey, 'true');
            this.updateTimeSettingVisibility(true);

            const hhmm = localStorage.getItem(this.notificationTimeKey) || '20:00';
            const supportsTriggers = await this.checkTriggerSupport();

            if (supportsTriggers) {
                console.log('Scheduling with experimental Notification Triggers API.');
                this.scheduleWithApiTrigger(hhmm);
            } else {
                console.log('Falling back to setTimeout/setInterval for notifications.');
                this.scheduleNextNotification(hhmm);
                this.startPollingFallback(hhmm);
            }
        } else {
            console.log('Notification permission was not granted.');
            this.notificationToggle.checked = false;
            localStorage.setItem(this.notificationEnabledKey, 'false');
            this.updateTimeSettingVisibility(false);
        }
    }

    /**
     * Disables notifications and stops the scheduler.
     */
    async disableNotifications() {
        localStorage.setItem(this.notificationEnabledKey, 'false');

        const supportsTriggers = await this.checkTriggerSupport();
        if (supportsTriggers) {
            this.cancelApiTrigger();
        }
        
        if (this.timeoutId) {
            clearTimeout(this.timeoutId);
            this.timeoutId = null;
        }
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
        }

        this.updateTimeSettingVisibility(false);
        console.log('Notifications disabled and all schedulers stopped.');
    }

    async checkTriggerSupport() {
        if (!window.ServiceWorkerRegistration || !('showTrigger' in ServiceWorkerRegistration.prototype)) {
            return false;
        }
        try {
            // The API also requires a service worker
            const registration = await navigator.serviceWorker.getRegistration();
            return !!registration;
        } catch (e) {
            return false;
        }
    }

    async scheduleWithApiTrigger(hhmm) {
        try {
            const registration = await navigator.serviceWorker.getRegistration();
            // Cancel any previously scheduled notifications to avoid duplicates
            await this.cancelApiTrigger();

            const next = this.calculateNextOccurrence(hhmm);
            const trigger = new TimestampTrigger(next.getTime());

            await registration.showNotification('Pulse Daily Reminder', {
                body: "It's time to log your progress for today. Let's do it!",
                tag: this.notificationTag,
                showTrigger: trigger,
                icon: 'assets/favicon.svg'
            });
            console.log(`Notification scheduled with Trigger API for ${next.toLocaleString()}`);
        } catch (e) {
            console.error('Error scheduling with Notification Triggers API:', e);
            // Fallback if the API fails for some reason
            this.scheduleNextNotification(hhmm);
            this.startPollingFallback(hhmm);
        }
    }

    async cancelApiTrigger() {
        const registration = await navigator.serviceWorker.getRegistration();
        const notifications = await registration.getNotifications({ tag: this.notificationTag, includeTriggered: true });
        notifications.forEach(notification => notification.close());
        console.log(`Cancelled ${notifications.length} scheduled notifications.`);
    }

    calculateNextOccurrence(hhmm) {
        const [hour, minute] = hhmm.split(':').map(Number);
        const now = new Date();
        const next = new Date(now);
        next.setHours(hour, minute, 0, 0);
        if (next <= now) {
            next.setDate(next.getDate() + 1);
        }
        return next;
    }

    /**
     * Schedules the primary notification check using a precise setTimeout.
     */
    scheduleNextNotification(hhmm) {
        if (this.timeoutId) clearTimeout(this.timeoutId);

        const next = this.calculateNextOccurrence(hhmm);
        const msUntilNext = next.getTime() - Date.now();

        this.timeoutId = setTimeout(() => {
            this.fireNotificationCheck(hhmm);
            // Once fired, schedule for the next day
            this.scheduleNextNotification(hhmm);
        }, msUntilNext);
    }

    /**
     * Starts a polling fallback to catch notifications if the main timer is throttled.
     */
    startPollingFallback(hhmm) {
        if (this.checkInterval) return; // Already running

        this.checkInterval = setInterval(() => {
            const now = new Date();
            const [hour, minute] = hhmm.split(':').map(Number);
            // Check if we are in the notification minute
            if (now.getHours() === hour && now.getMinutes() === minute) {
                this.fireNotificationCheck(hhmm);
            }
        }, 60000); // Check every minute
    }

    fireNotificationCheck(hhmm) {
        const todayISO = new Date().toISOString().slice(0, 10);
        if (localStorage.getItem(this.lastNotificationDateKey) !== todayISO) {
            this.sendNotification();
            localStorage.setItem(this.lastNotificationDateKey, todayISO);
            console.log(`Notification fired for ${hhmm} on ${todayISO}`);
        }
    }

    /**
     * Creates and displays the browser notification.
     */
    sendNotification() {
        const notification = new Notification('Pulse Daily Reminder', {
            body: "It's time to log your progress for today. Let's do it!",
            icon: 'assets/favicon.svg' // Make sure this path is correct
        });

        notification.onclick = () => {
            window.focus();
        };
    }
}

// Initialize the manager when the DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.notificationManager = new NotificationManager();
    // The init call will be triggered from app.js after the user is authenticated
});