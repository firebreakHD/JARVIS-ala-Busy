# Status

## Implementiert

- Responsiver Desktop-Textchat mit Streaming, Unterbrechung und persistenten Sitzungen.
- Automatische lokale TTS-Ausgabe mit Ein/Aus, Lautstärke und Geräte-Stimmenwahl.
- Separater mobiler Voice Mode mit Mikrofonfreigabe nach Nutzerklick und lokaler Whisper.cpp-Transkription.
- Home-Assistant-Add-on-Metadaten, Dockerfile und `amd64`/`aarch64`-Architekturdeklaration.
- Persistent gespeicherte Add-on-Daten unter `/data`, UI-Port `8787`, Passwortfeld für Netzwerkzugriff.
- GitHub Actions Workflow für grundlegende Metadatenprüfung.
- CSS-Vorschau funktioniert auch beim direkten Öffnen der HTML-Datei; für API und Chat muss der Server laufen.

## Noch offen

- GitHub-Repository-URL und Eigentümer fehlen. `repository.yaml` enthält noch den markierten Platzhalter und muss vor Installation über den Add-on-Store ersetzt werden.
- Es wurde nichts auf GitHub hochgeladen.
- Hermes und Whisper sind in dieser Arbeitsumgebung nicht konfiguriert; echte Verbindung, Tool-Abbruch, Mikrofon und Audio konnten nicht verifiziert werden.
- Mobile Spracherkennung benötigt eine lokal installierte Whisper.cpp-Binärdatei und ein Modell. iPhone-Mikrofonzugriff erfordert HTTPS.
- Hermes-Versionen ohne `run_stop` können bereits gestartete Server-Toolaktionen nicht zuverlässig abbrechen.
