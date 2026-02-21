# LBS Changelog

## Verzia 6.5 (21.02.2026)

### 🎯 Hlavná novinka: Word Chips
Kompletná reimplementácia systému práce so slovami - každé slovo je teraz **samostatný interaktívny chip**.

#### Nové funkcie:
- **Word chips** - slová sú vizuálne oddelené chipy s hover efektmi
- **Drag & drop slov** - presúvanie jednotlivých slov medzi barmi
- **Horizontálna indikácia** - presná vizuálna indikácia kam slovo spadne
- **Drag slova do palety** - presunutie slova priamo do palety inšpirácie (kopíruje)
- **Drag z palety do baru** - vloženie slova z palety na presnú pozíciu

### 🔧 Vylepšenia UX

#### Quick-add do palety
- Nový input priamo v hlavnom rozhrané pre rýchle pridanie slov do palety
- Bez nutnosti prepínať na panel inšpirácie

#### Oznámenia
- Oznámenia sa už neprekrývajú - stackujú sa v pravom rohu
- Automatické miznutie po 3 sekundách

#### Panel nástrojov
- Opravené prekrývanie tlačidiel v panel-tools
- Flexbox layout pre správne rozloženie

### 🐛 Opravy bugov
- Opravený drag & drop sekcií a barov (správna extrakcia ID)
- Opravené duplicitné ID barov pri pridávaní
- Opravený drag handler pre sekcie (section-header)
- Zachovanie interpunkcie (čiarky, bodky) v slovách pre maketu

### 📁 Technické zmeny

#### Model (js/model.js)
- Nový dátový formát: `bar.words: [{id, text}]` namiesto `bar.text`
- Nové metódy: `addWordToBar()`, `removeWordFromBar()`, `moveWord()`, `updateWordText()`, `getBarAsText()`

#### Storage (js/storage.js)
- Automatická migrácia starých dát (bar.text → bar.words)
- Funkcia `_textToWords()` pre konverziu

#### View (js/view.js)
- `_createWordChip()` - generovanie word chipov
- Upravený `_createBarElement()` s words-container
- Reference na inspirationPanel pre drag & drop

#### Controller (js/controller.js)
- Kompletné drag & drop handlery pre word chipy
- Event listenery na inspirationPanel pre väčšiu drop zónu
- `_refreshBarWords()` pre lokálne prekreslenie

#### CSS (style.css)
- `.word-chip` štýly s hover a dragging stavmi
- `.words-container` flexbox layout
- `.word-drop-indicator` pre vizuálnu spätnú väzbu
- `.quick-add-palette` štýly
- Notification stacking

---

### Predchádzajúce verzie

#### Verzia 6.0
- Pôvodná implementácia LBS
- Text-based bary
- Základný drag & drop sekcií a barov
