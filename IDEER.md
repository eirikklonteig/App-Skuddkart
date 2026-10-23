# Skuddkart – idéliste for senere versjoner

Ting som er bestemt å vente med. Flytt et punkt opp når det skal bygges.

## Ferdig
- [x] Steg 1: Laget og spillerliste, sikkerhetskopi
- [x] Steg 2: Kamper, kampklokke, skuddregistrering og tidslinje
- [x] Steg 2b: Banesoner – trykk på en tegnet bane for hvor skuddet kom fra
      (venstre/høyre kant, 6–9 m venstre/midt/høyre, 9 m+ venstre/midt/høyre, 7 m).
      Sonen erstatter avstandsknappene. Punktet man trykker på lagres også, for varmekart senere.
- [x] Steg 2c: Ny registreringsside – spillere i kolonne til venstre, målet rett over banen,
      Mål | Redning | Utenfor, «siste skudd» med angre, alt på én mobilskjerm.
      Egne bekreftelsesvinduer (nettleserens egne blokkeres i enkelte nettlesere).
- [x] Steg 3: Legge på GitHub og publisere (så appen kan testes på mobil og iPad)
- [x] Steg 4: Statistikk (redningsprosent, skuddkart, per spiller, per sone, per omgang)
      + «Avslutt kamp» i ⋯-menyen: stopper klokka, markerer kampen som ferdig,
      låser registreringen, åpner kampens statistikk. «Gjenåpne kamp» for rettinger.
- [x] Steg 5: Hendelser – 2 minutter, gult kort, rødt kort og time-out, med tid.
- [x] Steg 6: Flere lag – lagliste, nytt lag (med kopiering av spillere), bytte lag
      fra toppfeltet, slette lag. Spillere, kamper og statistikk følger valgt lag.
- [x] Versjon 0.9 (etter første ekte kamp):
      - Klokka starter på 00:00 i hver omgang, og kan stilles ved å trykke på den
      - Time-out stopper kampklokka og teller ned 1 minutt; ▶ starter kampen igjen
      - «Avslutt 1. omgang» som hendelse i tidslinjen (trykk for omgangens statistikk)
      - Statistikk for hele kampen, 1. omgang eller 2. omgang
      - Kamptropp ved ny kamp (forrige tropp forhåndsvalgt) og «Juster kamptropp»
      - «+ spiller» i kampen
      - Skjemaene legges øverst på mobil, så tastaturet ikke dekker knappene
      - Påminnelse om sikkerhetskopi når en kamp avsluttes
      - Arkivere og hente fram lag; slette lag er alltid tilgjengelig

- [x] Versjon 0.9.1–0.9.3:
      - «V. bak / Midt bak / H. bak» på banen
      - «Del / PDF» og brukerveiledning (?-knappen)
      - Nytt, moderne utseende med ikoner
      - Fullskjerm-app på iPhone (legg til på hjemskjerm), virker uten nett
      - Sikkerhetskopi via del-arket på mobil

## Versjon 1.0
- [x] **Pauseanalyse:** kort oppsummering i klartekst ved «Slutt 1. omgang» – hvem scorer
  mye og hvorfra, hva keeper bør følge med på, hva vi bør justere. Bare funn med minst
  3 skudd bak. Også som «Kampanalyse» for hele kampen (versjon 1.0).
- [x] Automatisk kolon i tidsfelt (0345 → 03:45) (versjon 0.9.4)
- [x] **Dele statistikk:** «Del / PDF» på statistikksiden (versjon 0.9.2)

## Versjon 2.0 – brukere og lagring på nett
- **Innlogging:** eier (admin) og én registrerende bruker per lag (evt. delt innlogging)
- **Lagring på nett** (forslag: Supabase med data i EU), som også virker uten nett i hallen
  og synkroniserer etterpå
- **Flyt:** bruker → lag → spillere (lagets stall) → kamptropp per kamp
- **Motstanderdatabase:** motstanderlag med draktnummer, gjenbrukes mot samme lag
- **Personvern:** bare draktnummer for motstandere; for egne spillere minst mulig
  (f.eks. fornavn og nummer). Klubben bør godkjenne før data lagres på nett.

## Senere
- **Før og etter time-out:** effektivitet i minuttene før og etter hver time-out
- **Blått kort** (rapport etter rødt kort), hvis det trengs
- **Varmekart over banen:** se hvor skuddene kommer fra, og hvordan det endrer seg med hvem som er på banen
- **Type angrep:** kontring, gjennombrudd, vanlig angrep (valgfritt ekstra trykk)
- **Felles spillere på tvers av lag:** én spillerliste for klubben, så statistikk for en
  spiller som spiller på flere lag kan samles (i dag legges spilleren inn på hvert lag)
- **Kobling til klubbens SharePoint**
- **Navn på motstanderspillere:** koble draktnummer til navn per kamp i etterkant
  (skudd lagres allerede med nummer, så gamle kamper får navn automatisk)
- **Velge motstander fra liste** over tidligere motstandere, så navnet skrives likt hver gang
- **Import fra håndball.no:** undersøke om kamprapporter/spillerlister kan hentes automatisk
- **Motstanderstatistikk:** se hvor motstanderens spillere (f.eks. nr. 10) pleier å skyte før neste kamp
- **Hente tabell** og annen statistikk for laget
- **Fotball:** utvide appen til flere idretter
