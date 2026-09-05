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

> Nota: hoje as chaves de API ficam no cliente (MVP). O próximo passo é movê-las pra Cloud Functions (proxy), pra o usuário nunca ver nenhuma chave.
