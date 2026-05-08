# procilon · Kapazitätsplaner

Ein leichtgewichtiger Sprint-Kapazitätsplaner für Entwicklungsteams. Single-File-Webanwendung,
keine Installation nötig: HTML-Datei im Browser öffnen, fertig.

Der Planer wurde für **Live Sprint Planning** entworfen: der Scrum Master hat das Tool offen,
die Team-Mitglieder sagen reihum „bin nur 8 von 10 Tagen da", und die Auslastung wird live
für Dev und QA gemeinsam berechnet.

## Features

- Stammdaten-Verwaltung (Mitglieder, Rolle, Basis-Verfügbarkeit)
- Konfigurierbare Sprintlänge, Meeting-Pauschale, separate SP-Faktoren für Dev und QA
- Live-Eingabe der Anwesenheit pro Sprint
- Echtzeit-Berechnung der Team-Auslastung mit Aufschlüsselung pro Rolle
- Export/Import als JSON für Backups
- Persistenz über `localStorage` (browser-lokal)
- Beispieldaten beim ersten Öffnen

## Schnellstart

1. `kapazitaetsplaner.html` herunterladen oder klonen.
2. Datei im Browser öffnen (Doppelklick).
3. Beim ersten Start ist ein 5er-Beispielteam geladen, mit dem du dich einarbeiten kannst.
4. Eigene Mitglieder über die Team-Verwaltung anlegen.

## Bedienung

### Team-Verwaltung (Tab „Team-Verwaltung")

Pflege der Stammdaten und globalen Settings:

- **Sprintlänge** in Werktagen (Default 10).
- **Meeting-Abzug** (% pauschal, Default 20). Wird auf jede Person angewendet.
- **SP-Faktor Dev / QA** (Default jeweils 0,7). Story Points, die ein Personentag „wert" ist.
- **Mitglieder**: Name, Rolle (Dev oder QA), Basis-Verfügbarkeit (z. B. 100 % = Vollzeit, 50 % = Halbzeit).

### Planning (Tab „Planning")

Pro Sprint:

- **Geplante Story Points** oben eingeben (Dev und QA gemeinsam).
- **Anwesenheit** pro Mitglied in der Tabelle eintragen, z. B. „8 von 10". Default = voll anwesend.
- Auslastung erscheint live oben in der zentralen Karte.
- Sub-Info darunter zeigt Kapazität getrennt für Dev und QA.

### Sprint Reset

Setzt nur die Anwesenheit (auf „voll da") und die geplanten SP zurück.
Mitglieder und Settings bleiben unverändert.

## Berechnung

```
Netto-Tage   = Anwesende Tage × (Verfügbarkeit ÷ 100) × (1 − Meeting-Abzug ÷ 100)
Kapazität    = Netto-Tage × SP-Faktor (Dev oder QA, je nach Rolle)
Auslastung % = Geplante SP ÷ Σ Kapazität × 100
```

Krankheit ist bewusst nicht eingerechnet — der Planer zeigt die Zielkapazität bei
geplanter Anwesenheit. Reale Kapazität kann durch ungeplante Ausfälle sinken.

## Tests

Das Repo enthält drei Test-Suiten, die in Node ausgeführt werden:

```bash
npm install            # einmalig: jsdom installieren
node qa_test.js        # Berechnungslogik (15 Tests)
node qa_ui_test.js     # UI-Render mit jsdom (44 Tests)
node qa_lifecycle_test.js  # Lifecycles, First-Run, Reset (25 Tests)
```

Alle drei Suiten zusammen decken die kritische Funktionalität ab.

## Tech-Stack

- **Vanilla HTML, CSS, JavaScript** in einer einzigen Datei. Keine Build-Tools.
- **`localStorage`** für Persistenz.
- **jsdom** ausschließlich als Dev-Dependency für Tests.
- **Inter / Material Symbols** via Google-Fonts-CDN für Typografie und Icons.

## Limitationen / bekannte Themen

- Single-User-Tool (`localStorage` ist browser-lokal, kein Sharing zwischen Teammitgliedern).
- Keine Historie über mehrere Sprints (Snapshot-orientiert).
- Krankheits-Buffer ist absichtlich nicht eingerechnet.
- Multi-Team-Setup nicht unterstützt — pro Browser ein Team.

Diese Punkte sind dokumentierte Designentscheidungen, keine Bugs.

## Lizenz

Intern bei procilon. Vor externer Nutzung freigeben lassen.
