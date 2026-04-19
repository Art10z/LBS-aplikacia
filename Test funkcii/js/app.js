 (function(){
  const inputEl = document.getElementById('lbs-input');
  const canvasEl = document.getElementById('canvas');
  const globalStatsEl = document.getElementById('global-stats');
  const refreshBtn = document.getElementById('refresh-btn');

  const U = window.LBSUtils;
  const subtitleEl = document.getElementById('subtitle');
  const editSubtitleBtn = document.getElementById('edit-subtitle');

  const defaultText = `[Verse 1]\nMám dobrý plán, túto hru hrám.\nIdem vpred rýchlo, kým nedojdem tam.\nZmrznutý krk, to neni klam.\nJe to čistá matematika. A flow si robím sám.\n\n[Chorus]\nŤažký flow, má veľa dlhých tónov.\nDávaj pozor, nesmieš vypadnúť.\nRýchle vety bežia mimo týchto zón,\nmusia presne do beatu zapadnúť.`;

  function createSpan(char, classes){
    const span = document.createElement('span');
    if(classes && classes.length) span.className = classes.join(' ');
    // preserve spaces visually
    span.textContent = char === ' ' ? '\u00A0' : char;
    return span;
  }

  function renderBlueprint(){
    const text = inputEl.value || '';
    const lines = text.split('\n');
    canvasEl.innerHTML = '';

    let totalBars = 0, totalSyllables = 0;
    // keep previous last-N for rhyme-similarity check
    let prevLastN = '';

    lines.forEach(line => {
      const trimmed = line.trim();
      if(trimmed === ''){
        const gap = document.createElement('div'); gap.style.height = '8px'; canvasEl.appendChild(gap); return;
      }

      const tagMatch = trimmed.match(U.TAG_REGEX);
      if(tagMatch){
        const tagEl = document.createElement('div'); tagEl.className = 'section-tag'; tagEl.textContent = `[ ${tagMatch[1].toUpperCase()} ]`; canvasEl.appendChild(tagEl); return;
      }

      totalBars++;
      const syllables = U.countSyllables(trimmed);
      totalSyllables += syllables;

      const longVowelsCount = (trimmed.match(U.LONG_VOWELS_REGEX)||[]).length;
      // Three-tier flow difficulty: 0 = ĽAHKÝ, 1-2 = STREDNÝ, 3+ = ŤAŽKÝ
      const isHeavyFlow = longVowelsCount >= 3;
      let flowName, flowClass;
      if (longVowelsCount >= 3) { flowName = 'ŤAŽKÝ'; flowClass = 'flow-heavy'; }
      else if (longVowelsCount >= 1) { flowName = 'STREDNÝ'; flowClass = 'flow-medium'; }
      else { flowName = 'ĽAHKÝ'; flowClass = 'flow-light'; }

      let slClass = 'sl-danger';
      if(isHeavyFlow){ if(syllables===11||syllables===12) slClass='sl-perfect'; else if(syllables===10||syllables===13) slClass='sl-warning'; }
      else { if(syllables===13||syllables===14) slClass='sl-perfect'; else if(syllables===12||syllables===15) slClass='sl-warning'; }

      const lastWord = U.findLastWordRange(trimmed);

      let slots = 0;

      const row = document.createElement('div'); row.className = 'bar-row';
      const statGroup = document.createElement('div'); statGroup.className = 'stat-group';
      const statSyll = document.createElement('div'); statSyll.className = `stat-box ${slClass}`; statSyll.title = 'Počet slabík'; statSyll.textContent = `${syllables} sl.`;
      const statFlow = document.createElement('div'); statFlow.className = `stat-box ${flowClass}`;
      statFlow.title = `Dlhé hlásky: ${longVowelsCount}`;
      statFlow.textContent = flowName;
      // Optional: show count of long vowels as a compact box
      const statLong = document.createElement('div'); statLong.className = 'stat-box'; statLong.title = 'Počet dlhých hlások'; statLong.textContent = `${longVowelsCount} dl.`;

      // --- last-N comparison (simple suffix match) ---
      const lastWordText = (lastWord && lastWord.index >= 0) ? trimmed.slice(lastWord.index, lastWord.end) : '';
      const lastN = U.getLastN(lastWordText, 3); // normalized last 3 chars
      let matchPercent = null;
      if (prevLastN && lastN) {
        // compare from the end, count matching positions up to 3
        const len = Math.min(3, prevLastN.length, lastN.length);
        let matches = 0;
        for (let i = 0; i < len; i++) {
          if (lastN.charAt(lastN.length - 1 - i) === prevLastN.charAt(prevLastN.length - 1 - i)) matches++;
        }
        matchPercent = Math.round((matches / 3) * 100);
      }

      // match box
      const matchBox = document.createElement('div');
      matchBox.className = 'stat-box match-box';
      if (matchPercent === null) {
        matchBox.textContent = '—';
        matchBox.title = 'Zhodu s predchádzajúcim riadkom: nedostupné';
      } else {
        matchBox.textContent = `${matchPercent}%`;
        matchBox.title = `Zhodu s predch. riadkom: ${matchPercent}% (pred:${prevLastN || '-'} / teraz:${lastN})`;
        if (matchPercent >= 67) matchBox.classList.add('high');
        else if (matchPercent >= 34) matchBox.classList.add('mid');
        else matchBox.classList.add('low');
      }

      statGroup.appendChild(statSyll); statGroup.appendChild(statFlow); statGroup.appendChild(statLong); statGroup.appendChild(matchBox);

      const grid = document.createElement('div'); grid.className = 'rhythmic-grid';

      for(let i=0;i<trimmed.length;i++){
        const ch = trimmed[i];
        let charSlots = 1;
        const classes = [];

        if(i>=lastWord.index && i<lastWord.end) classes.push('rhyme-anchor');
        if(U.LONG_VOWELS_STR.includes(ch)) { charSlots = 2; classes.push('slot-2','vowel-long'); }
        else if(ch===','){ charSlots = 2; classes.push('slot-2','punct-comma'); }
        else if(ch==='.'){ charSlots = 3; classes.push('slot-3','punct-period'); }
        else if(ch===' ') { charSlots = 0; }

        slots += charSlots;
        grid.appendChild(createSpan(ch, classes));
      }

      const limit = document.createElement('div'); limit.className = 'grid-limit-marker'; limit.title = 'Hranica 70 slotov'; grid.appendChild(limit);

      const slotsBox = document.createElement('div'); slotsBox.className = `slots-count ${slots>70?'over':''}`; slotsBox.textContent = slots;

      row.appendChild(statGroup); row.appendChild(grid); row.appendChild(slotsBox);
      // update prevLastN for next iteration
      prevLastN = lastN || '';
      canvasEl.appendChild(row);
    });

    globalStatsEl.innerHTML = `Bary: <strong>${totalBars}</strong> | Slabiky: <strong>${totalSyllables}</strong>`;
  }

  // subtitle persistence
  function loadSubtitle(){
    try{
      const s = localStorage.getItem('lbs_subtitle');
      if(s && subtitleEl) subtitleEl.textContent = s;
    }catch(e){ /* ignore */ }
  }

  function editSubtitle(){
    if(!subtitleEl) return;
    const current = subtitleEl.textContent || '';
    const newVal = prompt('Zadajte nový subtitul (prázdne = reset):', current);
    if(newVal === null) return; // cancelled
    const val = newVal.trim() || 'V3.0 MATRIX';
    subtitleEl.textContent = val;
    try{ localStorage.setItem('lbs_subtitle', val); }catch(e){ /* ignore */ }
  }

  if(editSubtitleBtn) editSubtitleBtn.addEventListener('click', editSubtitle);
  loadSubtitle();

  // debounce helper
  function debounce(fn, wait){ let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn.apply(this,a), wait); }; }

  // UI wiring
  inputEl.value = defaultText;
  inputEl.addEventListener('input', ()=>{
    refreshBtn.innerHTML = '⚠️ PREPOČÍTAŤ'; refreshBtn.style.background='rgba(255,85,85,0.12)'; refreshBtn.style.color='var(--danger)'; refreshBtn.style.borderColor='var(--danger)';
  });

  refreshBtn.addEventListener('click', ()=>{
    renderBlueprint();
    refreshBtn.innerHTML='✔️ HOTOVO'; refreshBtn.style.background='var(--success)'; refreshBtn.style.color='#000';
    setTimeout(()=>{ refreshBtn.innerHTML='🔄 PREPOČÍTAŤ'; refreshBtn.style.background='rgba(0,255,204,0.08)'; refreshBtn.style.color='var(--accent-rhyme)'; refreshBtn.style.borderColor='var(--accent-rhyme)'; },700);
  });

  // Initial render
  renderBlueprint();

  // Expose for manual testing
  window.LBS = {render: renderBlueprint};
})();
