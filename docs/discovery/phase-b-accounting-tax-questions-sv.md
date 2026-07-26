# Fas B — Frågor till redovisning/ekonomi: moms, ROT & grön teknik

**Datum:** 2026-07-20
**Till:** redovisningsansvarig / ekonomi
**Från:** ElproSaas (Rasmus)
**Systemets status:** Applikationen räknar redan moms, ROT och grön teknik — men med
**platshållarsatser**. Innan vi kan producera ett skarpt **faktureringsunderlag** (och
innan någon skarp ROT-/grön-offert går ut till kund) behöver vi era exakta, aktuella
siffror nedan.

**Redan bestämt (av ägaren, behöver ej besvaras här):**
- Endast **privatpersoner** är berättigade till ROT och grön teknik.
- ROT och grön teknik **får inte kombineras** på samma offert.
- BRF är **inte** berättigad.

**När vi senast behöver svaren:** vid **Epic 26 (faktureringsunderlag)** i bygget —
**men** de behövs innan ni skickar någon *skarp* ROT-/grön-offert till en riktig kund,
vilket kan bli tidigare om ni vill gå live med offerter före dess. Fram till dess kör
piloten på demodata med platshållarsatser.

---

## Block A — Moms & avrundning

| ID | Fråga | Svar |
| --- | --- | --- |
| **A.1** | **Avrundningsregel.** Ska moms och belopp avrundas **per rad** eller på **dokumentnivå** (summan)? Och ska PDF:en visa hela **kronor** eller hela **ören**? (Vi lagrar alltid exakta ören internt — frågan gäller vilken avrundning som är den "riktiga" och vad kunden ser.) | |
| **A.2** | **Momssats.** Vilken momssats ska tillämpas (25 %?), och finns undantag (t.ex. viss materialtyp eller kundtyp)? | |

---

## Block B — ROT-avdrag (arbetskostnad)

| ID | Fråga | Svar |
| --- | --- | --- |
| **B.1** | **Sats.** Aktuell ROT-sats (% av arbetskostnaden)? | |
| **B.2** | **Tak.** Tak per person och år (kr)? | |
| **B.3** | **Underlag.** Beräknas ROT på arbetskostnad **inkl.** eller **exkl.** moms? | |
| **B.4** | **Momsordning.** Bekräfta beräkningsordningen: arbete exkl. moms → arbete inkl. moms (25 %) → avdrag (%) → tak per person. Stämmer denna ordning? | |

---

## Block C — Grön teknik

| ID | Fråga | Svar |
| --- | --- | --- |
| **C.1** | **Satser per kategori.** Procentsats för **solceller**, **batteri/lagring** och **laddpunkt** var för sig? | |
| **C.2** | **Tak.** Tak per person och år (kr)? | |
| **C.3** | **Schablon.** Tillämpas en **schablonreducering** (t.ex. 3 %) på underlaget *innan* kategorisatsen läggs på? Om ja — på vilket underlag och med vilken procent? | |

---

## Block D — Dolda rader (påverkar både total och avdragsunderlag)

| ID | Fråga | Svar |
| --- | --- | --- |
| **2.2** | När en kalkylrad är **dold för kunden** i offerten: ska den ändå **räknas med** i totalen och i ROT-/grön-underlaget, eller **exkluderas**? *(Systemet gör idag antagandet "räknas med" — behöver bekräftas, eftersom det påverkar avdragets storlek.)* | |

---

## Referenser (för avstämning)

- Skatteverket – ROT och RUT-arbete
- Skatteverket – Grön teknik i deklarationen

Dessa är externa referenspunkter; ert svar är det som gäller och det som signeras av
för skarp användning.
