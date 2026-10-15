# Changelog

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
