
import Model from './model.js';
import View from './view.js';
import { MAX_BAR_LENGTH } from './constants.js';
import * as Storage from './storage.js';
import { showNotification, debounce, showLoading, hideLoading } from './utils.js';
import { RhymeAnalyzer } from './rhymeAnalyzer.js';

// =================================================================================
// CONTROLLER ("The Conductor" / "Dirigent")
// Orchestrates the application. It listens for user events, tells the Model
// to update its state, and then tells the View what to re-render.
// =================================================================================
const Controller = {
    draggedItem: null,
    isDirty: false,
    debouncedSave: null,
    projects: [],
    activeProjectName: null,
    MAX_PROJECTS: 5,
    singleProjectMode: false,
    _hlTimer: null,
    _hlScrollBound: new WeakSet(),
    _hlRAF: new WeakMap(),
    highlightEnabled: true,
    highlightResearchEnabled: true,
    _uaOverlay: null,
    analysisSource: 'canvas',
    // Unicode regex capability detection (for fallback patterns)
    _hasUnicodeProps: (() => { try { new RegExp('\\p{L}', 'u'); return true; } catch { return false; } })(),

    init() {
        View.init();
        this.debouncedSave = debounce(() => this._performAutoSave(), 1500);
        this._attachEventListeners();
        Storage.init();
        // Detect preferred project from global variable or URL and enable single-project mode if present
        const preferred = this._readProjectFromURL();
        if (preferred) this.singleProjectMode = true;
        this._initializeSession(preferred);
        this._loadResearchForActive();
        this._initHighlightToggle();
        this._initResearchHighlightToggle();
        this._initSourceImporterHighlight();
        
        // Inicializuj nové funkcie po načítaní DOM
        setTimeout(() => {
            this.enhanceTextImporter();
            this.initProjectComparator();
        }, 500);
    },

    _readProjectFromURL() {
        try {
            // Highest priority: explicit global set by launcher page
            if (typeof window !== 'undefined' && window.PROJECT_NAME && String(window.PROJECT_NAME).trim()) {
                return String(window.PROJECT_NAME).trim();
            }
            const url = new URL(window.location.href);
            const p = url.searchParams.get('project') || url.searchParams.get('p');
            if (p && p.trim()) return decodeURIComponent(p.trim());
            // Support hash format like #p=Projekt%201
            if (url.hash) {
                const hash = url.hash.replace(/^#/, '');
                const params = new URLSearchParams(hash);
                const hp = params.get('project') || params.get('p');
                if (hp && hp.trim()) return decodeURIComponent(hp.trim());
            }
        } catch (e) { /* ignore */ }
        return null;
    },

    _attachEventListeners() {
        if (View.dom.refreshProjectBtn) {
            View.dom.refreshProjectBtn.addEventListener('click', () => this._forceRefreshFromImporter());
        }
        if (View.dom.syncImporterBtn) {
            View.dom.syncImporterBtn.addEventListener('click', () => this._syncImporterFromCanvas());
        }
        if (View.dom.addSectionBtn) {
            View.dom.addSectionBtn.addEventListener('click', () => this._addSection());
        }
        if (View.dom.updateMaketaBtn) {
            View.dom.updateMaketaBtn.addEventListener('click', () => View.renderMaketa(Model.state.trackData));
        }
        if (View.dom.copyBtn) {
            View.dom.copyBtn.addEventListener('click', () => this._copyMaketa());
        }
        if (View.dom.saveAsTxtBtn) {
            View.dom.saveAsTxtBtn.addEventListener('click', () => this._saveMaketaAsTxt()); // PRIDANÝ RIADOK
        }
        
        if (View.dom.templateInserter) {
            View.dom.templateInserter.addEventListener('click', (e) => this._handleTagButtonClick(e));
        }
        if (View.dom.addTemplateTagBtn) {
            View.dom.addTemplateTagBtn.addEventListener('click', () => this._insertTextAtCursor(View.dom.sourceInput, '[ Značka ]'));
        }
        
        // Source input (Importér) - add highlighting for duplicates
        if (View.dom.sourceInput) {
            View.dom.sourceInput.addEventListener('input', () => {
                try {
                    this._scheduleTAHighlight(View.dom.sourceInput);
                } catch (e) { /* ignore */ }
            });
        }
        
        document.addEventListener('keydown', e => this._handleGlobalKeyDown(e));

        if (View.dom.assemblerContent) {
            View.dom.assemblerContent.addEventListener('input', e => this._handleCanvasInput(e));
            View.dom.assemblerContent.addEventListener('focusout', e => this._handleCanvasBlur(e));
            View.dom.assemblerContent.addEventListener('click', e => this._handleCanvasClick(e));
            View.dom.assemblerContent.addEventListener('keydown', e => this._handleBarKeydown(e));
            View.dom.assemblerContent.addEventListener('paste', e => this._handleBarPaste(e));
            View.dom.assemblerContent.addEventListener('dragstart', e => this._handleDragStart(e));
            View.dom.assemblerContent.addEventListener('dragover', e => this._handleDragOver(e)); // --- ZMENA ---
            View.dom.assemblerContent.addEventListener('drop', e => this._handleDrop(e));
            View.dom.assemblerContent.addEventListener('dragend', () => this._handleDragEnd());
        }

        if (View.dom.openUnifiedBtn) {
            View.dom.openUnifiedBtn.addEventListener('click', () => {
                View.dom.unifiedOverlay.classList.remove('hidden');
                // Default to Research tab
                this._switchTab('research');
            });
        }
        if (View.dom.closeUnifiedBtn) {
            View.dom.closeUnifiedBtn.addEventListener('click', () => View.dom.unifiedOverlay.classList.add('hidden'));
        }
        
        // Tab switching
        if (View.dom.researchTabBtn) {
            View.dom.researchTabBtn.addEventListener('click', () => this._switchTab('research'));
        }
        if (View.dom.analysisTabBtn) {
            View.dom.analysisTabBtn.addEventListener('click', () => this._switchTab('analysis'));
        }
        if (View.dom.researchInput) {
            View.dom.researchInput.addEventListener('input', () => {
                this._saveResearch();
                try {
                    if (this.highlightResearchEnabled) this._scheduleTAHighlight(View.dom.researchInput);
                } catch (e) { /* ignore */ }
            });
        }
        if (View.dom.addToPaletteBtn) {
            View.dom.addToPaletteBtn.addEventListener('click', () => this._addSelectedTextToPalette());
        }
        if (View.dom.analyzeRhymesBtn) {
            View.dom.analyzeRhymesBtn.addEventListener('click', () => this._analyzeRhymes());
        }
        if (View.dom.resetRhymesBtn) {
            View.dom.resetRhymesBtn.addEventListener('click', () => this._resetRhymes());
        }
        if (View.dom.resetRhymesMainBtn) {
            View.dom.resetRhymesMainBtn.addEventListener('click', () => this._resetRhymes());
        }
        if (View.dom.exportAllBtn) {
            View.dom.exportAllBtn.addEventListener('click', () => this._exportAll());
        }
        if (View.dom.toggleHighlightBtn) {
            View.dom.toggleHighlightBtn.addEventListener('click', () => this._toggleHighlight());
        }
        if (View.dom.toggleResearchHighlightBtn) {
            View.dom.toggleResearchHighlightBtn.addEventListener('click', () => this._toggleResearchHighlight());
        }
        
        if (View.dom.inspirationPalette) {
            View.dom.inspirationPalette.addEventListener('click', e => this._handlePaletteClick(e));
        }
        // removed duplicate binding of resetRhymesMainBtn

        if (View.dom.projectTabsContainer) {
            View.dom.projectTabsContainer.addEventListener('click', e => this._handleTabsClick(e));
            View.dom.projectTabsContainer.addEventListener('dblclick', e => this._handleTabDoubleClick(e));
            View.dom.projectTabsContainer.addEventListener('focusout', e => this._handleTabBlur(e));
            View.dom.projectTabsContainer.addEventListener('keydown', e => this._handleTabKeyDown(e));
        }
    },

    _handleGlobalKeyDown(e) {
        if (e.ctrlKey && e.key === 's') {
            e.preventDefault();
            this._performManualSave();
        }
        if (e.key === 'Escape') {
            // Close unified overlay
            if (View.dom.unifiedOverlay && !View.dom.unifiedOverlay.classList.contains('hidden')) {
                View.dom.unifiedOverlay.classList.add('hidden');
            }
        }
    },
    
    _switchTab(tabName) {
        // Switch between 'research' and 'analysis' tabs
        const tabs = { research: View.dom.researchTab, analysis: View.dom.analysisTab };
        const buttons = { research: View.dom.researchTabBtn, analysis: View.dom.analysisTabBtn };
        
        // Hide all tabs and deactivate buttons
        Object.values(tabs).forEach(tab => tab && tab.classList.remove('active'));
        Object.values(buttons).forEach(btn => btn && btn.classList.remove('active'));
        
        // Show selected tab and activate button
        if (tabs[tabName]) tabs[tabName].classList.add('active');
        if (buttons[tabName]) buttons[tabName].classList.add('active');
    },
    
    _markAsDirty() {
        if (!this.isDirty) {
            this.isDirty = true;
            View.updateSaveStatus('unsaved');
        }
        this.debouncedSave();
    },

    _performAutoSave() {
        if (!this.isDirty || !this.activeProjectName) return;
        View.updateSaveStatus('saving');
        setTimeout(() => {
            Model.saveProject(this.activeProjectName);
            this.isDirty = false;
            View.updateSaveStatus('saved');
        }, 300);
    },

    _performManualSave() {
        if (!this.activeProjectName) return;
        // Cancel any pending auto-save
        if (this.debouncedSave && this.debouncedSave.cancel) {
            this.debouncedSave.cancel();
        }
        
        View.updateSaveStatus('saving');
        Model.saveProject(this.activeProjectName);
        this.isDirty = false;
        
        setTimeout(() => {
             View.updateSaveStatus('saved');
             showNotification('Projekt uložený!');
        }, 150); // Short delay for user feedback
    },

    // removed legacy _processSourceText (duplicate of refresh)

    // Prepíše plátno okamžite podľa aktuálneho textu v importéri (bez potvrdenia)
    _forceRefreshFromImporter() {
        const raw = View.dom.sourceInput.value;
        if (!raw.trim()) {
            showNotification('Importér je prázdny – nič na aktualizáciu.', 'warning');
            return;
        }
        showLoading('Aktualizujem plátno…');
        const newTrackData = this._parseImporterText(raw);
        if (newTrackData.length === 0) {
            hideLoading();
            showNotification('Žiadne použiteľné riadky.', 'warning');
            return;
        }
        Model.setData({ trackData: newTrackData, paletteItems: Model.state.paletteItems });
        this._updateCanvasAndMaketa();
        this._markAsDirty();
        hideLoading();
        showNotification('Projekt bol aktualizovaný z importéru.');
    },

    // Zapíše späť do importéra aktuálnu štruktúru z plátna – zjednoduší cyklus úpravy
    _syncImporterFromCanvas() {
        if (Model.state.trackData.length === 0) {
            showNotification('Plátno je prázdne – nič na synchronizáciu.', 'warning');
            return;
        }
        const lines = [];
        Model.state.trackData.forEach(section => {
            lines.push(`[${section.type}]`);
            section.bars.forEach(bar => {
                const txt = (bar.text || '').trim();
                if (txt) lines.push(txt); else lines.push('');
            });
        });
        View.dom.sourceInput.value = lines.join('\n');
        showNotification('Importér bol aktualizovaný z plátna.');
    },
    
    // removed legacy _performTextProcessing (now using _forceRefreshFromImporter + _parseImporterText)

    // Jednotná logika parsovania importéra -> trackData (odstránená duplicita)
    _parseImporterText(raw) {
        const lines = raw.split('\n').map(line => line.trim()).filter(line => line !== '');
        const newTrackData = [];
        let currentSection = null;

        lines.forEach(line => {
            const sectionMatch = line.match(/^\[\s*(.+?)\s*\]$/);
            if (sectionMatch) {
                const sectionName = sectionMatch[1].trim();
                currentSection = {
                    id: `temp-section-${newTrackData.length}`,
                    type: sectionName,
                    label: '',
                    bars: []
                };
                newTrackData.push(currentSection);
            } else if (currentSection) {
                currentSection.bars.push({
                    id: `temp-bar-${currentSection.bars.length}`,
                    text: line.substring(0, MAX_BAR_LENGTH)
                });
            }
        });
        return newTrackData;
    },
    
    _addSection() {
        if (!this.activeProjectName) return;
        const newSection = Model.addSection();
        View.addSectionToDOM(newSection);
        this._markAsDirty();
    },
    
    _copyMaketa() {
        navigator.clipboard.writeText(View.dom.maketaOutput.textContent)
            .then(() => showNotification('Text skopírovaný!'))
            .catch(() => showNotification('Kopírovanie zlyhalo', 'danger'));
    },

    // --- PRIDANÁ NOVÁ FUNKCIA ---
    _saveMaketaAsTxt() {
        const textToSave = View.dom.maketaOutput.textContent;
        if (!textToSave.trim()) {
            showNotification('Maketa je prázdna, nie je čo uložiť.', 'danger');
            return;
        }
    
        // Vytvor 'blob' (dátový objekt)
        const blob = new Blob([textToSave], { type: 'text/plain;charset=utf-8' });
    
        // Vytvor dočasný <a> odkaz
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        
        // Názov súboru bude podľa aktívneho projektu
        const fileName = this.activeProjectName 
            ? `${this.activeProjectName.replace(/ /g, '_')}.txt` 
            : 'moj_text.txt';
        link.download = fileName;
    
        // Simuluj kliknutie na stiahnutie
        document.body.appendChild(link);
        link.click();
        
        // Uprac po sebe
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
        
        showNotification(`Súbor "${fileName}" sa sťahuje.`);
    },
    // --- KONIEC PRIDANEJ FUNKCIE ---

    _handleTagButtonClick(e) {
        if (e.target.classList.contains('template-tag-btn')) {
            const template = e.target.dataset.template;
            this._insertTextAtCursor(View.dom.sourceInput, template);
        }
    },

    _insertTextAtCursor(textarea, textToInsert) {
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const text = textarea.value;
        let before = text.substring(0, start);
        const after = text.substring(end);
        if (before.length > 0 && !before.endsWith('\n')) before += '\n';
        textarea.value = before + textToInsert + '\n' + after;
        const newCursorPos = (before + textToInsert + '\n').length;
        textarea.focus();
        textarea.setSelectionRange(newCursorPos, newCursorPos);
    },

    _handleCanvasInput(e) {
        if (e.target.classList.contains('bar-input')) {
            this._markAsDirty();
            if (e.target.value.includes('\n')) {
                e.target.value = e.target.value.replace(/\r?\n/g, ' ');
            }
            const counter = e.target.nextElementSibling;
            if(counter?.classList.contains('char-counter')) {
                counter.textContent = `${e.target.value.length}/${MAX_BAR_LENGTH}`;
            }
            try { if (this.highlightEnabled) this._scheduleTAHighlight(e.target); } catch (e) { /* ignore */ }
        }
    },
    _handleBarKeydown(e) {
        if (!e.target.classList || !e.target.classList.contains('bar-input')) return;
        if (e.key === 'Enter') {
            e.preventDefault();
        }
    },
    _handleBarPaste(e) {
        if (!e.target.classList || !e.target.classList.contains('bar-input')) return;
        e.preventDefault();
        const ta = e.target;
        const data = (e.clipboardData || window.clipboardData)?.getData('text') || '';
        const sanitized = data.replace(/\r?\n/g, ' ');
        const start = ta.selectionStart ?? ta.value.length;
        const end = ta.selectionEnd ?? ta.value.length;
        const before = ta.value.slice(0, start);
        const after = ta.value.slice(end);
        const allowed = Math.max(0, MAX_BAR_LENGTH - (before.length + after.length));
        const insert = sanitized.slice(0, allowed);
        ta.value = before + insert + after;
        const caret = before.length + insert.length;
        ta.setSelectionRange(caret, caret);
        this._markAsDirty();
        const counter = ta.nextElementSibling;
        if(counter?.classList.contains('char-counter')) {
            counter.textContent = `${ta.value.length}/${MAX_BAR_LENGTH}`;
        }
        try {
            if (this.highlightEnabled) {
                this._updateTextareaHighlight(ta);
                this._syncLayerScroll(ta);
            }
        } catch {}
    },

    _handleCanvasBlur(e) {
        if (e.target.classList.contains('bar-input')) {
            const barItem = e.target.closest('.bar-item');
            Model.updateBarText(barItem.dataset.sectionId, barItem.dataset.barId, e.target.value);
        } else if (e.target.classList.contains('section-type-input')) {
            const sectionContainer = e.target.closest('.section-container');
            const sectionId = sectionContainer.dataset.sectionId;
            const newType = e.target.value.trim();
            if (newType) {
                Model.updateSectionType(sectionId, newType);
                View.updateAllSectionLabelsInDOM(Model.state.trackData);
                this._markAsDirty();
            } else {
                const section = Model.state.trackData.find(s => s.id === sectionId);
                if (section) e.target.value = section.type;
            }
        }
    },
    
    _handleCanvasClick(e) {
        const target = e.target;
        
        const sectionContainer = target.closest('.section-container');
        if (!sectionContainer) return;
        const sectionId = sectionContainer.dataset.sectionId;

        if (target.closest('.add-bar-btn')) {
            const newBar = Model.addBarToSection(sectionId);
            if(newBar) {
               View.addBarToDOM(sectionId, newBar);
               this._markAsDirty();
            }
        } else if (target.closest('.remove-section-btn')) {
            View.showConfirmation('Naozaj chcete odstrániť túto sekciu?', () => {
                Model.removeSection(sectionId);
                View.removeSectionFromDOM(sectionId);
                View.updateAllSectionLabelsInDOM(Model.state.trackData);
                this._markAsDirty();
            });
        } else if (target.closest('.remove-bar-btn')) {
            const barItem = target.closest('.bar-item');
            Model.removeBar(sectionId, barItem.dataset.barId);
            View.removeBarFromDOM(barItem);
            this._markAsDirty();
        }
    },
    
    _addSelectedTextToPalette() {
        const { value, selectionStart, selectionEnd } = View.dom.researchInput;
        const selectedText = value.substring(selectionStart, selectionEnd);
        const newItem = Model.addPaletteItem(selectedText);
        if (newItem) {
            View.addPaletteItemToDOM(newItem);
            this._markAsDirty();
            showNotification('Položka pridaná do palety.');
        }
    },

    _handlePaletteClick(e) {
        const itemEl = e.target.closest('.palette-item');
        if (e.target.closest('.remove-palette-item-btn') && itemEl) {
            const itemId = itemEl.dataset.itemId;
            Model.removePaletteItem(itemId);
            View.removePaletteItemFromDOM(itemId);
            this._markAsDirty();
        }
    },

    _analyzeRhymes() {
        if (!this.activeProjectName) {
            showNotification('Žiadny aktívny projekt.', 'danger');
            return;
        }

        const researchText = View.dom.researchInput.value;
        if (!researchText.trim()) {
            showNotification('Výskumné pole je prázdne.', 'danger');
            return;
        }

        showNotification('Analyzujem text...', 'info');
        showLoading('Analyzujem rýmy…', 200);
        View.dom.analyzeRhymesBtn.disabled = true;
        try {
            const words = RhymeAnalyzer.extractWords(researchText);

            if (words.length === 0) {
                showNotification('Nenašli sa žiadne slová na analýzu.', 'danger');
                return; // V bloku 'finally' sa tlačidlo aj tak povolí
            }

            const rhymingWords = RhymeAnalyzer.findRhymes(words);

            if (rhymingWords.length === 0) {
                showNotification('Nenašli sa žiadne rýmy.', 'warning');
                return; // V bloku 'finally' sa tlačidlo aj tak povolí
            }

            const addedItems = Model.addMultiplePaletteItems(rhymingWords);
            if (addedItems.length > 0) {
                View.renderFullPalette(Model.state.paletteItems);
                this._markAsDirty();
                showNotification(`Pridaných ${addedItems.length} rýmových slov do palety.`);
            } else {
                showNotification('Všetky rýmy už sú v palete.', 'info');
            }

        } catch (error) {
            console.error('Error analyzing rhymes:', error);
            showNotification('Chyba pri analýze rýmov.', 'danger');
        } finally {
            View.dom.analyzeRhymesBtn.disabled = false;
            hideLoading();
        }
    },

    _resetRhymes() {
        View.showConfirmation('Naozaj chcete vymazať všetky analyzované rýmy (paletu inšpirácie)?', () => {
            Model.clearPalette();
            View.renderFullPalette(Model.state.paletteItems);
            this._markAsDirty();
            showNotification('Rýmy boli vymazané.');
        });
    },

    _exportAll() {
        try {
            showLoading('Exportujem projekty…', 200);
            const json = Storage.exportAll();
            const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            const dt = new Date();
            const ts = dt.toISOString().replace(/[:.]/g,'-');
            a.download = `lbs-backup-${ts}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(a.href);
            showNotification('Export dokončený.');
        } catch (e) {
            console.error(e);
            showNotification('Export zlyhal.', 'danger');
        } finally { hideLoading(); }
    },
    
    _initializeSession(preferredProjectName = null) {
        this.projects = Model.getProjectList();
        this.activeProjectName = Storage.getActive();

        if (this.projects.length === 0) {
            const defaultProjectName = "Projekt 1";
            this.projects.push(defaultProjectName);
            this.activeProjectName = defaultProjectName;
            Model.init();
            Model.saveProject(defaultProjectName);
        }

        // If URL requested a specific project, switch/create it
        if (preferredProjectName) {
            if (!this.projects.includes(preferredProjectName)) {
                if (this.projects.length < this.MAX_PROJECTS) {
                    this.projects.push(preferredProjectName);
                    Model.init();
                    Model.saveProject(preferredProjectName);
                } else {
                    showNotification('Nie je možné vytvoriť ďalší projekt (limit 5).', 'danger');
                }
            }
            if (this.projects.includes(preferredProjectName)) {
                this.activeProjectName = preferredProjectName;
            }
        }

        if (!this.activeProjectName || !this.projects.includes(this.activeProjectName)) {
            this.activeProjectName = this.projects.sort()[0];
        }

        // In single-project mode, restrict visible list to the active one
        if (this.singleProjectMode) {
            this.projects = [this.activeProjectName];
        }

        this._loadAndDisplayProject(this.activeProjectName);
    },

    _loadAndDisplayProject(projectName) {
        if (!projectName || !Model.loadProject(projectName)) {
            Model.init(); // Fallback to empty state
        }
        this.activeProjectName = projectName;
    Storage.setActive(projectName);
        this.isDirty = false;
        this._updateAllViews();
        // Ensure research textarea reflects the active project's research
        this._loadResearchForActive();
        View.updateSaveStatus('saved');
    },

    _updateAllViews() {
        View.renderProjectTabs(this.projects, this.activeProjectName, this.projects.length < this.MAX_PROJECTS, this.singleProjectMode);
        this._updateCanvasAndMaketa();
        View.renderFullPalette(Model.state.paletteItems);
        try { this._scheduleHighlights(); } catch (e) { /* ignore */ }
    },

    _updateCanvasAndMaketa() {
        View.renderInitialCanvas(Model.state.trackData);
        View.renderMaketa(Model.state.trackData);
        try { this._scheduleHighlights(); } catch (e) { /* ignore */ }
    },
    
    _saveResearch() { Storage.saveResearch(this.activeProjectName, View.dom.researchInput.value); },
    _loadResearchForActive() { 
        View.dom.researchInput.value = Storage.loadResearch(this.activeProjectName) || '';
        try { if (this.highlightResearchEnabled) this._scheduleTAHighlight(View.dom.researchInput); } catch (e) { /* ignore */ }
    },

    // DRAG & DROP LOGIC
    // --- ZMENENÁ FUNKCIA ---
    _handleDragStart(e) {
         // Ťahanie sa teraz začína len na elemente s "draggable=true", čo je náš úchyt
         const handle = e.target.closest('.bar-drag-handle, .section-drag-handle');
         
         // Ak ťahanie nezačalo na úchyte, ignorujeme to
         if (!handle) { 
             e.preventDefault();
             return; 
         }
            
        // Naďalej však pracujeme s rodičovským kontajnerom (bar alebo sekcia)
        this.draggedItem = handle.closest('.bar-item, .section-container');
        e.dataTransfer.effectAllowed = 'move';
        
        // Pridáme triedu na telo, aby sme mohli globálne štýlovať (napr. zmeniť kurzor)
        document.body.classList.add('is-dragging');
        
        setTimeout(() => {
            if (this.draggedItem) { // check if drag wasn't cancelled
                 this.draggedItem.classList.add('dragging');
            }
        }, 0);
    },
    // --- ZMENENÁ FUNKCIA ---
    _handleDragEnd() {
        this._removePlaceholder(); // Upraceme placeholder
        document.body.classList.remove('is-dragging'); // Odstránime globálnu triedu

        if (this.draggedItem) {
            this.draggedItem.classList.remove('dragging');
            this.draggedItem = null;
            
            // After a drop, the model is updated. We need to re-render the canvas
            // to reflect the new state accurately, especially for inter-section drops.
            // This prevents visual inconsistencies.
            View.renderInitialCanvas(Model.state.trackData); 
            View.updateAllSectionLabelsInDOM(Model.state.trackData);

            this._markAsDirty();
        }
    },
    // --- ZMENENÁ FUNKCIA ---
    _handleDrop(e) {
        e.preventDefault();
        this._removePlaceholder(); // Upraceme placeholder pred vložením

        if (!this.draggedItem) return;
        const isBar = this.draggedItem.classList.contains('bar-item');
        
        let targetContainer = null;
        let afterElement = null;
        let newIndex = 0;
        
        if (isBar) {
            const section = e.target.closest('.section-container');
            if (!section) return; // Bar nemôže ísť mimo sekcie
            
            targetContainer = section.querySelector('.bars-container');
            afterElement = this._getDragAfterElement(targetContainer, e.clientY, '.bar-item');
            newIndex = afterElement ? Array.from(targetContainer.children).indexOf(afterElement) : targetContainer.children.length;
            
            // Špeciálny prípad pre placeholder - ak je placeholder posledný, index musí byť upravený
            const placeholder = targetContainer.querySelector('.bar-drag-placeholder');
            if (placeholder && newIndex > 0) {
                 const placeholderIndex = Array.from(targetContainer.children).indexOf(placeholder);
                 if (placeholderIndex !== -1 && placeholderIndex < newIndex) {
                     newIndex--;
                 }
            }
            
            Model.moveBar(this.draggedItem.dataset.barId, this.draggedItem.dataset.sectionId, section.dataset.sectionId, newIndex);

        } else {
            targetContainer = View.dom.assemblerContent;
            afterElement = this._getDragAfterElement(targetContainer, e.clientY, '.section-container');
            newIndex = afterElement ? Array.from(targetContainer.children).indexOf(afterElement) : targetContainer.children.length;

            // Špeciálny prípad pre placeholder
            const placeholder = targetContainer.querySelector('.section-drag-placeholder');
             if (placeholder && newIndex > 0) {
                 const placeholderIndex = Array.from(targetContainer.children).indexOf(placeholder);
                 if (placeholderIndex !== -1 && placeholderIndex < newIndex) {
                     newIndex--;
                 }
            }
            
            Model.moveSection(this.draggedItem.dataset.sectionId, newIndex);
        }
    },
    _getDragAfterElement(container, y, selector) {
        const draggableElements = [...container.querySelectorAll(`${selector}:not(.dragging)`)];
        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            return (offset < 0 && offset > closest.offset) ? { offset: offset, element: child } : closest;
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    },

    // --- PRIDANÉ NOVÉ FUNKCIE PRE PLACEHOLDER ---
    
    _handleDragOver(e) {
        e.preventDefault();
        if (!this.draggedItem) return;

        const isBar = this.draggedItem.classList.contains('bar-item');
        const selector = isBar ? '.bar-item' : '.section-container';
        
        let container = null;
        let afterElement = null;

        if (isBar) {
            // Ak ťaháme bar, cieľom môže byť len kontajner barov v rámci sekcie
            const section = e.target.closest('.section-container');
            if (section) { 
                container = section.querySelector('.bars-container');
                afterElement = this._getDragAfterElement(container, e.clientY, selector);
            } else {
                // Sme mimo sekcie (napr. v medzere), bar nemôže ísť mimo sekcie
                this._removePlaceholder();
                return;
            }
        } else {
            // Ak ťaháme sekciu, cieľom je hlavný kontajner plátna
            container = e.target.closest('#assembler-content');
            if (container) {
                afterElement = this._getDragAfterElement(container, e.clientY, selector);
            } else {
                this._removePlaceholder();
                return;
            }
        }
        
        // Vykreslíme/presunieme placeholder
        if (container) {
            this._updatePlaceholder(container, afterElement, isBar);
        } else {
            this._removePlaceholder();
        }
    },

    /** Vytvorí alebo presunie vizuálny placeholder. */
    _updatePlaceholder(container, afterElement, isBar) {
        let placeholder = document.getElementById('drag-placeholder');
        if (!placeholder) {
            placeholder = document.createElement('div');
            placeholder.id = 'drag-placeholder';
        }
        // Priradíme správnú triedu podľa toho, čo ťaháme
        placeholder.className = isBar ? 'bar-drag-placeholder' : 'section-drag-placeholder';
    
        if (afterElement) {
            // Vložíme placeholder pred element, nad ktorým sme
            container.insertBefore(placeholder, afterElement);
        } else {
            // Sme na konci, vložíme placeholder na koniec kontajnera
            container.appendChild(placeholder);
        }
    },
    
    /** Odstráni vizuálny placeholder z DOMu. */
    _removePlaceholder() {
        const placeholder = document.getElementById('drag-placeholder');
        if (placeholder) {
            placeholder.remove();
        }
    },
    
    // --- KONIEC PRIDANÝCH FUNKCIÍ ---

    // ================= REPEATED WORDS HIGHLIGHT (PER TEXTAREA) =================
    _escapeHtml(s) {
        return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
    },
    _normalizeWord(w) { return w.toLocaleLowerCase(); },
    _getWordRegex() { return this._hasUnicodeProps ? /[\p{L}\p{N}]+/gu : /[A-Za-z0-9À-ÖØ-öø-ÿĀ-ž]+/g; },
    _getDupePairRegex() {
        return this._hasUnicodeProps
            ? /(\b(\p{L}+(?:['’\-]\p{L}+)*)\b)(\s+)(\2\b)/giu
            : /(\b([A-Za-zÀ-ÖØ-öø-ÿĀ-ž]+(?:['’\-][A-Za-zÀ-ÖØ-öø-ÿĀ-ž]+)*)\b)(\s+)(\2\b)/gi;
    },
    _buildWordFreqFor(text) {
        const freq = new Map();
        const re = this._getWordRegex();
        let m;
        while ((m = re.exec(text)) !== null) {
            const raw = m[0];
            if (raw.length < 2) continue;
            const key = this._normalizeWord(raw);
            freq.set(key, (freq.get(key) || 0) + 1);
        }
        return freq;
    },
    // Restored original frequency renderer for bar inputs (shows counts: dup2/dup3)
    _renderWithFreq(text, freq) {
        const re = this._getWordRegex();
        let out = '', last = 0, m;
        while ((m = re.exec(text)) !== null) {
            const start = m.index, end = start + m[0].length;
            if (start > last) out += `<span class=\"t\">${this._escapeHtml(text.slice(last, start))}</span>`;
            const key = this._normalizeWord(m[0]);
            const cnt = freq.get(key) || 0;
            if (cnt >= 3) out += `<span class=\"t dup3\">${this._escapeHtml(m[0])}</span>`;
            else if (cnt === 2) out += `<span class=\"t dup2\">${this._escapeHtml(m[0])}</span>`;
            else out += `<span class=\"t\">${this._escapeHtml(m[0])}</span>`;
            last = end;
        }
        if (last < text.length) out += `<span class=\"t\">${this._escapeHtml(text.slice(last))}</span>`;
        return out || '<span class=\"t\"></span>';
    },
    /**
     * UNIFIED DUPLICATE HIGHLIGHTING
     * Používa DuplicateHighlighter modul pre konzistentnú detekciu
     * Podporuje oba režimy: pair detection (word word) a all duplicates
     */
    _renderWithDupePairs(text, { ignoreBracketLines = false, mode = 'pairs' } = {}) {
        if (!text) return '<span class="t"></span>';

        // Ak DuplicateHighlighter nie je dostupný, použije sa fallback
        if (mode === 'all' && window.DuplicateHighlighter) {
            try {
                const highlighter = new window.DuplicateHighlighter();
                const duplicates = highlighter.findDuplicates(text);
                if (duplicates.length > 0) {
                    // Použije highlightInHTML ale s escape pre bezpečnosť
                    return highlighter.highlightInHTML(text, duplicates);
                }
            } catch (error) {
                console.warn('DuplicateHighlighter error, using fallback:', error);
            }
        }

        // FALLBACK: Pôvodná pair detection (word word)
        const lines = text.split('\n');
        const dupeRE = this._getDupePairRegex();
        const HEADING_WORDS = ['intro','verse','chorus','refrén','bridge','most','outro','pre-chorus','predrefrén','prechorus','tag','solo','interlude'];
        
        const isHeadingLine = (raw) => {
            const t = raw.trim();
            if (!t) return false;
            if (/^\[[^\]]+\]$/.test(t)) return true;
            const headingRe = this._hasUnicodeProps ? /^[\p{L}\p{N} .#\-]+:\s*$/u : /^[A-Za-z0-9À-ÖØ-öø-ÿĀ-ž .#\-]+:\s*$/;
            if (headingRe.test(t)) {
                const base = t.replace(/:\s*$/, '').replace(/\s*\d+$/, '').toLowerCase();
                if (HEADING_WORDS.includes(base)) return true;
            }
            const base = t.replace(/\s*\d+$/, '').toLowerCase();
            if (HEADING_WORDS.includes(base)) return true;
            return false;
        };

        let out = '';
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmed = line.trim();
            if (ignoreBracketLines && isHeadingLine(trimmed)) {
                out += this._escapeHtml(line);
            } else {
                let last = 0; let m;
                while ((m = dupeRE.exec(line)) !== null) {
                    const start = m.index;
                    const end = start + m[0].length;
                    const firstToken = m[1];
                    const gap = m[3];
                    const secondToken = m[4];
                    if (start > last) out += this._escapeHtml(line.slice(last, start));
                    out += this._escapeHtml(firstToken + gap);
                    out += `<span class="duppair">${this._escapeHtml(secondToken)}</span>`;
                    last = end;
                    if (dupeRE.lastIndex <= start) dupeRE.lastIndex = start + 1;
                }
                if (last < line.length) out += this._escapeHtml(line.slice(last));
            }
            if (i < lines.length - 1) out += '\n';
            dupeRE.lastIndex = 0;
        }
        return out || '<span class="t"></span>';
    },
    _ensureLayerForTextarea(ta) {
        const parent = ta.parentElement;
        if (!parent) return null;
        const cs = getComputedStyle(parent);
        if (cs.position === 'static') parent.style.position = 'relative';
        let layer = parent.querySelector(':scope > .hl-layer');
        if (!layer) {
            layer = document.createElement('div');
            layer.className = 'hl-layer';
            parent.insertBefore(layer, ta); // beneath textarea (z-index 0)
        }
        return layer;
    },
    _positionLayerUnderTextarea(layer, ta) {
        const parent = ta.parentElement;
        const csParent = getComputedStyle(parent);
        if (csParent.position === 'static') parent.style.position = 'relative';
        layer.style.position = 'absolute';
        layer.style.top = ta.offsetTop + 'px';
        layer.style.left = ta.offsetLeft + 'px';
        layer.style.width = ta.clientWidth + 'px';
        layer.style.height = ta.clientHeight + 'px';
        const cs = getComputedStyle(ta);
        layer.style.paddingTop = cs.paddingTop;
        layer.style.paddingRight = cs.paddingRight;
        layer.style.paddingBottom = cs.paddingBottom;
        layer.style.paddingLeft = cs.paddingLeft;
        // Mirror font metrics for precise wrapping
        layer.style.fontFamily = cs.fontFamily;
        layer.style.fontSize = cs.fontSize;
        layer.style.lineHeight = cs.lineHeight;
        layer.style.letterSpacing = cs.letterSpacing;
        layer.style.whiteSpace = ta.classList.contains('bar-input') ? 'pre' : 'pre-wrap';
    },
    _updateTextareaHighlight(ta) {
        if (!ta) return;
        const layer = this._ensureLayerForTextarea(ta);
        if (!layer) return;
        const text = ta.value || '';
        // Skip work if unchanged (cache last text on layer)
        if (layer.__lastText === text) return;
        layer.__lastText = text;
        this._positionLayerUnderTextarea(layer, ta);
        if (ta.id === 'research-input') {
            const ignoreBracketLines = true;
            layer.innerHTML = this._renderWithDupePairs(text, { ignoreBracketLines });
        } else {
            const freq = this._buildWordFreqFor(text);
            layer.innerHTML = this._renderWithFreq(text, freq);
        }
    },
    _syncLayerScroll(ta) {
        const parent = ta.parentElement;
        if (!parent) return;
        const layer = parent.querySelector(':scope > .hl-layer');
        if (!layer) return;
        layer.scrollTop = ta.scrollTop;
        layer.scrollLeft = ta.scrollLeft;
    },
    _scheduleTAHighlight(ta) {
        const prev = this._hlRAF.get(ta);
        if (prev) cancelAnimationFrame(prev);
        const id = requestAnimationFrame(() => {
            try {
                this._updateTextareaHighlight(ta);
                this._bindScrollOnce(ta);
                this._syncLayerScroll(ta);
            } finally {
                this._hlRAF.delete(ta);
            }
        });
        this._hlRAF.set(ta, id);
    },
    _updateAllHighlights() {
        const bars = document.querySelectorAll('.bar-item textarea.bar-input');
        if (this.highlightEnabled) {
            bars.forEach(ta => {
                this._updateTextareaHighlight(ta);
                this._bindScrollOnce(ta);
                this._syncLayerScroll(ta);
            });
        }
        const researchTa = document.getElementById('research-input');
        if (researchTa && this.highlightResearchEnabled) {
            this._updateTextareaHighlight(researchTa);
            this._bindScrollOnce(researchTa);
            this._syncLayerScroll(researchTa);
        }
    },
    _scheduleHighlights() {
        clearTimeout(this._hlTimer);
        this._hlTimer = setTimeout(() => this._updateAllHighlights(), 120);
    },
    _bindScrollOnce(ta) {
        if (this._hlScrollBound.has(ta)) return;
        this._hlScrollBound.add(ta);
        ta.addEventListener('scroll', () => this._syncLayerScroll(ta));
        // adjust on resize of textarea via input (rows change) or container resize
        const ro = ('ResizeObserver' in window) ? new ResizeObserver(() => {
            try {
                const parent = ta.parentElement;
                const layer = parent && parent.querySelector(':scope > .hl-layer');
                if (layer) this._positionLayerUnderTextarea(layer, ta);
            } catch {}
        }) : null;
        if (ro) ro.observe(ta);
    },

    // ================= Highlight toggle UI =================
    _initHighlightToggle() {
        try {
            const saved = localStorage.getItem('lbs_highlight_enabled');
            if (saved === '0') this.highlightEnabled = false;
        } catch {}
        this._applyHighlightUIState();
        // Initial render update/hide
        if (this.highlightEnabled) this._scheduleHighlights();
    },
    _applyHighlightUIState() {
        const btn = View.dom.toggleHighlightBtn;
        const body = document.body;
        if (!btn || !body) return;
        if (this.highlightEnabled) {
            body.classList.remove('highlight-off');
            btn.classList.add('active');
            btn.setAttribute('aria-pressed', 'true');
            const lbl = btn.querySelector('.toggle-label');
            if (lbl) lbl.textContent = 'Highlight ON';
            // ensure layers exist after enabling
            this._scheduleHighlights();
        } else {
            body.classList.add('highlight-off');
            btn.classList.remove('active');
            btn.setAttribute('aria-pressed', 'false');
            const lbl = btn.querySelector('.toggle-label');
            if (lbl) lbl.textContent = 'Highlight OFF';
        }
    },
    _toggleHighlight() {
        this.highlightEnabled = !this.highlightEnabled;
        try { localStorage.setItem('lbs_highlight_enabled', this.highlightEnabled ? '1' : '0'); } catch {}
        this._applyHighlightUIState();
        if (this.highlightEnabled) this._scheduleHighlights();
    },

    // Research highlight toggle
    _initResearchHighlightToggle() {
        try {
            const saved = localStorage.getItem('lbs_highlight_research_enabled');
            if (saved === '0') this.highlightResearchEnabled = false;
        } catch {}
        this._applyResearchHighlightUIState();
        // Only schedule if enabled; otherwise skip initial render for research textarea
        if (this.highlightResearchEnabled) this._scheduleHighlights();
    },
    _applyResearchHighlightUIState() {
        const btn = View.dom.toggleResearchHighlightBtn;
        const body = document.body;
        if (!body) return;
        if (this.highlightResearchEnabled) {
            body.classList.remove('research-highlight-off');
            if (btn) {
                btn.classList.add('active');
                btn.setAttribute('aria-pressed', 'true');
                const lbl = btn.querySelector('.toggle-label');
                if (lbl) lbl.textContent = 'Highlight ON';
            }
        } else {
            body.classList.add('research-highlight-off');
            if (btn) {
                btn.classList.remove('active');
                btn.setAttribute('aria-pressed', 'false');
                const lbl = btn.querySelector('.toggle-label');
                if (lbl) lbl.textContent = 'Highlight OFF';
            }
        }
    },
    _toggleResearchHighlight() {
        this.highlightResearchEnabled = !this.highlightResearchEnabled;
        try { localStorage.setItem('lbs_highlight_research_enabled', this.highlightResearchEnabled ? '1' : '0'); } catch {}
        this._applyResearchHighlightUIState();
        if (this.highlightResearchEnabled) this._scheduleHighlights();
    },

    // Source Importer (Importér Textu) highlight initialization
    _initSourceImporterHighlight() {
        if (View.dom.sourceInput) {
            // Initial highlight render
            this._scheduleTAHighlight(View.dom.sourceInput);
        }
    },

    // NEW PROJECT TABS LOGIC
    _handleTabsClick(e) {
        const tab = e.target.closest('.project-tab');
        if (tab && tab.dataset.projectName !== this.activeProjectName) {
            this._switchProject(tab.dataset.projectName);
        } else if (e.target.closest('.delete-tab-btn')) {
            this._deleteProject(e.target.closest('.project-tab').dataset.projectName);
        } else if (e.target.id === 'new-project-tab-btn') {
            this._createNewProject();
        }
    },

    _handleTabDoubleClick(e) {
        const tab = e.target.closest('.project-tab');
        if (tab) {
            const input = tab.querySelector('.project-tab-input');
            if (input) {
                input.style.pointerEvents = 'all';
                input.focus();
                input.select();
            }
        }
    },

    _handleTabBlur(e) {
        const input = e.target.closest('.project-tab-input');
        if (input) {
            input.style.pointerEvents = 'none';
            this._renameProject(input);
        }
    },

    _handleTabKeyDown(e) {
        if (e.key === 'Enter') {
            e.target.blur();
        }
    },

    _switchProject(projectName) {
        if(this.isDirty) {
            View.showConfirmation('Máte neuložené zmeny. Naozaj chcete prepnúť projekt?', () => this._loadAndDisplayProject(projectName));
        } else {
            this._loadAndDisplayProject(projectName);
        }
    },

    _createNewProject() {
        if (this.projects.length >= this.MAX_PROJECTS) {
            showNotification('Dosiahli ste maximálny počet projektov.', 'danger');
            return;
        }
        let newName;
        let i = 1;
        do {
            newName = `Projekt ${i}`;
            i++;
        } while (this.projects.includes(newName));

        this.projects.push(newName);
        Model.init();
        Model.saveProject(newName);
        this._loadAndDisplayProject(newName);
        showNotification(`Vytvorený nový projekt: "${newName}"`);
    },

    _deleteProject(projectName) {
        View.showConfirmation(`Naozaj chcete zmazať projekt "${projectName}"?`, () => {
            Model.deleteProject(projectName);
            this.projects = this.projects.filter(p => p !== projectName);

            if (this.activeProjectName === projectName) {
                const nextProject = this.projects.length > 0 ? this.projects.sort()[0] : null;
                this._loadAndDisplayProject(nextProject);
            } else {
                this._updateAllViews();
            }
             if (this.projects.length === 0) {
                this._createNewProject(); // Create a new one if all are deleted
            }
            showNotification(`Projekt "${projectName}" bol zmazaný.`);
        });
    },

    _renameProject(inputElement) {
        const oldName = inputElement.closest('.project-tab').dataset.projectName;
        const newName = inputElement.value.trim();

        if (newName === oldName) return; // No change

        if (!newName) {
            showNotification('Názov projektu nemôže byť prázdny.', 'danger');
            inputElement.value = oldName;
            return;
        }
        if (this.projects.includes(newName)) {
            showNotification('Projekt s takýmto názvom už existuje.', 'danger');
            inputElement.value = oldName;
            return;
        }

        if (Model.renameProject(oldName, newName)) {
            this.projects = this.projects.map(p => p === oldName ? newName : p);
            if (this.activeProjectName === oldName) {
                this.activeProjectName = newName;
                Storage.setActive(newName);
            }
            this._updateAllViews();
            showNotification(`Projekt premenovaný na "${newName}".`);
        }
    },

    // =================================================================================
    // TEXT IMPORTER ENHANCEMENTS - Uses unified duplicate detection system
    // =================================================================================

    /**
     * Inicializuje rozšírené funkcie pre Text Importér
     * Používa unified _renderWithDupePairs() systém
     */
    enhanceTextImporter() {
        const sourceInput = View.dom.sourceInput;
        if (!sourceInput) {
            console.warn('Source input not found - skipping enhanceTextImporter');
            return;
        }

        // Skontroluj či už toolbar neexistuje
        if (document.querySelector('.importer-toolbar')) {
            console.log('Importer toolbar already exists');
            return;
        }

        // Vytvor toolbar s tlačidlami
        const toolbar = document.createElement('div');
        toolbar.className = 'importer-toolbar';
        toolbar.innerHTML = `
            <button id="highlight-duplicates-btn" class="tool-btn" title="Analyzuje text a zvýrazní všetky duplikované slová">
                🔍 Zvýrazniť Duplikáty
            </button>
            <button id="show-duplicate-report-btn" class="tool-btn" title="Zobrazí detailný report o duplikátoch">
                📊 Report Duplikátov
            </button>
            <span id="duplicate-count" class="duplicate-counter"></span>
        `;

        // Vlož toolbar pod source input
        sourceInput.parentElement.appendChild(toolbar);

        // Event handler: Zvýrazniť duplikáty - používa unified systém
        document.getElementById('highlight-duplicates-btn').addEventListener('click', () => {
            const text = sourceInput.value;
            if (!text.trim()) {
                showNotification('Text importér je prázdny', 'warning');
                return;
            }

            // Použije unified _renderWithDupePairs() v režime 'all'
            const result = this._renderWithDupePairs(text, 'all');
            const counter = document.getElementById('duplicate-count');
            
            if (result.count > 0) {
                counter.textContent = `⚠️ ${result.count} duplikátov`;
                counter.className = 'duplicate-counter warning';
                
                // Zobraz preview
                this._showImporterPreview(result.html, result.duplicates || []);
            } else {
                counter.textContent = '✅ Bez duplikátov';
                counter.className = 'duplicate-counter success';
                showNotification('Text neobsahuje duplikované slová', 'success');
            }
        });

        // Event handler: Zobraz report
        document.getElementById('show-duplicate-report-btn').addEventListener('click', () => {
            const text = sourceInput.value;
            if (!text.trim()) {
                showNotification('Text importér je prázdny', 'warning');
                return;
            }

            // Získaj duplicates cez unified systém
            const result = this._renderWithDupePairs(text, 'all');
            
            if (result.count > 0) {
                this._showImporterReport(result.duplicates || [], text, sourceInput);
            } else {
                showNotification('Text neobsahuje duplikované slová', 'info');
            }
        });

        console.log('✅ Text Importer enhanced (unified system)');
    },

    /**
     * Zobrazí preview zvýraznených duplikátov v importéri
     */
    _showImporterPreview(html, duplicates) {
        const modal = document.createElement('div');
        modal.className = 'highlight-preview-modal';
        modal.innerHTML = `
            <div class="modal-content">
                <button class="modal-close">×</button>
                <h3>🔍 Duplikované slová - Preview</h3>
                <div class="preview-text">${html}</div>
                ${duplicates.length > 0 ? `
                    <div class="duplicate-list">
                        ${duplicates.slice(0, 10).map(([word, count], idx) => `
                            <div class="dup-item">
                                <span class="rank">${idx + 1}</span>
                                <span class="word">${word}</span>
                                <span class="count">${count}×</span>
                            </div>
                        `).join('')}
                        ${duplicates.length > 10 ? `<p style="text-align: center; color: #718096; margin-top: 16px;">... a ďalších ${duplicates.length - 10} duplikátov</p>` : ''}
                    </div>
                ` : ''}
            </div>
        `;
        
        document.body.appendChild(modal);

        modal.querySelector('.modal-close').addEventListener('click', () => modal.remove());
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.remove();
        });
    },

    /**
     * Zobrazí detailný report o duplikátoch v importéri
     */
    _showImporterReport(duplicates, text, sourceInput) {
        const modal = document.createElement('div');
        modal.className = 'duplicate-report-modal';
        
        const totalWords = text.split(/\s+/).filter(w => w.length > 0).length;
        const uniqueWords = new Set(text.toLowerCase().match(/\b[\p{L}\p{N}'-]+\b/gu) || []).size;
        
        modal.innerHTML = `
            <div class="modal-content">
                <div class="duplicate-report">
                    <div class="report-header">
                        <h3>📊 Report Duplikátov</h3>
                        <span class="total-badge">${duplicates.length} typov duplikátov</span>
                    </div>
                    <div style="padding: 20px; background: #f7fafc; border-bottom: 1px solid #e2e8f0;">
                        <p style="margin: 8px 0; color: #4a5568;"><strong>Celkový počet slov:</strong> ${totalWords}</p>
                        <p style="margin: 8px 0; color: #4a5568;"><strong>Unikátne slová:</strong> ${uniqueWords}</p>
                        <p style="margin: 8px 0; color: #4a5568;"><strong>Bohatosť slovníka:</strong> ${((uniqueWords / totalWords) * 100).toFixed(1)}%</p>
                    </div>
                    <div class="duplicate-list">
                        ${duplicates.map(([word, count], idx) => `
                            <div class="dup-item">
                                <span class="rank">${idx + 1}</span>
                                <span class="word">${word}</span>
                                <span class="count">${count}×</span>
                                <button class="action-btn replace" data-word="${word}">Nahradiť</button>
                            </div>
                        `).join('')}
                    </div>
                </div>
                <button class="modal-close">×</button>
            </div>
        `;
        
        document.body.appendChild(modal);

        modal.querySelector('.modal-close').addEventListener('click', () => modal.remove());
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.remove();
        });

        // Replace word handlers
        modal.querySelectorAll('.action-btn.replace').forEach(btn => {
            btn.addEventListener('click', () => {
                const word = btn.dataset.word;
                const replacement = prompt(`Nahradiť "${word}" za:`);
                if (replacement && replacement.trim()) {
                    const regex = new RegExp(`\\b${word}\\b`, 'gi');
                    sourceInput.value = sourceInput.value.replace(regex, replacement.trim());
                    showNotification(`✅ Nahradené: "${word}" → "${replacement}"`);
                    modal.remove();
                    this.markDirty();
                }
            });
        });
    },

    /**
     * Inicializuje komparátor projektov
     */
    initProjectComparator() {
        // Nájdi vhodné miesto pre tlačidlo (header toolbar)
        const headerControls = document.querySelector('.header-right-controls');
        if (!headerControls) {
            console.warn('Header controls not found - skipping project comparator');
            return;
        }

        // Skontroluj či tlačidlo už existuje
        if (document.querySelector('.compare-btn')) {
            console.log('Compare button already exists');
            return;
        }

        // Vytvor tlačidlo
        const compareBtn = document.createElement('button');
        compareBtn.className = 'compare-btn btn btn-secondary icon-btn';
        compareBtn.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 12V5.25"/>
            </svg>
        `;
        compareBtn.title = 'Porovnať Projekty';

        // Vložo tlačidlo
        headerControls.insertBefore(compareBtn, headerControls.firstChild);

        // Event handler
        compareBtn.addEventListener('click', () => {
            this._showComparatorModal();
        });

        console.log('✅ Project comparator initialized');
    },

    /**
     * Zobrazí modal pre výber a porovnanie projektov
     */
    _showComparatorModal() {
        const modal = document.createElement('div');
        modal.className = 'comparator-modal';
        modal.innerHTML = `
            <div class="comparator-modal-content">
                <button class="modal-close">×</button>
                <h2>🔄 Porovnať Projekty</h2>
                
                <div class="project-selector">
                    <label>
                        Project 1:
                        <select id="select-project-1">
                            <option value="1">Project 1</option>
                            <option value="2">Project 2</option>
                            <option value="3">Project 3</option>
                            <option value="4">Project 4</option>
                            <option value="5">Project 5</option>
                        </select>
                    </label>

                    <label>
                        Project 2:
                        <select id="select-project-2">
                            <option value="1">Project 1</option>
                            <option value="2" selected>Project 2</option>
                            <option value="3">Project 3</option>
                            <option value="4">Project 4</option>
                            <option value="5">Project 5</option>
                        </select>
                    </label>

                    <button class="compare-run-btn">
                        ▶️ Porovnať
                    </button>
                </div>

                <div id="comparison-result" class="comparison-result"></div>
            </div>
        `;
        
        document.body.appendChild(modal);

        // Close handlers
        modal.querySelector('.modal-close').addEventListener('click', () => {
            modal.remove();
        });

        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });

        // Compare handler
        modal.querySelector('.compare-run-btn').addEventListener('click', async () => {
            const p1 = parseInt(document.getElementById('select-project-1').value);
            const p2 = parseInt(document.getElementById('select-project-2').value);

            if (p1 === p2) {
                showNotification('Vyber 2 rôzne projekty!', 'warning');
                return;
            }

            const resultDiv = document.getElementById('comparison-result');
            resultDiv.innerHTML = '<div class="loading">Načítavam a analyzujem projekty...</div>';

            try {
                const comparator = new window.SimpleTextComparator();
                const data = await comparator.compare(p1, p2);
                const html = comparator.generateHTMLReport(data);
                resultDiv.innerHTML = html;

                // Aj textová verzia do konzole
                const textReport = comparator.generateTextReport(data);
                console.log('\n' + textReport);
                
                showNotification('✅ Porovnanie dokončené');
            } catch (error) {
                resultDiv.innerHTML = `<div class="error">❌ Chyba: ${error.message}</div>`;
                console.error('Comparison error:', error);
            }
        });
    }
};

export default Controller;
