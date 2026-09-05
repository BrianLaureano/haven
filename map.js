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

  const SEED = [
    { id:'seed-ibira', name:'Parque Ibirapuera', cat:'parque', lng:-46.6576, lat:-23.5874,
      note:'Tarde de domingo, o gramado inteiro nosso. Volto sempre que a cabeça pesa.', photos:[] },
    { id:'seed-coffee', name:'Coffee Lab', cat:'cafe', lng:-46.6899, lat:-23.5546,
      note:'Melhor coado da cidade, sem discussão. Balcão, caderninho, tempo parando.', photos:[] },
    { id:'seed-mirante', name:'Mirante 9 de Julho', cat:'vista', lng:-46.6403, lat:-23.5709,
      note:'Pôr do sol com a cidade toda embaixo. Café na mão e ninguém com pressa.', photos:[] }
  ];

  /* ---------- state ---------- */
  let map, started = false, placing = false, active = null;
  const markers = new Map();            // id -> { marker, el }
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

  /* ---------- markers (Leaflet divIcon) ---------- */
  function iconFor(place){
    const c = CATS[place.cat] || CATS.outro;
    return L.divIcon({
      className: 'pin',
      html: `<span class="pin__dot"><span class="pin__emoji">${c.emoji}</span></span><span class="pin__ring"></span>`,
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

  function openSheet(place){
    active = place;
    selectMarker(place.id);
    elName.value = place.name === 'Novo lugar' ? '' : place.name;
    elNote.value = place.note || '';
    $$('.chip', elCats).forEach(ch => ch.classList.toggle('is-on', ch.dataset.cat === place.cat));
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
      db()?.delPhoto(ph.id); save(); renderGallery();
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
    save(); renderGallery();
  });

  /* lightbox */
  const lb = $('[data-lightbox]'), lbImg = $('[data-lightbox-img]');
  function lightbox(src){ if (!src) return; lbImg.src = src; lb.hidden = false; requestAnimationFrame(() => lb.classList.add('is-on')); setTimeout(() => lb.classList.add('is-on'), 20); }
  $('[data-lightbox-close]').addEventListener('click', () => { lb.classList.remove('is-on'); setTimeout(() => { lb.hidden = true; lbImg.src = ''; }, 260); });
  lb.addEventListener('click', (e) => { if (e.target === lb) $('[data-lightbox-close]').click(); });

  /* save / delete */
  $('[data-sheet-save]').addEventListener('click', () => {
    if (!active) return;
    active.name = (elName.value.trim() || 'Sem nome');
    active.note = elNote.value.trim();
    if (active._draft){ delete active._draft; places.push(active); }
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

  /* add place */
  const hint = $('[data-map-hint]');
  $('[data-map-add]').addEventListener('click', () => {
    placing = true; hint.hidden = false;
    $('[data-map]').classList.add('is-placing');
  });
  $('[data-map-cancel]').addEventListener('click', () => stopPlacing());
  function stopPlacing(){
    placing = false; hint.hidden = true;
    $('[data-map]').classList.remove('is-placing');
  }

  function updateCount(){
    const n = places.length;
    countEl.textContent = n === 1 ? '1 memória' : `${n} memórias`;
  }

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
      el.classList.add('style-const'); lineGroup = buildLines(); if (lineGroup) lineGroup.addTo(map);
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
