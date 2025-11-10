/**
 * LBS v4.0 - UNIFIED TOOLBAR
 * Main navigation and actions
 * @module components/toolbar
 */

import { bus, App } from '../core/app.js';
import { State } from '../core/state.js';

export const Toolbar = {
    el: null,
    dropdowns: new Map(),

    /**
     * Initialize toolbar
     */
    init() {
        this.el = document.getElementById('main-toolbar');
        if (!this.el) {
            console.warn('Toolbar element not found');
            return;
        }

        this.render();
        this.bindEvents();
        this.subscribeToState();

        console.log('✅ Toolbar initialized');
        App.registerComponent('toolbar', this);
    },

    /**
     * Render toolbar HTML
     */
    render() {
        const projects = State.get('projects');
        const activeProject = State.get('activeProject');

        this.el.innerHTML = `
            <div class="toolbar-left">
                <h1 class="app-title">
                    LBS Live Server
                    <span class="version">v${App.version}</span>
                </h1>
            </div>

            <nav class="toolbar-center">
                <!-- PROJEKTY DROPDOWN -->
                <div class="toolbar-group">
                    <button class="toolbar-btn dropdown-trigger" data-dropdown="projects">
                        <span class="icon">📝</span>
                        <span class="label">Projekty</span>
                        <span class="caret">▾</span>
                    </button>
                    <div class="dropdown-menu" id="dropdown-projects">
                        <button class="dropdown-item" data-action="new-project">
                            <span class="icon">➕</span> Nový projekt
                        </button>
                        <div class="dropdown-divider"></div>
                        ${this.renderProjectsList(projects, activeProject)}
                    </div>
                </div>

                <!-- ANALÝZA -->
                <div class="toolbar-group">
                    <button class="toolbar-btn" data-action="open-analysis">
                        <span class="icon">🔬</span>
                        <span class="label">Analýza</span>
                    </button>
                </div>

                <!-- EXPORT DROPDOWN -->
                <div class="toolbar-group">
                    <button class="toolbar-btn dropdown-trigger" data-dropdown="export">
                        <span class="icon">💾</span>
                        <span class="label">Export</span>
                        <span class="caret">▾</span>
                    </button>
                    <div class="dropdown-menu" id="dropdown-export">
                        <button class="dropdown-item" data-action="download-txt">
                            <span class="icon">📄</span> Download .txt
                        </button>
                        <button class="dropdown-item" data-action="copy-clipboard">
                            <span class="icon">📋</span> Copy to Clipboard
                        </button>
                        <button class="dropdown-item" data-action="export-json">
                            <span class="icon">📦</span> Export JSON
                        </button>
                        <button class="dropdown-item" data-action="export-html">
                            <span class="icon">🌐</span> Export HTML
                        </button>
                    </div>
                </div>

                <!-- NÁSTROJE DROPDOWN -->
                <div class="toolbar-group">
                    <button class="toolbar-btn dropdown-trigger" data-dropdown="tools">
                        <span class="icon">⚙️</span>
                        <span class="label">Nástroje</span>
                        <span class="caret">▾</span>
                    </button>
                    <div class="dropdown-menu" id="dropdown-tools">
                        <button class="dropdown-item" data-action="statistics">
                            <span class="icon">📊</span> Štatistiky
                        </button>
                        <button class="dropdown-item" data-action="about">
                            <span class="icon">ℹ️</span> O aplikácii
                        </button>
                    </div>
                </div>
            </nav>

            <div class="toolbar-right">
                <div class="status-indicator" id="save-status">
                    <span class="status-icon">●</span>
                    <span class="status-text">Uložené</span>
                </div>
            </div>
        `;
    },

    /**
     * Render projects list
     */
    renderProjectsList(projects, activeProject) {
        if (projects.length === 0) {
            return '<div class="dropdown-empty">Žiadne projekty</div>';
        }

        return projects.map(project => `
            <button class="dropdown-item ${project === activeProject ? 'active' : ''}" 
                    data-action="switch-project" 
                    data-project="${this.escapeHtml(project)}">
                <span class="icon">${project === activeProject ? '📂' : '📄'}</span>
                ${this.escapeHtml(project)}
            </button>
        `).join('');
    },

    /**
     * Bind event listeners
     */
    bindEvents() {
        // Dropdown triggers
        this.el.addEventListener('click', (e) => {
            const trigger = e.target.closest('.dropdown-trigger');
            if (trigger) {
                e.stopPropagation();
                this.toggleDropdown(trigger.dataset.dropdown);
            }
        });

        // Action handlers
        this.el.addEventListener('click', (e) => {
            const item = e.target.closest('[data-action]');
            if (item) {
                this.handleAction(item.dataset.action, item.dataset);
                this.closeAllDropdowns();
            }
        });

        // Close dropdowns on outside click
        document.addEventListener('click', () => {
            this.closeAllDropdowns();
        });

        // Prevent dropdown close when clicking inside
        this.el.querySelectorAll('.dropdown-menu').forEach(menu => {
            menu.addEventListener('click', (e) => {
                e.stopPropagation();
            });
        });
    },

    /**
     * Subscribe to state changes
     */
    subscribeToState() {
        // Update projects list when projects change
        State.subscribe('projects', () => {
            this.updateProjectsList();
        });

        State.subscribe('activeProject', () => {
            this.updateProjectsList();
        });

        // Update save status
        State.subscribe('isDirty', (isDirty) => {
            this.updateSaveStatus(isDirty ? 'saving' : 'saved');
        });

        // Listen to save events
        bus.on('app:saved', () => {
            this.updateSaveStatus('saved');
        });

        bus.on('app:error', () => {
            this.updateSaveStatus('error');
        });
    },

    /**
     * Toggle dropdown
     */
    toggleDropdown(id) {
        const dropdown = document.getElementById(`dropdown-${id}`);
        const trigger = this.el.querySelector(`[data-dropdown="${id}"]`);
        
        if (!dropdown || !trigger) return;

        const isActive = dropdown.classList.contains('active');

        // Close all other dropdowns
        this.closeAllDropdowns();

        // Toggle current
        if (!isActive) {
            dropdown.classList.add('active');
            trigger.classList.add('active');
        }
    },

    /**
     * Close all dropdowns
     */
    closeAllDropdowns() {
        this.el.querySelectorAll('.dropdown-menu.active').forEach(menu => {
            menu.classList.remove('active');
        });
        this.el.querySelectorAll('.dropdown-trigger.active').forEach(trigger => {
            trigger.classList.remove('active');
        });
    },

    /**
     * Handle action
     */
    handleAction(action, data = {}) {
        console.log('🎯 Toolbar action:', action, data);

        switch(action) {
            case 'new-project':
                this.createNewProject();
                break;

            case 'switch-project':
                if (data.project) {
                    bus.emit('project:switch', data.project);
                }
                break;

            case 'open-analysis':
                bus.emit('analysis:open');
                break;

            case 'download-txt':
                bus.emit('export:txt');
                break;

            case 'copy-clipboard':
                bus.emit('export:clipboard');
                break;

            case 'export-json':
                bus.emit('export:json');
                break;

            case 'export-html':
                bus.emit('export:html');
                break;

            case 'statistics':
                this.showStatistics();
                break;

            case 'about':
                this.showAbout();
                break;

            default:
                console.warn('Unknown action:', action);
        }
    },

    /**
     * Create new project
     */
    createNewProject() {
        const name = prompt('Názov nového projektu:');
        if (name && name.trim()) {
            bus.emit('project:create', name.trim());
        }
    },

    /**
     * Update projects list
     */
    updateProjectsList() {
        const dropdown = document.getElementById('dropdown-projects');
        if (!dropdown) return;

        const projects = State.get('projects');
        const activeProject = State.get('activeProject');

        const projectsHTML = this.renderProjectsList(projects, activeProject);
        
        // Find the divider and replace everything after it
        const divider = dropdown.querySelector('.dropdown-divider');
        if (divider) {
            // Remove all items after divider
            let next = divider.nextElementSibling;
            while (next) {
                const toRemove = next;
                next = next.nextElementSibling;
                toRemove.remove();
            }
            
            // Add new items
            divider.insertAdjacentHTML('afterend', projectsHTML);
        }
    },

    /**
     * Update save status
     */
    updateSaveStatus(status) {
        const indicator = document.getElementById('save-status');
        if (!indicator) return;

        const statusText = indicator.querySelector('.status-text');
        
        indicator.className = `status-indicator ${status}`;
        
        switch(status) {
            case 'saved':
                statusText.textContent = 'Uložené';
                break;
            case 'saving':
                statusText.textContent = 'Ukladá sa...';
                break;
            case 'error':
                statusText.textContent = 'Chyba';
                break;
        }
    },

    /**
     * Show statistics
     */
    showStatistics() {
        const sections = State.getSections();
        const research = State.get('research');
        const sourceText = State.get('sourceText');
        
        const text = sections.map(s => s.text).join('\n\n') + '\n\n' + research + '\n\n' + sourceText;
        const words = text.split(/\s+/).filter(w => w.length > 0).length;
        const lines = text.split('\n').length;
        
        alert(`📊 Štatistiky\n\nSlová: ${words}\nRiadky: ${lines}\nSekcie: ${sections.length}`);
    },

    /**
     * Show about
     */
    showAbout() {
        alert(`ℹ️ LBS Live Server v${App.version}\n\nLyrical Blueprint System\nEvent-driven architecture\n© 2025`);
    },

    /**
     * Escape HTML
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    /**
     * Destroy toolbar
     */
    destroy() {
        if (this.el) {
            this.el.innerHTML = '';
        }
        this.dropdowns.clear();
    }
};

export default Toolbar;
