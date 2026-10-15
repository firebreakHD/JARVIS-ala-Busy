# Changelog

## 0.1.3 – 2026-10-15

- Hermes-Prüfung testet die geschützte API-Modellliste und unterscheidet fehlende Konfiguration, abgelehnte Schlüssel, falsche API-Adressen, DNS-Fehler, geschlossene Ports und Zeitüberschreitungen.
- Fehlerursache erscheint dauerhaft über dem Chat, statt nur einer allgemeinen Offline-Meldung.
- Browser wartet länger als die serverseitige Verbindungsprüfung. Optionale Fähigkeiten werden erst für eine Chat-Anfrage geprüft und verzögern den Verbindungsstatus nicht.
- Eingefügte Leerzeichen und ein abschließendes `/v1` werden in der Basisadresse bereinigt.

## 0.1.2 – 2026-10-15

- Container startet Node über `with-contenv`, damit s6-overlay die Docker-Umgebung an den Server weitergibt. Zuvor gingen `JARVIS_ADDON=true` und `DATA_DIR=/data` verloren: Der Server startete nur auf `127.0.0.1:8787`, las keine HA-Optionen und öffnete keinen Ingress-Port.
- GitHub Actions baut und startet zusätzlich den echten Add-on-Container und prüft Direktzugriff, Ingress-Listener und Datenpfad.

## 0.1.1 – 2026-10-15

- Home-Assistant-Ingress mit eigenem Seitenleisteneintrag und Streaming aktiviert.
- Separater interner HA-Zugang auf Port 8099; direkter Browserzugriff bleibt auf konfigurierbarem Host-Port, standardmäßig 8787.
- Container lauscht auf einer für HA und Portweiterleitung erreichbaren Adresse.
- CSS, JavaScript, Anmeldung, Chat und Voice berücksichtigen den Ingress-Unterpfad.
- HA-Zugang verwendet die Supervisor-Anmeldung; direkter Zugriff erfordert ein eigenes Passwort. Ohne Passwort erscheint ein Einrichtungshinweis und die direkte Daten-API bleibt gesperrt.
- Fehlenden Passwort-Standardwert und Repository-Adresse korrigiert.
- Automatisierte Zugriffstests und JavaScript-Prüfungen in GitHub Actions ergänzt.

## 0.1.0

- Erster Add-on-Stand mit Textchat, Hermes-Streaming, Browser-TTS und optionaler Whisper.cpp-Anbindung.
