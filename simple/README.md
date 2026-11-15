# Il connettore

Il **connettore Xtream Codes API** in versione compatta: tutto il protocollo in un
file singolo (`server.js`), senza dipendenze da installare e senza catalogo su
disco.

IBO Player, VLC, Kodi e gli altri client IPTV parlano tutti con le **Xtream
Codes API**: un endpoint HTTP che risponde con dei JSON. Questo file ne
implementa il protocollo abbastanza da far funzionare davvero un player.

Le locandine e le schede arrivano da **TMDb**; i flussi video sono clip di test
con audio.

---

## Avvio (2 passi)

### 1. Configurazione

```bash
cp ../../.env.example ../../.env
```

Apri `.env` e riempi:

```ini
XTREAM_USERNAME=mioUtente
XTREAM_PASSWORD=miaPasswordSegreta
```

Sono **esattamente** le credenziali che poi digiti in IBO Player Pro. Tutto il
resto ha valori di default sensati, e `.env` è in `.gitignore`: le tue
credenziali non finiscono mai nel repository.

Oppure, se vuoi che le generi io:

```bash
npm run init        # crea il .env con una password casuale e te la stampa
```

### 2. Avvio

```bash
npm start
```

```
StreamHub J.A.R.V.I.S. (node:http) su http://0.0.0.0:8080
```

Poi in **IBO Player Pro** → *Impostazioni → Playlist → Aggiungi playlist →
Xtream Codes API*:

| Campo | Valore |
|-------|--------|
| Server | `http://<ip-del-tuo-pc>:8080` (o `http://<mac>.local:8080`) |
| Username | `XTREAM_USERNAME` |
| Password | `XTREAM_PASSWORD` |

Serve solo Node (>= 18). Nessun `npm install`.

---

## Senza credenziali non parte

```
$ node simple/server.js
  XTREAM_USERNAME / XTREAM_PASSWORD mancanti.
  Copia il template e riempi le credenziali:
    cp .env.example .env
```

Meglio un errore chiaro che una porta aperta con password vuota. Nel browser
(editor statico, dove non esiste un ambiente) si usa `demo/demo` e viene detto
a schermo.

## L'indirizzo non deve cambiare

Il player salva l'indirizzo del server nella playlist. Se cambia, la playlist
non val più.

### L'IP, bloccato

Sull'hotspot del telefono l'indirizzo è in **lease DHCP** (1 ora) e può
cambiare. La TV, però, **non risolve i nomi `.local`** (mDNS non è supportato da
tutte le Smart TV): l'unico indirizzo affidabile è l'IP.

Quindi lo blocchiamo:

```bash
npm run staticip        # fissa l'indirizzo attuale (chiede la password)
```

Poi nella playlist della TV:

```
http://172.20.10.5:8080
```

e non la tocchi più. Per tornare al DHCP:

```bash
sudo networksetup -setdhcp "Wi-Fi"
```

### Il dominio pubblico (definitivo)

Un URL pubblico stabile non cambia mai e funziona anche fuori casa, su
qualsiasi rete.

**Se hai Tailscale installato** puoi averlo subito, senza dominio e senza
aprire porte:

```bash
npm run serve
```

Tailscale assegna al computer un nome stabile (`<computer>.<tailnet>.ts.net`)
con **certificato TLS valido**, e lo inoltra al tuo servizio locale. La prima
volta il comando ti stampa il link della console Tailscale da aprire per
abilitare la pubblicazione (è un clic).

Nella playlist della TV:

```
https://<computer>.<tailnet>.ts.net
```

e nel `.env` la stessa stringa in `LOCAL_URL`.

> Il tunnel "quick" (`npm run tunnel`) è l'alternativa più veloce da avviare,
> ma il suo URL **cambia a ogni riavvio**: per la TV non va bene.

Con un **dominio** proprio il discorso è lo stesso, ma l'URL è tuo:
`https://streamhub.tuodominio.it`.

### `LOCAL_URL`

Il server si presenta al player con **un solo indirizzo**. Il player lo usa per
costruire gli indirizzi dei contenuti, quindi deve combiaciare con quello
scritto nella playlist.

```ini
LOCAL_URL=https://mio-computer.tail1234.ts.net   # l'indirizzo di questa istanza
```

Se lo lasci vuoto, l'indirizzo viene dedotto da come il player chiama.

> Il progetto completo, che gira in Docker sul server, usa **`SERVER_URL`**
> per l'indirizzo di produzione. Ogni progetto legge la sua variabile: il
> connettore semplice `LOCAL_URL`, il progetto serio `SERVER_URL`.

### Le modalità di esecuzione

Il file rileva da solo l'ambiente in cui gira:

| Modalità | Quando | Cosa espone |
|----------|---------|-------------|
| **Node puro** | nessuna dipendenza (il caso normale) | server HTTP con `node:http` |
| **Express** | `USE_EXPRESS=1` e `express` installato | server HTTP su `PORT` |
| **Endpoint HTTP** | dentro un notebook che espone un endpoint (`exports.endpoint`) | endpoint HTTPS |
| **Browser** | nessun `require` (editor statico lato browser) | stampa in console i JSON che la TV riceve |

### Gli endpoint

> **Attenzione alla forma delle risposte.** Le liste di stream (`get_vod_streams`,
> `get_live_streams`, `get_series`) devono essere **array nudi**, come nel pannello
> Xtream originale. Solo la chiamata senza `action` (autenticazione) restituisce
> un oggetto con `user_info` e `server_info`. I client iOS rifiutano la forma
> avvolta `{user_info, server_info, data}`: rimangono in loop sul live e non
> caricano mai le sezioni VOD e Serie.

| Chiamata | Risposta |
|----------|----------|
| `player_api.php?username=..&password=..` | `user_info` (con `auth:1`, messaggio, logo) + `server_info` |
| `&action=get_vod_categories` | array categorie |
| `&action=get_vod_streams` | **array** film |
| `&action=get_vod_info&vod_id=1001` | `info` + `movie_data` |
| `&action=get_series_categories` | array categorie serie |
| `&action=get_series` | **array** serie (**con `series_id`**) |
| `&action=get_series_info&series_id=2001` | `{ seasons[], info{}, episodes{"1":[]} }` |
| `&action=get_live_categories` | array categorie live |
| `&action=get_live_streams` | **array** live |
| `get.php?username=..&password=..&stream=1001&extension=mp4` | il flusso (proxy o `302`) |
| `movie/{user}/{pass}/{id}.mp4` | path classico Xtream (con prefisso `movie`/`live`/`series`) |
| `/xmltv.php` | EPG in XMLTV (i client iOS lo scaricano per i live) |
| `/logo.svg` | il logo del servizio |
| `/health` | stato del servizio |

> **`series_id` non è un dettaglio**: senza quel campo il player non sa quale
> id usare per `get_series_info` e la griglia delle serie resta vuota. Lo
> abbiamo scoperto grazie alla TV vera, non ai test.

### Come viene consegnato il flusso

`PROXY_STREAMS=1` (default) → il server scarica il file e lo passa al player:
il player deve raggiungere **solo** noi, e nel log si vede cosa chiede.

`PROXY_STREAMS=0` → il server risponde `302` e il player va a prendere il file
direttamente dalla sorgente.

In modalità proxy, se l'origine non risponde (timeout, rete instabile, errore
5xx) il server **riprova** e poi **ripiega sulla redirect** verso la sorgente:
il player non si trova mai con una schermata nera per un problema di rete.

### Il server non si ferma da solo

Il servizio resta in ascolto finché non lo fermi tu con `Ctrl+C`. Gli errori
imprevisti vengono scritti nel log e il processo resta attivo:

```
  [errore non gestito] Error: ...
  Il servizio resta attivo.
```

---

## Dove può girare

Il terminale è il modo normale di usarlo:

```bash
npm start            # in primo piano
npm run start:bg     # in background, terminale libero
```

### Su un altro host (facoltativo)

Se serve un URL pubblico, il file funziona su qualunque host Node:

```bash
npm run copy         # il file negli appunti
```

Poi lo incolli dove ti serve (un VPS, un container, un notebook online) e avvii
`node server.js`.

> **Nota sul servizio notebook online**: al momento `runkit.com` e `runkit.io`
> rispondono **503** e hanno un **certificato TLS scaduto**, quindi un player
> li rifiuta. Il tunnel Cloudflare (`npm run tunnel`) è l'alternativa immediata
> che funziona: HTTPS pubblico, zero account.

## Comandi

| | |
|---|---|
| `npm run init` | crea il `.env` con una password generata |
| `npm start` | avvia il connettore |
| `npm run start:bg` / `npm run stop` | avvio in background, terminale libero |
| `npm run check` | i 31 controlli |
| `npm run logs` | cosa chiede il player, in tempo reale |
| `npm run tunnel` | URL pubblico HTTPS |
| `npm run hostname` | rinomina l'host in un nome `.local` stabile |
| `npm run copy` | il file negli appunti (per un altro host) |
| `npm run build:logo` | rigenera il logo inline dal file SVG |
