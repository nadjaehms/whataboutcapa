// Echter UI-Test mit jsdom: Lädt die HTML-Datei, ruft loadDemoData() auf,
// liest die berechneten Werte aus dem DOM und vergleicht sie mit der Mathematik.

const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');

const HTML_FILE = path.join(__dirname, 'kapazitaetsplaner.html');
const html = fs.readFileSync(HTML_FILE, 'utf8');

const vc = new VirtualConsole();
vc.on('error', () => {}); // unterdrücke Font-Loading-Fehler aus jsdom

const dom = new JSDOM(html, {
  runScripts: 'dangerously',
  pretendToBeVisual: true,
  virtualConsole: vc,
  url: 'http://localhost/',
});

// Warten auf DOMContentLoaded
const w = dom.window;

(async () => {
  // dispatchen, falls noch nicht passiert
  await new Promise(r => setTimeout(r, 100));

  console.log('=== UI-Test: Beispieldaten in der Oberfläche ===\n');

  // localStorage-Mock entfernen falls vorhanden, dann Demo-Daten laden
  w.localStorage.clear();
  w.loadDemoData = w.loadDemoData; // sicher zugreifbar

  // Demo-Daten aktivieren - confirm() wird in jsdom default true zurückgeben? Nein, confirm = null/false
  // Wir mocken confirm
  w.confirm = () => true;
  w.loadDemoData();

  // Kurz warten auf Re-Render
  await new Promise(r => setTimeout(r, 50));

  // Werte aus dem DOM auslesen
  const $ = (id) => w.document.getElementById(id);
  const results = {
    pct:        $('usage-pct').textContent.trim(),
    planned:    $('usage-planned').textContent.trim(),
    capacity:   $('usage-capacity').textContent.trim(),
    members:    $('usage-members').textContent.trim(),
    delta:      $('usage-delta').textContent.trim(),
    statusLbl:  $('usage-status-label').textContent.trim(),
    devCap:     $('dev-capacity').textContent.trim(),
    qaCap:      $('qa-capacity').textContent.trim(),
    devHeads:   $('dev-headcount').textContent.trim(),
    qaHeads:    $('qa-headcount').textContent.trim(),
    barWidth:   $('usage-bar').style.width,
    barOver:    $('usage-bar').classList.contains('over'),
  };

  // Tabellenzeilen auslesen
  const rows = [...w.document.querySelectorAll('#planning-body tr')];
  const tableRows = rows.map(tr => {
    const cells = [...tr.querySelectorAll('td')];
    return {
      name:  cells[0].textContent.trim(),
      role:  cells[1].textContent.trim(),
      avail: cells[2].textContent.trim(),
      attendance: cells[3].querySelector('input').value,
      netto: cells[4].textContent.trim(),
      cap:   cells[5].textContent.trim(),
    };
  });

  const tot = w.document.querySelector('#planning-total');
  const totalCells = [...tot.querySelectorAll('td')];
  const tableTotals = {
    netto: totalCells[4].textContent.trim(),
    cap:   totalCells[5].textContent.trim(),
  };

  // ===== Erwartete Werte (manuell berechnet) =====
  // sprintDays=10, meetingShare=20%, spFactorDev=0.7, spFactorQa=0.5, plannedSp=22
  // Anna  (Dev, 100%, 8 T.):  8  × 1.0 × 0.8 × 0.7 = 4.48
  // Bob   (Dev,  80%, 10 T.): 10 × 0.8 × 0.8 × 0.7 = 4.48
  // Carla (Dev, 100%, 7 T.):  7  × 1.0 × 0.8 × 0.7 = 3.92
  // Dan   (Dev,  60%, 10 T.): 10 × 0.6 × 0.8 × 0.7 = 3.36
  // Eva   (QA,  100%, 9 T.):  9  × 1.0 × 0.8 × 0.5 = 3.60
  // Total = 19.84;  Dev = 16.24;  QA = 3.6
  // Auslastung: 22 / 19.84 × 100 = 110.89% → gerundet 111%
  // Delta: 22 - 19.84 = 2.16 (überplant)
  // Bar gecappt auf 100% Breite, Klasse "over" gesetzt

  const expected = {
    pct: '111 %',
    planned: '22',
    capacity: '19.8',
    members: '5',
    delta: 'Überplant: +2.2 SP über Kapazität',
    statusLbl: 'überplant',
    devCap: '16.2',
    qaCap: '3.6',
    devHeads: '4 Pers.',
    qaHeads: '1 Person',
    barWidth: '100%',
    barOver: true,
  };

  const expectedRows = [
    { name: 'Anna Müller',     role: 'DEV', avail: '100 %', attendance: '8',  netto: '6.4', cap: '4.5' },
    { name: 'Bob Schmidt',     role: 'DEV', avail: '80 %',  attendance: '10', netto: '6.4', cap: '4.5' },
    { name: 'Carla Schneider', role: 'DEV', avail: '100 %', attendance: '7',  netto: '5.6', cap: '3.9' },
    { name: 'Dan Becker',      role: 'DEV', avail: '60 %',  attendance: '10', netto: '4.8', cap: '3.4' },
    { name: 'Eva Lange',       role: 'QA',  avail: '100 %', attendance: '9',  netto: '7.2', cap: '3.6' },
  ];

  const expectedTotals = { netto: '30.4', cap: '19.8' };

  // ===== Vergleich =====
  let pass = 0, fail = 0;
  function check(label, actual, exp) {
    if (String(actual) === String(exp)) { pass++; console.log(`  PASS  ${label}: ${actual}`); }
    else { fail++; console.log(`  FAIL  ${label}: erwartet "${exp}", bekommen "${actual}"`); }
  }

  console.log('--- Auslastungs-Karte ---');
  check('Auslastung %',         results.pct, expected.pct);
  check('Geplante SP',          results.planned, expected.planned);
  check('Gesamtkapazität',      results.capacity, expected.capacity);
  check('Mitglieder gesamt',    results.members, expected.members);
  check('Delta-Text',           results.delta, expected.delta);
  check('Status-Label',         results.statusLbl, expected.statusLbl);
  check('Bar-Width gecappt',    results.barWidth, expected.barWidth);
  check('Bar-over Klasse',      results.barOver, expected.barOver);

  console.log('\n--- Sub-Info pro Rolle ---');
  check('Dev-Kapazität',        results.devCap, expected.devCap);
  check('QA-Kapazität',         results.qaCap, expected.qaCap);
  check('Dev-Headcount',        results.devHeads, expected.devHeads);
  check('QA-Headcount',         results.qaHeads, expected.qaHeads);

  console.log('\n--- Tabellenzeilen ---');
  // Tabellen werden sortiert (dev erst, dann qa, alphabetisch)
  expectedRows.forEach((exp, i) => {
    const got = tableRows[i];
    if (!got) { fail++; console.log(`  FAIL  Zeile ${i + 1}: fehlt!`); return; }
    check(`Zeile ${i + 1} Name`,        got.name, exp.name);
    check(`Zeile ${i + 1} Rolle`,       got.role, exp.role);
    check(`Zeile ${i + 1} Verfügbarkeit`, got.avail, exp.avail);
    check(`Zeile ${i + 1} Anwesend`,    got.attendance, exp.attendance);
    check(`Zeile ${i + 1} Netto`,       got.netto, exp.netto);
    check(`Zeile ${i + 1} Kapazität`,   got.cap, exp.cap);
  });

  console.log('\n--- Tabellen-Footer (Summen) ---');
  check('Footer Netto-Tage',  tableTotals.netto, expectedTotals.netto);
  check('Footer Kapazität',   tableTotals.cap, expectedTotals.cap);

  console.log(`\nErgebnis: ${pass} pass, ${fail} fail`);
  process.exit(fail > 0 ? 1 : 0);
})();
