
import Model from './model.js';
import View from './view.js';
import { MAX_BAR_LENGTH, ACTIVE_PROJECT_KEY } from './constants.js';
import * as Storage from './storage.js';
import { showNotification, debounce } from './utils.js';
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

    init() {
        View.init();
        this.debouncedSave = debounce(() => this._performAutoSave(), 1500);
        this._attachEventListeners();
    Storage.init();
    this._initializeSession();
    this._loadResearchForActive();
    },

    _attachEventListeners() {
        View.dom.processTextBtn.addEventListener('click', () => this._processSourceText());
        View.dom.addSectionBtn.addEventListener('click', () => this._addSection());
        View.dom.updateMaketaBtn.addEventListener('click', () => View.renderMaketa(Model.state.trackData));
        View.dom.copyBtn.addEventListener('click', () => this._copyMaketa());
        View.dom.saveAsTxtBtn.addEventListener('click', () => this._saveMaketaAsTxt()); // PRIDANÝ RIADOK
        
        View.dom.templateInserter.addEventListener('click', (e) => this._handleTagButtonClick(e));
        
        document.addEventListener('keydown', e => this._handleGlobalKeyDown(e));

        View.dom.assemblerContent.addEventListener('input', e => this._handleCanvasInput(e));
        View.dom.assemblerContent.addEventListener('focusout', e => this._handleCanvasBlur(e));
        View.dom.assemblerContent.addEventListener('click', e => this._handleCanvasClick(e));
        
        View.dom.assemblerContent.addEventListener('dragstart', e => this._handleDragStart(e));
        View.dom.assemblerContent.addEventListener('dragover', e => this._handleDragOver(e)); // --- ZMENA ---
        View.dom.assemblerContent.addEventListener('drop', e => this._handleDrop(e));
        View.dom.assemblerContent.addEventListener('dragend', () => this._handleDragEnd());

        View.dom.openResearchBtn.addEventListener('click', () => View.dom.researchOverlay.classList.remove('hidden'));
        View.dom.closeResearchBtn.addEventListener('click', () => View.dom.researchOverlay.classList.add('hidden'));
        View.dom.researchInput.addEventListener('input', () => this._saveResearch());
        View.dom.addToPaletteBtn.addEventListener('click', () => this._addSelectedTextToPalette());
        View.dom.analyzeRhymesBtn.addEventListener('click', () => this._analyzeRhymes());
        if (View.dom.resetRhymesBtn) {
            View.dom.resetRhymesBtn.addEventListener('click', () => this._resetRhymes());
        }
        if (View.dom.resetRhymesMainBtn) {
            View.dom.resetRhymesMainBtn.addEventListener('click', () => this._resetRhymes());
        }
        if (View.dom.exportAllBtn) {
            View.dom.exportAllBtn.addEventListener('click', () => this._exportAll());
        }
        
        View.dom.inspirationPalette.addEventListener('click', e => this._handlePaletteClick(e));
        if (View.dom.resetRhymesMainBtn) {
            View.dom.resetRhymesMainBtn.addEventListener('click', () => this._resetRhymes());
        }

    View.dom.projectTabsContainer.addEventListener('click', e => this._handleTabsClick(e));
        View.dom.projectTabsContainer.addEventListener('dblclick', e => this._handleTabDoubleClick(e));
        View.dom.projectTabsContainer.addEventListener('focusout', e => this._handleTabBlur(e));
        View.dom.projectTabsContainer.addEventListener('keydown', e => this._handleTabKeyDown(e));
    },

    _handleGlobalKeyDown(e) {
        if (e.ctrlKey && e.key === 's') {
            e.preventDefault();
            this._performManualSave();
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
        clearTimeout(this.debouncedSave);
        
        View.updateSaveStatus('saving');
        Model.saveProject(this.activeProjectName);
        this.isDirty = false;
        
        setTimeout(() => {
             View.updateSaveStatus('saved');
             showNotification('Projekt uložený!');
        }, 150); // Short delay for user feedback
    },

    _processSourceText() {
        const text = View.dom.sourceInput.value;
        if (!text.trim()) {
            showNotification('Vložte text na spracovanie.', 'danger');
            return;
        }
        
        if (Model.state.trackData.length > 0) {
            View.showConfirmation('Spracovaním textu nahradíte obsah na plátne. Prajete si pokračovať?', () => this._performTextProcessing(text));
        } else {
            this._performTextProcessing(text);
        }
    },
    
    _performTextProcessing(text) {
        const lines = text.split('\n').map(line => line.trim()).filter(line => line !== '');
        const newTrackData = [];
        let currentSection = null;
    
        lines.forEach(line => {
            const sectionMatch = line.match(/^\[\s*(.+?)\s*\]$/);
    
            if (sectionMatch) {
                const sectionName = sectionMatch[1].trim();
                currentSection = {
                    // Temporary IDs will be replaced by Model.setData
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
    
        Model.setData({ trackData: newTrackData, paletteItems: Model.state.paletteItems });
        this._updateCanvasAndMaketa();
        this._markAsDirty();
        showNotification('Text bol úspešne spracovaný.');
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
            const counter = e.target.nextElementSibling;
            if(counter?.classList.contains('char-counter')) {
                counter.textContent = `${e.target.value.length}/${MAX_BAR_LENGTH}`;
            }
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
        }
    },
    
    _initializeSession() {
        this.projects = Model.getProjectList();
        this.activeProjectName = Storage.getActive();

        if (this.projects.length === 0) {
            const defaultProjectName = "Projekt 1";
            this.projects.push(defaultProjectName);
            this.activeProjectName = defaultProjectName;
            Model.init();
            Model.saveProject(defaultProjectName);
        } else if (!this.activeProjectName || !this.projects.includes(this.activeProjectName)) {
            this.activeProjectName = this.projects.sort()[0];
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
        View.updateSaveStatus('saved');
    },

    _updateAllViews() {
        View.renderProjectTabs(this.projects, this.activeProjectName, this.projects.length < this.MAX_PROJECTS);
        this._updateCanvasAndMaketa();
        View.renderFullPalette(Model.state.paletteItems);
    },

    _updateCanvasAndMaketa() {
        View.renderInitialCanvas(Model.state.trackData);
        View.renderMaketa(Model.state.trackData);
    },
    
    _saveResearch() { Storage.saveResearch(this.activeProjectName, View.dom.researchInput.value); },
    _loadResearchForActive() { View.dom.researchInput.value = Storage.loadResearch(this.activeProjectName) || ''; },

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
                localStorage.setItem('lyricalBlueprint_activeProject', newName);
            }
            this._updateAllViews();
            showNotification(`Projekt premenovaný na "${newName}".`);
        }
    }
};

export default Controller;
