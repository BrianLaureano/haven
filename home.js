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

  const hi = $('[data-hi]'), tray = $('[data-hi-tray]');
  const editBtn = $('[data-hi-edit]'), editLbl = $('[data-hi-edit-lbl]');

  const DEFAULT = ['playlist', 'now', 'filmes', 'livros', 'memories', 'bio'];
  let profile = { widgets: DEFAULT.slice(), bio: '', instagram: '', playlist: '' };
  let col = { movie:[], book:[], game:[] }, places = [], memories = [], editing = false;

  const plId = raw => { const m = String(raw||'').match(/playlist[/:]([A-Za-z0-9]+)/); return m ? m[1] : (String(raw||'').trim() || ''); };
  const HERO = '';   // feed: sem hero fixo
  const pcard = i => `<div class="pcard"><span class="pcard__art" style="background-image:url('${i.poster}')">${i.rating?`<b>${'★'.repeat(i.rating)}</b>`:''}</span><em>${esc(i.title)}</em></div>`;
  function shelfHTML(label, meta, items, empty, sq){
    return `<div class="shelf__head"><span class="shelf__title">${label}</span>${meta?`<span class="shelf__meta">${meta}</span>`:''}</div>
      ${items ? `<div class="shelf__row${sq?' shelf__row--sq':''}">${items}</div>` : `<div class="shelf__empty">${empty}</div>`}`;
  }
  const catShelf = (arr, label, empty) => shelfHTML(label, arr.length ? `${arr.length}` : '', arr.filter(i=>i.poster).map(pcard).join(''), empty);

  /* ---------- widgets = prateleiras estilo Netflix ---------- */
  const WIDGETS = {
    now: { label:'Som', open:'music', build(c){
      c.classList.add('w', 'w-now');
      c.innerHTML = `<span class="now__art" aria-hidden="true"><i></i></span>
        <div class="now__meta"><span class="hi__label">Ouvindo agora</span>
        <b class="now__title" data-np-title>Snowfall</b>
        <span class="now__artist" data-np-artist>Øneheart &amp; reidenshi</span></div>
        <span class="now__play" aria-hidden="true"><svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M8 5v14l11-7z"/></svg></span>
        <div class="now__bar" aria-hidden="true"><i style="--p:38%"></i></div>`;
    }},
    playlist: { label:'Playlist', edit:'playlist', build(c){
      c.classList.add('w', 'w-pl');
      const id = plId(profile.playlist);
      c.innerHTML = id
        ? `<span class="hi__label">Playlist em destaque</span><div class="w-embed"><iframe loading="lazy" allow="encrypted-media" src="https://open.spotify.com/embed/playlist/${id}?utm_source=generator&theme=0"></iframe></div>`
        : `<span class="hi__label">Playlist em destaque</span><div class="w-empty">${editing ? 'toque pra escolher uma playlist do Spotify' : 'nenhuma playlist ainda'}</div>`;
    }},
    filmes: { label:'Filmes', open:'catalog', plain:true, build(c){ c.innerHTML = catShelf(col.movie||[], 'Filmes', 'seus filmes aparecem aqui'); }},
    livros: { label:'Livros', open:'catalog', plain:true, build(c){ c.innerHTML = catShelf(col.book||[], 'Livros', 'seus livros aparecem aqui'); }},
    jogos:  { label:'Jogos',  open:'catalog', plain:true, build(c){ c.innerHTML = catShelf(col.game||[], 'Jogos', 'seus jogos aparecem aqui'); }},
    memories: { label:'Memórias', open:'map', plain:true, build(c){
      const shots = memories.map(m=>`<div class="pcard pcard--sq"><span class="pcard__art" style="background-image:url('${m.url}')"></span></div>`).join('');
      const dots = [...new Set(places.map(p=>p.cat))].slice(0,6).map(k=>`<i style="background:${CAT[k]||CAT.outro}"></i>`).join('');
      c.innerHTML = shelfHTML(`Memórias`, `${places.length} lugares <span class="w-dots">${dots}</span>`, shots, 'fotos dos seus lugares aparecem aqui', true);
    }},
    bio: { label:'Bio', edit:'bio', build(c){
      c.classList.add('w', 'w-bio');
      c.innerHTML = `<span class="hi__label">Sobre</span>
        <p class="w-biotext">${profile.bio ? esc(profile.bio) : '<span class="hi__ph">toque pra escrever…</span>'}</p>`;
    }},
    instagram: { label:'Instagram', edit:'instagram', build(c){
      c.classList.add('w', 'w-insta');
      const h = (profile.instagram||'').replace(/^@/,'');
      c.innerHTML = `<span class="hi__label">Instagram</span><b class="hi__big">@${h ? esc(h) : '<span class="hi__ph">seu_insta</span>'}</b>`;
      c._link = h ? 'https://instagram.com/' + h : null;
    }}
  };

  /* ---------- render ---------- */
  function widgetEl(id){
    const w = WIDGETS[id]; if (!w) return null;
    const c = document.createElement('div');
    c.className = 'glass hi__card card' + (w.plain ? ' card--shelf' : '');
    c.dataset.wid = id;
    w.build(c);
    if (w.open && !editing){ const g = document.createElement('span'); g.className = 'tile__go'; g.setAttribute('aria-hidden','true'); g.textContent = '↗'; c.appendChild(g); }
    c.addEventListener('click', (e) => {
      if (e.target.closest('.hi__ctl') || e.target.closest('iframe')) return;
      if (editing){ if (w.edit) editField(w.edit); return; }
      if (w.open) window.HavenGo?.(w.open);
      else if (c._link) window.open(c._link, '_blank', 'noopener');
    });
    if (editing){
      c.classList.add('is-edit');
      const ctl = document.createElement('div'); ctl.className = 'hi__ctl';
      ctl.innerHTML = `<button data-mv="-1" aria-label="Mover">‹</button><button data-rm aria-label="Remover">✕</button><button data-mv="1" aria-label="Mover">›</button>`;
      ctl.querySelector('[data-rm]').onclick = (e)=>{ e.stopPropagation(); remove(id); };
      ctl.querySelectorAll('[data-mv]').forEach(b => b.onclick = (e)=>{ e.stopPropagation(); move(id, +b.dataset.mv); });
      c.appendChild(ctl);
    }
    return c;
  }
  function render(){
    hi.innerHTML = '';
    profile.widgets.forEach(id => { const el = widgetEl(id); if (el) hi.appendChild(el); });
    hi.classList.toggle('is-editing', editing);
    editLbl.textContent = editing ? 'Concluir' : 'Editar';
    editBtn.classList.toggle('is-on', editing);
    editBtn.hidden = !isOwner();
    renderTray();
  }
  function renderTray(){
    tray.hidden = !editing;
    if (!editing) return;
    tray.innerHTML = '';
    const addable = Object.keys(WIDGETS).filter(id => !profile.widgets.includes(id));
    if (!addable.length){ tray.innerHTML = `<span class="tray__all">todos os widgets já estão na sua Home</span>`; return; }
    addable.forEach(id => {
      const b = document.createElement('button'); b.className = 'tray__chip'; b.type = 'button';
      b.textContent = '+ ' + WIDGETS[id].label;
      b.onclick = () => { profile.widgets.push(id); save(); render(); };
      tray.appendChild(b);
    });
  }

  /* ---------- edições ---------- */
  const VISIT = new URLSearchParams(location.search).get('u');
  const isOwner = () => !VISIT && !!db()?.user;
  const save = () => { db()?.setDoc('profile', profile); publish(); };
  function move(id, dir){
    const i = profile.widgets.indexOf(id), j = i + dir;
    if (i < 0 || j < 0 || j >= profile.widgets.length) return;
    [profile.widgets[i], profile.widgets[j]] = [profile.widgets[j], profile.widgets[i]];
    save(); render();
  }
  function remove(id){ profile.widgets = profile.widgets.filter(x => x !== id); save(); render(); }
  function editField(key){
    const label = key === 'bio' ? 'Uma linha sobre você:' : key === 'instagram' ? 'Seu @ do Instagram:' : 'Cole o link da playlist do Spotify:';
    const val = window.prompt(label, profile[key] || '');
    if (val === null) return;
    profile[key] = val.trim(); save(); render();
  }
  editBtn?.addEventListener('click', () => { editing = !editing; render(); });

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
      await db().setPublic({
        name:u.name||'Você', photo:u.photo||null,
        widgets:prof.widgets, bio:prof.bio||'', instagram:prof.instagram||'', playlist:prof.playlist||'',
        col:{ movie:trim(cc.movie), book:trim(cc.book), game:trim(cc.game) },
        places:(pl||[]).map(x=>({cat:x.cat})), memories:mem, at:Date.now()
      });
    } catch {}
  }
  window.HavenPublish = publish;

  /* ---------- boot ---------- */
  async function loadOwner(){
    const p = await db()?.getDoc('profile'); if (p && Array.isArray(p.widgets)) profile = { bio:'', instagram:'', playlist:'', ...p };
    col = (await db()?.getDoc('collection')) || col;
    places = (await db()?.getDoc('places')) || [];
    memories = await resolveMemories(places);
  }
  async function loadVisitor(){
    const snap = await db()?.getPublic(VISIT);
    const cta = $('[data-visit-cta]');
    if (snap){
      profile = { widgets: snap.widgets || DEFAULT.slice(), bio: snap.bio||'', instagram: snap.instagram||'', playlist: snap.playlist||'' };
      col = snap.col || { movie:[], book:[], game:[] }; places = snap.places || []; memories = snap.memories || [];
      const nm = $('.hello__name'); if (nm) nm.textContent = (snap.name||'Haven').split(' ')[0];
      const cn = $('[data-visit-name]'); if (cn) cn.textContent = (snap.name||'alguém').split(' ')[0];
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
    render();
    publish();
  }
  refresh();
  if (!VISIT) db()?.onUser(refresh);
})();
