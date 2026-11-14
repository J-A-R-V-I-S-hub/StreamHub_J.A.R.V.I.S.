# StreamHub J.A.R.V.I.S.

**Connettore Xtream Codes API.** Tu colleghi i contenuti e la TV: il progetto
traduce tutto in un protocollo che IBO Player, VLC e Kodi capiscono.

Oggi c'è un connettore funzionante, in un file solo, che gira dal terminale.
La documentazione completa è in **[`simple/README.md`](simple/README.md)**.

---

## Avvio rapido

```bash
cp .env.example .env      # 1. credenziali: XTREAM_USERNAME / XTREAM_PASSWORD
npm start                  # 2. via
```

Poi in IBO Player Pro → *Impostazioni → Playlist → Aggiungi playlist → Xtream
Codes API*: Server `http://<ip-del-tuo-pc>:8080`, con le credenziali del `.env`.

Nessuna dipendenza npm, serve solo Node (>= 18).

---

## Il modello

Il prodotto fa la parte difficile: **il protocollo**.

- parla Xtream Codes API, la lingua che i player IPTV capiscono
- tiene il catalogo (categorie, film, serie con stagioni ed episodi, live)
- fa da gateway per i flussi, con Range e seeking
- si collega a IBO Player Pro su una Smart TV e basta

Il contenuto e la TV li scegli tu: è la tua linea, la tua playlist, il tuo
player. Al connettore fa solo il protocollo.

## Le parti

| | Dove | Cosa trovi |
|---|------|-----------|
| **Il connettore** | `simple/` | il file unico, pronto all'uso. **Leggi [`simple/README.md`](simple/README.md)** |
| **Il pannello** | *in arrivo* | multi-linea: più utenti e playlist da un pannello |

## Dove va

| Oggi | Prossimo |
|------|----------|
| una linea, un catalogo | multi-linea: più utenti e playlist da un pannello |
| catalogo scritto nel file | catalogo su disco + import da fonti esterne |
| connettore in un file | connettore come servizio, con API di gestione |
| deploy con `node` | deploy in container, con dominio stabile |

## Comandi

| | |
|---|---|
| `npm run init` | crea il `.env` con una password generata |
| `npm start` | avvia il connettore |
| `npm run start:bg` / `npm run stop` | avvio in background, terminale libero |
| `npm run check` | verifica che tutto funzioni |
| `npm run logs` | cosa chiede il player, in tempo reale |
| `npm run staticip` | blocca l'IP, così la playlist della TV non va più toccata |
| `npm run tunnel` | URL pubblico HTTPS |
| `npm run copy` | il file negli appunti (per un altro host) |

## Struttura

```
simple/
  server.js           il connettore: un file solo
  README.md           la documentazione completa
scripts/              init, check, log, tunnel, logo, hostname
assets/               il logo
.env.example          template di configurazione
```
