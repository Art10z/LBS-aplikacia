# LBS-aplikacia – Storage optimalizácia a export

Tento dokument popisuje nové úložisko (Storage API), per‑projektový výskum a export.

## Čo sa zmenilo
- Centralizované kľúče v `js/constants.js`:
  - `PROJECT_KEY_PREFIX`, `RESEARCH_KEY_PREFIX`, `ACTIVE_PROJECT_KEY`, `META_KEY`
  - limit palety `PALETTE_MAX_ITEMS = 300`
- Nový modul `js/storage.js`:
  - `init, listProjects, loadProject, saveProject, deleteProject, renameProject`
  - `setActive, getActive`
  - `loadResearch(project), saveResearch(project)` (per‑projekt)
  - `exportAll(), importAll(json)`
  - migrácia starého kľúča výskumu: `lyricalBlueprintResearch_v2.0`
- `js/model.js` používa `Storage` namiesto priamych volaní `localStorage`
- `js/controller.js` používa `Storage` pre aktívny projekt a výskum na projekt
- `index.html` obsahuje tlačidlo „Export JSON“

## Ako to funguje
- Pri spustení `Controller.init()` volá `Storage.init()` (migrácia a meta verzia)
- Výskum je viazaný na aktívny projekt (prepnutie projektu načíta jeho výskum)
- Export vytvorí JSON so všetkými projektmi a ich výskumom

## Rýchly test (manuálne)
1. Vytvor nový projekt cez tabu hore (Nový projekt)
2. Otvor Výskum, napíš text → prepni na iný projekt → vráť sa späť
   - Očakávanie: výskum je per‑projekt, nezdieľa sa
3. Pridaj viac inšpirácií (paleta) → skontroluj, že UI funguje bežne
4. Klikni „Export JSON“ → stiahne sa súbor s projektmi a výskumami

## Obnova (import) – voliteľné
UI tlačidlo zatiaľ nie je. Import vieš spustiť z konzoly v prehliadači:
```js
// vyber JSON obsah a vlož ho sem ako text
fetch('lbs-backup.json').then(r => r.text()).then(txt => Storage.importAll(txt))
```

## Poznámky a limity
- Limit palety je nastavený na 300 pre výkon; ak je potrebné, zvýš `PALETTE_MAX_ITEMS`
- Starý globálny výskum sa migruje pri prvom načítaní do aktívneho projektu
- Štruktúra exportu je verzovaná cez `SCHEMA_VERSION` v `storage.js`
