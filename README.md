# LBS 6.0 – Lyrical Blueprint Studio

**Lyrical Blueprint Studio** je webová aplikácia na tvorbu textov piesní s podporou importu, vizualizácie, synchronizácie sekcií, analýzy rýmov a exportu. Postavená na čistej modulárnej architektúre MVC s localStorage perzistenciou.

## 🎯 Kľúčové funkcie

1. **Import a spracovanie textu** – vkladanie surového textu, automatické rozdelenie na sekcie a bary
2. **Dynamické plátno** – vizualizácia štruktúry, drag & drop presúvanie sekcií/barov
3. **Manuálna synchronizácia** – jednoznačný workflow: Ctrl+S synchronizuje a ukladá projekt
4. **Synchronizácia sekcií** – prepojenie sekcií rovnakého typu (napr. všetky Chorus) pre kopírovanie obsahu
5. **Paleta inšpirácie** – ukladanie slov, fráz, rýmov z výskumu (limit ~300)
6. **Výskum** – per-projektový poznámkový blok s analýzou rýmov
7. **Analýza** – detekcia duplikátov, štatistiky, očistený text, rýmové schémy
8. **Export a kopírovanie** – export do TXT/JSON, kopírovanie finálneho textu
9. **Správa projektov** – vytváranie, premenovanie, mazanie, prepínanie medzi projektami (multi-tab)
10. **UI a notifikácie** – moderný interface, kontextové notifikácie, modálne okná

---

## 💡 Stručný prehľad UI

- **Importér textu** (vľavo hore) – vkladáš surový text so sekciami v hranatých zátvorkách (`[Verse]`)
- **Dynamické plátno** – drag & drop sekcií a barov, ich reorganizácia, tlačidlá 🔗 pre synchronizáciu sekcií
- **Paleta inšpirácie** – slová / útržky z výskumu; limit počtu kvôli výkonu
- **Výskum** – per‑projektový textarea overlay (otvára sa tlačidlom „Výskum"). Automatické ukladanie
- **Maketa** – finálne zostavenie textu na export / kopírovanie / uloženie ako `.txt`
- **Sync tlačidlá** – 🔄 Sync a 💾 Uložiť v hlavičke + paneli výskumu pre manuálne ukladanie

## 📁 Štruktúra projektu (po optimalizácii)

```
LBS-aplikacia/
├── index.html              # Hlavné UI (type=module -> js/main.js)
├── style.css               # Jediný CSS – obsahuje layout, notifikácie, sync button styly
├── LB Simple.html          # Standalone single-file verzia v7.3
├── project1.html - project5.html  # Jednoduché redirecty s query param
├── README.md               # Tento dokument
├── ROADMAP.md              # Plánované funkcie a vývoj
└── js/
    ├── main.js             # Vstupný bootstrap (Controller.init())
    ├── controller.js       # Orchestrácia eventov, drag & drop, sync/import/export
    ├── view.js             # Render sekcií, palety, tabov projektov, modal
    ├── model.js            # Manipulácia so sekciami, bar-mi, paletou (business logika)
    ├── storage.js          # API pre lokálne uloženie projektov a výskumu + export/import
    ├── constants.js        # Názvy kľúčov, limity (PROJECT_KEY_PREFIX, RESEARCH_KEY_PREFIX...)
    ├── utils.js            # Notifikácie, debounce s cancel
    ├── sectionSync.js      # 🆕 Synchronizácia sekcií (master/slave pattern)
    ├── promptStyle.js      # Štýl a štruktúra promptov pre AI asistenta
    └── unifiedAnalysis.js  # Analýza rýmov, duplikátov, štatistiky
```

## 🔄 Nedávne zmeny (december 2024)

### Vypnuté automatické ukladanie
- **Problém**: Auto-save každých 1.5 sekundy spôsoboval nadmernú synchronizáciu
- **Riešenie**: Auto-save kompletne vypnutý. Teraz sa ukladá **iba manuálne**:
  - **Ctrl+S** – synchronizuje plátno → importér → uloží projekt
  - **Tlačidlá v UI** – 🔄 Sync (bez uloženia) a 💾 Uložiť (sync + save)

### Nová funkcia: Synchronizácia sekcií
- Klik na tlačidlo **🔗** vedľa názvu sekcie aktivuje sync režim
- **Master sekcia** (zelená) – primárny zdroj obsahu
- **Slave sekcie** (modré) – automaticky kopírujú obsah z master sekcie
- Ideálne pre refrény (Chorus), kde chceš rovnaký text vo všetkých výskytoch
- Implementácia: `sectionSync.js` s Map-based master/slave tracking

### Čistenie kódu
- **Vymazané**: 9 JS súborov, 2 CSS súbory, 1 txt súbor, 3 prázdne priečinky
- **Optimalizované**: controller.js (odstránené nepoužívané premenné)
- **Zjednodušená** štruktúra – všetko potrebné je teraz v 10 core súboroch

## 🚀 Rýchly funkčný test

1. Vlož text so sekciami do importéra:
   ```
   [Verse]
   Prvý riadok prvej slohy
   Druhý riadok prvej slohy
   
   [Chorus]
   Refrén, ktorý sa opakuje
   Znova a znova
   
   [Verse]
   Druhá sloha piesne
   ```

2. Klik **"Aktualizovať projekt"** → plátno sa obnoví podľa importu

3. Presuň pár barov medzi sekciami (drag & drop)

4. Klik **"Sync z plátna"** → importér sa prepíše aktuálnym plátnom

5. Test synchronizácie sekcií:
   - Klikni na 🔗 vedľa prvého "Chorus" → stane sa **zeleným** (master)
   - Pridaj ďalší Chorus do textu → automaticky sa stane **modrým** (slave)
   - Uprav text v master Chorus → slave sa automaticky aktualizuje

6. Otvor **Výskum**, zapíš poznámky, prepni projekt, vráť sa – údaje sú izolované per-projekt

7. Pridaj zopár slov do **palety** (limit ~300)

8. **"Analyzovať rýmy"** v paneli výskumu → skontroluj paletu a rýmové skupiny

9. **Export JSON**, otvor súbor a over štruktúru

10. Over **zvýraznenie duplikátov**: do baru napíš `ja ja idem` → druhé `ja` má žlté pozadie

## 🔧 Storage API (localStorage)

Metódy v `storage.js`:
```js
init()                          // Inicializácia storage
listProjects()                  // Zoznam všetkých projektov
loadProject(name)               // Načítanie projektu podľa mena
saveProject(name, data)         // Uloženie projektu
deleteProject(name)             // Zmazanie projektu
renameProject(oldName, newName) // Premenovanie projektu
setActive(name)                 // Nastavenie aktívneho projektu
getActive()                     // Získanie mena aktívneho projektu
loadResearch(name)              // Načítanie výskumu pre projekt
saveResearch(name, text)        // Uloženie výskumu
exportAll()                     // Export všetkých projektov do JSON
importAll(jsonString)           // Import projektov z JSON
```

Premenné v `constants.js`:
```js
PROJECT_KEY_PREFIX = 'lyricalBlueprint_project_'
RESEARCH_KEY_PREFIX = 'lyricalBlueprint_research_'
ACTIVE_PROJECT_KEY = 'lyricalBlueprint_activeProject'
PALETTE_LIMIT = 300
```

## 👨‍💻 Práca s projektmi

- **Prepnutie projektu** (tab) načíta jeho dáta + výskum
- **Nový projekt** inicializuje prázdnu štruktúru + výskum
- **Zmazanie projektu** vyčistí všetky jeho kľúče (vrátane výskumu)
- **Premenovanie** zachová všetky dáta pod novým menom

## 📤 Export / Import

- Klik **"Export JSON"** → vygeneruje súbor (obsah: verzia, projekty, výskumy)
- Import je zatiaľ manuálny cez konzolu:
```js
fetch('backup.json').then(r => r.text()).then(txt => Storage.importAll(txt));
```

## ⚠️ Limity a výkonnosť

- **Paleta** má horný limit (predvolene 300) kvôli DOM výkonu
- **Drag & drop** placeholdery minimalizujú reflow pri presúvaní
- **Rýmová analýza** je heuristická (diakritika sa normalizuje)
- Extrémne dlhé texty (1000+ riadkov) môžu spomaliť analýzu

## 🔮 Budúce možnosti (ROADMAP.md)

- UI tlačidlo pre Import JSON
- Nastavenia pre úpravu limitov palety
- Export do formátov (.md / .docx)
- Možný Electron wrapper pre offline režim
- Zjednodušenie synchronizácie sekcií (ak testovanie ukáže, že je príliš zložitá)

## 📝 História verzií

### v6.0 (december 2024)
- ✅ Kompletne aktualizovaný README s prehľadnou dokumentáciou
- ✅ Optimalizovaná štruktúra projektu (10 core modulov)
- ✅ Vyčistený kód - odstránených 14 súborov a 3 priečinky
- ✅ Zlepšená synchronizácia s manuálnym workflow
- ✅ Master/slave synchronizácia sekcií s vizuálnym feedbackom
- ✅ Sync tlačidlá v hlavičke aj overlay paneli

### v5.0 (december 2024)
- ✅ Modulárna MVC architektúra
- ✅ Multi-projekt podpora s tab prepínaním
- ✅ Manuálne ukladanie (Ctrl+S workflow)
- ✅ Synchronizácia sekcií s master/slave pattern
- ✅ Čistenie kódu a optimalizácia
- ✅ Sync tlačidlá v hlavičke a overlay paneli

### v4.x (november 2024)
- Rebuild v Google AI Studio
- Odstránené duplicity, zjednodušené moduly
- Kompletný prepis podľa čistejšej štruktúry

### v3.x a staršie
- Pôvodná implementácia s auto-save
- Jednotlivé funkcie postupne pridávané

---

**Autor**: Art10z  
**Repozitár**: [github.com/Art10z/LBS-aplikacia](https://github.com/Art10z/LBS-aplikacia)  
**Verzia**: 6.0  
**Posledná aktualizácia**: December 26, 2024
