/* ============================================================
   Haven — Cloud Functions (proxy de APIs).
   Os SEGREDOS ficam aqui, no servidor, NUNCA no cliente.
   Spotify Web API via Client Credentials (nível-app): o usuário
   final NÃO conecta nada — a plataforma fornece o acesso.
   ============================================================ */
const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');

const SPOTIFY_ID     = defineSecret('SPOTIFY_CLIENT_ID');
const SPOTIFY_SECRET = defineSecret('SPOTIFY_CLIENT_SECRET');
// IGDB usa as credenciais da Twitch (Client Credentials)
const TWITCH_ID      = defineSecret('TWITCH_CLIENT_ID');
const TWITCH_SECRET  = defineSecret('TWITCH_CLIENT_SECRET');
// Last.fm (bio do artista) — API grátis: https://www.last.fm/api/account/create
const LASTFM_KEY     = defineSecret('LASTFM_API_KEY');

// token de app fica em memória (dura ~1h; renova sozinho)
let tokenCache = { value: null, exp: 0 };

async function appToken(id, secret){
  if (tokenCache.value && Date.now() < tokenCache.exp) return tokenCache.value;
  const basic = Buffer.from(`${id}:${secret}`).toString('base64');
  const r = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: 'grant_type=client_credentials'
  });
  if (!r.ok) throw new Error('spotify token ' + r.status);
  const j = await r.json();
  tokenCache = { value: j.access_token, exp: Date.now() + (j.expires_in - 60) * 1000 };
  return tokenCache.value;
}

const firstImg = (images) => (images && images[0] && images[0].url) || null;

/* GET /spotifyPlaylist?id=<playlistId>
   → { name, owner, image, url, tracks:[{name,artist,cover,preview,url}] } */
exports.spotifyPlaylist = onRequest(
  { secrets: [SPOTIFY_ID, SPOTIFY_SECRET], cors: true, region: 'us-central1' },
  async (req, res) => {
    try {
      const id = String(req.query.id || '').trim();
      if (!/^[A-Za-z0-9]+$/.test(id)) { res.status(400).json({ error: 'bad id' }); return; }

      const token = await appToken(SPOTIFY_ID.value(), SPOTIFY_SECRET.value());
      const auth = { headers: { Authorization: `Bearer ${token}` } };

      const fields = 'name,images,external_urls,owner(display_name),' +
        'tracks(items(track(name,preview_url,duration_ms,external_urls,artists(id,name),album(images))))';
      const pR = await fetch(
        `https://api.spotify.com/v1/playlists/${id}?fields=${encodeURIComponent(fields)}`, auth);
      if (!pR.ok) { res.status(pR.status).json({ error: 'spotify ' + pR.status }); return; }
      const p = await pR.json();

      const tracks = (p.tracks && p.tracks.items || [])
        .map(it => it.track).filter(Boolean)
        .map(t => ({
          name: t.name,
          artist: (t.artists || []).map(a => a.name).join(', '),
          artistId: (t.artists && t.artists[0] && t.artists[0].id) || null,
          cover: firstImg(t.album && t.album.images),
          preview: t.preview_url || null,
          dur: t.duration_ms || 0,
          url: (t.external_urls && t.external_urls.spotify) || null
        }));

      res.set('Cache-Control', 'public, max-age=1800'); // cache de 30 min na borda
      res.json({
        name: p.name || 'Playlist',
        owner: (p.owner && p.owner.display_name) || '',
        image: firstImg(p.images),
        url: (p.external_urls && p.external_urls.spotify) || null,
        tracks
      });
    } catch (e) {
      res.status(500).json({ error: String((e && e.message) || e) });
    }
  }
);

/* GET /spotifySearch?q=<termo>
   → { items:[{id,name,owner,image,tracks}] } — pra o dono escolher playlists. */
exports.spotifySearch = onRequest(
  { secrets: [SPOTIFY_ID, SPOTIFY_SECRET], cors: true, region: 'us-central1' },
  async (req, res) => {
    try {
      const q = String(req.query.q || '').trim();
      if (!q) { res.json({ items: [] }); return; }

      const token = await appToken(SPOTIFY_ID.value(), SPOTIFY_SECRET.value());
      const auth = { headers: { Authorization: `Bearer ${token}` } };

      const sR = await fetch(
        `https://api.spotify.com/v1/search?type=playlist&limit=12&q=${encodeURIComponent(q)}`, auth);
      if (!sR.ok) { res.status(sR.status).json({ error: 'spotify ' + sR.status }); return; }
      const j = await sR.json();

      const items = ((j.playlists && j.playlists.items) || [])
        .filter(Boolean)
        .map(p => ({
          id: p.id,
          name: p.name,
          owner: (p.owner && p.owner.display_name) || '',
          image: firstImg(p.images),
          tracks: (p.tracks && p.tracks.total) || 0
        }));

      res.set('Cache-Control', 'public, max-age=600');
      res.json({ items });
    } catch (e) {
      res.status(500).json({ error: String((e && e.message) || e) });
    }
  }
);

/* GET /artistInfo?id=<spotifyArtistId>
   → { id, name, image, genres, followers, popularity, bio, top:[tracks] }
   Junta: Spotify artist + top-tracks (= "mais do artista") + bio do Last.fm. */
const cleanBio = s => (s || '')
  .replace(/<a\b[^>]*>[\s\S]*?<\/a>/gi, '')   // tira o "Read more on Last.fm"
  .replace(/<[^>]+>/g, '')                     // tira qualquer HTML
  .replace(/\s+\n/g, '\n').trim();

exports.artistInfo = onRequest(
  { secrets: [SPOTIFY_ID, SPOTIFY_SECRET, LASTFM_KEY], cors: true, region: 'us-central1' },
  async (req, res) => {
    try {
      const id = String(req.query.id || '').trim();
      if (!/^[A-Za-z0-9]+$/.test(id)) { res.status(400).json({ error: 'bad id' }); return; }

      const token = await appToken(SPOTIFY_ID.value(), SPOTIFY_SECRET.value());
      const auth = { headers: { Authorization: `Bearer ${token}` } };
      const market = String(req.query.market || 'US').replace(/[^A-Za-z]/g, '').slice(0, 2) || 'US';

      // artista + top-tracks em paralelo
      const [aR, tR] = await Promise.all([
        fetch(`https://api.spotify.com/v1/artists/${id}`, auth),
        fetch(`https://api.spotify.com/v1/artists/${id}/top-tracks?market=${market}`, auth)
      ]);
      if (!aR.ok) { res.status(aR.status).json({ error: 'spotify ' + aR.status }); return; }
      const a = await aR.json();
      const tj = tR.ok ? await tR.json() : { tracks: [] };

      const top = (tj.tracks || []).slice(0, 8).map(t => ({
        name: t.name,
        artist: (t.artists || []).map(x => x.name).join(', '),
        artistId: (t.artists && t.artists[0] && t.artists[0].id) || id,
        cover: firstImg(t.album && t.album.images),
        preview: t.preview_url || null,
        dur: t.duration_ms || 0,
        url: (t.external_urls && t.external_urls.spotify) || null
      }));

      // bio (Last.fm por nome) — best-effort, nunca derruba a resposta
      let bio = '';
      try {
        const key = LASTFM_KEY.value();
        if (key && a.name) {
          const lR = await fetch('https://ws.audioscrobbler.com/2.0/?method=artist.getinfo' +
            `&artist=${encodeURIComponent(a.name)}&api_key=${key}&format=json&lang=pt`);
          if (lR.ok) {
            const lj = await lR.json();
            bio = cleanBio(lj && lj.artist && lj.artist.bio && lj.artist.bio.summary);
          }
        }
      } catch (_) { /* sem bio, tudo bem */ }

      res.set('Cache-Control', 'public, max-age=86400'); // 1 dia na borda
      res.json({
        id: a.id,
        name: a.name || '',
        image: firstImg(a.images),
        genres: a.genres || [],
        followers: (a.followers && a.followers.total) || 0,
        popularity: a.popularity || 0,
        bio,
        top
      });
    } catch (e) {
      res.status(500).json({ error: String((e && e.message) || e) });
    }
  }
);

/* ============================================================
   OG por usuário — link da bio abre com a CARA da pessoa.
   O site é estático (GitHub Pages), então o link compartilhado passa
   por esta função: robô (Insta/WhatsApp/Twitter) lê as meta tags e a
   imagem (capa/foto do perfil); humano é redirecionado pro app.
   Uso no cliente: {FN}/havenProfile?u=<uid>&to=<url-do-app-encoded>
   Perfis são leitura pública (Security Rules) → lê via REST, sem admin.
   ============================================================ */
const RTDB = 'https://haven-9a311-default-rtdb.firebaseio.com';
const escH = s => String(s || '').replace(/[<>&"']/g, m => ({ '<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#39;' }[m]));
const safeUrl = u => /^https:\/\//i.test(u || '') ? u : '';

exports.havenProfile = onRequest({ cors: true, region: 'us-central1' }, async (req, res) => {
  try {
    const uid = String(req.query.u || '').trim();
    const to = safeUrl(req.query.to) || 'https://haven.app';
    if (!/^[A-Za-z0-9_-]+$/.test(uid)) { res.redirect(302, to); return; }

    let p = null;
    try { const r = await fetch(`${RTDB}/profiles/${encodeURIComponent(uid)}.json`); if (r.ok) p = await r.json(); } catch {}
    const name = (p && p.name) || 'Haven';
    const first = String(name).split(' ')[0];
    const bio = (p && p.bio) || 'Entra pra me conhecer — som, filmes, livros, jogos e a minha cidade.';
    const img = safeUrl(p && (p.cover || p.photo)) || (to.replace(/\/[^/]*$/, '') + '/assets/scenes/dawn.webp');
    const title = `Haven de ${first}`;
    const url = `${to}`;

    res.set('Cache-Control', 'public, max-age=300');
    res.status(200).send(`<!doctype html><html lang="pt-BR"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escH(title)}</title>
<meta property="og:type" content="profile">
<meta property="og:title" content="${escH(title)}">
<meta property="og:description" content="${escH(bio)}">
<meta property="og:image" content="${escH(img)}">
<meta property="og:url" content="${escH(url)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escH(title)}">
<meta name="twitter:description" content="${escH(bio)}">
<meta name="twitter:image" content="${escH(img)}">
<meta http-equiv="refresh" content="0; url=${escH(url)}">
<link rel="canonical" href="${escH(url)}">
</head><body style="margin:0;background:#12161c;color:#f6f1e9;font-family:system-ui,sans-serif;display:grid;place-items:center;height:100vh">
<p>Abrindo o Haven de ${escH(first)}… <a style="color:#f4d9b8" href="${escH(url)}">entrar</a></p>
<script>location.replace(${JSON.stringify(url)});</script>
</body></html>`);
  } catch (e) { res.redirect(302, safeUrl(req.query.to) || 'https://haven.app'); }
});

/* ---------- IGDB (jogos) via Twitch Client Credentials ---------- */
let igdbCache = { value: null, exp: 0 };
async function twitchToken(id, secret){
  if (igdbCache.value && Date.now() < igdbCache.exp) return igdbCache.value;
  const r = await fetch(
    `https://id.twitch.tv/oauth2/token?client_id=${id}&client_secret=${secret}&grant_type=client_credentials`,
    { method: 'POST' });
  if (!r.ok) throw new Error('twitch token ' + r.status);
  const j = await r.json();
  igdbCache = { value: j.access_token, exp: Date.now() + (j.expires_in - 60) * 1000 };
  return igdbCache.value;
}

/* GET /igdbGames?q=<termo>
   → { items:[{id,title,sub,year,poster}] } — mesmo formato que a Coleção espera. */
exports.igdbGames = onRequest(
  { secrets: [TWITCH_ID, TWITCH_SECRET], cors: true, region: 'us-central1' },
  async (req, res) => {
    try {
      const q = String(req.query.q || '').trim();
      if (!q) { res.json({ items: [] }); return; }

      const token = await twitchToken(TWITCH_ID.value(), TWITCH_SECRET.value());
      // apicalypse: busca por relevância, só jogos com capa
      const body = `search "${q.replace(/["\\]/g, '')}"; ` +
        `fields name,cover.image_id,first_release_date; where cover != null; limit 24;`;
      const gR = await fetch('https://api.igdb.com/v4/games', {
        method: 'POST',
        headers: {
          'Client-ID': TWITCH_ID.value(),
          'Authorization': 'Bearer ' + token,
          'Accept': 'application/json'
        },
        body
      });
      if (!gR.ok) { res.status(gR.status).json({ error: 'igdb ' + gR.status }); return; }
      const games = await gR.json();

      const items = (games || [])
        .filter(g => g.cover && g.cover.image_id)
        .map(g => {
          const year = g.first_release_date
            ? new Date(g.first_release_date * 1000).getUTCFullYear().toString() : '';
          return {
            id: `game:${g.id}`,
            title: g.name,
            sub: year,
            year,
            poster: `https://images.igdb.com/igdb/image/upload/t_cover_big_2x/${g.cover.image_id}.jpg`
          };
        });

      res.set('Cache-Control', 'public, max-age=1800');
      res.json({ items });
    } catch (e) {
      res.status(500).json({ error: String((e && e.message) || e) });
    }
  }
);
