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

Ab `0.1.3` zeigt JARVIS den Grund einer fehlgeschlagenen Hermes-Verbindung über dem Chat. In der JARVIS-Konfiguration muss `hermes_base_url` auf den API-Server zeigen: intern `http://<tatsächlicher-HA-DNS-Name>:8642`, alternativ `http://<HA-IP>:<veröffentlichter-API-Port>`. `localhost` bezeichnet im JARVIS-Container JARVIS selbst. Der Hermes-WebUI-Port und eine HA-Ingress-URL sind keine API-Adresse. Den tatsächlichen DNS-Namen aus HA übernehmen, nicht die Repository-ID raten. `hermes_api_key` muss dem bei Hermes eingerichteten `api_server_key` entsprechen. Geheimnisse nicht in Chat oder Logs kopieren. Nach einer Änderung der Add-on-Optionen JARVIS neu starten und mit ↻ die Verbindung erneut prüfen.

Die Prüfung ruft ausschließlich `GET /v1/models` auf und führt keine Agentenaktion aus. Ein erfolgreicher API-Status bestätigt Erreichbarkeit und Schlüssel, aber noch keine erfolgreiche LLM-Anmeldung oder Tool-Ausführung. Dafür ist ein echter Chat-Test nötig.

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

## Tool-Aktivität nach ADA-Verhalten (0.1.4)

Die ADA-/AURA_ADA-Referenz wurde ausschließlich gelesen. Übernommen wurde das Verhalten der temporären Aktivitätsanzeige. Das bestehende Chatlayout, Farben, Sitzungsnavigation und Voice-/Chat-Modi bleiben bestehen. Tool-Karten stehen oberhalb der Eingabe; mobil sind sie einspaltig und in der Höhe begrenzt. Die neue Aktivitäts-Schaltfläche blendet sie wieder ein.

Nur tatsächlich empfangene Ereignisse erzeugen Karten: `tool.started`, `tool.completed`, `tool.failed` aus dem Runs-Stream sowie `hermes.tool.progress` aus Standard-Chatstreams. Starts und Abschlüsse werden nach Toolname beziehungsweise vorhandener Call-ID zugeordnet. Parallele Aufrufe bleiben getrennt. Nach Abschluss aller sichtbaren Aufrufe verschwindet die Fläche nach acht Sekunden. Während Maus-/Tastaturinteraktion wird der Timer angehalten. Rohes Tool-HTML, Argumente und Ergebnisse werden nicht in Karten übernommen. Bei älteren Chatstreams ohne Abschlussereignis lautet der Zustand ehrlich „Ausgabe beendet · Ergebnis nicht gemeldet“. Ein Text wie „ich öffne den Browser“ erzeugt keine erfundene Toolaktion.

Ein generisches Toolereignis bestätigt noch keine Browserinstallation oder erfolgreiche Aktion auf einer Website. JARVIS zeigt den von Hermes gemeldeten Werkzeugzustand; ein fachliches Ergebnis wie „Account blockiert“ muss Hermes selbst an der Website verifizieren. Die Oberfläche ruft zur Darstellung keine Tools erneut auf.

## Permanenter Browser: Phase 1 vom 15.10.2026

### Verifizierte Umgebung

- Auf dem HA-Host 192.168.1.184 antworten zum Prüfzeitpunkt Home Assistant auf 8123, der JARVIS-Anmeldestatus auf 8787 und Hermes auf 8642. Der öffentliche Hermes-Gesundheitsstatus meldet Agent-Version 0.22.2. Geschützte Capabilities antworten ohne Schlüssel mit 401; es wurden keine Zugangsdaten ausgelesen.
- Ein öffentlicher CDP-Port 9222 nimmt vom PC keine Verbindung an. Daraus folgt nicht, dass intern kein Browser existiert.
- Der lokale Hermes-Add-on-Checkout deklariert 2.0.4. Er startet den offiziellen Agenten/Gateway und die separate WebUI, speichert Daten unter /data/hermes und unterstützt MCP-Konfiguration. Browserinstallation wird beim Erstsetup mit --skip-browser ausgelassen. Auto-Updates können den laufenden Agenten über den Image-Seed hinaus aktualisieren.
- JARVIS verwendet dieselbe Hermes-API für Chat und Voice. Die Oberfläche nutzt lokale Browser-TTS; Konfiguration und JSON-Sitzungsdaten liegen im Add-on unter /data. Es gibt aktuell keinen Browserdienst, keine Browsersteuerung und kein integriertes Browser-MCP in JARVIS.
- Auf dem Windows-PC sind Node und die Docker-CLI vorhanden; der Docker-Daemon ist nicht erreichbar. Das ist keine Prüfung des HA-Host-Dockers. Die verfügbaren Ressourcen, laufenden Container, Browserpakete und freien internen Serverports sind ohne authentifizierten Serverzugang noch unbekannt.
- ADA ist eine Electron-/Python-Referenz. Daraus werden keine Providerzugänge, Agentenarchitektur, Electron-Prozesse oder kostenpflichtigen Sprachdienste übernommen.

### Gewählter Integrationsweg mit noch offenem Laufzeittest

Ein eigener Browserdienst wird als separates HA-Add-on im JARVIS-Repository vorbereitet. Er soll unabhängig von Chat, JARVIS-Neustarts und einzelnen Hermes-Aufträgen laufen. Das bestehende Hermes-Add-on wird nicht ersetzt und seine Dateien werden nicht durch dieses Projekt geändert.

Geplant ist ein sichtbarer Chromium-Prozess auf einem virtuellen Linux-Display, grafischer Zugang über noVNC und Steuerung derselben Chromium-Instanz über eine lokale CDP-Verbindung. Ein dedizierter Vermittlungsdienst stellt die von Hermes nutzbaren Browser-Tools über dessen vorhandene HTTP-MCP-Schnittstelle bereit. Damit kann er jede Aktion vor Ausführung gegen den Eigentümermodus prüfen. CDP und VNC bleiben intern; weder ein roher Debug-Port noch ein Docker-Socket wird im LAN freigegeben. Es läuft zunächst nur ein Browserprofil gleichzeitig. Profilwechsel beendet die bisherige Instanz geordnet und verwendet getrennte persistente Profilverzeichnisse.

Die vorhandenen nativen Hermes-CDP-Tools werden bei der Umsetzung zuerst gegen die tatsächlich installierte Version geprüft. Ein unkontrollierter direkter CDP-Zugang wäre für die geforderte harte manuelle Sperre ungeeignet: Er könnte an der Kontrolle des Vermittlers vorbei Eingaben senden. Der integrierte Browser darf daher ausschließlich über die geprüfte Steuerung erreichbar sein. Eine Anweisung im Prompt ist kein Ersatz für diese Sperre.

LinuxServer Chromium/Selkies wurde als Alternative geprüft: Es bringt GUI und persistente Konfiguration mit. Vor einem Einsatz müssten jedoch Terminal-/sudo-Zugänge gesperrt, die gemeinsame CDP-Sitzung und eine serverseitige Eingabesperre nachgewiesen werden. Ein bloßer eingebetteter Selkies-Link erfüllt die Anforderungen an sichere Übergabe noch nicht. Der schmalere noVNC-Dienst ist deshalb die bevorzugte Umsetzung, vorbehaltlich des Sandbox-/AppArmor-Tests auf HA OS. Chromium soll als eigener unprivilegierter Benutzer mit Sandbox laufen; keine pauschalen --privileged-/--no-sandbox-Workarounds.

Steuerung ist eine deterministische Zustandsmaschine, keine zweite KI: `agent`, `manual`, `paused`, mit Revisionsnummer und laufender Aktionssperre. Bei Übernahme werden neue Agentenaktionen gesperrt und laufende Aktionen geordnet angehalten beziehungsweise abgebrochen. Erst nach bestätigter Freigabe erhält die GUI Eingaberechte. Ein Verlust der Verbindung führt sicher zu paused. Bei Rückgabe werden Elementreferenzen ungültig; vor jeder neuen Aktion ist eine frische Zustandsaufnahme erforderlich. Downloads oder bereits abgeschickte Serveraktionen lassen sich nicht rückwirkend ungeschehen machen.

Browseransicht und Tool-Karten übernehmen das heutige JARVIS-Design. Mobile nutzt eine begrenzte Vollbreitenansicht oder öffnet den authentifizierten GUI-Zugang in einem separaten Tab. Es gibt keinen optischen Neubau des Chats und keine dauerhaft sichtbaren Leerflächen für ungenutzte Tools.

Profile, Aufgaben-/Schrittfortschritt, Tab-Wiederherstellung und Datensätze liegen persistent beim Browserdienst. Strukturierte Messungen verwenden SQLite mit Quelle, Profil, Zeitstempel, Schema, Eindeutigkeitsschlüssel und Status fehlender Werte. Browserprofile werden nur bei gestopptem Browser oder konsistentem Snapshot gesichert; keine Veröffentlichung von Cookies oder Tokens. Ein Wiederherstellen offener Tabs darf keine Formularaktionen erneut absenden.

### Reihenfolge und Abnahmekriterien

1. Serverprüfung: vorhandenen SSH-/Terminalzugang verwenden; Agent-Version, Browser-/MCP-Werkzeuge, freie Ports, RAM/CPU/Platte und HA-Sandbox feststellen. Keine Änderungen an Fremdprojekten und keine Ausgabe von Secrets. Erst danach Image-/Paketversionen festlegen.
2. Browserdienst: isoliertes Add-on mit persistentem Profil und authentifizierter GUI bauen. Tests A und F (Profil nach Neustart, unabhängiger Neustart) müssen auf der Zielumgebung bestehen, bevor die nächste Phase freigegeben wird. Autostart über HA, Browserressourcen zunächst mit einer aktiven Instanz begrenzen; belastbare RAM-/CPU-Grenzen an den gemessenen Hostwerten festmachen.
3. Hermes-Anbindung: authentifizierten Browser-MCP registrieren und eine lokale Testseite bedienen (Test B). Die Registrierung in Hermes braucht eine ausdrücklich abgestimmte Einrichtung durch den Nutzer; dieses Projekt schreibt keine Hermes-Konfigurationsdateien. Bestehende MCP-Einträge bleiben erhalten.
4. Übergabe: kontrollierte Rennen zwischen Agentaktion, Übernehmen, Zurückgeben und Verbindungsverlust testen. Manuell und durch Hermes denselben Tab verändern und Identität prüfen (Tests C und D). Erst dann Übernahme als funktionsfähig anzeigen.
5. UI: authentifizierte Liveansicht, Status und echte Aktionen für übernehmen/pausieren/fortsetzen/abbrechen integrieren. Nicht unterstützte Hermes-Laufsteuerungen nicht als funktionsfähige Buttons darstellen. Job und Browser besitzen getrennte Zustände.
6. Daten und Wiederholungen: SQLite-Messungen/Schrittjournal mit Dublettenschutz testen (Test E). Wiederholungen ausschließlich über vorhandene Hermes-Scheduler auslösen. Keine automatische TikTok-Überwachung oder Accountaktion ohne konkreten Auftrag einrichten. Anmeldungen/Captchas manuell, Veröffentlichungen/Accountänderungen nach den erforderlichen Freigaben.
7. Gesamtabnahme: Tests A–F, HTTPS-/HA-Ingress-Zugang, Mobilansicht, Backup/Restore, Token-/Origin-Prüfung, Profiltrennung und Ressourcenlast dokumentieren. Die ADA-inspirierte Toolanzeige allein gilt nicht als Abnahme der Browserintegration.

Aktuelle Grenze: Phase 1 ist lokal und anhand öffentlicher Statusendpunkte untersucht. Authentifizierte Serverdiagnose und Phase-2-Containertest stehen aus. Es wurde kein Browser auf HA installiert und kein Hermes-MCP registriert. Die UI-Erweiterung 0.1.4 ist unabhängig davon lokal getestet.

Quellen zur Architektur:
- Offizielle Hermes-Browser-Dokumentation am Image-Seed: https://raw.githubusercontent.com/NousResearch/hermes-agent/0e427d788d253630d38a3a51cd76849e73cd6925/website/docs/user-guide/features/browser.md
- Offizielle Hermes-MCP-Dokumentation am Image-Seed: https://raw.githubusercontent.com/NousResearch/hermes-agent/0e427d788d253630d38a3a51cd76849e73cd6925/website/docs/user-guide/features/mcp.md
- Hermes-API-Ereignisse: https://github.com/NousResearch/hermes-agent/blob/0e427d788d253630d38a3a51cd76849e73cd6925/gateway/platforms/api_server_runs.py
- LinuxServer Chromium/Selkies: https://docs.linuxserver.io/images/docker-chromium/
