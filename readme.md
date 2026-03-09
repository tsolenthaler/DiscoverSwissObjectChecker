# DiscoverSwissCheckData

Produktionsreife, statische Webapp zum Pruefen von discover.swiss Objektdaten per ID oder Endpoint-Pfad.

## Features
- GET-Abfragen gegen discover.swiss Info API (TEST und PROD)
- Konfigurationsverwaltung: erstellen, bearbeiten, loeschen, laden, importieren, exportieren
- Pro Konfiguration speicherbarer API-Key (`Ocp-Apim-Subscription-Key`)
- Optionales Scope-Textfeld direkt in der Suche (Standard: leer)
- Direkter Aufruf per URL-Parameter, z. B. `index.html?id=civ_s9t_aaeiccsu-bqdq-eagu-jfij-qiqacbfiqaib`
- Default-Konfiguration fuer TEST mit `project=tso-test`
- ID-Parsing fuer reine IDs und Pfadformat (`/endpoint/id`)
- Pflichtsektionen im Ergebnisbereich:
  - Medien (`image` als Hauptbild, `photo` als Galerie inkl. `thumbnailUrl`, `contentUrl`, `tagToQuery`)
  - Accommodation (`accommodation` als Liste)
  - Links (`link` als klickbare Liste mit Typ/Sprache)
- JSON-Tools:
  - JSON im Popup oeffnen
  - JSON in Zwischenablage kopieren
- Robuste Fehlerbehandlung (404, Netzwerk, Timeout, CORS-Hinweis)
- Responsive 2-Bereich-Ansicht mit Tastatur-bedienbarer UI

## Projektstruktur
```text
index.html
settings.html
assets/styles.css
src/main.js
src/settings.js
src/modules/constants.js
src/modules/configStore.js
src/modules/utils.js
src/modules/api.js
src/modules/renderers.js
exampleRequestBody.json
discoverswiss-test-v2-infocenter-api.json
```

## Lokal starten
Da es eine statische App ist, reicht ein einfacher Webserver.

### Option 1: VS Code Live Server
- `index.html` oeffnen
- "Open with Live Server"

### Option 2: Python
```bash
python -m http.server 8080
```
Dann `http://localhost:8080` aufrufen.

## GitHub Pages Deploy
1. Repository nach GitHub pushen.
2. In GitHub: `Settings` -> `Pages`.
3. Source auf `Deploy from a branch` setzen.
4. Branch `main`, Folder `/ (root)` auswaehlen.
5. Speichern. Danach ist die App unter der GitHub-Pages-URL erreichbar.

## API-Key
- Den Subscription Key gemaess discover.swiss Doku in der jeweiligen Konfiguration eintragen.
- Header wird bei jeder Abfrage automatisch gesetzt als `Ocp-Apim-Subscription-Key`.
- Ohne API-Key wird kein Request ausgefuehrt.

## Sprache
- Sprache wird aus der aktiven Konfiguration uebernommen.
- Wird als Header `Accept-Language` bei jedem Request mitgegeben (wenn gesetzt).

## Seitenaufteilung
- `index.html`: Auswahl "Gespeicherte Konfigurationen" und Objekt-Suche inkl. Ergebnisansicht
- `settings.html`: Vollstaendige Konfigurationsverwaltung (CRUD, Import, Export)

## Direktaufruf per URL
- `index.html?id=<objekt-id>` startet die Abfrage direkt beim Laden der Seite.
- Optional kann `endpoint` gesetzt werden, falls die ID kein eindeutiges Prefix hat:
  - `index.html?id=<objekt-id>&endpoint=lodgingbusinesses`
- Optional kann `scope` gesetzt werden:
  - `index.html?id=<objekt-id>&scope=partner:read`

## API-Konfiguration pflegen
- Base-URLs und Default-Config: `src/modules/constants.js`
  - `API_BASE_URLS`
  - `DEFAULT_CONFIG`
- Prefix-zu-Endpoint-Mapping: `src/modules/constants.js`
  - `PREFIX_TO_ENDPOINT`
- ID-/Pfad-Erkennung: `src/modules/utils.js`
  - `parseObjectInput(...)`
- URL-Aufbau und Request-Logik: `src/modules/api.js`
  - `buildApiUrl(...)`
  - `fetchObjectById(...)`

## Hinweis zu OpenAPI
Die Datei `discoverswiss-test-v2-infocenter-api.json` liegt im Projekt und kann fuer Feld-/Endpoint-Details genutzt werden.
