/**
 * LBS v5.0 - STATE MANAGEMENT
 * Centralized reactive state with change notifications
 * @module core/state
 */

import { bus } from './app.js';

// ================================
// STATE
// ================================

const state = {
    // Projects
    projects: [],
    activeProject: null,
    projectData: { sections: [] },
    
    // Research & Analysis
    research: '',
    
    // UI State
    activePanel: 'importer', // importer, canvas, research, analysis
    
    // Temp/Working State
    sourceText: '',
    isDirty: false,
    lastSaved: null,
    
    // Settings
    settings: {
        autoSave: true,
        autoSaveDelay: 2000,
        theme: 'dark'
    }
};

// Track subscribers for specific keys
const subscribers = new Map();

// ================================
// STATE API
// ================================

export const State = {
    /**
     * Get state value
     */
    get(key) {
        if (key === undefined) {
            return { ...state };
        }
        return state[key];
    },

    /**
     * Update state
     */
    update(changes) {
        const changedKeys = [];
        const oldValues = {};

        for (const [key, value] of Object.entries(changes)) {
            if (state[key] !== value) {
                oldValues[key] = state[key];
                state[key] = value;
                changedKeys.push(key);
            }
        }

        if (changedKeys.length > 0) {
            // Mark as dirty if project data changed
            if (changedKeys.includes('projectData') || changedKeys.includes('research')) {
                state.isDirty = true;
            }

            // Notify global listeners
            bus.emit('state:changed', { changes, changedKeys, oldValues });

            // Notify key-specific subscribers
            changedKeys.forEach(key => {
                if (subscribers.has(key)) {
                    subscribers.get(key).forEach(callback => {
                        try {
                            callback(state[key], oldValues[key]);
                        } catch (error) {
                            console.error(`State subscriber error for "${key}":`, error);
                        }
                    });
                }
            });
        }

        return this;
    },

    /**
     * Subscribe to specific key changes
     */
    subscribe(key, callback) {
        if (!subscribers.has(key)) {
            subscribers.set(key, new Set());
        }
        subscribers.get(key).add(callback);

        // Return unsubscribe function
        return () => {
            const keySubscribers = subscribers.get(key);
            if (keySubscribers) {
                keySubscribers.delete(callback);
            }
        };
    },

    /**
     * Mark as saved
     */
    markSaved() {
        state.isDirty = false;
        state.lastSaved = Date.now();
        bus.emit('state:saved');
    },

    /**
     * Mark as dirty
     */
    markDirty() {
        state.isDirty = true;
        bus.emit('state:dirty');
    },

    /**
     * Get project sections
     */
    getSections() {
        return state.projectData?.sections || [];
    },

    /**
     * Update project sections
     */
    updateSections(sections) {
        this.update({
            projectData: {
                ...state.projectData,
                sections
            }
        });
    },

    /**
     * Add section
     */
    addSection(section) {
        const sections = this.getSections();
        sections.push(section);
        this.updateSections(sections);
    },

    /**
     * Remove section
     */
    removeSection(sectionId) {
        const sections = this.getSections().filter(s => s.id !== sectionId);
        this.updateSections(sections);
    },

    /**
     * Update section
     */
    updateSection(sectionId, updates) {
        const sections = this.getSections().map(s => 
            s.id === sectionId ? { ...s, ...updates } : s
        );
        this.updateSections(sections);
    },

    /**
     * Reorder sections
     */
    reorderSections(fromIndex, toIndex) {
        const sections = [...this.getSections()];
        const [moved] = sections.splice(fromIndex, 1);
        sections.splice(toIndex, 0, moved);
        this.updateSections(sections);
    },

    /**
     * Update research
     */
    updateResearch(text) {
        this.update({ research: text });
    },

    /**
     * Update source text
     */
    updateSourceText(text) {
        this.update({ sourceText: text });
    },

    /**
     * Switch active panel
     */
    setActivePanel(panel) {
        this.update({ activePanel: panel });
    },

    /**
     * Get setting
     */
    getSetting(key) {
        return state.settings[key];
    },

    /**
     * Update setting
     */
    updateSetting(key, value) {
        this.update({
            settings: {
                ...state.settings,
                [key]: value
            }
        });
    },

    /**
     * Reset state (for testing)
     */
    reset() {
        Object.keys(state).forEach(key => {
            if (key === 'settings') {
                state[key] = {
                    autoSave: true,
                    autoSaveDelay: 2000,
                    theme: 'dark'
                };
            } else if (key === 'projectData') {
                state[key] = { sections: [] };
            } else if (Array.isArray(state[key])) {
                state[key] = [];
            } else if (typeof state[key] === 'string') {
                state[key] = '';
            } else if (typeof state[key] === 'boolean') {
                state[key] = false;
            } else {
                state[key] = null;
            }
        });
        
        subscribers.clear();
        bus.emit('state:reset');
    },

    /**
     * Debug: dump current state
     */
    dump() {
        console.log('📊 Current State:', JSON.parse(JSON.stringify(state)));
        console.log('👂 Subscribers:', Array.from(subscribers.keys()));
    }
};

export default State;
