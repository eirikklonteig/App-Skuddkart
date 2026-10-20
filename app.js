/* =========================================================
   Skuddkart – logikken i appen
   Alt lagres i nettleseren (localStorage) på denne maskinen.
   ========================================================= */
'use strict';

const STORAGE_KEY = 'skuddkart-data';
const OLD_STORAGE_KEY = 'sjumeter-data';   // appens tidligere navn
const MAX_HALF = 30;   // lengste omgang i minutter

// Avstander. Brukes for eldre skudd som ble registrert før banesonene kom.
const DISTANCES = [
  { id: '6-9', label: '6–9 m' },
  { id: '9+', label: '9 m+' },
  { id: '7m', label: '7 m' }
];
const ZONE_ROWS = ['Høyt', 'Midt', 'Lavt'];
const ZONE_COLS = ['venstre', 'midten', 'høyre'];

// Soner på banen, sett fra skytteren. x er meter fra midten (venstre negativ).
// inner = innenfor 9-meteren. lx/ly er hvor navnet skrives på tegningen.
// Kantsonene dekker også hjørnet ved sidelinja (de første WING_DEPTH meterne),
// selv om det ligger utenfor 9-meteren.
const WING_DEPTH = 6;
const AREAS = [
  { id: 'lw',  label: 'Venstre kant',      short: 'V. kant',  distance: '6-9', inner: true,  x1: -10,  x2: -6.5, lx: 17,  ly: 42, wing: true },
  { id: 'l69', label: 'Venstre 6–9 m',     short: 'Venstre',  distance: '6-9', inner: true,  x1: -6.5, x2: -2.5, lx: 52,  ly: 82 },
  { id: 'm69', label: 'Midt 6–9 m',        short: 'Midt',     distance: '6-9', inner: true,  x1: -2.5, x2: 2.5,  lx: 100, ly: 95 },
  { id: 'r69', label: 'Høyre 6–9 m',       short: 'Høyre',    distance: '6-9', inner: true,  x1: 2.5,  x2: 6.5,  lx: 148, ly: 82 },
  { id: 'rw',  label: 'Høyre kant',        short: 'H. kant',  distance: '6-9', inner: true,  x1: 6.5,  x2: 10,   lx: 183, ly: 42, wing: true },
  { id: 'l9',  label: 'Venstre back 9 m+', short: 'V. back',  distance: '9+',  inner: false, x1: -10,  x2: -3.5, lx: 32,  ly: 127 },
  { id: 'm9',  label: 'Midtback 9 m+',     short: 'Midtback', distance: '9+',  inner: false, x1: -3.5, x2: 3.5,  lx: 100, ly: 127 },
  { id: 'r9',  label: 'Høyre back 9 m+',   short: 'H. back',  distance: '9+',  inner: false, x1: 3.5,  x2: 10,   lx: 168, ly: 127 }
];
const AREA_7M = { id: '7m', label: '7 m-kast', short: '7 m', distance: '7m', pos: { x: 0, y: 7 } };

// ---------- Lagring ----------
//
// Dataene er bygget for flere lag, selv om appen viser ett lag foreløpig:
// { version, activeTeamId, teams: [ { id, name, halfLength, players, matches } ] }
//
// players: { id, number, name, role: 'player' | 'keeper' }
// matches: { id, createdAt, opponent, date, home, halfLength, keeperId,
//            clock: { half, elapsedMs, running, startedAt }, shots: [...] }
// shots:   { id, createdAt, side: 'us' | 'them', playerId, oppNumber, keeperId,
//            area (sone på banen), pos: { x, y } (meter, for varmekart),
//            distance, zone (0–8 eller null = utenfor), result: 'goal' | 'save' | 'miss',
//            half, sec }

function newTeam(name) {
  return { id: newId(), name, halfLength: MAX_HALF, players: [], matches: [] };
}

function emptyData() {
  const team = newTeam('Tune IL');
  return { version: 2, activeTeamId: team.id, teams: [team] };
}

// Gjør om eldre lagrede data (versjon 1, ett lag) til dagens format.
function migrate(raw) {
  if (raw && Array.isArray(raw.teams) && raw.teams.length) return raw;
  if (raw && Array.isArray(raw.players)) {
    const team = newTeam(raw.teamName || 'Mitt lag');
    team.halfLength = raw.halfLength || MAX_HALF;
    team.players = raw.players;
    team.matches = raw.matches || [];
    return { version: 2, activeTeamId: team.id, teams: [team] };
  }
  throw new Error('Ukjent dataformat');
}

function loadData() {
  try {
    // Data lagret under det gamle navnet hentes inn første gang.
    const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(OLD_STORAGE_KEY);
    return raw ? migrate(JSON.parse(raw)) : emptyData();
  } catch (err) {
    console.error('Kunne ikke lese lagrede data', err);
    return emptyData();
  }
}

function saveData() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (err) {
    console.error('Kunne ikke lagre', err);
    showToast('Klarte ikke å lagre. Ta en sikkerhetskopi under «Mer».');
  }
}

let data = loadData();

// Laget som vises nå.
function team() {
  return data.teams.find((t) => t.id === data.activeTeamId) || data.teams[0];
}

// ---------- Små hjelpere ----------

const $ = (id) => document.getElementById(id);

function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// Lager et element med klasse og tekst. textContent er trygt for alle tegn.
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

let toastTimer;
function showToast(message) {
  const toast = $('toast');
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.hidden = true; }, 2600);
}

function clampHalf(value) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return MAX_HALF;
  return Math.min(MAX_HALF, Math.max(5, n));
}

function formatClock(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
}

function formatDate(isoDate) {
  return new Date(isoDate + 'T12:00').toLocaleDateString('nb-NO', {
    day: 'numeric', month: 'short', year: 'numeric'
  });
}

function todayIso() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

function zoneName(zone) {
  if (zone === null || zone === undefined) return 'Utenfor';
  if (zone === 4) return 'Midt i mål';
  return ZONE_ROWS[Math.floor(zone / 3)] + ' ' + ZONE_COLS[zone % 3];
}

function distanceLabel(id) {
  const d = DISTANCES.find((x) => x.id === id);
  return d ? d.label : '';
}

function getArea(id) {
  return id === AREA_7M.id ? AREA_7M : AREAS.find((a) => a.id === id);
}

// Hvor skuddet kom fra, som tekst. Eldre skudd har bare avstand.
function shotFromText(shot, useShort) {
  const area = getArea(shot.area);
  if (!area) return distanceLabel(shot.distance);
  return useShort ? area.short : area.label;
}

function getPlayer(id) {
  return team().players.find((p) => p.id === id);
}

function sortedPlayers() {
  return [...team().players].sort((a, b) => a.number - b.number);
}

function firstName(name) {
  return name.split(' ')[0];
}

// ---------- Eget «Er du sikker?»-vindu ----------
//
// Nettleserens egne confirm()/prompt() blokkeres i noen nettlesere,
// så appen har sitt eget vindu. Svaret kommer tilbake som et løfte (Promise):
//   bekreftelse → true eller null,  tekstspørsmål → teksten eller null.

let askResolve = null;

function ask({ title, message = '', okText = 'OK', danger = false, input = null }) {
  $('ask-title').textContent = title;
  $('ask-message').textContent = message;
  $('ask-message').hidden = !message;
  $('ask-ok').textContent = okText;
  $('ask-ok').className = 'btn ' + (danger ? 'btn-danger' : 'btn-primary');

  const field = $('ask-input');
  field.hidden = !input;
  if (input) {
    field.value = input.value || '';
    field.placeholder = input.placeholder || '';
    field.inputMode = input.inputMode || 'text';
  }

  $('ask-dialog').showModal();
  if (input) { field.focus(); field.select(); }
  return new Promise((resolve) => { askResolve = resolve; });
}

function closeAsk(answer) {
  const resolve = askResolve;
  askResolve = null;
  if ($('ask-dialog').open) $('ask-dialog').close();
  if (resolve) resolve(answer);
}

$('ask-form').addEventListener('submit', (event) => {
  event.preventDefault();
  closeAsk($('ask-input').hidden ? true : $('ask-input').value);
});
$('ask-cancel').addEventListener('click', () => closeAsk(null));
$('ask-dialog').addEventListener('close', () => closeAsk(null));   // Esc-tasten

// ---------- Navigasjon mellom sidene ----------

function showView(name) {
  document.querySelectorAll('.view').forEach((view) => {
    view.hidden = view.id !== 'view-' + name;
  });
  const activeTab = name === 'match' ? 'matches' : name;
  document.querySelectorAll('.tab').forEach((tab) => {
    tab.classList.toggle('active', tab.dataset.view === activeTab);
  });
  document.body.classList.toggle('in-match', name === 'match');
  window.scrollTo(0, 0);
}

document.querySelectorAll('.tab').forEach((tab) => {
  tab.addEventListener('click', () => showView(tab.dataset.view));
});

// =========================================================
// LAGET
// =========================================================

function renderTeam() {
  $('topbar-team').textContent = team().name || 'Mitt lag';
  $('input-team-name').value = team().name;
  $('input-team-half').value = team().halfLength;
}

$('input-team-name').addEventListener('input', (event) => {
  team().name = event.target.value.trim();
  $('topbar-team').textContent = team().name || 'Mitt lag';
  saveData();
  renderMatchList();
});

$('input-team-half').addEventListener('change', (event) => {
  team().halfLength = clampHalf(event.target.value);
  event.target.value = team().halfLength;
  saveData();
  showToast(`Omgangslengde: ${team().halfLength} min`);
});

function renderPlayers() {
  const sorted = sortedPlayers();
  const keepers = sorted.filter((p) => p.role === 'keeper');
  const outfield = sorted.filter((p) => p.role !== 'keeper');

  fillPlayerList($('list-keepers'), keepers);
  fillPlayerList($('list-players'), outfield);

  $('count-keepers').textContent = keepers.length;
  $('count-players').textContent = outfield.length;
  $('empty-players').hidden = sorted.length > 0;
  $('player-groups').hidden = sorted.length === 0;
}

function fillPlayerList(listElement, players) {
  listElement.replaceChildren();
  players.forEach((player) => {
    const row = el('button', 'player-row');
    row.type = 'button';
    row.setAttribute('aria-label', `Endre ${player.name}, nummer ${player.number}`);
    row.append(
      el('span', 'shirt' + (player.role === 'keeper' ? ' keeper' : ''), player.number),
      el('span', 'player-name', player.name),
      el('span', 'chevron', '›')
    );
    row.addEventListener('click', () => openPlayerDialog(player));
    const item = el('li');
    item.append(row);
    listElement.append(item);
  });
}

// ---------- Vinduet for ny / endre spiller ----------

const playerDialog = $('player-dialog');
const playerForm = $('player-form');
let editingPlayerId = null;   // null = ny spiller

function openPlayerDialog(player) {
  editingPlayerId = player ? player.id : null;
  $('player-dialog-title').textContent = player ? 'Endre spiller' : 'Ny spiller';
  $('input-number').value = player ? player.number : '';
  $('input-name').value = player ? player.name : '';
  playerForm.elements.role.value = player ? player.role : 'player';
  $('btn-delete-player').hidden = !player;
  $('player-error').hidden = true;
  playerDialog.showModal();
  (player ? $('input-name') : $('input-number')).focus();
}

function showPlayerError(message) {
  $('player-error').textContent = message;
  $('player-error').hidden = false;
}

playerForm.addEventListener('submit', (event) => {
  event.preventDefault();

  const number = Number($('input-number').value);
  const name = $('input-name').value.trim();
  const role = playerForm.elements.role.value;

  if (!Number.isInteger(number) || number < 1 || number > 99) {
    return showPlayerError('Draktnummer må være mellom 1 og 99.');
  }
  if (!name) {
    return showPlayerError('Skriv inn et navn.');
  }
  const taken = team().players.find((p) => p.number === number && p.id !== editingPlayerId);
  if (taken) {
    return showPlayerError(`Nummer ${number} er allerede brukt av ${taken.name}.`);
  }

  if (editingPlayerId) {
    Object.assign(getPlayer(editingPlayerId), { number, name, role });
    showToast(`${name} er oppdatert`);
  } else {
    team().players.push({ id: newId(), number, name, role });
    showToast(`${name} er lagt til`);
  }

  saveData();
  renderPlayers();
  playerDialog.close();
});

$('btn-add-player').addEventListener('click', () => openPlayerDialog(null));
$('btn-cancel-player').addEventListener('click', () => playerDialog.close());

$('btn-delete-player').addEventListener('click', async () => {
  const player = getPlayer(editingPlayerId);
  if (!player) return;
  playerDialog.close();
  const ok = await ask({
    title: `Slette ${player.name}?`,
    message: 'Skudd som allerede er registrert beholdes.',
    okText: 'Slett', danger: true
  });
  if (!ok) return;
  team().players = team().players.filter((p) => p.id !== player.id);
  saveData();
  renderPlayers();
  showToast(`${player.name} er slettet`);
});

// =========================================================
// KAMPER
// =========================================================

function matchScore(match, upTo) {
  let us = 0;
  let them = 0;
  (upTo || match.shots).forEach((shot) => {
    if (shot.result !== 'goal') return;
    if (shot.side === 'us') us++; else them++;
  });
  return { us, them };
}

// Viser hjemmelaget først, slik man er vant til.
function matchTitle(match) {
  const us = team().name || 'Vi';
  return match.home ? `${us} – ${match.opponent}` : `${match.opponent} – ${us}`;
}

function renderMatchList() {
  const list = $('list-matches');
  list.replaceChildren();
  const matches = [...team().matches].sort(
    (a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt
  );
  $('empty-matches').hidden = matches.length > 0;

  matches.forEach((match) => {
    const score = matchScore(match);
    const row = el('button', 'match-row');
    row.type = 'button';
    row.append(
      el('span', 'match-date', formatDate(match.date) + (match.home ? ' · Hjemme' : ' · Borte')),
      el('span', 'match-score', match.home ? `${score.us} – ${score.them}` : `${score.them} – ${score.us}`),
      el('span', 'match-title', matchTitle(match))
    );
    row.addEventListener('click', () => openMatch(match.id));
    const item = el('li');
    item.append(row);
    list.append(item);
  });
}

// ---------- Vinduet for ny kamp ----------

const matchDialog = $('match-dialog');
const matchForm = $('match-form');

$('btn-new-match').addEventListener('click', () => {
  matchForm.reset();
  $('input-date').value = todayIso();
  $('input-match-half').value = team().halfLength;
  $('match-error').hidden = true;
  matchDialog.showModal();
  $('input-opponent').focus();
});

$('btn-cancel-match').addEventListener('click', () => matchDialog.close());

matchForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const opponent = $('input-opponent').value.trim();
  const date = $('input-date').value;
  if (!opponent || !date) {
    $('match-error').textContent = 'Fyll inn motstander og dato.';
    $('match-error').hidden = false;
    return;
  }

  const firstKeeper = sortedPlayers().find((p) => p.role === 'keeper');
  const match = {
    id: newId(),
    createdAt: Date.now(),
    opponent,
    date,
    home: matchForm.elements.venue.value === 'home',
    halfLength: clampHalf($('input-match-half').value),
    keeperId: firstKeeper ? firstKeeper.id : null,
    clock: { half: 1, elapsedMs: 0, running: false, startedAt: null },
    shots: []
  };
  team().matches.push(match);
  saveData();
  matchDialog.close();
  renderMatchList();
  openMatch(match.id);
});

// =========================================================
// ÉN KAMP: klokke, registrering og tidslinje
// =========================================================

let currentMatchId = null;
let draft = newDraft('us');   // skuddet som holder på å bli registrert

// Spiller, bane og mål kan velges i hvilken som helst rekkefølge.
// Skuddet lagres først når man trykker Mål, Redning eller Utenfor.
function newDraft(side) {
  return { side, playerId: null, oppNumber: null, area: null, pos: null, zone: null };
}

function currentMatch() {
  return team().matches.find((m) => m.id === currentMatchId);
}

function openMatch(id) {
  currentMatchId = id;
  draft = newDraft('us');
  $('side-toggle').querySelector('input[value="us"]').checked = true;
  showView('match');
  renderMatch();
}

function renderMatch() {
  const match = currentMatch();
  if (!match) return;
  renderScoreboard(match);
  renderClock(match);
  renderShotPanel(match);
  renderLastShot(match);
  renderTimeline(match);
}

function renderScoreboard(match) {
  const score = matchScore(match);
  $('sb-us-name').textContent = team().name || 'Vi';
  $('sb-them-name').textContent = match.opponent;
  $('sb-us').textContent = score.us;
  $('sb-them').textContent = score.them;
}

// ---------- Klokke ----------

function halfMs(match) {
  return match.halfLength * 60 * 1000;
}

// Hvor lang tid som er gått i omgangen (millisekunder).
function clockMs(match) {
  const c = match.clock;
  const ms = c.elapsedMs + (c.running ? Date.now() - c.startedAt : 0);
  return Math.min(ms, halfMs(match));
}

// Kamptid i sekunder fra kampstart (2. omgang fortsetter der 1. slapp).
function gameSeconds(match, half, sec) {
  return (half - 1) * match.halfLength * 60 + sec;
}

function pauseClock(match) {
  match.clock.elapsedMs = clockMs(match);
  match.clock.running = false;
  match.clock.startedAt = null;
}

function renderClock(match) {
  const c = match.clock;
  const sec = Math.floor(clockMs(match) / 1000);
  const ended = clockMs(match) >= halfMs(match);

  $('clock-time').textContent = formatClock(gameSeconds(match, c.half, sec));
  $('clock-time').classList.toggle('ended', ended);
  $('clock-half').textContent = `${c.half}. omg · ${match.halfLength} min`;
  $('btn-clock').textContent = c.running ? '❚❚' : '▶';
  $('btn-clock').classList.toggle('running', c.running);
  $('btn-clock').setAttribute('aria-label', c.running ? 'Pause klokka' : 'Start klokka');
}

$('btn-clock').addEventListener('click', () => {
  const match = currentMatch();
  const c = match.clock;
  if (c.running) {
    pauseClock(match);
  } else {
    if (clockMs(match) >= halfMs(match)) {
      return showToast(c.half === 1 ? 'Omgangen er ferdig. Start 2. omgang i menyen ⋯' : 'Kampen er ferdig.');
    }
    c.running = true;
    c.startedAt = Date.now();
  }
  saveData();
  renderClock(match);
});

// Klokka oppdateres fire ganger i sekundet mens kampen vises.
setInterval(() => {
  if ($('view-match').hidden) return;
  const match = currentMatch();
  if (!match) return;
  if (match.clock.running && clockMs(match) >= halfMs(match)) {
    pauseClock(match);
    saveData();
    showToast(match.clock.half === 1 ? 'Pause! 1. omgang er ferdig.' : 'Kampen er ferdig!');
  }
  renderClock(match);
}, 250);

// ---------- Kampmeny (omgang og sletting) ----------

$('btn-match-menu').addEventListener('click', () => {
  const match = currentMatch();
  $('menu-title').textContent = matchTitle(match);
  $('btn-half').textContent = match.clock.half === 1 ? 'Start 2. omgang' : 'Tilbake til 1. omgang';
  $('match-menu').showModal();
});

$('btn-close-menu').addEventListener('click', () => $('match-menu').close());

$('btn-half').addEventListener('click', async () => {
  $('match-menu').close();
  const match = currentMatch();
  const c = match.clock;
  const toSecond = c.half === 1;
  const ok = await ask(toSecond
    ? { title: 'Starte 2. omgang?', message: 'Klokka settes til starten av 2. omgang.', okText: 'Start 2. omgang' }
    : { title: 'Tilbake til 1. omgang?', message: 'Klokka settes til slutten av 1. omgang.', okText: 'Gå tilbake' });
  if (!ok) return;
  c.half = toSecond ? 2 : 1;
  c.elapsedMs = toSecond ? 0 : halfMs(match);
  c.running = false;
  c.startedAt = null;
  saveData();
  renderClock(match);
});

$('btn-delete-match').addEventListener('click', async () => {
  $('match-menu').close();
  const match = currentMatch();
  const ok = await ask({
    title: 'Slette kampen?',
    message: `Kampen mot ${match.opponent} og alle skuddene slettes for godt.`,
    okText: 'Slett kamp', danger: true
  });
  if (!ok) return;
  team().matches = team().matches.filter((m) => m.id !== match.id);
  currentMatchId = null;
  saveData();
  renderMatchList();
  showView('matches');
  showToast('Kampen er slettet');
});

$('btn-back').addEventListener('click', () => {
  renderMatchList();
  showView('matches');
});

// ---------- Registrere skudd ----------

$('side-toggle').addEventListener('change', (event) => {
  draft = newDraft(event.target.value);
  renderShotPanel(currentMatch());
});

function playerButton(number, label, pressed, isKeeper, onClick) {
  const button = el('button', 'pbtn' + (isKeeper ? ' keeper' : ''));
  button.type = 'button';
  button.setAttribute('aria-pressed', pressed ? 'true' : 'false');
  button.append(el('b', '', number));
  if (label) button.append(el('small', '', label));
  button.addEventListener('click', onClick);
  return button;
}

function renderShotPanel(match) {
  const isUs = draft.side === 'us';
  $('view-match').classList.toggle('side-them', !isUs);
  renderPlayerColumn(match);
  renderCourt();
  renderGoal();
  renderSummary(match);

  const keeper = getPlayer(match.keeperId);
  $('btn-save').textContent = !isUs && keeper ? `Redning ${firstName(keeper.name)}` : 'Redning';
}

// Kolonnen til venstre: våre spillere, eller motstanderens numre + vår keeper.
function renderPlayerColumn(match) {
  const column = $('reg-players');
  column.replaceChildren();
  const players = sortedPlayers();
  const keepers = players.filter((p) => p.role === 'keeper');

  if (draft.side === 'us') {
    const outfield = players.filter((p) => p.role !== 'keeper');
    if (!players.length) {
      column.append(el('p', 'reg-note', 'Legg til spillere under «Laget».'));
    }
    [...outfield, ...keepers].forEach((p, i) => {
      if (i === outfield.length) column.append(el('p', 'reg-label', 'Keeper'));
      column.append(playerButton(p.number, firstName(p.name), draft.playerId === p.id, p.role === 'keeper',
        () => { draft.playerId = p.id; renderShotPanel(match); }));
    });
    return;
  }

  // Deres skudd: hvem står i mål for oss?
  column.append(el('p', 'reg-label', 'Vår keeper'));
  if (!keepers.length) column.append(el('p', 'reg-note', 'Ingen keepere'));
  keepers.forEach((k) => {
    column.append(playerButton(k.number, firstName(k.name), match.keeperId === k.id, true,
      () => { match.keeperId = k.id; saveData(); renderShotPanel(match); }));
  });

  // Motstanderens skytter: ukjent, numre brukt før i kampen, eller nytt nummer.
  column.append(el('p', 'reg-label', 'Skytter'));
  column.append(playerButton('?', 'ukjent', draft.oppNumber === null, false,
    () => { draft.oppNumber = null; renderShotPanel(match); }));
  const used = [...new Set(match.shots
    .filter((s) => s.side === 'them' && s.oppNumber)
    .map((s) => s.oppNumber))];
  if (draft.oppNumber && !used.includes(draft.oppNumber)) used.push(draft.oppNumber);
  used.sort((a, b) => a - b).forEach((n) => {
    column.append(playerButton(n, '', draft.oppNumber === n, false,
      () => { draft.oppNumber = n; renderShotPanel(match); }));
  });
  column.append(playerButton('+', 'nr', false, false, async () => {
    const answer = await ask({
      title: 'Motstanderens draktnummer',
      okText: 'Velg',
      input: { placeholder: 'F.eks. 10', inputMode: 'numeric' }
    });
    if (answer === null) return;
    const n = Number(answer);
    if (!Number.isInteger(n) || n < 1 || n > 99) return showToast('Skriv et nummer mellom 1 og 99');
    draft.oppNumber = n;
    renderShotPanel(match);
  }));
}

function renderGoal() {
  const goal = $('goal');
  goal.replaceChildren();
  for (let zone = 0; zone < 9; zone++) {
    const button = el('button', 'zone');
    button.type = 'button';
    button.setAttribute('aria-label', zoneName(zone));
    button.setAttribute('aria-pressed', draft.zone === zone ? 'true' : 'false');
    if (draft.zone === zone) button.textContent = '●';
    button.addEventListener('click', () => { draft.zone = zone; renderShotPanel(currentMatch()); });
    goal.append(button);
  }
}

// Linja under banen viser det som er valgt så langt.
function renderSummary(match) {
  const parts = [];
  if (draft.side === 'us') {
    const p = getPlayer(draft.playerId);
    if (p) parts.push(`#${p.number} ${firstName(p.name)}`);
  } else if (draft.oppNumber) {
    parts.push(`${match.opponent} #${draft.oppNumber}`);
  }
  const area = getArea(draft.area);
  if (area) parts.push(area.short);
  if (draft.zone !== null) parts.push(zoneName(draft.zone));

  const summary = $('draft-summary');
  summary.textContent = parts.length ? parts.join(' · ') : 'Velg spiller, bane og mål';
  summary.classList.toggle('placeholder', !parts.length);
  $('btn-7m').setAttribute('aria-pressed', draft.area === AREA_7M.id ? 'true' : 'false');
}

function registerShot(result) {
  const match = currentMatch();
  if (draft.side === 'us' && !draft.playerId) return showToast('Velg hvem som skjøt');
  if (!draft.area) return showToast('Trykk på banen der skuddet kom fra');
  if (result !== 'miss' && draft.zone === null) return showToast('Trykk hvor på målet skuddet gikk');

  const shot = {
    id: newId(),
    createdAt: Date.now(),
    side: draft.side,
    playerId: draft.side === 'us' ? draft.playerId : null,
    oppNumber: draft.side === 'them' ? draft.oppNumber : null,
    keeperId: draft.side === 'them' ? match.keeperId : null,
    area: draft.area,
    pos: draft.pos,
    distance: getArea(draft.area).distance,
    zone: result === 'miss' ? null : draft.zone,
    result,
    half: match.clock.half,
    sec: Math.floor(clockMs(match) / 1000)
  };
  match.shots.push(shot);
  saveData();

  draft = newDraft(draft.side);
  renderMatch();
}

$('btn-goal').addEventListener('click', () => registerShot('goal'));
$('btn-save').addEventListener('click', () => registerShot('save'));
$('btn-out').addEventListener('click', () => registerShot('miss'));

// ---------- Banen ----------
//
// Tegningen bruker 10 enheter per meter. Banen er 20 m bred, mållinjen
// ligger på y = 10, og vi viser 13 m ut fra mållinjen.

const SVG_NS = 'http://www.w3.org/2000/svg';
const toSvgX = (m) => (m + 10) * 10;
const toSvgY = (m) => 10 + m * 10;

// 6- og 9-meterlinjen: kvartsirkler rundt stolpene, rett strek imellom.
function arcPath(radius, close) {
  const r = radius * 10;
  return `M ${85 - r} 10 A ${r} ${r} 0 0 0 85 ${10 + r} L 115 ${10 + r} ` +
         `A ${r} ${r} 0 0 0 ${115 + r} 10` + (close ? ' Z' : '');
}

function svgEl(tag, attrs, parent) {
  const node = document.createElementNS(SVG_NS, tag);
  Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, value));
  parent.append(node);
  return node;
}

function buildCourt() {
  const svg = $('court');
  const defs = svgEl('defs', {}, svg);
  const clip = svgEl('clipPath', { id: 'clip-in9' }, defs);
  svgEl('path', { d: arcPath(9, true) }, clip);
  const mask = svgEl('mask', { id: 'mask-out9' }, defs);
  svgEl('rect', { x: 0, y: 0, width: 200, height: 140, fill: '#fff' }, mask);
  svgEl('path', { d: arcPath(9, true), fill: '#000' }, mask);
  const wings = AREAS.filter((a) => a.wing);
  wings.forEach((area) => {   // kanthjørnene hører ikke til backsonene
    svgEl('rect', { x: toSvgX(area.x1), y: 10, width: (area.x2 - area.x1) * 10, height: WING_DEPTH * 10, fill: '#000' }, mask);
  });

  svgEl('rect', { class: 'court-floor', x: 0, y: 10, width: 200, height: 130 }, svg);

  // Én flate per sone: et vertikalt felt, klippet innenfor eller utenfor 9 m.
  AREAS.forEach((area) => {
    svgEl('rect', {
      class: 'area',
      'data-area': area.id,
      x: toSvgX(area.x1), y: 10, width: (area.x2 - area.x1) * 10, height: 130,
      [area.inner ? 'clip-path' : 'mask']: area.inner ? 'url(#clip-in9)' : 'url(#mask-out9)'
    }, svg);
  });
  wings.forEach((area) => {
    svgEl('rect', {
      class: 'area',
      'data-area': area.id,
      x: toSvgX(area.x1), y: 10, width: (area.x2 - area.x1) * 10, height: WING_DEPTH * 10
    }, svg);
  });

  // Skillelinjer mellom sonene
  [-6.5, -2.5, 2.5, 6.5].forEach((x) => {
    svgEl('line', { class: 'court-divider', x1: toSvgX(x), y1: 10, x2: toSvgX(x), y2: 110, 'clip-path': 'url(#clip-in9)' }, svg);
  });
  [-3.5, 3.5].forEach((x) => {
    svgEl('line', { class: 'court-divider', x1: toSvgX(x), y1: 10, x2: toSvgX(x), y2: 140, mask: 'url(#mask-out9)' }, svg);
  });
  // Grensen under kanthjørnene, fra sidelinja inn til 9-meteren
  const wingEdge = (1.5 + Math.sqrt(81 - WING_DEPTH ** 2)) * 10;
  svgEl('line', { class: 'court-divider', x1: 0, y1: toSvgY(WING_DEPTH), x2: 100 - wingEdge, y2: toSvgY(WING_DEPTH) }, svg);
  svgEl('line', { class: 'court-divider', x1: 100 + wingEdge, y1: toSvgY(WING_DEPTH), x2: 200, y2: toSvgY(WING_DEPTH) }, svg);

  svgEl('path', { class: 'court-line dashed', d: arcPath(9, false) }, svg);
  svgEl('path', { class: 'court-goal-area', d: arcPath(6, true) }, svg);
  svgEl('line', { class: 'court-line', x1: 95, y1: toSvgY(7), x2: 105, y2: toSvgY(7) }, svg);
  svgEl('line', { class: 'court-line', x1: 0, y1: 10, x2: 200, y2: 10 }, svg);

  AREAS.forEach((area) => {
    svgEl('text', { class: 'court-text', x: area.lx, y: area.ly }, svg).textContent = area.short;
  });

  svgEl('circle', { class: 'court-dot', id: 'court-dot', r: 3.5, visibility: 'hidden' }, svg);

  svg.addEventListener('click', onCourtClick);
}

// Finner sonen for et punkt (i meter). Avstanden måles til nærmeste del av
// målet, slik 6- og 9-meterlinjene er tegnet.
function areaAt(x, y) {
  const distance = Math.hypot(Math.max(Math.abs(x) - 1.5, 0), y);
  const inner = distance < 9;
  const wing = AREAS.find((a) => a.wing && x >= a.x1 && x < a.x2);
  if (wing && (inner || y < WING_DEPTH)) return wing;
  return AREAS.find((a) => !a.wing && a.inner === inner && x >= a.x1 && x < a.x2);
}

function onCourtClick(event) {
  const svg = $('court');
  const point = svg.createSVGPoint();
  point.x = event.clientX;
  point.y = event.clientY;
  const p = point.matrixTransform(svg.getScreenCTM().inverse());

  const x = Math.round(Math.min(9.99, Math.max(-10, p.x / 10 - 10)) * 10) / 10;
  const y = Math.round(Math.min(13, Math.max(0, (p.y - 10) / 10)) * 10) / 10;
  draft.area = areaAt(x, y).id;
  draft.pos = { x, y };
  renderShotPanel(currentMatch());
}

$('btn-7m').addEventListener('click', () => {
  draft.area = AREA_7M.id;
  draft.pos = { ...AREA_7M.pos };
  renderShotPanel(currentMatch());
});

function renderCourt() {
  $('court').querySelectorAll('.area').forEach((rect) => {
    rect.classList.toggle('selected', rect.dataset.area === draft.area);
  });
  const dot = $('court-dot');
  if (draft.pos) {
    dot.setAttribute('cx', toSvgX(draft.pos.x));
    dot.setAttribute('cy', toSvgY(draft.pos.y));
    dot.setAttribute('visibility', 'visible');
  } else {
    dot.setAttribute('visibility', 'hidden');
  }
}

// ---------- Siste skudd og tidslinje ----------

function shotGameSeconds(match, shot) {
  return gameSeconds(match, shot.half, shot.sec);
}

function shotWho(match, shot, short) {
  if (shot.side === 'us') {
    const p = getPlayer(shot.playerId);
    if (!p) return 'Slettet spiller';
    return `#${p.number} ${short ? firstName(p.name) : p.name}`;
  }
  return (short ? 'Motst.' : match.opponent) + (shot.oppNumber ? ` #${shot.oppNumber}` : '');
}

const RESULT_WORDS = { goal: 'MÅL', save: 'Redning', miss: 'Utenfor' };

function renderLastShot(match) {
  const text = $('last-shot');
  text.replaceChildren();
  $('btn-undo').disabled = match.shots.length === 0;
  if (!match.shots.length) {
    text.textContent = 'Ingen skudd ennå';
    return;
  }
  const last = match.shots.reduce((a, b) => (b.createdAt > a.createdAt ? b : a));
  text.append(
    el('b', '', formatClock(shotGameSeconds(match, last)) + ' '),
    document.createTextNode(
      `${shotWho(match, last, true)} · ${shotFromText(last, true)} · ${RESULT_WORDS[last.result]}`
    )
  );
}

function renderTimeline(match) {
  // Sorter etter kamptid, og regn ut stillingen etter hvert mål.
  const ordered = [...match.shots].sort(
    (a, b) => shotGameSeconds(match, a) - shotGameSeconds(match, b) || a.createdAt - b.createdAt
  );
  const scoreAfter = new Map();
  ordered.forEach((shot, i) => scoreAfter.set(shot.id, matchScore(match, ordered.slice(0, i + 1))));

  const list = $('timeline');
  list.replaceChildren();
  $('empty-timeline').hidden = ordered.length > 0;
  $('timeline-hint').hidden = ordered.length === 0;

  [...ordered].reverse().forEach((shot) => {
    const item = el('li', 'tl-item ' + shot.side);

    const time = el('button', 'tl-time', formatClock(shotGameSeconds(match, shot)));
    time.type = 'button';
    time.title = 'Rett tiden';
    time.addEventListener('click', () => editShotTime(shot));

    let detail = `${shotFromText(shot)} · ${zoneName(shot.zone)}`;
    if (shot.side === 'them' && shot.result === 'save') {
      const k = getPlayer(shot.keeperId);
      if (k) detail += ` · ${k.name}`;
    }
    const main = el('div', 'tl-main');
    main.append(el('div', 'tl-who', shotWho(match, shot, false)), el('div', 'tl-detail', detail));

    let badge;
    if (shot.result === 'goal') {
      const s = scoreAfter.get(shot.id);
      badge = el('span', 'badge badge-goal', `MÅL ${s.us}–${s.them}`);
    } else if (shot.result === 'save') {
      badge = el('span', 'badge badge-save', 'Redning');
    } else {
      badge = el('span', 'badge', 'Utenfor');
    }

    const remove = el('button', 'tl-delete', '×');
    remove.type = 'button';
    remove.setAttribute('aria-label', 'Slett skuddet');
    remove.addEventListener('click', async () => {
      const ok = await ask({ title: 'Slette dette skuddet?', okText: 'Slett', danger: true });
      if (!ok) return;
      match.shots = match.shots.filter((s) => s.id !== shot.id);
      saveData();
      renderMatch();
    });

    item.append(time, main, badge, remove);
    list.append(item);
  });
}

async function editShotTime(shot) {
  const match = currentMatch();
  const halfSec = match.halfLength * 60;
  const answer = await ask({
    title: 'Når kom skuddet?',
    message: `Skriv kamptid som mm:ss. 2. omgang starter på ${formatClock(halfSec)}.`,
    okText: 'Lagre',
    input: { value: formatClock(shotGameSeconds(match, shot)), inputMode: 'numeric' }
  });
  if (answer === null) return;

  const parts = answer.trim().match(/^(\d{1,3})[:.]([0-5]\d)$/);
  if (!parts) return showToast('Skriv tiden som mm:ss, f.eks. 23:14');
  const total = Number(parts[1]) * 60 + Number(parts[2]);
  if (total > 2 * halfSec) return showToast(`Tiden kan ikke være over ${formatClock(2 * halfSec)}`);

  // Akkurat på pausesignalet beholdes omgangen skuddet allerede hadde.
  if (total < halfSec || (total === halfSec && shot.half === 1)) {
    shot.half = 1;
    shot.sec = total;
  } else {
    shot.half = 2;
    shot.sec = total - halfSec;
  }
  saveData();
  renderMatch();
  showToast('Tiden er rettet');
}

$('btn-undo').addEventListener('click', () => {
  const match = currentMatch();
  if (!match.shots.length) return;
  const last = match.shots.reduce((a, b) => (b.createdAt > a.createdAt ? b : a));
  match.shots = match.shots.filter((s) => s.id !== last.id);
  saveData();
  renderMatch();
  showToast('Siste skudd er angret');
});

// =========================================================
// SIKKERHETSKOPI
// =========================================================

$('btn-export').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `skuddkart-kopi-${todayIso()}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
  showToast('Kopien er lagret i Nedlastinger');
});

$('input-import').addEventListener('change', async (event) => {
  const file = event.target.files[0];
  event.target.value = '';   // gjør det mulig å velge samme fil igjen
  if (!file) return;

  let imported;
  try {
    imported = migrate(JSON.parse(await file.text()));
  } catch (err) {
    console.error(err);
    return showToast('Filen ser ikke ut som en Skuddkart-kopi');
  }
  const ok = await ask({
    title: 'Hente inn kopien?',
    message: 'Dette erstatter alt som ligger i appen nå.',
    okText: 'Hent inn', danger: true
  });
  if (!ok) return;
  data = imported;
  saveData();
  renderAll();
  showView('team');
  showToast('Kopien er hentet inn');
});

$('btn-reset').addEventListener('click', async () => {
  const ok = await ask({
    title: 'Slette alle data?',
    message: 'Alle spillere og kamper slettes fra denne nettleseren. Ta gjerne en kopi først.',
    okText: 'Slett alt', danger: true
  });
  if (!ok) return;
  data = emptyData();
  saveData();
  renderAll();
  showToast('Alle data er slettet');
});

// ---------- Start appen ----------

buildCourt();

function renderAll() {
  renderTeam();
  renderPlayers();
  renderMatchList();
}

renderAll();
