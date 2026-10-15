# J.A.R.V.I.S. Home Assistant Add-on

Ein lokales Home-Assistant-Add-on für den vorhandenen Hermes-Agenten. Der Desktop startet im Textchat; lokale Browser-TTS ist standardmäßig aktiviert. Der optionale Mobile Voice Mode nutzt eine lokale Whisper.cpp-Installation.

## Inhalt

- `jarvis/`: Add-on mit Dockerfile und Webanwendung für `amd64` und `aarch64`.
- `repository.yaml`: Home-Assistant-Repository-Metadaten für `firebreakHD/JARVIS-ala-Busy`.
- `.github/workflows/validate-addon.yml`: einfache Prüfung der Metadaten bei Push und Pull Request.

## Installation in Home Assistant

Nach Veröffentlichung auf GitHub in Home Assistant unter **Einstellungen → Add-ons → Add-on-Store → ⋮ → Repositories** die GitHub-URL dieses Repositorys eintragen. Danach J.A.R.V.I.S. installieren und konfigurieren.

Erforderliche Konfiguration:

- `hermes_base_url`: Basisadresse des Hermes API Servers, ohne `/v1`.
- `hermes_api_key`: Bearer-Key für den geschützten Hermes API Server.
- `access_password`: Passwort zum Schutz des direkten Browserzugriffs im Netzwerk. In der HA-Seitenleiste übernimmt Home Assistant die Anmeldung.

Die Oberfläche öffnet über **Benutzeroberfläche öffnen** innerhalb von Home Assistant. Mit **In der Seitenleiste anzeigen** erscheint J.A.R.V.I.S. dauerhaft als eigener Eintrag. Zusätzlich ist dieselbe Anwendung unter `http://<HA-IP>:8787` erreichbar. Den Host-Port kannst du in den Add-on-Netzwerkeinstellungen ändern. Für den Direktzugriff zuerst `access_password` setzen; ohne Passwort zeigt dieser Zugang nur den Einrichtungshinweis und gibt keine Chatdaten frei. Gesprächsverläufe und Add-on-Optionen liegen im persistenten Home-Assistant-Verzeichnis `/data`.

## Sprache

Text-zu-Sprache läuft über die lokalen Stimmen des Browsers beziehungsweise Betriebssystems. Mikrofonzugriff ist im Desktop-Chat ausgeschaltet. Voice Mode muss ausdrücklich gestartet werden. Seine Spracherkennung braucht lokal installierte Binärdatei und Modell von Whisper.cpp sowie ffmpeg; diese Pfade können in der Add-on-Konfiguration gesetzt werden. Keine Sprachdaten werden an kostenpflichtige externe APIs gesendet.

## GitHub-Veröffentlichung

Das Repository ist `https://github.com/firebreakHD/JARVIS-ala-Busy`. Lokale Änderungen mit GitHub Desktop committen und pushen. Danach im HA-Add-on-Store nach Updates suchen und J.A.R.V.I.S. auf Version `0.1.3` aktualisieren. Falls das Update noch nicht erscheint, die Repository-Liste im Store aktualisieren. Auf der Add-on-Seite **In der Seitenleiste anzeigen** aktivieren.

Weitere technische Hinweise stehen in [jarvis/DOCS.md](jarvis/DOCS.md).
