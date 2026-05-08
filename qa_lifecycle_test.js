// Lifecycle-Tests: Erst-Start, Reset, Demo-Button-Override, Persistence
// Lädt die HTML-Datei in jsdom und simuliert echte User-Lifecycles.

const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');

const HTML_FILE = path.join(__dirname, 'kapazitaetsplaner.html');
const html = fs.readFileSync(HTML_FILE, 'utf8');

function makeDom() {
  const vc = new VirtualConsole();
  vc.on('error', () => {});
  return new JSDOM(html, {
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    virtualConsole: vc,
    url: 'http://localhost/',
  });
}

let pass = 0, fail = 0;
function check(label, ok, details) {
  if (ok) { pass++; console.log(`  PASS  ${label}`); }
  else { fail++; console.log(`  FAIL  ${label}${details ? ' — ' + details : ''}`); }
}

(async () => {

  // ============================================================
  // Test 1: Erst-Start ohne localStorage → Beispieldaten geladen
  // ============================================================
  console.log('\n=== Test 1: Frischer Erst-Start (localStorage leer) ===');
  {
    const dom = makeDom();
    const w = dom.window;
    await new Promise(r => setTimeout(r, 80));

    const memberCount = w.document.querySelectorAll('#planning-body tr').length;
    const usagePct = w.document.getElementById('usage-pct').textContent.trim();
    const stored = w.localStorage.getItem('procilon_kapazitaetsplaner_v3');

    check('Demo-Team in Tabelle (5 Personen)', memberCount === 5, `tatsächlich ${memberCount}`);
    check('Auslastung berechnet', usagePct === '111 %', `bekommen "${usagePct}"`);
    check('localStorage nach load() befüllt', !!stored, 'storage leer');
    if (stored) {
      const parsed = JSON.parse(stored);
      check('Beispiel-Mitglieder im Storage', parsed.members.length === 5);
      check('Beispiel-PlannedSp im Storage', parsed.plannedSp === 22);
      check('Beispiel-MeetingShare im Storage', parsed.meetingShare === 20);
    }
  }

  // ============================================================
  // Test 2: Reload mit existierenden eigenen Daten → kein Demo-Override
  // ============================================================
  console.log('\n=== Test 2: Reload mit eigenen Daten ===');
  {
    const dom = makeDom();
    const w = dom.window;
    // Eigene Daten setzen (vor dem DOMContentLoaded)
    const customState = {
      members: [{ id: 'x', name: 'Max Mustermann', baseAvailability: 90, role: 'dev' }],
      sprintDays: 5, meetingShare: 10,
      spFactorDev: 1.0, spFactorQa: 0.8,
      attendance: {}, plannedSp: 3,
    };
    w.localStorage.setItem('procilon_kapazitaetsplaner_v3', JSON.stringify(customState));

    // Reload simulieren: load() in einem neuen DOM mit dem gleichen storage
    const dom2 = new JSDOM(html, {
      runScripts: 'dangerously', pretendToBeVisual: true,
      url: 'http://localhost/',
      virtualConsole: new VirtualConsole(),
    });
    const w2 = dom2.window;
    w2.localStorage.setItem('procilon_kapazitaetsplaner_v3', JSON.stringify(customState));
    // Trigger DOMContentLoaded erneut wäre komplex – stattdessen: load+render manuell anstossen
    await new Promise(r => setTimeout(r, 80));
    w2.load();
    w2.syncSettingsInputs();
    w2.renderAdmin();
    w2.renderPlanning();

    const rows = w2.document.querySelectorAll('#planning-body tr');
    const firstName = rows[0]?.querySelector('td')?.textContent.trim();
    const sprintDaysInput = w2.document.getElementById('sprint-days').value;
    const headcount = w2.document.getElementById('usage-members').textContent.trim();

    check('Eigene Daten geladen, NICHT Demo', firstName === 'Max Mustermann', `bekommen "${firstName}"`);
    check('Eigene Sprintlänge übernommen (5)', sprintDaysInput === '5');
    check('Eigene Mitgliederanzahl (1)', headcount === '1');
  }

  // ============================================================
  // Test 3: Nach „Alles löschen" → leerer State, KEIN Demo-Reload
  // ============================================================
  console.log('\n=== Test 3: Nach „Alles löschen" + Reload bleibt es leer ===');
  {
    const dom = makeDom();
    const w = dom.window;
    await new Promise(r => setTimeout(r, 80));

    // confirm() → true, dann confirmReset
    w.confirm = () => true;
    w.confirmReset();
    await new Promise(r => setTimeout(r, 30));

    const stored = w.localStorage.getItem('procilon_kapazitaetsplaner_v3');
    const parsed = stored ? JSON.parse(stored) : null;

    check('localStorage nach Reset gefüllt mit leerem State', !!stored);
    check('Members nach Reset = []', parsed?.members?.length === 0);

    // Jetzt simulieren wir Reload: neues DOM mit demselben localStorage-Inhalt
    const dom2 = new JSDOM(html, {
      runScripts: 'dangerously', pretendToBeVisual: true,
      url: 'http://localhost/',
      virtualConsole: new VirtualConsole(),
    });
    const w2 = dom2.window;
    w2.localStorage.setItem('procilon_kapazitaetsplaner_v3', stored);
    await new Promise(r => setTimeout(r, 80));

    const rowCount = w2.document.querySelectorAll('#planning-body tr').length;
    const empty = w2.document.getElementById('planning-empty').classList.contains('show');

    check('Nach Reload: keine Tabellenzeilen', rowCount === 0, `${rowCount} Zeilen`);
    check('Nach Reload: Empty-State sichtbar', empty);
  }

  // ============================================================
  // Test 4: „Beispieldaten laden"-Button überschreibt eigene Daten
  // ============================================================
  console.log('\n=== Test 4: Beispieldaten-Button überschreibt eigenes Setup ===');
  {
    const dom = makeDom();
    const w = dom.window;
    await new Promise(r => setTimeout(r, 80));

    // Eigenes Mitglied hinzufügen
    w.document.getElementById('new-name').value = 'Test User';
    w.document.getElementById('new-availability').value = '50';
    w.document.getElementById('new-role').value = 'qa';
    w.addMember();

    const beforeCount = w.document.querySelectorAll('#admin-body tr').length;
    check('Vor Demo-Override: 6 Mitglieder (5 demo + 1 neu)', beforeCount === 6, `bekommen ${beforeCount}`);

    // confirm() → true, Demo überschreiben
    w.confirm = () => true;
    w.loadDemoData();
    await new Promise(r => setTimeout(r, 30));

    const afterCount = w.document.querySelectorAll('#planning-body tr').length;
    const usagePct = w.document.getElementById('usage-pct').textContent.trim();
    check('Nach Demo-Override: wieder genau 5 Mitglieder', afterCount === 5);
    check('Auslastung wieder 111 %', usagePct === '111 %');
  }

  // ============================================================
  // Test 5: Live-Eingabe ändert Werte sofort
  // ============================================================
  console.log('\n=== Test 5: Live-Eingabe von Anwesenheit aktualisiert Auslastung ===');
  {
    const dom = makeDom();
    const w = dom.window;
    await new Promise(r => setTimeout(r, 80));

    // Anna (m1) auf 0 Tage setzen → 4.48 SP weniger Kapazität
    w.updateAttendance('m1', 0);
    await new Promise(r => setTimeout(r, 20));

    const cap = w.document.getElementById('usage-capacity').textContent.trim();
    const pct = w.document.getElementById('usage-pct').textContent.trim();
    // neue Kapazität: 19.84 - 4.48 = 15.36
    // 22 / 15.36 = 143.2% → 143%
    check('Kapazität nach Anna=0: 15.4', cap === '15.4', `bekommen "${cap}"`);
    check('Auslastung nach Anna=0: 143 %', pct === '143 %', `bekommen "${pct}"`);
  }

  // ============================================================
  // Test 6: Sprint-Länge ändern clampt Anwesenheits-Werte
  // ============================================================
  console.log('\n=== Test 6: Sprint-Länge senken cappt Anwesenheits-Werte ===');
  {
    const dom = makeDom();
    const w = dom.window;
    await new Promise(r => setTimeout(r, 80));

    // Sprintlänge auf 5 senken (alle Anwesenheiten von 7,8,9,10 müssen auf 5 gekappt werden)
    const inp = w.document.getElementById('sprint-days');
    inp.value = '5';
    inp.dispatchEvent(new w.Event('input'));
    await new Promise(r => setTimeout(r, 30));

    // alle attendance-Werte sollten <= 5 sein
    const stored = JSON.parse(w.localStorage.getItem('procilon_kapazitaetsplaner_v3'));
    const allCapped = Object.values(stored.attendance).every(a => a <= 5);
    check('Alle Anwesenheits-Werte ≤ neue Sprintlänge', allCapped, JSON.stringify(stored.attendance));
  }

  // ============================================================
  // Test 7: Reset (Sprint-Reset) löscht nur Sprint-Daten
  // ============================================================
  console.log('\n=== Test 7: Sprint-Reset löscht nur Sprint-Daten, nicht Mitglieder ===');
  {
    const dom = makeDom();
    const w = dom.window;
    await new Promise(r => setTimeout(r, 80));

    w.confirm = () => true;
    w.resetSprint();
    await new Promise(r => setTimeout(r, 30));

    const stored = JSON.parse(w.localStorage.getItem('procilon_kapazitaetsplaner_v3'));
    check('Mitglieder bleiben (5 Personen)', stored.members.length === 5);
    check('Settings bleiben (sprintDays = 10)', stored.sprintDays === 10);
    check('Settings bleiben (meetingShare = 20)', stored.meetingShare === 20);
    check('attendance geleert', Object.keys(stored.attendance).length === 0);
    check('plannedSp = 0', stored.plannedSp === 0);

    // Nach Reset: alle voll da (default), Auslastung 0% (planned=0)
    const pct = w.document.getElementById('usage-pct').textContent.trim();
    check('Auslastung nach Reset: 0 %', pct === '0 %');
  }

  console.log(`\nGesamt: ${pass} pass, ${fail} fail`);
  process.exit(fail > 0 ? 1 : 0);
})();
