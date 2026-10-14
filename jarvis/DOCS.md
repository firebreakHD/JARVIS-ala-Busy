# J.A.R.V.I.S. Add-on

Die Weboberfläche verbindet sich mit einem bereits laufenden Hermes API Server. Hermes bleibt für Desktop und mobilen Voice Mode dieselbe Agenten- und Brain-Instanz.

## Einrichtung

In der Add-on-Konfiguration setzen:

- `hermes_base_url`: erreichbare Hermes-Adresse, ohne `/v1`.
- `hermes_api_key`: Bearer-Key des Hermes API Servers.
- `access_password`: eigenes Passwort für den Zugriff auf J.A.R.V.I.S. im Heimnetz.
- `whisper_cpp_path` und `whisper_model_path`: optional; für den mobilen Voice Mode erforderlich.

Das Add-on installiert ffmpeg im Container. Whisper.cpp und sein Modell werden nicht automatisch heruntergeladen. Stimmen für TTS kommen aus dem Browser oder Betriebssystem des jeweiligen Geräts.

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
