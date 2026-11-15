# Container del connettore (simple/server.js).
#
# Node puro: nessuna dipendenza da installare, l'immagine resta piccola.
FROM node:24-alpine

WORKDIR /app

# Il connettore e' un file solo: nessun npm install necessario.
COPY simple/server.js ./server.js
COPY package.json ./

ENV NODE_ENV=production
ENV PORT=8080
ENV TZ=Europe/Rome

EXPOSE 8080

# L'healthcheck gira dentro il container e usa il loopback: non deve
# dipendere dalla rete Docker ne' dal DNS. La porta la prende da $PORT.
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s \
  CMD wget -qO- http://127.0.0.1:${PORT:-8080}/health >/dev/null || exit 1

CMD ["node", "server.js"]
