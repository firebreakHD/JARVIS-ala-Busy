FROM ghcr.io/home-assistant/base:latest

RUN apk add --no-cache nodejs npm ffmpeg

WORKDIR /app
COPY package.json server.mjs ./
COPY public ./public

ENV DATA_DIR=/data
EXPOSE 8787

CMD ["node", "server.mjs"]
