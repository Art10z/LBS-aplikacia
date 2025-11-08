
import { PROJECT_KEY_PREFIX, PALETTE_MAX_ITEMS } from './constants.js';
import * as Storage from './storage.js';

// =================================================================================
// MODEL ("The Brain" / "Mozog")
// Manages the application's data structure and state logic.
// It is completely independent of the user interface.
// =================================================================================
const Model = {
    state: {
        trackData: [],
        paletteItems: [],
        nextId: 0
    },

    init() {
        this.state.trackData = [];
        this.state.paletteItems = [];
        this.state.nextId = 1;
    },
    
    setData(projectData) {
        this.state.trackData = (projectData && projectData.trackData) || [];
        this.state.paletteItems = (projectData && projectData.paletteItems) || [];
        this._recalculateNextId(); // Recalculate only once on data load
        this._recalculateLabels();
    },

    addSection() {
        const newSection = {
            id: `section-${this.state.nextId++}`,
            type: 'Verse',
            label: '', // Label sa nastaví v _recalculateLabels
            bars: [{ id: `bar-${this.state.nextId++}`, text: '' }]
        };
        this.state.trackData.push(newSection);
        this._recalculateLabels();
        return newSection;
    },

    removeSection(sectionId) {
        this.state.trackData = this.state.trackData.filter(s => s.id !== sectionId);
        this._recalculateLabels();
    },

    addBarToSection(sectionId) {
        const section = this.state.trackData.find(s => s.id === sectionId);
        if (section) {
            const newBar = { id: `bar-${this.state.nextId++}`, text: '' };
            section.bars.push(newBar);
            return newBar;
        }
        return null;
    },

    removeBar(sectionId, barId) {
        const section = this.state.trackData.find(s => s.id === sectionId);
        if (section) {
            section.bars = section.bars.filter(b => b.id !== barId);
        }
    },

    updateBarText(sectionId, barId, newText) {
        const section = this.state.trackData.find(s => s.id === sectionId);
        const bar = section?.bars.find(b => b.id === barId);
        if (bar) bar.text = newText;
    },

    updateSectionType(sectionId, newType) {
        const section = this.state.trackData.find(s => s.id === sectionId);
        if (section) {
            section.type = newType;
            this._recalculateLabels();
        }
    },
    
    addPaletteItem(text) {
        if (!text || text.trim() === '') return null;
        const newItem = {
            id: `palette-${this.state.nextId++}`,
            text: text.trim()
        };
        this.state.paletteItems.unshift(newItem);
        this._enforcePaletteCap();
        return newItem;
    },

    addMultiplePaletteItems(textsArray) {
        if (!textsArray || textsArray.length === 0) return [];

        const newItems = [];
        const existingTexts = new Set(this.state.paletteItems.map(item => item.text.toLowerCase()));

        textsArray.forEach(text => {
            const trimmedText = text.trim();
            if (trimmedText && !existingTexts.has(trimmedText.toLowerCase())) {
                const newItem = {
                    id: `palette-${this.state.nextId++}`,
                    text: trimmedText
                };
                this.state.paletteItems.unshift(newItem);
                newItems.push(newItem);
                existingTexts.add(trimmedText.toLowerCase());
            }
        });

        this._enforcePaletteCap();

        return newItems;
    },

    removePaletteItem(itemId) {
        this.state.paletteItems = this.state.paletteItems.filter(item => item.id !== itemId);
    },

    clearPalette() {
        this.state.paletteItems = [];
    },
    
    moveBar(barId, oldSectionId, newSectionId, newIndex) {
        const oldSection = this.state.trackData.find(s => s.id === oldSectionId);
        let barToMove;
        if(oldSection) {
            const barIndex = oldSection.bars.findIndex(b => b.id === barId);
            if(barIndex > -1) { [barToMove] = oldSection.bars.splice(barIndex, 1); }
        }
        if(barToMove) {
            const newSection = this.state.trackData.find(s => s.id === newSectionId);
            if(newSection) newSection.bars.splice(newIndex, 0, barToMove);
        }
    },

    moveSection(sectionId, newIndex) {
        const sectionIndex = this.state.trackData.findIndex(s => s.id === sectionId);
        if (sectionIndex === -1) return;
        const [sectionToMove] = this.state.trackData.splice(sectionIndex, 1);
        this.state.trackData.splice(newIndex, 0, sectionToMove);
        this._recalculateLabels();
    },

    _recalculateLabels() {
        this.state.trackData.forEach(section => {
            section.label = section.type;
        });
    },

    _recalculateNextId() {
        let maxId = 0;
        const extractIdNum = (id) => {
            const num = parseInt(id.split('-')[1]);
            return isNaN(num) ? 0 : num;
        };

        this.state.trackData.forEach(section => {
            maxId = Math.max(maxId, extractIdNum(section.id));
            section.bars.forEach(bar => {
                maxId = Math.max(maxId, extractIdNum(bar.id));
            });
        });

        this.state.paletteItems.forEach(item => {
             maxId = Math.max(maxId, extractIdNum(item.id));
        });

        this.state.nextId = maxId + 1;
    },

    saveProject(projectName) {
        if (!projectName) return false;
        const projectData = { trackData: this.state.trackData, paletteItems: this.state.paletteItems };
        Storage.saveProject(projectName, projectData);
        return true;
    },

    loadProject(projectName) {
        const data = Storage.loadProject(projectName);
        if (data) { this.setData(data); return true; }
        return false;
    },

    deleteProject(projectName) { Storage.deleteProject(projectName); },

    renameProject(oldName, newName) { return Storage.renameProject(oldName, newName); },

    getProjectList() { return Storage.listProjects(); },

    // Enforce palette cap after adding items
    _enforcePaletteCap() {
        if (this.state.paletteItems.length > PALETTE_MAX_ITEMS) {
            this.state.paletteItems = this.state.paletteItems.slice(0, PALETTE_MAX_ITEMS);
        }
    }
};

export default Model;
