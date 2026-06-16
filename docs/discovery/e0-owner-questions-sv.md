# Frågor inför piloten (Fas A)

Datum: 2026-06-16
Källa: svensk omarbetning av [e0-owner-question-list.md](e0-owner-question-list.md)
Systerblad: [e0-accounting-tax-questions-sv.md](e0-accounting-tax-questions-sv.md)
(moms, ROT, grön teknik, avrundning) – hör till samma första våg som Prio 1.
Status/svarslogg: [owner-signoff-questions.md](../../_bmad-output/planning-artifacts/owner-signoff-questions.md)

Frågorna styr hur piloten byggs och testas. Många handlar om vad systemet ska
tvinga fram eller låsa (t.ex. när en offert blir oföränderlig), inte om smak.
Värden som kan ändras över tid (t.ex. ROT/moms) byggs som inställningar, inte fasta
tal. Frågorna är **ordnade efter när de behövs i bygget** (Prio 1 byggs först) och
numrerade per block – referera gärna med block + nummer (t.ex. "Block 3, fråga 2")
vid svar.

---

## PRIO 1 – Grunddata: kunder & kontakter

*(Byggs först. Skattebladet hör till samma våg.)*

### Block 1. Kunder & kontakter

1. Vilka kundtyper ska finnas? (t.ex. privatperson, företag, BRF, kommun/offentlig
   – exakt vilka?)
2. Vilka kundfält måste vara ifyllda för att det ska gå att skapa en offert-PDF?
3. Måste varje offert/jobb kopplas till en anläggning, eller valfritt för små
   jobb? Kan en kund ha flera anläggningar?
4. Ska kontaktpersoner höra till kunden, till en specifik anläggning, eller båda?
5. Ska systemet kräva en huvudkontakt per kund, per anläggning, eller inte alls?
   Kundtypen styr sannolikt berättigande till ROT/grön teknik, vilka fält som
   krävs (org.nr vs personnummer) och hur PDF:en ser ut.

---

## PRIO 2 – Kalkyl & offert

### Block 2. Pengar – visning & dolda rader

1. Vad ska visas på offert-PDF:en: pris exkl. moms, inkl. moms, eller båda?
2. Rader som är dolda för kunden i offerten – ska de ändå räknas med i totalsumman
   och i skatteavdragen (ROT/grön teknik), eller inte?

### Block 3. Kalkyl & offert

1. Ska kalkylens avsnitt kunna visas på olika sätt redan från start – detaljerat,
   sammanfattat och ren text – eller räcker ett sätt först?
2. Tillval: ska kunden kunna acceptera dem separat, eller bara visas som valfria
   tillägg?
3. Vilka marginalvarningar är användbara nog i en första version?
4. Ska offerter bara hanteras som PDF + manuell statusmärkning, eller ska det
   förberedas för att kunna mejla dem direkt från appen senare?

### Block 4. Offerter & numrering

1. Hur ska offertnumren se ut? (t.ex. 2026-001, OFF-1001, eller annat format)
   Ska numreringen börja om från 1 varje årsskifte?
2. Vad räknas exakt som att en offert är "skickad" – när PDF:en laddas ner, när
   den mejlas, eller när någon manuellt klickar "markera som skickad"? Och vem får
   göra det? (När den är skickad låses innehållet.)
3. Vilka statusar behöver en offert kunna ha? (t.ex. utkast, skickad, accepterad,
   förlorad/avböjd)

> Offertnumret hamnar i bokföring, avtal och mejl – det går inte att numrera om i
> efterhand, så formatet måste bestämmas nu. "Skickad" är den exakta tidpunkt då
> offerten låses; systemet behöver en entydig regel, eftersom den skickade
> versionen är den kunden förlitar sig på.

### Block 5. Bilagor & filer

1. Bilagor: vilka ska visas inne i offerten (t.ex. bilder i texten) och vilka ska
   ligga som bilaga sist (t.ex. PDF:er)?
2. Finns det några bilagor/filer som måste finnas innan en offert blir "tillåten"
   att skicka ut?
3. Finns det några filer som måste finnas innan det ska gå att registrera att
   kunden tackat ja?
4. När en offert skickas/accepteras – ska de utvalda filerna bli låsta permanent
   så det blir ett slags facit? Eller alltid gå att ta bort eller ändra i
   efterhand?

---

## PRIO 3 – Accept, jobb & övergång

### Block 6. Pris & att kunden tackar ja

1. Får det accepterade priset skilja sig från summan i den skickade offerten? Om
   ja – ska det krävas ett fält för förklaring/underlag?
2. Om man råkar registrera "kund tackade ja" två gånger på samma offert – ska
   systemet blockera andra försöket, bara visa det som finns, eller hantera det
   som en rättelse?

### Block 7. Jobb/order & filer

1. Vad ska det skapade jobbet kallas – jobb, order, projekt, arbetsorder, eller
   annat?
2. Ska alla accepterade offerter automatiskt skapa ett jobb, eller bara vissa?
3. Vilka fält måste vara ifyllda på det första jobb-/orderkortet?
4. Ska planerat start-/slutdatum kunna fyllas i redan när kunden tackar ja, eller
   kan det vänta?
5. Behövs ett samlat dokumentbibliotek, eller räcker det att filer ligger kopplade
   direkt till respektive kund/offert/jobb?

### Block 8. Övergång från gamla appen (Lovable)

1. Av all data i gamla appen – vilka uppgifter ska tas in som aktiva i piloten,
   vilka ska bara arkiveras, vilka ska uteslutas helt, och vilka ska vänta?
2. Vilka konkreta exempel (offerter/kalkyler) ska användas som "facit" för att
   kontrollera att nya appen räknar och fungerar likadant?

---

## ROADMAP – riktning på sikt (efter piloten)

> Dessa frågor styr inte vad som byggs nu. Flera områden är medvetet uppskjutna i
> Fas A (Fortnox, fältarbetar-UX, leverantörs-API:er, AI-jobb, HR, uthyrning,
> tillgångar, full behörighetsstyrning). Frågorna är bara för att kunna planera
> färdriktningen.

1. Vilka andra användarroller än administratör ska finnas på sikt? (t.ex. montör,
   säljare, ekonomi)
2. Hur ska ett mobilt arbetsflöde för montörer ute i fält se ut längre fram?
3. Vad ska montörer kunna rapportera – tid, material, avvikelser/ÄTA, foton?
4. Vilka leverantörsintegrationer är kommersiellt nödvändiga (t.ex.
   grossister/prislistor)?
5. Vilka extra moduler är affärsmässigt motiverade på sikt – AI-stöd, drift &
   underhåll (DoU), anbud/FKU, HR, uthyrning, tillgångar/QR, serviceavtal,
   garantier, analyser/statistik?
6. Behövs en kundportal där kunden själv accepterar offerter online? (En möjlig
   trevlig feature – ett accept rakt in i systemet.)
7. Hur ska affärsmodellen se ut längre fram? Abonnemang/prisnivåer, onboarding av
   nya företag, support, backup/återställning, och drift-/SLA-åtaganden?
8. Hur ska produktens UX se ut och kännas på sikt? T.ex. grafisk profil/varumärke,
   ljust/mörkt läge, mobilanpassning för fält, och om olika roller behöver olika
   vyer.
