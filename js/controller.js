
import Model from './model.js';
import View from './view.js';
import { MAX_BAR_LENGTH } from './constants.js';
import * as Storage from './storage.js';
import { showNotification, debounce, showLoading, hideLoading } from './utils.js';
import { RhymeAnalyzer } from './rhymeAnalyzer.js';
import { initUnifiedAnalyzer } from './unifiedAnalysis.js';

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
    this._initUnifiedAnalysis();
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

    // ========= Unified Analysis (global overlay) =========
    _initUnifiedAnalysis() {
        const overlay = View.dom.analysisOverlay;
        const layer = View.dom.analysisLayer;
        if (!overlay || !layer) return;

        const getCanvasText = () => {
            const lines = [];
            const bars = View.dom.assemblerContent?.querySelectorAll('.bar-item textarea.bar-input');
            if (bars) bars.forEach(ta => lines.push(ta.value || ''));
            return lines.join('\n');
        };
        const getResearchText = () => View.dom.researchInput?.value || '';
        const getText = () => this.analysisSource === 'canvas' ? getCanvasText() : getResearchText();

        this._uaOverlay = initUnifiedAnalyzer({
            getText,
            layerEl: layer,
            mode: 'duplicates',
            debounceMs: 220
        });

        // Open/close controls
        View.dom.openAnalysisBtn?.addEventListener('click', () => {
            overlay.classList.remove('hidden');
            // Default active states on open
            this._setActive(View.dom.analysisSourceCanvasBtn, [View.dom.analysisSourceResearchBtn]);
            this._setActive(View.dom.analysisModeDupBtn, [View.dom.analysisModeRhymeBtn]);
            this.analysisSource = 'canvas';
            this._uaOverlay?.setMode('duplicates');
            this._uaOverlay?.update();
        });
        View.dom.closeAnalysisBtn?.addEventListener('click', () => overlay.classList.add('hidden'));

        // Source switches
        View.dom.analysisSourceCanvasBtn?.addEventListener('click', () => {
            this.analysisSource = 'canvas';
            this._setActive(View.dom.analysisSourceCanvasBtn, [View.dom.analysisSourceResearchBtn]);
            this._uaOverlay?.update();
        });
        View.dom.analysisSourceResearchBtn?.addEventListener('click', () => {
            this.analysisSource = 'research';
            this._setActive(View.dom.analysisSourceResearchBtn, [View.dom.analysisSourceCanvasBtn]);
            this._uaOverlay?.update();
        });

        // Mode switches
        View.dom.analysisModeRhymeBtn?.addEventListener('click', () => {
            this._uaOverlay?.setMode('rhyme');
            this._setActive(View.dom.analysisModeRhymeBtn, [View.dom.analysisModeDupBtn]);
            this._uaOverlay?.update();
        });
        View.dom.analysisModeDupBtn?.addEventListener('click', () => {
            this._uaOverlay?.setMode('duplicates');
            this._setActive(View.dom.analysisModeDupBtn, [View.dom.analysisModeRhymeBtn]);
            this._uaOverlay?.update();
        });

        // Auto-refresh analyzer when source texts change (only if overlay visible)
        const maybeRefresh = () => {
            if (!overlay.classList.contains('hidden')) this._uaOverlay?.update();
        };
        View.dom.assemblerContent?.addEventListener('input', (e) => {
            if (e.target && e.target.classList && e.target.classList.contains('bar-input')) {
                maybeRefresh();
            }
        });
        View.dom.researchInput?.addEventListener('input', () => maybeRefresh());
    },

    _setActive(activeBtn, others = []) {
        if (!activeBtn) return;
        activeBtn.classList.add('active');
        others.forEach(b => b && b.classList.remove('active'));
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
            View.dom.assemblerContent.addEventListener('dragover', e => this._handleDragOver(e)); // --- ZMENA ---
            View.dom.assemblerContent.addEventListener('drop', e => this._handleDrop(e));
            View.dom.assemblerContent.addEventListener('dragend', () => this._handleDragEnd());
        }

        if (View.dom.openResearchBtn) {
            View.dom.openResearchBtn.addEventListener('click', () => View.dom.researchOverlay.classList.remove('hidden'));
        }
        if (View.dom.closeResearchBtn) {
            View.dom.closeResearchBtn.addEventListener('click', () => View.dom.researchOverlay.classList.add('hidden'));
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
            // Close whichever overlay is open (analysis takes priority)
            if (View.dom.analysisOverlay && !View.dom.analysisOverlay.classList.contains('hidden')) {
                View.dom.analysisOverlay.classList.add('hidden');
            } else if (View.dom.researchOverlay && !View.dom.researchOverlay.classList.contains('hidden')) {
                View.dom.researchOverlay.classList.add('hidden');
            }
        }
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
     * Render highlighting for immediate duplicate words: "word word".
     * - Works per line (no cross-line matches)
     * - Optionally ignores bracket-only lines like "[Verse]" (for importer-like inputs)
     */
    _renderWithDupePairs(text, { ignoreBracketLines = false } = {}) {
        if (!text) return '<span class="t"></span>';
        const lines = text.split('\n');

        // Regex: (word)(spaces)(same word) — case-insensitive, Unicode letters with optional hyphen/apostrophe segments
        const dupeRE = this._getDupePairRegex();
        const HEADING_WORDS = ['intro','verse','chorus','refrén','bridge','most','outro','pre-chorus','predrefrén','prechorus','tag','solo','interlude'];
        const isHeadingLine = (raw) => {
            const t = raw.trim();
            if (!t) return false;
            // [Verse], [Verse 1], etc.
            if (/^\[[^\]]+\]$/.test(t)) return true;
            // Verse:, Chorus 2:, Refrén:
            const headingRe = this._hasUnicodeProps ? /^[\p{L}\p{N} .#\-]+:\s*$/u : /^[A-Za-z0-9À-ÖØ-öø-ÿĀ-ž .#\-]+:\s*$/;
            if (headingRe.test(t)) {
                const base = t.replace(/:\s*$/, '').replace(/\s*\d+$/, '').toLowerCase();
                if (HEADING_WORDS.includes(base)) return true;
            }
            // Plain heading word with optional number ("Verse 1")
            const base = t.replace(/\s*\d+$/, '').toLowerCase();
            if (HEADING_WORDS.includes(base)) return true;
            return false;
        };

        let out = '';
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmed = line.trim();
            if (ignoreBracketLines && isHeadingLine(trimmed)) {
                // Output as-is (transparent text on layer), no highlights
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
                    // Emit first token + gap as normal text (transparent on layer)
                    out += this._escapeHtml(firstToken + gap);
                    // Highlight only the second token
                    out += `<span class="duppair">${this._escapeHtml(secondToken)}</span>`;
                    last = end;
                    if (dupeRE.lastIndex <= start) dupeRE.lastIndex = start + 1; // safety
                }
                if (last < line.length) out += this._escapeHtml(line.slice(last));
            }
            if (i < lines.length - 1) out += '\n';
            dupeRE.lastIndex = 0; // reset for next line
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
