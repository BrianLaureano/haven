/* ============================================================
   Haven — cliente do proxy Spotify (Cloud Function).
   Sem chave e sem login no cliente: quem fala com o Spotify é a
   Function. Se o proxy não estiver configurado (HAVEN_SPOTIFY_PROXY
   vazio), HavenSpotify.ok() === false e a Música cai no embed.
   ------------------------------------------------------------
   DEV: se window.__HAVEN_MOCK existir (harness de teste / ?mock=1),
   as chamadas respondem do mock — pra desenhar a UI sem backend.
   ============================================================ */
(function () {
  const base = () => (window.HAVEN_FUNCTIONS || window.HAVEN_SPOTIFY_PROXY || '').replace(/\/+$/, '');
  const mock = () => window.__HAVEN_MOCK || null;
  const cache = new Map();

  async function playlist(id) {
    const m = mock(); if (m) return m.playlist ? m.playlist(id) : null;
    if (!base()) return null;
    if (cache.has(id)) return cache.get(id);
    const p = fetch(`${base()}/spotifyPlaylist?id=${encodeURIComponent(id)}`)
      .then(r => (r.ok ? r.json() : null))
      .catch(() => null);
    cache.set(id, p);
    const v = await p;
    if (!v) cache.delete(id); // deixa tentar de novo depois
    return v;
  }

  async function search(q) {
    q = (q || '').trim();
    const m = mock(); if (m) return m.search ? m.search(q) : [];
    if (!base() || !q) return [];
    return fetch(`${base()}/spotifySearch?q=${encodeURIComponent(q)}`)
      .then(r => (r.ok ? r.json() : { items: [] }))
      .then(j => j.items || [])
      .catch(() => []);
  }

  // info do artista (imagem, gêneros, seguidores, popularidade, bio Last.fm, top-tracks)
  const aCache = new Map();
  async function artist(id) {
    if (!id) return null;
    const m = mock(); if (m) return m.artist ? m.artist(id) : null;
    if (!base()) return null;
    if (aCache.has(id)) return aCache.get(id);
    const p = fetch(`${base()}/artistInfo?id=${encodeURIComponent(id)}`)
      .then(r => (r.ok ? r.json() : null))
      .catch(() => null);
    aCache.set(id, p);
    const v = await p;
    if (!v) aCache.delete(id);
    return v;
  }

  window.HavenSpotify = { ok: () => !!(base() || mock()), playlist, search, artist };
})();
