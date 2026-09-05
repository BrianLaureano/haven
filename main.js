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
  const SCENES = ['dawn','rain','clear-day','night','overcast'];
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
    sceneIdx = Math.max(0, SCENES.indexOf(name));
    showScene(ensureSceneImg(name));
  }
  // wallpaper personalizado (foto enviada ou link)
  function setCustom(src){
    userPickedScene = true; currentScene = '__custom';
    let img = sceneWrap.querySelector('[data-scene-img="__custom"]');
    if (!img){ img = document.createElement('img'); img.className = 'scene__img'; img.alt = '';
      img.dataset.sceneImg = '__custom'; sceneWrap.insertBefore(img, sceneWrap.querySelector('.scene__grade')); }
    if (img.getAttribute('src') !== src){ img.src = src; }
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

  function go(name){
    if (name === current) return;
    const from = views.find(v => v.dataset.view === current);
    const to   = views.find(v => v.dataset.view === name);
    if (!to) return; // app não construído ainda
    current = name;
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
    const frame = $('[data-player]');
    const row   = $('[data-recos]');
    const wrap  = $('.player');
    let src = 'spotify', started = false, activeId = null;

    // playlists calmas (editoriais públicas — embed sem login)
    const LIB = {
      spotify: [
        { id:'37i9dQZF1DWWQRwui0ExPn', name:'lofi beats',        sub:'foco leve' },
        { id:'37i9dQZF1DX4sWSpwq3LiO', name:'Peaceful Piano',    sub:'calmaria' },
        { id:'37i9dQZF1DWZeKCadgRdKQ', name:'Deep Focus',        sub:'concentrar' },
        { id:'37i9dQZF1DX0SM0LYsmbMT', name:'Jazz Vibes',        sub:'fim de tarde' },
        { id:'37i9dQZF1DX3Ogo9pFvBkY', name:'Ambient Relax',     sub:'respirar' },
        { id:'37i9dQZF1DX889U0CL85jj', name:'Chill Vibes',       sub:'flutuar' }
      ],
      youtube: [
        { id:'5yx6BWlEVcY', name:'Chillhop · lofi',  sub:'ao vivo' },
        { id:'4xDzrJKXOOY', name:'synthwave',        sub:'ao vivo' },
        { id:'S_MOd40zlYU', name:'dark ambient',     sub:'ao vivo' }
      ]
    };

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

    function play(id){
      activeId = id;
      frame.src = embedURL(src, id);
      wrap.toggleAttribute('data-tall', src === 'spotify'); // spotify playlist embed é mais alto
      $$('.card', row).forEach(c => c.classList.toggle('is-active', c.dataset.id === id));
    }

    function renderRow(){
      row.innerHTML = '';
      LIB[src].forEach((pl, i) => {
        const card = document.createElement('button');
        card.className = 'card'; card.dataset.id = pl.id;
        card.innerHTML =
          `<div class="card__art"><img alt="" /><div class="card__grad"></div>
             <div class="card__eq"><span></span><span></span><span></span><span></span></div></div>
           <div class="card__name">${pl.name}</div><div class="card__sub">${pl.sub}</div>`;
        card.addEventListener('click', () => play(pl.id));
        row.appendChild(card);
        const img = card.querySelector('img');
        coverURL(src, pl.id).then(u => {
          if (!u) return;
          img.onload = () => {
            // YouTube serve um placeholder cinza 120×90 quando não há thumb (lives) — descarta
            if (img.naturalWidth <= 120){ img.remove(); return; }
            img.classList.add('is-loaded');
          };
          img.onerror = () => img.remove();
          img.src = u;
        });
      });
    }

    function ensure(){
      if (started) return; started = true;
      renderRow();
      play(LIB[src][0].id);
    }
    function setSource(next){
      if (next === src) return;
      src = next;
      $$('.src__b').forEach(b => {
        const on = b.dataset.src === src;
        b.classList.toggle('is-on', on); b.setAttribute('aria-selected', on);
      });
      renderRow();
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
