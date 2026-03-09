# Prompt fuer GitHub Copilot: DiscoverSwissCheckData

Du bist ein erfahrener Full-Stack-Webentwickler. Erstelle eine produktionsreife Webapp mit dem Namen **DiscoverSwissCheckData**.

## Ziel
Die App soll per Objekt-ID alle verfuegbaren Informationen aus der discover.swiss Info API abrufen, strukturiert anzeigen und die Qualitaet der gelieferten Daten schnell pruefbar machen.

## Allgemeine Anforderungen
- Erstelle eine **Webapp**, die lokal lauffaehig ist und fuer **GitHub Pages** deploybar ist.
- Verwende eine klare, wartbare Projektstruktur mit gut benannten Modulen.
- Implementiere robuste Fehlerbehandlung (Netzwerkfehler, 404, ungueltige IDs, leere Felder, CORS-Hinweise).
- Nutze nur `GET`-Requests fuer API-Abfragen.
- Erlaube Umschaltung zwischen **TEST** und **PROD** API.
- Beruecksichtige den Query-Parameter `project` (z. B. `tso-test`) konfigurierbar pro Umgebung.

## Konfigurationsverwaltung (wie im Referenztool)
Implementiere eine Konfigurationsverwaltung aehnlich:
`https://tsolenthaler.github.io/AiDiscoverSwissViewManager/index.html`

Pflichtfunktionen:
- Konfiguration **erstellen**
- Konfiguration **bearbeiten**
- Konfiguration **loeschen**
- Konfiguration **laden**
- Konfiguration **importieren** (JSON-Datei)
- Konfiguration **exportieren** (JSON-Datei)
- Trennung/Support fuer **Produktion** und **Test**

Eine Konfiguration sollte mindestens enthalten:
- Name der Konfiguration
- Umgebung (`test` oder `prod`)
- Base-URL
- `project`-Parameter
- optionale Standard-Sprache
- Zeitstempel der letzten Nutzung

## Eingabe und ID-Verarbeitung
Erstelle ein Eingabefeld fuer Objekt-IDs.
Akzeptiere folgende Formate:
- reine ID, z. B. `civ_s9t_aaeiccsu-bqdq-eagu-jfij-qiqacbfiqaib`
- reine ID, z. B. `log_s9t_ataucabi-giij-eiqi-rbrt-afarhcvaggft`
- Pfadformat, z. B. `/lodgingbusinesses/log_s9t_ataucabi-giij-eiqi-rbrt-afarhcvaggft`
- Pfadformat, z. B. `/civicStructures/civ_s9t_aaeiccsu-bqdq-eagu-jfij-qiqacbfiqaib`

Implementiere eine Logik, die:
- den Ressourcentyp aus Praefix oder Pfad erkennt,
- den korrekten Endpoint bestimmt,
- die URL korrekt zusammensetzt.

## Unterstuetzte Endpoints
Die App muss mindestens folgende Endpoints unterstuetzen:
- `/accommodations/{id}`
- `/civicStructures/{id}`
- `/creativeWorks/{id}`
- `/events/{id}`
- `/foodEstablishments/{id}`
- `/imageObjects/{id}`
- `/localbusinesses/{id}`
- `/lodgingbusinesses/{id}`
- `/mediaObjects/{id}`
- `/places/{id}`
- `/products/{id}`
- `/skiresorts/{id}`
- `/tours/{id}`
- `/transportationSystems/{id}`
- `/videoObjects/{id}`
- `/webcams/{id}`

Nutze fuer Details zur Struktur die OpenAPI-Datei:
- `discoverswiss-test-v2-infocenter-api.json`

## Detail-Seite (Pflichtsektionen)
Nach erfolgreicher Abfrage zeige eine Detailseite mit folgenden Abschnitten:

### 1) Medien
- **Hauptbild** aus Property `image` anzeigen.
- **Galerie** aus Property `photo` anzeigen.
- Je Medium anzeigen:
  - Vorschaubild aus `thumbnailUrl`
  - Link zum Original aus `contentUrl`
  - Werte von `tagToQuery`
- Falls Felder fehlen, sichtbare Fallback-Hinweise anzeigen (z. B. "kein thumbnailUrl vorhanden").

### 2) Accommodation
- Property `accommodation` als Liste darstellen.
- Pro Eintrag mindestens anzeigen:
  - `name`
  - Link/ID (z. B. `@id` oder `identifier`)

### 3) Links
- Property `link` als klickbare Liste darstellen.
- Zeige pro Eintrag mindestens:
  - URL
  - Typ (falls vorhanden, z. B. `WebBooking`, `WebHomepage`)
  - Sprache (falls vorhanden)

### 4) JSON-Tools
- Button: "JSON im Popup oeffnen"
- Button: "JSON in Zwischenablage kopieren"
- Popup soll formatiertes JSON (`pretty print`) anzeigen.

## API-Beispiele (zur Implementierung nutzen)
Beispiel PROD:
`https://api.discover.swiss/info/v2/accommodations/acc_s9t_tgcrjtfq-cbbt-efaa-qfgc-vutdtgvbqafa?project=tso-test`

Beispiel TEST:
`https://api.discover.swiss/test/info/v2/accommodations/acc_s9t_tgcrjtfq-cbbt-efaa-qfgc-vutdtgvbqafa?project=tso-test`

Beispiel GET:
`https://api.discover.swiss/test/info/v2/lodgingbusinesses/log_s9t_ataucabi-giij-eiqi-rbrt-afarhcvaggft?project=tso-test`

Nutze die bereitgestellten Beispieldaten aus:
- `exampleRequestBody.json`

## UX-Anforderungen
- Uebersichtliche 2-Bereich-Ansicht: Such-/Konfigurationsbereich + Ergebnisbereich.
- Ladezustand und Fehlermeldungen klar visualisieren.
- Responsives Layout fuer Desktop und Mobile.
- Saubere Tastaturbedienung und sinnvolle ARIA-Labels.

## Technische Qualitaet
- Schreibe modularen Code mit klar getrennten Verantwortlichkeiten (API, Parsing, UI, Storage).
- Persistiere Konfigurationen lokal (z. B. `localStorage`).
- Definiere Utility-Funktionen fuer:
  - ID-Normalisierung
  - Endpoint-Erkennung
  - sichere Feldauslese bei optionalen Properties
- Erzeuge eine kurze Projektdokumentation mit Start- und Deploy-Schritten.

## Abnahmekriterien
- Eine gueltige ID liefert sichtbare Daten in allen relevanten Sektionen.
- `image` und `photo` werden korrekt unterschieden und dargestellt.
- `tagToQuery` wird pro Medium angezeigt.
- `accommodation` und `link` werden als Listen mit klickbaren Referenzen angezeigt.
- JSON-Popup und Clipboard-Funktion funktionieren.
- Konfigurationen koennen erstellt, bearbeitet, geloescht, geladen, importiert und exportiert werden.
- Umschalten zwischen TEST/PROD funktioniert korrekt.
- Projekt ist fuer GitHub Pages baubar/deploybar.

## Ausgabe von dir (Copilot)
Liefere:
- komplette Projektdateien
- kurze README mit Setup und Deploy
- sinnvolle Default-Konfiguration fuer TEST (`project=tso-test`)
- klare Hinweise, wo API-Base-URLs und Mapping gepflegt werden koennen
