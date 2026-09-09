/* ============================================================
   Haven — Wallpaper: escolher o ambiente de fundo.
   Automático (clima) · cenas nativas · sua foto · link (Pinterest).
   Persistido pela fachada (HavenDB): doc 'wallpaper' + fotos.
   ============================================================ */
(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const SCENE_LBL = { dawn:'Alvorada', rain:'Chuva', 'clear-day':'Dia claro', night:'Noite', overcast:'Nublado' };
  const db = () => window.HavenDB;

  // doc: { sel:{mode:'auto'|'scene'|'custom', name?|id?|url?}, customs:[id...] }
  let doc = { sel: { mode: 'auto' }, customs: [] };
  const sel = () => doc.sel;
  const saveDoc = () => db()?.setDoc('wallpaper', doc);
  const objURLs = [];

  async function loadDoc(){
    try { await db()?.ready; const d = await db()?.getDoc('wallpaper'); if (d && d.sel) doc = { customs: [], ...d }; } catch {}
  }
  async function applySaved(){
    const s = sel();
    if (s.mode === 'scene') window.HavenScene?.pick(s.name);
    else if (s.mode === 'custom' && s.url) window.HavenScene?.custom(s.url);
    else if (s.mode === 'custom' && s.id){ const u = await db()?.photoURL(s.id); if (u){ objURLs.push(u); window.HavenScene?.custom(u); } }
    // 'auto' → deixa o clima conduzir (main.js)
  }

  /* ---------- downscale ---------- */
  function shrink(file){
    return new Promise(res => {
      const img = new Image();
      img.onload = () => { const max = 2000, s = Math.min(1, max / Math.max(img.width, img.height));
        const cv = document.createElement('canvas'); cv.width = Math.round(img.width * s); cv.height = Math.round(img.height * s);
        cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
        cv.toBlob(b => res(b), 'image/jpeg', 0.84); URL.revokeObjectURL(img.src); };
      img.onerror = () => res(null); img.src = URL.createObjectURL(file);
    });
  }

  /* ---------- UI ---------- */
  const modal = $('[data-wall]'), grid = $('[data-wall-grid]'), fileEl = $('[data-wall-file]');
  function tile(cls, inner, onClick){
    const b = document.createElement('button'); b.className = 'wtile ' + cls; b.type = 'button';
    b.innerHTML = inner; if (onClick) b.addEventListener('click', onClick); return b;
  }
  function isSel(mode, key){ const s = sel(); if (s.mode !== mode) return false;
    if (mode === 'scene') return s.name === key; if (mode === 'custom') return (s.id || s.url) === key; return true; }

  async function render(){
    grid.innerHTML = '';
    grid.appendChild(tile('wtile--auto' + (sel().mode === 'auto' ? ' is-sel' : ''),
      `<span class="wtile__lbl"><b>Automático</b><i>segue o clima</i></span>`, () => choose({ mode: 'auto' })));
    window.HavenScene?.list().forEach(name => {
      grid.appendChild(tile(isSel('scene', name) ? 'is-sel' : '',
        `<img src="assets/scenes/${name}.webp" alt="" loading="lazy"/><span class="wtile__lbl">${SCENE_LBL[name] || name}</span>`,
        () => choose({ mode: 'scene', name })));
    });
    for (const id of doc.customs){
      const u = await db()?.photoURL(id); if (!u) continue; objURLs.push(u);
      const t = tile('wtile--custom' + (isSel('custom', id) ? ' is-sel' : ''),
        `<img src="${u}" alt=""/><span class="wtile__lbl">Sua foto</span><span class="wtile__del" data-del>✕</span>`,
        () => choose({ mode: 'custom', id }));
      t.querySelector('[data-del]').addEventListener('click', async (e) => {
        e.stopPropagation(); await db()?.delPhoto(id); doc.customs = doc.customs.filter(x => x !== id);
        if (isSel('custom', id)) choose({ mode: 'auto' }); else { saveDoc(); render(); }
      });
      grid.appendChild(t);
    }
  }

  function apply(s){
    if (s.mode === 'auto') window.HavenScene?.auto();
    else if (s.mode === 'scene') window.HavenScene?.pick(s.name);
    else if (s.mode === 'custom' && s.url) window.HavenScene?.custom(s.url);
    else if (s.mode === 'custom' && s.id) db()?.photoURL(s.id).then(u => { if (u){ objURLs.push(u); window.HavenScene?.custom(u); } });
  }
  function choose(s){ doc.sel = s; saveDoc(); apply(s); render(); setTimeout(close, 260); }

  fileEl.addEventListener('change', async () => {
    const f = fileEl.files[0]; fileEl.value = ''; if (!f || !f.type.startsWith('image/')) return;
    const blob = await shrink(f); if (!blob) return;
    const { id } = await db().putPhoto(blob);
    doc.customs.push(id); choose({ mode: 'custom', id });
  });
  $('[data-wall-upload]').addEventListener('click', () => fileEl.click());
  $('[data-wall-link]').addEventListener('click', () => {
    const url = window.prompt('Cole o link da imagem (Pinterest, Unsplash, etc.):', '');
    if (!url || !/^https?:\/\//i.test(url)) return;
    choose({ mode: 'custom', url });
  });

  async function open(){ await loadDoc(); render(); modal.hidden = false; requestAnimationFrame(() => modal.classList.add('is-on')); setTimeout(() => modal.classList.add('is-on'), 20); }
  function close(){ modal.classList.remove('is-on'); setTimeout(() => { modal.hidden = true; }, 300); }
  document.querySelectorAll('[data-wall-close]').forEach(el => el.addEventListener('click', close));

  window.HavenWallpaper = { open, close, set(sel){ doc.sel = sel; saveDoc(); apply(sel); } };
  // aplica a escolha salva no boot (e de novo se trocar de usuário)
  (async () => { await loadDoc(); applySaved(); db()?.onUser(async () => { await loadDoc(); applySaved(); }); })();
})();
