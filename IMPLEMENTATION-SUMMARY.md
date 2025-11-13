# 🚀 LBS v4.0 - Súhrn a Plán (v4-rebuild vetva)

**Stav k:** 13. November 2025

---

## 🎯 HLAVNÝ ZÁMER

Cieľom tejto vetvy (`v4-rebuild`) je vytvoriť novú verziu aplikácie (v4) s moderným vzhľadom a vylepšenou architektúrou. Kľúčovou stratégiou je **znovupoužitie funkčných a osvedčených častí** z pôvodnej aplikácie (najmä dynamického plátna) a ich postupné napojenie na nový vizuálny skelet. Týmto sa vyhneme zbytočnému prepisovaniu komplexnej logiky.

---

## ✅ AKTUÁLNY STAV

### 1. **Vizuálny Rebuild (UI Shell)**
📍 Súbory: `index-v4-preview.html`, `css-v4/app.css`

- **Hotovo:**
  - Vytvorený nový hlavný súbor `index-v4-preview.html` ako základ pre v4.
  - Implementovaný moderný 3-stĺpcový layout (IO-column, Canvas, Research) inšpirovaný pôvodným dizajnom.
  - Vytvorený nový CSS súbor `css-v4/app.css` s GitHub dark témou a responzívnymi prvkami.
  - Vizuálne pripravený modálny panel "Výskum & Analýza" s prepínaním tabov.

### 2. **Prepojenie Funkčnej Logiky**
📍 Súbory: `js/main.js`, `js/controller.js`, `js/view.js`

- **Hotovo:**
  - `index-v4-preview.html` teraz úspešne **načítava a spúšťa pôvodný Controller** (`js/main.js`).
  - **Dynamické plátno je plne funkčné** v novom v4 vzhľade. Všetky operácie (pridanie/mazanie sekcií a barov, drag & drop) fungujú.
  - `js/view.js` bol upravený tak, aby flexibilne pracoval s ID prvkami zo starého (`index.html`) aj nového (`index-v4-preview.html`) súboru. Tým je zabezpečená kompatibilita.

### 3. **Unifikácia a Čistenie Kódu**
📍 Súbory: `js/features/duplicate-handler.js`, `js/duplicate-highlighter.js`

- **Hotovo:**
  - Logika pre detekciu duplikátov bola **zjednotená** do jedného modulu (`duplicate-handler.js`).
  - Pôvodný `duplicate-highlighter.js` bol nahradený "shimom" (prechodkou), aby staré volania nespôsobili chybu.
  - Z `index.html` boli odstránené referencie na staré, duplicitné skripty.

---

## 🛠️ AKO POUŽIŤ AKTUÁLNU VERZIU

1.  Otvor súbor `index-v4-preview.html` v prehliadači.
2.  Aplikácia sa načíta s novým v4 vzhľadom, ale s plne funkčným dynamickým plátnom.
3.  Všetky funkcie viazané na plátno (import, pridávanie sekcií, úprava textu) by mali fungovať podľa očakávaní.

---

## 🔄 ĎALŠIE KROKY

1.  **Zjednotenie Vzhľadu Tlačidiel:**
    - Dokončiť zjednotenie všetkých tlačidiel v aplikácii, aby mali konzistentný štýl podľa `css-v4/app.css`.

2.  **Unifikácia Analýzy Rýmov:**
    - Aplikovať rovnaký princíp ako pri duplikátoch: vytvoriť jeden centrálny modul pre analýzu rýmov a odstrániť starú logiku.

3.  **Zapojenie Zvyšných UI Prvkov:**
    - Postupne "oživiť" ďalšie časti v `index-v4-preview.html` (napr. projektové taby, exportné funkcie) ich napojením na existujúci Controller.

4.  **Revízia a Čistenie:**
    - Po dokončení migrácie odstrániť staré, už nepoužívané súbory (`index.html`, `style.css`, atď.).

---

## 📝 POZNÁMKY

- **Zdroj Pravdy:** Tento dokument slúži ako hlavný prehľad o stave prác na `v4-rebuild` vetve.
- **Git:** Všetky zmeny sú commitované a pushnuté do `v4-rebuild` vetvy a sú súčasťou otvoreného Pull Requestu.
- **Priorita:** Znovupoužitie kódu pred jeho prepisovaním.

---

**Status:** ✅ **VÝVOJ (DEVELOPMENT IN PROGRESS)**

**Next Action:** Pokračovať v zjednocovaní UI a unifikácii ďalších funkcií.
