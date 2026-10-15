FROM ghcr.io/home-assistant/base:latest

RUN apk add --no-cache nodejs npm ffmpeg

WORKDIR /app
COPY package.json server.mjs web-access.mjs ./
COPY public ./public

ENV DATA_DIR=/data
ENV JARVIS_ADDON=true
EXPOSE 8787 8099

CMD ["node", "server.mjs"]
