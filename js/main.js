
import Controller from './controller.js';

/**
 * Lyrical Blueprint Studio Application
 * 
 * Entry point of the application.
 * It waits for the DOM to be fully loaded and then initializes the main controller.
 */
document.addEventListener('DOMContentLoaded', () => {
    Controller.init();
});
