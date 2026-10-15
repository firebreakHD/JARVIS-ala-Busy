# Status

## Implementiert

- Responsiver Desktop-Textchat mit Streaming, Unterbrechung und persistenten Sitzungen.
- Automatische lokale TTS-Ausgabe mit Ein/Aus, Lautstärke und Geräte-Stimmenwahl.
- Separater mobiler Voice Mode mit Mikrofonfreigabe nach Nutzerklick und lokaler Whisper.cpp-Transkription.
- Home-Assistant-Add-on-Metadaten, Dockerfile und `amd64`/`aarch64`-Architekturdeklaration.
- Home Assistant Ingress mit Seitenleisteneintrag plus direktem Zugriff über Port `8787`.
- Persistent gespeicherte Add-on-Daten unter `/data` und Passwortschutz für Netzwerkzugriff.
- Hermes-MCP-Endpunkt mit Token-Schutz, WH_Board- und CreOS-Connectoren, Bestätigung für Schreibzugriffe und Aktivitätsanzeige.
- GitHub Actions Workflow für Metadatenprüfung und lokale MCP-Tests.
- CSS-Vorschau funktioniert auch beim direkten Öffnen der HTML-Datei; für API und Chat muss der Server laufen.

## Noch offen

- WH_Board und CreOS waren lokal nicht erreichbar; ihre Live-Connectoren konnten nicht gegen die Dienste getestet werden.
- Hermes v0.20.1 wurde nicht mit dem laufenden J.A.R.V.I.S.-MCP-Endpunkt verbunden. Die Konfigurationsanleitung ist in `jarvis/INTEGRATIONS.md`.
- Die aktuellen Änderungen sind lokal und noch nicht auf GitHub veröffentlicht.
- Hermes und Whisper sind in dieser Arbeitsumgebung nicht konfiguriert; echte Verbindung, Tool-Abbruch, Mikrofon und Audio konnten nicht verifiziert werden.
- Mobile Spracherkennung benötigt eine lokal installierte Whisper.cpp-Binärdatei und ein Modell. iPhone-Mikrofonzugriff erfordert HTTPS.
- Hermes-Versionen ohne `run_stop` können bereits gestartete Server-Toolaktionen nicht zuverlässig abbrechen.
