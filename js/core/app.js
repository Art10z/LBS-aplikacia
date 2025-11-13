/**
 * LBS v4.0 - APPLICATION CORE
 * Event-driven architecture with clean separation of concerns
 * @module core/app
 */

import { State } from './state.js';
import * as Storage from '../storage.js';

// ================================
// EVENT BUS
// ================================

class EventBus {
    constructor() {
        this.events = new Map();
    }

    on(event, callback) {
        if (!this.events.has(event)) {
            this.events.set(event, []);
        }
        this.events.get(event).push(callback);
        return () => this.off(event, callback);
    }

    off(event, callback) {
        if (!this.events.has(event)) return;
        const callbacks = this.events.get(event);
        const index = callbacks.indexOf(callback);
        if (index > -1) {
            callbacks.splice(index, 1);
        }
    }

    emit(event, data) {
        if (!this.events.has(event)) return;
        this.events.get(event).forEach(callback => {
            try {
                callback(data);
            } catch (error) {
                console.error(`Event handler error for "${event}":`, error);
            }
        });
    }

    clear(event) {
        if (event) {
            this.events.delete(event);
        } else {
            this.events.clear();
        }
    }
}

export const bus = new EventBus();

// ================================
// APPLICATION
// ================================

export const App = {
    version: '5.0',
    initialized: false,
    components: new Map(),

    /**
     * Initialize application
     */
    async init() {
        if (this.initialized) {
            console.warn('App already initialized');
            return;
        }

        console.log(`🚀 Initializing LBS v${this.version}...`);

        try {
            // 1. Initialize Storage
            Storage.init();
            
            // 2. Load State
            await this.loadState();
            
            // 3. Register core event handlers
            this.registerCoreHandlers();
            
            // 4. Initialize components (will be loaded by main.js)
            console.log('✅ Core initialized');
            
            this.initialized = true;
            bus.emit('app:ready');
            
        } catch (error) {
            console.error('❌ App initialization failed:', error);
            this.handleError(error);
        }
    },

    /**
     * Load application state from storage
     */
    async loadState() {
        const projects = Storage.listProjects();
        const activeProject = Storage.getActive() || (projects[0] || null);
        
        State.update({
            projects,
            activeProject,
            projectData: activeProject ? Storage.loadProject(activeProject) : { sections: [] },
            research: activeProject ? Storage.loadResearch(activeProject) : ''
        });

        console.log(`📦 Loaded state: ${projects.length} projects, active: ${activeProject}`);
    },

    /**
     * Register core event handlers
     */
    registerCoreHandlers() {
        // Auto-save on state changes
        bus.on('state:changed', (changes) => {
            if (changes.projectData && State.get('activeProject')) {
                this.autoSave();
            }
        });

        // Project switching
        bus.on('project:switch', (projectName) => {
            this.loadProject(projectName);
        });

        // Project creation
        bus.on('project:create', (projectName) => {
            this.createProject(projectName);
        });

        // Project deletion
        bus.on('project:delete', (projectName) => {
            this.deleteProject(projectName);
        });

        // Export
        bus.on('export:all', () => {
            this.exportAll();
        });

        console.log('✅ Core handlers registered');
    },

    /**
     * Register a component
     */
    registerComponent(name, component) {
        if (this.components.has(name)) {
            console.warn(`Component "${name}" already registered`);
        }
        this.components.set(name, component);
        console.log(`✅ Component registered: ${name}`);
    },

    /**
     * Get a component
     */
    getComponent(name) {
        return this.components.get(name);
    },

    /**
     * Load a project
     */
    loadProject(projectName) {
        if (!projectName) return;

        const data = Storage.loadProject(projectName);
        const research = Storage.loadResearch(projectName);

        State.update({
            activeProject: projectName,
            projectData: data || { sections: [] },
            research: research || ''
        });

        Storage.setActive(projectName);
        bus.emit('project:loaded', projectName);
        console.log(`📂 Loaded project: ${projectName}`);
    },

    /**
     * Create a new project
     */
    createProject(projectName) {
        if (!projectName || !projectName.trim()) {
            console.warn('Invalid project name');
            return false;
        }

        projectName = projectName.trim();
        const projects = State.get('projects');

        if (projects.includes(projectName)) {
            console.warn(`Project "${projectName}" already exists`);
            return false;
        }

        // Save empty project
        Storage.saveProject(projectName, { sections: [] });
        
        // Update state
        State.update({
            projects: [...projects, projectName],
            activeProject: projectName,
            projectData: { sections: [] },
            research: ''
        });

        Storage.setActive(projectName);
        bus.emit('project:created', projectName);
        console.log(`✨ Created project: ${projectName}`);
        
        return true;
    },

    /**
     * Delete a project
     */
    deleteProject(projectName) {
        if (!projectName) return false;

        Storage.deleteProject(projectName);
        
        const projects = State.get('projects').filter(p => p !== projectName);
        const activeProject = State.get('activeProject');
        
        // If deleted project was active, switch to another
        let newActive = activeProject;
        if (activeProject === projectName) {
            newActive = projects[0] || null;
        }

        State.update({
            projects,
            activeProject: newActive,
            projectData: newActive ? Storage.loadProject(newActive) : { sections: [] },
            research: newActive ? Storage.loadResearch(newActive) : ''
        });

        if (newActive) {
            Storage.setActive(newActive);
        }

        bus.emit('project:deleted', projectName);
        console.log(`🗑️ Deleted project: ${projectName}`);
        
        return true;
    },

    /**
     * Auto-save current project
     */
    autoSave() {
        const projectName = State.get('activeProject');
        if (!projectName) return;

        const data = State.get('projectData');
        const research = State.get('research');

        Storage.saveProject(projectName, data);
        Storage.saveResearch(projectName, research);

        bus.emit('app:saved', projectName);
    },

    /**
     * Export all data
     */
    exportAll() {
        const data = Storage.exportAll();
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `lbs-backup-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
        
        bus.emit('export:completed');
        console.log('💾 Export completed');
    },

    /**
     * Handle errors
     */
    handleError(error) {
        console.error('App Error:', error);
        bus.emit('app:error', error);
        
        // Show user-friendly error
        const message = error.message || 'An error occurred';
        this.showNotification(message, 'error');
    },

    /**
     * Show notification
     */
    showNotification(message, type = 'info') {
        bus.emit('notification:show', { message, type });
    }
};

// ================================
// EXPORTS
// ================================

export default App;
