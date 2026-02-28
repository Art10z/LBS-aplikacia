import Model from './model.js';
import View from './view.js';
import { initPromptStyle } from './promptStyle.js';
import { MAX_BAR_LENGTH } from './constants.js';
import * as Storage from './storage.js';
import { showNotification, showLoading, hideLoading } from './utils.js';
import { analyze, render, findRhymingWords } from './unifiedAnalysis.js';
import { SectionSync } from './sectionSync.js';

// =================================================================================
// CONTROLLER ("The Conductor" / "Dirigent")
// Orchestrates the application. It listens for user events, tells the Model
// to update its state, and then tells the View what to re-render.
// =================================================================================
const Controller = {
    draggedItem: null,
    isDirty: false,
    projects: [],
    activeProjectName: null,
    MAX_PROJECTS: 5,
    singleProjectMode: false,
    highlightEnabled: true,
    promptStyleModule: null,
    sectionSync: null,
    _lastWordDrop: null,   // cache poslednej dragover pozície pre word chipy
    _lastDrop: null,       // cache poslednej dragover pozície pre bary/sekcie

    init() {
        View.init();
        this._attachEventListeners();
        this.promptStyleModule = initPromptStyle(this); // Inicializácia nového modulu
        this.sectionSync = new SectionSync(); // Inicializácia sync modulu
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
        if (View.dom.moveImporterToCanvasBtn) {
            View.dom.moveImporterToCanvasBtn.addEventListener('click', () => this._moveImporterToCanvas());
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
            View.dom.saveAsTxtBtn.addEventListener('click', () => this._saveMaketaAsTxt());
        }
        
        document.addEventListener('keydown', e => this._handleGlobalKeyDown(e));

        if (View.dom.assemblerContent) {
            View.dom.assemblerContent.addEventListener('input', e => this._handleCanvasInput(e));
            View.dom.assemblerContent.addEventListener('change', e => this._handleCanvasChange(e)); // Pre select dropdown
            View.dom.assemblerContent.addEventListener('focusout', e => this._handleCanvasBlur(e));
            View.dom.assemblerContent.addEventListener('click', e => this._handleCanvasClick(e));
            View.dom.assemblerContent.addEventListener('keydown', e => this._handleBarKeydown(e));
            View.dom.assemblerContent.addEventListener('paste', e => this._handleBarPaste(e));
            View.dom.assemblerContent.addEventListener('dragstart', e => this._handleDragStart(e));
            View.dom.assemblerContent.addEventListener('dragover', e => this._handleDragOver(e));
            View.dom.assemblerContent.addEventListener('drop', e => this._handleDrop(e));
            View.dom.assemblerContent.addEventListener('dragend', () => this._handleDragEnd());
            // Word chip event handlers
            View.dom.assemblerContent.addEventListener('keydown', e => this._handleWordInputKeydown(e));
            View.dom.assemblerContent.addEventListener('dblclick', e => this._handleWordChipDblClick(e));
            View.dom.assemblerContent.addEventListener('click', e => this._handleWordChipClick(e));
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
        
        // Suno Guide overlay
        if (View.dom.openSunoGuideBtn) {
            View.dom.openSunoGuideBtn.addEventListener('click', () => {
                View.dom.sunoGuideOverlay.classList.remove('hidden');
            });
        }
        if (View.dom.closeSunoGuideBtn) {
            View.dom.closeSunoGuideBtn.addEventListener('click', () => {
                View.dom.sunoGuideOverlay.classList.add('hidden');
            });
        }
        // Zatvoriť Suno guide kliknutím mimo obsah
        if (View.dom.sunoGuideOverlay) {
            View.dom.sunoGuideOverlay.addEventListener('click', (e) => {
                if (e.target === View.dom.sunoGuideOverlay) {
                    View.dom.sunoGuideOverlay.classList.add('hidden');
                }
            });
        }
        
        // Escape key pre zatvorenie overlays
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                if (View.dom.sunoGuideOverlay && !View.dom.sunoGuideOverlay.classList.contains('hidden')) {
                    View.dom.sunoGuideOverlay.classList.add('hidden');
                }
                if (View.dom.unifiedOverlay && !View.dom.unifiedOverlay.classList.contains('hidden')) {
                    View.dom.unifiedOverlay.classList.add('hidden');
                }
            }
        });
        
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
        // Quick add to palette
        if (View.dom.quickAddPaletteInput) {
            View.dom.quickAddPaletteInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this._quickAddToPalette();
                }
            });
        }
        if (View.dom.quickAddPaletteBtn) {
            View.dom.quickAddPaletteBtn.addEventListener('click', () => this._quickAddToPalette());
        }
        if (View.dom.exportAllBtn) {
            View.dom.exportAllBtn.addEventListener('click', () => this._exportAll());
        }
        
        // Tlačidlá v overlay paneli
        if (View.dom.saveFromOverlayBtn) {
            View.dom.saveFromOverlayBtn.addEventListener('click', () => this._performManualSave());
        }
        
        // Tlačidlá v hlavnom headeri
        if (View.dom.saveFromHeaderBtn) {
            View.dom.saveFromHeaderBtn.addEventListener('click', () => this._performManualSave());
        }
        
        if (View.dom.inspirationPalette) {
            View.dom.inspirationPalette.addEventListener('click', e => this._handlePaletteClick(e));
            View.dom.inspirationPalette.addEventListener('dragstart', e => this._handlePaletteDragStart(e));
            // Drop word chip do palety
            View.dom.inspirationPalette.addEventListener('dragover', e => this._handlePaletteDragOver(e));
            View.dom.inspirationPalette.addEventListener('drop', e => this._handlePaletteDrop(e));
            View.dom.inspirationPalette.addEventListener('dragleave', e => this._handlePaletteDragLeave(e));
        }
        
        // Pridať listenery aj na celý panel pre väčšiu drop zónu
        if (View.dom.inspirationPanel) {
            View.dom.inspirationPanel.addEventListener('dragover', e => this._handlePaletteDragOver(e));
            View.dom.inspirationPanel.addEventListener('drop', e => this._handlePaletteDrop(e));
            View.dom.inspirationPanel.addEventListener('dragleave', e => this._handlePaletteDragLeave(e));
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
        // Podporuje nový formát bar.words aj legacy bar.text
        const lines = [];
        Model.state.trackData.forEach(section => {
            lines.push(`[${section.type}]`);
            section.bars.forEach(bar => {
                // Preferovať words formát, fallback na text
                if (bar.words && bar.words.length > 0) {
                    lines.push(bar.words.map(w => w.text).join(' '));
                } else {
                    lines.push(bar.text || '');
                }
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
        
        View.updateSaveStatus('saving');
        Model.saveProject(this.activeProjectName);
        this.isDirty = false;
        
        setTimeout(() => {
             View.updateSaveStatus('saved');
             showNotification('Uložené!');
        }, 200);
    },

    // Presunúť obsah importéra na plátno s upozornením a vyčistením importéra
    _moveImporterToCanvas() {
        const raw = View.dom.sourceInput.value;
        if (!raw.trim()) {
            showNotification('Importér je prázdny – nič na presun.', 'warning');
            return;
        }
        
        // Upozornenie
        const shouldProceed = confirm('⚠️ Prepísať dynamické plátno novým textom z importéra?');
        if (!shouldProceed) return;
        
        showLoading('Prenášam text na plátno…');
        const newTrackData = this._parseImporterText(raw);
        if (newTrackData.length === 0) {
            hideLoading();
            showNotification('Žiadne použiteľné riadky.', 'warning');
            return;
        }
        
        // Prepísať model
        Model.setData({ trackData: newTrackData, paletteItems: Model.state.paletteItems });
        
        // Aktualizovať UI
        this._updateCanvasAndMaketa();
        this._markAsDirty();
        
        // Vyčistiť importér
        View.dom.sourceInput.value = '';
        
        hideLoading();
        showNotification('✅ Plátno bolo aktualizované a importér vyčistený.');
    },
    
    // Jednotná logika parsovania importéra -> trackData (odstránená duplicita)
    _parseImporterText(raw) {
        const lines = raw.split('\n').map(line => line.trim()).filter(line => line !== '');
        const newTrackData = [];
        let currentSection = null;
        let globalBarCounter = 0; // Globálny počítadlo pre unikátne bar ID
        let globalWordCounter = 0; // Globálny počítadlo pre unikátne word ID

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
            } else {
                // Ak neexistuje žiadna sekcia, automaticky vytvoríme predvolenú "Verse"
                if (!currentSection) {
                    currentSection = {
                        id: `temp-section-${newTrackData.length}`,
                        type: 'Verse',
                        label: '',
                        bars: []
                    };
                    newTrackData.push(currentSection);
                }
                // Vytvorenie baru s words (nový formát)
                const barText = line.substring(0, MAX_BAR_LENGTH);
                const words = barText.split(/\s+/)
                    .map(w => w.trim())
                    .filter(w => w.length > 0)
                    .map(w => ({
                        id: `temp-word-${globalWordCounter++}`,
                        text: w
                    }));
                
                currentSection.bars.push({
                    id: `temp-bar-${globalBarCounter++}`,
                    words: words
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
        } else if (e.target.classList.contains('section-type-input')) {
            const sectionContainer = e.target.closest('.section-container');
            const sectionId = sectionContainer.dataset.sectionId;
            const newType = e.target.value.trim();
            if (newType) {
                Model.updateSectionType(sectionId, newType);
                View.updateAllSectionLabelsInDOM(Model.state.trackData);
                this._updateSyncUI(); // Update sync UI keď sa zmení typ
                this._markAsDirty();
            } else {
                const section = Model.state.trackData.find(s => s.id === sectionId);
                if (section) e.target.value = section.type;
            }
        }
    },
    
    // Handler pre select dropdown (section type)
    _handleCanvasChange(e) {
        if (e.target.classList.contains('section-type-input')) {
            const sectionContainer = e.target.closest('.section-container');
            const sectionId = sectionContainer.dataset.sectionId;
            const newType = e.target.value.trim();
            if (newType) {
                Model.updateSectionType(sectionId, newType);
                View.updateAllSectionLabelsInDOM(Model.state.trackData);
                this._updateSyncUI();
                this._markAsDirty();
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
            
            // Ak je sekcia master, synchronizuj obsah
            const sectionId = barItem.dataset.sectionId;
            const section = Model.state.trackData.find(s => s.id === sectionId);
            if (section && this.sectionSync.isMaster(sectionId, section.type)) {
                this._syncContentToSlaves(section.type, section.bars);
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
        } else if (target.closest('.section-sync-btn')) {
            this._handleSectionSync(sectionId);
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
        let selectedText = value.substring(selectionStart, selectionEnd);
        // Odstranenie meta-znaciek (Suno tags)
        selectedText = selectedText
            .replace(/\[[^\]]+\]/g, '') // odstranenie [Verse], [Chorus], atd.
            .replace(/\([^)]+\)/g, '');  // odstranenie (whispered), [Falsetto], atd.
        const newItem = Model.addPaletteItem(selectedText);
        if (newItem) {
            View.addPaletteItemToDOM(newItem);
            this._markAsDirty();
            showNotification('Položka pridaná do palety.');
        }
    },

    _quickAddToPalette() {
        const input = View.dom.quickAddPaletteInput;
        if (!input) return;
        
        const text = input.value.trim();
        if (!text) {
            showNotification('Zadaj slovo na pridanie.', 'warning');
            return;
        }
        
        const newItem = Model.addPaletteItem(text);
        if (newItem) {
            View.addPaletteItemToDOM(newItem);
            input.value = '';
            this._markAsDirty();
            showNotification('Pridané do palety.');
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

    // Drag & Drop z palety do plátna
    _handlePaletteDragStart(e) {
        const itemEl = e.target.closest('.palette-item');
        if (!itemEl) {
            e.preventDefault();
            return;
        }
        const textSpan = itemEl.querySelector('.palette-item-text');
        const text = textSpan ? textSpan.textContent : '';
        e.dataTransfer.setData('text/plain', text);
        e.dataTransfer.setData('application/x-palette-item', text);
        e.dataTransfer.effectAllowed = 'copy';
        itemEl.classList.add('dragging');
        
        // Cleanup po drag ende
        itemEl.addEventListener('dragend', () => {
            itemEl.classList.remove('dragging');
        }, { once: true });
    },

    // Drop word chip do palety
    _handlePaletteDragOver(e) {
        // Akceptovať word-chip drag (typy sú viditeľné počas dragover)
        const types = e.dataTransfer.types;
        if (types && (types.includes('application/x-word-chip') || [...types].includes('application/x-word-chip'))) {
            e.preventDefault();
            e.stopPropagation();
            e.dataTransfer.dropEffect = 'copy';
            // Pridať highlight na paletu aj panel
            if (View.dom.inspirationPalette) View.dom.inspirationPalette.classList.add('drop-target');
            if (View.dom.inspirationPanel) View.dom.inspirationPanel.classList.add('drop-target');
        }
    },

    _handlePaletteDragLeave(e) {
        // Kontrola či skutočne opúšťame panel (nie len prechádzame na child element)
        const panel = View.dom.inspirationPanel;
        if (panel && !panel.contains(e.relatedTarget)) {
            if (View.dom.inspirationPalette) View.dom.inspirationPalette.classList.remove('drop-target');
            if (View.dom.inspirationPanel) View.dom.inspirationPanel.classList.remove('drop-target');
        }
    },

    _handlePaletteDrop(e) {
        e.preventDefault();
        e.stopPropagation();  // Zastaviť bubbling
        if (View.dom.inspirationPalette) View.dom.inspirationPalette.classList.remove('drop-target');
        if (View.dom.inspirationPanel) View.dom.inspirationPanel.classList.remove('drop-target');
        
        const wordData = e.dataTransfer.getData('application/x-word-chip');
        if (wordData) {
            try {
                const data = JSON.parse(wordData);
                const section = Model.state.trackData.find(s => s.id === data.sectionId);
                const bar = section?.bars.find(b => b.id === data.barId);
                const word = bar?.words?.find(w => w.id === data.wordId);
                if (word) {
                    const newItem = Model.addPaletteItem(word.text);
                    if (newItem) {
                        View.addPaletteItemToDOM(newItem);
                        showNotification('Slovo pridané do palety.');
                        this._markAsDirty();
                    }
                }
            } catch (err) {
                console.error('Error parsing word data:', err);
            }
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
         // Kontrola či je to word-chip drag
         const wordChip = e.target.closest('.word-chip');
         if (wordChip) {
             e.dataTransfer.setData('application/x-word-chip', JSON.stringify({
                 wordId: wordChip.dataset.wordId,
                 barId: wordChip.dataset.barId,
                 sectionId: wordChip.dataset.sectionId
             }));
             e.dataTransfer.effectAllowed = 'copyMove';  // Povoliť aj copy aj move
             wordChip.classList.add('dragging');
             return;
         }
         
         // Hľadať bar-drag-handle alebo section-drag-handle
         const barHandle = e.target.closest('.bar-drag-handle');
         const sectionHandle = e.target.closest('.section-drag-handle');
         
         if (!barHandle && !sectionHandle) { 
             e.preventDefault();
             return; 
         }
         
         // Ak je to bar, nájsť bar-item; ak je to sekcia, nájsť section-container
         if (barHandle) {
             this.draggedItem = barHandle.closest('.bar-item');
         } else if (sectionHandle) {
             this.draggedItem = sectionHandle.closest('.section-container');
         }
         
         if (!this.draggedItem) {
             e.preventDefault();
             return;
         }
            
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
        this._removeWordDropIndicator();
        this._lastWordDrop = null;
        this._lastDrop = null;
        document.body.classList.remove('is-dragging');
        
        // Odstrániť dragging class z word chipov
        document.querySelectorAll('.word-chip.dragging').forEach(el => el.classList.remove('dragging'));
        // Odstrániť drop-target z palety
        document.querySelectorAll('.drop-target').forEach(el => el.classList.remove('drop-target'));

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
        
        // Odstrániť drop-target highlight
        document.querySelectorAll('.words-container.drop-target').forEach(el => el.classList.remove('drop-target'));

        // Kontrola či je to drop z palety inšpirácie
        const paletteData = e.dataTransfer.getData('application/x-palette-item');
        if (paletteData) {
            // Drop z palety do words-container - použi cachovanú pozíciu
            const wordsContainer = (this._lastWordDrop?.container) || e.target.closest('.words-container');
            if (wordsContainer) {
                const sectionId = wordsContainer.dataset.sectionId;
                const barId = wordsContainer.dataset.barId;
                
                // Použi cachovanú pozíciu z posledného dragover
                const afterChip = this._lastWordDrop?.afterChip ?? this._getDragAfterElement(wordsContainer, e.clientX, '.word-chip', true);
                const chips = [...wordsContainer.querySelectorAll('.word-chip')];
                const insertIndex = afterChip ? chips.indexOf(afterChip) : -1;
                
                const newWord = Model.addWordToBar(sectionId, barId, paletteData, insertIndex);
                if (newWord) {
                    this._refreshBarWords(sectionId, barId);
                    this._markAsDirty();
                    showNotification('Slovo vložené z palety.');
                }
            }
            this._removeWordDropIndicator();
            return;
        }

        // Kontrola či je to drop word chipu
        const wordData = e.dataTransfer.getData('application/x-word-chip');
        if (wordData) {
            const data = JSON.parse(wordData);
            
            // Drop do palety inšpirácie
            const paletteTarget = e.target.closest('#inspiration-palette') || e.target.closest('#inspiration-panel');
            if (paletteTarget) {
                // Získať text slova z modelu
                const section = Model.state.trackData.find(s => s.id === data.sectionId);
                const bar = section?.bars.find(b => b.id === data.barId);
                const word = bar?.words?.find(w => w.id === data.wordId);
                if (word) {
                    const newItem = Model.addPaletteItem(word.text);
                    if (newItem) {
                        View.addPaletteItemToDOM(newItem);
                        showNotification('Slovo pridané do palety.');
                        this._markAsDirty();
                    }
                }
                this._removeWordDropIndicator();
                return;
            }
            
            // Použi cachovanú pozíciu z posledného dragover pre presnú drop pozíciu
            const targetWordsContainer = (this._lastWordDrop?.container) || e.target.closest('.words-container');
            if (targetWordsContainer) {
                const targetSectionId = targetWordsContainer.dataset.sectionId;
                const targetBarId = targetWordsContainer.dataset.barId;
                
                // Cachovaná pozícia pre presné umiestnenie
                const afterChip = this._lastWordDrop?.afterChip ?? this._getDragAfterElement(targetWordsContainer, e.clientX, '.word-chip', true);
                const chips = [...targetWordsContainer.querySelectorAll('.word-chip')];
                let newIndex = afterChip ? chips.indexOf(afterChip) : chips.length;
                
                Model.moveWord(data.wordId, data.sectionId, data.barId, targetSectionId, targetBarId, newIndex);
                this._refreshBarWords(data.sectionId, data.barId);
                if (data.barId !== targetBarId) {
                    this._refreshBarWords(targetSectionId, targetBarId);
                }
                this._markAsDirty();
            }
            this._removeWordDropIndicator();
            return;
        }

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
    _getDragAfterElement(container, pos, selector, horizontal = false) {
        const draggableElements = [...container.querySelectorAll(`${selector}:not(.dragging):not(#drag-placeholder)`)]; 
        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            // Threshold: 35% od začiatku prvku (nie stred 50%).
            // Znamená to: ak si v horných/ľavých 35% prvku → vlož pred neho.
            // Výsledok: placeholder sa objaví skôr a presúvanie smerom nadol/doprava je prirodzenejšie.
            const threshold = horizontal
                ? box.left + box.width * 0.35
                : box.top + box.height * 0.35;
            const offset = pos - threshold;
            return (offset < 0 && offset > closest.offset) ? { offset: offset, element: child } : closest;
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    },

    _handleDragOver(e) {
        e.preventDefault();
        
        // Kontrola či je to drag z palety inšpirácie alebo word chipu
        if (e.dataTransfer.types.includes('application/x-palette-item') || e.dataTransfer.types.includes('application/x-word-chip')) {
            // Kontrola drop do palety (len pre word chip)
            if (e.dataTransfer.types.includes('application/x-word-chip')) {
                const paletteTarget = e.target.closest('#inspiration-palette') || e.target.closest('#inspiration-panel');
                if (paletteTarget) {
                    document.querySelectorAll('.words-container.drop-target').forEach(el => el.classList.remove('drop-target'));
                    paletteTarget.classList.add('drop-target');
                    e.dataTransfer.dropEffect = 'copy';
                    this._removeWordDropIndicator();
                    return;
                }
            }
            
            const wordsContainer = e.target.closest('.words-container');
            document.querySelectorAll('.words-container.drop-target').forEach(el => el.classList.remove('drop-target'));
            document.querySelectorAll('#inspiration-palette.drop-target, #inspiration-panel.drop-target').forEach(el => el.classList.remove('drop-target'));
            
            if (wordsContainer) {
                wordsContainer.classList.add('drop-target');
                e.dataTransfer.dropEffect = e.dataTransfer.types.includes('application/x-word-chip') ? 'move' : 'copy';
                
                // Zobraziť vizuálny indikátor medzi slová + cachuj pozíciu
                const afterChip = this._getDragAfterElement(wordsContainer, e.clientX, '.word-chip', true);
                this._lastWordDrop = { container: wordsContainer, afterChip };
                this._showWordDropIndicator(wordsContainer, afterChip);
            } else {
                this._lastWordDrop = null;
                this._removeWordDropIndicator();
            }
            return;
        }
        
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
            // Pre sekcie: vždy použiť assembler-content ako container
            container = View.dom.assemblerContent;
            if (container) {
                afterElement = this._getDragAfterElement(container, e.clientY, selector);
            } else {
                this._removePlaceholder();
                return;
            }
        }
        
        if (container) {
            this._lastDrop = { container, afterElement, isBar };
            this._updatePlaceholder(container, afterElement, isBar);
        } else {
            this._lastDrop = null;
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
    },

    // =============================================================================
    // SECTION SYNC METHODS
    // =============================================================================

    /**
     * Spracuje kliknutie na sync tlačidlo
     */
    _handleSectionSync(sectionId) {
        const section = Model.state.trackData.find(s => s.id === sectionId);
        if (!section) return;

        const isMaster = this.sectionSync.isMaster(sectionId, section.type);
        
        if (isMaster) {
            // Zrušiť master status
            this.sectionSync.removeFromSync(sectionId, section.type);
            showNotification('Synchronizácia zrušená', 'info');
        } else {
            // Nastaviť ako master
            this.sectionSync.setMaster(sectionId, section.type);
            
            // Najdime všetky ostatné sekcie s rovnakým typom a nastavme ich ako slaves
            Model.state.trackData.forEach(s => {
                if (s.type === section.type && s.id !== sectionId) {
                    const group = this.sectionSync.syncGroups.get(section.type);
                    group.slaves.add(s.id);
                }
            });

            // Synchronizuj obsah do slaves
            this._syncContentToSlaves(section.type, section.bars);
            
            const syncInfo = this.sectionSync.getSyncInfo(section.type);
            showNotification(`🔗 Master nastavený (${syncInfo.count}x sekcie synchronizované)`, 'success');
        }

        this._updateSyncUI();
        this._markAsDirty();
    },

    /**
     * Synchronizuje obsah master sekcie do všetkých slave sekcií
     */
    _syncContentToSlaves(sectionType, masterBars) {
        const slaves = this.sectionSync.getSlaves(sectionType);
        
        slaves.forEach(slaveId => {
            const slaveSection = Model.state.trackData.find(s => s.id === slaveId);
            if (!slaveSection) return;

            // Skopíruj bars z master do slave (nový words formát)
            slaveSection.bars = masterBars.map(bar => ({
                id: `bar-${Model.state.nextId++}`,
                words: (bar.words || []).map(w => ({
                    id: `word-${Model.state.nextId++}`,
                    text: w.text
                }))
            }));

            // Aktualizuj UI pre slave sekciu
            const slaveSectionEl = document.querySelector(`[data-section-id="${slaveId}"]`);
            if (slaveSectionEl) {
                const barsContainer = slaveSectionEl.querySelector('.bars-container');
                if (barsContainer) {
                    barsContainer.innerHTML = '';
                    slaveSection.bars.forEach(bar => {
                        const barEl = View._createBarElement(bar, slaveId);
                        barsContainer.appendChild(barEl);
                    });
                }
            }
        });
    },

    // === WORD CHIP HELPERS ===
    
    // Zobraziť vizuálny indikátor kde padne slovo
    _showWordDropIndicator(container, beforeElement) {
        this._removeWordDropIndicator();
        const indicator = document.createElement('div');
        indicator.className = 'word-drop-indicator';
        indicator.id = 'word-drop-indicator';
        
        if (beforeElement) {
            container.insertBefore(indicator, beforeElement);
        } else {
            // Vložiť pred word-input
            const wordInput = container.querySelector('.word-input');
            if (wordInput) {
                container.insertBefore(indicator, wordInput);
            } else {
                container.appendChild(indicator);
            }
        }
    },
    
    // Odstrániť vizuálny indikátor
    _removeWordDropIndicator() {
        const indicator = document.getElementById('word-drop-indicator');
        if (indicator) indicator.remove();
    },
    
    // Obnoviť word chips pre konkrétny bar
    _refreshBarWords(sectionId, barId) {
        const section = Model.state.trackData.find(s => s.id === sectionId);
        const bar = section?.bars.find(b => b.id === barId);
        if (!bar) return;
        
        const wordsContainer = document.querySelector(`.words-container[data-bar-id="${barId}"]`);
        if (!wordsContainer) return;
        
        // Odstrániť všetky existujúce chips
        wordsContainer.querySelectorAll('.word-chip').forEach(el => el.remove());
        
        // Pridať nové chips pred word-input
        const wordInput = wordsContainer.querySelector('.word-input');
        (bar.words || []).forEach(word => {
            const chip = View._createWordChip(word, sectionId, barId);
            wordsContainer.insertBefore(chip, wordInput);
        });
        
        this._updateBarCharCounter(wordsContainer);
    },
    
    // Aktualizovať char counter pre bar
    _updateBarCharCounter(wordsContainer) {
        const barItem = wordsContainer.closest('.bar-item');
        if (!barItem) return;
        
        const counter = barItem.querySelector('.char-counter');
        if (!counter) return;
        
        const words = wordsContainer.querySelectorAll('.word-chip');
        const text = [...words].map(w => w.textContent).join(' ');
        counter.textContent = `${text.length}/${MAX_BAR_LENGTH}`;
    },

    // Handler pre word-input (Enter pridá slovo)
    _handleWordInputKeydown(e) {
        if (e.target.classList.contains('word-input') && e.key === 'Enter') {
            e.preventDefault();
            const input = e.target;
            const text = input.value.trim();
            if (!text) return;
            
            const wordsContainer = input.closest('.words-container');
            const sectionId = wordsContainer.dataset.sectionId;
            const barId = wordsContainer.dataset.barId;
            
            // Rozdeliť text na slová (ak niekto napíše viac slov)
            const newWords = text.split(/\s+/).filter(w => w.length > 0);
            newWords.forEach(wordText => {
                const newWord = Model.addWordToBar(sectionId, barId, wordText);
                if (newWord) {
                    const chip = View._createWordChip(newWord, sectionId, barId);
                    wordsContainer.insertBefore(chip, input);
                }
            });
            
            input.value = '';
            this._updateBarCharCounter(wordsContainer);
            this._markAsDirty();
        }
    },

    // Handler pre double-click na word chip (editácia)
    _handleWordChipDblClick(e) {
        const chip = e.target.closest('.word-chip');
        if (!chip) return;
        
        const currentText = chip.textContent;
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'word-edit-input';
        input.value = currentText;
        
        chip.style.display = 'none';
        chip.parentNode.insertBefore(input, chip);
        input.focus();
        input.select();
        
        const finishEdit = () => {
            const newText = input.value.trim();
            const wordsContainer = chip.closest('.words-container');
            input.remove();
            
            if (!newText) {
                // Prázdny obsah = vymazať bublinu úplne
                Model.removeWordFromBar(chip.dataset.sectionId, chip.dataset.barId, chip.dataset.wordId);
                chip.remove();
                this._updateBarCharCounter(wordsContainer);
                this._markAsDirty();
                return;
            }
            
            if (newText !== currentText) {
                chip.textContent = newText;
                Model.updateWordText(chip.dataset.sectionId, chip.dataset.barId, chip.dataset.wordId, newText);
                this._markAsDirty();
            }
            chip.style.display = '';
            this._updateBarCharCounter(wordsContainer);
        };
        
        input.addEventListener('blur', finishEdit);
        input.addEventListener('keydown', (ev) => {
            if (ev.key === 'Enter') { ev.preventDefault(); finishEdit(); }
            if (ev.key === 'Escape') { input.value = currentText; finishEdit(); }
        });
    },

    // Handler pre kliknutie na word chip (Ctrl+click = odstránenie)
    _handleWordChipClick(e) {
        const chip = e.target.closest('.word-chip');
        if (!chip) return;
        
        if (e.ctrlKey || e.metaKey) {
            // Ctrl+click = odstrániť slovo
            e.preventDefault();
            const sectionId = chip.dataset.sectionId;
            const barId = chip.dataset.barId;
            const wordId = chip.dataset.wordId;
            
            Model.removeWordFromBar(sectionId, barId, wordId);
            const wordsContainer = chip.closest('.words-container');
            chip.remove();
            this._updateBarCharCounter(wordsContainer);
            this._markAsDirty();
        }
    },

    /**
     * Aktualizuje UI pre sync tlačidlá
     */
    _updateSyncUI() {
        Model.state.trackData.forEach(section => {
            const btn = document.querySelector(`.section-sync-btn[data-section-id="${section.id}"]`);
            if (!btn) return;

            const isMaster = this.sectionSync.isMaster(section.id, section.type);
            const isSlave = this.sectionSync.isSlave(section.id, section.type);
            const syncInfo = this.sectionSync.getSyncInfo(section.type);

            btn.classList.remove('sync-master', 'sync-slave');
            
            if (isMaster) {
                btn.classList.add('sync-master');
                btn.title = `Master sekcia (${syncInfo.count}x synchronizované)`;
            } else if (isSlave) {
                btn.classList.add('sync-slave');
                btn.title = 'Slave sekcia (synchronizovaná s master)';
            } else {
                btn.title = 'Nastaviť ako master pre synchronizáciu';
            }
        });
    }
};

export default Controller;