# J.A.R.V.I.S. Home Assistant Add-on

Ein lokales Home-Assistant-Add-on für den vorhandenen Hermes-Agenten. Der Desktop startet im Textchat; lokale Browser-TTS ist standardmäßig aktiviert. Der optionale Mobile Voice Mode nutzt eine lokale Whisper.cpp-Installation.

## Inhalt

- `jarvis/`: Add-on mit Dockerfile und Webanwendung für `amd64` und `aarch64`.
- `repository.yaml`: Home-Assistant-Repository-Metadaten für [firebreakHD/JARVIS-ala-Busy](https://github.com/firebreakHD/JARVIS-ala-Busy).
- `.github/workflows/validate-addon.yml`: einfache Prüfung der Metadaten bei Push und Pull Request.

## Installation in Home Assistant

Nach Veröffentlichung auf GitHub in Home Assistant unter **Einstellungen → Add-ons → Add-on-Store → ⋮ → Repositories** die GitHub-URL dieses Repositorys eintragen. Danach J.A.R.V.I.S. installieren und konfigurieren.

Erforderliche Konfiguration:

- `hermes_base_url`: Basisadresse des Hermes API Servers, ohne `/v1`.
- `hermes_api_key`: Bearer-Key für den geschützten Hermes API Server.
- `access_password`: Passwort zum Schutz der J.A.R.V.I.S.-Oberfläche im Netzwerk.

Die Add-on-Oberfläche ist in der Home-Assistant-Seitenleiste verfügbar und zusätzlich über Port `8787` erreichbar. Die Portzuordnung lässt sich in den Add-on-Netzwerkeinstellungen ändern. Gesprächsverläufe und Add-on-Optionen liegen im persistenten Home-Assistant-Verzeichnis `/data`.

Hermes-Tools für WH_Board und CreOS werden in den Add-on-Optionen eingerichtet. Unterstützte Funktionen und API-Grenzen stehen in [jarvis/INTEGRATIONS.md](jarvis/INTEGRATIONS.md).

## Sprache

Text-zu-Sprache läuft über die lokalen Stimmen des Browsers beziehungsweise Betriebssystems. Mikrofonzugriff ist im Desktop-Chat ausgeschaltet. Voice Mode muss ausdrücklich gestartet werden. Seine Spracherkennung braucht lokal installierte Binärdatei und Modell von Whisper.cpp sowie ffmpeg; diese Pfade können in der Add-on-Konfiguration gesetzt werden. Keine Sprachdaten werden an kostenpflichtige externe APIs gesendet.

## GitHub-Veröffentlichung

Das konfigurierte Add-on-Repository ist `https://github.com/firebreakHD/JARVIS-ala-Busy`. Die GitHub-Actions-Prüfung validiert Metadaten und führt die lokalen MCP-Tests aus. Add-on-Versionen werden in `jarvis/config.yaml` gepflegt. Die Änderungen dieses Arbeitsstands sind lokal und noch nicht auf GitHub veröffentlicht.

Weitere technische Hinweise stehen in [jarvis/DOCS.md](jarvis/DOCS.md).
