# Routing a UN SOLO dominio, due backend.
#
#   https://<dominio>/                     -> pannello Flutter (nginx)
#   https://<dominio>/player_api.php       -> API Xtream
#   https://<dominio>/get.php              -> API Xtream
#   https://<dominio>/xmltv.php            -> API Xtream
#   https://<dominio>/logo.svg             -> API Xtream
#   https://<dominio>/health               -> API Xtream
#   https://<dominio>/movie/...            -> API Xtream
#   https://<dominio>/live/...             -> API Xtream
#   https://<dominio>/series/...           -> API Xtream
#
# In Nginx Proxy Manager si realizza cosi':
#   Proxy Host -> Details
#     Domain Names:      <dominio>
#     Scheme:            http
#     Forward Hostname:  jarvis_panel
#     Forward Port:      80
#   Proxy Host -> Custom Locations  (una riga per path)
#     location: /player_api.php   forward: streamhub_jarvis   port 8080
#     location: /get.php          forward: streamhub_jarvis   port 8080
#     location: /xmltv.php        forward: streamhub_jarvis   port 8080
#     location: /logo.svg         forward: streamhub_jarvis   port 8080
#     location: /health           forward: streamhub_jarvis   port 8080
#     location: /movie/           forward: streamhub_jarvis   port 8080
#     location: /live/            forward: streamhub_jarvis   port 8080
#     location: /series/          forward: streamhub_jarvis   port 8080
#
# Il pannello (build statico) chiama l'API sulla stessa origine, quindi non
# serve nessun CORS e nessun indirizzo da configurare.
#
# Questo file e' la documentazione del routing: qui non serve a nginx,
# che nel container del pannello serve solo i file statici.
