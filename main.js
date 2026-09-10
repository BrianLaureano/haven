/* ============================================================
   Haven — Home concept · behavior
   Calm, quiet, everything flows.
   ============================================================ */
(() => {
  'use strict';
  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  /* ---------- clock + date + greeting ---------- */
  const elClock = $('[data-clock]');
  const elDate  = $('[data-date]');
  const elGreet = $('[data-greet]');
  const DAYS  = ['domingo','segunda','terça','quarta','quinta','sexta','sábado'];
  const MONTH = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];

  const pad = n => String(n).padStart(2, '0');
  function greeting(h){
    if (h < 5)  return 'Boa madrugada';
    if (h < 12) return 'Bom dia';
    if (h < 18) return 'Boa tarde';
    return 'Boa noite';
  }
  function tick(){
    const d = new Date();
    if (elClock) elClock.textContent = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    if (elDate)  elDate.textContent  = `${DAYS[d.getDay()]}, ${d.getDate()} ${MONTH[d.getMonth()]}`;
    if (elGreet) elGreet.textContent = greeting(d.getHours());
  }
  tick();
  // align to the next minute, then every minute
  setTimeout(function align(){ tick(); setInterval(tick, 60000); },
    (60 - new Date().getSeconds()) * 1000);

  /* ---------- weather (Open-Meteo, keyless) ---------- */
  // default place — trocável depois; tenta geolocalização só se o usuário permitir
  const CITY = { name: 'São Paulo', lat: -23.55, lon: -46.63 };
  const WMO = {
    0:['Céu limpo','sun'], 1:['Quase limpo','sun'], 2:['Parcialmente nublado','cloud'],
    3:['Nublado','cloud'], 45:['Neblina','fog'], 48:['Neblina','fog'],
    51:['Garoa','rain'], 53:['Garoa','rain'], 55:['Garoa','rain'],
    61:['Chuva fraca','rain'], 63:['Chuva','rain'], 65:['Chuva forte','rain'],
    71:['Neve','snow'], 73:['Neve','snow'], 75:['Neve','snow'],
    80:['Pancadas','rain'], 81:['Pancadas','rain'], 82:['Temporal','rain'],
    95:['Tempestade','storm'], 96:['Tempestade','storm'], 99:['Tempestade','storm']
  };
  const ICONS = {
    sun:  '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M19 5l-1.5 1.5M6.5 17.5 5 19"/>',
    cloud:'<path d="M7 18a4 4 0 0 1 0-8 5 5 0 0 1 9.6-1.3A3.5 3.5 0 0 1 17 18H7Z"/>',
    rain: '<path d="M7 15a4 4 0 0 1 0-8 5 5 0 0 1 9.6-1.3A3.5 3.5 0 0 1 17 15H7Z"/><path d="M8 19l-1 2M12 19l-1 2M16 19l-1 2"/>',
    snow: '<path d="M7 15a4 4 0 0 1 0-8 5 5 0 0 1 9.6-1.3A3.5 3.5 0 0 1 17 15H7Z"/><path d="M9 19h.01M12 20h.01M15 19h.01"/>',
    fog:  '<path d="M4 9h13a3.5 3.5 0 0 0-6.9-1.3A4 4 0 0 0 4 9Z"/><path d="M4 14h16M6 18h13"/>',
    storm:'<path d="M7 14a4 4 0 0 1 0-8 5 5 0 0 1 9.6-1.3A3.5 3.5 0 0 1 17 14H7Z"/><path d="M12 13l-2 4h3l-2 4"/>'
  };
  const elTemp = $('[data-temp]'), elCond = $('[data-cond]'), elCity = $('[data-city]'), elWico = $('[data-wico] svg');

  async function loadWeather(place){
    try{
      const u = `https://api.open-meteo.com/v1/forecast?latitude=${place.lat}&longitude=${place.lon}&current=temperature_2m,weather_code&timezone=auto`;
      const r = await fetch(u);
      if (!r.ok) throw new Error('weather');
      const j = await r.json();
      const t = Math.round(j.current.temperature_2m);
      const [label, ico] = WMO[j.current.weather_code] || ['—','cloud'];
      if (elTemp) elTemp.textContent = `${t}°`;
      if (elCond) elCond.textContent = label;
      if (elCity) elCity.textContent = place.name;
      if (elWico) elWico.innerHTML = ICONS[ico] || ICONS.cloud;
      // o clima conduz a atmosfera: chovendo → wallpaper de chuva, etc.
      lastWeatherCode = j.current.weather_code;
      if (!userPickedScene) setScene(weatherScene(lastWeatherCode));
    }catch{
      if (elCond) elCond.textContent = 'Clima indisponível';
      if (elCity) elCity.textContent = place.name;
    }
  }

  /* ---------- scenes: weather- & time-aware wallpaper ---------- */
  // ordem do ciclo manual; assets em assets/scenes/<name>.webp (dawn/rain garantidos)
  const SCENES = ['dawn','rain','clear-day','night','overcast','sakura','ocean','lavender','noir','gold','sage'];
  const sceneWrap = $('[data-scene]');
  const sceneBtn  = $('[data-scene-btn]');
  let sceneIdx = 0, userPickedScene = false, currentScene = 'dawn', lastWeatherCode = null;

  // mapeia código WMO + horário → nome de cena
  function weatherScene(code){
    const h = new Date().getHours();
    const night = h < 6 || h >= 19;
    const dawnish = (h >= 5 && h < 8) || (h >= 17 && h < 19);
    if (code >= 51) return 'rain';                 // garoa/chuva/pancadas/tempestade
    if (night) return 'night';
    if (dawnish) return 'dawn';
    if (code === 3 || code === 45 || code === 48) return 'overcast';
    if (code === 0 || code === 1 || code === 2) return 'clear-day';
    return 'dawn';
  }

  function ensureSceneImg(name){
    let img = sceneWrap.querySelector(`[data-scene-img="${name}"]`);
    if (!img){
      img = document.createElement('img');
      img.className = 'scene__img'; img.alt = ''; img.dataset.sceneImg = name;
      // se o asset ainda não existe, cai pra dawn sem quebrar
      img.addEventListener('error', () => { if (name !== 'dawn') setScene('dawn'); }, { once:true });
      img.src = `assets/scenes/${name}.webp`;
      sceneWrap.insertBefore(img, sceneWrap.querySelector('.scene__grade'));
    }
    return img;
  }
  function showScene(next){
    $$('.scene__img').forEach(i => { if (i !== next) i.classList.remove('is-on'); });
    const reveal = () => next.classList.add('is-on');
    if (next.complete && next.naturalWidth) setTimeout(reveal, 20);
    else { next.addEventListener('load', () => setTimeout(reveal, 20), { once:true }); setTimeout(reveal, 400); }
  }
  function setScene(name){
    if (!SCENES.includes(name)) name = 'dawn';
    currentScene = name;
    sceneWrap.classList.remove('scene--custom');   // cenas nativas não levam blur extra
    sceneIdx = Math.max(0, SCENES.indexOf(name));
    showScene(ensureSceneImg(name));
  }
  // wallpaper personalizado (foto enviada ou link)
  function setCustom(src){
    userPickedScene = true; currentScene = '__custom';
    let img = sceneWrap.querySelector('[data-scene-img="__custom"]');
    if (!img){ img = document.createElement('img'); img.className = 'scene__img scene__img--custom'; img.alt = '';
      img.dataset.sceneImg = '__custom'; sceneWrap.insertBefore(img, sceneWrap.querySelector('.scene__grade')); }
    img.classList.add('scene__img--custom');  // blur automático → cards se destacam (feito o wallpaper padrão)
    if (img.getAttribute('src') !== src){ img.src = src; }
    sceneWrap.classList.add('scene--custom');
    showScene(img);
  }
  const applyWeather = () => setScene(weatherScene(lastWeatherCode));
  window.HavenScene = {
    current: () => currentScene,
    set: setScene,
    pick(name){ userPickedScene = true; setScene(name); },   // built-in manual
    custom: setCustom,
    auto(){ userPickedScene = false; applyWeather(); },       // volta ao clima
    list: () => SCENES.slice()
  };

  sceneBtn?.addEventListener('click', () => {
    if (window.HavenWallpaper) return window.HavenWallpaper.open();
    // fallback: cicla as cenas
    userPickedScene = true; sceneIdx = (sceneIdx + 1) % SCENES.length; setScene(SCENES[sceneIdx]);
  });

  loadWeather(CITY);

  /* ---------- view router (flow between apps) ---------- */
  const views = $$('.view');
  const navBtns = $$('.dock__i[data-nav]');
  const apps = {};                 // app modules register here (ensure() lazy-inits on first open)
  window.HavenApps = apps;          // external app files (map.js…) plug in here
  const hasView = n => views.some(v => v.dataset.view === n);
  let current = 'home';
  document.body.dataset.view = current;   // CSS usa pra ajustar rodapé no modo visitante

  function go(name){
    if (name === current) return;
    const from = views.find(v => v.dataset.view === current);
    const to   = views.find(v => v.dataset.view === name);
    if (!to) return; // app não construído ainda
    current = name;
    document.body.dataset.view = name;
    navBtns.forEach(b => b.classList.toggle('is-on', b.dataset.nav === name));
    if (from){
      from.classList.remove('is-on');
      setTimeout(() => { from.hidden = true; }, 380);
    }
    to.hidden = false;
    requestAnimationFrame(() => to.classList.add('is-on'));
    setTimeout(() => to.classList.add('is-on'), 30); // fallback if rAF is throttled
    try { apps[name]?.ensure?.(); } catch(e){ console.warn('[haven] ensure', name, e); }
  }
  window.HavenGo = go;              // let app files navigate too
  navBtns.forEach(b => b.addEventListener('click', () => {
    if (hasView(b.dataset.nav)) go(b.dataset.nav);
    else flash(b); // apps ainda em construção — só um feedbackzinho
  }));
  $$('[data-open]').forEach(el => el.addEventListener('click', () => go(el.dataset.open)));

  /* ---------- Música ---------- */
  const music = (() => {
    const view  = $('.mview');
    const railEl = $('[data-recos]');       // fileira de playlists (escolher)
    const cfEl  = $('[data-coverflow]');    // cover-flow das faixas
    const heroEl = $('[data-hero]');
    const npTitle = $('[data-np-title]');
    const npArtist = $('[data-np-artist]');
    const tp    = $('[data-transport]');     // barra de controles
    const nowEl = $('[data-now]');           // wrapper do embed (fallback)
    const frame = $('[data-player]');        // iframe embed
    const minfoEl = $('[data-minfo]');       // painel do artista
    let src = 'spotify', started = false, activeId = null;

    // padrão editorial (público, sem login) — usado até o dono escolher as dele
    const EDITORIAL = [
      { id:'37i9dQZF1DWWQRwui0ExPn', name:'lofi beats',     sub:'foco leve' },
      { id:'37i9dQZF1DX4sWSpwq3LiO', name:'Peaceful Piano', sub:'calmaria' },
      { id:'37i9dQZF1DWZeKCadgRdKQ', name:'Deep Focus',     sub:'concentrar' },
      { id:'37i9dQZF1DX0SM0LYsmbMT', name:'Jazz Vibes',     sub:'fim de tarde' },
      { id:'37i9dQZF1DX3Ogo9pFvBkY', name:'Ambient Relax',  sub:'respirar' },
      { id:'37i9dQZF1DX889U0CL85jj', name:'Chill Vibes',    sub:'flutuar' }
    ];
    // LIB.spotify é a lista do DONO (salva na fachada); começa no editorial
    const LIB = {
      spotify: EDITORIAL.slice(),
      youtube: [
        { id:'5yx6BWlEVcY', name:'Chillhop · lofi',  sub:'ao vivo' },
        { id:'4xDzrJKXOOY', name:'synthwave',        sub:'ao vivo' },
        { id:'S_MOd40zlYU', name:'dark ambient',     sub:'ao vivo' }
      ]
    };

    // carrega as playlists escolhidas pelo dono (doc 'music' da fachada)
    let myLoaded = false, liked = new Set();
    async function loadMine(){
      if (myLoaded) return; myLoaded = true;
      try {
        const doc = await window.HavenDB?.getDoc?.('music');
        if (doc?.playlists?.length) LIB.spotify = doc.playlists;
        if (Array.isArray(doc?.liked)) liked = new Set(doc.liked);
      } catch(_){}
    }
    function saveMine(){
      try { window.HavenDB?.setDoc?.('music', { playlists: LIB.spotify, liked: [...liked] }); } catch(_){}
      try { window.HavenPublish?.(); } catch(_){}
    }
    const trackKey = t => t.url || (t.name + '|' + t.artist);
    const isLiked = t => liked.has(trackKey(t));
    function toggleLike(t){
      const k = trackKey(t); if (liked.has(k)) liked.delete(k); else liked.add(k);
      saveMine();
    }
    const isVisitor = () => document.body.classList.contains('is-visitor');

    const embedURL = (source, id) => source === 'spotify'
      ? `https://open.spotify.com/embed/playlist/${id}?utm_source=generator&theme=0`
      : `https://www.youtube.com/embed/${id}?rel=0&modestbranding=1`;

    // cover art via Spotify oEmbed (sem login); YouTube via thumbnail
    function coverURL(source, id){
      return source === 'youtube'
        ? Promise.resolve(`https://i.ytimg.com/vi/${id}/hqdefault.jpg`)
        : fetch(`https://open.spotify.com/oembed?url=https://open.spotify.com/playlist/${id}`)
            .then(r => r.json()).then(j => j.thumbnail_url).catch(() => null);
    }

    /* ===== player rico (Spotify Web API via proxy/mock) =====
       Cover-flow + artista quando a fonte é Spotify E há proxy/mock.
       Sem isso (ou no YouTube), cai no embed de sempre. */
    const useApi  = () => !!window.HavenSpotify?.ok?.();
    const useRich = () => src === 'spotify' && useApi();
    const audio = new Audio();
    let tracks = [], cards = [], cur = -1, playing = false, plCover = null, shuffled = false;
    let curArtistId = null, dragX = null, swiped = false;
    const esc = s => (s || '').replace(/[<>&]/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;'}[c]));
    const fmt = s => { s = Math.max(0, Math.floor(s || 0)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
    const fmtNum = n => {
      n = +n || 0;
      if (n >= 1e6) return (n / 1e6).toFixed(n >= 1e7 ? 0 : 1).replace('.0', '') + 'M';
      if (n >= 1e3) return (n / 1e3).toFixed(n >= 1e4 ? 0 : 1).replace('.0', '') + 'k';
      return String(n);
    };

    // refs do transport
    const tpPlay = $('[data-play]', tp), tpPlayIco = $('[data-play-ico]', tp);
    const tpPrev = $('[data-prev]', tp), tpNext = $('[data-next]', tp);
    const tpShuffle = $('[data-shuffle]', tp), tpLike = $('[data-like]', tp), tpOpen = $('[data-open]', tp);
    const tpElapsed = $('[data-elapsed]', tp), tpTotal = $('[data-total]', tp);
    const tpSeek = $('[data-seek]', tp), tpFill = $('[data-fill]', tp);
    const PLAY_D = 'M8 5v14l11-7-11-7Z', PAUSE_D = 'M8 5h3v14H8zM13 5h3v14h-3z';

    // refs do painel do artista
    const aImg = $('[data-artist-img]'), aName = $('[data-artist-name]'), aGenres = $('[data-artist-genres]');
    const aFollowers = $('[data-artist-followers]'), aPop = $('[data-artist-pop]');
    const aBio = $('[data-artist-bio]'), aMore = $('[data-artist-more]');
    const mfSec = $('[data-morefrom]'), mfLabel = $('[data-morefrom-label]'), mfRow = $('[data-morefrom-row]');
    const unSec = $('[data-upnext]'), unList = $('[data-upnext-list]');
    const npnowEl = $('.npnow', heroEl);

    const setPlayIcon = () => tpPlayIco.setAttribute('d', playing ? PAUSE_D : PLAY_D);
    const startAudio = () => audio.play().then(() => { playing = true; setPlayIcon(); })
                                        .catch(() => { playing = false; setPlayIcon(); });
    function updateLikeUI(){
      const on = tracks[cur] && isLiked(tracks[cur]);
      tpLike.classList.toggle('is-liked', !!on);
    }

    /* ---- cover-flow ---- */
    function layoutCF(){
      if (!cards.length) return;
      const cw = cards[0].offsetWidth || 190;
      const gap = cw * 0.60;
      cards.forEach((c, i) => {
        const off = i - cur, a = Math.abs(off);
        if (a > 3){
          c.style.opacity = '0'; c.style.pointerEvents = 'none';
          c.style.transform = `translate(-50%,-50%) translateX(${Math.sign(off) * gap * 3.4}px) scale(.5)`;
          return;
        }
        const x = off * gap;
        const ry = Math.max(-48, Math.min(48, -off * 34));
        const s = Math.max(0.66, 1 - a * 0.14);
        c.style.opacity = String(Math.max(0, 1 - a * 0.26));
        c.style.pointerEvents = 'auto';
        c.style.zIndex = String(100 - a);
        c.style.transform = `translate(-50%,-50%) translateX(${x}px) translateZ(${-a * 70}px) rotateY(${ry}deg) scale(${s})`;
        c.classList.toggle('is-center', off === 0);
      });
    }
    function buildCF(){
      cfEl.innerHTML = ''; cards = [];
      if (!tracks.length){ cfEl.innerHTML = '<div class="cf-empty">nada pra tocar aqui</div>'; return; }
      tracks.forEach((t, i) => {
        const c = document.createElement('button');
        c.className = 'cf-card'; c.type = 'button';
        c.innerHTML = `<img alt="" />`;
        const img = c.querySelector('img');
        img.onload = () => img.classList.add('is-loaded');
        img.onerror = () => { c.style.background = 'linear-gradient(150deg,#3a4a63,#242a36)'; };
        img.src = t.cover || plCover || '';
        c.addEventListener('click', () => { if (swiped){ swiped = false; return; } if (i === cur) toggle(); else selectTrack(i, true); });
        cfEl.appendChild(c); cards.push(c);
      });
      requestAnimationFrame(layoutCF);
    }

    function selectTrack(i, autoplay){
      if (!tracks.length) return;
      i = (i + tracks.length) % tracks.length;
      const t = tracks[i]; if (!t) return;
      cur = i;
      npTitle.textContent = t.name;
      npArtist.textContent = t.artist;
      tpOpen.href = t.url || '#';
      tpTotal.textContent = t.dur ? fmt(t.dur / 1000) : '0:00';
      tpElapsed.textContent = '0:00'; tpFill.style.width = '0';
      layoutCF();
      updateLikeUI();
      audio.pause(); playing = false;
      if (t.preview){ audio.src = t.preview; tpPlay.disabled = false; if (autoplay) startAudio(); else setPlayIcon(); }
      else { audio.removeAttribute('src'); tpPlay.disabled = true; setPlayIcon(); } // sem prévia → só Spotify ↗
      loadArtist(t.artistId, t.artist);
      renderUpNext();
    }
    function toggle(){
      if (cur < 0 || !tracks[cur]?.preview) return;
      if (playing){ audio.pause(); playing = false; setPlayIcon(); } else startAudio();
    }
    function step(d){
      if (!tracks.length) return;
      if (shuffled && tracks.length > 1){
        const pool = tracks.map((t, i) => i).filter(i => i !== cur && tracks[i].preview);
        if (pool.length){ selectTrack(pool[Math.floor(Math.random() * pool.length)], true); return; }
      }
      for (let n = 1, i = cur; n <= tracks.length; n++){
        i = (i + d + tracks.length) % tracks.length;
        if (tracks[i].preview){ selectTrack(i, true); return; }
      }
      selectTrack(cur + d, false); // ninguém tem prévia
    }

    /* ---- painel: próxima a tocar ---- */
    function renderUpNext(){
      const rest = tracks.map((t, i) => ({ t, i })).filter(x => x.i > cur).slice(0, 6);
      if (!rest.length){ unSec.hidden = true; return; }
      unSec.hidden = false;
      unList.innerHTML = '';
      rest.forEach(({ t, i }) => {
        const b = document.createElement('button');
        b.className = 'un-row'; b.dataset.i = i;
        b.innerHTML =
          `<span class="n">${i + 1}</span>
           <img alt="" src="${t.cover || plCover || ''}" />
           <span class="t"><b>${esc(t.name)}</b><span>${esc(t.artist)}</span></span>
           <span class="d">${t.dur ? fmt(t.dur / 1000) : '↗'}</span>`;
        b.addEventListener('click', () => selectTrack(i, true));
        unList.appendChild(b);
      });
    }

    /* ---- painel: sobre o artista + mais do artista ---- */
    async function loadArtist(id, fallbackName){
      aName.textContent = fallbackName || '—';
      if (!useRich() || !id){
        curArtistId = null;
        aImg.style.backgroundImage = ''; aGenres.innerHTML = '';
        aFollowers.textContent = '—'; aPop.style.width = '0';
        aBio.textContent = ''; aMore.hidden = true; mfSec.hidden = true;
        return;
      }
      curArtistId = id;
      const a = await window.HavenSpotify.artist(id);
      if (curArtistId !== id) return;            // trocou de faixa enquanto carregava
      if (!a){ mfSec.hidden = true; return; }
      aName.textContent = a.name || fallbackName || '';
      if (a.image) aImg.style.backgroundImage = `url("${a.image}")`;
      aGenres.innerHTML = (a.genres || []).slice(0, 3).map(g => `<span>${esc(g)}</span>`).join('');
      aFollowers.textContent = a.followers ? fmtNum(a.followers) : '—';
      aPop.style.width = (a.popularity || 0) + '%';
      // bio (clamp + ler mais)
      const bio = (a.bio || '').trim();
      aBio.textContent = bio; aBio.classList.add('is-clamp'); aMore.hidden = true;
      if (bio) requestAnimationFrame(() => {
        if (aBio.scrollHeight - aBio.clientHeight > 4){ aMore.hidden = false; aMore.textContent = 'ler mais'; }
      });
      // mais do artista (top-tracks)
      const top = (a.top || []).filter(t => t.name !== tracks[cur]?.name).slice(0, 8);
      if (!top.length){ mfSec.hidden = true; return; }
      mfSec.hidden = false;
      mfLabel.textContent = 'Mais de ' + (a.name || 'artista');
      mfRow.innerHTML = '';
      top.forEach(t => {
        const c = document.createElement('button');
        c.className = 'mf-card'; c.type = 'button';
        c.innerHTML =
          `<div class="mf-card__art"><img alt="" /></div>
           <b>${esc(t.name)}</b><span>${esc(t.artist || a.name)}</span>`;
        const img = c.querySelector('img');
        img.onload = () => img.classList.add('is-loaded');
        img.src = t.cover || '';
        c.addEventListener('click', () => {
          const idx = tracks.findIndex(x => (x.url && t.url && x.url === t.url) || x.name === t.name);
          if (idx >= 0) selectTrack(idx, true);
          else if (t.url) window.open(t.url, '_blank', 'noopener');
        });
        mfRow.appendChild(c);
      });
    }
    aMore.addEventListener('click', () => {
      const clamped = aBio.classList.toggle('is-clamp');
      aMore.textContent = clamped ? 'ler mais' : 'ler menos';
    });

    /* ---- modos: rico (cover-flow) x embed ---- */
    function setMode(rich){
      cfEl.hidden = !rich; npnowEl.hidden = !rich; tp.hidden = !rich; minfoEl.hidden = !rich;
      nowEl.hidden = rich;
    }
    function embed(id){
      setMode(false);
      audio.pause(); playing = false; setPlayIcon();
      frame.src = embedURL(src, id);
    }
    function setQueue(data){
      plCover = data.image; tracks = data.tracks || []; cur = -1;
      setMode(true);
      frame.removeAttribute('src'); // silencia embed
      buildCF();
      selectTrack(0, false);        // mostra a 1ª; não toca (autoplay bloqueado)
    }

    async function play(id){
      activeId = id;
      $$('.pl-chip', railEl).forEach(c => c.classList.toggle('is-active', c.dataset.id === id));
      if (useRich()){
        const data = await window.HavenSpotify.playlist(id);
        if (activeId !== id) return;   // trocaram de playlist enquanto carregava
        if (data && data.tracks?.length){ setQueue(data); return; }
      }
      embed(id); // proxy falhou / YouTube / sem API
    }

    function renderRail(){
      railEl.innerHTML = '';
      LIB[src].forEach(pl => {
        const chip = document.createElement('button');
        chip.className = 'pl-chip'; chip.type = 'button'; chip.dataset.id = pl.id;
        chip.innerHTML = `<img alt="" /><b>${esc(pl.name)}</b>`;
        chip.addEventListener('click', () => play(pl.id));
        railEl.appendChild(chip);
        const img = chip.querySelector('img');
        coverURL(src, pl.id).then(u => { if (u) img.src = u; else img.remove(); }).catch(() => img.remove());
      });
    }

    // transport events (uma vez)
    tpPlay.addEventListener('click', toggle);
    tpPrev.addEventListener('click', () => step(-1));
    tpNext.addEventListener('click', () => step(1));
    tpShuffle.addEventListener('click', () => { shuffled = !shuffled; tpShuffle.classList.toggle('is-on', shuffled); });
    tpLike.addEventListener('click', () => { const t = tracks[cur]; if (!t) return; toggleLike(t); updateLikeUI(); });
    tpSeek.addEventListener('click', e => {
      if (!audio.duration) return;
      const r = tpSeek.getBoundingClientRect();
      audio.currentTime = ((e.clientX - r.left) / r.width) * audio.duration;
    });
    audio.addEventListener('timeupdate', () => {
      tpFill.style.width = audio.duration ? (audio.currentTime / audio.duration * 100) + '%' : '0';
      tpElapsed.textContent = fmt(audio.currentTime);
    });
    audio.addEventListener('ended', () => step(1));
    addEventListener('resize', () => { if (!cfEl.hidden) layoutCF(); });

    /* ---- deslizar/arrastar as capas pra trocar a faixa ---- */
    cfEl.addEventListener('pointerdown', e => { if (!tracks.length) return; dragX = e.clientX; swiped = false; });
    cfEl.addEventListener('pointermove', e => {
      if (dragX == null) return;
      const dx = e.clientX - dragX;
      if (Math.abs(dx) > 6){ cfEl.style.transition = 'none'; cfEl.style.transform = `translateX(${dx * 0.22}px)`; }
    });
    const endDrag = e => {
      if (dragX == null) return;
      const dx = (e.clientX ?? dragX) - dragX; dragX = null;
      cfEl.style.transition = 'transform .28s var(--ease)'; cfEl.style.transform = '';
      if (Math.abs(dx) > 44){ swiped = true; navigator.vibrate?.(8); selectTrack(cur + (dx < 0 ? 1 : -1), playing); }
    };
    cfEl.addEventListener('pointerup', endDrag);
    cfEl.addEventListener('pointercancel', () => { dragX = null; cfEl.style.transition = 'transform .28s var(--ease)'; cfEl.style.transform = ''; });
    cfEl.addEventListener('pointerleave', endDrag);

    /* ===== gerenciar playlists (dono busca no Spotify e escolhe) ===== */
    const manageBtn = $('[data-manage]');
    let sheet = null;

    function refreshManageBtn(){
      // só o dono, na fonte Spotify, com proxy ligado
      if (manageBtn) manageBtn.hidden = isVisitor() || src !== 'spotify' || !window.HavenSpotify?.ok?.();
    }

    function buildSheet(){
      if (sheet) return;
      sheet = document.createElement('div');
      sheet.className = 'psheet'; sheet.hidden = true;
      sheet.innerHTML = `
        <div class="psheet__panel glass">
          <div class="psheet__top">
            <h3>Suas playlists</h3>
            <button class="psheet__x" data-close aria-label="Fechar">✕</button>
          </div>
          <div class="psheet__mine" data-mine></div>
          <div class="psheet__field">
            <input type="search" data-q placeholder="Buscar playlist no Spotify…" autocomplete="off" />
          </div>
          <div class="psheet__results" data-results></div>
        </div>`;
      document.body.appendChild(sheet);
      sheet.addEventListener('click', e => { if (e.target === sheet) closeSheet(); });
      sheet.querySelector('[data-close]').addEventListener('click', closeSheet);
      const input = sheet.querySelector('[data-q]');
      let t;
      input.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => runSearch(input.value), 320); });
    }

    function renderMine(){
      const box = sheet.querySelector('[data-mine]');
      box.innerHTML = LIB.spotify.length ? '' : '<p class="psheet__empty">Nenhuma ainda — busque abaixo.</p>';
      LIB.spotify.forEach(pl => {
        const chip = document.createElement('div');
        chip.className = 'pchip';
        chip.innerHTML = `<span>${esc(pl.name)}</span><button aria-label="Remover">✕</button>`;
        chip.querySelector('button').addEventListener('click', () => {
          LIB.spotify = LIB.spotify.filter(p => p.id !== pl.id);
          saveMine(); renderMine(); renderRail();
        });
        box.appendChild(chip);
      });
    }

    async function runSearch(q){
      const box = sheet.querySelector('[data-results]');
      q = (q || '').trim();
      if (!q){ box.innerHTML = ''; return; }
      box.innerHTML = '<p class="psheet__empty">Buscando…</p>';
      const items = await window.HavenSpotify.search(q);
      if (!items.length){ box.innerHTML = '<p class="psheet__empty">Nada encontrado.</p>'; return; }
      box.innerHTML = '';
      items.forEach(it => {
        const has = LIB.spotify.some(p => p.id === it.id);
        const b = document.createElement('button');
        b.className = 'presult'; b.disabled = has;
        b.innerHTML =
          `<img alt="" src="${it.image || ''}" />
           <span class="presult__t"><b>${esc(it.name)}</b><span>${esc(it.owner)} · ${it.tracks} faixas</span></span>
           <span class="presult__add">${has ? '✓' : '+'}</span>`;
        b.addEventListener('click', () => {
          if (LIB.spotify.some(p => p.id === it.id)) return;
          LIB.spotify.push({ id: it.id, name: it.name, sub: it.owner || 'playlist' });
          saveMine(); renderMine(); renderRail();
          b.disabled = true; b.querySelector('.presult__add').textContent = '✓';
        });
        box.appendChild(b);
      });
    }

    function openSheet(){
      buildSheet(); renderMine();
      sheet.querySelector('[data-results]').innerHTML = '';
      sheet.querySelector('[data-q]').value = '';
      sheet.hidden = false;
      requestAnimationFrame(() => sheet.classList.add('is-on'));
      setTimeout(() => sheet.querySelector('[data-q]').focus(), 60);
    }
    function closeSheet(){
      if (!sheet) return;
      sheet.classList.remove('is-on');
      setTimeout(() => { sheet.hidden = true; }, 220);
    }
    manageBtn?.addEventListener('click', openSheet);

    async function ensure(){
      if (started) return; started = true;
      await loadMine();
      refreshManageBtn();
      renderRail();
      play(LIB[src][0].id);
    }
    function setSource(next){
      if (next === src) return;
      src = next;
      audio.pause(); playing = false; setPlayIcon();
      $$('.src__b').forEach(b => {
        const on = b.dataset.src === src;
        b.classList.toggle('is-on', on); b.setAttribute('aria-selected', on);
      });
      refreshManageBtn();
      renderRail();
      play(LIB[src][0].id);
    }
    $$('.src__b').forEach(b => b.addEventListener('click', () => setSource(b.dataset.src)));

    return { ensure, setSource };
  })();
  apps.music = music;

  /* ---------- share button (progressive) ---------- */
  const shareBtn = $('.dock__share');
  shareBtn?.addEventListener('click', () => {
    if (window.HavenShare) return window.HavenShare.open();
    // fallback (share.js não carregou)
    if (navigator.share) navigator.share({ title: 'Haven', url: location.href }).catch(() => {});
  });
  function flash(el){
    el.animate([{transform:'scale(1)'},{transform:'scale(.86)'},{transform:'scale(1)'}],
      {duration:320, easing:'ease-out'});
  }
  window.HavenFlash = flash;
})();
