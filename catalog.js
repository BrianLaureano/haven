/* ============================================================
   Haven — Coleção (filmes · livros · jogos)
   Busca em APIs públicas, salva em "meus", loga status/nota/estrelas.
   Livros: OpenLibrary (sem chave). Filmes: TMDB. Jogos: RAWG.
   Chaves (grátis) ficam no localStorage; livros funcionam sempre.
   ============================================================ */
(() => {
  'use strict';
  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  const TYPES = {
    movie: { label: 'Filmes', ph: 'Buscar filmes…', needs: 'tmdb',
      status: [['want','Quero ver'],['doing','Vendo'],['done','Visto']] },
    book:  { label: 'Livros', ph: 'Buscar livros…', needs: null,
      status: [['want','Quero ler'],['doing','Lendo'],['done','Lido']] },
    game:  { label: 'Jogos', ph: 'Buscar jogos…', needs: 'rawg',
      status: [['want','Quero jogar'],['doing','Jogando'],['done','Zerado']] }
  };

  // chaves DA PLATAFORMA (nós fornecemos; o usuário nunca conecta nada).
  // Hoje embutidas no cliente; migram pro proxy das Cloud Functions no Blaze.
  const PLATFORM = window.HAVEN_KEYS || {};

  /* ---------- storage ---------- */
  let col = { movie: [], book: [], game: [] };            // carregado pela fachada no ensure()
  const saveCol = () => { window.HavenDB?.setDoc('collection', col); };   // RTDB (ou local) via fachada

  /* ---------- sources ---------- */
  async function search(type, q){
    q = q.trim(); if (!q) return [];
    if (type === 'book') return searchBooks(q);
    if (type === 'movie') return searchMovies(q);
    return searchGames(q);
  }
  async function searchBooks(q){
    const u = `https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&limit=24&fields=key,title,author_name,first_publish_year,cover_i`;
    const j = await fetch(u).then(r => r.json());
    return (j.docs || []).filter(d => d.cover_i).map(d => ({
      id: `book:${d.key}`, title: d.title, sub: (d.author_name || [])[0] || '',
      year: d.first_publish_year || '', poster: `https://covers.openlibrary.org/b/id/${d.cover_i}-L.jpg`
    }));
  }
  async function searchMovies(q){
    const u = `https://api.themoviedb.org/3/search/movie?api_key=${PLATFORM.tmdb}&language=pt-BR&include_adult=false&query=${encodeURIComponent(q)}`;
    const j = await fetch(u).then(r => r.json());
    return (j.results || []).filter(m => m.poster_path).map(m => ({
      id: `movie:${m.id}`, title: m.title, sub: (m.release_date || '').slice(0, 4),
      year: (m.release_date || '').slice(0, 4), poster: `https://image.tmdb.org/t/p/w342${m.poster_path}`
    }));
  }
  async function searchGames(q){
    const u = `https://api.rawg.io/api/games?key=${PLATFORM.rawg}&search=${encodeURIComponent(q)}&page_size=24`;
    const j = await fetch(u).then(r => r.json());
    return (j.results || []).filter(g => g.background_image).map(g => ({
      id: `game:${g.id}`, title: g.name, sub: (g.released || '').slice(0, 4),
      year: (g.released || '').slice(0, 4), poster: g.background_image
    }));
  }

  /* ---------- els ---------- */
  const tabsEl = $('.ctabs'), searchEl = $('[data-csearch]'), clearEl = $('[data-csearch-clear]');
  const bodyEl = $('[data-cbody]');
  const sheet = $('[data-citem]');
  const elPoster = $('[data-citem-poster]'), elTitle = $('[data-citem-title]'), elSub = $('[data-citem-sub]');
  const elStars = $('[data-citem-stars]'), elStatus = $('[data-citem-status]'), elNote = $('[data-citem-note]');
  const btnDel = $('[data-citem-del]'), btnShare = $('[data-citem-share]'), btnSave = $('[data-citem-save]');

  let type = 'movie', current = null, results = null, started = false;
  const keyFor = t => TYPES[t].needs ? !!PLATFORM[TYPES[t].needs] : true;

  /* ---------- rendering ---------- */
  function posterHTML(url, title){
    return url
      ? `<img loading="lazy" alt="" src="${url}" onerror="this.style.opacity=0" />`
      : `<span class="poster__ph">${(title || '?')[0]}</span>`;
  }
  function itemCard(it, saved){
    const card = document.createElement('button');
    card.className = 'ccard'; card.type = 'button';
    const badge = saved
      ? `<span class="ccard__badge">${saved.rating ? '★'.repeat(saved.rating) : (TYPES[type].status.find(s => s[0] === saved.status)?.[1] || '')}</span>`
      : '';
    card.innerHTML = `<div class="ccard__art">${posterHTML(it.poster, it.title)}${badge}</div>
      <div class="ccard__t">${it.title}</div><div class="ccard__s">${it.sub || ''}</div>`;
    card.addEventListener('click', () => openItem(it, saved));
    return card;
  }

  // só aparece se a plataforma ainda não tem a chave desse tipo (setup pendente)
  function renderSoon(){
    bodyEl.innerHTML = `<div class="cempty"><b>${TYPES[type].label} chegando</b>
      <span>Livros já funcionam. Filmes e Jogos entram assim que ligarmos a busca.</span></div>`;
  }

  function renderCollection(){
    results = null;
    if (!keyFor(type)) return renderSoon();
    const list = col[type] || [];
    if (!list.length){
      bodyEl.innerHTML = `<div class="cempty"><b>Seus ${TYPES[type].label.toLowerCase()} aparecem aqui</b>
        <span>Busque acima e salve o que você curte.</span></div>`;
      return;
    }
    bodyEl.innerHTML = `<div class="crow"><span class="crow__label">Meus ${TYPES[type].label.toLowerCase()}</span><span class="crow__n">${list.length}</span></div>`;
    const grid = document.createElement('div'); grid.className = 'cgrid';
    [...list].sort((a, b) => b.addedAt - a.addedAt).forEach(it => grid.appendChild(itemCard(it, it)));
    bodyEl.appendChild(grid);
  }

  function renderResults(items){
    results = items;
    if (!items.length){ bodyEl.innerHTML = `<div class="cempty"><b>Nada encontrado</b><span>Tente outro termo.</span></div>`; return; }
    bodyEl.innerHTML = `<div class="crow"><span class="crow__label">Resultados</span></div>`;
    const grid = document.createElement('div'); grid.className = 'cgrid';
    const saved = col[type] || [];
    items.forEach(it => grid.appendChild(itemCard(it, saved.find(s => s.id === it.id))));
    bodyEl.appendChild(grid);
  }

  /* ---------- search ---------- */
  let seq = 0, timer = null;
  function runSearch(){
    const q = searchEl.value.trim();
    clearEl.hidden = !q;
    if (!q) return renderCollection();
    if (!keyFor(type)) return renderSoon();
    const my = ++seq;
    bodyEl.innerHTML = `<div class="cload">buscando…</div>`;
    search(type, q).then(items => { if (my === seq) renderResults(items); })
      .catch(() => { if (my === seq) bodyEl.innerHTML = `<div class="cempty"><b>Deu ruim na busca</b><span>Confira a conexão ou a chave.</span></div>`; });
  }
  searchEl.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(runSearch, 350); });
  clearEl.addEventListener('click', () => { searchEl.value = ''; clearEl.hidden = true; renderCollection(); searchEl.focus(); });

  /* ---------- tabs ---------- */
  $$('.ctab', tabsEl).forEach(b => b.addEventListener('click', () => {
    if (b.dataset.ctype === type) return;
    type = b.dataset.ctype;
    $$('.ctab', tabsEl).forEach(x => { const on = x === b; x.classList.toggle('is-on', on); x.setAttribute('aria-selected', on); });
    searchEl.placeholder = TYPES[type].ph;
    searchEl.value ? runSearch() : renderCollection();
  }));

  /* ---------- item sheet ---------- */
  function openItem(it, existing){
    current = existing ? { ...existing } : { ...it, status: 'want', rating: 0, note: '', type };
    elPoster.innerHTML = posterHTML(it.poster || existing?.poster, it.title || existing?.title);
    elTitle.textContent = current.title;
    elSub.textContent = current.sub || current.year || '';
    renderStatus(); renderStars();
    elNote.value = current.note || '';
    btnDel.hidden = !existing; btnShare.hidden = !existing;
    btnSave.textContent = existing ? 'Atualizar' : 'Salvar';
    sheet.hidden = false;
    requestAnimationFrame(() => sheet.classList.add('is-on'));
    setTimeout(() => sheet.classList.add('is-on'), 20);
  }
  function closeItem(){ sheet.classList.remove('is-on'); setTimeout(() => { sheet.hidden = true; current = null; }, 300); }

  function renderStatus(){
    elStatus.innerHTML = '';
    TYPES[current.type].status.forEach(([k, lbl]) => {
      const b = document.createElement('button');
      b.className = 'sbtn' + (current.status === k ? ' is-on' : ''); b.type = 'button'; b.textContent = lbl;
      b.addEventListener('click', () => { current.status = k; renderStatus(); });
      elStatus.appendChild(b);
    });
  }
  function renderStars(){
    elStars.innerHTML = '';
    for (let i = 1; i <= 5; i++){
      const s = document.createElement('button');
      s.className = 'star' + (i <= current.rating ? ' is-on' : ''); s.type = 'button'; s.textContent = '★';
      s.setAttribute('aria-label', `${i} estrela${i > 1 ? 's' : ''}`);
      s.addEventListener('click', () => { current.rating = (current.rating === i ? 0 : i); renderStars(); });
      elStars.appendChild(s);
    }
  }

  btnSave.addEventListener('click', () => {
    current.note = elNote.value.trim();
    current.addedAt = current.addedAt || Date.now();
    const arr = col[current.type] || (col[current.type] = []);
    const i = arr.findIndex(x => x.id === current.id);
    if (i >= 0) arr[i] = current; else arr.push(current);
    saveCol(); window.HavenPublish?.(); closeItem();
    if (type === current.type && !searchEl.value) renderCollection();
    else if (results) renderResults(results);
  });
  btnDel.addEventListener('click', () => {
    const arr = col[current.type] || [];
    col[current.type] = arr.filter(x => x.id !== current.id);
    saveCol(); window.HavenPublish?.(); closeItem();
    if (!searchEl.value) renderCollection(); else if (results) renderResults(results);
  });
  btnShare.addEventListener('click', () => {
    if (window.HavenShare?.openMedia) window.HavenShare.openMedia(current);
    else window.HavenFlash?.(btnShare);
  });
  $('[data-citem-close]').addEventListener('click', closeItem);

  /* ---------- init ---------- */
  async function ensure(){
    if (started) return; started = true;
    searchEl.placeholder = TYPES[type].ph;
    bodyEl.innerHTML = `<div class="cload">carregando…</div>`;
    try { await window.HavenDB?.ready; col = (await window.HavenDB?.getDoc('collection')) || col; } catch {}
    renderCollection();
    // recarrega quando o usuário logar/deslogar (troca de ambiente)
    window.HavenDB?.onUser(async () => {
      try { col = (await window.HavenDB.getDoc('collection')) || { movie: [], book: [], game: [] }; } catch {}
      if (!searchEl.value) renderCollection();
    });
  }
  (window.HavenApps = window.HavenApps || {}).catalog = { ensure };
  window.HavenCollection = { get: () => col };
})();
