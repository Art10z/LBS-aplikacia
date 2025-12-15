import Model from './model.js';
import View from './view.js';
import { initPromptStyle } from './promptStyle.js';
import { MAX_BAR_LENGTH } from './constants.js';
import * as Storage from './storage.js';
import { showNotification, debounce, showLoading, hideLoading } from './utils.js';
import { analyze, render, findRhymingWords } from './unifiedAnalysis.js';

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
    promptStyleModule: null,

    init() {
        View.init();
        this.debouncedSave = debounce(() => this._performAutoSave(), 1500);
        this._attachEventListeners();
        this.promptStyleModule = initPromptStyle(this); // Inicializácia nového modulu
        Storage.init();
        // Detect preferred project from global variable or URL and enable single-project mode if present
        const preferred = this._readProjectFromURL();
        if (preferred) this.singleProjectMode = true;
        this._initializeSession(preferred);
        this._loadResearchForActive();
    },

    // Pridaná metóda, aby externé moduly mohli pristupovať k modelu
    getModel() { return Model; },

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
        
        document.addEventListener('keydown', e => this._handleGlobalKeyDown(e));

        if (View.dom.assemblerContent) {
            View.dom.assemblerContent.addEventListener('input', e => this._handleCanvasInput(e));
            View.dom.assemblerContent.addEventListener('focusout', e => this._handleCanvasBlur(e));
            View.dom.assemblerContent.addEventListener('click', e => this._handleCanvasClick(e));
            View.dom.assemblerContent.addEventListener('keydown', e => this._handleBarKeydown(e));
            View.dom.assemblerContent.addEventListener('paste', e => this._handleBarPaste(e));
            View.dom.assemblerContent.addEventListener('dragstart', e => this._handleDragStart(e));
            View.dom.assemblerContent.addEventListener('dragover', e => this._handleDragOver(e));
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
            });
        }
        if (View.dom.addToPaletteBtn) {
            View.dom.addToPaletteBtn.addEventListener('click', () => this._addSelectedTextToPalette());
        }
        if (View.dom.analyzeRhymesBtn) {
            View.dom.analyzeRhymesBtn.addEventListener('click', () => this._analyzeRhymes());
        }
        if (View.dom.resetRhymesMainBtn) {
            View.dom.resetRhymesMainBtn.addEventListener('click', () => this._resetRhymes());
        }
        if (View.dom.exportAllBtn) {
            View.dom.exportAllBtn.addEventListener('click', () => this._exportAll());
        }
        
        // Tlačidlá v overlay paneli
        if (View.dom.syncFromOverlayBtn) {
            View.dom.syncFromOverlayBtn.addEventListener('click', () => {
                this._syncImporterFromCanvas();
                showNotification('Synchronizované!');
            });
        }
        if (View.dom.saveFromOverlayBtn) {
            View.dom.saveFromOverlayBtn.addEventListener('click', () => this._performManualSave());
        }
        
        if (View.dom.inspirationPalette) {
            View.dom.inspirationPalette.addEventListener('click', e => this._handlePaletteClick(e));
        }

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

        // If switching to analysis tab, run the analysis
        if (tabName === 'analysis') {
            this._runAndDisplayUnifiedAnalysis();
        }
    },

    _getCanvasText() {
        // Convert trackData to text format for analysis
        const lines = [];
        Model.state.trackData.forEach(section => {
            lines.push(`[${section.type}]`);
            section.bars.forEach(bar => {
                lines.push(bar.text || '');
            });
        });
        return lines.join('\n');
    },

    _runAndDisplayUnifiedAnalysis() {
        // Get text from current project's canvas (trackData)
        const canvasText = this._getCanvasText();
        const metricsContainer = document.getElementById('analysis-metrics-container');
        const layer = document.getElementById('analysis-layer');

        if (!canvasText.trim()) {
            if (metricsContainer) metricsContainer.innerHTML = '<div class="metrics-card"><p>Plátno je prázdne. Vložte text do importéra pre spustenie analýzy.</p></div>';
            if (layer) layer.innerHTML = '';
            return;
        }

        const result = analyze(canvasText);

        // Render metrics (pravý stĺpec)
        if (metricsContainer && result.metrics) {
            const m = result.metrics;
            metricsContainer.innerHTML = `
                <div class="metrics-card">
                    <h4>📊 Štatistiky</h4>
                    <table class="metrics-table">
                        <tr><td>Riadky:</td><td><strong>${m.lines}</strong></td></tr>
                        <tr><td>Slová celkom:</td><td><strong>${m.words}</strong></td></tr>
                        <tr><td>Unikátne slová:</td><td><strong>${m.uniqueWords}</strong></td></tr>
                        <tr><td>Bohatosť slovníka:</td><td><strong>${m.vocabularyRichness}</strong></td></tr>
                        <tr><td>Priem. slov/riadok:</td><td><strong>${m.avgWordsPerLine}</strong></td></tr>
                        <tr><td>Počet duplikátov:</td><td><strong>${m.duplicateCount}</strong></td></tr>
                    </table>
                </div>
            `;
        }

        // Render highlighted text (ľavý stĺpec, zvýraznenie duplikátov)
        if (layer) {
            render(result, layer, 'duplicates');
        }
    },
    
    _markAsDirty() {
        if (!this.isDirty) {
            this.isDirty = true;
            View.updateSaveStatus('unsaved');
        }
        // Automatické ukladanie vypnuté - ukladať len manuálne cez Ctrl+S
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
        
        // 1. Najprv synchronizuj importer z plátna
        this._syncImporterFromCanvas();
        
        // 2. Potom ulož projekt
        View.updateSaveStatus('saving');
        Model.saveProject(this.activeProjectName);
        this.isDirty = false;
        
        setTimeout(() => {
             View.updateSaveStatus('saved');
             showNotification('Synchronizované a uložené!');
        }, 200);
    },

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

    _saveMaketaAsTxt() {
        const textToSave = View.dom.maketaOutput.textContent;
        if (!textToSave.trim()) {
            showNotification('Maketa je prázdna, nie je čo uložiť.', 'danger');
            return;
        }
    
        const blob = new Blob([textToSave], { type: 'text/plain;charset=utf-8' });
    
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        
        const fileName = this.activeProjectName 
            ? `${this.activeProjectName.replace(/ /g, '_')}.txt` 
            : 'moj_text.txt';
        link.download = fileName;
    
        document.body.appendChild(link);
        link.click();
        
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
        
        showNotification(`Súbor "${fileName}" sa sťahuje.`);
    },

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
            const rhymingWords = findRhymingWords(researchText);

            if (rhymingWords.length === 0) {
                showNotification('Nenašli sa žiadne rýmy.', 'warning');
                return;
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
        this.promptStyleModule.loadPromptStyle(); // Načítanie promptu cez nový modul
    },

    _updateAllViews() {
        View.renderProjectTabs(this.projects, this.activeProjectName, this.projects.length < this.MAX_PROJECTS, this.singleProjectMode);
        this._updateCanvasAndMaketa();
        View.renderFullPalette(Model.state.paletteItems);
    },

    _updateCanvasAndMaketa() {
        View.renderInitialCanvas(Model.state.trackData);
        View.renderMaketa(Model.state.trackData);
    },
    
    _saveResearch() { Storage.saveResearch(this.activeProjectName, View.dom.researchInput.value); },
    _loadResearchForActive() { 
        View.dom.researchInput.value = Storage.loadResearch(this.activeProjectName) || '';
    },

    _handleDragStart(e) {
         const handle = e.target.closest('.bar-drag-handle, .section-drag-handle');
         
         if (!handle) { 
             e.preventDefault();
             return; 
         }
            
        this.draggedItem = handle.closest('.bar-item, .section-container');
        e.dataTransfer.effectAllowed = 'move';
        
        document.body.classList.add('is-dragging');
        
        setTimeout(() => {
            if (this.draggedItem) {
                 this.draggedItem.classList.add('dragging');
            }
        }, 0);
    },
    _handleDragEnd() {
        this._removePlaceholder();
        document.body.classList.remove('is-dragging');

        if (this.draggedItem) {
            this.draggedItem.classList.remove('dragging');
            this.draggedItem = null;
            
            View.renderInitialCanvas(Model.state.trackData); 
            View.updateAllSectionLabelsInDOM(Model.state.trackData);

            this._markAsDirty();
        }
    },
    _handleDrop(e) {
        e.preventDefault();
        this._removePlaceholder();

        if (!this.draggedItem) return;
        const isBar = this.draggedItem.classList.contains('bar-item');
        
        let targetContainer = null;
        let afterElement = null;
        let newIndex = 0;
        
        if (isBar) {
            const section = e.target.closest('.section-container');
            if (!section) return;
            
            targetContainer = section.querySelector('.bars-container');
            afterElement = this._getDragAfterElement(targetContainer, e.clientY, '.bar-item');
            newIndex = afterElement ? Array.from(targetContainer.children).indexOf(afterElement) : targetContainer.children.length;
            
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

    _handleDragOver(e) {
        e.preventDefault();
        if (!this.draggedItem) return;

        const isBar = this.draggedItem.classList.contains('bar-item');
        const selector = isBar ? '.bar-item' : '.section-container';
        
        let container = null;
        let afterElement = null;

        if (isBar) {
            const section = e.target.closest('.section-container');
            if (section) { 
                container = section.querySelector('.bars-container');
                afterElement = this._getDragAfterElement(container, e.clientY, selector);
            } else {
                this._removePlaceholder();
                return;
            }
        } else {
            container = e.target.closest('#assembler-content');
            if (container) {
                afterElement = this._getDragAfterElement(container, e.clientY, selector);
            } else {
                this._removePlaceholder();
                return;
            }
        }
        
        if (container) {
            this._updatePlaceholder(container, afterElement, isBar);
        } else {
            this._removePlaceholder();
        }
    },

    _updatePlaceholder(container, afterElement, isBar) {
        let placeholder = document.getElementById('drag-placeholder');
        if (!placeholder) {
            placeholder = document.createElement('div');
            placeholder.id = 'drag-placeholder';
        }
        placeholder.className = isBar ? 'bar-drag-placeholder' : 'section-drag-placeholder';
    
        if (afterElement) {
            container.insertBefore(placeholder, afterElement);
        } else {
            container.appendChild(placeholder);
        }
    },
    
    _removePlaceholder() {
        const placeholder = document.getElementById('drag-placeholder');
        if (placeholder) {
            placeholder.remove();
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
    }
};

export default Controller;