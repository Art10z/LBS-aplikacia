# LBS - Lyrical Blueprint Studio
## Zjednotená dokumentácia v6.5 | Február 2026

---

## 🎯 HLAVNÁ MYŠLIENKA APLIKÁCIE

**LBS (Lyrical Blueprint Studio)** je špecializovaný nástroj pre prípravu textov a štruktúr piesní optimalizovaných pre **Suno AI** - generatívnu hudobnú platformu.

### Prečo LBS existuje?

Suno AI používa **Custom Mode** s dvoma oddelenými poliami:
1. **Style of Music** - globálny štýl (žáner, nálada, inštrumentácia, vokály)
2. **Lyrics** - text s meta-značkami pre granulárnu kontrolu

LBS je **vizuálny editor** pre pole Lyrics - umožňuje:
- Štruktúrovať text do sekcií [Verse], [Chorus], [Bridge]...
- Manipulovať s jednotlivými slovami (word chips)
- Analyzovať duplicity a rýmy
- Exportovať pripravený text pre Suno

---

## 📋 MAPOVANIE FUNKCIÍ LBS → SUNO KONCEPTY

### 1. DYNAMICKÉ PLÁTNO (Assembler)

**Účel:** Vizuálna reprezentácia štruktúry piesne

| LBS Funkcia | Suno Ekvivalent |
|-------------|-----------------|
| Sekcie (Verse, Chorus...) | Meta-značky `[Verse]`, `[Chorus]`, `[Bridge]` |
| Bary (riadky textu) | Jednotlivé riadky v poli Lyrics |
| Drag & Drop sekcií | Zmena poradia sekcií v piesni |
| Word Chips | Granulárna manipulácia slov |

**Suno meta-značky pre štruktúru:**
```
[Intro], [Verse], [Chorus], [Pre-Chorus], [Bridge], [Outro]
[Hook], [Drop], [Breakdown], [Interlude]
[Guitar Solo], [Piano Solo], [Instrumental]
[End], [Fade Out], [Big Finish]
```

### 2. PALETA INŠPIRÁCIE

**Účel:** Úložisko kľúčových slov a rýmujúcich sa slov

| LBS Funkcia | Suno Využitie |
|-------------|---------------|
| Uložené slová | Rýmy, kľúčové témy, metafory |
| Drag do plátna | Rýchle vkladanie slov |
| Analýza rýmov | Zlepšenie flow a rýmových schém |

### 3. VÝSKUM & ANALÝZA

**Účel:** Príprava textu, hľadanie inšpirácie, analýza duplicít

| LBS Funkcia | Popis |
|-------------|-------|
| Výskumné pole | Písanie poznámok, brainstorming |
| Analýza duplikátov | Detekcia opakujúcich sa slov |
| Analýza rýmov | Hľadanie rýmujúcich sa slov |
| Štatistiky | Počet slov, riadkov, slovná zásoba |

### 4. MAKETA (Preview)

**Účel:** Náhľad finálneho textu pripravného pre Suno

Generuje čistý text vo formáte:
```
[Verse 1]
Prvý riadok textu
Druhý riadok textu
...

[Chorus]
Refrén text
...
```

### 5. EXPORT PRE SUNO

**Účel:** Kopírovanie pripraveného textu do Suno Lyrics poľa

---

## 🏷️ SUNO META-ZNAČKY - KOMPLETNÝ PREHĽAD

### Štrukturálne značky
```
[Verse], [Verse 1], [Verse 2]    - Slohy
[Chorus]                          - Refrén
[Pre-Chorus]                      - Pred-refrén (buduje napätie)
[Bridge]                          - Most (kontrastná sekcia)
[Outro]                           - Záver
[Intro]                           - Úvod (menej spoľahlivé)
[Instrumental Intro]              - Inštrumentálny úvod
[Hook]                            - Chytľavá fráza
[Drop]                            - EDM drop
[Breakdown]                       - Zredukovaná inštrumentácia
[Interlude]                       - Medzihra
```

### Vokálne značky (prednes)
```
(whispered)        - Šepkaný
(belted)           - Spievaný naplno
(shouted)          - Kričaný
(spoken-word)      - Hovorené slovo
(airy)             - Vzdušný
(ad-libs)          - Improvizované vsuvky
[Falsetto]         - Vysoký tón
[Harmonized]       - Harmonizovaný
[Gospel Choir]     - Gospelový zbor
```

### Vokálne značky (efekty)
```
[Auto-tuned]       - Auto-Tune efekt
(reverb)           - S reverbom
[Echoed]           - S ozvenou
[Vocoder]          - Vokodér
(raspy)            - Chrapľavý hlas
(soft)             - Jemné vokály
```

### Inštrumentálne značky
```
[Guitar Solo]
[Piano Solo]
[Saxophone Solo]
[acoustic guitar solo]
[fingerstyle guitar solo]
[melodic bass]
```

### Produkčné značky
```
(sidechain pump)   - Dynamická kompresia
(gated reverb)     - Reverb s krátkym dozvukom
(lo-fi)            - Lo-fi estetika
(tape delay)       - Pásková ozvena
[Clean Mix]        - Čistý mix
```

---

## 🎨 STYLE OF MUSIC - 4 PILIERE

Pre pole "Style of Music" v Suno Custom Mode:

### 1. Žáner a štýl
```
90s grunge, synthwave, indie folk, trap metal, boom-bap
deep house, lo-fi hip hop, cinematic, orchestral, G-Funk
hyperpop, dream pop, bedroom pop, psychedelic rock
```

### 2. Nálada a emócia
```
melancholic, triumphant, nostalgic, upbeat, dark
emotional, serene, high tension, anthemic, dreamy
uplifting, playful, haunting, introspective, hopeful
```

### 3. Inštrumentácia a produkcia
```
acoustic guitar, distorted synth, punchy 909 drums
orchestral strings, smooth saxophone, slap bass
Rhodes piano, synth pads, 808 drums, vinyl crackle
lo-fi aesthetics, clean mix, heavy reverb
```

### 4. Vokálne preferencie
```
soft airy female vocals, deep male vocals
aggressive power vocals, whispery vocals, raw vocals
falsetto, anthemic chorus, sultry jazzy vocals
```

---

## 🔄 SUNO WORKFLOW - "GENERATÍVNA SLUČKA"

1. **Generovanie** - Vytvorenie počiatočného segmentu (verse + chorus)
2. **Kurátorstvo** - Výber lepšej z dvoch vygenerovaných verzií
3. **Rozširovanie** - "Continue From This Song" pre ďalšie časti
4. **Zostavenie** - "Get Whole Song" na spojenie klipov

> **LBS pomáha v kroku 1** - príprava štruktúrovaného textu s meta-značkami

---

## 📊 SUNO V5 - AKTUÁLNE FUNKCIE (Február 2026)

Podľa official suno.com dokumentácie:

### Inteligentná kompozičná architektúra
- Koherentná štruktúra od 30s do 8 minút
- Profesionálne prechody medzi sekciami

### Adaptívna kreatívna inteligencia
- Učí sa štýlové preferencie
- Real-time návrhy

### Perzistentná pamäť hlasov a nástrojov
- Konzistentné vokály cez celý projekt
- Stabilné inštrumentálne identity

### Profesionálna kontrola
- Tempo, tónina, dynamika
- Granulárne parametre

### Suno Studio (Premier)
- Multitrack timeline
- BPM kontrola
- Export stems (audio + MIDI)
- Warp Markers
- Time Signature support

---

## ⚡ LBS v6.5 - AKTUÁLNE FUNKCIE

### Word Chips Systém
- Každé slovo je samostatný interaktívny chip
- Drag & drop medzi barmi
- Drag do palety inšpirácie
- Horizontálna drop indikácia

### Analýza
- Detekcia duplikátov (zvýraznenie)
- Analýza rýmov
- Štatistiky textu (slová, riadky, slovná zásoba)

### Produktivita
- Quick-add do palety
- Import/export textu
- Multi-projekt podpora (až 5)
- Automatické ukladanie (localStorage)

---

## 🔧 RIEŠENIE PROBLÉMOV

| Problém | Príčina | Riešenie |
|---------|---------|----------|
| Vokály nepočuť | Hustá inštrumentácia | Pridať "clear prominent vocals" do štýlu |
| Digitálne artefakty | Systémová chyba | "clean mix, no static" + regenerovať |
| Generický výstup | Všeobecný prompt | Špecifikovať všetky 4 piliere |
| Zlé BPM | AI ignoruje čísla | Použiť "slow/fast tempo" alebo Suno Studio |

---

## 📚 OFFICIAL ZDROJE

- **Suno Help Center:** https://help.suno.com/en/
- **Suno Blog:** https://suno.com/blog
- **V5 Dokumentácia:** https://help.suno.com/en/articles/8105153
- **Suno Studio:** https://suno.com/blog/suno-studio
- **Discord komunita:** https://discord.gg/suno

---

*LBS v6.5 | Lyrical Blueprint Studio | © 2026*
