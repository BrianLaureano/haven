/* ============================================================
   Haven — Coleção (filmes · livros · jogos + categorias suas)
   Built-in com busca em API; categorias custom (Academia, Faculdade,
   Hobbies, Meus cursos…) com itens manuais (imagem, nota, link/CTA).
   Cada categoria tem uma cor da paleta on-brand. Salva na fachada.
   ============================================================ */
(() => {
  'use strict';
  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = s => (s || '').replace(/[<>&"]/g, m => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[m]));

  const SVG = {
    movie: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="3"/><path d="M8 4v16M16 4v16M3 9h5M3 15h5M16 9h5M16 15h5"/></svg>`,
    book:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 6.6C10.4 5.4 7.9 5 4.5 5v13c3.4 0 5.9.4 7.5 1.6 1.6-1.2 4.1-1.6 7.5-1.6V5c-3.4 0-5.9.4-7.5 1.6Z"/><path d="M12 6.6V19"/></svg>`,
    game:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M7 10.5v3M5.5 12h3"/><circle cx="15.5" cy="11" r="1.05"/><circle cx="18" cy="13.5" r="1.05"/><path d="M8.5 7h6a5.5 5.5 0 0 1 5.4 6.5l-.3 1.6A2.6 2.6 0 0 1 14.7 15l-.5-.6a2 2 0 0 0-1.5-.7h-1.4a2 2 0 0 0-1.5.7l-.5.6a2.6 2.6 0 0 1-4.6-.9l-.3-1.6A5.5 5.5 0 0 1 8.5 7Z"/></svg>`,
    show:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2 2 2 0 0 0 0 4 2 2 0 0 1-2 2H5a2 2 0 0 1-2-2 2 2 0 0 0 0-4Z"/><path d="M15 6v12" stroke-dasharray="1.5 3"/></svg>`
  };
  const TYPES = {
    movie: { label: 'Filmes', emoji:'🎬', icon:SVG.movie, ph: 'Buscar filmes…', needs: 'tmdb',
      status: [['want','Quero ver'],['doing','Vendo'],['done','Visto']] },
    book:  { label: 'Livros', emoji:'📖', icon:SVG.book, ph: 'Buscar livros…', needs: null,
      status: [['want','Quero ler'],['doing','Lendo'],['done','Lido']] },
    game:  { label: 'Jogos', emoji:'🎮', icon:SVG.game, ph: 'Buscar jogos…', needs: 'rawg',
      status: [['want','Quero jogar'],['doing','Jogando'],['done','Zerado']] },
    show:  { label: 'Shows', emoji:'🎫', icon:SVG.show, ph: '', needs: null, manual: true }
  };
  // sugestões pra começar (empty state) — 1 toque busca e mostra pra salvar
  const SUGGEST = {
    movie: ['Interestelar', 'Parasita', 'Cidade de Deus'],
    book:  ['O Nome do Vento', 'Duna', '1984'],
    game:  ['Elden Ring', 'Hollow Knight', 'Hades']
  };
  const skelGrid = (n = 8) => `<div class="cgrid cgrid--skel">${Array.from({ length: n }).map(() => '<span class="cskel"></span>').join('')}</div>`;
  // paleta on-brand (fica bonita sobre o vidro escuro do Haven)
  const PALETTE = ['#e6a4c4','#8fb8e8','#8fd8b0','#c9a8f0','#f0b48a','#ecd58a','#7fb0a0','#e88a8a'];

  const PLATFORM = window.HAVEN_KEYS || {};
  const VISIT = new URLSearchParams(location.search).get('u');
  const isOwner = () => !VISIT && !!window.HavenDB?.user;

  /* ---------- storage ---------- */
  let col = { movie: [], book: [], game: [], show: [] };   // itens por chave (built-in + custom)
  let cats = [];                                  // categorias custom [{key,label,emoji,color}]
  function persist(){ col.$cats = cats; window.HavenDB?.setDoc('collection', col); window.HavenHome?.reload?.(); }

  const isCustom = k => !TYPES[k];
  const catDef = k => TYPES[k] ? { key:k, ...TYPES[k], builtin:true } : (cats.find(c => c.key === k) || null);
  const catColor = k => { const d = catDef(k); return (d && d.color) || 'var(--accent)'; };

  /* ---------- sources (só built-in tem busca) ---------- */
  async function search(type, q){
    q = q.trim(); if (!q) return [];
    if (type === 'book') return searchBooks(q);
    if (type === 'movie') return searchMovies(q);
    if (type === 'game') return searchGames(q);
    return [];
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
  const FN = () => (window.HAVEN_FUNCTIONS || '').replace(/\/+$/, '');
  async function searchGames(q){
    if (!FN()) return [];
    const j = await fetch(`${FN()}/igdbGames?q=${encodeURIComponent(q)}`)
      .then(r => (r.ok ? r.json() : { items: [] })).catch(() => ({ items: [] }));
    return j.items || [];
  }

  /* ---------- els ---------- */
  const tabsEl = $('[data-ctabs]'), csWrap = $('[data-csearch-wrap]');
  const searchEl = $('[data-csearch]'), clearEl = $('[data-csearch-clear]');
  const bodyEl = $('[data-cbody]');
  const sheet = $('[data-citem]');
  const elPoster = $('[data-citem-poster]'), elTitle = $('[data-citem-title]'), elTitleIn = $('[data-citem-title-input]');
  const elSub = $('[data-citem-sub]'), elStars = $('[data-citem-stars]'), elStatus = $('[data-citem-status]'), elNote = $('[data-citem-note]');
  const elManual = $('[data-citem-manual]'), elImg = $('[data-citem-img]'), elLink = $('[data-citem-link]');
  const elImgBtn = $('[data-citem-imgfile-btn]'), elImgFile = $('[data-citem-imgfile]');
  const btnDel = $('[data-citem-del]'), btnShare = $('[data-citem-share]'), btnSave = $('[data-citem-save]');

  let type = 'movie', current = null, results = null, started = false, manualMode = false, pendingPosterId = null;
  const keyFor = t => isCustom(t) ? true : (t === 'game' ? !!FN() : (TYPES[t].needs ? !!PLATFORM[TYPES[t].needs] : true));

  /* ---------- tabs ---------- */
  function renderTabs(){
    tabsEl.innerHTML = '';
    const mk = (key, label, iconHTML, color) => {
      const b = document.createElement('button');
      b.className = 'ctab' + (key === type ? ' is-on' : ''); b.type = 'button'; b.setAttribute('role','tab');
      b.dataset.ctype = key;
      b.setAttribute('aria-selected', key === type);
      if (color) b.style.setProperty('--cc', color);
      b.innerHTML = `${iconHTML || ''}${esc(label)}`;
      b.addEventListener('click', () => setType(key));
      tabsEl.appendChild(b);
    };
    ['movie','book','game','show'].forEach(k => mk(k, TYPES[k].label, `<span class="ctab__ic ctab__ic--svg">${TYPES[k].icon}</span>`, ''));
    cats.forEach(c => mk(c.key, c.label, c.emoji ? `<span class="ctab__ic">${c.emoji}</span>` : '', c.color));
    if (isOwner()){
      const add = document.createElement('button');
      add.className = 'ctab ctab--add'; add.type = 'button'; add.title = 'Nova categoria'; add.textContent = '+';
      add.addEventListener('click', () => openCatMaker());
      tabsEl.appendChild(add);
    }
  }
  function setType(key){
    if (key === type) return;
    type = key;
    renderTabs();
    csWrap.hidden = isCustom(type) || !!TYPES[type]?.manual;
    searchEl.value = ''; clearEl.hidden = true;
    if (!isCustom(type) && !TYPES[type]?.manual) searchEl.placeholder = TYPES[type].ph;
    renderCollection();
  }

  /* ---------- rendering ---------- */
  function posterHTML(url, title){
    return url
      ? `<img loading="lazy" alt="" src="${url}" onerror="this.style.opacity=0" />`
      : `<span class="poster__ph">${esc((title || '?')[0])}</span>`;
  }
  function itemCard(it, saved, color){
    const card = document.createElement('button');
    card.className = 'ccard'; card.type = 'button';
    if (color) card.style.setProperty('--cc', color);
    const r = saved && saved.rating;
    const stars = r ? `<span class="ccard__stars">${'★'.repeat(r)}<i>${'★'.repeat(5 - r)}</i></span>` : '';
    const scrim = r ? '<span class="ccard__scrim"></span>' : '';
    const lbl = (saved && !r) ? (catDef(saved.type)?.status?.find(s => s[0] === saved.status)?.[1] || (saved.link ? '↗' : '')) : '';
    const tag = lbl ? `<span class="ccard__tag">${esc(lbl)}</span>` : '';
    card.innerHTML = `<div class="ccard__art">${posterHTML(it.poster, it.title)}${scrim}${stars}${tag}<span class="ccard__go"><b>ver</b></span></div>
      <div class="ccard__t">${esc(it.title)}</div><div class="ccard__s">${esc(it.sub || '')}</div>`;
    card.addEventListener('click', () => openItem(it, saved));
    return card;
  }
  // destaque estilo revista (item mais bem avaliado com pôster)
  function cHero(list, color, kind){
    const cand = [...list].filter(x => x.poster).sort((a, b) => (b.rating || 0) - (a.rating || 0) || (b.addedAt || 0) - (a.addedAt || 0))[0];
    if (!cand) return null;
    const el = document.createElement('button'); el.className = 'chero'; el.type = 'button';
    if (color) el.style.setProperty('--cc', color);
    const r = cand.rating || 0;
    const stars = r ? `<span class="chero__stars">${'★'.repeat(r)}<i>${'★'.repeat(5 - r)}</i></span>` : '';
    el.innerHTML =
      `<span class="chero__bg" style="background-image:url('${cand.poster}')"></span><span class="chero__scrim"></span>` +
      `<div class="chero__in"><span class="chero__eyebrow">Em destaque · ${esc(kind)}</span>` +
      `<div class="chero__t">${esc(cand.title)}</div>` +
      `<div class="chero__meta">${stars}<span class="chero__go">ver</span></div></div>`;
    el.addEventListener('click', () => openItem(cand, cand));
    return el;
  }
  function addCard(){
    const b = document.createElement('button');
    b.className = 'ccard ccard--add'; b.type = 'button';
    b.style.setProperty('--cc', catColor(type));
    b.innerHTML = `<div class="ccard__art"><span class="ccard__plus">+</span></div><div class="ccard__t">adicionar</div>`;
    b.addEventListener('click', () => openNew(type));
    return b;
  }

  function renderSoon(){
    const lbl = TYPES[type].label.toLowerCase();
    bodyEl.innerHTML = `<div class="cempty"><b>${TYPES[type].label} chegando</b>
      <span>Estamos ligando a busca de ${lbl}. Filmes e livros já funcionam.</span></div>`;
  }

  function catHeader(){
    const d = catDef(type); if (!d) return '';
    const n = (col[type] || []).length;
    const edit = (isCustom(type) && isOwner())
      ? `<button class="crow__edit" data-cat-edit type="button" title="Editar categoria">
           <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L18 10l-4-4L4 16v4Z"/><path d="M13 7l4 4"/></svg></button>` : '';
    const cover = (isCustom(type) && d.cover) ? `<div class="ccover" style="background-image:url('${esc(d.cover)}')"><span class="ccover__em">${esc(d.emoji||'')}</span></div>` : '';
    return cover + `<div class="crow" style="--cc:${catColor(type)}">
      <span class="crow__label"><span class="crow__dot"></span>${esc(n ? d.label : 'Meus ' + d.label.toLowerCase())}</span>
      <span class="crow__n">${n || ''}</span>${edit}</div>`;
  }

  /* ============================================================
     SHOWS (hobby): "meus shows" (o que eu vou) + "próximos na cidade" (API)
     ============================================================ */
  const MESES = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
  function showDate(d){
    if (!d) return { label:'', rel:'', past:false, ts: 8e15 };
    const dt = new Date(d + 'T00:00:00'); if (isNaN(dt)) return { label:d, rel:'', past:false, ts: 8e15 };
    const today = new Date(); today.setHours(0,0,0,0);
    const days = Math.round((dt - today) / 86400000);
    const label = dt.getDate() + ' ' + MESES[dt.getMonth()] + (dt.getFullYear() !== today.getFullYear() ? ' ' + dt.getFullYear() : '');
    let rel = ''; if (days === 0) rel = 'hoje'; else if (days === 1) rel = 'amanhã'; else if (days > 1 && days <= 30) rel = 'em ' + days + ' dias'; else if (days < 0) rel = 'já rolou';
    return { label, rel, past: days < 0, ts: dt.getTime() };
  }
  const uidShow = () => 'show:' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  function showCard(it, editable){
    const dt = showDate(it.date);
    const el = document.createElement('button'); el.className = 'ccard scard' + (dt.past ? ' scard--past' : ''); el.type = 'button';
    el.innerHTML =
      `<span class="ccard__art scard__art">${posterHTML(it.poster, it.title)}<span class="scard__grad"></span>` +
        (dt.label ? `<span class="scard__date"><b>${esc(dt.label)}</b>${dt.rel ? `<i>${esc(dt.rel)}</i>` : ''}</span>` : '') + `</span>` +
      `<span class="ccard__t">${esc(it.title || 'Show')}</span>` +
      (it.local ? `<span class="ccard__s">${esc(it.local)}</span>` : '');
    el.addEventListener('click', () => { if (editable) openShow(it); else if (it.link) window.open(it.link, '_blank', 'noopener'); });
    return el;
  }
  function addShowCard(){
    const el = document.createElement('button'); el.className = 'ccard ccard--add'; el.type = 'button';
    el.innerHTML = `<span class="ccard__art" style="border-color:var(--accent)"><span class="poster__ph" style="font-size:40px">+</span></span><span class="ccard__t">Adicionar show</span>`;
    el.addEventListener('click', () => openShow(null));
    return el;
  }
  function renderShows(){
    const list = (col.show || []).slice().sort((a, b) => showDate(a.date).ts - showDate(b.date).ts);
    bodyEl.innerHTML = '';
    const head = document.createElement('div'); head.className = 'crow'; head.style.setProperty('--cc', 'var(--accent)');
    head.innerHTML = `<span class="crow__label"><span class="crow__dot"></span>Meus shows</span><span class="crow__n">${list.length || ''}</span>`;
    bodyEl.appendChild(head);
    if (!list.length && !isOwner()){
      bodyEl.insertAdjacentHTML('beforeend', `<div class="cempty cempty--rich"><span class="cempty__ico">${TYPES.show.icon}</span><b>Nenhum show ainda</b></div>`);
    } else {
      const grid = document.createElement('div'); grid.className = 'cgrid';
      if (isOwner()) grid.appendChild(addShowCard());
      list.forEach(it => grid.appendChild(showCard(it, isOwner())));
      bodyEl.appendChild(grid);
    }
    renderCityShows();
  }
  function cityName(){ return ($('[data-city]')?.textContent || 'São Paulo').trim() || 'São Paulo'; }
  async function renderCityShows(){
    const row = document.createElement('div'); row.className = 'crow'; row.style.setProperty('--cc', 'var(--accent)'); row.style.marginTop = '22px';
    row.innerHTML = `<span class="crow__label"><span class="crow__dot"></span>Próximos na sua cidade</span>`;
    bodyEl.appendChild(row);
    const host = document.createElement('div'); host.className = 'cgrid'; host.innerHTML = skelGrid(3); bodyEl.appendChild(host);
    let items = [];
    try {
      if (FN()){
        const j = await fetch(`${FN()}/cityShows?city=${encodeURIComponent(cityName())}`).then(r => r.ok ? r.json() : { items: [] }).catch(() => ({ items: [] }));
        items = j.items || [];
      }
    } catch (_) {}
    if (!items.length){
      host.outerHTML = `<div class="cempty cempty--rich"><span class="cempty__ico">${TYPES.show.icon}</span><b>Shows da sua cidade</b><span>${FN() ? 'nada por perto agora — volta depois ✨' : 'em breve: a agenda de shows perto de você'}</span></div>`;
      return;
    }
    host.innerHTML = '';
    items.slice(0, 12).forEach(it => host.appendChild(showCard({ title: it.title, date: it.date, local: it.venue || it.local, poster: it.poster, link: it.url }, false)));
  }
  function openShow(existing){
    const it = existing ? { ...existing } : { id: uidShow(), addedAt: Date.now(), type: 'show' };
    let posterId = it.posterId || null, posterUrl = it.poster || '';
    document.querySelector('.showform')?.remove();
    const el = document.createElement('div'); el.className = 'showform';
    el.innerHTML = `<div class="showform__scrim" data-x></div>
      <div class="showform__card glass">
        <button class="showform__x" data-x aria-label="Fechar">✕</button>
        <h3 class="showform__t">${existing ? 'Editar show' : 'Novo show'}</h3>
        <button class="showform__img" data-img type="button"><span data-imgprev></span></button>
        <input class="showform__in" data-name maxlength="80" placeholder="Artista / evento" />
        <div class="showform__row"><input class="showform__in" data-date type="date" /><input class="showform__in" data-local maxlength="60" placeholder="Local" /></div>
        <input class="showform__in" data-link placeholder="Link do ingresso (opcional)" inputmode="url" />
        <div class="showform__acts">${existing ? '<button class="btn btn--del" data-del type="button">excluir</button>' : ''}<button class="btn btn--go" data-save type="button">Salvar</button></div>
      </div>`;
    document.body.appendChild(el);
    const q = s => el.querySelector(s);
    q('[data-name]').value = it.title || ''; q('[data-date]').value = it.date || ''; q('[data-local]').value = it.local || ''; q('[data-link]').value = it.link || '';
    const paint = () => { q('[data-imgprev]').innerHTML = posterUrl ? `<img src="${esc(posterUrl)}" alt=""/>` : `<span class="showform__imgph">${TYPES.show.icon}<i>foto / cartaz</i></span>`; };
    paint();
    requestAnimationFrame(() => el.classList.add('is-on'));
    const close = () => { el.classList.remove('is-on'); setTimeout(() => el.remove(), 240); };
    el.querySelectorAll('[data-x]').forEach(b => b.addEventListener('click', close));
    q('[data-img]').addEventListener('click', () => {
      const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*';
      inp.onchange = async () => { const f = inp.files?.[0]; if (!f) return; try { const id = await window.HavenDB?.putPhoto?.(f); if (id){ posterId = id; posterUrl = (await window.HavenDB?.photoURL?.(id)) || posterUrl; paint(); } } catch (_) {} };
      inp.click();
    });
    q('[data-save]').addEventListener('click', () => {
      it.title = q('[data-name]').value.trim() || 'Show'; it.date = q('[data-date]').value;
      it.local = q('[data-local]').value.trim(); it.link = q('[data-link]').value.trim();
      it.poster = posterUrl; it.posterId = posterId; it.type = 'show';
      const arr = col.show || (col.show = []);
      const i = arr.findIndex(x => x.id === it.id); const isNew = i < 0;
      if (i >= 0) arr[i] = it; else arr.push(it);
      persist(); window.HavenPublish?.(); close(); renderShows();
      if (isNew) window.HavenFX?.reward({ label: `${it.title} — no seu rolê ✓` });
    });
    q('[data-del]')?.addEventListener('click', () => { col.show = (col.show || []).filter(x => x.id !== it.id); persist(); window.HavenPublish?.(); close(); renderShows(); });
  }

  function renderCollection(){
    results = null;
    if (type === 'show') return renderShows();
    if (!isCustom(type) && !keyFor(type)) return renderSoon();
    const list = col[type] || [];
    const color = catColor(type);
    if (!list.length){
      if (isCustom(type)){
        bodyEl.innerHTML = catHeader();
        const grid = document.createElement('div'); grid.className = 'cgrid';
        if (isOwner()) grid.appendChild(addCard());
        else bodyEl.insertAdjacentHTML('beforeend', `<div class="cempty"><b>nada aqui ainda</b></div>`);
        bodyEl.appendChild(grid);
      } else if (isOwner()) {
        const chips = (SUGGEST[type] || []).map(s => `<button class="cempty__chip" type="button">${s}</button>`).join('');
        bodyEl.innerHTML = `<div class="cempty cempty--rich">
          <span class="cempty__ico">${TYPES[type].icon}</span>
          <b>Comece sua coleção de ${TYPES[type].label.toLowerCase()}</b>
          <span>Busque acima e toque em ★ pra salvar. Que tal começar por:</span>
          <div class="cempty__chips">${chips}</div></div>`;
        $$('.cempty__chip', bodyEl).forEach(c => c.addEventListener('click', () => {
          searchEl.value = c.textContent; clearEl.hidden = false; searchEl.focus(); runSearch();
        }));
      } else {
        bodyEl.innerHTML = `<div class="cempty cempty--rich"><span class="cempty__ico">${TYPES[type].icon}</span><b>Nada por aqui ainda</b></div>`;
      }
      bindCatEdit(); return;
    }
    bodyEl.innerHTML = catHeader() || `<div class="crow"><span class="crow__label">Meus ${TYPES[type].label.toLowerCase()}</span><span class="crow__n">${list.length}</span></div>`;
    if (list.length >= 3){ const hero = cHero(list, color, (TYPES[type]?.label) || catDef(type)?.label || 'Hobbies'); if (hero) bodyEl.appendChild(hero); }
    const grid = document.createElement('div'); grid.className = 'cgrid';
    if (isCustom(type) && isOwner()) grid.appendChild(addCard());
    [...list].sort((a, b) => b.addedAt - a.addedAt).forEach(it => grid.appendChild(itemCard(it, it, color)));
    bodyEl.appendChild(grid);
    bindCatEdit();
  }
  function bindCatEdit(){ $('[data-cat-edit]', bodyEl)?.addEventListener('click', () => openCatMaker(type)); }

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
    bodyEl.innerHTML = skelGrid(6);
    search(type, q).then(items => { if (my === seq) renderResults(items); })
      .catch(() => { if (my === seq) bodyEl.innerHTML = `<div class="cempty"><b>Deu ruim na busca</b><span>Confira a conexão ou a chave.</span></div>`; });
  }
  searchEl.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(runSearch, 350); });
  clearEl.addEventListener('click', () => { searchEl.value = ''; clearEl.hidden = true; renderCollection(); searchEl.focus(); });

  /* ---------- item sheet ---------- */
  function setManual(on){
    manualMode = on;
    elManual.hidden = !on; elStatus.hidden = on; elSub.hidden = on;
    elTitle.hidden = on; elTitleIn.hidden = !on;
    elPoster.classList.toggle('citem__poster--edit', on);
  }
  function openNew(catKey){
    current = { id: 'custom:' + Date.now() + Math.round(Math.random()*1e4), type: catKey, custom:true,
      title:'', poster:'', posterId:null, link:'', status:'', rating:0, note:'' };
    pendingPosterId = null;
    setManual(true);
    elTitleIn.value = ''; elImg.value = ''; elLink.value = '';
    elPoster.innerHTML = posterHTML('', '');
    elStars.innerHTML = ''; renderStars(); elNote.value = '';
    btnDel.hidden = true; btnShare.hidden = true; btnSave.textContent = 'Salvar';
    openSheet();
  }
  function openItem(it, existing){
    const t = (existing || it).type || type;
    const custom = isCustom(t);
    if (custom && !isOwner() && (existing || it).link){ window.open((existing||it).link, '_blank', 'noopener'); return; }
    current = existing ? { ...existing } : { ...it, status: custom ? '' : 'want', rating: 0, note: '', type: t, custom };
    pendingPosterId = current.posterId || null;
    setManual(custom);
    if (custom){
      elTitleIn.value = current.title || '';
      elImg.value = (current.poster && !current.posterId) ? current.poster : '';
      elLink.value = current.link || '';
      elPoster.innerHTML = posterHTML(current.poster, current.title);
    } else {
      elPoster.innerHTML = posterHTML(it.poster || existing?.poster, it.title || existing?.title);
      elTitle.textContent = current.title;
      elSub.textContent = current.sub || current.year || '';
      renderStatus();
    }
    renderStars();
    elNote.value = current.note || '';
    btnDel.hidden = !existing; btnShare.hidden = !existing;
    btnSave.textContent = existing ? 'Atualizar' : 'Salvar';
    openSheet();
  }
  function openSheet(){
    sheet.hidden = false;
    requestAnimationFrame(() => sheet.classList.add('is-on'));
    setTimeout(() => sheet.classList.add('is-on'), 20);
  }
  function closeItem(){ sheet.classList.remove('is-on'); setTimeout(() => { sheet.hidden = true; current = null; }, 300); }

  function renderStatus(){
    elStatus.innerHTML = '';
    (catDef(current.type)?.status || []).forEach(([k, lbl]) => {
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

  // imagem manual: URL colada ou upload
  elImg?.addEventListener('input', () => {
    pendingPosterId = null;
    elPoster.innerHTML = posterHTML(elImg.value.trim(), elTitleIn.value);
  });
  elImgBtn?.addEventListener('click', () => elImgFile.click());
  elImgFile?.addEventListener('change', async () => {
    const f = elImgFile.files?.[0]; if (!f) return;
    try {
      const id = await window.HavenDB?.putPhoto?.(f);
      if (id){ pendingPosterId = id; elImg.value = '';
        const url = await window.HavenDB?.photoURL?.(id);
        elPoster.innerHTML = posterHTML(url, elTitleIn.value); }
    } catch { window.HavenFlash?.(elImgBtn); }
    elImgFile.value = '';
  });

  btnSave.addEventListener('click', async () => {
    current.note = elNote.value.trim();
    current.addedAt = current.addedAt || Date.now();
    if (manualMode){
      current.title = (elTitleIn.value || '').trim() || 'Sem título';
      current.link = (elLink.value || '').trim();
      if (pendingPosterId){ current.posterId = pendingPosterId; current.poster = await window.HavenDB?.photoURL?.(pendingPosterId) || current.poster; }
      else { current.poster = (elImg.value || '').trim(); current.posterId = null; }
    }
    const arr = col[current.type] || (col[current.type] = []);
    const i = arr.findIndex(x => x.id === current.id);
    const isNew = i < 0;
    if (i >= 0) arr[i] = current; else arr.push(current);
    persist(); window.HavenPublish?.(); closeItem();
    if (type === current.type && !searchEl.value) renderCollection();
    else if (results) renderResults(results);
    if (isNew) window.HavenFX?.reward({ label: `${current.title || 'Título'} — salvo ✓` });
  });
  btnDel.addEventListener('click', () => {
    const arr = col[current.type] || [];
    col[current.type] = arr.filter(x => x.id !== current.id);
    persist(); window.HavenPublish?.(); closeItem();
    if (!searchEl.value) renderCollection(); else if (results) renderResults(results);
  });
  btnShare.addEventListener('click', () => {
    if (window.HavenShare?.openMedia) window.HavenShare.openMedia(current);
    else window.HavenFlash?.(btnShare);
  });
  $('[data-citem-close]').addEventListener('click', closeItem);

  /* ---------- criador/editor de categoria ---------- */
  let cm = null;
  function openCatMaker(editKey){
    const editing = !!editKey && isCustom(editKey);
    const def = editing ? catDef(editKey) : { label:'', emoji:'⭐', color: PALETTE[0] };
    let pickColor = def.color || PALETTE[0], pickEmoji = def.emoji || '⭐';
    let pickCoverId = def.coverId || null, pickCoverUrl = def.cover || '';
    if (cm) cm.remove();
    cm = document.createElement('div'); cm.className = 'catmk';
    cm.innerHTML = `
      <div class="catmk__panel glass">
        <div class="catmk__top"><h3>${editing ? 'Editar categoria' : 'Nova categoria'}</h3>
          <button class="catmk__x" data-x aria-label="Fechar">✕</button></div>
        <div class="catmk__row">
          <button class="catmk__emoji" data-emoji type="button" aria-label="Emoji">${esc(pickEmoji)}</button>
          <input class="catmk__name" data-name placeholder="Nome (ex.: Academia, Faculdade, Meus cursos)" value="${esc(def.label)}" />
        </div>
        <span class="catmk__lbl">capa (opcional)</span>
        <button class="catmk__cover" data-cover type="button">
          <span class="catmk__coverprev" data-cover-prev${pickCoverUrl?` style="background-image:url('${esc(pickCoverUrl)}')"`:''}></span>
          <span data-cover-lbl>${pickCoverUrl?'trocar capa':'enviar foto de capa'}</span></button>
        <input type="file" accept="image/*" hidden data-cover-file />
        <span class="catmk__lbl">cor da categoria</span>
        <div class="catmk__colors" data-colors></div>
        <div class="catmk__actions">
          ${editing ? '<button class="btn btn--del" data-del>Excluir</button>' : ''}
          <button class="btn btn--go" data-save>${editing ? 'Salvar' : 'Criar'}</button>
        </div>
      </div>`;
    document.body.appendChild(cm);
    const coverFile = $('[data-cover-file]', cm), coverPrev = $('[data-cover-prev]', cm), coverLbl = $('[data-cover-lbl]', cm);
    $('[data-cover]', cm).addEventListener('click', () => coverFile.click());
    coverFile.addEventListener('change', async () => {
      const f = coverFile.files?.[0]; if (!f) return;
      try { const id = await window.HavenDB?.putPhoto?.(f); if (id){ pickCoverId = id; const u = await window.HavenDB?.photoURL?.(id); pickCoverUrl = u || ''; coverPrev.style.backgroundImage = u?`url('${u}')`:''; coverLbl.textContent = 'trocar capa'; } }
      catch { window.HavenFlash?.($('[data-cover]', cm)); }
      coverFile.value = '';
    });
    $('[data-emoji]', cm).addEventListener('click', () => { window.HavenEmoji?.pick?.(e => { pickEmoji = e; $('[data-emoji]', cm).textContent = e; }); });
    const colors = $('[data-colors]', cm);
    PALETTE.forEach(c => {
      const s = document.createElement('button'); s.type = 'button'; s.className = 'swatch' + (c === pickColor ? ' is-on' : '');
      s.style.background = c;
      s.addEventListener('click', () => { pickColor = c; $$('.swatch', colors).forEach(x => x.classList.toggle('is-on', x === s)); });
      colors.appendChild(s);
    });
    requestAnimationFrame(() => cm.classList.add('is-on'));
    const close = () => { cm.classList.remove('is-on'); setTimeout(() => { cm?.remove(); cm = null; }, 220); };
    cm.addEventListener('click', e => { if (e.target === cm) close(); });
    $('[data-x]', cm).addEventListener('click', close);
    $('[data-save]', cm).addEventListener('click', () => {
      const label = $('[data-name]', cm).value.trim(); if (!label) return $('[data-name]', cm).focus();
      const emoji = pickEmoji || '⭐';
      if (editing){ const d = cats.find(c => c.key === editKey); if (d){ d.label = label; d.emoji = emoji; d.color = pickColor; d.cover = pickCoverUrl; d.coverId = pickCoverId; } }
      else { const key = 'cat' + Date.now(); cats.push({ key, label, emoji, color: pickColor, cover: pickCoverUrl, coverId: pickCoverId }); type = key; }
      persist(); window.HavenPublish?.(); renderTabs(); csWrap.hidden = isCustom(type); renderCollection(); close();
    });
    $('[data-del]', cm)?.addEventListener('click', () => {
      if (!confirm(`Excluir a categoria "${def.label}" e seus itens?`)) return;
      cats = cats.filter(c => c.key !== editKey); delete col[editKey];
      type = 'movie'; persist(); window.HavenPublish?.(); renderTabs(); csWrap.hidden = false; renderCollection(); close();
    });
  }

  /* ---------- init ---------- */
  async function resolvePosters(){
    for (const c of cats){
      if (c.coverId){ try { const u = await window.HavenDB?.photoURL?.(c.coverId); if (u) c.cover = u; } catch {} }
      for (const it of (col[c.key] || [])){
        if (it.posterId){ try { const u = await window.HavenDB?.photoURL?.(it.posterId); if (u) it.poster = u; } catch {} }
      }
    }
  }
  async function load(){
    col = (await window.HavenDB?.getDoc('collection')) || { movie: [], book: [], game: [], show: [] };
    if (!Array.isArray(col.show)) col.show = [];
    cats = Array.isArray(col.$cats) ? col.$cats : [];
    await resolvePosters();
  }
  async function ensure(){
    if (started) return; started = true;
    bodyEl.innerHTML = skelGrid(8);
    try { await window.HavenDB?.ready; await load(); } catch {}
    renderTabs(); csWrap.hidden = isCustom(type);
    if (!isCustom(type)) searchEl.placeholder = TYPES[type].ph;
    renderCollection();
    window.HavenDB?.onUser(async () => {
      try { await load(); } catch {}
      renderTabs(); if (!searchEl.value) renderCollection();
    });
  }
  (window.HavenApps = window.HavenApps || {}).catalog = { ensure };
  window.HavenCollection = { get: () => col, cats: () => cats, palette: PALETTE };
})();
