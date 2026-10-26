# Oppsett av Supabase for Skuddkart

Gjøres én gang, i nettleseren på supabase.com, i prosjektet **skuddkart**.

## 1. Lag databasen
1. Gå til **SQL Editor** (menyen til venstre) og trykk **New query**.
2. Åpne filen `supabase/schema.sql`, kopier **alt** innholdet og lim det inn.
3. Trykk **Run**. Det skal stå *Success. No rows returned*.
4. Sjekk under **Table Editor** at tabellene `members`, `teams` og `matches` finnes,
   og at `members` har én rad: eklonteig@gmail.com som admin.

## 2. E-post med kode i stedet for lenke
1. Gå til **Authentication → Emails** (fanen *Templates*).
2. Velg malen **Magic Link**:
   - **Subject:** `Din kode til Skuddkart`
   - **Body** (erstatt alt):
     ```html
     <h2>Din kode til Skuddkart</h2>
     <p>Skriv inn denne koden i appen:</p>
     <p style="font-size:28px;font-weight:bold;letter-spacing:4px">{{ .Token }}</p>
     <p>Koden virker i én time. Har du ikke bedt om den, kan du se bort fra e-posten.</p>
     ```
3. Gjør det samme for malen **Confirm signup** (den brukes første gang noen logger inn).
4. Trykk **Save** på begge.

## 3. Adressen til appen
1. Gå til **Authentication → URL Configuration**.
2. Sett **Site URL** til `https://skuddkart.vercel.app` og lagre.

## 4. Sjekk at du kan få e-post
Supabase sin innebygde e-post sender bare til medlemmer av organisasjonen din,
og maks 2 e-poster i timen.
1. Gå til **Organization settings → Team** (klikk på organisasjonsnavnet øverst).
2. Står **eklonteig@gmail.com** der? Hvis ikke: **Invite** den adressen og godta invitasjonen.

## Senere: e-post til andre trenere (før Kent legges til)
Den innebygde e-posten kan ikke sende til andre. Vi trenger en egen e-posttjeneste (SMTP):
- **A. Klubbens domene (anbefalt):** gratis tjeneste som Resend, med avsender
  for eksempel `skuddkart@tuneil.no`. Krever at den som styrer domenet tuneil.no
  legger inn noen DNS-oppføringer.
- **B. Gmail med app-passord:** raskest, men e-posten kommer fra en privat Gmail-adresse.

## Aldri del
- **service_role**-nøkkelen
- databasepassordet
- app-passord til e-post

Disse skrives bare inn i Supabase sine egne innstillinger.
