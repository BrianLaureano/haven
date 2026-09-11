/* ============================================================
   Haven — Home = quadro de "quem sou eu" (perfil).
   Highlights da plataforma inteira: som/playlist em destaque,
   últimos filmes·livros·jogos, memórias (fotos), bio, @insta.
   Dono edita como widgets; visitante vê read-only pela bio.
   ============================================================ */
(() => {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const db = () => window.HavenDB;
  const CAT = { cafe:'#d8a35b', comida:'#e07a5f', vista:'#7aa6d8', role:'#b48bd8', parque:'#7fb08a', outro:'#c9c2b6' };
  const esc = s => (s||'').replace(/[<>&"]/g, m => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[m]));

  /* ---------- redes sociais (ícone de marca + link) ---------- */
  const SOCIALS = {
    instagram: { label:'Instagram', url:h=>`https://instagram.com/${h}`,
      icon:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><rect x="3" y="3" width="18" height="18" rx="5.4"/><circle cx="12" cy="12" r="4"/><circle cx="17.4" cy="6.6" r="1.1" fill="currentColor" stroke="none"/></svg>` },
    tiktok: { label:'TikTok', url:h=>`https://tiktok.com/@${h}`,
      icon:`<svg viewBox="0 0 24 24" fill="currentColor"><path d="M16.5 3c.35 2.35 1.7 3.86 4 4.05v2.86c-1.4.05-2.72-.32-4-1.05v5.86A5.9 5.9 0 1 1 10.6 8.8c.32 0 .63.03.94.08v2.98a2.94 2.94 0 1 0 2.06 2.8V3h2.9Z"/></svg>` },
    twitch: { label:'Twitch', url:h=>`https://twitch.tv/${h}`,
      icon:`<svg viewBox="0 0 24 24" fill="currentColor"><path d="M4.3 3 3 6.2V19h4v2h2.3l2-2H15l4.7-4.7V3H4.3Zm1.9 1.7h11.6v8.9l-2.3 2.3h-3.7l-2 2v-2H6.2V4.7Zm3.8 2.9v4.4h1.7V7.6H10Zm4.6 0v4.4h1.7V7.6h-1.7Z"/></svg>` },
    x: { label:'X', url:h=>`https://x.com/${h}`,
      icon:`<svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.5 3h3l-6.55 7.48L21.7 21h-5.9l-4.2-5.6L6.7 21H3.7l7-8L2.3 3h6l3.8 5.13L17.5 3Zm-1.05 16.1h1.66L7.63 4.8H5.85l10.6 14.3Z"/></svg>` },
  };
  const socialKeys = () => Object.keys(SOCIALS);
  function socialsHTML(){
    const s = profile.socials || {};
    const owner = isOwner();
    const keys = owner ? socialKeys() : socialKeys().filter(k => (s[k]||'').trim());
    if (!keys.length) return '';
    return `<div class="phead__socials">` + keys.map(k => {
      const h = (s[k]||'').replace(/^@/,'').trim();
      const cfg = SOCIALS[k];
      return owner
        ? `<button class="soc soc--${k}${h?' is-on':''}" data-soc="${k}" type="button" title="${cfg.label}" aria-label="${cfg.label}">${cfg.icon}</button>`
        : `<a class="soc soc--${k} is-on" href="${cfg.url(h)}" target="_blank" rel="noopener" title="${cfg.label}" aria-label="${cfg.label}">${cfg.icon}</a>`;
    }).join('') + `</div>`;
  }
  function socialButtonsHTML(){
    const s = profile.socials || {};
    const owner = isOwner();
    const keys = owner ? socialKeys() : socialKeys().filter(k => (s[k]||'').trim());
    if (!keys.length) return '';
    return `<div class="soc-btns">` + keys.map(k => {
      const h = (s[k]||'').replace(/^@/,'').trim(); const cfg = SOCIALS[k];
      const inner = `<span class="soc-btn__ic">${cfg.icon}</span><span class="soc-btn__t">${cfg.label}${h?`<span>@${esc(h)}</span>`:''}</span><span class="soc-btn__go">↗</span>`;
      return owner
        ? `<button class="soc-btn${h?' is-on':''}" data-soc="${k}" type="button">${inner}</button>`
        : `<a class="soc-btn is-on" href="${cfg.url(h)}" target="_blank" rel="noopener">${inner}</a>`;
    }).join('') + `</div>`;
  }
  function bindSocials(root){
    root.querySelectorAll('[data-soc]').forEach(b =>
      b.addEventListener('click', e => { e.stopPropagation(); editSocial(b.dataset.soc); }));
  }

  const hi = $('[data-hi]'), tray = $('[data-hi-tray]');
  const editBtn = $('[data-hi-edit]'), editLbl = $('[data-hi-edit-lbl]');

  const DEFAULT = ['agora', 'favoritos', 'playlist', 'now', 'filmes', 'livros', 'jogos', 'memories'];
  let profile = { widgets: DEFAULT.slice(), bio: '', instagram: '', playlist: '', accent: '', moment: { read:'', watch:'', play:'' }, socials: {}, hiddenCats: [], layout: {}, blocks: {}, cover: '', font: '', quote: '', counter: { label:'', date:'' }, status: { emoji:'', text:'' }, pin: {}, gallery: [], links: [], video: '', week: {}, theme: '' };
  const ACCENTS = ['#f4d9b8', '#e6a4c4', '#a4c8e6', '#a8e0c0', '#d8b4f0', '#f0b48a', '#e8d48a'];
  // fontes curadas (carregadas no index.html) — a pessoa escolhe a cara do Haven dela
  const FONTS = [
    { key:'outfit',   label:'Outfit',   css:"'Outfit',system-ui,sans-serif" },      // limpa (padrão)
    { key:'sora',     label:'Sora',     css:"'Sora',sans-serif" },                   // geométrica moderna
    { key:'space',    label:'Grotesk',  css:"'Space Grotesk',sans-serif" },          // tech/startup
    { key:'bricolage',label:'Bricolage',css:"'Bricolage Grotesque',sans-serif" },    // trendy/editorial
    { key:'quicksand',label:'Quicksand',css:"'Quicksand',sans-serif" },              // arredondada fofa
    { key:'fraunces', label:'Fraunces', css:"'Fraunces',Georgia,serif" },            // serif elegante
    { key:'playfair', label:'Playfair', css:"'Playfair Display',Georgia,serif" },    // serif luxo
    { key:'dmserif',  label:'DM Serif', css:"'DM Serif Display',Georgia,serif" },    // serif display
    { key:'anton',    label:'Anton',    css:"'Anton',Impact,sans-serif" },           // impacto/street
    { key:'orbitron', label:'Orbitron', css:"'Orbitron',sans-serif" },              // techno/y2k
    { key:'pixel',    label:'Pixel',    css:"'Pixelify Sans',monospace" },           // gamer/retrô
    { key:'pirata',   label:'Gótica',   css:"'Pirata One',cursive" },                // blackletter/edgy
    { key:'mono',     label:'Mono',     css:"'Space Mono',ui-monospace,monospace" }, // notion/aesthetic-bio
    { key:'caveat',   label:'Caveat',   css:"'Caveat',cursive" },                    // manuscrita
    { key:'hand',     label:'Handwrite',css:"'Shadows Into Light',cursive" }         // manuscrita casual
  ];
  // fonte carrega sob demanda (perf) — só a escolhida baixa o arquivo
  const FONT_HREF = {
    fraunces:'Fraunces:opsz,wght@9..144,400;9..144,600', space:'Space+Grotesk:wght@400;500;600', dmserif:'DM+Serif+Display',
    caveat:'Caveat:wght@500;700', mono:'Space+Mono:wght@400;700', playfair:'Playfair+Display:wght@500;700',
    sora:'Sora:wght@400;600', quicksand:'Quicksand:wght@400;600', bricolage:'Bricolage+Grotesque:wght@400;600;700',
    anton:'Anton', orbitron:'Orbitron:wght@500;700', pixel:'Pixelify+Sans:wght@400;600', pirata:'Pirata+One', hand:'Shadows+Into+Light'
  };
  const loadedFonts = new Set();
  function ensureFontLoaded(key){
    if (!key || key === 'outfit' || loadedFonts.has(key) || !FONT_HREF[key]) return;
    loadedFonts.add(key);
    const l = document.createElement('link'); l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=' + FONT_HREF[key] + '&display=swap';
    document.head.appendChild(l);
  }
  const loadAllFonts = () => Object.keys(FONT_HREF).forEach(ensureFontLoaded);
  // temas de 1 toque (cor + fonte + cena) — inspirados em refs Notion/link-in-bio; largo apelo (todas as idades)
  const PRESETS = [
    { key:'aurora', label:'Aurora', accent:'',        font:'',         scene:'dawn',      dot:'#f4d9b8' },
    { key:'sage',   label:'Sage',   accent:'#a8e0c0', font:'fraunces', scene:'sage',      dot:'#a8e0c0' },
    { key:'noite',  label:'Noite',  accent:'#8fb8e8', font:'space',    scene:'night',     dot:'#8fb8e8' },
    { key:'rose',   label:'Rosé',   accent:'#e6a4c4', font:'caveat',   scene:'dawn',      dot:'#e6a4c4' },
    { key:'mono',   label:'Mono',   accent:'#e8dfce', font:'dmserif',  scene:'overcast',  dot:'#e8dfce' },
    { key:'sunset', label:'Sunset', accent:'#f0b48a', font:'space',    scene:'rain',      dot:'#f0b48a' },
    { key:'lavanda',label:'Lavanda',accent:'#c9a8f0', font:'dmserif',  scene:'lavender',  dot:'#c9a8f0' }, // Notion clássico
    { key:'noir',   label:'Noir',   accent:'#e0655f', font:'mono',     scene:'noir',      dot:'#e0655f' }, // dark/street, apelo masculino
    { key:'oceano', label:'Oceano', accent:'#7fc7d9', font:'space',    scene:'ocean',     dot:'#7fc7d9' }, // azul costeiro unissex
    { key:'anime',  label:'Anime',  accent:'#f2a9d6', font:'space',    scene:'sakura',    dot:'#f2a9d6' }, // otaku/kawaii
    { key:'lux',    label:'Lux',    accent:'#d9b877', font:'dmserif',  scene:'gold',      dot:'#d9b877' }  // executivo/Faria Lima
  ];
  function applyPreset(p){
    profile.accent = p.accent; profile.font = p.font;
    hi.style.transition = 'opacity .3s var(--ease)'; hi.style.opacity = '.28';  // crossfade suave
    save(); render();
    requestAnimationFrame(() => { hi.style.opacity = '1'; });
    try { if (p.scene) window.HavenWallpaper?.set?.({ mode:'scene', name:p.scene }); } catch {}
    celebrate();
  }
  /* ---------- dopamina: háptica + pop + brilho ---------- */
  const haptic = p => { try { navigator.vibrate && navigator.vibrate(p); } catch {} };
  function popCard(id){
    const el = id === 'phead' ? hi.querySelector('.phead') : hi.querySelector('[data-wid="' + id + '"]');
    if (!el) return; el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop');
    el.addEventListener('animationend', () => el.classList.remove('pop'), { once: true });
  }
  function celebrate(){
    haptic([10, 30, 10]); blip();
    const host = document.createElement('div'); host.className = 'fx-burst';
    for (let i = 0; i < 10; i++){
      const s = document.createElement('i'); const a = (Math.PI * 2 * i) / 10; const d = 54 + Math.random() * 46;
      s.style.setProperty('--tx', Math.round(Math.cos(a) * d) + 'px');
      s.style.setProperty('--ty', Math.round(Math.sin(a) * d) + 'px');
      host.appendChild(s);
    }
    document.body.appendChild(host); setTimeout(() => host.remove(), 900);
  }
  /* som opcional (blip WebAudio) + fx = háptica + som */
  let audioCtx = null;
  const soundOn = () => { try { return localStorage.getItem('haven.sound') === '1'; } catch { return false; } };
  function blip(){
    if (!soundOn()) return;
    try { audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      const o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.frequency.value = 540; o.type = 'sine'; o.connect(g); g.connect(audioCtx.destination);
      g.gain.setValueAtTime(0.05, audioCtx.currentTime); g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.11);
      o.start(); o.stop(audioCtx.currentTime + 0.12);
    } catch {}
  }
  const fx = (h) => { haptic(h || 9); blip(); };

  /* lightbox global (foto em tela cheia) */
  function lightbox(url){
    if (!url) return;
    let el = document.querySelector('.hvlb');
    if (!el){ el = document.createElement('div'); el.className = 'hvlb';
      el.innerHTML = '<img alt="" /><button class="hvlb__x" aria-label="Fechar">✕</button>' +
        '<button class="hvlb__share" data-lb-share type="button" aria-label="Compartilhar no story">' +
        '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15V4"/><path d="M8 8l4-4 4 4"/><path d="M5 13v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5"/></svg> compartilhar</button>';
      const close = () => el.classList.remove('is-on');
      el.addEventListener('click', e => {
        if (e.target.closest('[data-lb-share]')){ const src = el.querySelector('img').src; close(); try { window.HavenShare?.openGallery?.(src); } catch (_) {} return; }
        if (e.target.tagName !== 'IMG') close();
      });
      document.body.appendChild(el);
    }
    el.querySelector('img').src = url; requestAnimationFrame(() => el.classList.add('is-on'));
  }
  window.HavenLightbox = { open: lightbox };

  /* lazy-load de imagens de fundo (data-lb) */
  const lazyIO = ('IntersectionObserver' in window) ? new IntersectionObserver((es, o) => {
    es.forEach(e => { if (e.isIntersecting){ const el = e.target; if (el.dataset.lb){ el.style.backgroundImage = `url('${el.dataset.lb}')`; el.removeAttribute('data-lb'); } o.unobserve(el); } });
  }, { rootMargin: '250px' }) : null;
  function lazyObserve(root){ root.querySelectorAll('[data-lb]').forEach(el => { if (lazyIO) lazyIO.observe(el); else { el.style.backgroundImage = `url('${el.dataset.lb}')`; } }); }

  /* emoji picker curado */
  const EMOJIS = ['✨','💫','🌙','☁️','🌸','🌊','🔥','⚡','🎧','🎮','🎬','📚','☕','🍵','🏋️','🎨','💻','📸','✈️','🌿','🍜','🥂','💎','👑','🖤','🤍','💜','💙','💚','🧠','😴','🥰','😎','🫶','🎯','📈','🚀','🕊️','🌷','🍷','🎸','🌈','🪐','🧋','🍫','🐾'];
  function pickEmoji(cb){
    const el = document.createElement('div'); el.className = 'emojipick';
    el.innerHTML = `<div class="emojipick__panel glass"><span class="fontmenu__lbl">escolha um emoji</span><div class="emojipick__grid"></div></div>`;
    const grid = el.querySelector('.emojipick__grid');
    const close = () => { el.classList.remove('is-on'); setTimeout(() => el.remove(), 180); };
    EMOJIS.forEach(e => { const b = document.createElement('button'); b.type = 'button'; b.textContent = e; b.onclick = () => { close(); cb(e); }; grid.appendChild(b); });
    el.addEventListener('click', ev => { if (ev.target === el) close(); });
    document.body.appendChild(el); requestAnimationFrame(() => el.classList.add('is-on'));
  }
  window.HavenEmoji = { pick: pickEmoji };

  /* input bonito (substitui window.prompt) */
  function askText(label, value, cb, opts){
    opts = opts || {};
    const el = document.createElement('div'); el.className = 'askt';
    el.innerHTML = `<div class="askt__panel glass"><span class="fontmenu__lbl">${esc(label)}</span>
      ${opts.multiline
        ? `<textarea class="askt__in" rows="3" maxlength="${opts.max||280}" placeholder="${esc(opts.ph||'')}">${esc(value||'')}</textarea>`
        : `<input class="askt__in" ${opts.type?`type="${opts.type}"`:''} maxlength="${opts.max||120}" value="${esc(value||'')}" placeholder="${esc(opts.ph||'')}" />`}
      <div class="askt__row"><button class="btn btn--ghost" data-cancel type="button">cancelar</button><button class="btn btn--go" data-ok type="button">salvar</button></div></div>`;
    const inp = el.querySelector('.askt__in');
    const close = () => { el.classList.remove('is-on'); setTimeout(() => el.remove(), 180); };
    el.querySelector('[data-cancel]').onclick = close;
    el.querySelector('[data-ok]').onclick = () => { const v = inp.value; close(); cb(v); };
    el.addEventListener('click', e => { if (e.target === el) close(); });
    inp.addEventListener('keydown', e => { if (e.key === 'Enter' && !opts.multiline){ e.preventDefault(); el.querySelector('[data-ok]').click(); } });
    document.body.appendChild(el); requestAnimationFrame(() => el.classList.add('is-on')); setTimeout(() => inp.focus(), 70);
  }

  /* templates de perfil por nicho */
  const TEMPLATES = [
    { key:'otaku',     label:'Otaku',      preset:'anime',  widgets:['status','now','favoritos','jogos','frase','galeria','social'] },
    { key:'farialima', label:'Faria Lima', preset:'lux',    widgets:['status','frase','contador','livros','links','social'] },
    { key:'leitor',    label:'Leitor',     preset:'sage',   widgets:['livros','favoritos','frase','now','memories','social'] },
    { key:'gamer',     label:'Gamer',      preset:'noir',   widgets:['now','jogos','status','favoritos','galeria','social'] },
    { key:'fitness',   label:'Fitness',    preset:'oceano', widgets:['contador','status','frase','galeria','memories','social'] },
    { key:'criador',   label:'Criador',    preset:'rose',   widgets:['destaque','links','now','favoritos','galeria','social'] }
  ];
  function applyTemplate(t){
    const p = PRESETS.find(x => x.key === t.preset); if (p){ profile.accent = p.accent; profile.font = p.font; try { if (p.scene) window.HavenWallpaper?.set?.({ mode:'scene', name:p.scene }); } catch {} }
    profile.widgets = t.widgets.slice();
    save(); render(); celebrate();
  }
  function applyAccent(){
    const a = profile.accent;
    if (a) document.documentElement.style.setProperty('--accent', a);
    else document.documentElement.style.removeProperty('--accent');
    const f = FONTS.find(x => x.key === profile.font);
    if (f){ document.documentElement.style.setProperty('--user-font', f.css); ensureFontLoaded(profile.font); }
    else document.documentElement.style.removeProperty('--user-font');
    if (profile.theme === 'light') document.documentElement.dataset.theme = 'light'; else document.documentElement.removeAttribute('data-theme');
    // expõe o tema pro card de story usar a mesma fonte/cor (instagramável)
    window.HavenTheme = { font: (f && f.css) || "'Outfit',sans-serif", accent: profile.accent || '' };
  }
  let col = { movie:[], book:[], game:[] }, cats = [], places = [], memories = [], editing = false, preview = false;
  let me = { name: 'Você', photo: null };   // dono/visitante (foto + nome do cabeçalho)
  let firstRun = false;                     // dono sem perfil salvo → mostra onboarding

  const plId = raw => { const m = String(raw||'').match(/playlist[/:]([A-Za-z0-9]+)/); return m ? m[1] : (String(raw||'').trim() || ''); };
  const HERO = '';   // feed: sem hero fixo
  // estrelas douradas (cheias + vazias) sobre um scrim — igual à Coleção
  const pstars = r => r ? `<span class="pcard__scrim"></span><b class="pcard__stars">${'★'.repeat(r)}<i>${'★'.repeat(5-r)}</i></b>` : '';
  const gstars = r => r ? `<span class="gcard__scrim"></span><em class="gcard__star">${'★'.repeat(r)}<i>${'★'.repeat(5-r)}</i></em>` : '';
  const pcard = i => `<div class="pcard"><span class="pcard__art" style="background-image:url('${i.poster}')">${pstars(i.rating)}</span><em>${esc(i.title)}</em></div>`;
  // card de item de categoria custom — vira link se tiver CTA (pro visitante clicar)
  const catCard = i => {
    const art = `<span class="pcard__art"${i.poster?` style="background-image:url('${esc(i.poster)}')"`:''}>${!i.poster?`<b class="pcard__ph">${esc((i.title||'?')[0])}</b>`:''}${pstars(i.rating)}${i.link?'<span class="pcard__go">↗</span>':''}</span><em>${esc(i.title)}</em>`;
    return i.link
      ? `<a class="pcard pcard--link" href="${esc(i.link)}" target="_blank" rel="noopener" onclick="event.stopPropagation()">${art}</a>`
      : `<div class="pcard">${art}</div>`;
  };
  // card de GRADE (variação estilo iPhone) — quadrado, vira link se tiver CTA
  const gcard = i => {
    const art = `<span class="gcard__art"${i.poster?` style="background-image:url('${esc(i.poster)}')"`:''}>${!i.poster?`<b class="gcard__ph">${esc((i.title||'?')[0])}</b>`:''}${gstars(i.rating)}${i.link?'<span class="gcard__go">↗</span>':''}</span><em class="gcard__t">${esc(i.title||'')}</em>`;
    return i.link
      ? `<a class="gcard gcard--link" href="${esc(i.link)}" target="_blank" rel="noopener" onclick="event.stopPropagation()">${art}</a>`
      : `<div class="gcard">${art}</div>`;
  };
  const shelfGrid = items => `<div class="shelf__grid">${items.map(gcard).join('')}</div>`;
  function buildCatShelf(c, key, v){
    const def = cats.find(x => x.key === key); if (!def) return;
    c.style.setProperty('--cc', def.color || 'var(--accent)');
    if (def.cover) c.classList.add('card--cover');
    const items = (col[key] || []).filter(i => i.poster || i.title);
    const cover = def.cover ? `<div class="cat-cover" style="background-image:url('${esc(def.cover)}')"><b>${def.emoji||''} ${esc(def.label)}</b></div>` : '';
    const head = def.cover ? '' : `<div class="shelf__head"><span class="shelf__title"><span class="shelf__dot"></span>${def.emoji||''} ${esc(def.label)}</span>${items.length?`<span class="shelf__meta">${items.length}</span>`:''}</div>`;
    if (!items.length){ c.innerHTML = cover + head + `<div class="shelf__empty">${isOwner()?'adicione itens na Coleção':'—'}</div>`; return; }
    const sorted = [...items].sort((a,b)=>(b.addedAt||0)-(a.addedAt||0)).slice(0,12);
    c.innerHTML = cover + head + (v === 1 ? shelfGrid(sorted) : `<div class="shelf__row">${sorted.map(catCard).join('')}</div>`);
  }
  function shelfHTML(label, meta, items, empty, sq){
    return `<div class="shelf__head"><span class="shelf__title">${label}</span>${meta?`<span class="shelf__meta">${meta}</span>`:''}</div>
      ${items ? `<div class="shelf__row${sq?' shelf__row--sq':''}">${items}</div>` : `<div class="shelf__empty">${empty}</div>`}`;
  }
  // prateleira built-in com variação lista(0) ↔ grade(1)
  function shelfCard(c, arr, label, empty, v){
    const items = arr.filter(i => i.poster || i.title);
    const meta = items.length ? String(items.length) : '';
    if (v === 1 && items.length) c.innerHTML = `<div class="shelf__head"><span class="shelf__title">${label}</span><span class="shelf__meta">${meta}</span></div>${shelfGrid(items)}`;
    else c.innerHTML = shelfHTML(label, meta, items.map(pcard).join(''), empty);
  }
  const catShelf = (arr, label, empty) => shelfHTML(label, arr.length ? `${arr.length}` : '', arr.filter(i=>i.poster).map(pcard).join(''), empty);

  /* now-playing real: lê data/now-playing.json (GitHub Action escreve); fallback fica */
  let npCache = null, npTried = false;
  function fetchNowPlaying(c){
    const set = (t, a) => { const tt = c.querySelector('[data-np-title]'), aa = c.querySelector('[data-np-artist]'); if (tt && t) tt.textContent = t; if (aa != null && a != null) aa.textContent = a; };
    if (npCache){ set(npCache.title, npCache.artist); return; }
    if (npTried) return; npTried = true;
    fetch('data/now-playing.json', { cache: 'no-store' }).then(r => r.ok ? r.json() : null)
      .then(j => { if (j && j.title){ npCache = { title: j.title, artist: j.artist || '' }; set(npCache.title, npCache.artist); } }).catch(() => {});
  }
  /* ---------- widgets = prateleiras estilo Netflix ---------- */
  const WIDGETS = {
    now: { label:'Som', open:'music', variants:2, build(c, v){
      c.classList.add('w', 'w-now');
      if (v === 1){ // compacto
        c.classList.add('w-now--compact');
        c.innerHTML = `<span class="now__play" aria-hidden="true"><svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M8 5v14l11-7z"/></svg></span>
          <div class="now__meta"><b class="now__title" data-np-title>Snowfall</b>
          <span class="now__artist" data-np-artist>Øneheart &amp; reidenshi</span></div>`;
        fetchNowPlaying(c); return;
      }
      c.innerHTML = `<span class="now__art" aria-hidden="true"><i></i></span>
        <div class="now__meta"><span class="hi__label">Ouvindo agora</span>
        <b class="now__title" data-np-title>Snowfall</b>
        <span class="now__artist" data-np-artist>Øneheart &amp; reidenshi</span></div>
        <span class="now__play" aria-hidden="true"><svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M8 5v14l11-7z"/></svg></span>
        <div class="now__bar" aria-hidden="true"><i style="--p:38%"></i></div>`;
      fetchNowPlaying(c);
    }},
    playlist: { label:'Playlist', edit:'playlist', open:'music', variants:2, build(c, v){
      const id = plId(profile.playlist);
      if (!id){ c.classList.add('w','w-pl');
        c.innerHTML = `<span class="hi__label">Playlist em destaque</span><div class="w-empty">${editing ? 'toque pra escolher uma playlist do Spotify' : 'nenhuma playlist ainda'}</div>`; return; }
      if (v === 1){ // barra compacta
        c.classList.add('pl-compact');
        c.innerHTML = `<span class="pl-compact__cover" data-pl-bg></span>
          <div class="pl-compact__meta"><span class="hi__label">Playlist</span><b data-pl-name>Sua playlist</b></div>
          <span class="pl-compact__play"><svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><path d="M8 5v14l11-7z"/></svg></span>`;
      } else {
        c.classList.add('pl-card');
        c.innerHTML = `<div class="pl-card__bg" data-pl-bg></div><div class="pl-card__scrim"></div>
          <div class="pl-card__body">
            <span class="hi__label">Playlist em destaque</span>
            <b class="pl-card__name" data-pl-name>Sua playlist</b>
            <span class="pl-card__play"><svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M8 5v14l11-7z"/></svg> ouvir</span>
          </div>`;
      }
      fetch(`https://open.spotify.com/oembed?url=https://open.spotify.com/playlist/${id}`).then(r=>r.json()).then(j=>{
        const bg = c.querySelector('[data-pl-bg]'); if (bg && j.thumbnail_url) bg.style.backgroundImage = `url('${j.thumbnail_url}')`;
        const nm = c.querySelector('[data-pl-name]'); if (nm && j.title) nm.textContent = j.title;
      }).catch(()=>{});
    }},
    agora: { label:'No momento', variants:2, build(c, v){
      c.classList.add('w', 'w-moment');
      const m = profile.moment || {};
      if (v === 1){ // chips compactos
        const chip = (icon, key, ph) => { const val = (m[key]||'').trim();
          return `<button class="mchip" type="button" data-moment="${key}"${isOwner()?'':' disabled'}><span class="mchip__ic">${icon}</span><span class="mchip__t">${val?esc(val):(isOwner()?esc(ph):'—')}</span></button>`; };
        c.innerHTML = `<span class="hi__label">No momento</span><div class="mchips">
          ${chip('📖','read','lendo')}${chip('🎬','watch','vendo')}${chip('🎮','play','jogando')}</div>`;
      } else {
        const line = (icon, key, ph) => { const val = (m[key]||'').trim();
          return `<button class="moment__row" type="button" data-moment="${key}"${isOwner()?'':' disabled'}>
            <span class="moment__ic">${icon}</span>
            <span class="moment__txt">${val ? esc(val) : (isOwner()?`<span class="hi__ph">${ph}</span>`:'—')}</span></button>`; };
        c.innerHTML = `<span class="hi__label">No momento</span>
          <div class="moment">${line('📖','read','o que você tá lendo')}${line('🎬','watch','o que você tá vendo')}${line('🎮','play','o que você tá jogando')}</div>`;
      }
      if (isOwner()) c.querySelectorAll('[data-moment]').forEach(b =>
        b.addEventListener('click', e => { e.stopPropagation(); editMoment(b.dataset.moment); }));
    }},
    favoritos: { label:'Favoritos', open:'catalog', plain:true, variants:2, build(c, v){
      const all = [...(col.movie||[]), ...(col.book||[]), ...(col.game||[])].filter(i => i.poster && i.rating);
      all.sort((a,b) => (b.rating||0) - (a.rating||0));
      shelfCard(c, all.slice(0,8), 'Favoritos', isOwner() ? 'dê 5★ a algo e ele aparece aqui' : '', v);
    }},
    filmes: { label:'Filmes', open:'catalog', plain:true, variants:2, build(c, v){ shelfCard(c, col.movie||[], 'Filmes', 'seus filmes aparecem aqui', v); }},
    livros: { label:'Livros', open:'catalog', plain:true, variants:2, build(c, v){ shelfCard(c, col.book||[], 'Livros', 'seus livros aparecem aqui', v); }},
    jogos:  { label:'Jogos',  open:'catalog', plain:true, variants:2, build(c, v){ shelfCard(c, col.game||[], 'Jogos', 'seus jogos aparecem aqui', v); }},
    memories: { label:'Memórias', open:'map', plain:true, variants:2, build(c, v){
      const dots = [...new Set(places.map(p=>p.cat))].slice(0,6).map(k=>`<i style="background:${CAT[k]||CAT.outro}"></i>`).join('');
      const meta = `${places.length} lugares <span class="w-dots">${dots}</span>`;
      if (v === 1 && memories.length){
        c.innerHTML = `<div class="shelf__head"><span class="shelf__title">Memórias</span><span class="shelf__meta">${meta}</span></div>${shelfGrid(memories.map(m=>({poster:m.url})))}`;
      } else {
        const shots = memories.map(m=>`<div class="pcard pcard--sq"><span class="pcard__art" style="background-image:url('${m.url}')"></span></div>`).join('');
        c.innerHTML = shelfHTML('Memórias', meta, shots, 'fotos dos seus lugares aparecem aqui', true);
      }
    }},
    bio: { label:'Bio', edit:'bio', variants:2, build(c, v){
      c.classList.add('w', 'w-bio');
      const txt = profile.bio ? esc(profile.bio) : '<span class="hi__ph">toque pra escrever…</span>';
      if (v === 1){ c.classList.add('w-bio--quote'); c.innerHTML = `<p class="w-bioquote">“${txt}”</p>`; }
      else c.innerHTML = `<span class="hi__label">Sobre</span><p class="w-biotext">${txt}</p>`;
    }},
    social: { label:'Redes', variants:2, build(c, v){
      c.classList.add('w', 'w-social');
      if (v === 1){ c.classList.add('w-social--btns'); c.innerHTML = `<span class="hi__label">Redes</span>${socialButtonsHTML() || `<div class="w-empty">${isOwner()?'toque pra adicionar suas redes':'sem redes'}</div>`}`; bindSocials(c); return; }
      const row = socialsHTML();
      c.innerHTML = `<span class="hi__label">Redes</span>${row || `<div class="w-empty">${isOwner()?'toque pra adicionar suas redes':'sem redes'}</div>`}`;
      bindSocials(c);
    }},
    frase: { label:'Frase', edit:'quote', variants:2, build(c, v){
      c.classList.add('w', 'w-frase');
      const q = profile.quote ? esc(profile.quote) : (isOwner() ? '<span class="hi__ph">toque pra escrever uma frase</span>' : '');
      if (v === 1){ c.classList.add('w-frase--big'); c.innerHTML = `<p class="frase__big">${q}</p>`; }
      else c.innerHTML = `<span class="frase__mark">"</span><p class="frase__txt">${q}</p>`;
    }},
    contador: { label:'Contador', editFn: () => editCounter(), build(c){
      c.classList.add('w', 'w-count');
      const ct = profile.counter || {};
      const days = ct.date ? Math.ceil((new Date(ct.date + 'T00:00:00') - new Date(new Date().toDateString())) / 864e5) : null;
      if (days === null){ c.innerHTML = `<span class="hi__label">Contador</span><div class="w-empty">${isOwner()?'toque pra criar uma contagem':'—'}</div>`; return; }
      const n = Math.abs(days);
      c.innerHTML = `<span class="hi__label">${days < 0 ? 'faz' : 'faltam'}</span>
        <b class="count__n">${n}</b><span class="count__u">${n === 1 ? 'dia' : 'dias'}${days < 0 ? ' atrás' : ''}</span>
        <span class="count__lbl">${esc(ct.label || '')}</span>`;
    }},
    status: { label:'Status', editFn: () => editStatus(), build(c){
      c.classList.add('w', 'w-status');
      const s = profile.status || {};
      if (s.emoji || s.text) c.innerHTML = `<span class="status__em">${esc(s.emoji || '💭')}</span><span class="status__t">${s.text ? esc(s.text) : ''}</span>`;
      else c.innerHTML = `<span class="hi__label">Status</span><div class="w-empty">${isOwner()?'toque pra dizer como você tá':'—'}</div>`;
    }},
    destaque: { label:'Destaque', editFn: () => editPin(), variants:2, build(c, v){
      c.classList.add('w-pin'); const pn = profile.pin || {};
      if (!pn.img){ c.classList.add('w'); c.innerHTML = `<span class="hi__label">Destaque</span><div class="w-empty">${isOwner()?'toque pra destacar uma foto':'—'}</div>`; return; }
      c.classList.add('card--cover');
      const bodyHTML = (pn.title || pn.caption) ? `<div class="pin__body">${pn.title?`<b>${esc(pn.title)}</b>`:''}${pn.caption?`<span>${esc(pn.caption)}</span>`:''}</div>` : '';
      if (v === 1){ // full-bleed com texto sobreposto
        c.classList.add('w-pin--full');
        c.innerHTML = `<div class="pin__img" style="background-image:url('${esc(pn.img)}')">${pn.link?'<span class="pin__go">↗</span>':''}${bodyHTML}</div>`;
      } else {
        c.innerHTML = `<div class="pin__img" style="background-image:url('${esc(pn.img)}')">${pn.link?'<span class="pin__go">↗</span>':''}</div>${bodyHTML}`;
      }
      if (!editing && pn.link) c._link = pn.link;
      else if (!editing && !pn.link) c.querySelector('.pin__img')?.addEventListener('click', e => { e.stopPropagation(); lightbox(pn.img); });
    }},
    galeria: { label:'Galeria', plain:true, variants:3, build(c, v){
      c.classList.add('w-gal');
      const g = profile.gallery || [];
      const cells = g.map((it, i) => `<div class="gal__cell" data-lb="${esc(it.url||'')}">${(editing&&isOwner())?`<button class="gal__x" data-galx="${i}" aria-label="Remover">✕</button>`:''}</div>`).join('');
      const add = (isOwner() && editing) ? `<button class="gal__add" data-galadd aria-label="Adicionar foto">＋</button>` : '';
      c.innerHTML = `<div class="shelf__head"><span class="shelf__title">Galeria</span></div>` +
        ((g.length || add) ? `<div class="gal gal--v${v}">${cells}${add}</div>` : `<div class="w-empty">${isOwner()?'entre no modo editar pra adicionar fotos':'—'}</div>`);
      lazyObserve(c);
      if (isOwner() && editing){
        c.querySelector('[data-galadd]')?.addEventListener('click', e => { e.stopPropagation(); pickImage(({id,url}) => { profile.gallery = profile.gallery || []; profile.gallery.push({ id, url }); save(); render(); }); });
        c.querySelectorAll('[data-galx]').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); profile.gallery.splice(+b.dataset.galx, 1); save(); render(); }));
        c.querySelectorAll('.gal__cell').forEach((cell, i) => cell.addEventListener('pointerdown', e => { if (e.target.closest('.gal__x')) return; galDragStart(e, i, c); }));
      } else {
        c.querySelectorAll('.gal__cell').forEach((cell, i) => cell.addEventListener('click', e => { e.stopPropagation(); lightbox((profile.gallery[i]||{}).url); }));
      }
    }},
    links: { label:'Links', editFn: () => editLinks(), build(c){
      c.classList.add('w', 'w-links');
      const ls = profile.links || [];
      if (!ls.length){ c.innerHTML = `<span class="hi__label">Links</span><div class="w-empty">${isOwner()?'toque pra adicionar links':'—'}</div>`; return; }
      c.innerHTML = `<span class="hi__label">Links</span><div class="links">` + ls.map((l, i) =>
        `<a class="linkbtn" href="${esc(l.url)}" target="_blank" rel="noopener" onclick="event.stopPropagation()">
           <span class="linkbtn__ic">${esc(l.emoji || '🔗')}</span><b>${esc(l.label || 'link')}</b>
           ${(editing&&isOwner())?`<button class="linkbtn__x" data-linkx="${i}" aria-label="Remover">✕</button>`:'<em>↗</em>'}</a>`).join('') + `</div>`;
      if (editing && isOwner()) c.querySelectorAll('[data-linkx]').forEach(b => b.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); profile.links.splice(+b.dataset.linkx, 1); save(); render(); }));
    }},
    video: { label:'Vídeo', editFn: () => editVideo(), build(c){
      c.classList.add('w-video'); const url = profile.video || '';
      const yt = (String(url).match(/(?:v=|youtu\.be\/|shorts\/|embed\/)([A-Za-z0-9_-]{11})/) || [])[1];
      if (yt){ c.classList.add('card--cover'); c.innerHTML = `<div class="video__wrap"><iframe src="https://www.youtube.com/embed/${yt}?rel=0&modestbranding=1" allow="encrypted-media; picture-in-picture" allowfullscreen loading="lazy"></iframe></div>`; return; }
      if (url){ c.innerHTML = `<span class="hi__label">Vídeo</span><a class="linkbtn" href="${esc(url)}" target="_blank" rel="noopener" onclick="event.stopPropagation()"><span class="linkbtn__ic">▶</span><b>abrir vídeo</b><em>↗</em></a>`; if (!editing) c._link = url; return; }
      c.classList.add('w'); c.innerHTML = `<span class="hi__label">Vídeo</span><div class="w-empty">${isOwner()?'toque pra colar um link (YouTube/TikTok/Reel)':'—'}</div>`;
    }},
    topmes: { label:'Top do mês', open:'catalog', plain:true, build(c){
      const all = [...(col.movie||[]), ...(col.book||[]), ...(col.game||[])].filter(i => i.poster && i.rating)
        .sort((a,b) => (b.rating||0)-(a.rating||0) || (b.addedAt||0)-(a.addedAt||0));
      const top = all[0];
      if (!top){ c.innerHTML = `<span class="hi__label">Top do mês</span><div class="w-empty">${isOwner()?'avalie itens na Coleção':'—'}</div>`; return; }
      c.classList.add('card--cover');
      c.innerHTML = `<div class="pin__img" style="background-image:url('${esc(top.poster)}')"><span class="topmes__tag">★ TOP DO MÊS</span></div><div class="pin__body"><b>${esc(top.title)}</b><span>${'★'.repeat(top.rating)}</span></div>`;
    }},
    cidade: { label:'Minha cidade', open:'map', plain:true, build(c){
      const dots = [...new Set(places.map(p=>p.cat))].slice(0,6).map(k=>`<i style="background:${CAT[k]||CAT.outro}"></i>`).join('');
      c.innerHTML = `<div class="shelf__head"><span class="shelf__title">📍 Minha cidade</span></div>
        <div class="cidade"><b class="cidade__n">${places.length}</b><span class="cidade__u">lugares <span class="w-dots">${dots}</span></span></div>`;
    }},
    semana: { label:'Semana', build(c){
      c.classList.add('w', 'w-week'); const wk = profile.week || {};
      const days = ['seg','ter','qua','qui','sex','sáb','dom'], keys = ['mon','tue','wed','thu','fri','sat','sun'];
      c.innerHTML = `<span class="hi__label">Semana</span><div class="week">` +
        keys.map((k,i) => `<button class="week__d" type="button" data-week="${k}"${isOwner()?'':' disabled'}><span class="week__em">${esc(wk[k]||'·')}</span><span class="week__lbl">${days[i]}</span></button>`).join('') + `</div>`;
      if (isOwner()) c.querySelectorAll('[data-week]').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); pickEmoji(em => { profile.week = profile.week || {}; profile.week[b.dataset.week] = em; save(); render(); }); }));
    }}
  };

  /* ---------- layout (largura/altura por widget, estilo Notion) ---------- */
  const WDEF = {
    now:{w:'sm'}, bio:{w:'sm'}, social:{w:'sm'}, agora:{w:'md'}, playlist:{w:'md'},
    favoritos:{w:'md'}, filmes:{w:'md'}, livros:{w:'md'}, jogos:{w:'md'}, memories:{w:'md'},
    frase:{w:'md'}, contador:{w:'sm'}, status:{w:'sm'}, destaque:{w:'md'}, galeria:{w:'md'}, links:{w:'md'},
    video:{w:'md'}, topmes:{w:'md'}, cidade:{w:'sm'}, semana:{w:'md'}
  };
  function defaultWH(id){
    if (id.startsWith('cat:')) return { w:'md', h:'auto' };
    if (id.startsWith('blk:')){ const b = (profile.blocks||{})[id.slice(4)];
      return { w: b?.type==='title' ? 'lg' : (b?.type==='link'||b?.type==='sticker') ? 'sm' : 'md', h:'auto' }; }
    return { w:(WDEF[id]?.w)||'md', h:'auto' };
  }
  function layoutFor(id){ const l = (profile.layout||{})[id] || {}; const d = defaultWH(id); return { w:l.w||d.w, h:l.h||d.h, v:l.v||0, font:l.font||'' }; }
  function openFontMenu(id){
    loadAllFonts();
    const cur = layoutFor(id).font || '';
    const el = document.createElement('div'); el.className = 'fontmenu';
    el.innerHTML = `<div class="fontmenu__panel glass"><span class="fontmenu__lbl">fonte deste card</span><div class="fontmenu__list"></div></div>`;
    const list = el.querySelector('.fontmenu__list');
    const mk = (key, label, css) => { const b = document.createElement('button'); b.type = 'button';
      b.className = 'fontchip' + (cur === key ? ' is-on' : ''); b.textContent = label; b.style.fontFamily = css || 'inherit';
      b.onclick = () => { close(); setLayout(id, { font: key }); }; list.appendChild(b); };
    mk('', 'Padrão', 'inherit');
    FONTS.forEach(f => mk(f.key, f.label, f.css));
    const close = () => { el.classList.remove('is-on'); setTimeout(() => el.remove(), 200); };
    el.addEventListener('click', e => { if (e.target === el) close(); });
    document.body.appendChild(el); requestAnimationFrame(() => el.classList.add('is-on'));
  }
  function setLayout(id, patch){ profile.layout = profile.layout || {}; profile.layout[id] = { ...layoutFor(id), ...patch }; save(); render(); popCard(id); fx(9); }

  /* ---------- blocos livres (nota · link/CTA · título) ---------- */
  function buildBlock(c, id){
    const b = (profile.blocks||{})[id.slice(4)]; if (!b) return;
    if (b.type === 'title'){
      c.classList.add('w','blk','blk-title');
      c.innerHTML = `<span class="blk-title__t">${b.text ? esc(b.text) : (isOwner()?'<span class="hi__ph">título…</span>':'')}</span>`;
    } else if (b.type === 'link'){
      c.classList.add('w','blk','blk-link'); c.style.setProperty('--cc', b.color || 'var(--accent)');
      c.innerHTML = `<span class="blk-link__ic">${esc(b.emoji||'🔗')}</span>
        <span class="blk-link__t"><b>${b.label?esc(b.label):(isOwner()?'seu link':'link')}</b>${b.url?`<span>${esc(b.url.replace(/^https?:\/\//,''))}</span>`:''}</span>
        <span class="blk-link__go">↗</span>`;
      if (!editing && b.url) c._link = b.url;
    } else if (b.type === 'sticker'){
      c.classList.add('w','blk','blk-sticker');
      c.innerHTML = `<span class="sticker__em">${esc(b.text || '✨')}</span>`;
    } else {
      c.classList.add('w','blk','blk-note');
      c.innerHTML = `<p class="blk-note__t">${b.text ? esc(b.text) : (isOwner()?'<span class="hi__ph">toque pra escrever…</span>':'')}</p>`;
    }
  }
  function createBlock(type){
    profile.blocks = profile.blocks || {};
    const id = 'b' + Date.now();
    profile.blocks[id] = { type, text:'', label:'', url:'', emoji: type==='link'?'🔗':'' };
    profile.widgets.push('blk:' + id);
    save(); render();
    setTimeout(() => editBlock('blk:' + id), 60);
  }
  function editBlock(id){
    const b = (profile.blocks||{})[id.slice(4)]; if (!b) return;
    if (b.type === 'sticker'){ pickEmoji(e => { b.text = e; save(); render(); }); return; }
    if (b.type === 'title'){ const v = prompt('Título:', b.text||''); if (v===null) return; b.text = v.trim(); }
    else if (b.type === 'link'){
      const label = prompt('Texto do botão:', b.label||''); if (label===null) return;
      const url = prompt('Link (URL):', b.url||''); if (url===null) return;
      const emoji = prompt('Emoji (opcional):', b.emoji||'🔗'); if (emoji!==null) b.emoji = emoji.trim().slice(0,2) || '🔗';
      b.label = label.trim(); b.url = url.trim();
    } else { const v = prompt('Sua nota:', b.text||''); if (v===null) return; b.text = v.trim(); }
    save(); render();
  }

  /* ---------- render ---------- */
  function widgetEl(id){
    let w, isBlk = id.startsWith('blk:');
    if (id.startsWith('cat:')){
      const key = id.slice(4); const def = cats.find(x => x.key === key); if (!def) return null;
      w = { label: def.label, plain: true, variants: 2, open: isOwner() ? 'catalog' : undefined, build: (c, v) => buildCatShelf(c, key, v) };
    } else if (isBlk){
      if (!(profile.blocks||{})[id.slice(4)]) return null;
      w = { label:'Bloco', build: c => buildBlock(c, id) };
    } else { w = WIDGETS[id]; }
    if (!w) return null;
    const c = document.createElement('div');
    c.className = 'glass hi__card card' + (w.plain ? ' card--shelf' : '');
    c.dataset.wid = id;
    const wh = layoutFor(id);
    const variants = w.variants || 1;
    const v = wh.v % variants;
    c.classList.add('w-' + wh.w);
    if (wh.h && wh.h !== 'auto') c.classList.add('h-' + wh.h);
    w.build(c, v);
    const wf = FONTS.find(f => f.key === wh.font); if (wf){ c.style.fontFamily = wf.css; ensureFontLoaded(wh.font); }   // fonte só deste card
    if (w.open && !editing){ const g = document.createElement('span'); g.className = 'tile__go'; g.setAttribute('aria-hidden','true'); g.textContent = '↗'; c.appendChild(g); }
    c.addEventListener('click', (e) => {
      if (justDragged) return;   // acabou de arrastar: não abre o editor
      if (e.target.closest('.hi__ctl') || e.target.closest('.hi__edge') || e.target.closest('iframe') || e.target.closest('a')) return;
      if (editing){ if (isBlk) editBlock(id); else if (w.editFn) w.editFn(); else if (w.edit) editField(w.edit); return; }
      if (w.open) window.HavenGo?.(w.open);
      else if (c._link) window.open(c._link, '_blank', 'noopener');
    });
    if (editing){
      c.classList.add('is-edit');
      const ctl = document.createElement('div'); ctl.className = 'hi__ctl';
      ctl.innerHTML =
        `<button class="hi__grip" data-drag aria-label="Arrastar" title="Arraste pra mover">⠿</button>
         ${variants > 1 ? '<button data-var aria-label="Estilo" title="Trocar estilo">◱</button>' : ''}
         <button class="hi__font" data-font aria-label="Fonte" title="Fonte deste card">Aa</button>
         <button data-rm aria-label="Remover" title="Remover">✕</button>`;
      ctl.querySelector('[data-var]')?.addEventListener('click', e => { e.stopPropagation(); setLayout(id, { v: (wh.v + 1) % variants }); });
      ctl.querySelector('[data-font]').onclick = e => { e.stopPropagation(); openFontMenu(id); };
      ctl.querySelector('[data-rm]').onclick = e => { e.stopPropagation(); remove(id); };
      c.appendChild(ctl);
      // puxadores de borda: largura (direita) e altura (baixo) — arrasta OU toca pra ciclar
      const ew = document.createElement('button');
      ew.className = 'hi__edge hi__edge--w'; ew.type = 'button';
      ew.setAttribute('aria-label', 'Largura'); ew.title = 'Arraste ou toque pra mudar a largura';
      ew.addEventListener('pointerdown', e => resizeStart(e, id, 'w'));
      c.appendChild(ew);
      const sh = document.createElement('button');
      sh.className = 'hi__edge hi__edge--h'; sh.type = 'button';
      sh.setAttribute('aria-label', 'Altura'); sh.title = 'Arraste ou toque pra mudar a altura';
      sh.addEventListener('pointerdown', e => resizeStart(e, id, 'h'));
      c.appendChild(sh);
    }
    return c;
  }
  const recentCol = () => [...(col.movie||[]), ...(col.book||[]), ...(col.game||[])];
  function spotlightItem(){
    const all = recentCol().filter(i => i.poster);
    if (!all.length) return null;
    // prefere item COM backdrop landscape (billboard cinematográfico, sem esticar pôster)
    const withBd = all.filter(i => i.backdrop);
    const pool = withBd.length ? withBd : all;
    return pool.slice().sort((a,b)=>(b.rating||0)-(a.rating||0) || (b.addedAt||0)-(a.addedAt||0))[0];
  }
  async function setBillBg(el, it){
    if (it.backdrop){ el.style.backgroundImage = `url('${it.backdrop}')`; return; }
    if (it.type === 'movie' && String(it.id).startsWith('movie:') && window.HAVEN_KEYS?.tmdb){
      try { const id = String(it.id).split(':')[1];
        const j = await fetch(`https://api.themoviedb.org/3/movie/${id}?api_key=${window.HAVEN_KEYS.tmdb}`).then(r=>r.json());
        if (j.backdrop_path){ el.style.backgroundImage = `url('https://image.tmdb.org/t/p/w780${j.backdrop_path}')`; return; }
      } catch {}
    }
    el.style.backgroundImage = `url('${it.poster}')`;
  }
  function billboard(){
    const it = spotlightItem(); if (!it) return null;
    const kind = it.type==='movie' ? 'Filme' : it.type==='book' ? 'Livro' : 'Jogo';
    const c = document.createElement('div');
    c.className = 'glass hi__card bill';
    c.innerHTML = `<div class="bill__bg" data-bill-bg></div><div class="bill__scrim"></div>
      <div class="bill__body">
        <span class="bill__tag">Em destaque · ${kind}</span>
        <b class="bill__title">${esc(it.title)}</b>
        ${it.rating ? `<span class="bill__stars">${'★'.repeat(it.rating)}<i>${'★'.repeat(5-it.rating)}</i></span>` : ''}
        <button class="bill__play"><svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><path d="M8 5v14l11-7z"/></svg> ver na coleção</button>
      </div>`;
    setBillBg(c.querySelector('[data-bill-bg]'), it);
    c.addEventListener('click', () => window.HavenGo?.('catalog'));
    return c;
  }

  // escolhe uma imagem (upload) e devolve {id,url} — usado pra capa e avatar
  function pickImage(cb){
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*'; inp.hidden = true;
    document.body.appendChild(inp);
    inp.addEventListener('change', async () => {
      const f = inp.files && inp.files[0]; inp.remove(); if (!f) return;
      try { const id = await db()?.putPhoto?.(f); const url = id ? await db()?.photoURL?.(id) : null; cb({ id, url }); } catch {}
    });
    inp.click();
  }
  const CAM = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z"/><circle cx="12" cy="13" r="3.2"/></svg>`;
  function headerCard(){
    const c = document.createElement('div');
    const cover = profile.cover;
    const hv = layoutFor('phead').v % 3;
    c.className = 'glass hi__card phead phead--v' + hv + (cover ? ' phead--hascover' : '');
    const total = (col.movie?.length||0)+(col.book?.length||0)+(col.game?.length||0);
    const photo = profile.photo || me.photo;
    c.innerHTML = `
      <div class="phead__cover"${cover ? ` style="background-image:url('${esc(cover)}')"` : ''}>
        ${isOwner() ? `<button class="phead__coverbtn" data-cover type="button" title="Trocar capa">${CAM}<span>capa</span></button>` : ''}
      </div>
      <div class="phead__ava"${photo ? ` style="background-image:url('${esc(photo)}')"` : ''}>${photo ? '' : esc((me.name||'?')[0])}
        ${isOwner() ? `<button class="phead__avabtn" data-ava type="button" aria-label="Trocar foto">${CAM}</button>` : ''}</div>
      <div class="phead__info">
        <b class="phead__name">${esc(me.name||'Você')}</b>
        ${socialsHTML()}
        <p class="phead__bio">${profile.bio ? esc(profile.bio) : (isOwner() ? '<span class="hi__ph">toque pra escrever sua bio</span>' : '')}</p>
        <div class="phead__stats"><span><b>${total}</b> títulos</span><span><b>${places.length}</b> lugares</span></div>
        ${isOwner() ? `<div class="phead__actions">
          <button class="phead__share" data-share-link type="button">
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7"/><path d="M16 6l-4-4-4 4"/><path d="M12 2v13"/></svg>
            <span data-share-lbl>Compartilhar meu Haven</span></button>
          <button class="phead__card" data-share-card type="button" title="Gerar card pro story">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="3" width="16" height="18" rx="3"/><circle cx="9" cy="9" r="1.6"/><path d="m4 17 4-4 3 3 4-4 5 5"/></svg>
          </button>
        </div>` : ''}
      </div>`;
    if (isOwner()){
      c.querySelector('.phead__bio').addEventListener('click', () => editField('bio'));
      bindSocials(c);
      c.querySelector('[data-cover]')?.addEventListener('click', () => pickImage(({id,url}) => { profile.coverId = id; profile.cover = url || profile.cover; save(); render(); }));
      c.querySelector('[data-ava]')?.addEventListener('click', () => pickImage(({id,url}) => { profile.photoId = id; profile.photo = url || profile.photo; save(); render(); }));
      c.querySelector('[data-share-link]')?.addEventListener('click', e => shareLink(e.currentTarget));
      c.querySelector('[data-share-card]')?.addEventListener('click', shareProfileCard);
      if (editing){   // perfil também tem estilos (não removível)
        c.classList.add('is-edit');
        const ctl = document.createElement('div'); ctl.className = 'hi__ctl';
        ctl.innerHTML = `<button data-var aria-label="Estilo do perfil" title="Trocar estilo do perfil">◱</button>`;
        ctl.querySelector('[data-var]').onclick = e => { e.stopPropagation(); setLayout('phead', { v: (hv + 1) % 3 }); };
        c.appendChild(ctl);
      }
    }
    return c;
  }
  function inviteCard(){
    const c = document.createElement('div');
    c.className = 'glass hi__card invite';
    const first = (me.name || 'essa pessoa').split(' ')[0];
    c.innerHTML = `
      <span class="invite__spark">✨</span>
      <b class="invite__title">Esse é o Haven de ${esc(first)}.</b>
      <p class="invite__sub">Monte o seu — um cantinho que mostra quem você é, no link da sua bio.</p>
      <a class="invite__go" href="./">Criar meu Haven grátis</a>`;
    return c;
  }
  function normalizeCats(){
    profile.hiddenCats = profile.hiddenCats || [];
    profile.widgets = profile.widgets || [];
    const keys = cats.map(c => c.key);
    const before = profile.widgets.join('|');
    // remove prateleiras de categorias que não existem mais
    profile.widgets = profile.widgets.filter(id => !id.startsWith('cat:') || keys.includes(id.slice(4)));
    // categoria nova (não oculta) aparece sozinha na Home — só pro dono
    if (isOwner()){
      keys.forEach(k => { const id = 'cat:' + k; if (!profile.widgets.includes(id) && !profile.hiddenCats.includes(k)) profile.widgets.push(id); });
      if (profile.widgets.join('|') !== before) db()?.setDoc('profile', profile);
    }
  }
  function render(){
    applyAccent();
    normalizeCats();
    hi.innerHTML = '';
    const head = headerCard(); head.classList.add('w-lg'); hi.appendChild(head);
    const bb = billboard(); if (bb){ bb.classList.add('w-lg'); hi.appendChild(bb); }
    profile.widgets.forEach(id => { const el = widgetEl(id); if (el) hi.appendChild(el); });
    if (VISIT){ const inv = inviteCard(); inv.classList.add('w-lg'); hi.appendChild(inv); }
    hi.classList.toggle('is-editing', editing);
    editLbl.textContent = editing ? 'Concluir' : 'Editar';
    editBtn.classList.toggle('is-on', editing);
    editBtn.hidden = !isOwner();
    renderTray();
    if (editing) enableDrag();
    afterRender();
  }

  /* ---------- MASONRY: preenche os buracos (row-span pela altura real) ----------
     Cada card ganha grid-row-end: span N calculado pela sua altura → a grade
     compacta em masonry (dense), sem espaço vazio, mantendo largura/arrastar. */
  let rlRAF = 0, rlBound = false;
  function relayout(){
    if (!hi || !hi.children.length) return;
    const cards = [...hi.querySelectorAll('.hi__card')];
    hi.classList.remove('is-masonry');
    cards.forEach(c => { c.style.gridRowEnd = ''; });   // mede a altura natural
    const gap = parseFloat(getComputedStyle(hi).rowGap) || 14, unit = 10;
    const spans = cards.map(c => Math.max(1, Math.ceil((c.getBoundingClientRect().height + gap) / (unit + gap))));
    hi.classList.add('is-masonry');
    cards.forEach((c, i) => { c.style.gridRowEnd = 'span ' + spans[i]; });
  }
  function scheduleRelayout(){ cancelAnimationFrame(rlRAF); rlRAF = requestAnimationFrame(relayout); }
  function afterRender(){
    scheduleRelayout();
    setTimeout(relayout, 320); setTimeout(relayout, 850);   // fontes/imagens que chegam depois
    hi.querySelectorAll('img').forEach(im => { if (!im.complete) im.addEventListener('load', scheduleRelayout, { once: true }); });
    if (!rlBound){ rlBound = true; let t; window.addEventListener('resize', () => { clearTimeout(t); t = setTimeout(relayout, 120); }); }
  }

  /* ---------- arrastar pra mover: SEGURA o card (long-press) ou pega o ⠿ ---------- */
  let dragEl = null, dragging = false, justDragged = false;
  let lpTimer = 0, lpCard = null, lpX = 0, lpY = 0, lpPid = null;
  function enableDrag(){
    hi.querySelectorAll('.hi__card[data-wid]').forEach(c => c.addEventListener('pointerdown', cardDown));
    hi.querySelectorAll('.hi__grip').forEach(g => g.addEventListener('pointerdown', gripDown));
  }
  // ⠿ = pega na hora
  function gripDown(e){
    if (e.button && e.button !== 0) return;
    const card = e.target.closest('.hi__card'); if (!card || !card.dataset.wid) return;
    e.preventDefault(); e.stopPropagation();
    beginDrag(card, e);
  }
  // corpo do card = segura ~180ms pra pegar (um toque rápido continua editando; swipe rola)
  function cardDown(e){
    if (e.button && e.button !== 0) return;
    if (dragging) return;
    if (e.target.closest('.hi__ctl, .hi__edge, a, button, input, textarea, select, iframe')) return;
    const card = e.currentTarget; if (!card.dataset.wid) return;
    lpCard = card; lpX = e.clientX; lpY = e.clientY; lpPid = e.pointerId;
    clearTimeout(lpTimer);
    lpTimer = setTimeout(() => { if (lpCard) beginDrag(lpCard, { pointerId: lpPid }); }, 180);
    card.addEventListener('pointermove', lpMove);
    window.addEventListener('pointerup', lpClear, { once: true });
    window.addEventListener('pointercancel', lpClear, { once: true });
  }
  function lpMove(e){ if (Math.abs(e.clientX - lpX) > 8 || Math.abs(e.clientY - lpY) > 8) lpClear(); }   // moveu = rolar, cancela o pegar
  function lpClear(){
    clearTimeout(lpTimer); lpTimer = 0;
    if (lpCard) lpCard.removeEventListener('pointermove', lpMove);
    window.removeEventListener('pointerup', lpClear);
    window.removeEventListener('pointercancel', lpClear);
    if (!dragging) lpCard = null;
  }
  function beginDrag(card, e){
    lpClear();
    dragEl = card; dragging = true; lpCard = card;
    card.classList.add('is-dragging'); haptic(12);
    card.style.touchAction = 'none';
    try { card.setPointerCapture(e.pointerId); } catch {}   // toque: não rola a página
    window.addEventListener('pointermove', dragMove);        // no window: dispara mesmo se a captura falhar
    window.addEventListener('pointerup', dragEnd);
    window.addEventListener('pointercancel', dragEnd);
  }
  function dragMove(e){
    if (!dragEl) return;
    if (e.cancelable) e.preventDefault();
    // esconde o card arrastado do hit-test pra achar quem está embaixo
    const prev = dragEl.style.pointerEvents; dragEl.style.pointerEvents = 'none';
    const under = document.elementFromPoint(e.clientX, e.clientY);
    dragEl.style.pointerEvents = prev;
    const over = under && under.closest('.hi__card');
    if (!over || over === dragEl || !over.dataset.wid || over.parentElement !== hi) return;
    const r = over.getBoundingClientRect();
    const after = (e.clientX - r.left) > r.width / 2 || (e.clientY - r.top) > r.height * 0.6;
    hi.insertBefore(dragEl, after ? over.nextSibling : over);
  }
  function dragEnd(){
    window.removeEventListener('pointermove', dragMove);
    window.removeEventListener('pointerup', dragEnd);
    window.removeEventListener('pointercancel', dragEnd);
    if (!dragEl){ dragging = false; lpCard = null; return; }
    const el = dragEl; dragEl = null; dragging = false; lpCard = null;
    el.classList.remove('is-dragging'); el.style.touchAction = '';
    justDragged = true; setTimeout(() => { justDragged = false; }, 320);   // não deixa o "click" pós-arraste abrir o editor
    profile.widgets = [...hi.querySelectorAll('[data-wid]')].map(x => x.dataset.wid);
    save();
    scheduleRelayout();
  }

  /* ---------- arrastar fotos da galeria pra reordenar ---------- */
  let galFrom = -1, galEl = null, galC = null;
  function galDragStart(e, i, c){
    if (e.button && e.button !== 0) return; e.preventDefault(); e.stopPropagation();
    galFrom = i; galC = c; galEl = e.currentTarget; galEl.classList.add('is-drag');
    try { galEl.setPointerCapture(e.pointerId); } catch {}
    galEl.addEventListener('pointerup', galDragEnd, { once: true });
  }
  function galDragEnd(e){
    if (galFrom < 0){ return; }
    galEl.classList.remove('is-drag');
    const prev = galEl.style.pointerEvents; galEl.style.pointerEvents = 'none';
    const under = document.elementFromPoint(e.clientX, e.clientY); galEl.style.pointerEvents = prev;
    const cell = under && under.closest('.gal__cell');
    const cells = [...galC.querySelectorAll('.gal__cell')];
    const to = cell ? cells.indexOf(cell) : galFrom;
    if (to >= 0 && to !== galFrom){ const g = profile.gallery; const [m] = g.splice(galFrom, 1); g.splice(to, 0, m); fx(6); save(); render(); }
    galFrom = -1; galEl = null; galC = null;
  }

  /* ---------- redimensionar pelo canto (arrasta) ou toque (cicla) ---------- */
  let rzEl = null, rzId = null, rzHandle = null, rzAxis = 'w', rzMoved = false, rzX = 0, rzY = 0, rzLeft = 0, rzTop = 0, rzCols = 2, rzColW = 0, rzGap = 14;
  const gridCols = () => (getComputedStyle(hi).gridTemplateColumns.split(' ').filter(Boolean).length) || 2;
  const WNAME = { sm:'pequena', md:'média', lg:'cheia' };
  const HNAME = { auto:'automática', md:'média', lg:'alta' };
  function resizeStart(e, id, axis){
    if (e.button && e.button !== 0) return;
    e.preventDefault(); e.stopPropagation();
    rzEl = e.target.closest('.hi__card'); rzId = id; rzHandle = e.currentTarget; rzAxis = axis || 'w'; rzMoved = false;
    rzX = e.clientX; rzY = e.clientY;
    const r = rzEl.getBoundingClientRect(); rzLeft = r.left; rzTop = r.top;
    rzCols = gridCols();
    rzGap = parseFloat(getComputedStyle(hi).columnGap) || 14;
    rzColW = (hi.getBoundingClientRect().width - rzGap * (rzCols - 1)) / rzCols;
    const cur = layoutFor(id);
    rzEl.dataset.rzw = cur.w; rzEl.dataset.rzh = cur.h || 'auto';    // eixo não tocado mantém o valor atual
    rzEl.classList.add('is-resizing');
    try { rzHandle.setPointerCapture(e.pointerId); } catch {}
    rzHandle.addEventListener('pointermove', resizeMove);
    window.addEventListener('pointerup', resizeEnd);
    window.addEventListener('pointercancel', resizeEnd);
  }
  function resizeMove(e){
    if (!rzEl) return;
    if (Math.abs(e.clientX - rzX) > 5 || Math.abs(e.clientY - rzY) > 5) rzMoved = true;
    if (!rzMoved) return;
    let w = rzEl.dataset.rzw, h = rzEl.dataset.rzh;
    if (rzAxis === 'w'){
      const ncols = Math.max(1, Math.min(rzCols, Math.round((e.clientX - rzLeft + rzGap) / (rzColW + rzGap))));
      w = ncols <= 1 ? 'sm' : ncols >= rzCols ? 'lg' : 'md';
    } else {
      const dh = e.clientY - rzTop;
      h = dh < 175 ? 'auto' : dh < 255 ? 'md' : 'lg';
    }
    if (rzEl.dataset.rzw !== w || rzEl.dataset.rzh !== h) haptic(4);   // tique a cada encaixe
    rzEl.classList.remove('w-sm','w-md','w-lg'); rzEl.classList.add('w-' + w);
    rzEl.classList.remove('h-md','h-lg'); if (h !== 'auto') rzEl.classList.add('h-' + h);
    rzEl.dataset.rzw = w; rzEl.dataset.rzh = h;
    let tag = rzEl.querySelector('.hi__sizetag');
    if (!tag){ tag = document.createElement('span'); tag.className = 'hi__sizetag'; rzEl.appendChild(tag); }
    tag.textContent = rzAxis === 'w' ? ('largura: ' + WNAME[w]) : ('altura: ' + HNAME[h]);
    scheduleRelayout();
  }
  function resizeEnd(){
    window.removeEventListener('pointerup', resizeEnd);
    window.removeEventListener('pointercancel', resizeEnd);
    if (rzHandle){ rzHandle.removeEventListener('pointermove', resizeMove); rzHandle = null; }
    if (!rzEl) return;
    const el = rzEl, id = rzId, axis = rzAxis; rzEl = null;
    el.classList.remove('is-resizing'); el.querySelector('.hi__sizetag')?.remove();
    if (!rzMoved){   // TOQUE → cicla só o eixo do puxador
      const cur = layoutFor(id);
      if (axis === 'h') setLayout(id, { h: { auto:'md', md:'lg', lg:'auto' }[cur.h || 'auto'] });
      else setLayout(id, { w: { sm:'md', md:'lg', lg:'sm' }[cur.w] });
      return;
    }
    setLayout(id, axis === 'h' ? { h: el.dataset.rzh } : { w: el.dataset.rzw });
  }
  function renderTray(){
    tray.hidden = !editing;
    if (!editing) return;
    loadAllFonts();   // pra preview dos chips de fonte/tema
    tray.innerHTML = '';
    // temas prontos (1 toque)
    const pw = document.createElement('div'); pw.className = 'tray__accent';
    pw.innerHTML = `<span class="tray__lbl">temas prontos</span><div class="tray__presets"></div>`;
    const pb = pw.querySelector('.tray__presets');
    PRESETS.forEach(p => {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'preset';
      b.innerHTML = `<span class="preset__dot" style="background:${p.dot}"></span>${p.label}`;
      b.style.fontFamily = (FONTS.find(f => f.key === p.font)?.css) || 'inherit';
      b.onclick = () => applyPreset(p);
      pb.appendChild(b);
    });
    tray.appendChild(pw);
    // cor de destaque do seu perfil
    const acc = document.createElement('div'); acc.className = 'tray__accent';
    acc.innerHTML = `<span class="tray__lbl">cor do seu Haven</span><div class="tray__swatches"></div>`;
    const sw = acc.querySelector('.tray__swatches');
    ACCENTS.forEach(color => {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'swatch';
      b.style.background = color;
      if ((profile.accent || ACCENTS[0]) === color) b.classList.add('is-on');
      b.title = 'usar esta cor';
      b.onclick = () => { profile.accent = color === ACCENTS[0] ? '' : color; save(); render(); };
      sw.appendChild(b);
    });
    tray.appendChild(acc);
    // fonte dos widgets
    const fw = document.createElement('div'); fw.className = 'tray__accent';
    fw.innerHTML = `<span class="tray__lbl">fonte</span><div class="tray__fonts"></div>`;
    const fb = fw.querySelector('.tray__fonts');
    FONTS.forEach(f => {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'fontchip';
      b.textContent = f.label; b.style.fontFamily = f.css;
      if ((profile.font || 'outfit') === f.key) b.classList.add('is-on');
      b.onclick = () => { profile.font = f.key === 'outfit' ? '' : f.key; save(); render(); };
      fb.appendChild(b);
    });
    tray.appendChild(fw);
    // extras: som + prévia do visitante
    const ex = document.createElement('div'); ex.className = 'tray__accent';
    const sndOn = soundOn();
    ex.innerHTML = `<div class="tray__extras">
      <button class="tray__chip" data-undo ${hp<=0?'disabled':''}>↩ desfazer</button>
      <button class="tray__chip" data-redo ${hp>=hist.length-1?'disabled':''}>↪ refazer</button>
      <button class="tray__chip" data-theme>${profile.theme==='light'?'☀️ claro':'🌙 escuro'}</button>
      <button class="tray__chip" data-sound>${sndOn ? '🔊' : '🔈'} som ${sndOn ? 'on' : 'off'}</button>
      <button class="tray__chip" data-preview>👁 prévia do visitante</button></div>`;
    ex.querySelector('[data-undo]').onclick = () => undo();
    ex.querySelector('[data-redo]').onclick = () => redo();
    ex.querySelector('[data-theme]').onclick = () => { profile.theme = profile.theme === 'light' ? '' : 'light'; save(); render(); };
    ex.querySelector('[data-sound]').onclick = (e) => { try { localStorage.setItem('haven.sound', sndOn ? '0' : '1'); } catch {} if (!sndOn) blip(); renderTray(); };
    ex.querySelector('[data-preview]').onclick = () => togglePreview(true);
    tray.appendChild(ex);
    const addable = [
      ...Object.keys(WIDGETS).filter(id => !profile.widgets.includes(id)).map(id => ({ id, label: WIDGETS[id].label })),
      ...cats.filter(c => !profile.widgets.includes('cat:' + c.key)).map(c => ({ id: 'cat:' + c.key, label: `${c.emoji||''} ${c.label}`.trim() }))
    ];
    addable.forEach(({ id, label }) => {
      const b = document.createElement('button'); b.className = 'tray__chip'; b.type = 'button';
      b.textContent = '+ ' + label;
      b.onclick = () => {
        profile.widgets.push(id);
        if (id.startsWith('cat:')) profile.hiddenCats = (profile.hiddenCats || []).filter(k => k !== id.slice(4));
        save(); render();
      };
      tray.appendChild(b);
    });
    // blocos livres (estilo Notion): nota, link/CTA, título
    tray.appendChild(Object.assign(document.createElement('span'), { className:'tray__sep', textContent:'blocos' }));
    [['note','+ Nota'],['link','+ Link'],['title','+ Título'],['sticker','+ Sticker']].forEach(([t, lbl]) => {
      const b = document.createElement('button'); b.className = 'tray__chip tray__chip--blk'; b.type = 'button';
      b.textContent = lbl; b.onclick = () => createBlock(t);
      tray.appendChild(b);
    });
  }

  /* ---------- edições ---------- */
  const VISIT = new URLSearchParams(location.search).get('u');
  const isOwner = () => !preview && !VISIT && !!db()?.user;
  function togglePreview(on){
    preview = on; if (on) editing = false;
    document.body.classList.toggle('is-preview', on);
    render();
    let bar = document.querySelector('.previewbar');
    if (on){
      if (!bar){ bar = document.createElement('div'); bar.className = 'previewbar';
        bar.innerHTML = '<span>👁 assim que os outros veem sua bio</span><button data-exit>sair da prévia</button>';
        document.body.appendChild(bar); bar.querySelector('[data-exit]').onclick = () => togglePreview(false); }
      requestAnimationFrame(() => bar.classList.add('is-on'));
    } else if (bar){ bar.classList.remove('is-on'); setTimeout(() => bar.remove(), 220); }
  }
  let hist = [], hp = -1, histLock = false;
  const clone = o => JSON.parse(JSON.stringify(o));
  function pushHist(){ if (histLock) return; hist = hist.slice(0, hp + 1); hist.push(clone(profile)); if (hist.length > 40){ hist.shift(); } hp = hist.length - 1; }
  const save = () => { pushHist(); db()?.setDoc('profile', profile); publish(); };
  function applyHist(){ histLock = true; db()?.setDoc('profile', profile); publish(); render(); histLock = false; }
  function undo(){ if (hp <= 0) return; hp--; profile = clone(hist[hp]); applyHist(); fx(6); }
  function redo(){ if (hp >= hist.length - 1) return; hp++; profile = clone(hist[hp]); applyHist(); fx(6); }
  function move(id, dir){
    const i = profile.widgets.indexOf(id), j = i + dir;
    if (i < 0 || j < 0 || j >= profile.widgets.length) return;
    [profile.widgets[i], profile.widgets[j]] = [profile.widgets[j], profile.widgets[i]];
    save(); render();
  }
  function remove(id){
    profile.widgets = profile.widgets.filter(x => x !== id);
    if (id.startsWith('cat:')){ profile.hiddenCats = profile.hiddenCats || []; const k = id.slice(4); if (!profile.hiddenCats.includes(k)) profile.hiddenCats.push(k); }
    if (id.startsWith('blk:') && profile.blocks) delete profile.blocks[id.slice(4)];   // bloco livre some de vez
    if (profile.layout) delete profile.layout[id];
    save(); render();
  }
  function editField(key){
    const label = key === 'bio' ? 'Uma linha sobre você' : key === 'instagram' ? 'Seu @ do Instagram'
      : key === 'quote' ? 'Uma frase / mood' : 'Cole o link da playlist do Spotify';
    askText(label, profile[key] || '', v => { profile[key] = (v || '').trim(); save(); render(); }, { multiline: key === 'bio' || key === 'quote' });
  }
  function editStatus(){
    profile.status = profile.status || { emoji:'', text:'' };
    pickEmoji(emoji => {
      askText('Como você tá? (curto)', profile.status.text || '', text => { profile.status = { emoji, text: (text || '').trim() }; save(); render(); }, { max: 60 });
    });
  }
  function editLinks(){
    profile.links = profile.links || [];
    pickEmoji(emoji => {
      askText('Texto do botão', '', label => {
        askText('Link (URL)', '', url => {
          if (!(label||'').trim() && !(url||'').trim()) return;
          profile.links.push({ emoji, label: (label||'').trim(), url: (url||'').trim() }); save(); render();
        }, { type: 'url', ph: 'https://…' });
      });
    });
  }
  function editPin(){
    profile.pin = profile.pin || {};
    askText('Título do destaque', profile.pin.title || '', title => {
      askText('Legenda (opcional)', profile.pin.caption || '', caption => {
        askText('Link (opcional)', profile.pin.link || '', link => {
          profile.pin.title = (title||'').trim(); profile.pin.caption = (caption||'').trim(); profile.pin.link = (link||'').trim();
          save(); render();
          pickImage(({ id, url }) => { if (url){ profile.pin.img = url; profile.pin.imgId = id; save(); render(); } });
        }, { type: 'url', ph: 'https://… (opcional)' });
      });
    });
  }
  function editVideo(){ askText('Link do vídeo (YouTube / TikTok / Reel)', profile.video || '', v => { profile.video = (v || '').trim(); save(); render(); }, { type:'url', ph:'https://youtu.be/…' }); }
  function editCounter(){
    profile.counter = profile.counter || { label:'', date:'' };
    askText('Contando até o quê? (ex.: Meu aniversário)', profile.counter.label || '', label => {
      askText('Data', profile.counter.date || '', date => { profile.counter = { label: (label||'').trim(), date: (date||'').trim() }; save(); render(); }, { type: 'date' });
    });
  }
  function editSocial(key){
    const cfg = SOCIALS[key]; if (!cfg) return;
    profile.socials = profile.socials || {};
    const cur = (profile.socials[key]||'').replace(/^@/,'');
    const val = window.prompt(`Seu usuário no ${cfg.label} (deixe vazio pra remover):`, cur);
    if (val === null) return;
    profile.socials[key] = val.trim().replace(/^@/,'');
    if (key === 'instagram') profile.instagram = profile.socials.instagram; // compat
    save(); render();
  }
  function editMoment(key){
    const lbl = { read:'O que você tá lendo', watch:'O que você tá vendo', play:'O que você tá jogando' }[key] || '';
    profile.moment = profile.moment || { read:'', watch:'', play:'' };
    askText(lbl, profile.moment[key] || '', v => { profile.moment[key] = (v || '').trim(); save(); render(); });
  }
  editBtn?.addEventListener('click', () => { editing = !editing; render(); if (editing) maybeCoach(); });
  function maybeCoach(){
    try { if (localStorage.getItem('haven.coach') === '1') return; } catch {}
    if (document.querySelector('.coach')) return;
    const el = document.createElement('div'); el.className = 'coach';
    el.innerHTML = `<b>modo editar ✨</b><span>segura o card pra mover (ou o ⠿) · puxa a borda ➡ largura, ⬇ altura · ◱ estilo · Aa fonte</span><button data-coach-ok>entendi</button>`;
    document.body.appendChild(el); requestAnimationFrame(() => el.classList.add('is-on'));
    el.querySelector('[data-coach-ok]').onclick = () => { try { localStorage.setItem('haven.coach', '1'); } catch {} el.classList.remove('is-on'); setTimeout(() => el.remove(), 200); };
  }

  /* ---------- compartilhar o link do perfil ---------- */
  function myLink(){
    const uid = db()?.user?.uid;
    if (!uid) return location.href;
    const appUrl = `${location.origin}${location.pathname}?u=${encodeURIComponent(uid)}`;
    // com o proxy ligado, compartilha via função → preview OG com a cara da pessoa
    const fn = (window.HAVEN_FUNCTIONS || '').replace(/\/+$/, '');
    if (fn) return `${fn}/havenProfile?u=${encodeURIComponent(uid)}&to=${encodeURIComponent(appUrl)}`;
    return appUrl;
  }
  async function shareLink(btn){
    const url = myLink();
    const lbl = btn?.querySelector('[data-share-lbl]');
    const say = (t) => { if (!lbl) return; const old = lbl.textContent; lbl.textContent = t; btn.classList.add('is-done'); setTimeout(()=>{ lbl.textContent = old; btn.classList.remove('is-done'); }, 1600); };
    // celular: menu de compartilhar nativo (Instagram, WhatsApp…)
    if (navigator.share){
      try { await navigator.share({ title:'Meu Haven', text:'dá um oi no meu Haven ✨', url }); return; }
      catch(_){ /* cancelou → cai pro copiar */ }
    }
    try { await navigator.clipboard.writeText(url); say('link copiado ✓'); }
    catch { window.prompt('Copie seu link do Haven:', url); }
  }
  function shareProfileCard(){
    const favs = [...(col.movie||[]), ...(col.book||[]), ...(col.game||[])]
      .filter(i => i.poster && i.rating).sort((a,b) => (b.rating||0) - (a.rating||0))
      .slice(0,4).map(i => i.poster);
    const total = (col.movie?.length||0) + (col.book?.length||0) + (col.game?.length||0);
    window.HavenShare?.openProfile?.({
      name: me.name, photo: me.photo || profile.photo || null,
      insta: profile.instagram || '', bio: profile.bio || '', accent: profile.accent || '',
      font: (FONTS.find(f => f.key === profile.font)?.css) || '',
      posters: favs, titles: total, places: places.length
    });
  }

  /* ---------- onboarding (primeira vez do dono) ---------- */
  const ONB_KEY = 'haven.onboarded';
  function maybeOnboard(){
    if (VISIT || !isOwner() || !firstRun) return;
    try { if (localStorage.getItem(ONB_KEY)) return; } catch(_){}
    if (document.querySelector('.onb')) return;
    const first = (me.name || 'você').split(' ')[0];
    const el = document.createElement('div');
    el.className = 'onb';
    el.innerHTML = `
      <div class="onb__card glass">
        <div class="onb__badge">✨ bem-vindo(a)</div>
        <h3 class="onb__hi">Oi, ${esc(first)}!</h3>
        <p class="onb__sub">Essa é a sua Home — o cantinho que as pessoas veem pelo link da sua bio. Deixa com a sua cara em 30 segundos.</p>
        <div class="onb__vibe">
          <span class="onb__vlbl">comece por um modelo (opcional)</span>
          <div class="onb__vibes" data-onb-tpls></div>
        </div>
        <div class="onb__vibe">
          <span class="onb__vlbl">ou escolha só um vibe ✨</span>
          <div class="onb__vibes" data-onb-vibes></div>
        </div>
        <label class="onb__field"><span>Uma linha sobre você</span>
          <input data-onb-bio maxlength="140" placeholder="cinema, café e um bom livro…" /></label>
        <label class="onb__field"><span>Seu @ do Instagram</span>
          <input data-onb-insta placeholder="seu_insta" autocapitalize="off" autocomplete="off" /></label>
        <button class="onb__wall" data-onb-wall type="button">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="m3 15 5-5 4 4 3-3 6 6"/><circle cx="8.5" cy="9" r="1.2"/></svg>
          Escolher um wallpaper</button>
        <div class="onb__actions">
          <button class="onb__skip" data-onb-skip type="button">agora não</button>
          <button class="onb__go" data-onb-go type="button">Ver meu Haven</button>
        </div>
      </div>`;
    document.body.appendChild(el);
    requestAnimationFrame(() => el.classList.add('is-on'));
    const $$ = s => el.querySelector(s);
    $$('[data-onb-bio]').value = profile.bio || '';
    $$('[data-onb-insta]').value = (profile.instagram || '').replace(/^@/,'');
    const tpls = $$('[data-onb-tpls]');
    TEMPLATES.forEach(t => {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'preset';
      const p = PRESETS.find(x => x.key === t.preset);
      b.innerHTML = `<span class="preset__dot" style="background:${p?.dot||'var(--accent)'}"></span>${t.label}`;
      b.onclick = () => { applyTemplate(t); tpls.querySelectorAll('.preset').forEach(x => x.classList.toggle('is-on', x === b)); };
      tpls.appendChild(b);
    });
    const vibes = $$('[data-onb-vibes]');
    PRESETS.forEach(p => {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'preset';
      b.innerHTML = `<span class="preset__dot" style="background:${p.dot}"></span>${p.label}`;
      b.style.fontFamily = (FONTS.find(f => f.key === p.font)?.css) || 'inherit';
      b.onclick = () => { applyPreset(p); vibes.querySelectorAll('.preset').forEach(x => x.classList.toggle('is-on', x === b)); };
      vibes.appendChild(b);
    });
    $$('[data-onb-wall]').addEventListener('click', () => window.HavenWallpaper?.open?.());
    const done = () => { try { localStorage.setItem(ONB_KEY, '1'); } catch(_){} el.classList.remove('is-on'); setTimeout(()=>el.remove(), 240); };
    $$('[data-onb-skip]').addEventListener('click', () => { save(); done(); });
    $$('[data-onb-go]').addEventListener('click', () => {
      profile.bio = $$('[data-onb-bio]').value.trim();
      profile.instagram = $$('[data-onb-insta]').value.trim().replace(/^@/,'');
      profile.socials = profile.socials || {};
      profile.socials.instagram = profile.instagram;
      save(); render(); done();
    });
  }

  /* ---------- snapshot público (bio) ---------- */
  const trim = a => (a||[]).slice(0,10).map(i=>({poster:i.poster, title:i.title, addedAt:i.addedAt, type:i.type, rating:i.rating}));
  async function resolveMemories(pl){
    const shots = [];
    for (const p of (pl||[])) for (const ph of (p.photos||[])) shots.push({ id: ph.id, url: ph.url, ts: ph.ts });
    shots.sort((a,b)=>b.ts-a.ts);
    const out = [];
    for (const s of shots.slice(0,10)){ const u = s.url || await db()?.photoURL(s.id); if (u) out.push({ url: u }); }
    return out;
  }
  async function publish(){
    if (VISIT || !db()?.user) return;
    try {
      const [p, c, pl] = await Promise.all([db().getDoc('profile'), db().getDoc('collection'), db().getDoc('places')]);
      const prof = (p && Array.isArray(p.widgets)) ? p : profile;
      const cc = c || { movie:[], book:[], game:[] }; const u = db().user || {};
      const mem = await resolveMemories(pl);
      const pcats = Array.isArray(cc.$cats) ? cc.$cats : [];
      for (const cat of pcats){ if (cat.coverId){ try { cat.cover = (await db().photoURL(cat.coverId)) || cat.cover || ''; } catch {} } }
      const catItems = {};
      for (const cat of pcats){
        const out = [];
        for (const it of (cc[cat.key] || []).slice(0, 12)){
          let poster = it.poster || '';
          if (it.posterId){ try { poster = (await db().photoURL(it.posterId)) || poster; } catch {} }
          out.push({ title: it.title, poster, link: it.link || '', rating: it.rating || 0 });
        }
        catItems[cat.key] = out;
      }
      // destaque + galeria com imagens resolvidas
      const pinPub = { ...(prof.pin || {}) };
      if (pinPub.imgId){ try { pinPub.img = (await db().photoURL(pinPub.imgId)) || pinPub.img || ''; } catch {} }
      const galPub = [];
      for (const it of (prof.gallery || []).slice(0, 9)){ let url = it.url || ''; if (it.id){ try { url = (await db().photoURL(it.id)) || url; } catch {} } if (url) galPub.push({ url }); }
      let avatar = u.photo || null;
      if (prof.photoId){ try { avatar = (await db().photoURL(prof.photoId)) || avatar; } catch {} } else if (prof.photo) avatar = prof.photo;
      let cover = prof.cover || '';
      if (prof.coverId){ try { cover = (await db().photoURL(prof.coverId)) || cover; } catch {} }
      await db().setPublic({
        name:u.name||'Você', photo:avatar, cover, font:prof.font||'',
        widgets:prof.widgets, bio:prof.bio||'', instagram:prof.instagram||'', playlist:prof.playlist||'',
        accent:prof.accent||'', moment:prof.moment||{}, socials:prof.socials||{}, theme:prof.theme||'',
        quote:prof.quote||'', counter:prof.counter||{}, status:prof.status||{}, pin:pinPub, gallery:galPub, links:prof.links||[], video:prof.video||'', week:prof.week||{},
        layout:prof.layout||{}, blocks:prof.blocks||{},
        col:{ movie:trim(cc.movie), book:trim(cc.book), game:trim(cc.game) },
        cats: pcats.map(c=>({ key:c.key, label:c.label, emoji:c.emoji, color:c.color, cover:c.cover||'' })), catItems,
        places:(pl||[]).map(x=>({cat:x.cat})), memories:mem, at:Date.now()
      });
    } catch {}
  }
  window.HavenPublish = publish;
  // catalog chama isso ao criar/editar categoria ou item → Home reflete na hora
  window.HavenHome = { reload: async () => { if (VISIT) return; try { await loadOwner(); } catch {} render(); } };

  /* ---------- boot ---------- */
  async function loadOwner(){
    me = { name: db()?.user?.name || 'Você', photo: db()?.user?.photo || null };
    const p = await db()?.getDoc('profile');
    firstRun = !(p && Array.isArray(p.widgets));
    if (!firstRun) profile = { bio:'', instagram:'', playlist:'', accent:'', moment:{ read:'', watch:'', play:'' }, socials:{}, hiddenCats:[], layout:{}, blocks:{}, cover:'', font:'', quote:'', counter:{ label:'', date:'' }, status:{ emoji:'', text:'' }, pin:{}, gallery:[], links:[], video:'', week:{}, theme:'', ...p };
    profile.status = profile.status || {}; profile.pin = profile.pin || {}; profile.gallery = profile.gallery || [];
    if (profile.pin.imgId){ try { const u = await db()?.photoURL(profile.pin.imgId); if (u) profile.pin.img = u; } catch {} }
    for (const it of profile.gallery){ if (it.id){ try { const u = await db()?.photoURL(it.id); if (u) it.url = u; } catch {} } }
    profile.socials = profile.socials || {};
    profile.hiddenCats = profile.hiddenCats || [];
    profile.layout = profile.layout || {}; profile.blocks = profile.blocks || {};
    if (profile.instagram && !profile.socials.instagram) profile.socials.instagram = String(profile.instagram).replace(/^@/,'');
    profile.widgets = (profile.widgets || []).map(w => w === 'instagram' ? 'social' : w);
    if (profile.coverId){ try { const u = await db()?.photoURL(profile.coverId); if (u) profile.cover = u; } catch {} }
    if (profile.photoId){ try { const u = await db()?.photoURL(profile.photoId); if (u) profile.photo = u; } catch {} }
    col = (await db()?.getDoc('collection')) || col;
    cats = Array.isArray(col.$cats) ? col.$cats : [];
    for (const c of cats){
      if (c.coverId){ try { const u = await db()?.photoURL(c.coverId); if (u) c.cover = u; } catch {} }
      for (const it of (col[c.key] || [])) if (it.posterId) { try { const u = await db()?.photoURL(it.posterId); if (u) it.poster = u; } catch {} }
    }
    places = (await db()?.getDoc('places')) || [];
    memories = await resolveMemories(places);
  }
  async function loadVisitor(){
    const snap = await db()?.getPublic(VISIT);
    const cta = $('[data-visit-cta]');
    if (snap){
      me = { name: snap.name || 'Haven', photo: snap.photo || null };
      profile = { widgets: (snap.widgets || DEFAULT.slice()).map(w => w === 'instagram' ? 'social' : w), bio: snap.bio||'', instagram: snap.instagram||'', playlist: snap.playlist||'', accent: snap.accent||'', moment: snap.moment||{}, socials: snap.socials || (snap.instagram ? { instagram: String(snap.instagram).replace(/^@/,'') } : {}), layout: snap.layout||{}, blocks: snap.blocks||{}, hiddenCats: [], cover: snap.cover||'', font: snap.font||'', photo: snap.photo||'', quote: snap.quote||'', counter: snap.counter||{}, status: snap.status||{}, pin: snap.pin||{}, gallery: snap.gallery||[], links: snap.links||[], video: snap.video||'', week: snap.week||{}, theme: snap.theme||'' };
      cats = Array.isArray(snap.cats) ? snap.cats : [];
      col = { ...(snap.col || { movie:[], book:[], game:[] }), ...(snap.catItems || {}) };
      places = snap.places || []; memories = snap.memories || [];
      const who = (snap.name||'alguém').split(' ')[0];
      const nm = $('.hello__name'); if (nm) nm.textContent = (snap.name||'Haven').split(' ')[0];
      const cn = $('[data-visit-name]'); if (cn) cn.textContent = who;
      const ey = $('.map__eyebrow'); if (ey) ey.textContent = 'A cidade de ' + who;
      const ce = $('.ctop__eyebrow'); if (ce) ce.textContent = 'o que ' + who + ' curte';
    } else {
      profile = { widgets: [], bio:'', instagram:'', playlist:'' };
      hi.innerHTML = `<div class="w-empty" style="text-align:center">Esse Haven não existe ou é privado.</div>`;
    }
    if (cta) cta.hidden = false;
  }
  async function refresh(){
    try { await db()?.ready;
      if (VISIT){ document.body.classList.add('is-visitor'); await loadVisitor(); }
      else { await loadOwner(); }
    } catch {}
    if (!VISIT){ hist = []; hp = -1; pushHist(); }   // baseline pro undo
    render();
    maybeOnboard();
    publish();
  }
  // parallax sutil do fundo ao rolar a Home
  const homeView = document.querySelector('[data-view="home"]'); const sceneEl = document.querySelector('.scene');
  homeView?.addEventListener('scroll', () => { if (sceneEl) sceneEl.style.setProperty('--par', (homeView.scrollTop * 0.03) + 'px'); }, { passive: true });

  refresh();
  if (!VISIT) db()?.onUser(refresh);
})();
