# LBS 5.0 - Plán Vývoja (Roadmap)

Tento dokument slúži ako strategický plán pre vývoj aplikácie Lyrical Blueprint Studio 5.0. Definuje kľúčové funkcie, architektúru a budúce ciele projektu.

---

## 1. Základná Architektúra a Funkcionalita

Základ aplikácie je postavený na modulárnom vanila JavaScripte s architektúrou podobnou vzoru Model-View-Controller (MVC).

-   **Model (`model.js`):** Spravuje stav aplikácie, vrátane všetkých projektov, textov a nastavení.
-   **View (`view.js`):** Zodpovedá za vykresľovanie dát do DOM a manipuláciu s UI prvkami. Je navrhnutý flexibilne, aby podporoval staré aj nové ID elementov.
-   **Controller (`controller.js`):** Orchestruje celú aplikáciu, spracováva používateľské vstupy a komunikuje medzi modelom a view.
-   **Úložisko (`storage.js`):** Zabezpečuje automatické ukladanie a načítavanie projektov z `localStorage` prehliadača.

---

## 2. Kľúčové Komponenty a Funkcie

Aplikácia je rozdelená do niekoľkých hlavných vizuálnych a funkčných celkov.

### 2.1. Panel so Zdrojovým Textom (Ľavý Panel)

-   **Vstupný text:** Hlavná oblasť pre písanie a úpravu textu.
-   **Dvojsmerná synchronizácia:** Zmeny v textovej oblasti sa okamžite prejavia na dynamickom plátne a naopak.
-   **Štrukturálne značky:** Podpora pre značky ako `[verse]`, `[chorus]`, `[bridge]` na automatické delenie textu na sekcie.

### 2.2. Dynamické Plátno (Stredný Panel)

Najkomplexnejšia časť aplikácie, ktorá vizualizuje štruktúru textu.

-   **Sekcie a Bary:** Text je vizuálne rozdelený na sekcie (napr. verš, refrén) a jednotlivé bary (riadky).
-   **Drag & Drop:** Používatelia môžu jednoducho meniť poradie barov a celých sekcií presúvaním myšou.
-   **Zvýrazňovanie Duplikátov:** Identické riadky sú vizuálne označené, aby sa predišlo opakovaniu.
-   **Dynamické prispôsobenie:** Plátno sa automaticky prispôsobuje obsahu a zmenám.

### 2.3. Panel s Výstupom (Pravý Panel)

-   **Generovanie výstupu:** Zobrazuje finálny, naformátovaný text pripravený na export.
-   **Kopírovanie a Stiahnutie:** Možnosť skopírovať text do schránky alebo ho stiahnuť ako `.txt` súbor.

### 2.4. Paleta Inšpirácie

-   **Úložisko nápadov:** Miesto na ukladanie rýmov, fráz alebo inšpiratívnych poznámok.
-   **Prepojenie s analýzou:** Nápady z analýzy rýmov sa môžu ukladať priamo sem.

### 2.5. Modálne Okno pre Výskum a Analýzu

Pokročilý nástroj s dvoma hlavnými záložkami.

-   **Záložka "Výskum":**
    -   **Poznámkový blok:** Jednoduchý textový editor pre dočasné poznámky.
    -   **Analýza Rýmov:** Funkcia na vyhľadávanie rýmov k zadanému slovu (vyžaduje externé API).
-   **Záložka "Analýza":**
    -   **Porovnávanie dvoch zdrojov:** Nástroj na analýzu duplicít medzi dvoma rôznymi textami.
    -   **Analýza Rýmov (Placeholder):** Pripravené miesto na budúcu implementáciu analýzy rýmov v rámci celého textu.

---

## 3. Plánované Úlohy a Budúci Vývoj

### Priorita 1: Stabilizácia a Zjednotenie UI

1.  **Zjednotenie štýlov tlačidiel:** Všetky tlačidlá v aplikácii budú mať jednotný vizuálny štýl a veľkosť podľa nového dizajnu (`index-v4-preview.html`).
2.  **Oživenie všetkých prvkov UI:** Prepojenie všetkých zostávajúcich tlačidiel a prvkov v novom UI (napr. správa projektov, export, nastavenia) s existujúcou logikou v `controller.js`.
3.  **Refaktoring a čistenie CSS:** Odstránenie nepotrebných štýlov zo starého `style.css` a finalizácia `css-v4/app.css`.

### Priorita 2: Rozšírenie Funkcionality

1.  **Dokončenie analýzy rýmov:** Plná implementácia analýzy rýmov v záložke "Analýza".
2.  **Refaktoring `rhymeAnalyzer.js`:** Zjednotenie logiky pre analýzu rýmov do jedného modulu, podobne ako pri `duplicate-handler.js`.
3.  **Vylepšenie exportu:** Možnosť exportu vo viacerých formátoch (napr. PDF, DOCX).

### Dlhodobá Vízia

-   **Cloudové úložisko:** Zváženie možnosti ukladania projektov do cloudu pre prístup z viacerých zariadení.
-   **Spolupráca v reálnom čase:** Možnosť pre viacerých používateľov pracovať na jednom projekte súčasne.
-   **Pokročilé jazykové nástroje:** Integrácia ďalších nástrojov na analýzu textu (napr. synonymá, metrum, aliterácia).
