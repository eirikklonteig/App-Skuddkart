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
  { id: 'l9',  label: 'Venstre bak 9 m+',  short: 'V. bak',   distance: '9+',  inner: false, x1: -10,  x2: -3.5, lx: 32,  ly: 127 },
  { id: 'm9',  label: 'Midt bak 9 m+',     short: 'Midt bak', distance: '9+',  inner: false, x1: -3.5, x2: 3.5,  lx: 100, ly: 127 },
  { id: 'r9',  label: 'Høyre bak 9 m+',    short: 'H. bak',   distance: '9+',  inner: false, x1: 3.5,  x2: 10,   lx: 168, ly: 127 }
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
// events:  { id, createdAt, side, type: 'yellow' | '2min' | 'red' | 'timeout',
//            playerId, oppNumber, half, sec }   (matches.events, kan mangle i eldre kamper)

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

//   Med half: 1 eller 2 vises også et valg av omgang, og svaret blir
//   { text, half } eller null.

let askResolve = null;

function ask({ title, message = '', okText = 'OK', danger = false, input = null, half = null }) {
  $('ask-title').textContent = title;
  $('ask-message').textContent = message;
  $('ask-message').hidden = !message;
  $('ask-ok').textContent = okText;
  $('ask-ok').className = 'btn ' + (danger ? 'btn-danger' : 'btn-primary');

  $('ask-half').hidden = !half;
  if (half) $('ask-half').querySelector(`input[value="${half}"]`).checked = true;

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
  if ($('ask-input').hidden) return closeAsk(true);
  const text = $('ask-input').value;
  if ($('ask-half').hidden) return closeAsk(text);
  closeAsk({ text, half: Number($('ask-half').querySelector('input:checked').value) });
});
$('ask-cancel').addEventListener('click', () => closeAsk(null));
$('ask-dialog').addEventListener('close', () => {   // Esc-tasten
  if (!$('ask-dialog').open) closeAsk(null);
});

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
  if (name === 'stats') renderStats();
  window.scrollTo(0, 0);
}

document.querySelectorAll('.tab').forEach((tab) => {
  tab.addEventListener('click', () => showView(tab.dataset.view));
});

// =========================================================
// LAG
// =========================================================
//
// Appen kan ha flere lag. Alt annet (spillere, kamper, statistikk)
// gjelder laget som er valgt, se team().

function teamName(t) {
  return (t || team()).name || 'Mitt lag';
}

function sortedTeams() {
  return [...data.teams].sort((a, b) => teamName(a).localeCompare(teamName(b), 'nb'));
}

function renderTeam() {
  $('topbar-team').textContent = teamName();
  $('team-heading').textContent = teamName();
  $('input-team-name').value = team().name;
  $('input-team-half').value = team().halfLength;
  const archived = !!team().archived;
  $('btn-archive-team').textContent = archived ? 'Hent fram laget' : 'Arkiver laget';
  $('team-admin-text').textContent = archived
    ? 'Laget er arkivert. Kampene og statistikken er tatt vare på. Hent det fram for å bruke det igjen.'
    : 'Arkiver laget når sesongen er over. Kampene og statistikken blir tatt vare på, og laget kan hentes fram igjen.';
}

// Listen over alle lag øverst på «Lag»-siden
function renderTeamList() {
  const activeTeams = sortedTeams().filter((t) => !t.archived);
  const archivedTeams = sortedTeams().filter((t) => t.archived);
  fillTeamRows($('team-list'), activeTeams);
  fillTeamRows($('archived-list'), archivedTeams);
  $('archived-teams').hidden = archivedTeams.length === 0;
  $('archived-summary').textContent = `Arkiverte lag (${archivedTeams.length})`;
  if (team().archived) $('archived-teams').open = true;
}

function fillTeamRows(list, teams) {
  list.replaceChildren();
  teams.forEach((t) => {
    const active = t.id === team().id;
    const row = el('button', 'match-row team-row' + (active ? ' active' : ''));
    row.type = 'button';
    const meta = el('span', 'match-date', `${t.players.length} spillere · ${t.matches.length} kamper`);
    if (t.archived) meta.append(el('span', 'status status-archived', 'Arkivert'));
    if (active) meta.append(el('span', 'status status-done', 'Valgt'));
    row.append(meta, el('span', 'match-score', active ? '✓' : '›'), el('span', 'match-title', teamName(t)));
    row.addEventListener('click', () => selectTeam(t.id));
    const item = el('li');
    item.append(row);
    list.append(item);
  });
}

// ---------- Arkivere lag ----------

$('btn-archive-team').addEventListener('click', async () => {
  const t = team();
  if (t.archived) {
    t.archived = false;
    saveData();
    renderAll();
    showToast(`${teamName(t)} er hentet fram`);
    return;
  }
  const ok = await ask({
    title: `Arkivere ${teamName(t)}?`,
    message: 'Laget flyttes til «Arkiverte lag». Ingenting slettes, og du kan hente det fram igjen.',
    okText: 'Arkiver'
  });
  if (!ok) return;
  t.archived = true;
  // Bytt til et annet aktivt lag hvis det finnes
  const next = sortedTeams().find((x) => !x.archived);
  if (next) data.activeTeamId = next.id;
  saveData();
  statsMatchId = 'all';
  renderAll();
  showToast(`${teamName(t)} er arkivert`);
});

function selectTeam(id) {
  if (id === team().id) return;
  data.activeTeamId = id;
  saveData();
  statsMatchId = 'all';
  currentMatchId = null;
  renderAll();
  showToast(`Viser ${teamName()}`);
}

$('input-team-name').addEventListener('input', (event) => {
  team().name = event.target.value.trim();
  $('topbar-team').textContent = teamName();
  $('team-heading').textContent = teamName();
  saveData();
  renderMatchList();
  renderTeamList();
});

// ---------- Nytt lag ----------

$('btn-new-team').addEventListener('click', () => {
  $('team-form').reset();
  $('input-new-team-half').value = team().halfLength;
  const copyFrom = $('input-copy-from');
  copyFrom.replaceChildren(new Option('Ingen – start med tom spillerliste', ''));
  sortedTeams().forEach((t) => {
    if (t.players.length) {
      copyFrom.append(new Option(`${teamName(t)} (${t.players.length} spillere)` + (t.archived ? ' – arkivert' : ''), t.id));
    }
  });
  $('team-error').hidden = true;
  $('team-dialog').showModal();
  $('input-new-team').focus();
});

$('btn-cancel-team').addEventListener('click', () => $('team-dialog').close());

$('team-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const name = $('input-new-team').value.trim();
  if (!name) {
    $('team-error').textContent = 'Skriv inn et lagnavn.';
    $('team-error').hidden = false;
    return;
  }
  if (data.teams.some((t) => teamName(t).toLowerCase() === name.toLowerCase())) {
    $('team-error').textContent = `Det finnes allerede et lag som heter ${name}.`;
    $('team-error').hidden = false;
    return;
  }

  const newT = newTeam(name);
  newT.halfLength = clampHalf($('input-new-team-half').value);
  // Kopierte spillere får nye id-er, så lagene er helt uavhengige.
  const source = data.teams.find((t) => t.id === $('input-copy-from').value);
  if (source) newT.players = source.players.map((p) => ({ ...p, id: newId() }));

  data.teams.push(newT);
  $('team-dialog').close();
  selectTeam(newT.id);
  showToast(`${name} er laget` + (source ? ` med ${newT.players.length} spillere` : ''));
});

// ---------- Slett lag ----------

$('btn-delete-team').addEventListener('click', async () => {
  const t = team();
  const ok = await ask({
    title: `Slette ${teamName(t)}?`,
    message: `Laget, ${t.players.length} spillere og ${t.matches.length} kamper med all statistikk slettes for godt. Ta gjerne en sikkerhetskopi først.`,
    okText: 'Slett laget', danger: true
  });
  if (!ok) return;
  data.teams = data.teams.filter((x) => x.id !== t.id);
  // Appen trenger minst ett lag. Var dette det siste, lages et tomt lag.
  if (!data.teams.length) data.teams.push(newTeam('Mitt lag'));
  data.activeTeamId = (sortedTeams().find((x) => !x.archived) || sortedTeams()[0]).id;
  saveData();
  statsMatchId = 'all';
  renderAll();
  showToast(`${teamName(t)} er slettet`);
});

// ---------- Bytt lag fra toppfeltet ----------

$('btn-team-switch').addEventListener('click', () => {
  const list = $('team-switch-list');
  list.replaceChildren();
  sortedTeams().filter((t) => !t.archived || t.id === team().id).forEach((t) => {
    const active = t.id === team().id;
    const button = el('button', 'btn btn-secondary' + (active ? ' active' : ''));
    button.type = 'button';
    button.append(el('span', '', teamName(t)), el('span', 'switch-meta', active ? '✓ valgt' : `${t.matches.length} kamper`));
    button.addEventListener('click', () => {
      $('team-switch-dialog').close();
      selectTeam(t.id);
    });
    list.append(button);
  });
  $('team-switch-dialog').showModal();
});

$('btn-close-switch').addEventListener('click', () => $('team-switch-dialog').close());
$('btn-manage-teams').addEventListener('click', () => {
  $('team-switch-dialog').close();
  showView('team');
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

// fromMatch: spilleren legges også rett inn i troppen til kampen som er åpen.
let addPlayerToMatch = false;

function openPlayerDialog(player, fromMatch) {
  editingPlayerId = player ? player.id : null;
  addPlayerToMatch = !!fromMatch;
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
    const player = { id: newId(), number, name, role };
    team().players.push(player);
    const match = addPlayerToMatch ? currentMatch() : null;
    if (match && match.squad) match.squad.push(player.id);
    showToast(`${name} er lagt til`);
  }

  saveData();
  renderPlayers();
  playerDialog.close();
  if (addPlayerToMatch && currentMatch()) renderMatch();
});

$('btn-add-player').addEventListener('click', () => openPlayerDialog(null));

$('input-number').addEventListener('keydown', (event) => {
  if (event.key !== 'Enter') return;
  event.preventDefault();
  $('input-name').focus();
});
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
    const date = el('span', 'match-date', formatDate(match.date) + (match.home ? ' · Hjemme' : ' · Borte'));
    date.append(match.finished
      ? el('span', 'status status-done', 'Ferdig')
      : el('span', 'status status-live', 'Pågår'));
    row.append(
      date,
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
  fillSquadList('new-squad', defaultSquad());
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

  const squad = readSquad('new-squad');
  const firstKeeper = sortedPlayers().find((p) => p.role === 'keeper' && squad.includes(p.id));
  const match = {
    id: newId(),
    createdAt: Date.now(),
    opponent,
    date,
    home: matchForm.elements.venue.value === 'home',
    halfLength: clampHalf($('input-match-half').value),
    keeperId: firstKeeper ? firstKeeper.id : null,
    clock: { half: 1, elapsedMs: 0, running: false, startedAt: null },
    squad,
    shots: [],
    events: []
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

  // En avsluttet kamp er låst for nye skudd, men tidslinjen kan rettes.
  const finished = !!match.finished;
  $('reg-card').hidden = finished;
  $('finished-card').hidden = !finished;
  $('btn-clock').disabled = finished;
  if (finished) {
    const score = matchScore(match);
    $('finished-score').textContent = `${team().name || 'Vi'} ${score.us} – ${score.them} ${match.opponent}`;
  }
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

// Kamptid i sekunder fra kampstart. Brukes bare til å sortere og regne
// (for eksempel utvisninger som varer inn i 2. omgang). Klokka som vises,
// starter på 00:00 i hver omgang.
function gameSeconds(match, half, sec) {
  return (half - 1) * match.halfLength * 60 + sec;
}

// Tid som tekst, for eksempel «12:34 (2.)»
function timeText(item) {
  return `${formatClock(item.sec)} (${item.half}.)`;
}

function pauseClock(match) {
  match.clock.elapsedMs = clockMs(match);
  match.clock.running = false;
  match.clock.startedAt = null;
}

function startClock(match) {
  match.clock.running = true;
  match.clock.startedAt = Date.now();
}

// Time-out: kampklokka står, og ett minutt telles ned i sanntid.
const TIMEOUT_MS = 60 * 1000;

function timeoutLeftMs(match) {
  return match.timeout ? Math.max(0, match.timeout.endsAt - Date.now()) : 0;
}

function renderClock(match) {
  const c = match.clock;
  const sec = Math.floor(clockMs(match) / 1000);
  const timeUp = clockMs(match) >= halfMs(match);

  $('clock-time').textContent = formatClock(sec);
  $('clock-time').classList.toggle('ended', timeUp || !!c.halfEnded);
  $('clock-half').textContent = c.halfEnded
    ? (c.half === 1 ? 'Pause' : 'Slutt')
    : `${c.half}. omg · ${match.halfLength} min`;
  $('btn-clock').textContent = c.running ? '❚❚' : '▶';
  $('btn-clock').classList.toggle('running', c.running);
  $('btn-clock').setAttribute('aria-label', c.running ? 'Pause klokka' : 'Start klokka');
  renderSuspensions(match);
}

$('btn-clock').addEventListener('click', async () => {
  const match = currentMatch();
  if (match.finished) return;
  const c = match.clock;

  if (match.timeout) {
    // ▶ under eller etter time-out: kampen settes i gang igjen
    match.timeout = null;
  } else if (c.running) {
    pauseClock(match);
    saveData();
    return renderClock(match);
  }

  if (c.halfEnded) {
    if (c.half === 2) return showToast('Kampen er ferdig. Avslutt kampen i menyen ⋯');
    return startSecondHalf(match);
  }
  if (clockMs(match) >= halfMs(match)) {
    return showToast(`Tiden er ute. Avslutt ${c.half}. omgang i menyen ⋯`);
  }
  startClock(match);
  saveData();
  renderClock(match);
});

// Trykk på klokka for å stille den (for eksempel etter hallens klokke).
$('btn-set-clock').addEventListener('click', async () => {
  const match = currentMatch();
  if (match.finished || match.clock.halfEnded) return;
  const answer = await ask({
    title: 'Still klokka',
    message: `Skriv tiden i ${match.clock.half}. omgang som mm:ss (maks ${formatClock(match.halfLength * 60)}).`,
    okText: 'Still klokka',
    input: { value: formatClock(Math.floor(clockMs(match) / 1000)), inputMode: 'numeric' }
  });
  if (answer === null) return;
  const sec = parseClock(answer, match);
  if (sec === null) return;
  match.clock.elapsedMs = sec * 1000;
  if (match.clock.running) match.clock.startedAt = Date.now();
  saveData();
  renderClock(match);
  showToast(`Klokka er stilt til ${formatClock(sec)}`);
});

// Leser «mm:ss» (eller «mm.ss») og sjekker at det er innenfor en omgang.
function parseClock(text, match) {
  const parts = String(text).trim().match(/^(\d{1,2})[:.,]([0-5]\d)$/);
  if (!parts) {
    showToast('Skriv tiden som mm:ss, f.eks. 14:20');
    return null;
  }
  const sec = Number(parts[1]) * 60 + Number(parts[2]);
  if (sec > match.halfLength * 60) {
    showToast(`En omgang er bare ${match.halfLength} minutter`);
    return null;
  }
  return sec;
}

// Klokka oppdateres fire ganger i sekundet mens kampen vises.
setInterval(() => {
  if ($('view-match').hidden) return;
  const match = currentMatch();
  if (!match) return;
  if (match.clock.running && clockMs(match) >= halfMs(match)) {
    pauseClock(match);
    saveData();
    showToast(`Tiden er ute. Avslutt ${match.clock.half === 1 ? '1. omgang' : 'kampen'} i menyen ⋯ når du er klar.`);
  }
  if (match.timeout && !match.timeout.done && timeoutLeftMs(match) === 0) {
    match.timeout.done = true;
    saveData();
    showToast('Time-out er ferdig. Trykk ▶ når kampen starter igjen.');
  }
  renderClock(match);
}, 250);

// ---------- Omganger ----------

function addHalfEnd(match, half) {
  if (!match.events) match.events = [];
  match.events = match.events.filter((ev) => !(ev.type === 'halfend' && ev.half === half));
  match.events.push({
    id: newId(), createdAt: Date.now(), side: 'none', type: 'halfend',
    half, sec: Math.floor(clockMs(match) / 1000)
  });
}

function removeHalfEnd(match, half) {
  match.events = (match.events || []).filter((ev) => !(ev.type === 'halfend' && ev.half === half));
}

async function endFirstHalf(match) {
  const ok = await ask({
    title: 'Avslutte 1. omgang?',
    message: 'Klokka stoppes og «Slutt 1. omgang» legges i tidslinjen. ' +
             'Du kan fortsatt rette og registrere før du starter 2. omgang.',
    okText: 'Avslutt 1. omgang'
  });
  if (!ok) return;
  pauseClock(match);
  match.timeout = null;
  match.clock.halfEnded = true;
  match.clock.firstHalfMs = match.clock.elapsedMs;
  addHalfEnd(match, 1);
  saveData();
  renderMatch();
  showToast('Pause. Trykk ▶ når 2. omgang starter.');
}

async function startSecondHalf(match) {
  const ok = await ask({
    title: 'Starte 2. omgang?',
    message: 'Klokka starter på 00:00.',
    okText: 'Start 2. omgang'
  });
  if (!ok) return;
  const c = match.clock;
  c.half = 2;
  c.elapsedMs = 0;
  c.halfEnded = false;
  startClock(match);
  saveData();
  renderMatch();
}

// ---------- Kampmeny (statistikk, omgang, avslutt, slett) ----------

$('btn-match-menu').addEventListener('click', () => {
  const match = currentMatch();
  const c = match.clock;
  $('menu-title').textContent = matchTitle(match);

  let halfText = '';
  if (c.half === 1 && !c.halfEnded) halfText = 'Avslutt 1. omgang';
  else if (c.half === 1) halfText = 'Start 2. omgang';
  else halfText = 'Tilbake til 1. omgang';
  $('btn-half').textContent = halfText;
  $('btn-half').hidden = !!match.finished;
  $('btn-reopen-half').hidden = !!match.finished || !(c.half === 1 && c.halfEnded);
  $('btn-squad').hidden = !!match.finished;
  $('btn-finish').textContent = match.finished ? 'Gjenåpne kamp' : 'Avslutt kamp';
  $('match-menu').showModal();
});

$('btn-close-menu').addEventListener('click', () => $('match-menu').close());

$('btn-menu-stats').addEventListener('click', () => {
  $('match-menu').close();
  openStats(currentMatchId);
});

$('btn-finished-stats').addEventListener('click', () => openStats(currentMatchId));

$('btn-finish').addEventListener('click', async () => {
  $('match-menu').close();
  const match = currentMatch();

  if (match.finished) {
    match.finished = false;
    removeHalfEnd(match, 2);
    match.clock.halfEnded = false;
    saveData();
    renderMatch();
    showToast('Kampen er åpnet igjen');
    return;
  }

  const score = matchScore(match);
  const ok = await ask({
    title: 'Avslutte kampen?',
    message: `Sluttresultat ${team().name || 'Vi'} ${score.us} – ${score.them} ${match.opponent}. ` +
             'Klokka stoppes og registreringen låses. Du kan gjenåpne kampen senere.',
    okText: 'Avslutt kamp'
  });
  if (!ok) return;
  pauseClock(match);
  match.timeout = null;
  if (match.clock.half === 2) {
    addHalfEnd(match, 2);
    match.clock.halfEnded = true;
  }
  match.finished = true;
  match.finishedAt = Date.now();
  saveData();
  renderMatch();
  openStats(match.id);
  offerBackup();
});

$('btn-half').addEventListener('click', async () => {
  $('match-menu').close();
  const match = currentMatch();
  const c = match.clock;
  if (c.half === 1 && !c.halfEnded) return endFirstHalf(match);
  if (c.half === 1) return startSecondHalf(match);

  const ok = await ask({
    title: 'Tilbake til 1. omgang?',
    message: 'Klokka settes tilbake til pausen etter 1. omgang. Bruk dette bare hvis 2. omgang ble startet ved en feil.',
    okText: 'Gå tilbake'
  });
  if (!ok) return;
  c.half = 1;
  c.elapsedMs = c.firstHalfMs || halfMs(match);
  c.halfEnded = true;
  c.running = false;
  c.startedAt = null;
  saveData();
  renderMatch();
});

$('btn-reopen-half').addEventListener('click', () => {
  $('match-menu').close();
  const match = currentMatch();
  match.clock.halfEnded = false;
  removeHalfEnd(match, 1);
  saveData();
  renderMatch();
  showToast('1. omgang er åpnet igjen');
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
// ---------- Kamptropp ----------
//
// match.squad er en liste med spiller-id-er. Mangler den (eldre kamper),
// er alle lagets spillere med.

function squadPlayers(match) {
  return sortedPlayers().filter((p) => !match.squad || match.squad.includes(p.id));
}

// Troppen fra lagets forrige kamp, eller alle spillerne hvis det ikke finnes noen.
function defaultSquad() {
  const last = [...team().matches].sort((a, b) => b.createdAt - a.createdAt)[0];
  const ids = team().players.map((p) => p.id);
  if (!last || !last.squad) return ids;
  return ids.filter((id) => last.squad.includes(id));
}

function fillSquadList(listId, selectedIds) {
  const list = $(listId);
  list.replaceChildren();
  const players = sortedPlayers().sort((a, b) => (a.role === 'keeper') - (b.role === 'keeper'));
  if (!players.length) list.append(el('p', 'reg-note', 'Laget har ingen spillere ennå.'));
  players.forEach((p) => {
    const row = el('label', 'squad-row' + (p.role === 'keeper' ? ' keeper' : ''));
    const box = el('input');
    box.type = 'checkbox';
    box.value = p.id;
    box.checked = selectedIds.includes(p.id);
    box.addEventListener('change', () => updateSquadCount(listId));
    row.append(box, el('b', '', p.number), el('span', '', p.name));
    list.append(row);
  });
  updateSquadCount(listId);
}

function readSquad(listId) {
  return [...$(listId).querySelectorAll('input:checked')].map((box) => box.value);
}

function updateSquadCount(listId) {
  const total = $(listId).querySelectorAll('input').length;
  $(listId + '-count').textContent = '(' + readSquad(listId).length + ' av ' + total + ')';
}

document.querySelectorAll('[data-squad-all], [data-squad-none]').forEach((button) => {
  button.addEventListener('click', () => {
    const listId = button.dataset.squadAll || button.dataset.squadNone;
    $(listId).querySelectorAll('input').forEach((box) => { box.checked = !!button.dataset.squadAll; });
    updateSquadCount(listId);
  });
});

$('btn-squad').addEventListener('click', () => {
  $('match-menu').close();
  const match = currentMatch();
  fillSquadList('edit-squad', match.squad || team().players.map((p) => p.id));
  $('squad-dialog').showModal();
});

$('btn-cancel-squad').addEventListener('click', () => $('squad-dialog').close());

$('squad-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const match = currentMatch();
  match.squad = readSquad('edit-squad');
  if (match.keeperId && !match.squad.includes(match.keeperId)) {
    const keeper = squadPlayers(match).find((p) => p.role === 'keeper');
    match.keeperId = keeper ? keeper.id : null;
  }
  saveData();
  $('squad-dialog').close();
  renderMatch();
  showToast('Kamptropp: ' + match.squad.length + ' spillere');
});

function renderPlayerColumn(match) {
  const column = $('reg-players');
  column.replaceChildren();
  const players = squadPlayers(match);
  const keepers = players.filter((p) => p.role === 'keeper');

  if (draft.side === 'us') {
    const outfield = players.filter((p) => p.role !== 'keeper');
    if (!players.length) {
      column.append(el('p', 'reg-note', 'Legg til spillere under «Lag».'));
    }
    [...outfield, ...keepers].forEach((p, i) => {
      if (i === outfield.length) column.append(el('p', 'reg-label', 'Keeper'));
      column.append(playerButton(p.number, firstName(p.name), draft.playerId === p.id, p.role === 'keeper',
        () => { draft.playerId = p.id; renderShotPanel(match); }));
    });
    // «+»: ny spiller midt i kampen, legges rett inn i troppen
    const add = playerButton('+', 'spiller', false, false, () => openPlayerDialog(null, true));
    add.classList.add('add');
    column.append(add);
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
  const used = [...new Set([...match.shots, ...(match.events || [])]
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
  if (match.finished) return showToast('Kampen er avsluttet. Gjenåpne den i menyen ⋯');
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

// Tegner banen i en <svg>. Brukes både i registreringen og i statistikken,
// så id-ene får et eget prefiks per tegning.
function buildCourt(svg, prefix, withLabels) {
  const id = (name) => `${prefix}-${name}`;
  const defs = svgEl('defs', {}, svg);
  const clip = svgEl('clipPath', { id: id('in9') }, defs);
  svgEl('path', { d: arcPath(9, true) }, clip);

  // Utenfor 9 m (for kanthjørnene)
  const outside = svgEl('mask', { id: id('out9') }, defs);
  svgEl('rect', { x: 0, y: 0, width: 200, height: 140, fill: '#fff' }, outside);
  svgEl('path', { d: arcPath(9, true), fill: '#000' }, outside);

  // Utenfor 9 m, men uten kanthjørnene (for backsonene)
  const backs = svgEl('mask', { id: id('backs') }, defs);
  svgEl('rect', { x: 0, y: 0, width: 200, height: 140, fill: '#fff' }, backs);
  svgEl('path', { d: arcPath(9, true), fill: '#000' }, backs);
  const wings = AREAS.filter((a) => a.wing);
  wings.forEach((area) => {
    svgEl('rect', { x: toSvgX(area.x1), y: 10, width: (area.x2 - area.x1) * 10, height: WING_DEPTH * 10, fill: '#000' }, backs);
  });

  svgEl('rect', { class: 'court-floor', x: 0, y: 10, width: 200, height: 130 }, svg);

  // Én flate per sone: et vertikalt felt, klippet innenfor eller utenfor 9 m.
  AREAS.forEach((area) => {
    svgEl('rect', {
      class: 'area',
      'data-area': area.id,
      x: toSvgX(area.x1), y: 10, width: (area.x2 - area.x1) * 10, height: 130,
      [area.inner ? 'clip-path' : 'mask']: area.inner ? `url(#${id('in9')})` : `url(#${id('backs')})`
    }, svg);
  });
  // Kanthjørnene utenfor 9 m hører også til kantsonene
  wings.forEach((area) => {
    svgEl('rect', {
      class: 'area',
      'data-area': area.id,
      x: toSvgX(area.x1), y: 10, width: (area.x2 - area.x1) * 10, height: WING_DEPTH * 10,
      mask: `url(#${id('out9')})`
    }, svg);
  });

  // Skillelinjer mellom sonene
  [-6.5, -2.5, 2.5, 6.5].forEach((x) => {
    svgEl('line', { class: 'court-divider', x1: toSvgX(x), y1: 10, x2: toSvgX(x), y2: 110, 'clip-path': `url(#${id('in9')})` }, svg);
  });
  [-3.5, 3.5].forEach((x) => {
    svgEl('line', { class: 'court-divider', x1: toSvgX(x), y1: 10, x2: toSvgX(x), y2: 140, mask: `url(#${id('backs')})` }, svg);
  });
  // Grensen under kanthjørnene, fra sidelinja inn til 9-meteren
  const wingEdge = (1.5 + Math.sqrt(81 - WING_DEPTH ** 2)) * 10;
  svgEl('line', { class: 'court-divider', x1: 0, y1: toSvgY(WING_DEPTH), x2: 100 - wingEdge, y2: toSvgY(WING_DEPTH) }, svg);
  svgEl('line', { class: 'court-divider', x1: 100 + wingEdge, y1: toSvgY(WING_DEPTH), x2: 200, y2: toSvgY(WING_DEPTH) }, svg);

  svgEl('path', { class: 'court-line dashed', d: arcPath(9, false) }, svg);
  svgEl('path', { class: 'court-goal-area', d: arcPath(6, true) }, svg);
  svgEl('line', { class: 'court-line', x1: 95, y1: toSvgY(7), x2: 105, y2: toSvgY(7) }, svg);
  svgEl('line', { class: 'court-line', x1: 0, y1: 10, x2: 200, y2: 10 }, svg);

  if (withLabels) {
    AREAS.forEach((area) => {
      svgEl('text', { class: 'court-text', x: area.lx, y: area.ly }, svg).textContent = area.short;
    });
  }
}

function buildRegistrationCourt() {
  const svg = $('court');
  buildCourt(svg, 'reg', true);
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

// Alt som skjedde i kampen (skudd og hendelser), sortert etter kamptid.
function matchItems(match) {
  return [
    ...match.shots.map((obj) => ({ kind: 'shot', obj })),
    ...(match.events || []).map((obj) => ({ kind: 'event', obj }))
  ].sort((a, b) => shotGameSeconds(match, a.obj) - shotGameSeconds(match, b.obj) ||
                   a.obj.createdAt - b.obj.createdAt);
}

// Det som sist ble registrert (for «Siste» og «Angre»).
// «Slutt omgang» angres ikke her, men med «Gjenåpne» i menyen.
function lastItem(match) {
  const items = matchItems(match).filter((it) => it.obj.type !== 'halfend');
  return items.length ? items.reduce((a, b) => (b.obj.createdAt > a.obj.createdAt ? b : a)) : null;
}

function eventLabel(ev) {
  if (ev.type === 'halfend') return `Slutt ${ev.half}. omgang`;
  return EVENT_TYPES[ev.type].label;
}

function eventWho(match, ev, short) {
  if (ev.type === 'timeout') return ev.side === 'us' ? teamName() : match.opponent;
  return shotWho(match, ev, short);
}

function renderLastShot(match) {
  const text = $('last-shot');
  text.replaceChildren();
  const last = lastItem(match);
  $('btn-undo').disabled = !last;
  if (!last) {
    text.textContent = 'Ingen skudd ennå';
    return;
  }
  const o = last.obj;
  const what = last.kind === 'shot'
    ? `${shotWho(match, o, true)} · ${shotFromText(o, true)} · ${RESULT_WORDS[o.result]}`
    : `${eventWho(match, o, true)} · ${eventLabel(o)}`;
  text.append(el('b', '', timeText(o) + ' '), document.createTextNode(what));
}

function renderTimeline(match) {
  const items = matchItems(match);

  // Stillingen etter hvert mål
  const scoreAfter = new Map();
  const shotsSoFar = [];
  items.forEach(({ kind, obj }) => {
    if (kind !== 'shot') return;
    shotsSoFar.push(obj);
    scoreAfter.set(obj.id, matchScore(match, shotsSoFar));
  });

  const list = $('timeline');
  list.replaceChildren();
  $('empty-timeline').hidden = items.length > 0;
  $('timeline-hint').hidden = items.length === 0;

  let shownHalf = null;
  [...items].reverse().forEach(({ kind, obj }) => {
    // Overskrift for hver omgang (nyeste først)
    if (obj.half !== shownHalf) {
      shownHalf = obj.half;
      list.append(el('li', 'tl-half', `${obj.half}. omgang`));
    }

    // «Slutt omgang»: trykk for å se statistikk for omgangen
    if (obj.type === 'halfend') {
      const item = el('li', 'tl-halfend');
      const button = el('button', 'tl-halfend-btn');
      button.type = 'button';
      button.append(
        el('span', 'tl-halfend-label', `${formatClock(obj.sec)} · ${eventLabel(obj)}`),
        el('span', 'tl-halfend-link', 'Se statistikk ›')
      );
      button.addEventListener('click', () => openStats(match.id, obj.half));
      item.append(button);
      list.append(item);
      return;
    }

    const item = el('li', `tl-item ${obj.side}` + (kind === 'event' ? ' tl-event' : ''));

    const time = el('button', 'tl-time', formatClock(obj.sec));
    time.type = 'button';
    time.title = 'Rett tiden';
    time.addEventListener('click', () => editShotTime(obj));

    const main = el('div', 'tl-main');
    let badge;
    if (kind === 'shot') {
      let detail = `${shotFromText(obj)} · ${zoneName(obj.zone)}`;
      if (obj.side === 'them' && obj.result === 'save') {
        const k = getPlayer(obj.keeperId);
        if (k) detail += ` · ${k.name}`;
      }
      main.append(el('div', 'tl-who', shotWho(match, obj, false)), el('div', 'tl-detail', detail));

      if (obj.result === 'goal') {
        const s = scoreAfter.get(obj.id);
        badge = el('span', 'badge badge-goal', `MÅL ${s.us}–${s.them}`);
      } else if (obj.result === 'save') {
        badge = el('span', 'badge badge-save', 'Redning');
      } else {
        badge = el('span', 'badge', 'Utenfor');
      }
    } else {
      const type = EVENT_TYPES[obj.type];
      main.append(el('div', 'tl-who', eventWho(match, obj, false)), el('div', 'tl-detail', type.label));
      badge = el('span', 'badge ' + type.badge, type.short);
    }

    const remove = el('button', 'tl-delete', '×');
    remove.type = 'button';
    remove.setAttribute('aria-label', kind === 'shot' ? 'Slett skuddet' : 'Slett hendelsen');
    remove.addEventListener('click', async () => {
      const ok = await ask({
        title: kind === 'shot' ? 'Slette dette skuddet?' : 'Slette denne hendelsen?',
        okText: 'Slett', danger: true
      });
      if (!ok) return;
      removeItem(match, obj.id);
      saveData();
      renderMatch();
    });

    item.append(time, main, badge, remove);
    list.append(item);
  });
}

function removeItem(match, id) {
  match.shots = match.shots.filter((s) => s.id !== id);
  match.events = (match.events || []).filter((e) => e.id !== id);
  if (match.timeout && match.timeout.eventId === id) match.timeout = null;
}

// Retter tiden på et skudd eller en hendelse (begge har half og sec).
async function editShotTime(item) {
  const match = currentMatch();
  const answer = await ask({
    title: 'Når skjedde det?',
    message: `Velg omgang og skriv tiden som mm:ss (0–${match.halfLength} min).`,
    okText: 'Lagre',
    half: item.half,
    input: { value: formatClock(item.sec), inputMode: 'numeric' }
  });
  if (answer === null) return;
  const sec = parseClock(answer.text, match);
  if (sec === null) return;
  item.half = answer.half;
  item.sec = sec;
  saveData();
  renderMatch();
  showToast('Tiden er rettet');
}

$('btn-undo').addEventListener('click', () => {
  const match = currentMatch();
  const last = lastItem(match);
  if (!last) return;
  removeItem(match, last.obj.id);
  saveData();
  renderMatch();
  showToast(last.kind === 'shot' ? 'Siste skudd er angret' : `${eventLabel(last.obj)} er angret`);
});

// ---------- Hendelser: kort, utvisning og time-out ----------

const EVENT_TYPES = {
  yellow:  { label: 'Gult kort',  short: 'Gult',     badge: 'badge-yellow' },
  '2min':  { label: '2 minutter', short: '2 min',    badge: 'badge-2min', suspends: true },
  red:     { label: 'Rødt kort',  short: 'Rødt',     badge: 'badge-red', suspends: true },
  timeout: { label: 'Time-out',   short: 'Time-out', badge: 'badge-timeout' },
  halfend: { label: 'Slutt omgang', short: 'Slutt',  badge: 'badge' }
};
const CARD_TYPES = ['yellow', '2min', 'red'];
const SUSPENSION_SEC = 120;   // en utvisning varer 2 minutter kamptid

function registerEvent(type) {
  const match = currentMatch();
  if (match.finished) return showToast('Kampen er avsluttet. Gjenåpne den i menyen ⋯');
  const needsPlayer = type !== 'timeout';
  if (needsPlayer && draft.side === 'us' && !draft.playerId) {
    return showToast('Velg spilleren først, og trykk så på knappen');
  }

  const ev = {
    id: newId(),
    createdAt: Date.now(),
    side: draft.side,
    type,
    playerId: needsPlayer && draft.side === 'us' ? draft.playerId : null,
    oppNumber: needsPlayer && draft.side === 'them' ? draft.oppNumber : null,
    half: match.clock.half,
    sec: Math.floor(clockMs(match) / 1000)
  };
  if (!match.events) match.events = [];
  match.events.push(ev);

  // Time-out: kampklokka stoppes, og ett minutt telles ned.
  if (type === 'timeout') {
    pauseClock(match);
    match.timeout = { eventId: ev.id, side: ev.side, endsAt: Date.now() + TIMEOUT_MS, done: false };
  }
  saveData();

  showToast(`${eventLabel(ev)}: ${eventWho(match, ev, false)}`);
  draft = newDraft(draft.side);
  renderMatch();
}

document.querySelectorAll('.btn-event').forEach((button) => {
  button.addEventListener('click', () => registerEvent(button.dataset.event));
});

// Utvisninger som pågår ved et gitt tidspunkt (sekunder kamptid).
// registeredBefore: skjer noe i samme sekund, teller bare utvisninger
// som ble registrert før (for eksempel skudd rett før et rødt kort).
function activeSuspensions(match, atSecond, registeredBefore) {
  return (match.events || []).filter((ev) => {
    if (!EVENT_TYPES[ev.type] || !EVENT_TYPES[ev.type].suspends) return false;
    const start = shotGameSeconds(match, ev);
    if (start === atSecond && registeredBefore && ev.createdAt > registeredBefore) return false;
    return atSecond >= start && atSecond < start + SUSPENSION_SEC;
  });
}

// Viser time-out og pågående utvisninger med nedtelling.
// Kalles hver gang klokka oppdateres.
function renderSuspensions(match) {
  const strip = $('susp-strip');
  strip.replaceChildren();

  if (match.timeout && !match.finished) {
    const who = match.timeout.side === 'us' ? teamName() : match.opponent;
    const left = Math.ceil(timeoutLeftMs(match) / 1000);
    strip.append(el('span', 'susp timeout' + (left ? '' : ' done'),
      left ? `Time-out ${who} · ${formatClock(left)}` : 'Time-out ferdig · trykk ▶ ved kampstart'));
  }

  const now = gameSeconds(match, match.clock.half, Math.floor(clockMs(match) / 1000));
  const active = match.finished ? [] : activeSuspensions(match, now);
  active.forEach((ev) => {
    const left = shotGameSeconds(match, ev) + SUSPENSION_SEC - now;
    const side = ev.side === 'us' ? teamName() : match.opponent;
    const who = ev.side === 'us' ? shotWho(match, ev, true) : (ev.oppNumber ? `#${ev.oppNumber}` : 'ukjent');
    strip.append(el('span', 'susp ' + ev.side, `${side} −1 · ${who} · ${formatClock(left)}`));
  });

  strip.hidden = strip.children.length === 0;
}

// =========================================================
// STATISTIKK
// =========================================================
//
// Alt regnes ut fra skuddene som er lagret, så statistikken er riktig
// også midt i en kamp (for eksempel i pausen).

let statsMatchId = 'all';   // 'all' eller id til én kamp
let statsSide = 'us';       // 'us' = våre skudd, 'them' = motstanderens skudd mot oss
let statsHalf = 'all';      // 'all', '1' eller '2'

// Hvor teksten står i hver sone på banekartet: [x, y for sonenavnet]
const STATS_LABEL_POS = {
  lw: [17, 26], rw: [183, 26],
  l69: [50, 72], m69: [100, 77], r69: [150, 72],
  l9: [32, 116], m9: [100, 116], r9: [168, 116]
};

function pct(part, whole) {
  return whole ? Math.round((part / whole) * 100) + ' %' : '–';
}

function openStats(matchId, half) {
  statsMatchId = matchId || 'all';
  statsHalf = half ? String(half) : 'all';
  showView('stats');
}

// Er skuddet eller hendelsen med i valgt omgang?
function inStatsHalf(item) {
  return statsHalf === 'all' || String(item.half) === statsHalf;
}

function statsMatches() {
  const matches = team().matches;
  return statsMatchId === 'all' ? matches : matches.filter((m) => m.id === statsMatchId);
}

// Teller skudd, mål, redninger og utenfor.
function tally(shots) {
  const t = { shots: shots.length, goals: 0, saves: 0, misses: 0 };
  shots.forEach((s) => {
    if (s.result === 'goal') t.goals++;
    else if (s.result === 'save') t.saves++;
    else t.misses++;
  });
  t.onTarget = t.goals + t.saves;
  return t;
}

function groupBy(items, keyFn) {
  const groups = new Map();
  items.forEach((item) => {
    const key = keyFn(item);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  });
  return groups;
}

// Hovedtallet for en gruppe skudd: mål for oss, redninger for keeperen.
function headline(t) {
  return statsSide === 'us'
    ? { part: t.goals, whole: t.shots, word: 'mål' }
    : { part: t.saves, whole: t.onTarget, word: 'redn.' };
}

function renderStatsSelect() {
  const matches = [...team().matches].sort(
    (a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt
  );
  if (statsMatchId !== 'all' && !matches.some((m) => m.id === statsMatchId)) statsMatchId = 'all';

  const select = $('stats-match');
  select.replaceChildren(new Option(`Alle kamper (${matches.length})`, 'all'));
  matches.forEach((m) => {
    const s = matchScore(m);
    const label = `${formatDate(m.date)} · ${m.opponent} ${s.us}–${s.them}` + (m.finished ? '' : ' (pågår)');
    select.append(new Option(label, m.id));
  });
  select.value = statsMatchId;
}

$('stats-match').addEventListener('change', (event) => {
  statsMatchId = event.target.value;
  renderStats();
});
$('stats-half').addEventListener('change', (event) => {
  statsHalf = event.target.value;
  renderStats();
});
$('stats-side').addEventListener('change', (event) => {
  statsSide = event.target.value;
  renderStats();
});
$('btn-stats-open-match').addEventListener('click', () => openMatch(statsMatchId));

function renderStats() {
  renderStatsSelect();
  $('stats-side').querySelector(`input[value="${statsSide}"]`).checked = true;
  $('stats-half').querySelector(`input[value="${statsHalf}"]`).checked = true;
  $('view-stats').classList.toggle('stats-them', statsSide === 'them');

  const matches = statsMatches();
  const single = statsMatchId === 'all' ? null : matches[0];
  $('stats-head').hidden = !single;
  if (single) {
    const s = matchScore(single);
    $('stats-head-title').textContent = `${team().name || 'Vi'} ${s.us} – ${s.them} ${single.opponent}`;
    $('stats-head-meta').textContent =
      `${formatDate(single.date)} · ${single.home ? 'Hjemme' : 'Borte'} · ${single.finished ? 'Ferdig' : 'Pågår'}` +
      (statsHalf === 'all' ? '' : ` · viser ${statsHalf}. omgang`);
  }

  const shots = matches.flatMap((m) =>
    m.shots.filter((s) => s.side === statsSide && inStatsHalf(s)).map((s) => ({ ...s, match: m })));
  $('stats-halves-card').hidden = statsHalf !== 'all';

  $('stats-empty').textContent = team().matches.length
    ? 'Ingen skudd registrert for dette valget ennå.'
    : 'Ingen kamper ennå. Start en kamp under «Kamper».';
  $('stats-empty').hidden = shots.length > 0;
  $('stats-content').hidden = shots.length === 0;
  if (!shots.length) return;

  renderKpis(shots);
  renderStatsGoal(shots);
  renderStatsCourt(shots);
  renderStatsTables(shots);
  renderStatsStrength(shots);
  renderStatsCards(matches);
}

// ---------- Nøkkeltall ----------

function kpi(label, value, sub, main) {
  const box = el('div', 'kpi' + (main ? ' kpi-main' : ''));
  box.append(el('p', 'kpi-label', label), el('p', 'kpi-value', value));
  if (sub) box.append(el('p', 'kpi-sub', sub));
  return box;
}

function renderKpis(shots) {
  const t = tally(shots);
  const box = $('stats-kpis');
  box.replaceChildren();
  if (statsSide === 'us') {
    box.append(
      kpi('Skuddeffektivitet', pct(t.goals, t.shots), `${t.goals} mål på ${t.shots} skudd`, true),
      kpi('Mål', t.goals),
      kpi('Reddet av keeper', t.saves, `${pct(t.saves, t.shots)} av skuddene`),
      kpi('Utenfor', t.misses, `${pct(t.misses, t.shots)} av skuddene`)
    );
  } else {
    box.append(
      kpi('Redningsprosent', pct(t.saves, t.onTarget), `${t.saves} av ${t.onTarget} skudd på mål`, true),
      kpi('Redninger', t.saves),
      kpi('Mål imot', t.goals, `på ${t.shots} skudd totalt`),
      kpi('Utenfor', t.misses, `${pct(t.misses, t.shots)} av skuddene`)
    );
  }
}

// ---------- Målkart ----------

function sideColor() {
  return statsSide === 'us' ? 'var(--green)' : 'var(--red)';
}

function renderStatsGoal(shots) {
  const isUs = statsSide === 'us';
  $('stats-goal-hint').textContent = isUs
    ? 'Mål av skudd i hver rute. Mørkere rute = flere skudd.'
    : 'Redninger av skudd på mål i hver rute. Mørkere rute = flere skudd.';

  const byZone = groupBy(shots.filter((s) => s.zone !== null && s.zone !== undefined), (s) => s.zone);
  const max = Math.max(1, ...[...byZone.values()].map((list) => list.length));

  const goal = $('stats-goal');
  goal.replaceChildren();
  for (let zone = 0; zone < 9; zone++) {
    const list = byZone.get(zone) || [];
    const t = tally(list);
    const h = headline(t);
    const cell = el('div', 'stat-zone');
    if (list.length) {
      const strength = Math.round(10 + 50 * (list.length / max));
      cell.style.background = `color-mix(in srgb, ${sideColor()} ${strength}%, white)`;
      cell.append(el('b', '', `${h.part}/${h.whole}`), el('small', '', pct(h.part, h.whole)));
    }
    cell.title = `${zoneName(zone)}: ${list.length} skudd, ${t.goals} mål, ${t.saves} redninger`;
    goal.append(cell);
  }

  const misses = shots.filter((s) => s.result === 'miss').length;
  $('stats-goal-below').replaceChildren(
    document.createTextNode('Utenfor / stolpe: '), el('b', '', misses),
    document.createTextNode(` av ${shots.length} skudd`)
  );
}

// ---------- Banekart ----------

function renderStatsCourt(shots) {
  const isUs = statsSide === 'us';
  $('stats-court-hint').textContent = isUs
    ? 'Mål av skudd fra hver sone. Mørkere sone = flere skudd.'
    : 'Redninger av skudd på mål fra hver sone. Mørkere sone = flere skudd.';

  const courtShots = shots.filter((s) => getArea(s.area) && s.area !== AREA_7M.id);
  const byArea = groupBy(courtShots, (s) => s.area);
  const max = Math.max(1, ...[...byArea.values()].map((list) => list.length));
  const svg = $('stats-court');

  // Farg sonene etter antall skudd
  svg.querySelectorAll('.area').forEach((rect) => {
    const list = byArea.get(rect.dataset.area) || [];
    const t = tally(list);
    rect.style.fill = sideColor();
    rect.style.fillOpacity = list.length ? (0.1 + 0.45 * (list.length / max)).toFixed(2) : 0;
    rect.replaceChildren();
    const title = svgEl('title', {}, rect);
    title.textContent = `${getArea(rect.dataset.area).label}: ${list.length} skudd, ${t.goals} mål, ${t.saves} redninger`;
  });

  const layer = $('stats-court-layer');
  layer.replaceChildren();

  // Hvert skudd som et punkt der det ble tatt (grunnlaget for varmekart)
  courtShots.filter((s) => s.pos).forEach((s) => {
    const cx = toSvgX(s.pos.x);
    const cy = toSvgY(s.pos.y);
    if (s.result === 'save') {
      svgEl('rect', { class: 'dot-save', x: cx - 2.3, y: cy - 2.3, width: 4.6, height: 4.6 }, layer);
    } else if (s.result === 'goal') {
      svgEl('circle', { class: 'dot-goal', cx, cy, r: 2.6 }, layer);
    } else {
      svgEl('circle', { class: 'dot-miss', cx, cy, r: 2.1 }, layer);
    }
  });

  // Tall per sone
  AREAS.forEach((area) => {
    const list = byArea.get(area.id) || [];
    const [x, y] = STATS_LABEL_POS[area.id];
    svgEl('text', { class: 'stat-text name', x, y }, layer).textContent = area.short;
    if (!list.length) return;
    const h = headline(tally(list));
    svgEl('text', { class: 'stat-text', x, y: y + 8 }, layer).textContent = `${h.part}/${h.whole} ${h.word}`;
    svgEl('text', { class: 'stat-text', x, y: y + 15 }, layer).textContent = pct(h.part, h.whole);
  });

  // 7-metere og eldre skudd uten sone
  const below = $('stats-court-below');
  below.replaceChildren();
  const penalties = shots.filter((s) => s.area === AREA_7M.id || (!s.area && s.distance === '7m'));
  const p = headline(tally(penalties));
  below.append(document.createTextNode('7 m-kast: '),
    el('b', '', penalties.length ? `${p.part}/${p.whole} ${p.word} (${pct(p.part, p.whole)})` : 'ingen'));
  const noArea = shots.filter((s) => !s.area && s.distance !== '7m').length;
  if (noArea) {
    below.append(document.createTextNode(` · Uten sone (eldre registreringer): ${noArea}`));
  }
}

// ---------- Tabeller ----------

function fillTable(table, headers, rows, footer) {
  table.replaceChildren();
  const head = el('thead');
  const headRow = el('tr');
  headers.forEach((h) => headRow.append(el('th', '', h)));
  head.append(headRow);
  const body = el('tbody');
  rows.forEach((cells) => {
    const row = el('tr');
    cells.forEach((c) => row.append(el('td', '', c)));
    body.append(row);
  });
  table.append(head, body);
  if (footer) {
    const foot = el('tfoot');
    const row = el('tr');
    footer.forEach((c) => row.append(el('td', '', c)));
    foot.append(row);
    table.append(foot);
  }
}

function isPenalty(s) {
  return s.area === AREA_7M.id || (!s.area && s.distance === '7m');
}

function renderStatsTables(shots) {
  const isUs = statsSide === 'us';
  const total = tally(shots);

  if (isUs) {
    // Per spiller: skudd, mål, prosent og 7-metere
    $('stats-table-title').textContent = 'Per spiller';
    const rows = [...groupBy(shots, (s) => s.playerId).entries()]
      .map(([id, list]) => {
        const p = getPlayer(id);
        const t = tally(list);
        const pen = tally(list.filter(isPenalty));
        return { name: p ? `#${p.number} ${p.name}` : 'Slettet spiller', t, pen };
      })
      .sort((a, b) => b.t.goals - a.t.goals || b.t.shots - a.t.shots)
      .map((r) => [r.name, r.t.shots, r.t.goals, pct(r.t.goals, r.t.shots),
        r.pen.shots ? `${r.pen.goals}/${r.pen.shots}` : '–']);
    const pen = tally(shots.filter(isPenalty));
    fillTable($('stats-table'), ['Spiller', 'Skudd', 'Mål', 'Effekt.', '7 m'], rows,
      ['Totalt', total.shots, total.goals, pct(total.goals, total.shots), pen.shots ? `${pen.goals}/${pen.shots}` : '–']);
  } else {
    // Per keeper: skudd på mål, redninger og redningsprosent
    $('stats-table-title').textContent = 'Per keeper';
    const rows = [...groupBy(shots, (s) => s.keeperId).entries()]
      .map(([id, list]) => {
        const k = getPlayer(id);
        const t = tally(list);
        const pen = tally(list.filter(isPenalty));
        return { name: k ? `#${k.number} ${k.name}` : 'Ingen keeper valgt', t, pen };
      })
      .sort((a, b) => b.t.onTarget - a.t.onTarget)
      .map((r) => [r.name, r.t.onTarget, r.t.saves, pct(r.t.saves, r.t.onTarget),
        r.pen.onTarget ? `${r.pen.saves}/${r.pen.onTarget}` : '–']);
    const pen = tally(shots.filter(isPenalty));
    fillTable($('stats-table'), ['Keeper', 'På mål', 'Redn.', 'Redn. %', '7 m'], rows,
      ['Totalt', total.onTarget, total.saves, pct(total.saves, total.onTarget),
        pen.onTarget ? `${pen.saves}/${pen.onTarget}` : '–']);
  }

  // Motstanderens skyttere (bare for «Keeper og forsvar»)
  $('stats-opp-card').hidden = isUs;
  if (!isUs) {
    const allMatches = statsMatchId === 'all';
    const rows = [...groupBy(shots, (s) => (allMatches ? s.match.opponent + ' ' : '') + (s.oppNumber ? '#' + s.oppNumber : 'Ukjent')).entries()]
      .map(([name, list]) => ({ name, t: tally(list) }))
      .sort((a, b) => b.t.goals - a.t.goals || b.t.shots - a.t.shots)
      .map((r) => [r.name, r.t.shots, r.t.goals, pct(r.t.goals, r.t.shots)]);
    fillTable($('stats-opp-table'), ['Skytter', 'Skudd', 'Mål', 'Effekt.'], rows);
  }

  // Per omgang
  const halves = [1, 2].map((half) => tally(shots.filter((s) => s.half === half)));
  const halfRow = (label, t) => (isUs
    ? [label, t.shots, t.goals, pct(t.goals, t.shots)]
    : [label, t.shots, t.goals, t.saves, pct(t.saves, t.onTarget)]);
  fillTable($('stats-halves'),
    isUs ? ['Omgang', 'Skudd', 'Mål', 'Effekt.'] : ['Omgang', 'Skudd', 'Mål imot', 'Redn.', 'Redn. %'],
    [halfRow('1. omgang', halves[0]), halfRow('2. omgang', halves[1])],
    halfRow('Totalt', total));
}

// ---------- Over- og undertall ----------

// Var vi i overtall, likt eller undertall da skuddet ble tatt?
function strengthAt(shot) {
  const active = activeSuspensions(shot.match, shotGameSeconds(shot.match, shot), shot.createdAt);
  const ours = active.filter((ev) => ev.side === 'us').length;
  const theirs = active.filter((ev) => ev.side === 'them').length;
  if (theirs > ours) return 'over';
  if (ours > theirs) return 'under';
  return 'equal';
}

function renderStatsStrength(shots) {
  const isUs = statsSide === 'us';
  const byState = groupBy(shots, strengthAt);
  const rows = [['over', 'Vi i overtall'], ['equal', 'Likt antall'], ['under', 'Vi i undertall']]
    .map(([state, label]) => {
      const t = tally(byState.get(state) || []);
      return isUs
        ? [label, t.shots, t.goals, pct(t.goals, t.shots)]
        : [label, t.shots, t.goals, t.saves, pct(t.saves, t.onTarget)];
    });
  fillTable($('stats-strength'),
    isUs ? ['Situasjon', 'Skudd', 'Mål', 'Effekt.'] : ['Situasjon', 'Skudd', 'Mål imot', 'Redn.', 'Redn. %'],
    rows);
}

// ---------- Kort, utvisninger og time-out ----------

function renderStatsCards(matches) {
  const isUs = statsSide === 'us';
  const allMatches = statsMatchId === 'all';
  const events = matches.flatMap((m) => (m.events || []).filter(inStatsHalf).map((ev) => ({ ...ev, match: m })));

  const timeouts = events.filter((ev) => ev.type === 'timeout');
  const ourTimeouts = timeouts.filter((ev) => ev.side === 'us').length;
  const theirLabel = allMatches ? 'Motstanderne' : (matches[0] ? matches[0].opponent : 'Motstander');
  $('stats-timeouts').replaceChildren(
    document.createTextNode('Time-out: '),
    el('b', '', `${team().name || 'Vi'} ${ourTimeouts}`),
    document.createTextNode(' · '),
    el('b', '', `${theirLabel} ${timeouts.length - ourTimeouts}`)
  );

  // Kort og utvisninger for laget som vises (våre spillere, eller motstanderens)
  const cards = events.filter((ev) => CARD_TYPES.includes(ev.type) && ev.side === statsSide);
  const keyOf = (ev) => (isUs
    ? ev.playerId
    : (allMatches ? ev.match.opponent + ' ' : '') + (ev.oppNumber ? '#' + ev.oppNumber : 'Ukjent'));
  const nameOf = (key) => {
    if (!isUs) return key;
    const p = getPlayer(key);
    return p ? `#${p.number} ${p.name}` : 'Slettet spiller';
  };
  const count = (list, type) => list.filter((ev) => ev.type === type).length;

  const rows = [...groupBy(cards, keyOf).entries()]
    .map(([key, list]) => [nameOf(key), count(list, 'yellow'), count(list, '2min'), count(list, 'red')])
    .sort((a, b) => b[2] - a[2] || b[1] - a[1]);
  $('stats-cards-empty').hidden = rows.length > 0;
  $('stats-cards').hidden = rows.length === 0;
  fillTable($('stats-cards'), [isUs ? 'Spiller' : 'Skytter', 'Gult', '2 min', 'Rødt'], rows,
    rows.length ? ['Totalt', count(cards, 'yellow'), count(cards, '2min'), count(cards, 'red')] : null);
}

// ---------- Del / PDF ----------
//
// Lager en rapport med både våre skudd og keeper/forsvar for valgt kamp og
// omgang, og åpner nettleserens utskrift. Derfra kan den lagres som PDF
// eller deles (på iPhone: del-knappen i utskriftsvinduet).

function printReport() {
  if (!statsMatches().some((m) => m.shots.some(inStatsHalf))) {
    return showToast('Ingen skudd å lage rapport av ennå');
  }
  const report = $('print-report');
  report.replaceChildren();

  const single = statsMatchId === 'all' ? null : statsMatches()[0];
  const head = el('header', 'print-head');
  head.append(el('h1', '', `Skuddkart · ${teamName()}`));
  if (single) {
    const s = matchScore(single);
    head.append(el('p', 'print-title', `${teamName()} ${s.us} – ${s.them} ${single.opponent}`));
  } else {
    head.append(el('p', 'print-title', `Alle kamper (${team().matches.length})`));
  }
  const meta = [];
  if (single) meta.push(formatDate(single.date), single.home ? 'Hjemme' : 'Borte');
  meta.push(statsHalf === 'all' ? 'Hele kampen' : `${statsHalf}. omgang`);
  meta.push('Laget ' + new Date().toLocaleString('nb-NO', { dateStyle: 'medium', timeStyle: 'short' }));
  head.append(el('p', 'print-meta', meta.join(' · ')));
  report.append(head);

  // Lag én del for våre skudd og én for keeper/forsvar
  const shownSide = statsSide;
  ['us', 'them'].forEach((side) => {
    statsSide = side;
    renderStats();
    const section = el('section', 'print-section' + (side === 'them' ? ' stats-them' : ''));
    section.append(el('h2', '', side === 'us' ? 'Våre skudd' : 'Keeper og forsvar'));
    if ($('stats-content').hidden) {
      section.append(el('p', 'muted', 'Ingen skudd registrert.'));
    } else {
      const copy = $('stats-content').cloneNode(true);
      // Banetegningen trenger egne id-er i kopien
      const svg = copy.querySelector('svg.court');
      svg.innerHTML = svg.innerHTML.replaceAll('stats-', `print-${side}-`);
      copy.querySelectorAll('[id]').forEach((node) => { if (!node.closest('svg')) node.removeAttribute('id'); });
      copy.removeAttribute('id');
      section.append(copy);
    }
    report.append(section);
  });
  statsSide = shownSide;
  renderStats();

  window.print();
}

$('btn-print').addEventListener('click', printReport);

// ---------- Brukerveiledning ----------

$('btn-help').addEventListener('click', () => {
  showView('more');
  const first = $('guide').querySelector('details');
  if (first && !$('guide').querySelector('details[open]')) first.open = true;
  $('guide').scrollIntoView({ block: 'start' });
});

// =========================================================
// SIKKERHETSKOPI
// =========================================================

function exportBackup() {
  data.lastBackupAt = Date.now();
  saveData();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `skuddkart-kopi-${todayIso()}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
  renderLastBackup();
  showToast('Kopien er lagret i Nedlastinger');
}

$('btn-export').addEventListener('click', exportBackup);

function renderLastBackup() {
  $('last-backup').textContent = data.lastBackupAt
    ? 'Sist kopi: ' + new Date(data.lastBackupAt).toLocaleString('nb-NO', { dateStyle: 'medium', timeStyle: 'short' })
    : 'Du har ikke tatt kopi ennå.';
}

// Etter en avsluttet kamp: tilby å ta sikkerhetskopi med en gang.
async function offerBackup() {
  const ok = await ask({
    title: 'Ta sikkerhetskopi?',
    message: 'Kampen er lagret på denne enheten. En kopi til fil sikrer dataene hvis telefonen blir borte eller nettleseren tømmes.',
    okText: 'Lagre kopi'
  });
  if (ok) exportBackup();
}

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

buildRegistrationCourt();
buildCourt($('stats-court'), 'stats', false);
svgEl('g', { id: 'stats-court-layer' }, $('stats-court'));

function renderAll() {
  renderLastBackup();
  renderTeam();
  renderTeamList();
  renderPlayers();
  renderMatchList();
  if (!$('view-stats').hidden) renderStats();
}

renderAll();
