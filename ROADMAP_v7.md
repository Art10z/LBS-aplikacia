# LBS v7.0 — Roadmap & Koncepty

---

## 🎯 Fonická vizualizácia slov (Word Chip Duration)

**Definícia:** Word chip = vizuálna reprezentácia slova na lyrické plátne.

**Nápad:**
Dlhá samohláska (á, é, í, ó, ú) má implicitne dlhší fonický trvanie ako krátka.
Chip so slovom obsahujúcim dlhú samohlásku by mal byť vizuálne **širší** — akoby chip
fyzicky zaberá viac „časovej linky" v bare.

```
Príklad:
[ á  ] [ á  ] [ á  ] [ á  ] [ á  ]   ← každý chip wider (dlhá samohláska)
[a][a][a][a][a]                        ← každý chip narrow (krátka samohláska)
```

**Efekt:** Bar sa stáva vizuálnou časovou osou — rytmická hustota je čitateľná na prvý pohľad.

**Logika implementácie (návrh):**
- Spočítaj „fonickú váhu" slova: každá dlhá samohláska = 2 jednotky, krátka = 1
- `chip.style.minWidth` = `baseWidth * fonickaVaha`
- alebo CSS `letter-spacing` / `padding` dynamicky podľa podielu dlhých samohlások

**Kandidátske dlhé samohlásky:**
- Slovenčina: á, é, í, ó, ú, ý, ŕ, ĺ
- Angličtina: detekcia cez dĺžku zvuku je komplexnejšia — poznačiť pre budúce verzie

**Verzia:** v7.0 beta  
**Stav:** 📌 Zadefinované, čaká na implementáciu
**Priorita:** Stredná — UX / vizuálna vrstva

---
