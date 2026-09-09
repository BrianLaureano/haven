/* ============================================================
   Haven — Minha Cidade
   Mapa cinematográfico (MapLibre + CARTO dark, sem token) com
   memórias: selecionar um lugar, comentar e guardar fotos.
   Textos em localStorage · fotos em IndexedDB (downscaled).
   ============================================================ */
(() => {
  'use strict';
  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => (
    { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));

  const CITY = { name: 'São Paulo', lng: -46.6396, lat: -23.5735, zoom: 13 };
  // Esri "Dark Gray Canvas" — keyless (recolorido na paleta Haven via CSS)
  const ESRI = 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/';
  const TILE_BASE = ESRI + 'World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}';
  const TILE_REF  = ESRI + 'World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}';
  // Aquarela (Stadia/Stamen) — precisa de chave grátis
  const AQUA = 'https://tiles.stadiamaps.com/tiles/stamen_watercolor/{z}/{x}/{y}.jpg';
  const LS_STYLE = 'haven.mapstyle';
  let mapStyle = (() => { try { return localStorage.getItem(LS_STYLE) || 'constelacao'; } catch { return 'constelacao'; } })();
  const stadiaKey = () => (window.HAVEN_KEYS || {}).stadia || null;   // chave DA PLATAFORMA (aquarela)
  const ATTRIB = 'Tiles © <a href="https://www.esri.com">Esri</a>';
  const LS_KEY = 'haven.places.v1';

  const CATS = {
    cafe:   { label: 'café',    emoji: '☕', color: '#d8a35b' },
    comida: { label: 'comida',  emoji: '🍜', color: '#e07a5f' },
    vista:  { label: 'vista',   emoji: '🌇', color: '#7aa6d8' },
    role:   { label: 'rolê',    emoji: '🎧', color: '#b48bd8' },
    parque: { label: 'parque',  emoji: '🌳', color: '#7fb08a' },
    outro:  { label: 'outro',   emoji: '✨', color: '#c9c2b6' }
  };
  const CAT_KEYS = Object.keys(CATS);

  // lugares reais de São Paulo (coordenadas conferidas) — semeados no 1º uso
  const SEED = [
    { id:'seed-coffee',  name:'Coffee Lab',         cat:'cafe',   lng:-46.6899, lat:-23.5546, rating:5,
      note:'Referência de café de especialidade na Vila Madalena. Balcão, método e tempo parando.', photos:[] },
    { id:'seed-masp',    name:'MASP',               cat:'outro',  lng:-46.6558, lat:-23.5614, rating:5,
      note:'O vão livre e o acervo nos cavaletes de vidro da Lina Bo Bardi. Ícone da Paulista.', photos:[] },
    { id:'seed-beco',    name:'Beco do Batman',     cat:'role',   lng:-46.6912, lat:-23.5548, rating:4,
      note:'Grafite de ponta a ponta na Vila Madalena. Melhor no fim de tarde, sem multidão.', photos:[] },
    { id:'seed-ibira',   name:'Parque Ibirapuera',  cat:'parque', lng:-46.6576, lat:-23.5874, rating:5,
      note:'Tarde de domingo, o gramado inteiro nosso. Volto sempre que a cabeça pesa.', photos:[] },
    { id:'seed-mercado', name:'Mercado Municipal',  cat:'comida', lng:-46.6294, lat:-23.5416, rating:4,
      note:'O sanduíche de mortadela e o pastel de bacalhau. Vai com fome.', photos:[] },
    { id:'seed-mirante', name:'Mirante 9 de Julho', cat:'vista',  lng:-46.6403, lat:-23.5709, rating:4,
      note:'Café com a cidade toda embaixo e pôr do sol de graça.', photos:[] }
  ];

  // vibes do "rôle agora" (status ao vivo do lugar)
  const VIBES = {
    tranquilo:   { label: 'tranquilo',   emoji: '😌', color: '#7fb08a' },
    movimentado: { label: 'movimentado', emoji: '🙂', color: '#d8a35b' },
    lotado:      { label: 'lotado',      emoji: '🥵', color: '#e07a5f' },
    fila:        { label: 'fila',        emoji: '⏳', color: '#b48bd8' }
  };
  const ROLE_TTL = 3 * 3600 * 1000;     // rôle some depois de ~3h
  const GEOFENCE_M = 140;               // só posta a até 140m de um lugar salvo (anti-troll)
  const ACC_MAX = 120;                  // rejeita GPS impreciso (>120m) — não dá pra confirmar presença
  const REPOST_MS = 20 * 60 * 1000;     // 1 rôle por lugar a cada 20 min

  /* ---------- state ---------- */
  let map, started = false, placing = false, active = null;
  let mapMode = 'memorias';             // 'memorias' | 'role'
  let roles = [];                       // posts ao vivo (não expirados)
  const markers = new Map();            // id -> { marker }
  const roleMarkers = new Map();        // _k -> marker
  const objURLs = [];                   // revoke on sheet close
  let places = [];                      // carregado pela fachada no ensure()

  // fotos vêm da fachada (HavenDB): local = IndexedDB, Firebase = Storage
  const db = () => window.HavenDB;

  async function loadPlaces(){
    let raw = null;
    try { await db()?.ready; raw = await db()?.getDoc('places'); } catch {}
    if (!Array.isArray(raw)){ raw = SEED.map(p => ({ ...p })); await db()?.setDoc('places', raw); }
    raw.forEach(normalizePhotos);
    return raw;
  }
  // fotos viram [{id, ts}] agrupáveis por visita (migra formato antigo [id])
  function normalizePhotos(p){
    p.photos = (p.photos || []).map(ph =>
      typeof ph === 'string' ? { id: ph, ts: p.createdAt || Date.now() } : ph);
  }
  const save = () => { db()?.setDoc('places', places); };
  const uid = () => 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  /* ---------- datas / visitas ---------- */
  const MES = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
  const dayKey = ts => { const d = new Date(ts); return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; };
  function dayLabel(ts){
    const d = new Date(ts), n = new Date();
    const strip = x => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
    const diff = Math.round((strip(n) - strip(d)) / 86400000);
    if (diff === 0) return 'hoje';
    if (diff === 1) return 'ontem';
    const y = d.getFullYear() === n.getFullYear() ? '' : ` ${d.getFullYear()}`;
    return `${d.getDate()} ${MES[d.getMonth()]}${y}`;
  }
  // agrupa fotos por dia, visitas mais recentes primeiro
  function byVisit(photos){
    const groups = new Map();
    [...photos].sort((a, b) => b.ts - a.ts).forEach(ph => {
      const k = dayKey(ph.ts);
      if (!groups.has(k)) groups.set(k, { ts: ph.ts, shots: [] });
      groups.get(k).shots.push(ph);
    });
    return [...groups.values()];
  }

  // resolve a foto de capa de um lugar (1ª foto) → usada no pin e no guia
  async function resolveCover(place){
    const ph = (place.photos || [])[0];
    if (!ph){ place._cover = null; return null; }
    place._cover = ph.url || (await db()?.photoURL(ph.id)) || null;
    return place._cover;
  }
  async function resolveCovers(){ for (const p of places) await resolveCover(p); }

  /* ---------- markers (Leaflet divIcon) ---------- */
  function iconFor(place){
    const c = CATS[place.cat] || CATS.outro;
    const dot = place._cover
      ? `<span class="pin__dot pin__dot--photo" style="background-image:url('${place._cover}')"></span>`
      : `<span class="pin__dot"><span class="pin__emoji">${c.emoji}</span></span>`;
    return L.divIcon({
      className: 'pin',
      html: `${dot}<span class="pin__ring"></span>`,
      iconSize: [34, 34], iconAnchor: [17, 17]
    });
  }
  function addMarker(place){
    const marker = L.marker([place.lat, place.lng], { icon: iconFor(place), keyboard: false })
      .addTo(map).on('click', (e) => { L.DomEvent.stop(e); openSheet(place); });
    const el = marker.getElement();
    if (el) el.style.setProperty('--pin', (CATS[place.cat] || CATS.outro).color);
    markers.set(place.id, { marker });
  }
  function refreshMarker(place){
    const m = markers.get(place.id);
    if (!m) return addMarker(place);
    const c = CATS[place.cat] || CATS.outro;
    m.marker.setLatLng([place.lat, place.lng]);
    m.marker.setIcon(iconFor(place));
    const el = m.marker.getElement();
    if (el) el.style.setProperty('--pin', c.color);
  }
  function selectMarker(id){
    markers.forEach((m, k) => m.marker.getElement()?.classList.toggle('is-sel', k === id));
  }
  /* fly to a place, lifting it above the bottom sheet on mobile */
  function flySel(place){
    if (!map) return;
    const z = Math.max(map.getZoom(), 15);
    const p = map.project([place.lat, place.lng], z);
    const lift = (window.matchMedia('(min-width:820px)').matches) ? 0 : 150;
    const center = map.unproject(p.add([0, lift]), z);
    map.flyTo(center, z, { duration: 0.9 });
  }

  /* ---------- sheet ---------- */
  const sheet = $('[data-sheet]');
  const elCats = $('[data-sheet-cats]');
  const elName = $('[data-sheet-name]');
  const elNote = $('[data-sheet-note]');
  const elGallery = $('[data-sheet-gallery]');
  const elFile = $('[data-sheet-file]');
  const countEl = $('[data-map-count]');

  // build category chips once
  CAT_KEYS.forEach(k => {
    const c = CATS[k];
    const b = document.createElement('button');
    b.className = 'chip'; b.dataset.cat = k; b.type = 'button';
    b.style.setProperty('--chip', c.color);
    b.innerHTML = `<i>${c.emoji}</i>${c.label}`;
    b.addEventListener('click', () => setCat(k));
    elCats.appendChild(b);
  });
  function setCat(k){
    if (!active) return;
    active.cat = k;
    $$('.chip', elCats).forEach(ch => ch.classList.toggle('is-on', ch.dataset.cat === k));
  }

  // nota (estrelas) — clicar na mesma zera
  const elRate = $('[data-sheet-rate]');
  if (elRate){
    for (let i = 1; i <= 5; i++){
      const s = document.createElement('button');
      s.className = 'sheet__star'; s.type = 'button'; s.dataset.v = i; s.textContent = '★';
      s.setAttribute('aria-label', i + (i > 1 ? ' estrelas' : ' estrela'));
      s.addEventListener('click', () => setRate(i));
      elRate.appendChild(s);
    }
  }
  function setRate(v){
    if (!active) return;
    active.rating = (active.rating === v) ? 0 : v;
    paintStars();
  }
  function paintStars(){
    const r = active?.rating || 0;
    $$('.sheet__star', elRate).forEach(s => s.classList.toggle('is-on', +s.dataset.v <= r));
  }

  function openSheet(place){
    active = place;
    hideGuide();
    selectMarker(place.id);
    elName.value = place.name === 'Novo lugar' ? '' : place.name;
    elNote.value = place.note || '';
    $$('.chip', elCats).forEach(ch => ch.classList.toggle('is-on', ch.dataset.cat === place.cat));
    paintStars();
    renderGallery();
    sheet.hidden = false;
    requestAnimationFrame(() => sheet.classList.add('is-on'));
    setTimeout(() => sheet.classList.add('is-on'), 20); // fallback if rAF is throttled
    flySel(place);
    setTimeout(() => elName.focus({ preventScroll: true }), place._draft ? 320 : 9999);
  }
  function closeSheet(){
    // descarta rascunho não salvo
    if (active && active._draft){
      markers.get(active.id)?.marker.remove();
      markers.delete(active.id);
    }
    sheet.classList.remove('is-on');
    selectMarker(null);
    applyFilter();                 // re-sincroniza pins/guia/filtro após add/remove
    objURLs.splice(0).forEach(URL.revokeObjectURL);
    setTimeout(() => { sheet.hidden = true; active = null; }, 320);
  }

  function shotCell(ph){
    const cell = document.createElement('div');
    cell.className = 'shot';
    cell.innerHTML = `<button class="shot__del" aria-label="Remover foto">✕</button>`;
    const img = document.createElement('img'); img.alt = 'memória'; cell.prepend(img);
    db()?.photoURL(ph.id).then(u => { if (u) img.src = u; });
    img.addEventListener('click', () => lightbox(img.src));
    cell.querySelector('.shot__del').addEventListener('click', (e) => {
      e.stopPropagation();
      active.photos = active.photos.filter(x => x.id !== ph.id);
      db()?.delPhoto(ph.id); resolveCover(active).then(() => refreshMarker(active)); save(); renderGallery();
    });
    return cell;
  }

  async function renderGallery(){
    elGallery.innerHTML = '';
    const visits = byVisit(active?.photos || []);

    // botão de adicionar (fotos entram como a visita de hoje)
    const addRow = document.createElement('div');
    addRow.className = 'visit visit--new';
    addRow.innerHTML = `<button class="visit__add" type="button">
      <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>
      ${visits.length ? 'Nova visita' : 'Adicionar fotos'}</button>`;
    addRow.querySelector('.visit__add').addEventListener('click', () => elFile.click());
    elGallery.appendChild(addRow);

    // uma seção por visita (data)
    visits.forEach(v => {
      const block = document.createElement('div');
      block.className = 'visit';
      const head = document.createElement('button');
      head.className = 'visit__date'; head.type = 'button';
      head.innerHTML = `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M8 3v4M16 3v4M3 10h18"/></svg>
        <span>${dayLabel(v.ts)}</span><i>${v.shots.length}</i>`;
      head.title = 'Ajustar a data desta visita';
      head.addEventListener('click', () => editVisitDate(v));
      block.appendChild(head);
      const row = document.createElement('div');
      row.className = 'visit__shots';
      v.shots.forEach(ph => row.appendChild(shotCell(ph)));
      block.appendChild(row);
      elGallery.appendChild(block);
    });
  }

  // ajusta a data de uma visita inteira (corrige quando as fotos são de um dia passado)
  function editVisitDate(v){
    const d = new Date(v.ts);
    const cur = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    const val = window.prompt('Data desta visita (AAAA-MM-DD):', cur);
    if (!val) return;
    const nd = new Date(val + 'T12:00:00');
    if (isNaN(nd)) return;
    const oldKey = dayKey(v.ts), nts = nd.getTime();
    active.photos.forEach(ph => { if (dayKey(ph.ts) === oldKey) ph.ts = nts; });
    save(); renderGallery();
  }

  /* downscale a file to a jpeg dataURL (max 1400px, q .72) */
  function shrink(file){
    return new Promise((res) => {
      const img = new Image();
      img.onload = () => {
        const max = 1400, s = Math.min(1, max / Math.max(img.width, img.height));
        const cv = document.createElement('canvas');
        cv.width = Math.round(img.width * s); cv.height = Math.round(img.height * s);
        cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
        cv.toBlob(b => res(b || null), 'image/jpeg', 0.72);
        URL.revokeObjectURL(img.src);
      };
      img.onerror = () => res(null);
      img.src = URL.createObjectURL(file);
    });
  }
  elFile.addEventListener('change', async () => {
    if (!active) return;
    const files = [...elFile.files]; elFile.value = '';
    const ts = Date.now();                 // este lote = uma visita (mesmo instante)
    for (const f of files){
      if (!f.type.startsWith('image/')) continue;
      const blob = await shrink(f);
      if (!blob) continue;
      const { id } = await db().putPhoto(blob);      // local: IndexedDB · Firebase: Storage
      active.photos = active.photos || [];
      active.photos.push({ id, ts });
    }
    await resolveCover(active); refreshMarker(active);
    save(); renderGallery();
  });

  /* lightbox */
  const lb = $('[data-lightbox]'), lbImg = $('[data-lightbox-img]');
  function lightbox(src){ if (!src) return; lbImg.src = src; lb.hidden = false; requestAnimationFrame(() => lb.classList.add('is-on')); setTimeout(() => lb.classList.add('is-on'), 20); }
  $('[data-lightbox-close]').addEventListener('click', () => { lb.classList.remove('is-on'); setTimeout(() => { lb.hidden = true; lbImg.src = ''; }, 260); });
  lb.addEventListener('click', (e) => { if (e.target === lb) $('[data-lightbox-close]').click(); });

  /* save / delete */
  $('[data-sheet-save]').addEventListener('click', async () => {
    if (!active) return;
    active.name = (elName.value.trim() || 'Sem nome');
    active.note = elNote.value.trim();
    if (active._draft){ delete active._draft; places.push(active); }
    await resolveCover(active);
    save(); window.HavenPublish?.(); refreshMarker(active); updateCount(); refreshLines();
    closeSheet();
  });
  $('[data-sheet-del]').addEventListener('click', () => {
    if (!active) return;
    (active.photos || []).forEach(ph => db()?.delPhoto(ph.id));
    markers.get(active.id)?.marker.remove(); markers.delete(active.id);
    if (!active._draft){ places = places.filter(p => p.id !== active.id); save(); updateCount(); refreshLines(); }
    active._draft = false; // já removido do mapa; não re-descartar
    closeSheet();
  });
  $('[data-sheet-close]').addEventListener('click', closeSheet);

  /* add place — por busca (geocoding) OU tocando no mapa */
  const hint = $('[data-map-hint]');
  const qEl = $('[data-map-q]');
  const resEl = $('[data-map-results]');

  $('[data-map-add]').addEventListener('click', () => {
    if (mapMode === 'role'){ startRolePost(); return; }
    placing = true; hint.hidden = false; hideGuide();
    $('[data-map]').classList.add('is-placing');
    if (resEl){ resEl.hidden = true; resEl.innerHTML = ''; }
    if (qEl){ qEl.value = ''; setTimeout(() => qEl.focus(), 60); }
  });
  $('[data-map-cancel]').addEventListener('click', () => stopPlacing());
  function stopPlacing(){
    placing = false; hint.hidden = true;
    $('[data-map]').classList.remove('is-placing');
    if (qEl) qEl.value = '';
    if (resEl){ resEl.hidden = true; resEl.innerHTML = ''; }
    renderGuide();
  }

  /* ---------- busca de lugar (Nominatim/OSM, sem chave) ----------
     Política de uso do Nominatim: até ~1 req/s. O debounce + só buscar
     com 3+ letras mantém dentro do limite. Em produção, trocar por um
     geocoder com plano (Mapbox/Google) ou proxy próprio. */
  let geoT = 0, geoSeq = 0;
  async function geocode(q){
    const seq = ++geoSeq;
    const url = 'https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=6&accept-language=pt-BR&q=' + encodeURIComponent(q);
    let list = [];
    try { const r = await fetch(url, { headers: { Accept: 'application/json' } }); list = await r.json(); } catch {}
    if (seq !== geoSeq) return;                 // ignora resposta velha
    renderResults(Array.isArray(list) ? list : []);
  }
  function guessCat(r){
    const t = String(r.type || '');
    if (/cafe|coffee/.test(t)) return 'cafe';
    if (/restaurant|food|bakery|ice_cream|deli/.test(t)) return 'comida';
    if (/bar|pub|nightclub|cinema|theatre|arts_centre/.test(t)) return 'role';
    if (/park|garden|forest|nature|beach/.test(t)) return 'parque';
    if (/viewpoint|attraction|peak|tower/.test(t)) return 'vista';
    return 'outro';
  }
  function renderResults(list){
    if (!resEl) return;
    resEl.hidden = false; resEl.innerHTML = '';
    if (!list.length){
      resEl.innerHTML = '<div class="map__res--empty">Nada encontrado — tente outro nome ou toque no mapa.</div>';
      return;
    }
    list.forEach(r => {
      const lat = parseFloat(r.lat), lng = parseFloat(r.lon);
      const name = r.name || (r.display_name || '').split(',')[0] || 'Lugar';
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'map__res';
      b.innerHTML =
        '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-6-5.3-6-10a6 6 0 0 1 12 0c0 4.7-6 10-6 10Z"/><circle cx="12" cy="11" r="2"/></svg>' +
        `<span class="map__res-txt"><b>${esc(name)}</b><span>${esc(r.display_name || '')}</span></span>`;
      b.addEventListener('click', () => dropFromSearch(name, lat, lng, r));
      resEl.appendChild(b);
    });
  }
  function dropFromSearch(name, lat, lng, r){
    if (!isFinite(lat) || !isFinite(lng)) return;
    const draft = { id: uid(), name, cat: guessCat(r), lng, lat, note: '', photos: [], _draft: true };
    addMarker(draft);
    stopPlacing();
    map.flyTo([lat, lng], Math.max(map.getZoom(), 15), { duration: 0.9 });
    openSheet(draft);
  }
  qEl?.addEventListener('input', () => {
    const q = qEl.value.trim();
    clearTimeout(geoT);
    if (q.length < 3){ if (resEl){ resEl.hidden = true; resEl.innerHTML = ''; } return; }
    geoT = setTimeout(() => geocode(q), 380);
  });
  qEl?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter'){ e.preventDefault(); clearTimeout(geoT); const q = qEl.value.trim(); if (q.length >= 2) geocode(q); }
  });

  /* ---------- compartilhar cidade no story ---------- */
  $('[data-map-share]')?.addEventListener('click', () => {
    if (!places.length){ toast('Adicione um lugar primeiro ✨'); return; }
    window.HavenShare?.openCity?.({
      city: CITY.name,
      count: places.length,
      tiles: places.slice(0, 6).map(p => {
        const c = CATS[p.cat] || CATS.outro;
        return { cover: p._cover || null, emoji: c.emoji, color: c.color, name: p.name };
      })
    });
  });

  /* ---------- compartilhar UM lugar no story ---------- */
  $('[data-sheet-share]')?.addEventListener('click', async () => {
    if (!active) return;
    const c = CATS[active.cat] || CATS.outro;
    const urls = [];
    for (const ph of (active.photos || []).slice(0, 4)) urls.push(ph.url || (await db()?.photoURL(ph.id)));
    window.HavenShare?.openPlace?.({
      name: (active.name && active.name !== 'Novo lugar') ? active.name : 'Um lugar',
      label: c.label, emoji: c.emoji, color: c.color,
      rating: active.rating || 0,
      note: (elNote.value.trim() || active.note || ''),
      city: CITY.name,
      photos: urls.filter(Boolean)
    });
  });

  function updateCount(){
    if (mapMode === 'role'){
      const n = roles.length;
      countEl.textContent = n ? (n === 1 ? '1 rôle agora' : `${n} rôles agora`) : 'sem rôle agora';
    } else {
      const n = places.length;
      countEl.textContent = n === 1 ? '1 memória' : `${n} memórias`;
    }
  }

  /* ---------- filtro por categoria ---------- */
  const filterEl = $('[data-map-filter]');
  let filterCat = 'all';
  const matchFilter = (p) => filterCat === 'all' || p.cat === filterCat;
  function renderFilter(){
    if (!filterEl) return;
    const present = CAT_KEYS.filter(k => places.some(p => p.cat === k));
    if (present.length < 2){ filterEl.hidden = true; filterEl.innerHTML = ''; filterCat = 'all'; return; }
    if (filterCat !== 'all' && !present.includes(filterCat)) filterCat = 'all';
    filterEl.hidden = false; filterEl.innerHTML = '';
    const mk = (key, label, emoji, color) => {
      const b = document.createElement('button');
      b.className = 'map__fchip' + (filterCat === key ? ' is-on' : ''); b.type = 'button';
      if (color) b.style.setProperty('--fc', color);
      b.innerHTML = (emoji ? `<i>${emoji}</i>` : '') + esc(label);
      b.addEventListener('click', () => { filterCat = key; applyFilter(); });
      filterEl.appendChild(b);
    };
    mk('all', 'Tudo', '', null);
    present.forEach(k => mk(k, CATS[k].label, CATS[k].emoji, CATS[k].color));
  }
  function applyFilter(){
    renderFilter();
    places.forEach(p => {
      const m = markers.get(p.id); if (!m) return;
      if (matchFilter(p)) m.marker.addTo(map); else map.removeLayer(m.marker);
    });
    if (lineGroup){ if (filterCat === 'all') lineGroup.addTo(map); else map.removeLayer(lineGroup); }
    renderGuide();
  }

  /* ---------- guia da cidade (fileira de cards) ---------- */
  const guideEl = $('[data-map-guide]');
  function renderGuide(){
    if (!guideEl) return;
    if (mapMode === 'role') return renderRoleGuide();
    const list = places.filter(matchFilter);
    if (!list.length){ guideEl.hidden = true; guideEl.innerHTML = ''; return; }
    guideEl.hidden = false;
    guideEl.innerHTML = '';
    list.forEach(place => {
      const c = CATS[place.cat] || CATS.outro;
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'map__gcard' + (active && active.id === place.id ? ' is-sel' : '');
      card.style.setProperty('--gc', c.color);
      const cover = place._cover ? ` style="background-image:url('${place._cover}')"` : '';
      const stars = place.rating ? `<span class="map__gstars">${'★'.repeat(place.rating)}</span>` : '';
      card.innerHTML =
        `<div class="map__gcover"${cover}>` +
          (place._cover ? '' : `<span class="map__gemoji">${c.emoji}</span>`) +
          `<span class="map__gtag">${c.emoji}</span></div>` +
        `<div class="map__gbody"><b>${esc(place.name)}</b><span>${esc(c.label)}</span>${stars}</div>`;
      card.addEventListener('click', () => { flySel(place); openSheet(place); });
      guideEl.appendChild(card);
    });
  }
  function hideGuide(){ if (guideEl) guideEl.hidden = true; }

  /* ============================================================
     RÔLE AGORA — camada ao vivo (foto de como o lugar está agora)
     Alcance: público da cidade · trava: GPS + expira ~3h.
     Nó compartilhado via HavenDB.pushShared/listShared('role').
     ============================================================ */
  const hiddenRoles = () => { try { return new Set(JSON.parse(localStorage.getItem('haven.role.hidden') || '[]')); } catch { return new Set(); } };
  function timeAgo(ts){
    const s = Math.max(0, (Date.now() - (ts || 0)) / 1000);
    if (s < 60) return 'agora';
    const m = Math.floor(s / 60); if (m < 60) return `há ${m} min`;
    const h = Math.floor(m / 60); return `há ${h} h`;
  }
  function haversine(la1, lo1, la2, lo2){
    const R = 6371000, t = x => x * Math.PI / 180;
    const dLa = t(la2 - la1), dLo = t(lo2 - lo1);
    const h = Math.sin(dLa / 2) ** 2 + Math.cos(t(la1)) * Math.cos(t(la2)) * Math.sin(dLo / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  }
  async function loadRoles(){
    let all = []; try { all = await db()?.listShared('role') || []; } catch {}
    const now = Date.now(), hid = hiddenRoles();
    all.filter(r => now - (r.ts || 0) >= ROLE_TTL).forEach(r => db()?.removeShared('role', r._k));  // limpa expirados
    const live = all.filter(r => now - (r.ts || 0) < ROLE_TTL && !hid.has(r._k));
    for (const r of live){
      r._cover = (r.photoUrl && !r.photoUrl.startsWith('blob:')) ? r.photoUrl : null;   // URL durável (Storage/demo)
      if (!r._cover && r.photoId && db()){ try { r._cover = await db().publicPhotoURL(r.photoId); } catch {} }  // fallback local
    }
    roles = live.sort((a, b) => b.ts - a.ts);
  }
  function roleIcon(r, v){
    const cover = r._cover ? `background-image:url('${r._cover}')` : '';
    return L.divIcon({ className: 'pin pin--role',
      html: `<span class="pin__dot pin__dot--photo" style="${cover}"></span><span class="pin__ring"></span><span class="pin__time">${timeAgo(r.ts)}</span>`,
      iconSize: [34, 34], iconAnchor: [17, 17] });
  }
  function clearRoleMarkers(){ roleMarkers.forEach(m => map.removeLayer(m)); roleMarkers.clear(); }
  function renderRoleMarkers(){
    clearRoleMarkers();
    roles.forEach(r => {
      const v = VIBES[r.vibe] || VIBES.tranquilo;
      const marker = L.marker([r.lat, r.lng], { icon: roleIcon(r, v), keyboard: false })
        .addTo(map).on('click', (e) => { L.DomEvent.stop(e); openRoleView(r); });
      const el = marker.getElement(); if (el) el.style.setProperty('--pin', v.color);
      roleMarkers.set(r._k, marker);
    });
  }
  function roleGuideCard(r){
    const v = VIBES[r.vibe] || VIBES.tranquilo;
    const card = document.createElement('button'); card.type = 'button';
    card.className = 'map__gcard'; card.style.setProperty('--gc', v.color);
    const cover = r._cover ? ` style="background-image:url('${r._cover}')"` : '';
    const dt = distText(r.lat, r.lng);
    const conf = r.confirms ? `<span class="map__gconf">👍 ${r.confirms}</span>` : '';
    card.innerHTML =
      `<div class="map__gcover"${cover}><span class="map__glive">AO VIVO</span>` +
        (r._cover ? '' : `<span class="map__gemoji">📍</span>`) +
        `<span class="map__gtag">${v.emoji}</span></div>` +
      `<div class="map__gbody"><b>${esc(r.placeName || 'Um lugar')}</b>` +
        `<span class="map__gwhen"><b>${v.emoji} ${esc(v.label)}</b> · ${timeAgo(r.ts)}${dt ? ` · ${dt}` : ''}${conf}</span></div>`;
    card.addEventListener('click', () => { flySel({ lat: r.lat, lng: r.lng }); openRoleView(r); });
    return card;
  }
  function renderRoleGuide(){
    if (!guideEl) return;
    if (!roles.length){
      guideEl.hidden = true; guideEl.innerHTML = '';
      setEmpty(`<b>Nenhum rôle agora 🌙</b><span>Seja o primeiro: toque em <b>Postar rôle</b> quando estiver num lugar.</span>`);
      return;
    }
    setEmpty(null);
    guideEl.hidden = false; guideEl.innerHTML = '';
    roles.forEach(r => guideEl.appendChild(roleGuideCard(r)));
  }
  function setEmpty(msg){
    let el = $('[data-map-empty]');
    if (!msg){ if (el) el.remove(); return; }
    if (!el){ el = document.createElement('div'); el.className = 'map__empty glass'; el.setAttribute('data-map-empty', ''); $('[data-map]').appendChild(el); }
    el.innerHTML = msg;
  }
  let toastT;
  function toast(msg){
    let el = $('[data-map-toast]');
    if (!el){ el = document.createElement('div'); el.className = 'map__toast glass'; el.setAttribute('data-map-toast', ''); $('[data-map]').appendChild(el); }
    el.textContent = msg; el.classList.add('is-on');
    clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('is-on'), 2600);
  }

  /* ----- alternar Memórias ⇄ Rôle agora ----- */
  async function setMode(mode){
    if (mode === mapMode) return;
    mapMode = mode;
    $('[data-map]').classList.toggle('map--role', mode === 'role');
    $$('[data-map-mode] button').forEach(b => b.classList.toggle('is-on', b.dataset.mode === mode));
    const lbl = $('[data-add-lbl]'); if (lbl) lbl.textContent = mode === 'role' ? 'Postar rôle' : 'Novo lugar';
    if (mode === 'role'){
      markers.forEach(m => map.removeLayer(m.marker));       // esconde memórias
      if (lineGroup) map.removeLayer(lineGroup);
      if (filterEl) filterEl.hidden = true;
      await loadRoles(); renderRoleMarkers(); updateCount(); renderGuide();
      ensureMyPos();                                          // distância "perto de você" (best-effort)
    } else {
      clearRoleMarkers(); setEmpty(null);
      applyFilter();                                         // re-mostra memórias + filtro + guia
      if (mapStyle === 'constelacao' && lineGroup) lineGroup.addTo(map);
      updateCount();
    }
  }

  /* ----- postar um rôle (GPS + foto + vibe) ----- */
  const composeEl = $('[data-role-compose]');
  const vibesEl = $('[data-role-vibes]');
  const roleFile = $('[data-role-file]');
  const roleShot = $('[data-role-pic]');
  let compose = null;

  if (vibesEl){
    Object.keys(VIBES).forEach(k => {
      const v = VIBES[k];
      const b = document.createElement('button');
      b.className = 'role-vibe'; b.type = 'button'; b.dataset.vibe = k; b.style.setProperty('--vb', v.color);
      b.innerHTML = `<i>${v.emoji}</i>${v.label}`;
      b.addEventListener('click', () => {
        if (compose) compose.vibe = k;
        $$('.role-vibe', vibesEl).forEach(x => x.classList.toggle('is-on', x.dataset.vibe === k));
        updatePublish();
      });
      vibesEl.appendChild(b);
    });
  }
  let myPos = null;   // localização aproximada (mostrar distância no browse)
  function getPos(opts){
    return new Promise(res => {
      if (!navigator.geolocation) return res(null);
      navigator.geolocation.getCurrentPosition(
        p => res({ lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy }),
        () => res(null), opts || { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 });
    });
  }
  async function ensureMyPos(){                        // best-effort, não bloqueia o browse
    const p = await getPos({ enableHighAccuracy: true, timeout: 8000, maximumAge: 300000 });
    if (p && mapMode === 'role'){ myPos = p; renderRoleMarkers(); renderGuide(); }
  }
  function nearestPlace(lat, lng, maxM){
    let best = null, bd = Infinity;
    places.forEach(p => { const d = haversine(lat, lng, p.lat, p.lng); if (d < bd){ bd = d; best = p; } });
    return (best && bd <= maxM) ? { place: best, dist: bd } : null;
  }
  function distText(lat, lng){
    if (!myPos) return '';
    const d = haversine(myPos.lat, myPos.lng, lat, lng);
    return d < 1000 ? `a ${Math.round(d / 10) * 10} m` : `a ${(d / 1000).toFixed(1)} km`;
  }
  // rate-limit local (o servidor valida de verdade depois)
  const myPosts = () => { try { return JSON.parse(localStorage.getItem('haven.role.mine') || '{}'); } catch { return {}; } };
  function markPosted(id){ const m = myPosts(); m[id] = Date.now(); try { localStorage.setItem('haven.role.mine', JSON.stringify(m)); } catch {} }
  const recentlyPosted = (id) => { const t = myPosts()[id]; return t && (Date.now() - t) < REPOST_MS; };

  function updatePublish(){
    const ok = compose && compose.vibe && compose.photoId;   // lugar já vem travado pelo GPS
    const btn = $('[data-role-publish]'); if (btn) btn.disabled = !ok;
  }
  async function startRolePost(){
    toast('confirmando que você está no local…');
    const pos = await getPos();
    if (!pos){ toast('ative a localização pra postar um rôle'); return; }
    if (pos.acc != null && pos.acc > ACC_MAX){ toast('sinal de GPS fraco — chegue mais perto e tente de novo'); return; }
    myPos = pos;
    const near = nearestPlace(pos.lat, pos.lng, GEOFENCE_M);
    if (!near){ toast('você só posta um rôle estando NO lugar — salve o lugar e chegue mais perto'); return; }
    if (recentlyPosted(near.place.id)){ toast('você já postou aqui agora há pouco 🙂'); return; }
    const pl = near.place;
    compose = { placeId: pl.id, name: pl.name, cat: pl.cat || 'outro', lat: pl.lat, lng: pl.lng,
      myLat: pos.lat, myLng: pos.lng, acc: Math.round(pos.acc || 0), vibe: null, photoId: null, photoUrl: null };
    $('[data-role-place]').textContent = pl.name;
    $('[data-role-where]').textContent = `✓ você está aqui · precisão ~${Math.round(pos.acc || 0)}m`;
    $$('.role-vibe', vibesEl).forEach(x => x.classList.remove('is-on'));
    roleShot.classList.remove('has-photo'); roleShot.style.backgroundImage = '';
    $('[data-role-shot-lbl]').textContent = 'foto de agora';
    updatePublish();
    composeEl.hidden = false;
    requestAnimationFrame(() => composeEl.classList.add('is-on'));
    setTimeout(() => composeEl.classList.add('is-on'), 20);
  }
  function closeCompose(){ composeEl.classList.remove('is-on'); setTimeout(() => { composeEl.hidden = true; }, 300); }
  roleShot?.addEventListener('click', () => roleFile.click());
  roleFile?.addEventListener('change', async () => {
    const f = roleFile.files && roleFile.files[0]; roleFile.value = '';
    if (!f || !f.type.startsWith('image/') || !compose) return;
    const blob = await shrink(f);
    const { id, url } = await db().putPublicPhoto(blob || f);
    compose.photoId = id; compose.photoUrl = url;
    roleShot.classList.add('has-photo'); roleShot.style.backgroundImage = `url('${url}')`;
    updatePublish();
  });
  $('[data-role-cancel]')?.addEventListener('click', closeCompose);
  $('[data-role-publish]')?.addEventListener('click', async () => {
    if (!compose || !compose.vibe || !compose.photoId) return;
    const me = db()?.user;
    const post = {
      placeId: compose.placeId, placeName: compose.name, cat: compose.cat || 'outro',
      lat: compose.lat, lng: compose.lng, vibe: compose.vibe,
      photoId: compose.photoId, photoUrl: compose.photoUrl || null,
      myLat: compose.myLat, myLng: compose.myLng, acc: compose.acc,   // guarda p/ validação server-side
      confirms: 0, ts: Date.now(), by: me?.uid || 'local', byName: me?.name || 'Alguém'
    };
    try { await db().pushShared('role', post); } catch { toast('não deu pra publicar agora'); return; }
    markPosted(compose.placeId);
    closeCompose();
    toast('rôle publicado ✨');
    if (mapMode !== 'role') await setMode('role');
    else { await loadRoles(); renderRoleMarkers(); updateCount(); renderGuide(); }
  });

  /* ----- ver um rôle ----- */
  const rvEl = $('[data-role-view]');
  const iConfirmed = (k) => { try { return JSON.parse(localStorage.getItem('haven.role.confirmed') || '[]').includes(k); } catch { return false; } };
  function openRoleView(r){
    const v = VIBES[r.vibe] || VIBES.tranquilo;
    $('[data-rv-img]').style.backgroundImage = r._cover ? `url('${r._cover}')` : '';
    $('[data-rv-name]').textContent = r.placeName || 'Um lugar';
    const ve = $('[data-rv-vibe]'); ve.textContent = `${v.emoji} ${v.label}`; ve.style.setProperty('--vb', v.color);
    $('[data-rv-time]').textContent = timeAgo(r.ts);
    const dEl = $('[data-rv-dist]'), dt = distText(r.lat, r.lng);
    dEl.hidden = !dt; dEl.textContent = dt ? '· ' + dt : '';
    $('[data-rv-by]').textContent = 'por ' + (r.byName || 'alguém');
    $('[data-rv-confirms]').textContent = r.confirms ? `(${r.confirms})` : '';
    const cbtn = $('[data-rv-confirm]'); cbtn.classList.toggle('is-on', iConfirmed(r._k)); cbtn.onclick = () => confirmRole(r);
    $('[data-rv-report]').onclick = () => reportRole(r);
    rvEl.hidden = false; requestAnimationFrame(() => rvEl.classList.add('is-on'));
  }
  async function confirmRole(r){
    if (iConfirmed(r._k)){ toast('você já confirmou 🙂'); return; }
    r.confirms = (r.confirms || 0) + 1;
    try { await db().updateShared('role', r._k, { confirms: r.confirms }); } catch {}
    const arr = (() => { try { return JSON.parse(localStorage.getItem('haven.role.confirmed') || '[]'); } catch { return []; } })();
    arr.push(r._k); try { localStorage.setItem('haven.role.confirmed', JSON.stringify(arr)); } catch {}
    $('[data-rv-confirms]').textContent = `(${r.confirms})`;
    $('[data-rv-confirm]').classList.add('is-on');
    renderGuide();
    toast('valeu por confirmar ✨');
  }
  function closeRoleView(){ rvEl.classList.remove('is-on'); setTimeout(() => { rvEl.hidden = true; }, 260); }
  $('[data-role-view-close]')?.addEventListener('click', closeRoleView);
  rvEl?.addEventListener('click', (e) => { if (e.target === rvEl) closeRoleView(); });
  function reportRole(r){
    if (!window.confirm('Denunciar este rôle? Ele será ocultado pra você.')) return;
    const arr = (() => { try { return JSON.parse(localStorage.getItem('haven.role.hidden') || '[]'); } catch { return []; } })();
    arr.push(r._k); try { localStorage.setItem('haven.role.hidden', JSON.stringify(arr)); } catch {}
    roles = roles.filter(x => x._k !== r._k);
    closeRoleView(); renderRoleMarkers(); updateCount(); renderGuide();
    toast('rôle ocultado. obrigado por avisar.');
  }

  // toggle de modo
  $$('[data-map-mode] button').forEach(b => b.addEventListener('click', () => setMode(b.dataset.mode)));

  /* ---------- estilos de mapa (Mapa · Aquarela · Constelação) ---------- */
  let baseLayer, refLayer, aquaLayer, lineGroup;
  function clearBase(){ [baseLayer, refLayer, aquaLayer, lineGroup].forEach(l => l && map.removeLayer(l)); baseLayer = refLayer = aquaLayer = lineGroup = null; }

  // encadeia as memórias pela vizinha mais próxima → uma constelação
  function nnChain(pts){
    if (pts.length < 2) return [];
    const used = new Set([0]), order = [0];
    while (order.length < pts.length){
      const last = pts[order[order.length - 1]]; let best = -1, bd = Infinity;
      pts.forEach((p, i) => { if (used.has(i)) return; const d = (p.lat - last.lat) ** 2 + (p.lng - last.lng) ** 2; if (d < bd){ bd = d; best = i; } });
      used.add(best); order.push(best);
    }
    return order.map(i => [pts[i].lat, pts[i].lng]);
  }
  function buildLines(){
    const chain = nnChain(places.map(p => ({ lat: p.lat, lng: p.lng })));
    if (!chain.length) return null;
    const glow = L.polyline(chain, { color: '#f4d9b8', weight: 7, opacity: .08, lineCap: 'round', lineJoin: 'round', interactive: false });
    const line = L.polyline(chain, { color: '#f4d9b8', weight: 1.3, opacity: .5, dashArray: '1 7', lineCap: 'round', interactive: false });
    return L.layerGroup([glow, line]);
  }
  function refreshLines(){ if (mapStyle !== 'constelacao' || !map) return; if (lineGroup) map.removeLayer(lineGroup); lineGroup = buildLines(); if (lineGroup) lineGroup.addTo(map); }

  function applyStyle(style){
    mapStyle = style;
    clearBase();
    const el = $('[data-map]'); el.classList.remove('style-mapa', 'style-aqua', 'style-const');
    const aqua = $('[data-map-aqua]'); if (aqua) aqua.hidden = true;
    if (style === 'aquarela'){
      const k = stadiaKey();
      if (!k){ el.classList.add('style-const'); if (aqua) aqua.hidden = false; }
      else { el.classList.add('style-aqua'); aquaLayer = L.tileLayer(AQUA + `?api_key=${k}`, { maxZoom: 18, attribution: '© Stadia · Stamen · OSM' }).addTo(map); }
    } else if (style === 'constelacao'){
      el.classList.add('style-const');
      if (mapMode !== 'role'){ lineGroup = buildLines(); if (lineGroup) lineGroup.addTo(map); }   // traço só nas memórias
    } else {
      el.classList.add('style-mapa');
      baseLayer = L.tileLayer(TILE_BASE, { maxZoom: 19, maxNativeZoom: 16, attribution: ATTRIB }).addTo(map);
      refLayer  = L.tileLayer(TILE_REF,  { maxZoom: 19, maxNativeZoom: 16, opacity: .9, className: 'tiles-ref' }).addTo(map);
    }
    $$('[data-map-styles] button').forEach(b => b.classList.toggle('is-on', b.dataset.style === style));
  }
  function switchStyle(s){ if (s === mapStyle && s !== 'aquarela') return; try { localStorage.setItem(LS_STYLE, s); } catch {} applyStyle(s); }

  /* ---------- init (lazy, on first open) ---------- */
  async function ensure(){
    if (started) return; started = true;
    if (!window.L){ console.warn('[haven] leaflet não carregou'); return; }
    places = await loadPlaces();
    await resolveCovers();
    map = L.map($('[data-map-canvas]'), {
      center: [CITY.lat, CITY.lng],
      zoom: CITY.zoom,
      zoomControl: false,
      attributionControl: true,
      zoomSnap: 0.25,
      fadeAnimation: true
    });
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    map.attributionControl.setPrefix('');

    places.forEach(addMarker);
    updateCount();
    renderFilter();
    renderGuide();
    applyStyle(mapStyle);                        // aplica o estilo salvo (mapa/aquarela/constelação)

    // seletor de estilo
    $$('[data-map-styles] button').forEach(b => b.addEventListener('click', () => switchStyle(b.dataset.style)));
    // conectar chave Stadia (aquarela)
    $('[data-aqua-save]')?.addEventListener('click', () => {
      const v = $('[data-aqua-key]')?.value.trim(); if (!v) return;
      let k = {}; try { k = JSON.parse(localStorage.getItem(LS_KEYS)) || {}; } catch {}
      k.stadia = v; try { localStorage.setItem(LS_KEYS, JSON.stringify(k)); } catch {}
      applyStyle('aquarela');
    });

    map.on('click', (e) => {
      if (!placing) return;
      const draft = { id: uid(), name: 'Novo lugar', cat: 'outro', lng: e.latlng.lng, lat: e.latlng.lat, note: '', photos: [], _draft: true };
      addMarker(draft);
      stopPlacing();
      openSheet(draft);
    });
    // mapa recém-exibido precisa recalcular tamanho
    setTimeout(() => map.invalidateSize(), 60);
    setTimeout(() => map.invalidateSize(), 500);
  }

  // registra no roteador do main.js
  const register = () => { (window.HavenApps = window.HavenApps || {}).map = { ensure }; };
  register();
})();
