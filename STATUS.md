# Status

## Implementiert

- Responsiver Desktop-Textchat mit Streaming, Unterbrechung und persistenten Sitzungen.
- Automatische lokale TTS-Ausgabe mit Ein/Aus, Lautstärke und Geräte-Stimmenwahl.
- Separater mobiler Voice Mode mit Mikrofonfreigabe nach Nutzerklick und lokaler Whisper.cpp-Transkription.
- Home-Assistant-Add-on-Metadaten, Dockerfile und `amd64`/`aarch64`-Architekturdeklaration.
- Persistent gespeicherte Add-on-Daten unter `/data`, Direktport `8787` mit Passwortschutz.
- Ab Version `0.1.1`: HA-Ingress auf internem Port `8099`, Seitenleisteneintrag und passende Frontend-Pfade. Lokal getesteter Code; Prüfung im installierten HA steht aus.
- GitHub Actions Workflow für Metadaten, JavaScript und automatisierte Zugriffstests.
- CSS-Vorschau funktioniert auch beim direkten Öffnen der HTML-Datei; für API und Chat muss der Server laufen.

## Noch offen

- Repository-Adresse korrigiert. Änderungen an `0.1.1` sind lokal; Commit/Push über GitHub Desktop und HA-Update stehen aus.
- Zugriffstests und Syntaxprüfungen bestehen lokal. Docker-Daemon ist auf diesem PC nicht erreichbar; Container-Build und echter HA-Ingress sind noch nicht verifiziert.
- Hermes und Whisper sind in dieser Arbeitsumgebung nicht konfiguriert; echte Verbindung, Tool-Abbruch, Mikrofon und Audio konnten nicht verifiziert werden.
- Mobile Spracherkennung benötigt eine lokal installierte Whisper.cpp-Binärdatei und ein Modell. iPhone-Mikrofonzugriff erfordert HTTPS.
- Hermes-Versionen ohne `run_stop` können bereits gestartete Server-Toolaktionen nicht zuverlässig abbrechen.
