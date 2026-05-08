// QA-Tests für die Berechnungslogik des Kapazitätsplaners v3
// Modell:
//   netDays = present × (baseAvailability/100) × (1 - meetingShare/100)
//   capacity = netDays × spFactor[role]   (spFactorDev / spFactorQa)
//   total: alle Mitglieder zusammen, eine Auslastung

function toNum(v, fallback = NaN) {
  if (v === null || v === undefined || v === '') return fallback;
  const n = parseFloat(String(v).replace(',', '.').trim());
  return isNaN(n) ? fallback : n;
}

function makeCalc(state) {
  const getAttendance = (m) => {
    const stored = state.attendance[m.id];
    if (stored === undefined || stored === null || stored === '') return state.sprintDays;
    return Math.max(0, Math.min(state.sprintDays, toNum(stored, state.sprintDays)));
  };
  const netDaysFor = (m) => {
    const present = getAttendance(m);
    const meetingFactor = 1 - (Math.max(0, Math.min(80, toNum(state.meetingShare, 0))) / 100);
    return Math.max(0, present * (m.baseAvailability / 100) * meetingFactor);
  };
  const spFactorFor = (m) => m.role === 'qa'
    ? Math.max(0, toNum(state.spFactorQa, 0.7))
    : Math.max(0, toNum(state.spFactorDev, 0.7));
  const capacityFor = (m) => netDaysFor(m) * spFactorFor(m);
  const totals = () => ({
    capacity: state.members.reduce((s, m) => s + capacityFor(m), 0),
    planned: Math.max(0, toNum(state.plannedSp) || 0),
  });
  const totalsByRole = (role) => {
    const members = state.members.filter(m => m.role === role);
    return {
      members,
      capacity: members.reduce((s, m) => s + capacityFor(m), 0),
    };
  };
  return { getAttendance, netDaysFor, capacityFor, totals, totalsByRole };
}

let pass = 0, fail = 0;
const tests = [];
function test(name, fn) { tests.push({ name, fn }); }
function eq(actual, expected, msg) {
  if (Math.abs(actual - expected) < 0.001) return true;
  console.log(`    FAIL: ${msg || ''} expected ${expected}, got ${actual}`);
  return false;
}

// ===================================================================
// Tests
// ===================================================================

test('Standard ohne Meeting-Abzug: 1 Dev, 100% Verfügbarkeit, voll anwesend', () => {
  const s = {
    sprintDays: 10, meetingShare: 0, spFactorDev: 0.7, spFactorQa: 0.5,
    members: [{ id: 'a', name: 'Anna', baseAvailability: 100, role: 'dev' }],
    attendance: {}, plannedSp: 0,
  };
  const c = makeCalc(s);
  // Default Anwesenheit = sprintDays = 10
  // netDays = 10 × 1.0 × (1-0) = 10
  // cap = 10 × 0.7 = 7
  return eq(c.netDaysFor(s.members[0]), 10, 'Netto')
      && eq(c.capacityFor(s.members[0]), 7, 'Kapazität');
});

test('Mit Meeting-Abzug 20%', () => {
  const s = {
    sprintDays: 10, meetingShare: 20, spFactorDev: 0.7, spFactorQa: 0.5,
    members: [{ id: 'a', name: 'Anna', baseAvailability: 100, role: 'dev' }],
    attendance: {}, plannedSp: 0,
  };
  const c = makeCalc(s);
  // netDays = 10 × 1.0 × 0.8 = 8
  // cap = 8 × 0.7 = 5.6
  return eq(c.netDaysFor(s.members[0]), 8, 'Netto mit Meetings')
      && eq(c.capacityFor(s.members[0]), 5.6, 'Kapazität');
});

test('"Bin nur 8/10 Tagen da"-Use Case', () => {
  const s = {
    sprintDays: 10, meetingShare: 20, spFactorDev: 0.7, spFactorQa: 0.5,
    members: [{ id: 'a', name: 'Bob', baseAvailability: 100, role: 'dev' }],
    attendance: { a: 8 }, plannedSp: 0,
  };
  const c = makeCalc(s);
  // netDays = 8 × 1.0 × 0.8 = 6.4
  // cap = 6.4 × 0.7 = 4.48
  return eq(c.getAttendance(s.members[0]), 8, 'Anwesend')
      && eq(c.netDaysFor(s.members[0]), 6.4, 'Netto')
      && eq(c.capacityFor(s.members[0]), 4.48, 'Kapazität');
});

test('Halbtage: 8.5/10 funktioniert', () => {
  const s = {
    sprintDays: 10, meetingShare: 20, spFactorDev: 0.7, spFactorQa: 0.5,
    members: [{ id: 'a', name: 'X', baseAvailability: 100, role: 'dev' }],
    attendance: { a: 8.5 }, plannedSp: 0,
  };
  const c = makeCalc(s);
  return eq(c.netDaysFor(s.members[0]), 6.8, 'Netto');
});

test('SP-Faktor getrennt: QA hat anderen Faktor als Dev', () => {
  const s = {
    sprintDays: 10, meetingShare: 0, spFactorDev: 0.8, spFactorQa: 0.4,
    members: [
      { id: '1', name: 'A', baseAvailability: 100, role: 'dev' },
      { id: '2', name: 'B', baseAvailability: 100, role: 'qa'  },
    ],
    attendance: {}, plannedSp: 0,
  };
  const c = makeCalc(s);
  return eq(c.capacityFor(s.members[0]), 8, 'Dev × 0.8')
      && eq(c.capacityFor(s.members[1]), 4, 'QA × 0.4');
});

test('Halbzeit-Mitglied (50% Basisverfügbarkeit)', () => {
  const s = {
    sprintDays: 10, meetingShare: 20, spFactorDev: 0.7, spFactorQa: 0.5,
    members: [{ id: 'a', name: 'Halbzeit', baseAvailability: 50, role: 'dev' }],
    attendance: {}, plannedSp: 0,
  };
  const c = makeCalc(s);
  // netDays = 10 × 0.5 × 0.8 = 4
  // cap = 4 × 0.7 = 2.8
  return eq(c.netDaysFor(s.members[0]), 4)
      && eq(c.capacityFor(s.members[0]), 2.8);
});

test('Realistisches 5er-Team mit gemischter Anwesenheit, Meeting-Abzug, getrennten SP-Faktoren', () => {
  const s = {
    sprintDays: 10, meetingShare: 20, spFactorDev: 0.7, spFactorQa: 0.5,
    members: [
      { id: '1', name: 'Anna',  baseAvailability: 100, role: 'dev' },  // 8 da
      { id: '2', name: 'Bob',   baseAvailability:  80, role: 'dev' },  // voll da
      { id: '3', name: 'Carla', baseAvailability: 100, role: 'dev' },  // 7 da
      { id: '4', name: 'Dan',   baseAvailability:  60, role: 'dev' },  // voll da
      { id: '5', name: 'Eva',   baseAvailability: 100, role: 'qa'  },  // 9 da
    ],
    attendance: { '1': 8, '3': 7, '5': 9 },
    plannedSp: 25,
  };
  const c = makeCalc(s);
  // Anna: 8 × 1.0 × 0.8 × 0.7 = 4.48
  // Bob:  10 × 0.8 × 0.8 × 0.7 = 4.48
  // Carla: 7 × 1.0 × 0.8 × 0.7 = 3.92
  // Dan:  10 × 0.6 × 0.8 × 0.7 = 3.36
  // Eva:   9 × 1.0 × 0.8 × 0.5 = 3.6
  // Total: 4.48 + 4.48 + 3.92 + 3.36 + 3.6 = 19.84
  const t = c.totals();
  const dev = c.totalsByRole('dev');
  const qa  = c.totalsByRole('qa');
  return eq(t.capacity, 19.84, 'Gesamtkapazität')
      && eq(dev.capacity, 16.24, 'Dev-Kapazität')
      && eq(qa.capacity, 3.6, 'QA-Kapazität')
      && eq(t.planned, 25);
});

test('Edge: Anwesend > Sprintlänge wird auf Sprintlänge gekappt', () => {
  const s = {
    sprintDays: 10, meetingShare: 0, spFactorDev: 0.7, spFactorQa: 0.5,
    members: [{ id: 'a', name: 'X', baseAvailability: 100, role: 'dev' }],
    attendance: { a: 99 }, plannedSp: 0,
  };
  const c = makeCalc(s);
  return eq(c.getAttendance(s.members[0]), 10);
});

test('Edge: negative Anwesenheit wird auf 0 gekappt', () => {
  const s = {
    sprintDays: 10, meetingShare: 0, spFactorDev: 0.7, spFactorQa: 0.5,
    members: [{ id: 'a', name: 'X', baseAvailability: 100, role: 'dev' }],
    attendance: { a: -5 }, plannedSp: 0,
  };
  const c = makeCalc(s);
  return eq(c.getAttendance(s.members[0]), 0);
});

test('Edge: keine attendance gespeichert → Default = sprintDays', () => {
  const s = {
    sprintDays: 10, meetingShare: 0, spFactorDev: 0.7, spFactorQa: 0.5,
    members: [{ id: 'a', name: 'Neu', baseAvailability: 100, role: 'dev' }],
    attendance: {}, plannedSp: 0,
  };
  const c = makeCalc(s);
  return eq(c.getAttendance(s.members[0]), 10);
});

test('Komma-Eingabe für Anwesend funktioniert (B1)', () => {
  const s = {
    sprintDays: 10, meetingShare: 0, spFactorDev: 0.7, spFactorQa: 0.5,
    members: [{ id: 'a', name: 'X', baseAvailability: 100, role: 'dev' }],
    attendance: { a: '8,5' }, plannedSp: 0,
  };
  const c = makeCalc(s);
  return eq(c.getAttendance(s.members[0]), 8.5)
      && eq(c.netDaysFor(s.members[0]), 8.5);
});

test('Edge: 0 Mitglieder → 0 Kapazität', () => {
  const s = {
    sprintDays: 10, meetingShare: 20, spFactorDev: 0.7, spFactorQa: 0.5,
    members: [], attendance: {}, plannedSp: 10,
  };
  const c = makeCalc(s);
  const t = c.totals();
  return eq(t.capacity, 0) && eq(t.planned, 10);
});

test('Auslastung > 100% (überplant)', () => {
  const s = {
    sprintDays: 10, meetingShare: 20, spFactorDev: 0.7, spFactorQa: 0.5,
    members: [{ id: '1', name: 'A', baseAvailability: 100, role: 'dev' }],
    attendance: {}, plannedSp: 20,
  };
  const c = makeCalc(s);
  const t = c.totals();
  // cap = 5.6, planned = 20 → ~357%
  const pct = (t.planned / t.capacity) * 100;
  return eq(pct, 357.142857, 'Überplant');
});

test('Meeting-Abzug 50% halbiert die Kapazität', () => {
  const s = {
    sprintDays: 10, meetingShare: 50, spFactorDev: 0.7, spFactorQa: 0.5,
    members: [{ id: '1', name: 'A', baseAvailability: 100, role: 'dev' }],
    attendance: {}, plannedSp: 0,
  };
  const c = makeCalc(s);
  // netDays = 10 × 1.0 × 0.5 = 5
  // cap = 5 × 0.7 = 3.5
  return eq(c.capacityFor(s.members[0]), 3.5);
});

test('Sub-Info: Dev und QA Kapazität getrennt darstellbar', () => {
  const s = {
    sprintDays: 10, meetingShare: 20, spFactorDev: 1.0, spFactorQa: 0.5,
    members: [
      { id: '1', name: 'D1', baseAvailability: 100, role: 'dev' },
      { id: '2', name: 'D2', baseAvailability: 100, role: 'dev' },
      { id: '3', name: 'Q1', baseAvailability: 100, role: 'qa'  },
    ],
    attendance: {}, plannedSp: 0,
  };
  const c = makeCalc(s);
  const dev = c.totalsByRole('dev');
  const qa  = c.totalsByRole('qa');
  // Pro Person: 10 × 1.0 × 0.8 = 8 netto
  // Dev: 2 × 8 × 1.0 = 16
  // QA:  1 × 8 × 0.5 = 4
  return eq(dev.capacity, 16, 'Dev')
      && eq(qa.capacity, 4, 'QA')
      && eq(dev.members.length, 2)
      && eq(qa.members.length, 1);
});

// Run
console.log('=== QA-Tests Kapazitätsplaner v3 ===\n');
tests.forEach(t => {
  const ok = t.fn();
  if (ok) { pass++; console.log(`  PASS  ${t.name}`); }
  else    { fail++; console.log(`  FAIL  ${t.name}`); }
});
console.log(`\nErgebnis: ${pass} pass, ${fail} fail (${tests.length} total)`);
process.exit(fail > 0 ? 1 : 0);
