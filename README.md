# Sachkunde-Trainer LHundG NRW

Lern- und Prüfungstrainer für den **Sachkundenachweis nach dem Landeshundegesetz NRW**.
Enthält alle 114 Fragen des Fragenkatalogs des Rhein-Sieg-Kreises (MFB-05-02-00, Fassung 04) mit den Lösungen aus dem Antwortteil.

- **Lernen:** eine Frage pro Bildschirm, sofortige Rückmeldung, Filter nach Abschnitt und Lernstand
- **Prüfung:** Simulation mit 20, 30, 50 oder allen 114 Fragen, einstellbare Bestehensgrenze
- **Auswertung:** Bereitschaftswert (0–100), vier Kriterien, nächster Schritt, Problemfragen, Verlauf
- **Alle Fragen:** Übersicht aller Fragen, eingefärbt nach Lernstand

Läuft komplett im Browser, ohne Server, ohne Anmeldung und ohne externe Dienste (keine Google Fonts, kein Tracking).
Der Lernstand wird nur lokal im Browser des Geräts gespeichert.

---

## 1. Auf GitHub hochladen

**Ohne Git (im Browser):**

1. Auf [github.com](https://github.com) anmelden → oben rechts **+** → **New repository**.
2. Name eingeben, z. B. `sachkunde-trainer`, Sichtbarkeit wählen, **Create repository**.
3. Auf der neuen Seite **uploading an existing file** anklicken.
4. Den **Inhalt** dieses Ordners (nicht den Ordner selbst) per Drag & Drop hineinziehen:
   `index.html`, `manifest.webmanifest`, `sw.js`, `.nojekyll`, `README.md` und die Ordner `css`, `js`, `img`, `icons`.
   > Die Datei `.nojekyll` ist auf dem Mac im Finder unsichtbar (Cmd + Shift + Punkt zeigt sie). Sie ist nicht zwingend nötig, schadet aber nicht.
5. **Commit changes** klicken.

**Mit Git (Terminal):**

```bash
cd sachkunde-trainer
git init
git add .
git commit -m "Sachkunde-Trainer"
git branch -M main
git remote add origin https://github.com/DEIN-NAME/sachkunde-trainer.git
git push -u origin main
```

## 2. Mit GitHub Pages veröffentlichen

1. Im Repository: **Settings** → links **Pages**.
2. Unter **Build and deployment** → **Source**: `Deploy from a branch`.
3. **Branch**: `main`, Ordner `/ (root)` → **Save**.
4. Nach ca. 1–2 Minuten erscheint oben die Adresse, z. B.
   `https://DEIN-NAME.github.io/sachkunde-trainer/`

> Hinweis: Mit einem kostenlosen GitHub-Konto funktioniert GitHub Pages nur bei **öffentlichen** Repositories. Die Seite ist dann für jeden mit dem Link erreichbar.

## 3. Auf dem iPhone / iPad nutzen

1. Die GitHub-Pages-Adresse in **Safari** öffnen.
2. Unten auf **Teilen** (Quadrat mit Pfeil) tippen → **Zum Home-Bildschirm** → **Hinzufügen**.
3. Der Trainer startet ab jetzt wie eine App im Vollbild, mit eigenem Symbol.

Nach dem ersten Öffnen funktioniert er auch **offline** (z. B. im Zug).

### Lernstand sichern

Der Fortschritt liegt nur auf dem jeweiligen Gerät. Safari kann Daten von Webseiten löschen, die lange nicht genutzt wurden.
Als App auf dem Home-Bildschirm ist das deutlich zuverlässiger. Zusätzlich gibt es unter **Auswertung → Fortschritt sichern oder übertragen**:

- **Sicherung teilen**: öffnet das iOS-Teilen-Menü, z. B. um den Code in Notizen abzulegen
- **Sicherungscode kopieren / einfügen**: zum Übertragen auf ein anderes Gerät

Eine laufende Prüfungssimulation bleibt erhalten, wenn die App zwischendurch geschlossen wird (bis zu 24 Stunden).

## 4. Lokal testen

Die Seite funktioniert auch per Doppelklick auf `index.html`. Für den Offline-Modus (Service Worker) wird HTTPS bzw. ein lokaler Server benötigt:

```bash
cd sachkunde-trainer
python3 -m http.server 8000
# dann http://localhost:8000 öffnen
```

## 5. Änderungen vornehmen

| Was | Wo |
|---|---|
| Fragen, Antworten, Lösungen | `js/questions.js` |
| Logik (Auswertung, Prüfung, Speicherung) | `js/app.js` |
| Aussehen | `css/style.css` |
| Abbildungen zu A2, A3, A4, A6 | `img/` |

Nach Änderungen in `sw.js` die Zeile `const CACHE = 'sachkunde-trainer-v1';` hochzählen (`v2`, `v3` …), damit installierte Apps sicher die neue Fassung übernehmen.

### Aufbau einer Frage in `js/questions.js`

```js
{ "id": "A5", "sec": "A", "type": "multi",
  "q": "Was bedeutet es, wenn ein Hund einem anderen den Kopf auf den Rücken legt?",
  "opts": [["a", "Er ist unterwürfig"], ["b", "…"], ["d", "Es ist eine Imponiergeste"]],
  "answer": ["d"] }
```

Zuordnungsfragen (`"type": "match"`) haben `items` (Begriffe), `targets` (Nummern) und `answer` als Zuordnung, z. B. `{"a": "3", "b": "1", "c": "2"}`.

## Wertung

- Eine Frage gilt nur als richtig, wenn **alle** richtigen Antworten und **keine** falsche angekreuzt sind. Bei Zuordnungsfragen müssen alle Zuordnungen stimmen.
- **Bereitschaftswert** = 45 % zuletzt richtig beantwortete Fragen + 25 % sicher beherrschte Fragen (2× in Folge richtig) + 30 % Schnitt der letzten 3 Simulationen.
- **Prüfungsbereit**, wenn alle vier Kriterien erfüllt sind: alle Fragen bearbeitet, ≥ 90 % zuletzt richtig, jeder Abschnitt ≥ 85 %, die letzten 3 Simulationen bestanden.
- Die Bestehensgrenze der echten Prüfung legt das zuständige Veterinäramt fest. Im Trainer ist sie einstellbar (Standard 80 %).

## Quelle

Fragen und Lösungen: *Fragenkatalog Sachkundenachweis LHundG NRW*, Rhein-Sieg-Kreis, Veterinär- und Lebensmittelüberwachungsamt, Dokument MFB-05-02-00, Fassung 04.
Die Rechte am Fragenkatalog liegen beim Rhein-Sieg-Kreis. Der Trainer ist ein privates Lernhilfsmittel und kein offizielles Angebot des Kreises.
