
/**
 * Utility functions that can be reused across the application.
 */

/**
 * Displays a short-lived notification message to the user.
 * @param {string} message The text to display.
 * @param {string} type The type of notification ('success' or 'danger').
 */
export function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);
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
    function debounced(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), delay);
    }
    debounced.cancel = () => { clearTimeout(timeout); };
    return debounced;
}
