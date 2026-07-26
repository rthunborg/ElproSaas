---
created: 2026-06-14
project: ElproSaas
phase: Phase A - Internal Pilot MVP
status: prio1-2-answered-working-session-pending
purpose: >
  Living tracker for the owner / accounting decisions that gate Phase A. Question
  IDs are kept identical to the Swedish email so answers map 1:1. Resolves the open
  items in the PRD Owner Questions list and the Assumption Register (A6-A29).
source_documents:
  - _bmad-output/planning-artifacts/prd.md  # Owner Questions, Assumption Register
  - docs/discovery/e0-owner-questions-sv.md  # the outgoing email (IDs match this)
  - docs/discovery/e0-accounting-tax-questions-sv.md  # tax sheet (Blocks A-D)
sent_to_owner: 2026-06-16
answers_received: 2026-06-18  # full email reply from co-owner; logged below
---

# Owner Sign-Off Questions And Answers

This tracks the business decisions that gate Phase A. **Question IDs match the
Swedish email exactly** (`docs/discovery/e0-owner-questions-sv.md` + the tax sheet),
so an answer maps straight to a row: "Block 3, fråga 2" → `3.2`.

The owner sent a full reply on **2026-06-18**. Most Prio 1-2 questions are answered
crisply; a cluster of items was deferred to a **phone call / working session**, and
the tax rates (`A`–`C`) he wants to set "tillsammans". Remaining work is in the
*Working session agenda* and *Scope decisions* sections below.

Conventions: IDs are stable; pilot is internal test only (legal/GDPR/customer-facing
items deferred to full release). Status: `open` → `answered` → `signed-off`
(or `partial` / `möte` = needs the working session / `parked`).

## Answers (reply 2026-06-18)

### Prio 1 — Block 1: Kunder & kontakter — Epic 3

| ID | Question | Answer | Status |
| --- | --- | --- | --- |
| 1.1 | Kundtyper | Privatperson, företag, BRF, kommun/offentlig (dessa 4) | answered |
| 1.2 | Obligatoriska fält för offert-PDF | "Kundrelevant info"; styrs av kundtyp (privat → personnr, företag → org.nr). Behöver en konkret fältlista. | partial |
| 1.3 | Anläggning obligatorisk / flera per kund | Stöds som naturlig del; flera anläggningar per kund; ej tvingande att aktivt jobba i på varje kund | answered |
| 1.4 | Kontakt: kund / anläggning / båda | Båda; flera kontakter; knyts fritt till anläggning/jobb/projekt; ej tvingad fast kontakt | answered |
| 1.5 | Huvudkontakt tvingande | Ej per kund/anläggning. MEN jobb & offert (+ verktyg som egenkontroll) MÅSTE knytas till anläggning + specifik kontaktperson | answered |

### Prio 2 — Block 2: Pengar – visning & dolda rader — Epic 4-6

| ID | Question | Answer | Status |
| --- | --- | --- | --- |
| 2.1 | PDF moms-visning | Valbart. Default: **privat måste alltid se momssats + momssumma + ink-moms-total**; företag kan togglas. Ref: hans Lovable-offert. | answered |
| 2.2 | Dolda rader i total/avdrag | **OMPRÖVAT 2026-07-26:** synlighet styr INTE ekonomisk inräkning. En dold rad räknas i TOTALEN om den är debiterbar, men i AVDRAGSUNDERLAGET **endast om dess kostnadstyp är avdragsgrundande** (material ⇒ ej ROT; resa/maskin/adm ⇒ varken ROT eller grön). Kräver tre separata egenskaper: `VisibleToCustomer`, `IncludedInInvoiceTotal`, `DeductionClassification`. | **answered (2026-07-26)** ⚠ ändrar shippat antagande |

### Prio 2 — Block 3: Kalkyl & offert — Epic 5-6

| ID | Question | Answer | Status |
| --- | --- | --- | --- |
| 3.1 | Visningslägen | Steg 1: **detaljerat** (från kalkyl) + ett läge som döljer detta och bara visar **fritext**. (Sammanfattat kan vänta.) | answered |
| 3.2 | Tillval/optioner | Accepteras **endast tillsammans med basen**; kund kan välja vilka optioner (t.ex. 1 & 3, ej 2) | answered |
| 3.3 | Marginalvarningar | **TB%** mot en global tröskel under systeminställningar | answered |
| 3.4 | PDF vs mejl | Vill kunna **maila direkt från appen**. ⚠ Scope: e-post var Fas A non-scope — se Scope decisions. | answered (scope) |

### Prio 2 — Block 4: Offerter & numrering — Epic 6

| ID | Question | Answer | Status |
| --- | --- | --- | --- |
| 4.1 | Offertnummerformat | Spelar mindre roll, bara **unikt** (systemet väljer format) | answered |
| 4.2 | "Skickad"-händelse + vem | Någon av de nämnda; syftet är att trigga dashboard-/återkopplingsfunktion (vi väljer den exakta låsregeln) | answered |
| 4.3 | Statusar | **Utkast, Skickad, Accepterad, Förlorad/Avböjd, Arkiverad** | answered |

### Prio 2 — Block 5: Bilagor & filer — Epic 6, 8

| ID | Question | Answer | Status |
| --- | --- | --- | --- |
| 5.1 | Bilaga inne vs sist | Valbart; bilagor från kalkyl följer med till offert; **default = ingen ibockad** för medskick; kunna bocka i + välja ordning | answered |
| 5.2 | Filer krävda före skicka | Nej | answered |
| 5.3 | Filer krävda före accept | Nej för pilot; manuell accept-dialog (metod + datum). Framtid: BankID-/portal-signering. | answered |
| 5.4 | Frysa filer | Ja — medskickade filer ska **dubbleras & låsas**, namngivna till offerten. Bad om förslag → se *Design note*. | answered (design) |

### Prio 3 — Block 6: Pris & att kunden tackar ja — Epic 7

| ID | Question | Answer | Status |
| --- | --- | --- | --- |
| 6.1 | Accepterat pris ≠ offert | Ja (prut, av-/tillkommer). Motiveringsfält motiverat. | answered |
| 6.2 | Dubbel-ja | Hantera som **rättelse**, varsamt + med **loggar** | answered |

### Prio 3 — Block 7: Jobb/order & filer — Epic 7-8

| ID | Question | Answer | Status |
| --- | --- | --- | --- |
| 7.1 | Vad jobbet kallas | "**Jobb**". Struktur BESVARAD 2026-07-26: **Alternativ A som modell, C som teknik** — Jobb är behållaren, innehåller arbetsorder, kan uppgraderas till projekt; implementeras som EN typad entitet (`type ∈ {order, projekt}`, uppgradering = revisionsspårat typbyte). | **answered (2026-07-26)** |
| 7.2 | Auto-skapa jobb | Ja | answered |
| 7.3 | Fält första jobbkortet | Följer av 7.1 + N-9:s jobbindata (uppskattad tid, tidigaste start, önskat/senast slutdatum, prioritet, antal personer, kompetenskrav, plats, beroenden, restid, projektledare, arbetsledare, kund på plats, åtkomstfönster). | **answered (2026-07-26)** |
| 7.4 | Planerat start/slut vid accept | **Direkt** (ja) | answered |
| 7.5 | Dokumentbibliotek | **Samlat** vore bäst. ⚠ Scope: Fas A = begränsat index, ej brett dok-center — se Scope decisions. | answered (scope) |

### Prio 3 — Block 8: Övergång — Epic 9

| ID | Question | Answer | Status |
| --- | --- | --- | --- |
| 8.1 | Migration-klassning | Per telefon | öppen (möte) |
| 8.2 | Facit-exempel | Per telefon | öppen (möte) |

### Tax sheet (Blad 2) — Blocks A-D — Epic 4

| ID | Question | Answer | Status |
| --- | --- | --- | --- |
| A.1 | Avrundning + PDF-visning | **Moms avrundas PER MOMSKATEGORI på DOKUMENTNIVÅ** (Peppol/EN 16931 BR-CO-17), ej per rad. Radnetto 2 decimaler; PDF 2 decimaler; öresavrundning stöds men EJ default (separat dokumentrad). **ROT/grön-belopp som begärs från SKV: hela kronor, öretal TRUNKERAS bort.** | **answered (2026-07-26)** ⚠ ändrar shippad implementation |
| A.2 | Moms-sats idag | **25 %** standard. Skattereduktion ändrar EJ momssatsen. **Omvänd betalningsskyldighet i byggsektorn ska modelleras som EGEN momstyp** (`STANDARD_VAT_25` / `REVERSE_CHARGE_CONSTRUCTION`), inte som 0 %. | **answered (2026-07-26)** ⚠ ny funktion |
| B.1-B.4 | ROT: sats/tak/underlag/moms | **B.1 30 %** (den tillfälliga höjningen upphörde 2026-01-01). **B.2 tak 50 000 kr/person/år**, ROT+RUT tillsammans max 75 000. **B.3 underlag = arbetskostnad INKL. moms** (ej material/resa/maskin/adm). **B.4 ordningen bekräftad**; vid flera personer fördelas avdraget i HELA kronor. | **answered (2026-07-26)** |
| C.1-C.3 | Grön teknik: satser/tak/schablon | **C.1 solceller 15 %, lagring 50 %, laddpunkt 50 %** (på arbete+material inkl. moms, uppdelat per kategori). **C.2 tak 50 000 kr/person/år, SEPARAT från ROT/RUT.** **C.3 97 %-schablon endast vid TOTALENTREPRENAD TILL FAST PRIS**; default `ACTUAL_ELIGIBLE_COSTS`. | **answered (2026-07-26)** |
| D.1 | Berättigade kundtyper | **Endast privatpersoner** | answered |
| D.2 | BRF berättigad? | **Nej** (endast privat) | answered |
| D.3 | ROT + grön kombination | **Får inte blandas** | answered |

### Roadmap (deferred)

| ID | Question | Answer |
| --- | --- | --- |
| Roadmap 1 | Roller | Admin, Projektledare, Montör (Arbetsledare utses på Jobb), Säljare, Ekonomi |
| Roadmap 2 | Mobilt fältflöde | Löses tillsammans (du / owner / Alex) |
| Roadmap 3 | Fältrapportering | Alla relevanta delar för ett jobb |
| Roadmap 4 | Leverantörsintegrationer | Ahlsell, Rexel, Solar, Sonepar |
| Roadmap 5 | Extra moduler | Gemensamt beslut |
| Roadmap 6 | Kundportal / online-accept | "Hade varit guld" (önskad) |
| Roadmap 7 | Affärsmodell | Gemensamt beslut efter möte |
| Roadmap 8 | Långsiktig UX | Möte med Alex när vi är redo |

## Working session agenda (close the remaining gates)

The owner deferred these to a call/meeting. Grouped:

- **A. Skatteregler & priser (KRITISKT — Epic 4 gate):** ROT/grön teknik exakta
  %-satser, tak per person, schablon, underlag; avrundningsregel (`A.1`) och
  moms-sats (`A.2`). Ramen är satt: endast privat, ROT och grön kan inte blandas.
- **B. Dolda rader (`2.2`):** exakt hur de räknas i total + ROT/grön-underlag.
- **C. Jobb-modellen (`7.1`, `7.3`):** hur jobb / order / arbetsorder / projekt
  hänger ihop; obligatoriska fält på första jobbkortet.
- **D. Migration & facit (`8.1`, `8.2`):** vilken Lovable-data som tas in
  (aktiv/arkiv/uteslut/vänta) och vilka offerter/kalkyler som blir golden masters.
- **E. (Separat) Möte med Alex:** UX-riktning, roadmap, affärsmodell, moduler.

Also capture: the **Lovable quote** the owner referenced for `2.1` VAT-display
behavior (use as an oracle fixture, anonymized).

## Scope decisions surfaced by the reply

The owner asked for two things Phase A had deliberately scoped down. Decide before
the affected story:

1. **E-post direkt från appen (`3.4`)** — Phase A lists email sending as Epic 6
   *non-scope*. Options: (a) pull it into pilot scope via an ADR/scope re-approval,
   or (b) build the architectural seam now and add sending later. Recommend (b) for
   the pilot unless the owner needs live sending day one.
2. **Samlat dokumentbibliotek (`7.5`)** — Phase A Story 8.5 is a *limited* file
   index, explicitly *not* a broad document center. Options: keep limited for the
   pilot (entity-scoped + light index) or expand. Recommend keeping limited for the
   pilot, designed so a fuller library can layer on later.
3. BankID-/portal-signering (`5.3`) and customer portal (Roadmap 6) are already
   deferred — no action now, just kept on the roadmap.

## Design note — `5.4` file snapshot locking (owner asked for an idea)

The owner's instinct is right and already matches the architecture: at **send**,
the system freezes the quote version and stores a **locked copy** of (a) the
generated PDF and (b) each selected attachment, against that quote version, with a
deterministic name (e.g. `offertnr + version + originalfilnamn`). The working/calc
files stay editable; the sent copies cannot be replaced or deleted through normal
paths (archive-only, audited). That is the "facit" he wants. Planned as Story 6.3
(PDF stored to the quote version) + Story 8.4 (quote/attachment/evidence locks).

## Answered earlier (2026-06-16 — removed from the email before send)

| Relates to | Question | Answer | Assumption |
| --- | --- | --- | --- |
| Block 1 | Utelämna personnummer? | **Nej – personnummer krävs** (ändrar AR16/NFR16; bekräftat: privat ROT kräver personnr) | AR16/NFR16 |
| Block 3 | Återanvändbart artikelregister? | Ja | A8 |
| Block 3 | Arbete via roller eller fritt? | Båda | A8 |
| Block 3 | Vilka radtyper viktigast | Alla lika viktiga | — |
| Block 5/7 | Vem får radera/återställa filer | Alla med admin-roll | — |
| Block 6 | Acceptbevis-kanaler | Alla giltiga + valfri filuppladdning | A14 |
| Block 4/inställningar | Villkorstext + godkännare | Platshållartext räcker för piloten | A22 |
| Block 7 | Filtyper / maxstorlek | Alla vanliga filtyper; rimlig gräns i större spannet | — |
| Block 8 | Hur länge gamla appen parallellt | Tills allt är helt överflyttat | A18 |
| Block 8 | Cutover-kriterium | Minst all funktionalitet som Lovable-appen har | A18 |
| Roadmap | Faktureringsunderlag före Fortnox | Ja, behövs | A24 |
| (Block 0, utgår) | En eller flera administratörer | En i piloten; bygg för fler | — |

## Parked for full-release scoping (out of the internal pilot)

- Estimate-vs-promised-reduction wording for tax deductions — A20/A21
- Customer-facing disclaimer text — A22
- Authoritative accounting/legal source / who owns the tax numbers — NFR15
- GDPR / retention treatment for personnummer and free-text notes

## Assumption change — personnummer

The owner confirmed the system **must support personal numbers (personnummer)** —
reinforced by the 2026-06-18 reply that **only private individuals are ROT/grön
teknik eligible**, and ROT requires personnummer for Skatteverket. This reverses the
conservative architecture assumption (AR16 / NFR16: omit personnummer by default —
note AR16/NFR16, not PRD A16 which is job terminology). In scope for the pilot;
implementation (Story 3.1) keeps the private, tenant-owned, access-controlled
handling from the security guardrails. Full GDPR/retention deferred to full release.

## Phase B additions (2026-07-18 party session)

Phase B was shaped and team-ratified in
`phase-b-party-session-2026-07-18.md` (its §9 is the authoritative delta;
condensed here). The carried möte items above are **unchanged but now also gate
Phase B design**: `7.1`/`7.3` gate the B1b Jobs epics (options A/B/C prepared in
the session doc §9.2); tax blocks `A`–`C` additionally bound billing-basis (E26)
correctness sign-off; `8.1`/`8.2` gain a per-module classification round 2 (N-1).
One working session can clear both sets.

| ID | Question | Gates |
| --- | --- | --- |
| N-1 | Migration classification **round 2**: live/archive/excluded per B module (rentals, assets, service, DoU, self-inspections, tenders, HR, time data) | Each B2/B3 module's migration story |
| N-2 | Business model / per-company pricing / provisioning flow (Roadmap 7) | Self-serve signup scope in E12 (admin provisioning proceeds regardless) |
| N-3 | Mobile posture for field workers (team rec: responsive web first; native = Phase C option) | B1b field UX (E14-E16) |
| N-4 | Confirm role set as RBAC seed: Admin, Projektledare, Montör, Säljare, Ekonomi + per-job Arbetsledare — incl. per-role money/sensitive-field visibility | E11 permission-matrix seed |
| N-5 | Fortnox prerequisites: account/licenses, API access, first flows, and the content definition of a faktureringsunderlag | E26 shape; E33/E34 |
| N-6 | Email sending activation: domain, from-address, which flows email first | E13 |
| N-7 | Accept the tenders/FKU **thin** manual core as Phase B parity (full value = Phase C) | E29 (visibility item) |
| N-8 | Who supplies real DoU + self-inspection template content | E27/E28 |
| N-9 | Scheduling inputs: work-hours model, capacity rules, public-holiday handling | E14 |
| N-10 | GDPR/retention posture for the HR deletion-request workflow (full legal program stays Phase C) | E31 |

## Appendix — Swedish email status

Drafted 2026-06-14 (never sent), revised, and **sent 2026-06-16**; full reply
received **2026-06-18**. The Swedish email lives in
`docs/discovery/e0-owner-questions-sv.md` (owner) and
`docs/discovery/e0-accounting-tax-questions-sv.md` (tax). Those sheets are the
outgoing artifact; this list stays the system of record for assumption sign-off.

## Svar mottagna 2026-07-26 — N-2…N-10 + skatteblocket (källfiler: owner_questions_response.md, accountant_questions_response.md)

**Alla tidigare öppna möte-punkter är nu besvarade utom `8.1`/`8.2`, som är UTGÅNGNA
(ingen datamigrering — ägarbeslut 2026-07-20). Fas B har därmed inga kvarvarande
hårda ägargrindar.** Svaren nedan är dock inte enbart bekräftelser — tre av dem
ÄNDRAR redan levererad eller planerad funktionalitet, se "⚠ Konsekvenser" sist.

| ID | Beslut (kort) |
| --- | --- |
| **Jobbmodell** | **A som modell, C som teknik** — precis teamets rekommendation. Låser upp E16-E18 och ADR-B006. |
| **N-2** | INGEN självregistrering. Interna grundare provisionerar efter avtal. AI-assisterat men **deterministisk provisioneringstjänst** — agenten är gränssnitt/orkestrerare, får INTE generell DB-åtkomst eller godtycklig SQL i produktion. Strukturerad, versionshanterad onboardingmall (≈17 fält). Flödet ska vara validerat, **idempotent**, dry-run-bart, revisionsloggat och säkert att köra om efter partiellt fel. Prismodell: fast månadsavgift + tillägg per användare/modul; priser i DATA (`SubscriptionPlan`, `IncludedUsers`, `CommercialOverrides` …), aldrig hårdkodade. |
| **N-3** | ⚠ **PWA med OFFLINE-stöd** — inte "responsiv webb först". Installerbar, offline för tilldelade jobb, tid, material, checklistor, avvikelser, foton; lokal kö + synk med `SavedLocally/WaitingForSync/Syncing/Synced/Conflict/Failed`, **idempotenta skrivningar med operations-ID**, append-only för tidrader/material, optimistisk låsning för delade objekt, minimerad + tidsbegränsad lokal lagring. Native app INGÅR INTE. |
| **N-4** | Roller bekräftade (Företagsadmin, Projektledare, Montör, Säljare, Ekonomi) + **Arbetsledare som JOBB-/PROJEKTBUNDET uppdrag, inte global roll**; flera roller samtidigt. Behörighetsmodell i 4 dimensioner (resurs, handling, dataomfattning, känsliga fältgrupper) med namngivna nycklar. **Montör ser INTE pris/självkostnad/TB. Säljare ser försäljningspris men INTE TB** (separat nyckel `Economy.ViewContributionMargin`). Serverside-kontroll; **deny-by-default**. Kundspecifika roller endast av oss internt i v1; alla ändringar revisionsloggas. |
| **N-5** | Fortnox Developer Portal ansökt. **OAuth2 Authorization Code Flow, per kundföretag** (aldrig delade credentials). Scopes initialt `companyinformation, customer, article, invoice`. **Vårt system = master för faktureringsunderlaget; Fortnox = master för faktura/nummer/bokföring/betalning.** Ingen automatisk bokföring/utskick i v1. Detaljerat radinnehåll för tid/material/fastpris/betalningsplan/övrigt + statusflöde Draft→…→Invoiced; godkänd version låst mot ändring. |
| **N-6** | Central verifierad avsändardomän (`notify.<system>.se`); `[Företag] via [System]` som visningsnamn, **Reply-To = kundföretagets adress**. Prioritetsordning: inbjudningar/säkerhet → offertutskick → accept/avslag-notis → jobbtilldelning → offertpåminnelse → sammandrag. **Påminnelser stoppas automatiskt** vid accept/avslag/återkallelse/ny version/utgång. Fakturautskick sker från FORTNOX (undvik dubbla mejl). Full leveranslogg. |
| **N-7** | ✅ Tunn manuell upphandlings-/FKU-modul ACCEPTERAD som Fas B-parity; AI-analys uttryckligen Fas C. |
| **N-8** | **Johan Ahlström utsedd innehållsägare** för DoU/egenkontroll-innehåll. Vi levererar mallmotor/versionshantering/flöde; han levererar och godkänner fack- och compliance-innehållet. `ContentOwnerUserId` ska vara en KONFIGURERBAR användarreferens, aldrig ett hårdkodat namn. Utvecklingsteamet får INTE själv formulera innehåll som framställs som juridiskt/eltekniskt korrekt. |
| **N-9** | Schemaläggning på **faktiskt veckoschema**, inte enbart anställningsgrad (80 % kan vara 4 heldagar ELLER 5 korta). Kapacitet = schemalagd tid − helgdagar − frånvaro − bokningar − blockerad tid − buffert. Övertid ej ordinarie kapacitet. Överbokning tillåts men varnar. Central svensk helgdagskalender + företagsspecifika stängda dagar. Ingen automatisk optimering krävs i Fas B. |
| **N-10** | Fas B ska ha teknisk GRUND för datalivscykel: `RetentionCategory`, `RetentionUntil`, `LegalHold`, `AnonymizedAt` m.fl. + raderingsärende-statusar (Received→…→Closed). Gäller ALLA identifierbara personer (även kontaktpersoner, UE, personer på foton). Vanliga admins får INTE hårdradera. Gallringstider i **central versionshanterad policy**, ej utspridda konstanter. |

### ⚠ Konsekvenser — tre svar ändrar redan levererad/planerad funktionalitet

1. **A.1 momsavrundning ÄNDRAR den shippade motorn.** Nuvarande implementation
   (architecture §10 "Rounding") avrundar moms **per rad** och summerar avrundade
   radbelopp. Revisorn föreskriver **avrundning per momskategori på dokumentnivå**
   (Peppol/EN 16931 BR-CO-17) och varnar uttryckligen för radmodellen, eftersom den
   ger olika resultat beroende på hur fakturan delas upp i rader. Detta berör
   `@/lib/money`/`@/lib/tax`, quote-snapshots och alla golden-master-fixtures.
2. **2.2 dolda rader ÄNDRAR ett shippat antagande.** Systemet antar idag "dolda rader
   räknas alltid med i BÅDE total och avdragsunderlag". Rätt regel: total = ja om
   debiterbar; avdragsunderlag = **endast om kostnadstypen är avdragsgrundande**
   (material ⇒ ej ROT). Kräver tre separata egenskaper och en
   `DeductionClassification`-uppsättning per rad.
3. **N-3 PWA + offline är en VÄSENTLIG scope-utökning** mot den ledgerade gissningen
   ("responsiv webb först"). Offline-kö, synkstatusar, idempotenta skrivningar och
   konflikthantering är arkitektur, inte finish — påverkar B1b:s fältflöden och
   förmodligen ADR-nivå.

Dessutom NYTT: **omvänd betalningsskyldighet** (A.2) som egen momstyp, **ROT/grön-belopp
trunkeras till hela kronor**, **ROT+RUT-gemensamt tak 75 000**, och satser/tak ska lagras
med `ValidFrom`/`ValidTo` — inte som konstanter. För ROT styr dessutom **kundens
betalningsdatum**, inte fakturadatumet, vilket beskattningsår avdraget hör till.
