import { MAX_BAR_LENGTH } from './constants.js';

// =================================================================================
// VIEW ("The Face" / "Tvár")
// Manages all DOM rendering and manipulation. It only reads data and never
// modifies the application state. DOM element creation is optimized.
// =================================================================================
const View = {
    dom: {},
    init() {
        // Allow both legacy (v3.8) and v4 preview IDs to coexist by providing fallbacks
        const byId = (primary, fallback) => document.getElementById(primary) || (fallback ? document.getElementById(fallback) : null);
        this.dom = {
            sourceInput: byId('source-input'),
            refreshProjectBtn: byId('refreshProjectBtn'),
            syncImporterBtn: byId('syncImporterBtn'),
            addTemplateTagBtn: byId('addTemplateTagBtn'),
            assemblerContent: byId('assembler-content', 'dynamic-canvas'),
            addSectionBtn: byId('addSectionBtn', 'add-section-btn'),
            maketaOutput: byId('maketaOutput'),
            updateMaketaBtn: byId('updateMaketaBtn', 'updateOutputBtn'),
            copyBtn: byId('copyBtn', 'copyOutputBtn'),
            saveAsTxtBtn: byId('saveAsTxtBtn', 'downloadTxtBtn'),
            modalOverlay: byId('confirmation-modal-overlay'),
            modalText: byId('modal-text'),
            modalConfirmBtn: byId('modal-confirm-btn'),
            modalCancelBtn: byId('modal-cancel-btn'),
            researchOverlay: byId('research-overlay'),
            openResearchBtn: byId('openResearchBtn'),
            closeResearchBtn: byId('closeResearchBtn'),
            researchInput: byId('research-input'),
            addToPaletteBtn: byId('addToPaletteBtn'),
            analyzeRhymesBtn: byId('analyzeRhymesBtn'),
            resetRhymesMainBtn: byId('resetRhymesMainBtn'),
            quickAddPaletteInput: byId('quickAddPaletteInput'),
            quickAddPaletteBtn: byId('quickAddPaletteBtn'),
            inspirationPanel: byId('inspiration-panel'),
            inspirationPalette: byId('inspiration-palette'),
            templateInserter: byId('template-inserter'),
            promptStyleInput: byId('prompt-style-input'),
            copyPromptStyleBtn: byId('copyPromptStyleBtn'),
            projectTabsContainer: byId('project-tabs-container'),
            saveStatus: byId('save-status'),
            exportAllBtn: byId('exportAllBtn'),
            openUnifiedBtn: byId('openUnifiedBtn'),
            unifiedOverlay: byId('unified-overlay', 'unified-panel-overlay'),
            closeUnifiedBtn: byId('closeUnifiedBtn'),
            syncFromOverlayBtn: byId('syncFromOverlayBtn'),
            saveFromOverlayBtn: byId('saveFromOverlayBtn'),
            syncFromHeaderBtn: byId('syncFromHeaderBtn'),
            saveFromHeaderBtn: byId('saveFromHeaderBtn'),
            researchTabBtn: byId('researchTabBtn'),
            analysisTabBtn: byId('analysisTabBtn'),
            researchTab: byId('researchTab'),
            analysisTab: byId('analysisTab'),
            analysisLayer: byId('analysis-layer'),
            openSunoGuideBtn: byId('openSunoGuideBtn'),
            sunoGuideOverlay: byId('suno-guide-overlay'),
            closeSunoGuideBtn: byId('closeSunoGuideBtn'),
        };
    },
    
    setPromptStyleValue(value) {
        if (this.dom.promptStyleInput) this.dom.promptStyleInput.value = value || '';
    },
    
    getPromptStyleValue() {
        return this.dom.promptStyleInput ? this.dom.promptStyleInput.value : '';
    },
    
    updateSaveStatus(status) { // 'saved', 'unsaved', 'saving'
        const statusMap = {
            saved: 'Uložené ✓',
            unsaved: 'Neuložené',
            saving: 'Ukladám...'
        };
        this.dom.saveStatus.textContent = statusMap[status] || '';
        this.dom.saveStatus.dataset.status = status;
    },

    renderInitialCanvas(trackData) {
        // Efficient re-render: reuse existing sections where possible, minimal DOM churn.
        const container = this.dom.assemblerContent;
        const existingMap = new Map();
        container.querySelectorAll('.section-container').forEach(sec => {
            existingMap.set(sec.dataset.sectionId, sec);
        });

        const fragment = document.createDocumentFragment();
        const newIds = new Set();
        trackData.forEach(section => {
            newIds.add(section.id);
            let el = existingMap.get(section.id);
            if (el) {
                // Update type input + label only (bars handled separately)
                const typeInput = el.querySelector('.section-type-input');
                if (typeInput && typeInput.value !== section.type) typeInput.value = section.type;
                const labelEl = el.querySelector('.section-label');
                if (labelEl && labelEl.textContent !== section.label) labelEl.textContent = section.label;
                // Sync bars
                this._syncBars(el.querySelector('.bars-container'), section);
            } else {
                el = this._createSectionElement(section);
            }
            fragment.appendChild(el);
        });
        // Remove stale sections
        existingMap.forEach((el, id) => { if (!newIds.has(id)) el.remove(); });
        container.innerHTML = '';
        container.appendChild(fragment);
    },

    _syncBars(barsContainer, section) {
        const existingBars = new Map();
        barsContainer.querySelectorAll('.bar-item').forEach(b => existingBars.set(b.dataset.barId, b));
        const frag = document.createDocumentFragment();
        const newIds = new Set();
        section.bars.forEach(bar => {
            newIds.add(bar.id);
            let barEl = existingBars.get(bar.id);
            if (barEl) {
                // Aktualizovať word chips a counter
                const wordsContainer = barEl.querySelector('.words-container');
                const counter = barEl.querySelector('.char-counter');
                
                // Podpora oboch formátov (legacy text aj nový words)
                const words = bar.words || [];
                const barText = words.map(w => w.text).join(' ');
                
                if (counter) {
                    counter.textContent = `${barText.length}/${MAX_BAR_LENGTH}`;
                }
                
                // Word chips sa synchronizujú cez _refreshBarWords v controlleri
            } else {
                barEl = this._createBarElement(bar, section.id);
            }
            frag.appendChild(barEl);
        });
        // Remove stale
        existingBars.forEach((el, id) => { if (!newIds.has(id)) el.remove(); });
        barsContainer.innerHTML = '';
        barsContainer.appendChild(frag);
    },

    renderFullPalette(paletteItems) {
        const pal = this.dom.inspirationPalette;
        pal.innerHTML = '';
        if (paletteItems.length === 0) {
            pal.classList.add('placeholder');
            pal.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M9.953 2.224a15.22 15.22 0 014.094 0l.248.047a.912.912 0 00.912-.767 1.5 1.5 0 012.84 1.132 6.723 6.723 0 01-2.032 4.158c-.183.183-.366.365-.548.548a6.723 6.723 0 01-4.158 2.032 1.5 1.5 0 01-1.132-2.84.912.912 0 00.767-.912l-.047-.248zM14.047 21.776a15.22 15.22 0 01-4.094 0l-.248-.047a.912.912 0 00-.912.767 1.5 1.5 0 01-2.84-1.132 6.723 6.723 0 012.032-4.158c.183-.183.366.365.548.548a6.723 6.723 0 014.158-2.032 1.5 1.5 0 011.132 2.84.912.912 0 00-.767.912l.047.248z" />
                </svg>
                <p>Označ text vo výskume a pridaj ho sem ako inšpiráciu.</p>`;
        } else {
            pal.classList.remove('placeholder');
            const frag = document.createDocumentFragment();
            paletteItems.forEach(item => frag.appendChild(this._createPaletteItemElement(item)));
            pal.appendChild(frag);
        }
    },
    
    addPaletteItemToDOM(item) {
        if (this.dom.inspirationPalette.classList.contains('placeholder')) {
            this.dom.inspirationPalette.innerHTML = '';
            this.dom.inspirationPalette.classList.remove('placeholder');
        }
        const itemEl = this._createPaletteItemElement(item);
        this.dom.inspirationPalette.prepend(itemEl);
    },

    removePaletteItemFromDOM(itemId) {
         const itemEl = this.dom.inspirationPalette.querySelector(`[data-item-id="${itemId}"]`);
         if (itemEl) itemEl.remove();
         if (this.dom.inspirationPalette.children.length === 0) {
             this.renderFullPalette([]);
         }
    },

    renderMaketa(trackData) {
        this.dom.maketaOutput.textContent = trackData.map(section =>
            `[${section.label}]\n` + section.bars.map((bar, i) => {
                // Podpora oboch formátov (legacy text aj nový words)
                const text = bar.words 
                    ? bar.words.map(w => w.text).join(' ')
                    : (bar.text || '');
                return text + (((i + 1) % 4 === 0) ? '\n' : '');
            }).join('\n') + (section.bars.length % 4 !== 0 ? '\n' : '')
        ).join('\n');
    },
    
    addSectionToDOM(section) {
        const sectionEl = this._createSectionElement(section);
        this.dom.assemblerContent.appendChild(sectionEl);
        sectionEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    },

    removeSectionFromDOM(sectionId) {
        const sectionEl = this.dom.assemblerContent.querySelector(`[data-section-id="${sectionId}"]`);
        if (sectionEl) sectionEl.remove();
    },

    addBarToDOM(sectionId, bar) {
        const sectionEl = this.dom.assemblerContent.querySelector(`[data-section-id="${sectionId}"]`);
        if (sectionEl) {
            const barsContainer = sectionEl.querySelector('.bars-container');
            const barEl = this._createBarElement(bar, sectionId);
            barsContainer.appendChild(barEl);
            const wordInput = barEl.querySelector('.word-input');
            if (wordInput) wordInput.focus();
        }
    },

    removeBarFromDOM(barElement) {
        barElement.remove();
    },
    
    updateAllSectionLabelsInDOM(trackData) {
        trackData.forEach(section => {
            const sectionEl = this.dom.assemblerContent.querySelector(`[data-section-id="${section.id}"]`);
            if (sectionEl) {
                const labelEl = sectionEl.querySelector('.section-label');
                if (labelEl) labelEl.textContent = section.label;

                const typeInputEl = sectionEl.querySelector('.section-type-input');
                if (typeInputEl && typeInputEl.value !== section.type) {
                    typeInputEl.value = section.type;
                }
            }
        });
    },

    _createSectionElement(section) {
        const sectionContainer = document.createElement('div');
        sectionContainer.className = 'section-container';
        sectionContainer.dataset.sectionId = section.id;

        const header = document.createElement('div');
        header.className = 'section-header';
        header.draggable = true; // Celý header je draggable
        header.style.cursor = 'move';
        header.title = 'Ťahajte pre presunutie sekcie';

        const dragHandle = document.createElement('span');
        dragHandle.className = 'section-drag-handle';
        dragHandle.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="5" r="1"></circle><circle cx="12" cy="12" r="1"></circle><circle cx="12" cy="19" r="1"></circle><circle cx="5" cy="5" r="1"></circle><circle cx="5" cy="12" r="1"></circle><circle cx="5" cy="19" r="1"></circle><circle cx="19" cy="5" r="1"></circle><circle cx="19" cy="12" r="1"></circle><circle cx="19" cy="19" r="1"></circle></svg>`;

        const label = document.createElement('span');
        label.className = 'section-label';
        label.textContent = section.label;

        const controls = document.createElement('div');
        controls.className = 'section-controls';
        
        // Dropdown pre typ sekcie namiesto textového inputu
        const typeSelect = document.createElement('select');
        typeSelect.className = 'section-type-input';
        typeSelect.title = 'Typ sekcie';
        
        // Preddefinované Suno meta-značky
        const sectionTypes = [
            'Verse', 'Verse 1', 'Verse 2', 'Verse 3',
            'Chorus', 
            'Pre-Chorus',
            'Bridge',
            'Outro',
            'Intro',
            'Hook',
            'Drop',
            'Breakdown',
            'Interlude',
            'Instrumental',
            'Guitar Solo',
            'Piano Solo',
            'Solo'
        ];
        
        sectionTypes.forEach(type => {
            const option = document.createElement('option');
            option.value = type;
            option.textContent = type;
            if (type === section.type) option.selected = true;
            typeSelect.appendChild(option);
        });
        
        // Ak aktuálny typ nie je v zozname, pridať ho
        if (!sectionTypes.includes(section.type)) {
            const customOption = document.createElement('option');
            customOption.value = section.type;
            customOption.textContent = section.type;
            customOption.selected = true;
            typeSelect.insertBefore(customOption, typeSelect.firstChild);
        }

        // Sync tlačidlo
        const syncBtn = document.createElement('button');
        syncBtn.className = 'btn btn-secondary section-sync-btn';
        syncBtn.dataset.sectionId = section.id;
        syncBtn.title = 'Synchronizovať sekcie rovnakého typu';
        syncBtn.innerHTML = '🔗';

        const addBarBtn = document.createElement('button');
        addBarBtn.className = 'btn btn-secondary add-bar-btn';
        addBarBtn.title = 'Pridať bar';
        addBarBtn.textContent = '+';
        
        const removeSectionBtn = document.createElement('button');
        removeSectionBtn.className = 'btn btn-danger remove-section-btn';
        removeSectionBtn.title = 'Odstrániť sekciu';
        removeSectionBtn.innerHTML = '&times;';

        controls.append(typeSelect, syncBtn, addBarBtn, removeSectionBtn);
        header.append(dragHandle, label, controls);

        const barsContainer = document.createElement('div');
        barsContainer.className = 'bars-container';
        section.bars.forEach(bar => barsContainer.appendChild(this._createBarElement(bar, section.id)));

        sectionContainer.append(header, barsContainer);
        return sectionContainer;
    },

    _createBarElement(bar, sectionId) {
        const barItem = document.createElement('div');
        barItem.className = 'bar-item';
        barItem.dataset.barId = bar.id;
        barItem.dataset.sectionId = sectionId;

        const dragHandle = document.createElement('span');
        dragHandle.className = 'bar-drag-handle';
        dragHandle.title = 'Presunúť bar';
        dragHandle.textContent = '⠿';
        dragHandle.draggable = true;

        // Word chips container namiesto textarea
        const wordsContainer = document.createElement('div');
        wordsContainer.className = 'words-container';
        wordsContainer.dataset.barId = bar.id;
        wordsContainer.dataset.sectionId = sectionId;

        // Render existing words as chips
        const words = bar.words || [];
        words.forEach(word => {
            wordsContainer.appendChild(this._createWordChip(word, sectionId, bar.id));
        });

        // Input pre pridanie nového slova
        const wordInput = document.createElement('input');
        wordInput.type = 'text';
        wordInput.className = 'word-input';
        wordInput.placeholder = '+';
        wordInput.title = 'Napíš slovo a stlač Enter';
        wordsContainer.appendChild(wordInput);

        const barText = words.map(w => w.text).join(' ');
        const counter = document.createElement('span');
        counter.className = 'char-counter';
        counter.textContent = `${barText.length}/${MAX_BAR_LENGTH}`;

        const removeBtn = document.createElement('button');
        removeBtn.className = 'remove-bar-btn';
        removeBtn.title = 'Odstrániť bar';
        removeBtn.innerHTML = '&times;';

        barItem.append(dragHandle, wordsContainer, counter, removeBtn);
        return barItem;
    },

    _createWordChip(word, sectionId, barId) {
        const chip = document.createElement('span');
        chip.className = 'word-chip';
        chip.dataset.wordId = word.id;
        chip.dataset.barId = barId;
        chip.dataset.sectionId = sectionId;
        chip.textContent = word.text;
        chip.draggable = true;
        chip.title = 'Presuň slovo';
        return chip;
    },
    
    _createPaletteItemElement(item) {
        const itemEl = document.createElement('div');
        itemEl.className = 'palette-item';
        itemEl.dataset.itemId = item.id;
        itemEl.draggable = true; // Umožniť presúvanie do plátna
        itemEl.title = 'Presuň do baru na plátne';
        
        const textSpan = document.createElement('span');
        textSpan.className = 'palette-item-text';
        textSpan.textContent = item.text;

        const removeBtn = document.createElement('button');
        removeBtn.className = 'remove-palette-item-btn';
        removeBtn.title = 'Odstrániť';
        removeBtn.innerHTML = '&times;';

        itemEl.append(textSpan, removeBtn);
        return itemEl;
    },

    showConfirmation(text, onConfirm) {
        this.dom.modalText.textContent = text;
        this.dom.modalOverlay.classList.remove('hidden');
        
        const confirmHandler = () => { onConfirm(); cleanup(); };
        const cancelHandler = () => cleanup();
        const cleanup = () => {
            this.dom.modalOverlay.classList.add('hidden');
            this.dom.modalConfirmBtn.removeEventListener('click', confirmHandler);
            this.dom.modalCancelBtn.removeEventListener('click', cancelHandler);
        };
        this.dom.modalConfirmBtn.addEventListener('click', confirmHandler, { once: true });
        this.dom.modalCancelBtn.addEventListener('click', cancelHandler, { once: true });
    },

    renderProjectTabs(projects, activeProjectName, canCreateNew, singleProjectMode = false) {
        this.dom.projectTabsContainer.innerHTML = '';
        const fragment = document.createDocumentFragment();

        projects.sort().forEach(name => {
            const tabEl = this._createProjectTabElement(name, name === activeProjectName);
            fragment.appendChild(tabEl);
        });

        if (!singleProjectMode) {
            const newBtn = this._createNewProjectButtonElement(canCreateNew);
            fragment.appendChild(newBtn);
        }
        
        this.dom.projectTabsContainer.appendChild(fragment);
    },

    _createProjectTabElement(name, isActive) {
        const tab = document.createElement('div');
        tab.className = `project-tab ${isActive ? 'active' : ''}`;
        tab.dataset.projectName = name;

        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'project-tab-input';
        input.value = name;
        input.title = 'Dvojklikom premenujete';
        
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-tab-btn';
        deleteBtn.innerHTML = '&times;';
        deleteBtn.title = 'Zmazať projekt';

        tab.append(input, deleteBtn);
        return tab;
    },

    _createNewProjectButtonElement(isEnabled) {
        const btn = document.createElement('button');
        btn.id = 'new-project-tab-btn';
        btn.className = 'btn btn-secondary';
        btn.textContent = '+';
        btn.title = 'Nový projekt';
        if (!isEnabled) {
            btn.disabled = true;
            btn.title = 'Dosiahli ste maximálny počet projektov (5)';
        }
        return btn;
    }
};

export default View;