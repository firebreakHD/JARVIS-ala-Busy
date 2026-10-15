# Übernahme auf diesem PC – 15.10.2026

## Verbindlicher Kontext

Die unveränderte Übergabe steht in UEBERGABE-2026-10-15.txt neben dieser Datei. Nutzer als Buddy ansprechen und technische Dinge einfach erklären.

Hermes bleibt der einzige KI-Agent. JARVIS übernimmt Oberfläche, Orchestrierung, lokale Audioverarbeitung und persistenten Speicher. Keine eigene kostenpflichtige OpenAI-API; keine zusätzlichen laufenden Kosten. WHBoard und CreOS bleiben streng schreibgeschützte Referenzprojekte. Commit und Push übernimmt der Nutzer mit GitHub Desktop.

## Tatsächlich geprüft

- Checkout: D:\11 GITHUB REP -----\JARVIS-ala-Busy
- Git-Remote: https://github.com/firebreakHD/JARVIS-ala-Busy.git
- HEAD beim Übernehmen: 4e1f012 (Prepare J.A.R.V.I.S. Home Assistant add-on).
- Vor eigenen Änderungen: nur der Ordner codex dateien/ unversioniert; keine Änderungen an versionierten Dateien.
- Vorhanden: Node-Server, HTML/CSS-Oberfläche, Streaming-Proxy zu Hermes, Sitzungsablage als JSON, Passwort-/Cookie-Anmeldung, Browser-TTS und Aufnahme mit Whisper.cpp-Anbindung. Das ist ein Codebefund, kein Nachweis einer funktionierenden Live-Verbindung.
- node --check für jarvis/server.mjs und jarvis/public/app.js erfolgreich mit Node v24.13.1.
- Keine lokalen Listener auf 8787, 8642 oder 8123 zum Prüfzeitpunkt. Das sagt nichts über Dienste auf dem Home-Assistant-PC aus.
- Unter jarvis/ kein lokales Datenverzeichnis und keine options.json gefunden. Umgebungsvariablen und entfernte HA-Konfiguration wurden nicht geprüft; keine Secrets ausgelesen.
- Getrennter Hermes-Checkout vorhanden. Seine config.yaml nennt Version 2.0.4 und API-Container-Port 8642. Eine laufende Installation wurde nicht verifiziert.

## Widersprüche und offene Punkte

- README.md und STATUS.md unter codex dateien/ behaupten einen neueren Funktionsstand. Diese Dateien sind Kontext, kein Implementierungsnachweis.
- JARVIS config.yaml enthält den Direktport 8787, aber keine Ingress-Konfiguration und keinen Seitenleisteneintrag. Das Frontend nutzt absolute /api/-Pfade; HA-Ingress braucht auch passende Pfadbehandlung.
- repository.yaml enthält noch REPLACE_WITH_OWNER/REPLACE_WITH_REPOSITORY, obwohl das echte Git-Remote bekannt ist.
- access_password ist im Add-on-Schema erforderlich, fehlt aber in options. Ohne Passwort bindet der Server standardmäßig nur an Loopback. HA-Konfiguration und Container-Erreichbarkeit sind als Nächstes zu prüfen.
- Kein MCP-Endpunkt, keine Connector-Implementierung und keine jarvis/INTEGRATIONS.md im aktuellen Checkout gefunden. Der Workflow prüft einfache Metadaten; MCP-Tests sind nicht vorhanden.
- Bisher ist Gesprächsspeicherung vorhanden, kein nachgewiesenes strukturiertes Brain mit Projekten/Aufgaben, Migration oder eigenem Backup-/Restore-Weg.
- TTS verwendet lokale Browser-/Betriebssystemstimmen, keinen enthaltenen Piper-Dienst. Whisper.cpp und Modell werden nicht mitgeliefert.
- Echte Hermes-Verbindung, Streaming mit Tools, Unterbrechung, Audio, iPhone-HTTPS und HA-Installation bleiben live zu prüfen. Die Oberfläche wurde noch nicht im Browser visuell geprüft.

## Reihenfolge für die Fortsetzung

1. Add-on-Metadaten und Startkonfiguration für HA-Ingress sowie konfigurierbaren Direktport korrigieren; beide Zugangswege prüfen.
2. Echte Hermes-Verbindung über vorhandene Konfiguration und tatsächlichen HA-DNS-Namen herstellen; keine Adresse raten.
3. Desktop-Chat, Streaming, TTS und Unterbrechung prüfen und vervollständigen.
4. Mobilen Voice Mode mit lokaler Spracherkennung und HTTPS prüfen.
5. Brain, Persistenz und nachgewiesene Integrationen umsetzen; Referenzprojekte ausschließlich lesen.

Diese Übernahme hat nur Kontextdateien ergänzt. Anwendungscode, Referenzprojekte, Commits und Push wurden nicht verändert.
