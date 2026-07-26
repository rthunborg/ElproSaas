# Rekommenderade standardvärden för elektrikerfakturor

Nedan är de standardvärden jag skulle implementera för svenska offerter och fakturor. Reglerna är kontrollerade mot vad som gäller den **25 juli 2026**.

## Block A — Moms och avrundning

### A.1 Avrundningsregel

**Rekommenderat svar:**

Belopp ska hanteras enligt en kombinerad modell:

1. Fakturaradens nettobelopp avrundas till **två decimaler**, alltså hela ören.
2. Beskattningsunderlaget summeras per momskategori och momssats.
3. Momsen beräknas och avrundas till två decimaler **på den summerade momskategorin**, inte separat på varje rad.
4. Fakturans totala moms är summan av momsbeloppen för respektive momskategori.
5. PDF och e-faktura ska som standard visa **två decimaler**.

Detta följer Peppol/EN 16931-modellen: radens nettobelopp har två decimaler, medan moms beräknas på dokumentets sammanlagda beskattningsunderlag per momskategori och avrundas till två decimaler.  
Källa: [Peppol Billing – BR-CO-17](https://docs.peppol.eu/poacc/billing/3.0/rules/ubl-tc434/BR-CO-17/)

**Rekommenderad systemstandard:**

```text
VatRoundingScope = PerVatCategoryAtDocumentLevel
CurrencyDecimals = 2
PayableRounding = None
```

Undvik alltså modellen där varje rads moms avrundas och de avrundade radmomsbeloppen sedan summeras. Den modellen kan ge ett annat resultat beroende på hur många rader fakturan delas upp i.

**Öresavrundning till hela kronor:** Ha stöd för detta, men aktivera det inte som standard. Om fakturans belopp att betala ska avrundas till hela kronor bör differensen ligga som ett separat dokumentbelopp, exempelvis **”Öresavrundning +0,37 kr”**. Den ska inte bakas in genom att moms eller fakturarader ändras. Skatteverket medger att slutsumman avrundas till hela kronor, men det är inte nödvändigt för elektroniska betalningar.  
Källa: [Skatteverkets rättsliga vägledning om avrundning](https://www4.skatteverket.se/rattsligvagledning/edition/2023.16/321578.html)

**Viktigt undantag:** Belopp som begärs från Skatteverket för ROT respektive grön teknik ska anges i **hela kronor, där öretal faller bort**. Det är alltså trunkering nedåt, inte vanlig avrundning till närmaste krona. På PDF-fakturan kan beloppet fortfarande visas som exempelvis `–3 750,00 kr`.  
Källa: [Lag (2009:194) om förfarandet vid skattereduktion för hushållsarbete](https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/lag-2009194-om-forfarandet-vid-skattereduktion_sfs-2009-194/)

---

### A.2 Momssats

**Rekommenderat svar:**

Standardmomssatsen ska vara **25 procent** för elektrikerarbete, material, service, installation och vanliga tillhörande kostnader.

ROT-avdrag och skattereduktion för grön teknik förändrar inte momssatsen. Momsen beräknas fortfarande på hela den momspliktiga försäljningen före skattereduktionen. Skatteverkets egna exempel för både elarbete med ROT och installation av grön teknik använder 25 procent moms.  
Källa: [Skatteverket – starta och registrera företag](https://www.skatteverket.se/foretag/drivaforetag/startaochregistrera/fordigsomvillstartaforetag.4.6e8a1495181dad540842251.html)

Det viktigaste undantaget är **omvänd betalningsskyldighet inom byggsektorn**. Elarbeten och elinstallationer som avser fastighet kan omfattas när köparen är ett byggföretag som mer än tillfälligt säljer relevanta byggtjänster, eller är en mellanman i en sådan försäljning. Fakturan ska då normalt ställas ut utan debiterad moms och innehålla köparens momsregistreringsnummer samt texten **”Omvänd betalningsskyldighet”**.  
Källa: [Skatteverket – omvänd betalningsskyldighet inom byggsektorn](https://www.skatteverket.se/foretag/moms/sarskildamomsregler/byggverksamhet/omvandbetalningsskyldighetinombyggsektorn.4.47eb30f51122b1aaad28000545.html)

Om material ingår som en del av byggtjänsten följer materialet byggtjänstens momshantering. Ren försäljning av varor omfattas däremot normalt inte av omvänd betalningsskyldighet.

Jag skulle därför inte modellera omvänd betalningsskyldighet som vanlig momssats `0 %`, utan som en egen momstyp:

```text
STANDARD_VAT_25
REVERSE_CHARGE_CONSTRUCTION
```

Samt eventuella framtida typer för exempelvis EU-försäljning eller momsbefrielse.

**Default:** `STANDARD_VAT_25`.

Det räcker inte att kunden är ett företag för att omvänd betalningsskyldighet ska gälla. Systemet bör därför kräva ett uttryckligt val eller en verifierad kundinställning.

---

## Block B — ROT-avdrag

### B.1 Sats

**Rekommenderat svar: 30 procent.**

ROT-avdraget är under 2026 högst **30 procent av den avdragsgrundande arbetskostnaden inklusive moms**. Den tillfälliga höjningen under delar av 2025 har upphört; från den 1 januari 2026 är satsen åter 30 procent.  
Källa: [Skatteverket – så fungerar ROT-avdraget](https://www.skatteverket.se/foretag/skatterochavdrag/rotochrut/safungerarrotavdraget.4.2ef18e6a125660db8b080002709.html)

```text
ROT_RATE = 0.30
```

---

### B.2 Tak

**Rekommenderat svar: 50 000 kr per person och kalenderår.**

ROT och RUT får tillsammans uppgå till högst **75 000 kr per person och år**, men av detta får högst **50 000 kr** vara ROT.  
Källa: [Skatteverket – ROT och RUT](https://www.skatteverket.se/foretag/skatterochavdrag/rotochrut.4.2ef18e6a125660db8b080002674.html)

Systemet bör alltså ha två gränser:

```text
ROT_MAX_PER_PERSON_YEAR = 50_000
ROT_RUT_COMBINED_MAX_PER_PERSON_YEAR = 75_000
```

Det bör också finnas ett fält för kundens uppgivna kvarvarande utrymme. Företaget kan normalt inte själv garantera hur mycket avdrag kunden faktiskt har kvar eller om kunden har betalat tillräckligt med skatt; kunden måste kontrollera detta hos Skatteverket.

---

### B.3 Underlag

**Rekommenderat svar: Arbetskostnaden inklusive moms.**

Endast arbetskostnaden är ROT-grundande. Material, resor, maskiner, administration och andra kostnader ska inte ingå. Skatteverket anger uttryckligen att avdraget görs på arbetskostnaden inklusive moms.  
Källa: [Skatteverket – så fungerar ROT-avdraget](https://www.skatteverket.se/foretag/skatterochavdrag/rotochrut/safungerarrotavdraget.4.2ef18e6a125660db8b080002709.html)

Vid vanlig 25-procentig moms:

```text
ROT-underlag inklusive moms
= ROT-grundande arbete exklusive moms × 1,25
```

Underlaget bör dock helst beräknas från den faktiska moms som hör till de ROT-grundande arbetsraderna, i stället för att alltid hårdkoda multiplikation med 1,25.

---

### B.4 Momsordning

**Rekommenderat svar: Ja, med två preciseringar.**

Korrekt ordning är:

1. Beräkna arbetskostnaden exklusive moms.
2. Beräkna moms på hela fakturan enligt vanliga momsregler.
3. Fastställ den ROT-grundande arbetskostnaden inklusive moms.
4. Beräkna 30 procent av detta underlag.
5. Begränsa beloppet efter varje persons kvarvarande ROT-utrymme.
6. Låt öretal falla bort i det slutliga ROT-belopp som ska begäras från Skatteverket.
7. Dra av ROT-beloppet från fakturans bruttobelopp för att få kundens betalningsbelopp.

För en faktura med 10 000 kr ROT-grundande arbete exklusive moms blir det:

```text
Arbete exkl. moms        10 000 kr
Moms 25 %                 2 500 kr
ROT-underlag inkl. moms  12 500 kr
ROT 30 %                  3 750 kr
```

Skatteverkets eget elektrikerexempel använder denna beräkningsprincip. Momsen redovisas på hela försäljningen; ROT-avdraget är i praktiken en uppdelning av betalningen mellan kunden och Skatteverket, inte en minskning av momsunderlaget.  
Källa: [Skatteverket – så fungerar ROT-avdraget](https://www.skatteverket.se/foretag/skatterochavdrag/rotochrut/safungerarrotavdraget.4.2ef18e6a125660db8b080002709.html)

Vid flera personer bör systemet först fastställa det maximala avdraget och därefter fördela det i **hela kronor** mellan personerna, så att summan av personbeloppen exakt motsvarar fakturans ROT-avdrag.

---

## Block C — Grön teknik

### C.1 Satser per kategori

**Rekommenderat svar:**

| Kategori | Sats |
|---|---:|
| Installation av solceller | **15 %** |
| System för lagring av egenproducerad el, exempelvis batteri | **50 %** |
| Laddningspunkt till elfordon | **50 %** |

Procentsatsen beräknas på avdragsgrundande arbete och material inklusive moms.  
Källa: [Skatteverket – så fungerar skattereduktionen för grön teknik](https://www.skatteverket.se/foretag/skatterochavdrag/gronteknik/safungerarskattereduktionenforgronteknik.4.676f4884175c97df4192a52.html)

Rekommenderade konfigurationsvärden:

```text
GREEN_SOLAR_RATE = 0.15
GREEN_STORAGE_RATE = 0.50
GREEN_CHARGING_RATE = 0.50
```

Om samma projekt innehåller exempelvis både solceller och batterilagring måste underlaget delas upp per kategori innan respektive procentsats används.

Samma installationsdel får inte samtidigt ligga till grund för både ROT och grön teknik.

---

### C.2 Tak

**Rekommenderat svar: 50 000 kr per person och kalenderår.**

Taket för grön teknik är **50 000 kr per person och år**. Det är ett separat tak från ROT/RUT-systemet; en person kan därutöver få ROT och RUT för andra arbeten enligt deras sammanlagda tak.  
Källa: [Skatteverket – grön teknik för privatpersoner](https://www.skatteverket.se/privat/fastigheterochbostad/gronteknik/safungerarskattereduktionenforgronteknik.4.676f4884175c97df4192870.html)

```text
GREEN_MAX_PER_PERSON_YEAR = 50_000
```

Även här bör systemet behandla beloppet som ett maximalt preliminärt avdrag. Kunden måste ha tillräckligt skatteutrymme och faktiskt kvarvarande grön-teknik-avdrag.

---

### C.3 Schablon

**Rekommenderat svar: Ja, men endast vid en riktig totalentreprenad till fast pris.**

Vid installation av grön teknik till ett fast totalpris får arbete och material schablonmässigt beräknas till **97 procent av totalpriset inklusive moms**. Resterande **3 procent** anses avse övriga, icke avdragsgrundande kostnader.

Beräkningen blir då:

```text
Avdragsgrundande underlag
= installationens totalpris inkl. moms × 0,97

Skattereduktion
= avdragsgrundande underlag × kategorins procentsats
```

Exempel för laddbox:

```text
Totalpris inklusive moms       20 000 kr
Underlag enligt 97 %-schablon  19 400 kr
Grön teknik, 50 %               9 700 kr
```

Schablonen ska inte användas generellt på alla fakturor. Den gäller när installationen är en **totalentreprenad till fast pris**. Om fakturan eller kalkylen redan har tillförlitliga faktiska belopp för arbete, material och övriga kostnader ska de verkliga avdragsgrundande arbets- och materialkostnaderna användas i stället, utan någon ytterligare reducering med 3 procent.  
Källa: [Skatteverket – så fungerar skattereduktionen för grön teknik](https://www.skatteverket.se/foretag/skatterochavdrag/gronteknik/safungerarskattereduktionenforgronteknik.4.676f4884175c97df4192a52.html)

Rekommenderad systemmodell:

```text
GREEN_BASIS_METHOD =
    ACTUAL_ELIGIBLE_COSTS
    eller
    FIXED_PRICE_97_PERCENT_STANDARD
```

Default bör vara `ACTUAL_ELIGIBLE_COSTS`. Användaren ska aktivt välja 97-procentschablonen när villkoren för fast totalentreprenad är uppfyllda.

Precis som för ROT ska det slutliga beloppet som begärs från Skatteverket anges i hela kronor med öretal borttagna.  
Källa: [Lag (2020:1066) om förfarandet vid skattereduktion för installation av grön teknik](https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/lag-20201066-om-forfarandet-vid-skattereduktion_sfs-2020-1066/)

---

## Block D — Dolda rader

### 2.2 Dold kalkylrad

**Rekommenderat svar:**

En rads synlighet ska inte i sig styra om den räknas ekonomiskt.

Om ”dold” endast betyder att detaljraden inte visas för kunden, men kostnaden ingår i ett synligt paketpris eller totalsumma, ska raden:

- räknas med i totalen, och
- räknas med i avdragsunderlaget endast om dess kostnadstyp är avdragsgrundande.

Det betyder exempelvis:

| Typ av dold rad | I totalen | I ROT-underlag | I underlag grön teknik |
|---|---:|---:|---:|
| Debiterat elektrikerarbete | Ja | Ja, om arbetet är ROT-godkänt | Ja, om arbetet ingår i godkänd installation |
| Debiterat material | Ja | Nej | Ja, om materialet ingår i godkänd installation |
| Resa, bil, maskin eller administration | Ja | Nej | Nej |
| Intern kostnadsrad som inte debiteras kunden | Nej | Nej | Nej |
| Kostnadsdel inbakad i ett synligt fast paketpris | Ja, genom paketpriset | Enligt faktisk arbetsdel | Enligt faktisk fördelning eller 97 %-schablon |

Det nuvarande antagandet **”dolda rader räknas alltid med i både total och avdragsunderlag”** bör alltså ändras. Det är korrekt för totalen när raden är debiterbar, men inte automatiskt korrekt för skattereduktionen.

Systemet bör skilja på minst tre separata egenskaper:

```text
VisibleToCustomer
IncludedInInvoiceTotal
DeductionClassification
```

Exempel på `DeductionClassification`:

```text
NONE
ROT_LABOR
GREEN_SOLAR_LABOR
GREEN_SOLAR_MATERIAL
GREEN_STORAGE_LABOR
GREEN_STORAGE_MATERIAL
GREEN_CHARGING_LABOR
GREEN_CHARGING_MATERIAL
```

På kundens faktura behöver de dolda detaljraderna inte nödvändigtvis visas var för sig, men det ska finnas synliga sammanställningar som gör att fakturan går ihop och som skiljer på:

- arbete,
- material,
- övriga kostnader,
- moms,
- ROT eller grön teknik,
- kundens belopp att betala.

Skatteverket anger att arbete, material och övriga kostnader ska hållas isär för både ROT och grön teknik.  
Källa: [Skatteverket – så fungerar ROT-avdraget](https://www.skatteverket.se/foretag/skatterochavdrag/rotochrut/safungerarrotavdraget.4.2ef18e6a125660db8b080002709.html)

---

## Sammanfattade defaultvärden

```text
VAT_DEFAULT_RATE                         = 25 %
VAT_ROUNDING                             = Per VAT category at document level
DISPLAY_CURRENCY_DECIMALS                = 2
DEFAULT_PAYABLE_ROUNDING                 = None

ROT_RATE                                 = 30 %
ROT_MAX_PER_PERSON_YEAR                  = 50 000 SEK
ROT_RUT_COMBINED_MAX_PER_PERSON_YEAR     = 75 000 SEK
ROT_BASIS                                = Eligible labor including VAT

GREEN_SOLAR_RATE                         = 15 %
GREEN_STORAGE_RATE                       = 50 %
GREEN_CHARGING_RATE                      = 50 %
GREEN_MAX_PER_PERSON_YEAR                = 50 000 SEK
GREEN_DEFAULT_BASIS_METHOD               = Actual eligible labor and material
GREEN_FIXED_PRICE_ELIGIBLE_SHARE         = 97 %

HIDDEN_ROW_INCLUDED_IN_TOTAL             = Depends on billable status
HIDDEN_ROW_INCLUDED_IN_DEDUCTION         = Depends on deduction classification
TAX_REDUCTION_CLAIM_ROUNDING             = Whole SEK, discard cents
```

Satser, tak och beräkningsregler bör lagras med `ValidFrom` och `ValidTo`, inte som permanenta konstanter. För ROT är det dessutom **kundens betalningsdatum**, inte fakturadatumet, som avgör vilket beskattningsår avdraget hör till.  
Källa: [Skatteverket – så fungerar ROT-avdraget](https://www.skatteverket.se/foretag/skatterochavdrag/rotochrut/safungerarrotavdraget.4.2ef18e6a125660db8b080002709.html)
