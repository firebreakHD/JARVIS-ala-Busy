# J.A.R.V.I.S. Add-on

Die Weboberfläche verbindet sich mit einem bereits laufenden Hermes API Server. Hermes bleibt für Desktop und mobilen Voice Mode dieselbe Agenten- und Brain-Instanz.

## Einrichtung

In der Add-on-Konfiguration setzen:

- `hermes_base_url`: erreichbare Hermes-Adresse, ohne `/v1`.
- `hermes_api_key`: Bearer-Key des Hermes API Servers.
- `access_password`: eigenes Passwort für den direkten Zugriff auf J.A.R.V.I.S. im Heimnetz. Der HA-Tab verwendet die Home-Assistant-Anmeldung.
- `whisper_cpp_path` und `whisper_model_path`: optional; für den mobilen Voice Mode erforderlich.

Das Add-on installiert ffmpeg im Container. Whisper.cpp und sein Modell werden nicht automatisch heruntergeladen. Stimmen für TTS kommen aus dem Browser oder Betriebssystem des jeweiligen Geräts.

## Home-Assistant-Tab und Direktport

Ab Version `0.1.1` öffnet **Benutzeroberfläche öffnen** die Anwendung per HA-Ingress. Auf der Add-on-Seite **In der Seitenleiste anzeigen** einschalten, damit J.A.R.V.I.S. als eigener Tab erscheint.

Parallel steht `http://<HA-IP>:8787` zur Verfügung. Den Host-Port unter **Konfiguration → Netzwerk** ändern, falls `8787` bereits belegt ist. Der interne Direktport bleibt `8787`; der interne Ingress-Port `8099` wird nicht ins Heimnetz veröffentlicht. Beide Listener verwenden denselben Servercode und dieselben Sitzungsdaten.

Im Add-on lauscht der Server auf `0.0.0.0`, damit der HA-Proxy und die Portweiterleitung ihn erreichen. Nur Verbindungen vom Supervisor (`172.30.32.2`, auch IPv4-mapped IPv6) auf dem separaten Ingress-Listener dürfen die HA-Anmeldung verwenden. Forwarding-Header auf dem Direktport umgehen die Passwortprüfung nicht. Ohne `access_password` bleibt die direkte Daten-API gesperrt; der HA-Tab funktioniert weiter.

Die HTML-Basisadresse wird aus dem Ingress-Pfad des vertrauenswürdigen Proxys eingesetzt. CSS, JavaScript, Modulimporte, Anmeldung, Chatstream und Voice-Anfragen verwenden diese Basisadresse. `ingress_stream` ist aktiviert.

Für das Update: Änderungen mit GitHub Desktop committen/pushen, anschließend im HA-Add-on-Store nach Updates suchen und `0.1.2` installieren. Danach **In der Seitenleiste anzeigen** aktivieren und für direkten Browserzugriff `access_password` setzen. Ein bloßer Neustart der alten Version übernimmt die lokalen Codeänderungen nicht.

### Fehler: App nicht bereit, obwohl der Server lauscht

Eine Logzeile mit `127.0.0.1:8787; data: /app/data` bedeutet, dass der Server mit Entwicklungswerten statt den Add-on-Einstellungen läuft. Im s6-overlay-v3-Basisimage erhält der normale `CMD` nur eine minimale Umgebung. Ab `0.1.2` stellt `/usr/bin/with-contenv` die Docker-Umgebung für Node wieder her. Damit werden auch `/data/options.json` und der HA-Ingress-Modus verwendet. Nach Installation der neuen Version müssen diese beiden Startzeilen erscheinen:

```text
J.A.R.V.I.S. listening on 0.0.0.0:8787; data: /data
J.A.R.V.I.S. Home Assistant ingress listening on 8099
```

Die Reihenfolge der Zeilen kann abweichen. Bleiben die alten Werte nach einem Update sichtbar, wurde noch nicht der neue Container gestartet. Im Add-on die installierte Version kontrollieren und bei Bedarf **Neu erstellen** ausführen; die Anwendung dafür nicht deinstallieren.

## Prüfung

Im Verzeichnis `jarvis` führt `npm test` die Zugriffstests aus. Sie prüfen Ingress-Pfade, die Supervisor-Erkennung, Ablehnung gefälschter Proxy-Header, beide Listener, Passwortschutz, JavaScript/CSS-Auslieferung und Sitzungsdaten nach Serverneustart. Testdaten liegen in einem isolierten, automatisch entfernten Unterordner von `jarvis/data/`. Eine echte HA-Installation und Hermes-Verbindung sind zusätzlich am Zielgerät zu prüfen.

GitHub Actions führt zusätzlich `bash jarvis/test/container-startup.sh` vom Repository-Stamm aus. Dieser Test baut das Dockerimage und startet es über dessen echten s6-Einstiegspunkt, ohne die Add-on-Umgebung manuell in Node zu setzen. Er prüft die erreichbaren Listener und `/data` als Datenpfad. Lokal benötigt dieser Test einen laufenden Docker-Daemon.

## Entwicklung außerhalb von Home Assistant

Voraussetzung ist Node.js 20 oder neuer. Im Add-on-Verzeichnis `jarvis` starten:

```powershell
$env:HERMES_BASE_URL = "http://homeassistant.local:8642"
$env:HERMES_API_KEY = "DEIN_HERMES_API_SERVER_KEY"
node server.mjs
```

Danach `http://localhost:8787` öffnen. Ohne `JARVIS_ACCESS_PASSWORD` bindet der Entwicklungsserver nur an Loopback. Netzwerkzugriff erfordert ein Passwort.

## Verhalten

- Das Mikrofon bleibt im Desktop-Chat aus.
- Hermes-Text wird gestreamt; neue Nachrichten trennen alte Generationen und stoppen Audio.
- TTS kann ein- und ausgeschaltet sowie in Lautstärke und Stimme angepasst werden.
- Sitzungen und Texte liegen in `/data`.
- Mobile Spracherkennung erfordert Whisper.cpp, ein lokales Modell und Browser-Mikrofonzugriff. iPhone-Browser erfordern HTTPS.
- Die Hermes-Run-Stop-Funktion wird verwendet, wenn der konfigurierte Hermes-Server sie anbietet. Eine ältere OpenAI-kompatible Schnittstelle kann serverseitige Tool-Aktionen nicht immer stoppen.

Alle Sprachpfade bleiben lokal; das Add-on ruft keine kostenpflichtigen TTS- oder STT-APIs auf.
