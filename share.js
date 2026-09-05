/* ============================================================
   Haven — card de story (9:16, 1080×1920) desenhado em canvas.
   openMedia(item) → card de filme/livro/jogo (estilo Letterboxd).
   open()          → card do "momento" (cena + hora + clima + som).
   Exporta via Web Share (mobile → Instagram) ou download.
   ============================================================ */
(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const W = 1080, H = 1920;

  const modal = $('[data-share]');
  const canvas = $('[data-share-canvas]');
  const ctx = canvas.getContext('2d');
  const togglesEl = $('[data-share-toggles]');
  const placeSel = $('[data-share-place]');
  const captionEl = $('[data-share-caption]');
  const INK = '#f6f1e9', SOFT = 'rgba(246,241,233,.74)', DIM = 'rgba(246,241,233,.5)', ACCENT = '#f4d9b8';
  const MES = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];

  let mode = 'moment', item = null, opts = { weather: true, music: true, place: false };

  /* ---------- helpers ---------- */
  const rr = (x, y, w, h, r) => { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); };
  function loadImg(url){
    return new Promise(res => {
      if (!url) return res(null);
      const im = new Image(); im.crossOrigin = 'anonymous';
      im.onload = () => res(im); im.onerror = () => res(null);
      im.src = url; setTimeout(() => res(im.complete && im.naturalWidth ? im : null), 6000);
    });
  }
  function cover(img, x, y, w, h){
    const ir = img.width / img.height, r = w / h; let sw, sh, sx, sy;
    if (ir > r){ sh = img.height; sw = sh * r; sx = (img.width - sw) / 2; sy = 0; }
    else { sw = img.width; sh = sw / r; sx = 0; sy = (img.height - sh) / 2; }
    ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
  }
  function wrap(text, font, maxW, max){
    ctx.font = font; const words = (text || '').split(/\s+/); const lines = []; let line = '';
    for (const w of words){ const t = line ? line + ' ' + w : w;
      if (ctx.measureText(t).width > maxW && line){ lines.push(line); line = w; } else line = t; }
    if (line) lines.push(line);
    return max ? lines.slice(0, max) : lines;
  }
  const dateStr = () => { const d = new Date(); return `${d.getDate()} ${MES[d.getMonth()]} · ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`; };
  async function fonts(){ try { await Promise.all([
    document.fonts.load('200 150px Outfit'), document.fonts.load('400 34px Outfit'),
    document.fonts.load('500 40px Outfit'), document.fonts.load('600 64px Outfit')]); } catch {} }

  /* ---------- MEDIA card ---------- */
  const STATUS_LBL = {
    want:{movie:'QUERO VER',book:'QUERO LER',game:'QUERO JOGAR'},
    doing:{movie:'VENDO',book:'LENDO',game:'JOGANDO'},
    done:{movie:'VISTO',book:'LIDO',game:'ZERADO'} };

  async function drawMedia(){
    const poster = await loadImg(item.poster);
    const scene = await loadImg($('.scene__img.is-on')?.src);
    ctx.clearRect(0, 0, W, H);
    // bg: pôster borrado, senão a cena
    ctx.fillStyle = '#171b21'; ctx.fillRect(0, 0, W, H);
    if (poster){ ctx.filter = 'blur(60px)'; ctx.globalAlpha = .9; cover(poster, -80, -80, W + 160, H + 160); ctx.filter = 'none'; ctx.globalAlpha = 1; }
    else if (scene){ cover(scene, 0, 0, W, H); }
    // escurecer
    let g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, 'rgba(12,15,20,.6)'); g.addColorStop(.4, 'rgba(12,15,20,.35)');
    g.addColorStop(.72, 'rgba(12,15,20,.72)'); g.addColorStop(1, 'rgba(8,10,14,.94)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

    // medir o bloco de texto pra centralizar tudo verticalmente
    const st = STATUS_LBL[item.status]?.[item.type] || '';
    const titleLines = wrap(item.title, '600 64px Outfit', W - 200, 2);
    const note0 = (captionEl.value.trim() || item.note || '').trim();
    const noteLines = note0 ? wrap('“' + note0 + '”', '400 34px Outfit', W - 220, 3) : [];
    const textH = (st ? 62 : 0) + titleLines.length * 74 + ((item.sub || item.year) ? 58 : 0)
      + (item.rating ? 74 : 0) + (noteLines.length ? 46 + noteLines.length * 46 : 0);

    // pôster nítido — bloco (pôster + 92 + texto) centrado entre topo e rodapé
    const pw = 520, ph = 780, px = (W - pw) / 2;
    const total = ph + 92 + textH, top = 150, bot = H - 190;
    const py = Math.max(top, top + ((bot - top) - total) / 2);
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.55)'; ctx.shadowBlur = 60; ctx.shadowOffsetY = 30;
    rr(px, py, pw, ph, 26); ctx.fillStyle = '#222'; ctx.fill(); ctx.restore();
    ctx.save(); rr(px, py, pw, ph, 26); ctx.clip();
    if (poster) cover(poster, px, py, pw, ph);
    else { ctx.fillStyle = '#2a323d'; ctx.fillRect(px, py, pw, ph);
      ctx.fillStyle = DIM; ctx.font = '600 180px Outfit'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText((item.title || '?')[0].toUpperCase(), W / 2, py + ph / 2); }
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,255,255,.14)'; ctx.lineWidth = 1.5; rr(px, py, pw, ph, 26); ctx.stroke();

    // conteúdo (usa as métricas já calculadas)
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    let y = py + ph + 92;
    if (st){ ctx.font = '600 26px Outfit'; ctx.fillStyle = ACCENT;
      if ('letterSpacing' in ctx) ctx.letterSpacing = '4px';
      ctx.fillText(st, W / 2, y); if ('letterSpacing' in ctx) ctx.letterSpacing = '0px'; y += 62; }
    ctx.font = '600 64px Outfit'; ctx.fillStyle = INK;
    titleLines.forEach(l => { ctx.fillText(l, W / 2, y); y += 74; });
    if (item.sub || item.year){ ctx.font = '400 34px Outfit'; ctx.fillStyle = SOFT;
      ctx.fillText(String(item.sub || item.year), W / 2, y); y += 58; }
    if (item.rating){ ctx.font = '400 46px Outfit';
      const stars = '★★★★★'.slice(0, item.rating) + '☆☆☆☆☆'.slice(0, 5 - item.rating);
      ctx.fillStyle = ACCENT; ctx.fillText(stars, W / 2, y); y += 74; }
    if (noteLines.length){ y += 46 - 28; ctx.font = '400 34px Outfit'; ctx.fillStyle = SOFT;
      noteLines.forEach(l => { ctx.fillText(l, W / 2, y); y += 46; }); }

    footer();
  }

  /* ---------- MOMENT card ---------- */
  async function drawMoment(){
    const scene = await loadImg($('.scene__img.is-on')?.src);
    ctx.clearRect(0, 0, W, H); ctx.fillStyle = '#20262e'; ctx.fillRect(0, 0, W, H);
    if (scene) cover(scene, 0, 0, W, H);
    let g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, 'rgba(14,17,22,.5)'); g.addColorStop(.35, 'rgba(14,17,22,.12)');
    g.addColorStop(.62, 'rgba(14,17,22,.32)'); g.addColorStop(1, 'rgba(9,11,15,.88)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // moldura
    ctx.strokeStyle = 'rgba(255,255,255,.26)'; ctx.lineWidth = 1.5; rr(60, 60, W - 120, H - 120, 34); ctx.stroke();

    const pad = 108;
    ctx.textBaseline = 'alphabetic';
    // topo
    ctx.textAlign = 'left'; ctx.font = '600 30px Outfit'; ctx.fillStyle = INK;
    if ('letterSpacing' in ctx) ctx.letterSpacing = '8px';
    ctx.fillText('HAVEN', pad, 168); if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
    ctx.textAlign = 'right'; ctx.font = '400 30px Outfit'; ctx.fillStyle = SOFT;
    ctx.fillText(dateStr(), W - pad, 168);

    // hora grande
    const d = new Date(); const hhmm = `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
    ctx.textAlign = 'left'; ctx.fillStyle = INK; ctx.font = '200 200px Outfit';
    ctx.fillText(hhmm, pad - 6, 1180);

    let y = 1300;
    const row = (tag, val) => {
      if (!val) return;
      ctx.font = '600 24px Outfit'; ctx.fillStyle = ACCENT;
      if ('letterSpacing' in ctx) ctx.letterSpacing = '3px';
      ctx.fillText(tag, pad, y); const tw = ctx.measureText(tag).width;
      if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
      ctx.font = '400 40px Outfit'; ctx.fillStyle = INK;
      const v = wrap(val, '400 40px Outfit', W - pad * 2 - tw - 26, 1)[0] || val;
      ctx.fillText(v, pad + tw + 26, y); y += 76;
    };
    if (opts.weather){ const t = $('[data-temp]')?.textContent || '', c = $('[data-cond]')?.textContent || '', ci = $('[data-city]')?.textContent || '';
      row('CLIMA', [t, c, ci].filter(Boolean).join(' · ')); }
    if (opts.music){ const ti = $('[data-np-title]')?.textContent || '', ar = $('[data-np-artist]')?.textContent || '';
      row('SOM', [ti, ar].filter(Boolean).join(' — ')); }
    if (opts.place && placeSel.value) row('AQUI', placeSel.value);

    const cap = captionEl.value.trim();
    if (cap){ y += 20; ctx.font = '400 36px Outfit'; ctx.fillStyle = SOFT;
      wrap('“' + cap + '”', '400 36px Outfit', W - pad * 2, 2).forEach(l => { ctx.fillText(l, pad, y); y += 50; }); }
  }

  function footer(){
    ctx.textAlign = 'center'; ctx.font = '600 26px Outfit'; ctx.fillStyle = SOFT;
    if ('letterSpacing' in ctx) ctx.letterSpacing = '7px';
    ctx.fillText('HAVEN', W / 2, H - 118); if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
    ctx.font = '400 24px Outfit'; ctx.fillStyle = DIM; ctx.fillText(dateStr(), W / 2, H - 78);
  }

  async function render(){ await fonts(); if (mode === 'media') await drawMedia(); else await drawMoment(); }

  /* ---------- open / close ---------- */
  function openModal(){
    // popular seletor de lugares (para o card do momento)
    if (mode === 'moment'){
      let places = []; try { places = JSON.parse(localStorage.getItem('haven.places.v1')) || []; } catch {}
      placeSel.innerHTML = places.map(p => `<option>${p.name}</option>`).join('');
    }
    togglesEl.hidden = mode !== 'moment';
    placeSel.hidden = !(mode === 'moment' && opts.place);
    captionEl.value = '';
    captionEl.placeholder = mode === 'media' ? 'sua frase (opcional)' : 'uma legenda (opcional)';
    modal.hidden = false;
    requestAnimationFrame(() => modal.classList.add('is-on'));
    setTimeout(() => modal.classList.add('is-on'), 20);
    render();
  }
  function close(){ modal.classList.remove('is-on'); setTimeout(() => { modal.hidden = true; }, 300); }

  /* ---------- export ---------- */
  function filename(){ return (mode === 'media' && item ? item.title.replace(/[^\w]+/g, '-').toLowerCase() : 'haven-momento') + '.png'; }
  async function exportBlob(){ return new Promise(res => canvas.toBlob(res, 'image/png')); }
  async function doShare(){
    const blob = await exportBlob(); if (!blob) return;
    const file = new File([blob], filename(), { type: 'image/png' });
    const text = (mode === 'media' && item ? item.title : 'meu cantinho de hoje');
    try {
      if (navigator.canShare && navigator.canShare({ files: [file] })){
        await navigator.share({ files: [file], text }); return;
      }
    } catch { return; /* usuário cancelou */ }
    download(blob); // fallback desktop
  }
  function download(blob){
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename();
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }

  /* ---------- wiring ---------- */
  $('[data-share-do]').addEventListener('click', doShare);
  $('[data-share-download]').addEventListener('click', async () => { const b = await exportBlob(); if (b) download(b); });
  document.querySelectorAll('[data-share-close]').forEach(el => el.addEventListener('click', close));
  togglesEl.querySelectorAll('.tog').forEach(b => b.addEventListener('click', () => {
    const k = b.dataset.tog; opts[k] = !opts[k]; b.classList.toggle('is-on', opts[k]);
    placeSel.hidden = !(mode === 'moment' && opts.place); render();
  }));
  placeSel.addEventListener('change', render);
  let ct; captionEl.addEventListener('input', () => { clearTimeout(ct); ct = setTimeout(render, 300); });

  window.HavenShare = {
    open(){ mode = 'moment'; item = null; openModal(); },
    openMedia(it){ mode = 'media'; item = it; openModal(); }
  };
})();
