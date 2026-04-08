
/**
 * Utility functions that can be reused across the application.
 */

/**
 * Displays a short-lived notification message to the user.
 * @param {string} message The text to display.
 * @param {string} type The type of notification ('success' or 'danger').
 */
export function showNotification(message, type = 'success') {
    // Kontajner pre notifikácie (stacking)
    let container = document.getElementById('notification-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'notification-container';
        document.body.appendChild(container);
    }
    
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    container.appendChild(notification);
    
    setTimeout(() => notification.classList.add('show'), 10);
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 500);
    }, 3000);
}

/**
 * Creates a debounced function that delays invoking `func` until after `delay`
 * milliseconds have elapsed since the last time the debounced function was invoked.
 * @param {Function} func The function to debounce.
 * @param {number} delay The number of milliseconds to delay.
 * @returns {Function} Returns the new debounced function.
 */
export function debounce(func, delay) {
    let timeout;
    let lastArgs;
    let lastThis;
    function debounced(...args) {
        lastArgs = args;
        lastThis = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => {
            timeout = null;
            func.apply(this, args);
        }, delay);
    }
    debounced.cancel = () => { clearTimeout(timeout); };
    debounced.flush = () => {
        if (!timeout) return;
        clearTimeout(timeout);
        timeout = null;
        func.apply(lastThis, lastArgs || []);
    };
    return debounced;
}

// Loading overlay helpers (with delayed show to avoid flicker)
let loadingTimer = null;
export function showLoading(message = 'Načítavam…', delayMs = 150) {
    const overlay = document.getElementById('loading-overlay');
    if (!overlay) return;
    const msg = overlay.querySelector('#loading-message');
    if (msg) msg.textContent = message;
    overlay.setAttribute('aria-busy', 'true');
    clearTimeout(loadingTimer);
    loadingTimer = setTimeout(() => {
        overlay.classList.remove('hidden');
    }, delayMs);
}

export function hideLoading() {
    const overlay = document.getElementById('loading-overlay');
    if (!overlay) return;
    overlay.setAttribute('aria-busy', 'false');
    clearTimeout(loadingTimer);
    overlay.classList.add('hidden');
}
