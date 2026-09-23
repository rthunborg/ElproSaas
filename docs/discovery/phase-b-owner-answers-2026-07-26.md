#Svar på frågan jobbmodellen. 

Gällande jobbmodellen kör vi på A som modell och C som teknik. 

# Svar på kompletterande systemfrågor N-2–N-10
## N-2 — Affärsmodell, pris per företag och provisioneringsflöde

Vi kommer inte att erbjuda självregistrering för kundföretag. Varje nytt kundföretag registreras och provisioneras internt av oss som utvecklare och grundare efter att avtal har ingåtts.

Provisioneringen bör vara **AI-assisterad men tekniskt kontrollerad**. Det lämpligaste upplägget är en strukturerad och versionshanterad onboardingmall som vi fyller i och skickar till en intern AI-agent. Mallen bör inte enbart bestå av fri text, utan ha definierade fält som agenten kan omvandla till en validerad provisioneringsbegäran.

Onboardingmallen bör minst innehålla:

- juridiskt företagsnamn,
- organisationsnummer och momsregistreringsuppgifter,
- adress och huvudsakliga kontaktuppgifter,
- språk, tidszon och valuta,
- namn och e-postadress för företagets första administratör,
- abonnemangsplan,
- antal inkluderade användare,
- aktiverade moduler och funktionsflaggor,
- avtalsstart och eventuell provperiod,
- företagets logotyp och grundläggande profilinställningar,
- faktura-, offert- och nummerserieinställningar,
- standardinställningar för moms, ROT och grön teknik,
- avsändar- och Reply-To-adresser för e-post,
- eventuella Fortnox-inställningar,
- företagets grundschema och kalenderinställningar,
- eventuella initiala användare, roller eller data som ska importeras.

Det rekommenderade flödet är:

1. En grundare eller utvecklare fyller i onboardingmallen.
2. AI-agenten validerar att obligatoriska uppgifter finns och identifierar motstridiga eller osäkra inställningar.
3. Agenten genererar en tydlig förhandsvisning av vad som kommer att skapas.
4. En intern behörig person godkänner provisioneringen.
5. Agenten anropar en avgränsad provisioneringstjänst som skapar företagskontot och dess konfiguration.
6. Företagets första administratör bjuds in.
7. Resultat, avvikelser och vem som godkände åtgärden sparas i en revisionslogg.

Själva provisioneringslogiken ska ligga i en deterministisk systemtjänst eller ett internt API. AI-agenten ska fungera som gränssnitt och orkestrerare, inte ha generell databasåtkomst eller kunna köra godtycklig SQL i produktionsmiljön.

Provisioneringsflödet ska vara:

- validerat,
- idempotent, så att samma begäran inte skapar dubbla företag,
- möjligt att provköra utan att skriva data,
- revisionsloggat,
- säkert att köra om efter ett partiellt fel,
- byggt så att hemligheter och autentiseringsuppgifter inte behöver skickas i en AI-prompt.

Efter att kundföretaget har skapats ska företagets administratörer kunna:

- bjuda in och administrera egna användare,
- tilldela tillgängliga roller,
- skapa företagets slutkunder,
- skapa en ny slutkund direkt i flödet för att registrera ett nytt jobb eller projekt,
- konfigurera de företagsinställningar som de har behörighet att ändra.

Den initiala affärsmodellen bör vara en fast månadsavgift per kundföretag, med ett definierat antal användare inkluderade, följt av tillägg för ytterligare aktiva användare och eventuella tilläggsmoduler. Exakta priser är ett kommersiellt beslut och ska inte hårdkodas i applikationslogiken.

Systemet ska kunna lagra följande per kundföretag:

```text
SubscriptionPlan
SubscriptionStatus
IncludedUsers
AdditionalUserPrice
EnabledModules
FeatureFlags
ContractStartDate
ContractEndDate
TrialEndDate
BillingReference
CommercialOverrides
```

Manuellt överenskomna priser, rabatter och specialvillkor ska kunna registreras utan att en ny programversion behöver distribueras.

---

> **Ersättningsnotering 2026-09-03:** N-3-svaret nedan bevaras ordagrant som historiskt beslutsunderlag. Ägaren har därefter beslutat att Fas B ska leverera en responsiv, mobilanvändbar webbapplikation som kräver anslutning. PWA-installation, service worker, beständig offlinelagring, offline-läsning/-skrivning, lokala köer samt synk/replay/konflikthantering har flyttats samlat till Fas C. ADR-B009 är nuvarande beslut och ersätter ADR-B007 för aktiv Fas B-scope; native-app är fortsatt utanför Fas B.

## N-3 — Mobilstrategi och offlinearbete

Systemet ska byggas som en responsiv och installerbar **Progressive Web App, PWA**. En native-app ingår inte i nuvarande scope och ska inte planeras som en separat leveransfas.

PWA:n ska vara den gemensamma applikationen för dator, surfplatta och mobil. Fältarbetare ska kunna installera den på enhetens startskärm och arbeta vidare vid tillfällig avsaknad av internetanslutning.

Offline-stödet ska minst omfatta:

- visning av tidigare nedladdade och tilldelade jobb,
- grundläggande kund- och platsinformation för dessa jobb,
- tidsregistrering,
- arbetsanteckningar,
- registrering av använt material,
- checklistor och egenkontroller,
- avvikelser,
- foton och bilagor inom definierade storleksgränser,
- markering av arbetsmoment som påbörjade eller slutförda,
- registrering av signatur eller bekräftelse när det är tekniskt och juridiskt lämpligt.

Ändringar ska sparas lokalt på enheten och placeras i en synkroniseringskö. Synkronisering ska ske:

- direkt när internetanslutning finns,
- när anslutningen återkommer,
- när applikationen öppnas,
- när applikationen återgår till förgrunden,
- när användaren aktiverar en manuell funktion för att försöka synkronisera igen.

Lösningen får inte vara beroende av att webbläsaren alltid kan utföra bakgrundssynkronisering när applikationen är stängd. All osynkroniserad information måste därför även behandlas nästa gång användaren öppnar eller återaktiverar applikationen.

Användaren ska tydligt kunna se om en ändring är:

```text
SavedLocally
WaitingForSync
Syncing
Synced
Conflict
Failed
```

Vid synkroniseringsfel ska användaren få en begriplig förklaring och möjlighet att försöka igen. Data får inte försvinna enbart för att en överföring misslyckas.

Synkroniserings-API:erna ska använda unika operations-ID:n och idempotenta skrivningar så att samma lokala ändring inte skapar dubbla tidsrader, materialposter eller bilagor när en överföring görs om.

Konflikter ska hanteras beroende på datatyp:

- tidsrader, materialregistreringar, foton och liknande bör i första hand vara separata, append-only-poster,
- gemensamt redigerade objekt ska använda versionskontroll eller optimistisk låsning,
- automatiskt överskrivande av en annan användares ändring ska undvikas,
- användaren ska få välja eller granska resultatet när en konflikt inte kan lösas säkert automatiskt.

Offlinefunktionen ska inte ladda ned företagets fullständiga databas. Endast information som användaren behöver för sina tilldelade eller uttryckligen valda jobb ska lagras lokalt.

Lokalt lagrad information ska:

- minimeras,
- tidsbegränsas,
- rensas efter en definierad period,
- tas bort när användaren loggar ut där det är praktiskt möjligt,
- omfattas av samma behörighetskontroller som information som läses online.

Administrativa funktioner, ekonomirapporter, företagsinställningar, användaradministration och andra centrala funktioner får kräva aktiv internetanslutning.

---

## N-4 — Roller, behörigheter och synlighet

Följande grundroller ska finnas initialt:

- Företagsadmin,
- Projektledare,
- Montör,
- Säljare,
- Ekonomi.

Därutöver ska en användare kunna tilldelas uppdraget **Arbetsledare** för ett eller flera specifika jobb eller projekt. Arbetsledare bör alltså primärt vara ett jobb- eller projektbundet uppdrag, inte nödvändigtvis en permanent global roll.

En användare ska kunna ha flera roller och jobbrelaterade uppdrag samtidigt.

I princip ska all skyddsvärd funktionalitet och all skyddsvärd information omfattas av behörighetsstyrning. Det innebär däremot inte att varje kosmetiskt fält i användargränssnittet måste få en helt egen behörighetsnyckel. En bokstavlig behörighet per enskilt formulärfält skulle bli svår att administrera och mycket känslig för förändringar i gränssnittet.

Behörighetsmodellen ska i stället byggas kring fyra dimensioner:

1. **Resurs eller funktionsområde**, exempelvis kunder, jobb, offerter, tidsrader, material, faktureringsunderlag, HR och företagsinställningar.
2. **Handling**, exempelvis läsa, skapa, ändra, ta bort, godkänna, skicka eller exportera.
3. **Dataomfattning**, exempelvis egna poster, tilldelade jobb, ett projekt, en grupp eller hela företaget.
4. **Känsliga fältgrupper**, exempelvis försäljningspris, självkostnad, täckningsbidrag, löneuppgifter och särskilt skyddsvärda personuppgifter.

Exempel på behörighetsnycklar:

```text
Customers.View
Customers.Create
Customers.Edit
Customers.Delete

Jobs.ViewAssigned
Jobs.ViewAll
Jobs.Create
Jobs.Edit
Jobs.Delete
Jobs.AssignUsers
Jobs.ApproveCompletion

Quotes.View
Quotes.Create
Quotes.Edit
Quotes.Approve
Quotes.Send
Quotes.Export

InvoiceBasis.View
InvoiceBasis.Create
InvoiceBasis.Edit
InvoiceBasis.Approve
InvoiceBasis.ExportToFortnox

Economy.ViewSalesPrice
Economy.EditSalesPrice
Economy.ViewCostPrice
Economy.EditCostPrice
Economy.ViewContributionMargin

Users.View
Users.Invite
Users.Edit
Users.Deactivate

Roles.View
Roles.Manage

CompanySettings.View
CompanySettings.Edit
```

För känsliga uppgifter ska separata behörigheter användas. En användare kan exempelvis ha rätt att öppna ett jobb och registrera material utan att få se kundpriset, självkostnaden eller täckningsbidraget.

Behörigheter ska alltid kontrolleras på serversidan. Att en knapp eller ett fält döljs i användargränssnittet är en användbarhetsfunktion, inte ett tillräckligt säkerhetsskydd.

Standardinställningen ska vara att åtkomst nekas om en uttrycklig behörighet saknas.

### Rekommenderade standardbehörigheter

| Roll | Grundläggande åtkomst | Försäljningspriser | Självkostnad och TB |
|---|---|---:|---:|
| **Företagsadmin** | Hela företagets system, användare och inställningar | Ja | Ja |
| **Projektledare** | Tilldelade projekt, jobb, planering, resurser och ekonomi | Ja | Ja |
| **Arbetsledare på jobb** | Det specifika jobbet, arbetslaget, planering, dokumentation och förbrukning | Nej som standard | Nej |
| **Montör** | Egna eller tilldelade jobb, tider, material, dokument, checklistor och avvikelser | Nej | Nej |
| **Säljare** | Kunder, leads, offerter, försäljningspriser och rabatter | Ja | Nej som standard |
| **Ekonomi** | Faktureringsunderlag, fakturor, moms, ROT, grön teknik och ekonomisk uppföljning | Ja | Ja |

Montörer ska som standard inte kunna se försäljningspriser, självkostnader eller täckningsbidrag.

Säljare ska som standard kunna se och ändra försäljningspriser och rabatter, men inte se självkostnad eller täckningsbidrag. Behörigheten `Economy.ViewContributionMargin` ska kunna ges separat till exempelvis en försäljningschef eller senior säljare.

Ett alternativ för vanliga säljare är att systemet visar en varning när en offert understiger företagets tillåtna marginal, utan att användaren behöver få se den fullständiga självkostnadskalkylen.

Systemet ska använda centralt definierade standardroller, men datamodellen ska bestå av separata behörigheter så att kundspecifika roller kan skapas genom att kombinera dessa.

I den första versionen ska kundspecifika roller endast skapas eller ändras av oss som interna plattformsadministratörer. Detta ska ske genom:

- ett internt administrationsgränssnitt, eller
- en versionsstyrd och validerad konfiguration.

Roller och behörigheter ska inte administreras genom manuella och odokumenterade ändringar direkt i produktionsdatabasen.

Alla ändringar av roller och behörigheter ska revisionsloggas med:

```text
ChangedBy
ChangedAt
CompanyId
RoleId
PreviousPermissions
NewPermissions
Reason
```

Behörighetsnycklar ska vara kopplade till stabila affärsfunktioner och API-operationer, inte direkt till sidnamn eller den aktuella placeringen av ett fält i användargränssnittet.

---

## N-5 — Fortnox och faktureringsunderlag

Vi har ansökt om åtkomst till Fortnox Developer Portal. När åtkomsten har godkänts skapar vi en integration med Client ID och Client Secret samt en eller flera Fortnox-testmiljöer för utveckling och test.

Integrationen ska använda Fortnox OAuth 2 Authorization Code Flow. Varje kundföretag ska självt ansluta sitt Fortnox-konto och godkänna de behörighetsområden, scopes, som integrationen behöver. API-uppgifter eller personliga Fortnox-inloggningar får inte delas mellan kundföretag.

Vi ska tillämpa minsta möjliga åtkomst. Initialt bedöms följande scopes vara aktuella:

```text
companyinformation
customer
article
invoice
```

Följande scopes ska endast läggas till när motsvarande funktion faktiskt implementeras:

```text
settings
project
costcenter
print
payment
```

Kundföretaget ansvarar för att ha de Fortnox-licenser och användarbehörigheter som krävs för de resurser som integrationen ska använda.

### Faktureringsflöde

Det egna systemet ska vara master för det operativa faktureringsunderlaget. Fortnox ska vara master för den slutliga fakturan, fakturanumret, bokföringsstatusen och betalningsstatusen.

Det rekommenderade flödet är:

1. Tid, material och betalningsposter registreras mot jobbet.
2. Arbetsledare eller projektledare granskar registreringarna.
3. Ett fryst faktureringsunderlag skapas.
4. En behörig användare godkänner underlaget.
5. En faktura eller ett fakturautkast skapas i Fortnox.
6. Fakturan slutkontrolleras i Fortnox.
7. Bokföring och utskick sker initialt från Fortnox.
8. Fakturanummer, status och relevanta referenser synkroniseras tillbaka till systemet.

Automatisk bokföring och automatiskt fakturautskick direkt från det egna systemet ska inte vara standard i den första versionen.

### Faktureringsunderlagets innehåll

Faktureringsunderlaget ska kunna kombinera tid, material, fastpris, betalningsplan och övriga debiterbara poster.

#### Tid

- datum eller period,
- person eller arbetskategori,
- arbetstyp,
- antal timmar,
- timpris,
- eventuell rabatt,
- moms,
- ROT-klassificering,
- referens till den ursprungliga tidsregistreringen.

#### Material

- artikelnummer,
- beskrivning,
- antal,
- enhet,
- pris per enhet,
- rabatt eller påslag,
- moms,
- klassificering för grön teknik där det är relevant,
- referens till den ursprungliga materialregistreringen.

#### Fastpris

- fastprispunkt eller leveransdel,
- avtalat belopp,
- vad posten avser,
- eventuell redan fakturerad del,
- återstående belopp.

#### Betalningsplan

- milstolpe,
- belopp eller procentandel,
- villkor för att posten får faktureras,
- godkännandedatum,
- tidigare fakturerat belopp,
- återstående belopp.

#### Övriga poster

- resa,
- servicebil,
- maskinkostnad,
- administration,
- avgifter,
- tillägg eller avdrag.

Sådana poster ska hållas separata eftersom de bland annat kan behandlas annorlunda vid ROT och grön teknik.

Varje fakturarad bör internt innehålla minst:

```text
SourceType
SourceId
Description
Quantity
Unit
UnitPriceExVat
Discount
VatRate
Account
Project
CostCenter
DeductionClassification
ServicePeriod
```

Endast godkända och ännu inte fakturerade källposter ska kunna tas med. När en post har placerats på ett faktureringsunderlag ska den länkas till underlaget och spärras mot dubbel fakturering.

Underlaget ska få ett versionsnummer och en status, exempelvis:

```text
Draft
UnderReview
Approved
Exported
PartiallyInvoiced
Invoiced
Cancelled
```

En godkänd version ska inte kunna ändras utan att den öppnas igen eller ersätts av en ny version, så att det går att i efterhand se exakt vilket underlag som exporterades till Fortnox.

---

## N-6 — E-postutskick

> Current Phase B application (2026-09-23): [ADR-B011](../decisions/ADR-B011-epic-13-email-release-and-quote-delivery.md) keeps the sender and flow-priority answers below, but delivers customer quotes as PDF attachments without a public open/accept/reject link. Story 13.4 may be implemented and sandbox-tested; real-recipient sending requires a separate recorded owner go-live decision. The original answer is retained below as decision history.

Systemet ska initialt använda en centralt administrerad och verifierad underdomän för transaktionell e-post, exempelvis:

```text
notify.systemnamn.se
```

Rekommenderat avsändarformat:

```text
Från-visningsnamn:
[Företagsnamn] via [Systemnamn]

Från-adress:
utskick@notify.systemnamn.se

Reply-To:
Den e-postadress som kundföretaget har valt,
exempelvis offert@kundforetag.se
```

Detta gör att den tekniska avsändaren är konsekvent och kan autentiseras korrekt, samtidigt som mottagarens svar går till rätt kundföretag.

Kundföretag ska i en senare version kunna ansluta och verifiera en egen avsändardomän. Detta ingår inte i det initiala flödet.

### Prioriterade e-postflöden

Följande utskick ska implementeras först:

1. användarinbjudningar och kontorelaterade säkerhetsmeddelanden,
2. offertutskick till kund, inklusive länk för att öppna och godkänna eller avvisa offerten,
3. intern notifiering när en offert godkänns eller avvisas,
4. notifiering till fältarbetare när ett jobb tilldelas eller får en väsentlig tidsändring,
5. konfigurerbar offertpåminnelse,
6. dagligt eller veckovis notissammandrag för mindre brådskande händelser.

Offertpåminnelser ska stoppas automatiskt när offerten har:

- accepterats,
- avvisats,
- återkallats,
- ersatts av en ny version,
- löpt ut.

Fakturautskick ska initialt göras av Fortnox så att mottagaren inte får dubbla fakturamejl från två system.

Varje utskick ska logga:

```text
MessageType
TemplateId
TemplateVersion
CompanyId
Recipient
FromAddress
ReplyToAddress
TriggeredBy
TriggeredAt
RelatedEntityType
RelatedEntityId
ProviderMessageId
DeliveryStatus
DeliveredAt
BouncedAt
FailureReason
```

Systemet ska skilja mellan transaktionella meddelanden och marknadsföringsutskick. Marknadsföringsutskick ingår inte i den initiala e-postfunktionen.

---

## N-7 — Upphandling och FKU som tunn manuell modul

Upphandling och FKU ska implementeras i Fas B som en tunn, manuell modul.

Fas B ska omfatta:

- registrering av en upphandling eller ett FKU-ärende,
- titel,
- beställare,
- ansvarig,
- tidsfrister,
- status,
- organiserad filhantering,
- filversioner och uppladdningshistorik,
- manuell kategorisering av dokument,
- manuell checklista,
- manuellt registrerade krav,
- manuellt registrerade frågor och svar,
- manuellt skapad sammanställning,
- kommentarer,
- ansvarsfördelning,
- export eller utskrift av sammanställningen.

Modulen ska ha tydlig spårbarhet för vem som har laddat upp, ändrat, granskat eller godkänt information.

Fas B omfattar inte:

- AI-baserad dokumentanalys,
- automatisk extraktion av krav,
- automatisk jämförelse mellan dokumentversioner,
- automatisk riskklassificering,
- AI-genererade svar,
- automatisk poängsättning eller bedömning av upphandlingen.

Dessa funktioner hanteras som möjliga delar av Fas C.

---

## N-8 — Mallinnehåll för DoU och egenkontroller

Det tekniska systemet, mallmotorn och redigeringsfunktionerna levereras av utvecklingsteamet.

**Johan Ahlström är utsedd innehållsägare och domänansvarig för det initiala compliance-innehållet för DoU och egenkontroller.** Han ansvarar för att leverera, kvalitetssäkra och formellt godkänna det verkliga fack- och compliance-innehållet.

Johan Ahlström ska för den första versionen leverera eller godkänna:

- befintliga mallar,
- obligatoriska kontrollpunkter,
- instruktioner,
- godkännandetexter,
- signeringskrav,
- vilka uppgifter som måste dokumenteras,
- vilka avvikelser som ska kunna registreras,
- hänvisningar till relevanta standarder, regelverk eller interna rutiner,
- vilka roller som får fylla i, granska och godkänna respektive dokument.

Utvecklingsteamet ansvarar för:

- datamodell,
- formulär och fälttyper,
- mallredigering,
- versionshantering,
- giltighetsdatum,
- statusflöde,
- godkännandeflöde,
- signering,
- spårbarhet,
- kundföretagsspecifika varianter,
- arkivering och export.

Varje publicerad mall ska minst ha:

```text
TemplateId
Title
ContentOwnerUserId
ApprovedByUserId
Version
EffectiveFrom
EffectiveTo
Status
ChangeSummary
SupersedesTemplateVersionId
```

`ContentOwnerUserId` ska initialt peka på Johan Ahlström, men ansvaret ska lagras som en konfigurerbar användar- eller rollreferens och inte hårdkodas som ett namn i programkoden.

Rekommenderade mallstatusar är:

```text
Draft
UnderReview
Approved
Published
Superseded
Archived
```

Endast en godkänd och publicerad mallversion ska kunna väljas som standard för nya jobb. Pågående dokument ska fortsätta vara kopplade till den mallversion som användes när dokumentet skapades, även om en ny mallversion publiceras senare.

Systemleverantören kan tillhandahålla en gemensam basmall. Varje kundföretag ska kunna få en egen version eller variant, men det ska vara tydligt:

- vilken basmall den kommer från,
- vem som har anpassat den,
- vem som har godkänt den,
- vem som ansvarar för dess innehåll.

Utvecklingsteamet ska inte självt formulera eller godkänna innehåll som framställs som juridiskt, regulatoriskt eller eltekniskt korrekt utan Johan Ahlströms eller en annan utsedd sakkunnigs formella godkännande.

---

## N-9 — Schemaläggningsindata

Schemaläggningen ska baseras på faktisk arbetstid per användare, inte enbart på anställningsgrad.

Varje användare ska kunna ha:

- anställningsperiod,
- anställningsgrad,
- tidszon,
- återkommande veckoschema,
- arbetspassens start- och sluttider,
- raster,
- individuella schemaavvikelser,
- semester,
- sjukfrånvaro,
- tjänstledighet,
- utbildning,
- annan blockerad tid.

Anställningsgraden används som kontroll- och beräkningsvärde, men det faktiska veckoschemat styr tillgängligheten. En person som arbetar 80 procent kan exempelvis arbeta fyra heldagar eller fem kortare dagar, vilket måste kunna uttryckas separat.

Företaget ska kunna definiera ett standardarbetsschema som nya användare kan ärva. Det ska inte finnas ett globalt hårdkodat antagande om att alla företag och anställda arbetar samma antal timmar eller samma veckodagar.

### Kapacitetsberäkning

Planerbar kapacitet ska beräknas enligt:

```text
Schemalagd arbetstid
– helgdagar och stängda dagar
– frånvaro
– befintliga bokningar
– blockerad intern tid
– eventuell planeringsbuffert
= tillgänglig kapacitet
```

Övertid ska inte räknas som ordinarie tillgänglig kapacitet. Den ska kunna läggas till genom ett uttryckligt beslut av en behörig användare.

Överbokning ska kunna tillåtas, men alltid ge en tydlig varning. Vid större överskridanden ska systemet kunna kräva en särskild behörighet eller bekräftelse.

### Helgdagar och företagskalender

Systemet ska ha en centralt underhållen kalender för svenska allmänna helgdagar.

Kundföretaget ska dessutom kunna registrera:

- lokala stängda dagar,
- halvdagar,
- klämdagar,
- kollektivavtalsrelaterade ledigheter,
- företagsgemensamma aktiviteter,
- andra perioder med reducerad kapacitet.

Individuella undantag ska kunna göras per användare.

### Jobbindata för schemaläggning

Ett jobb ska minst kunna innehålla:

- uppskattad tidsåtgång,
- tidigaste möjliga start,
- önskat slutdatum,
- senast tillåtna slutdatum,
- prioritet,
- antal personer,
- krav på kompetens eller certifiering,
- plats,
- beroenden till andra arbetsmoment,
- eventuell restid,
- ansvarig projektledare,
- ansvarig arbetsledare,
- om kunden måste vara på plats,
- eventuella åtkomst- eller tidsfönster.

Automatisk optimering behöver inte ingå initialt. Fas A och B kan använda manuell schemaläggning med:

- kapacitetsvarningar,
- konfliktvarningar,
- kompetenskontroller,
- restidsinformation,
- tydlig visualisering av ledig och bokad tid.

---

## N-10 — GDPR, gallring och HR:s raderingsflöde

Fas B ska innehålla grundläggande stöd för datalivscykel, inaktivering, gallring och raderingsbegäran. Det fullständiga juridiska och automatiserade GDPR-programmet kan vidareutvecklas i Fas C, men den tekniska grunden måste finnas från början.

GDPR-hanteringen gäller inte enbart privatkunder och tidigare anställda. Den gäller all information som direkt eller indirekt kan kopplas till en identifierbar fysisk person, exempelvis:

- anställda,
- tidigare anställda,
- privatkunder,
- enskilda näringsidkare,
- kontaktpersoner hos företagskunder,
- underentreprenörer,
- arbetssökande,
- personer som förekommer på bilder,
- personer som förekommer i signaturer, anteckningar eller arbetsdokument.

När en anställd slutar ska systemet:

1. inaktivera användarkontot,
2. återkalla aktiva sessioner och autentiseringsuppgifter,
3. hindra ny inloggning,
4. ta bort personen från framtida schemaläggning,
5. omfördela öppna uppgifter och ansvar,
6. behålla historiska poster där det finns ett dokumenterat behov eller rättsligt krav,
7. radera eller anonymisera övriga personuppgifter när den definierade lagringstiden löper ut.

Historiska uppgifter ska inte automatiskt hårdraderas enbart för att en anställning eller kundrelation upphör. Vissa uppgifter kan behöva bevaras för exempelvis:

- bokföring,
- lönehantering,
- avtal,
- garantier,
- försäkringsärenden,
- rättsliga anspråk,
- arbetsmiljö- eller säkerhetsdokumentation.

Vanliga administratörer ska inte kunna hårdradera användare, kunder, tidsrapporter, faktureringsunderlag eller ekonomiska dokument utan ett kontrollerat gallringsflöde.

Systemet ska minst stödja:

```text
RetentionCategory
RetentionPolicyId
RetentionUntil
DeletionRequestedAt
DeletionRequestedBy
DeletionStatus
LegalHold
RestrictedAt
AnonymizedAt
DeletedAt
DeletionDecisionReason
DeletionApprovedBy
```

Rekommenderade statusar för ett raderingsärende är:

```text
Received
IdentityVerificationRequired
UnderAssessment
PartiallyApproved
Approved
Rejected
Executed
Closed
```

Ett raderingsflöde ska kunna:

- registrera vem begäran gäller,
- registrera när begäran mottogs,
- verifiera personens identitet,
- söka fram relevanta uppgifter i systemet,
- skilja raderingsbara uppgifter från uppgifter som måste bevaras,
- radera eller anonymisera tillåtna uppgifter,
- begränsa åtkomsten till uppgifter som måste sparas,
- dokumentera beslut, rättslig grund och genomförda åtgärder,
- registrera svarsfrist och när svar lämnades.

Systemet ska stödja en rättslig spärr, `LegalHold`, så att information som omfattas av en pågående tvist, utredning eller annan dokumenterad bevarandeplikt inte gallras automatiskt.

Fas B bör minst ha följande övergripande datakategorier:

| Datakategori | Grundprincip |
|---|---|
| Aktiv användarprofil | Sparas medan användaren är aktiv |
| Avslutad användarprofil | Inaktiveras direkt och gallras enligt definierad policy |
| Tids- och löneunderlag | Sparas enligt relevant rättsligt och avtalsmässigt behov |
| Fakturor och räkenskapsinformation | Bevaras enligt bokföringsregler |
| Jobbanteckningar och foton | Gallras enligt ändamål, garanti- och avtalsbehov |
| Kontaktpersoner | Gallras när affärsrelationen och övrigt behov har upphört |
| Inbjudningar som aldrig accepterats | Gallras efter en kort, definierad period |
| Säkerhets- och revisionsloggar | Gallras enligt separat säkerhetspolicy |
| Supportärenden | Gallras enligt support-, avtals- och säkerhetsbehov |

Lagringstider ska inte vara utspridda som hårdkodade värden i olika delar av systemet. De ska styras av en central och versionshanterad gallringspolicy.

Varje gallringspolicy bör minst innehålla:

```text
DataCategory
LegalBasis
Purpose
RetentionPeriod
RetentionStartEvent
DeletionMethod
AnonymizationMethod
PolicyOwner
EffectiveFrom
EffectiveTo
```

Varje kundföretag är normalt personuppgiftsansvarigt för sina anställda, kunder och jobbdata, medan systemleverantören normalt behandlar dessa uppgifter som personuppgiftsbiträde.

Systemleverantören kan samtidigt vara personuppgiftsansvarig för egna uppgifter, exempelvis:

- avtalskontakter,
- abonnemang och fakturering,
- supportkontakter,
- säkerhetsloggar,
- egna användar- och administratörsuppgifter.

Ansvarsfördelningen ska fastställas i avtal, integritetsinformation och personuppgiftsbiträdesavtal. Tekniska funktioner ska stödja den ansvarsfördelningen men ersätter inte den juridiska dokumentationen.
