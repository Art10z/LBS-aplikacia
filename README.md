# LBS 5.0 – Jediný zdroj pravdy, projekty a export

Toto je hlavný repozitár aplikácie „Lyrical Blueprint Studio 5.0“. Po vyčistení duplikátov je **jediný zdroj pravdy celý obsah v koreňových súboroch a priečinku `js/`**. Všetky funkcie (import → plátno → maketa → export → výskum → paleta rýmov) bežia z `index.html`.

## Stručný prehľad UI
- Importér textu (vľavo hore) – vkladáš surový text so sekciami v hranatých zátvorkách (`[Verse]`).
- Dynamické plátno – drag & drop sekcií a barov, ich reorganizácia.
- Paleta inšpirácie – slová / útržky z výskumu; limit počtu kvôli výkonu.
- Výskum – per‑projektový textarea overlay (otvára sa tlačidlom „Výskum“). Automatické ukladanie.
- Maketa – finálne zostavenie textu na export / kopírovanie / uloženie ako `.txt`.
- Tlačidlá „Aktualizovať projekt“ a „Sync z plátna“ nahrádzajú starý nejasný cyklus „Spracovať“.

## Štruktúra po vyčistení
```
index.html            # Hlavné UI (type=module -> js/main.js)
style.css             # Jediný CSS – obsahuje layout, notifikácie, placeholder drag styly
js/
  constants.js        # Názvy kľúčov, limity (PROJECT_KEY_PREFIX, RESEARCH_KEY_PREFIX...)
  storage.js          # API pre lokálne uloženie projektov a výskumu + export/import
  model.js            # Manipulácia so sekciami, bar-mi, paletou (business logika)
  view.js             # Render sekcií, palety, tabov projektov, modal
  controller.js       # Orchestrácia eventov, drag & drop, sync/import/export, debounce
  utils.js            # Notifikácie, debounce s cancel
  rhymeAnalyzer.js    # Analýza rýmov (normalizácia, skupiny)
  main.js             # Vstupný bootstrap (Controller.init())
project1.html .. project5.html  # Jednoduché redirecty s query param pre single-project režim
README.md             # Tento dokument
```

## Kľúčové zmeny (nedávne)
- Odstránené historické duplikáty (`/js` a `style.css` mimo hlavnej štruktúry). Už neexistujú.
- Migrácia starého globálneho výskumu do per‑projektového kľúča.
- Rozšírené notifikácie: `success`, `danger`, `info`, `warning`.
- Debounce s možnosťou `cancel()` – používané pri autosave.
- Export JSON pokrýva všetky projekty + ich výskum.
- TXT export finálnej makety (`saveAsTxtBtn`).
- Systém zvýraznenia duplicitných slov integrovaný do záložky "Analýza" v modálnom okne "Výskum & Analýza".
  - Analyzuje text z dynamického plátna aktuálneho projektu.
  - Zobrazuje metriky: počet riadkov, slov, jedinečných slov, slovná zásoba, priemerné slová/riadok, počet duplikátov.
  - Štýl triedy: `.hl-layer .duppair` (žlté podfarbenie).

## Storage API (zhrnutie)
Metódy v `storage.js`:
```js
init(); listProjects(); loadProject(name); saveProject(name, data);
deleteProject(name); renameProject(oldName, newName);
setActive(name); getActive();
loadResearch(name); saveResearch(name, text);
exportAll(); importAll(jsonString);
```
Premenné v `constants.js` riadia prefixy a limity.

## Práca s projektmi
- Prepnutie projektu (tab) načíta jeho dáta + výskum.
- Nový projekt inicializuje prázdnu štruktúru + výskum.
- Zmazanie projektu vyčistí všetky jeho kľúče (vrátane výskumu).

## Export / Import
- Klik „Export JSON“ → vygeneruje súbor (obsah: verzia, projekty, výskumy).
- Import je zatiaľ manuálny cez konzolu:
```js
fetch('backup.json').then(r => r.text()).then(txt => Storage.importAll(txt));
```

## Rýchly funkčný test
1. Vlož text so sekciami do importéra.
2. Klik „Aktualizovať projekt“ → plátno sa obnoví podľa importu.
3. Presuň pár barov medzi sekciami.
4. Klik „Sync z plátna“ → importér sa prepíše aktuálnym plátnom.
5. Otvor Výskum, zapíš poznámky, prepni projekt, vráť sa – údaje pre každý projekt sú izolované.
6. Pridaj zopár slov do palety (limit ~300 – definované v konštantách).
7. „Analyzovať rýmy“ v paneli výskumu → skontroluj paletu.
8. Export JSON, otvor súbor a over štruktúru.
9. Over zvýraznenie duplikátov: do baru napíš `ja ja idem` → druhé `ja` má žlté pozadie. Vo výskume riadok `[Verse]` alebo `Verse:` sa nehighlightuje.

## Limity a výkonnosť
- Paleta má horný limit (predvolene 300) kvôli DOM výkonu.
- Drag & drop placeholdery minimalizujú reflow pri presúvaní.
- Rýmová analýza je heuristická (diakritika sa normalizuje); extrémne dlhé texty môžu spomaliť.

## Budúce možnosti (next steps)
- UI tlačidlo pre Import JSON.
- Nastavenia pre úpravu limitov palety.
- Export do formátov (.md / .docx) – externý konvertor.
- Možný Electron wrapper pre offline režim.
- Rozšírenie duplikátového zvýraznenia o analýzu vzdialených opakovaní (voliteľný "freq" mód).

## Bezpečnostné poznámky
- Dáta sú v `localStorage`; pre úplné zálohy používaj export JSON.
- Pri importe sa existujúce projekty prepíšu, ak majú rovnaké názvy.

## Changelog (posledné zásahy)
- Cleanup duplikátov: odstránené root `js/` + `style.css` + prázdny nested adresár.
- Prepracované `index.html` s plným UI (namiesto redirectu).

Ak niečo nefunguje podľa popisu, otvor issue alebo pridaj detail k replici.

---
Autor: interný nástroj Lyrical Blueprint Studio
Verzia dokumentu: 2.0-clean
