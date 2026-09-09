# Haven

Um cantinho pessoal e instagramável pra colocar no link da bio — o seu perfil como um **feed** de quem você é: som/playlist, filmes, livros, jogos, memórias da sua cidade e mais. Cada pessoa monta o seu (widgets editáveis) e compartilha pela bio.

HTML/CSS/JS puro (sem build). Backend em **Firebase** (Auth + Realtime Database + Storage).

## Rodar local
```bash
python serve.py 5222
# abre http://localhost:5222   (?local=1 força modo local, sem login)
```

## Estrutura
- `index.html` — shell (cena/wallpaper + dock + views).
- `main.js` — relógio, clima (Open-Meteo), cenas por clima, roteador de apps.
- `home.js` — a Home = perfil em feed (widgets: playlist, filmes, livros, jogos, memórias, bio, @insta).
- `catalog.js` — Coleção (busca filmes/livros/jogos; TMDB/OpenLibrary/RAWG).
- `map.js` — Minha Cidade (Leaflet; estilos Constelação/Mapa/Aquarela).
- `share.js` — card 9:16 pro story.
- `wallpaper.js` — trocar o ambiente de fundo.
- `haven-db.js` — fachada de dados (local ↔ Firebase).
- `auth.js` — login (Google) + tela de entrada.
- `firebase-config.js` — config do projeto + chaves de plataforma.
- `database.rules.json` / `storage.rules` — regras de segurança.

## Config
Preencha `firebase-config.js` com o seu projeto Firebase e as chaves (TMDB/RAWG). No console: ative Google em Authentication, crie o Realtime Database e publique as regras.

### Música (player rico via Cloud Functions)
Com `window.HAVEN_FUNCTIONS` vazio, a Música usa o embed do Spotify. Ligando o proxy, ela vira o player rico (cover-flow + tocando agora + **sobre o artista** + mais do artista + próxima). Secrets (setar uma vez):
```bash
firebase functions:secrets:set SPOTIFY_CLIENT_ID
firebase functions:secrets:set SPOTIFY_CLIENT_SECRET
firebase functions:secrets:set LASTFM_API_KEY   # bio do artista — https://www.last.fm/api/account/create
firebase deploy --only functions
```
Depois cole a base das functions em `HAVEN_FUNCTIONS` (ex.: `https://us-central1-<projeto>.cloudfunctions.net`).
Endpoints: `spotifyPlaylist`, `spotifySearch`, `artistInfo`, `igdbGames`, `havenProfile` (OG por usuário — o link da bio abre com a cara da pessoa; o cliente usa `{FN}/havenProfile?u=<uid>&to=<app-url>` quando o proxy está ligado).
> Sem `LASTFM_API_KEY` tudo funciona — só a bio fica vazia (gêneros/seguidores/popularidade vêm do Spotify).
> DEV local sem backend: abra com `?mock=1` (usa `mock-music.js`, gitignored).

> Nota: hoje as chaves de API ficam no cliente (MVP). O próximo passo é movê-las pra Cloud Functions (proxy), pra o usuário nunca ver nenhuma chave.
