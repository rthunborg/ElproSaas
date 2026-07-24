# Fas B — Beslut vi behöver från dig

**Datum:** 2026-07-20
**Från:** ElproSaas (Rasmus)

Fas B är igång. **Första epiken** (offertens livscykel — Förlorad/Avböjd-status,
uppföljningar och pipeline) är byggd och ligger i granskning. Nedan är besluten vi
behöver för att fortsätta bygga — med en **tidslinje** som visar *senast* när varje svar
behövs, uttryckt som vilken epic (byggsteg) som annars blockeras.

**Kort version:** ingenting hårdspärrar de närmaste stegen — E11–E13 byggs vidare på
dokumenterade standardval. **Första hårda stoppet är jobbmodellen (fråga 1) vid Epic 16.**
Skattefrågorna (separat blad till redovisning) behövs tekniskt först vid Epic 26, men
innan någon *skarp* ROT-offert går ut. Ett gemensamt arbetsmöte kan lösa allt på en gång.

---

## 1. Jobbmodellen ⏰ BRÅDSKANDE — behövs innan **Epic 16**

Detta är det första hårda stoppet och det som avgör hur hela jobb-/projektdelen byggs.

- Hur hänger **jobb / order / arbetsorder / projekt** ihop?
- Vilka fält är **obligatoriska på första jobbkortet**?

Vi har förberett tre alternativ (vi **rekommenderar A**, tekniskt byggt som C):

| Alt. | Modell | Kommentar |
| --- | --- | --- |
| **A** *(rek.)* | **Jobb** är behållaren, innehåller **arbetsorder**, kan uppgraderas till **projekt** (som låser upp projektfunktioner) | Matchar Lovable; parity-säkert |
| **B** | **Jobb** och **Projekt** är separata; ett projekt *grupperar* jobb | Renare men avviker från Lovable/migrering |
| **C** | En **enda entitet** med typ (order/projekt); "uppgradering" = revisionsspårat typbyte | Vår rekommenderade *implementation* av A |

Vårt förslag: kör **A som modell, C som teknik**. Bekräfta eller välj annat.

---

## 2. Migration — AVKLARAD (ingen datamigrering)

**Ägarbeslut 2026-07-20:** det blir **ingen datamigrering** från Lovable, någonsin.
När appen är redo för skarp användning börjar företaget använda den för **nya
jobb/projekt**; **befintliga pågående** jobb/projekt körs klart i **Lovable parallellt**
tills de är avslutade. De två apparna körs sida vid sida under övergången.

**Följd:** frågorna `8.1` (aktiv/arkiv/uteslut/vänta-klassning), `8.2` (golden masters
ur Lovable-data) och `N-1` (klassning runda 2 per modul) **behöver inga svar längre** —
det finns ingen import att klassa. Lovable-jämförelsen från Fas A står kvar som
**beteende-referens** (anonymiserade fixtures), aldrig som datainförsel. Cutover = "börja
med nya jobb i nya appen" — ett go-live-beslut, inte ett byggsteg.

---

## 3. Övriga beslut (N-2 … N-10)

| # | Fråga |
| --- | --- |
| **N-2** | Affärsmodell / pris per företag / provisioneringsflöde. Ska kunder kunna **registrera sig själva** eller sätter vi upp varje företag manuellt? |
| **N-3** | Mobilstrategi för fältarbetare. *(Vi rekommenderar responsiv webb först; native app som Fas C-alternativ.)* |
| **N-4** | Bekräfta rolluppsättningen — Admin, Projektledare, Montör, Säljare, Ekonomi + Arbetsledare per jobb — **och synlighet per roll**: får en Montör se priser? Får en Säljare se marginaler (TB)? |
| **N-5** | Fortnox: vilket konto/licens/API-åtkomst, och **vad ska ett faktureringsunderlag innehålla** (tid, material, fastpris/betalplansposter)? |
| **N-6** | E-postutskick: avsändardomän, avsändaradress, och **vilka flöden mailar först** (offertutskick? uppföljningspåminnelser? notissammandrag?). |
| **N-7** | Godkänn att **upphandling/FKU byggs som "tunn" manuell modul** i Fas B (organiserad filhantering + manuell sammanställning; AI-analysen = Fas C). |
| **N-8** | Vem levererar det riktiga **mall-innehållet** för DoU och egenkontroller (compliance-innehåll är er sida)? |
| **N-9** | Schemaläggnings-indata: arbetstidsmodell (anställningsgrad?), kapacitetsregler, hantering av helgdagar. |
| **N-10** | GDPR-/gallringshållning för HR:s raderingsflöde *(det fulla juridiska programmet ligger i Fas C)*. |

---

## Tidslinje — senast när varje svar behövs

| Fråga | Behövs senast (epic) | Hård/mjuk spärr |
| --- | --- | --- |
| **Jobbmodell (1)** | **E16 – Jobb** | 🔴 Hård — ADR-B006 blockerar E16–E18 |
| **N-9 schema-indata** | **E14 – Resurs/schema** | 🔴 Hård — krävs för konflikt-/kapacitetslogik |
| **N-3 mobilstrategi** | **E14** | 🟡 Mjuk — går på "responsiv webb" som standard |
| **N-4 roller + synlighet** | **E11 – RBAC** | 🟡 Mjuk — E11 bygger på försiktig standard, svaret finslipar matrisen |
| **N-2 affärsmodell / self-serve** | **E12 – Provisionering** | 🟡 Mjuk — admin-provisionering går utan svar; bara self-serve väntar |
| **N-6 e-postutskick** | **E13 – Notiser/e-post** | 🟡 Mjuk — infran byggs "mörk", svaret aktiverar utskick |
| **Skatt A/B/C + 2.2** *(separat blad)* | **E26 – Faktureringsunderlag** | 🔴 Hård — även innan skarp ROT-offert skickas |
| **N-5 underlagets innehåll** | **E26** | 🔴 Hård |
| **N-5 Fortnox konto/API** | **E33 – Fortnox** | 🔴 Hård (B2-spike förbereder) |
| **N-8 mall-innehåll** | **E27/E28 – DoU/egenkontroll** | Innehållet är er sida |
| **N-7 tunn upphandlingsmodul** | **E29 – Upphandling** | Synlighet — svara innan bygget |
| **N-10 GDPR/gallring HR** | **E31 – HR** | 🔴 Hård |
| ~~Migration 8.1/8.2 + N-1~~ | — | ✅ Avklarad — ingen datamigrering (§2) |

---

## Separat: skattefrågor till redovisning

Moms, ROT och grön teknik (block A/B/C) samt dolda rader (2.2) ligger i ett **separat
blad** avsett för redovisningsansvarig: `phase-b-accounting-tax-questions-sv.md`. Ramen är
redan satt (endast privat, ROT + grön kan inte blandas) — det som saknas är de exakta
satserna, taken och avrundningen.
