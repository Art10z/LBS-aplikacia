
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
        promptStyle: '',
        nextId: 0
    },

    init() {
        this.state.trackData = [];
        this.state.paletteItems = [];
        this.state.promptStyle = '';
        this.state.nextId = 1;
    },

    setData(projectData) {
        this.state.trackData = (projectData && projectData.trackData) || [];
        this.state.paletteItems = (projectData && projectData.paletteItems) || [];
        this.state.promptStyle = (projectData && projectData.promptStyle) || '';
        this._recalculateNextId();
    },

    addSection() {
        const newSection = {
            id: `section-${this.state.nextId++}`,
            type: 'Verse',
            bars: [{ id: `bar-${this.state.nextId++}`, words: [] }]
        };
        this.state.trackData.push(newSection);
        return newSection;
    },

    removeSection(sectionId) {
        this.state.trackData = this.state.trackData.filter(s => s.id !== sectionId);
    },

    addBarToSection(sectionId) {
        const section = this.state.trackData.find(s => s.id === sectionId);
        if (section) {
            const newBar = { id: `bar-${this.state.nextId++}`, words: [] };
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

    // === WORD CHIP METHODS ===

    // Helper: text -> words array
    _textToWords(text) {
        if (!text || !text.trim()) return [];
        return text.split(/\s+/)
            .map(w => w.trim())
            .filter(w => w.length > 0)
            .map(w => ({
                id: `word-${this.state.nextId++}`,
                text: w
            }));
    },

    // Get bar as plain text
    getBarAsText(sectionId, barId) {
        const section = this.state.trackData.find(s => s.id === sectionId);
        const bar = section?.bars.find(b => b.id === barId);
        if (!bar) return '';
        return (bar.words || []).map(w => w.text).join(' ');
    },

    // Add word to bar at specific position
    addWordToBar(sectionId, barId, wordText, index = -1) {
        const section = this.state.trackData.find(s => s.id === sectionId);
        const bar = section?.bars.find(b => b.id === barId);
        if (!bar) return null;

        if (!bar.words) bar.words = [];

        const text = wordText.trim();
        if (!text) return null;

        const newWord = { id: `word-${this.state.nextId++}`, text };

        if (index < 0 || index >= bar.words.length) {
            bar.words.push(newWord);
        } else {
            bar.words.splice(index, 0, newWord);
        }
        return newWord;
    },

    // Remove word from bar
    removeWordFromBar(sectionId, barId, wordId) {
        const section = this.state.trackData.find(s => s.id === sectionId);
        const bar = section?.bars.find(b => b.id === barId);
        if (bar && bar.words) {
            bar.words = bar.words.filter(w => w.id !== wordId);
        }
    },

    // Move word within or between bars
    moveWord(wordId, fromSectionId, fromBarId, toSectionId, toBarId, newIndex) {
        const fromSection = this.state.trackData.find(s => s.id === fromSectionId);
        const fromBar = fromSection?.bars.find(b => b.id === fromBarId);
        if (!fromBar || !fromBar.words) return;

        const wordIndex = fromBar.words.findIndex(w => w.id === wordId);
        if (wordIndex === -1) return;

        const [word] = fromBar.words.splice(wordIndex, 1);

        const toSection = this.state.trackData.find(s => s.id === toSectionId);
        const toBar = toSection?.bars.find(b => b.id === toBarId);
        if (!toBar) return;

        if (!toBar.words) toBar.words = [];

        if (newIndex < 0 || newIndex >= toBar.words.length) {
            toBar.words.push(word);
        } else {
            toBar.words.splice(newIndex, 0, word);
        }
    },

    // Update word text
    updateWordText(sectionId, barId, wordId, newText) {
        const section = this.state.trackData.find(s => s.id === sectionId);
        const bar = section?.bars.find(b => b.id === barId);
        const word = bar?.words?.find(w => w.id === wordId);
        if (word) {
            word.text = newText.trim();
        }
    },

    // === SECTION METHODS ===

    updateSectionType(sectionId, newType) {
        const section = this.state.trackData.find(s => s.id === sectionId);
        if (section) {
            section.type = newType;
        }
    },

    // === PALETTE METHODS ===

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

    // === MOVE METHODS ===

    moveBar(barId, oldSectionId, newSectionId, newIndex) {
        const oldSection = this.state.trackData.find(s => s.id === oldSectionId);
        let barToMove;
        if (oldSection) {
            const barIndex = oldSection.bars.findIndex(b => b.id === barId);
            if (barIndex > -1) { [barToMove] = oldSection.bars.splice(barIndex, 1); }
        }
        if (barToMove) {
            const newSection = this.state.trackData.find(s => s.id === newSectionId);
            if (newSection) newSection.bars.splice(newIndex, 0, barToMove);
        }
    },

    moveSection(sectionId, newIndex) {
        const sectionIndex = this.state.trackData.findIndex(s => s.id === sectionId);
        if (sectionIndex === -1) return;
        const [sectionToMove] = this.state.trackData.splice(sectionIndex, 1);
        this.state.trackData.splice(newIndex, 0, sectionToMove);
    },

    // === PROJECT METHODS ===

    saveProject(projectName) {
        if (!projectName) return false;
        const projectData = {
            trackData: this.state.trackData,
            paletteItems: this.state.paletteItems,
            promptStyle: this.state.promptStyle
        };
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

    // === PRIVATE HELPERS ===

    _recalculateNextId() {
        let maxId = 0;
        const extractIdNum = (id) => {
            const parts = id.split('-');
            const num = parseInt(parts[parts.length - 1]);
            return isNaN(num) ? 0 : num;
        };

        this.state.trackData.forEach(section => {
            maxId = Math.max(maxId, extractIdNum(section.id));
            section.bars.forEach(bar => {
                maxId = Math.max(maxId, extractIdNum(bar.id));
                (bar.words || []).forEach(word => {
                    maxId = Math.max(maxId, extractIdNum(word.id));
                });
            });
        });

        this.state.paletteItems.forEach(item => {
            maxId = Math.max(maxId, extractIdNum(item.id));
        });

        this.state.nextId = maxId + 1;
    },

    _enforcePaletteCap() {
        if (this.state.paletteItems.length > PALETTE_MAX_ITEMS) {
            this.state.paletteItems = this.state.paletteItems.slice(0, PALETTE_MAX_ITEMS);
        }
    }
};

export default Model;
