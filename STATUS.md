# Status

## Implementiert

- `0.1.4`: bedarfsabhängige Hermes-Toolanzeige nach ADA-Verhalten im bestehenden Chatlayout. Zehn lokale Tests bestehen, einschließlich HTTP-Streaming gegen einen isolierten Testserver. Desktop und 390-Pixel-Mobilansicht im Browser geprüft; der Live-Tooltest am HA-Gerät steht aus.

- Responsiver Desktop-Textchat mit Streaming, Unterbrechung und persistenten Sitzungen.
- Automatische lokale TTS-Ausgabe mit Ein/Aus, Lautstärke und Geräte-Stimmenwahl.
- Separater mobiler Voice Mode mit Mikrofonfreigabe nach Nutzerklick und lokaler Whisper.cpp-Transkription.
- Home-Assistant-Add-on-Metadaten, Dockerfile und `amd64`/`aarch64`-Architekturdeklaration.
- Persistent gespeicherte Add-on-Daten unter `/data`, Direktport `8787` mit Passwortschutz.
- Ab Version `0.1.1`: HA-Ingress auf internem Port `8099`, Seitenleisteneintrag und passende Frontend-Pfade. Lokal getesteter Code; Prüfung im installierten HA steht aus.
- GitHub Actions Workflow für Metadaten, JavaScript und automatisierte Zugriffstests.
- CSS-Vorschau funktioniert auch beim direkten Öffnen der HTML-Datei; für API und Chat muss der Server laufen.

## Noch offen

- Permanenter gemeinsamer Browser, abgesicherte manuelle Übernahme, Browserprofile und Browser-MCP sind noch nicht implementiert. Phase-1-Befunde und Umsetzungsschritte stehen in jarvis/DOCS.md. SSH/Terminalzugang und tatsächliche Serverressourcen sind noch ungeklärt; lokal ist der Docker-Daemon nicht erreichbar.

- `0.1.3` verbessert die Hermes-Verbindungsdiagnose und korrigiert die Wartezeit. Sechs lokale Tests bestehen; echte Hermes-Adresse und Konfiguration auf dem HA-Gerät sind noch nicht bekannt. Eine funktionierende Live-Verbindung ist nicht nachgewiesen.

- Repository-Adresse korrigiert. `0.1.2` behebt den anhand der Nutzerlogs erkannten Verlust der Container-Umgebung beim s6-Start. Diese Korrektur ist lokal; Commit/Push über GitHub Desktop und HA-Update stehen aus.
- Zugriffstests und Syntaxprüfungen bestehen lokal. Docker-Daemon ist auf diesem PC nicht erreichbar; Container-Build und echter HA-Ingress sind noch nicht verifiziert.
- Hermes und Whisper sind in dieser Arbeitsumgebung nicht konfiguriert; echte Verbindung, Tool-Abbruch, Mikrofon und Audio konnten nicht verifiziert werden.
- Mobile Spracherkennung benötigt eine lokal installierte Whisper.cpp-Binärdatei und ein Modell. iPhone-Mikrofonzugriff erfordert HTTPS.
- Hermes-Versionen ohne `run_stop` können bereits gestartete Server-Toolaktionen nicht zuverlässig abbrechen.
