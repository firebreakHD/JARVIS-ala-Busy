FROM ghcr.io/home-assistant/base:latest

RUN apk add --no-cache nodejs npm ffmpeg

WORKDIR /app
COPY package.json server.mjs web-access.mjs hermes-connection.mjs ./
COPY public ./public

ENV DATA_DIR=/data
ENV JARVIS_ADDON=true
EXPOSE 8787 8099

# s6-overlay v3 clears CMD's environment unless with-contenv restores it.
CMD ["/usr/bin/with-contenv", "node", "server.mjs"]
