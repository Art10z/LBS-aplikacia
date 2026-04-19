LBS Rhythmic Studio — v1.0

Krátky popis
- Účel: Nástroj na analýzu textov (verše/flow) pre kontrolu slabík, dlhých samohlások, rýmových kotiev a "slotov" pre beat.
- Stav: Funkčná verzia 1.0

Štruktúra projektu
- index.html — vstupná stránka a layout
- css/style.css — vizuálne štýly
- js/utils.js — pomocné funkcie (regexy, počítanie slabík, escaping)
- js/app.js — hlavná aplikačná logika, manipulácia DOM, UI

Ako spustiť
1. Otvorte `index.html` v prehliadači (alebo spustite jednoduchý HTTP server v priečinku projektu).

Poznámky k implementácii
- Bezpečnosť: výstup je escapovaný a DOM sa vytvára cez `textContent`/elementy — zamedzenie XSS.
- Kompatibilita: odstránené lookbehind regexy pre širšiu podporu engine.
- UX: manuálny refresh tlačidla, editable subtitle (uložené do localStorage), vizuálna badge `v1.0`.

Ďalšie kroky (voliteľné)
- Pridať live preview s debounce
- Export analyzovaných dát (CSV/JSON)
- Jednotkové testy pre `js/utils.js`

Autor: LBS team
