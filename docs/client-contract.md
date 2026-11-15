# Contratto del client — osservato dal traffico reale

> Fatti ricavati dai log del backend il **15 novembre 2026**, con **IBO Player 3.0**
> collegato alla linea demo da una TV reale sulla stessa rete.
> Non è documentazione ufficiale del produttore: è ciò che il client **ha fatto davvero**.

---

## 1. Sequenza di primo collegamento

Nell'ordine esatto in cui sono arrivate le richieste:

| # | richiesta | esito |
|---|---|---|
| 1 | `GET /player_api.php?username&password` | 200 |
| 2 | `GET /player_api.php?username&password` | 200 (ripetuta) |
| 3 | `GET /player_api.php?username&password` | 200 (ripetuta) |
| 4 | `GET /player_api.php?...&action=get_vod_categories` | 200 |
| 5 | `GET /player_api.php?...&action=get_vod_streams` | 200 |
| 6 | `GET /player_api.php?...&action=get_vod_info&vod_id=1000` | 200 |
| 7 | `GET /movie/{user}/{pass}/1000.mp4` | 302 |
| 8 | `get_vod_info&vod_id=1001` → `/movie/.../1001.mp4` | 200 → 302 |
| 9 | `get_vod_info&vod_id=1002` → `/movie/.../1002.mp4` | 200 → 302 (×7) |
| 10 | `get_vod_info&vod_id=1003` → `/movie/.../1003.mp4` | 200 → 302 |
| 11 | `get_series_categories` | 200 |
| 12 | `get_series` | 200 |

### Cosa **non** ha mai chiamato

| endpoint | osservazione |
|---|---|
| `/xmltv.php` | **mai richiesto** all'apertura. L'EPG non è nel percorso critico |
| `/get.php` | **mai richiesto**: usa `player_api.php` + i path classici |
| `/logo.svg` | mai richiesto (il logo arriva dentro `user_info`) |

> Conseguenza pratica: `xmltv.php` va implementato, ma **non** è ciò che blocca il primo
> collegamento. Il percorso critico è: `player_api.php` → `get_vod_*` → `/movie/...`.

---

## 2. Quante volte chiama, e perché

| situazione | richieste al file |
|---|---|
| file **mp4 valido** | **1** |
| file **inesistente** (404 sull'origine) | 1, poi smette |
| container **sbagliato** (sorgente `.avi`, annunciata `.mp4`) | **7 ritentativi** |

**Regola che ne deriva**: `container_extension` deve combaciare con il file reale.
Annunciare `mp4` per un `.avi` non produce un errore chiaro: produce un **loop di retry**.
Il backend ora lo calcola dall'URL (`extFromUrl`), non lo assume.

`get_vod_info` viene chiamato **2–3 volte** per lo stesso film: è normale, non è un bug.

---

## 3. Forma delle risposte che ha accettato

| cosa | osservazione |
|---|---|
| `user_info` + `server_info` alla radice | accettata |
| liste come **array nudo** | accettata |
| `series_id` numerico | necessaria per `get_series_info` |
| `direct_source` presente | usato come ripiego |
| redirect **302** sul path classico | seguita correttamente |

---

## 3-bis. Il client è un **WebView**, non un'app nativa

Dallo User-Agent della TV (secondo test, 15 nov 23:2x):

```
Mozilla/5.0 (X11; Linux armv7l) AppleWebKit/537.36 (KHTML, like Gecko)
Chrome/111.0.0.0 Odin/111.5563.5.1 Safari/537.36
Model/VIDAA-<chipset> VIDAA/9.0(<vendor>;SmartTV;<model>;...)
```

> Modello e identificativi del dispositivo sono oscurati: non servono a capire il protocollo
> e questo file finisce nel repository pubblico.

| fatto | conseguenza |
|---|---|
| è un **Chromium 111 dentro una TV Hisense VIDAA 9.0** | il player è un `<video>` HTML5, non un decoder nativo |
| usa **Range** in modo aggressivo | chiede `bytes=0-1023`, poi `bytes=0-`, poi salta avanti |
| su un film da 310 MB ha chiesto `bytes=310076814-` | sta cercando l'atomo `moov` **in fondo al file** |
| supporta H.264/AAC in MP4 | AVI e MOV non li decodifica |

> **Conseguenza di prodotto**: se la sorgente **non supporta Range**, il film non parte —
> perché il player deve poter saltare alla fine del file prima di iniziare.
> È l'argomento decisivo a favore della **modalità proxy** (che `simple/server.js` già fa),
> come opzione per le sorgenti che non gestiscono le richieste parziali.

## 3-ter. Secondo test: i 4 film demo

| film | richieste | Range visti | esito |
|---|---|---|---|
| 1000 Big Buck Bunny | 4 | `0-1023`, `0-`, `12756195-` | ▶ riprodotto |
| 1001 Sintel | 4 | `0-`, `310076814-`, `16230-` | ▶ riprodotto |
| 1002 Elephants Dream | 2 | `0-` | ▶ riprodotto in sequenza |
| 1003 Sintel (trailer) | 4 | `0-`, `14582379-`, `61725-` | ▶ riprodotto |

Nessuna risposta ≥ 400 verso la TV. L'unico 404 della finestra era il pannello che
chiedeva il catalogo di una linea cancellata (vecchio UUID), non il player.

## 4. Note di rete

- Le richieste arrivano con `remoteAddress` = gateway Docker (`192.168.65.1`): dentro un
  container l'IP del client si perde. In produzione serve `trustProxy` + `X-Forwarded-For`
  di Nginx Proxy Manager per vedere l'IP vero della TV.
- Il client usa **HTTP in chiaro** senza problemi: `NSAllowsArbitraryLoads` (iOS) lo consente.

---

## 5. Cosa resta da osservare

| domanda | stato |
|---|---|
| sequenza di primo collegamento | ✅ risolta |
| header inviati (User-Agent, Range) | ⬜ non loggati: aggiungere `user-agent` e `range` all'access log |
| cosa fa su linee **live** | ⬜ serve una sorgente con canali live |
| EPG: quando lo chiede | ⬜ non lo chiede all'avvio; da vedere con un uso prolungato |
| serie: come impagina stagioni | ⬜ serve una linea con serie |
| comportamento su credenziali errate | ⬜ da provare |
