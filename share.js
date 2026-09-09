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
  const stylesEl = $('[data-share-styles]');
  const placeSel = $('[data-share-place]');
  const captionEl = $('[data-share-caption]');
  const INK = '#f6f1e9', SOFT = 'rgba(246,241,233,.74)', DIM = 'rgba(246,241,233,.5)', ACCENT = '#f4d9b8';
  const MES = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];

  let mode = 'moment', item = null, opts = { weather: true, music: true, place: false };
  let profileData = null, cityData = null, placeData = null;
  let TF = 'Outfit';   // fonte de título = a fonte/tema da pessoa (instagramável)
  const tfFam = () => (String(TF).split(',')[0].trim()) || 'Outfit';
  const hexA = (hex, a) => {
    const h = String(hex || '').replace('#',''); if (h.length < 6) return `rgba(244,217,184,${a})`;
    return `rgba(${parseInt(h.slice(0,2),16)},${parseInt(h.slice(2,4),16)},${parseInt(h.slice(4,6),16)},${a})`;
  };

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
    document.fonts.load('500 40px Outfit'), document.fonts.load('600 64px Outfit'),
    document.fonts.load('600 74px ' + tfFam()), document.fonts.load('700 74px ' + tfFam())]); } catch {} }

  /* ============================================================
     ESTILOS (variações instagramáveis) — trocam a ATMOSFERA do card:
     fundo, color grading, auréola do tema, grão de filme, vinheta,
     luz vazada. O conteúdo de cada modo continua igual.
     ============================================================ */
  const STYLES = [
    { key: 'aura',   label: 'Aura' },     // foto borrada + glow na cor do tema (padrão)
    { key: 'filme',  label: 'Filme' },    // grão + luz vazada + tom quente (analógico)
    { key: 'sonho',  label: 'Sonho' },    // blur forte + banho pastel + bloom (etéreo)
    { key: 'poster', label: 'Pôster' },   // gradiente gráfico no accent, sem foto (editorial)
    { key: 'noite',  label: 'Noite' }     // escuro minimalista, hairline + grão fino
  ];
  let styleKey = (() => { try { return localStorage.getItem('haven.share.style') || 'aura'; } catch { return 'aura'; } })();
  const accentNow = () => (mode === 'profile' && profileData?.accent) || (window.HavenTheme && window.HavenTheme.accent) || ACCENT;
  function buildStyles(){
    if (!stylesEl || stylesEl.childElementCount) return;
    STYLES.forEach(s => {
      const b = document.createElement('button');
      b.className = 'share__st' + (s.key === styleKey ? ' is-on' : ''); b.type = 'button'; b.dataset.st = s.key;
      b.textContent = s.label;
      b.addEventListener('click', () => {
        styleKey = s.key; try { localStorage.setItem('haven.share.style', styleKey); } catch {}
        [...stylesEl.children].forEach(x => x.classList.toggle('is-on', x.dataset.st === styleKey));
        render();
      });
      stylesEl.appendChild(b);
    });
  }

  // color grading das FOTOS em primeiro plano (pôster/foto/tiles/avatar)
  function grade(){
    return ({ aura:'none', filme:'sepia(.26) contrast(1.08) saturate(1.06) brightness(1.02)',
      sonho:'saturate(1.22) brightness(1.05) contrast(.97)', poster:'contrast(1.12) saturate(1.12)',
      noite:'contrast(1.06) brightness(.96) saturate(1.02)' })[styleKey] || 'none';
  }
  function coverG(img, x, y, w, h){
    const f = grade();
    if (f && f !== 'none'){ ctx.save(); ctx.filter = f; cover(img, x, y, w, h); ctx.restore(); }
    else cover(img, x, y, w, h);
  }

  // fundo (atrás do conteúdo) — usa a imagem principal do card
  function backdrop(img){
    const A = accentNow();
    ctx.clearRect(0, 0, W, H);
    if (styleKey === 'poster'){
      ctx.fillStyle = '#0a0d12'; ctx.fillRect(0, 0, W, H);
      let g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, hexA(A, .30)); g.addColorStop(.42, 'rgba(13,16,21,.86)'); g.addColorStop(1, '#090c11');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      const rg = ctx.createRadialGradient(W * .82, H * .16, 0, W * .82, H * .16, 940);
      rg.addColorStop(0, hexA(A, .34)); rg.addColorStop(1, hexA(A, 0)); ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H);
      return;
    }
    ctx.fillStyle = '#0f1218'; ctx.fillRect(0, 0, W, H);
    if (img){
      const blur = styleKey === 'sonho' ? 78 : styleKey === 'noite' ? 34 : 54;
      const al = styleKey === 'noite' ? .42 : styleKey === 'sonho' ? .74 : .86;
      ctx.save(); ctx.globalAlpha = al; ctx.filter = `blur(${blur}px)`; cover(img, -100, -100, W + 200, H + 200); ctx.restore();
    }
    let g = ctx.createLinearGradient(0, 0, 0, H);
    if (styleKey === 'sonho'){ g.addColorStop(0, hexA(A, .30)); g.addColorStop(.5, 'rgba(12,14,20,.5)'); g.addColorStop(1, 'rgba(8,10,14,.9)'); }
    else if (styleKey === 'filme'){ g.addColorStop(0, 'rgba(22,15,8,.5)'); g.addColorStop(.5, 'rgba(15,12,9,.48)'); g.addColorStop(1, 'rgba(8,7,6,.93)'); }
    else if (styleKey === 'noite'){ g.addColorStop(0, 'rgba(9,11,15,.7)'); g.addColorStop(.5, 'rgba(9,11,15,.78)'); g.addColorStop(1, 'rgba(6,8,11,.96)'); }
    else { g.addColorStop(0, 'rgba(12,15,20,.55)'); g.addColorStop(.5, 'rgba(12,15,20,.5)'); g.addColorStop(1, 'rgba(8,10,14,.93)'); }
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    if (styleKey === 'aura' || styleKey === 'sonho'){
      const rg = ctx.createRadialGradient(W / 2, H * .28, 0, W / 2, H * .28, 820);
      rg.addColorStop(0, hexA(A, styleKey === 'sonho' ? .30 : .20)); rg.addColorStop(1, hexA(A, 0));
      ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H);
    }
  }

  // acabamento (sobre o conteúdo): vinheta, luz vazada, grão, moldura
  let grainTile;
  function grain(alpha){
    if (!grainTile){
      const n = 150, c = document.createElement('canvas'); c.width = c.height = n; const g = c.getContext('2d');
      const id = g.createImageData(n, n), d = id.data;
      for (let i = 0; i < d.length; i += 4){ const v = 128 + (Math.random() * 2 - 1) * 62; d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255; }
      g.putImageData(id, 0, 0); grainTile = c;
    }
    ctx.save(); ctx.globalAlpha = alpha; ctx.globalCompositeOperation = 'overlay';
    ctx.fillStyle = ctx.createPattern(grainTile, 'repeat'); ctx.fillRect(0, 0, W, H); ctx.restore();
  }
  function finish(){
    if (styleKey !== 'noite'){
      const vg = ctx.createRadialGradient(W / 2, H / 2, H * .34, W / 2, H / 2, H * .72);
      vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, styleKey === 'sonho' ? 'rgba(6,7,12,.5)' : 'rgba(6,8,12,.42)');
      ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
    }
    if (styleKey === 'filme'){
      const ll = ctx.createRadialGradient(W * .86, H * .10, 0, W * .86, H * .10, 720);
      ll.addColorStop(0, 'rgba(255,170,90,.5)'); ll.addColorStop(.5, 'rgba(255,120,80,.16)'); ll.addColorStop(1, 'rgba(255,120,80,0)');
      ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.fillStyle = ll; ctx.fillRect(0, 0, W, H); ctx.restore();
    }
    const gA = ({ aura:.05, filme:.14, sonho:.06, poster:.05, noite:.09 })[styleKey];
    if (gA) grain(gA);
    if (styleKey === 'filme' || styleKey === 'noite'){
      ctx.strokeStyle = styleKey === 'filme' ? 'rgba(245,230,210,.22)' : 'rgba(255,255,255,.16)';
      ctx.lineWidth = 1.5; rr(54, 54, W - 108, H - 108, styleKey === 'noite' ? 30 : 20); ctx.stroke();
    }
  }

  /* ---------- MEDIA card ---------- */
  const STATUS_LBL = {
    want:{movie:'QUERO VER',book:'QUERO LER',game:'QUERO JOGAR'},
    doing:{movie:'VENDO',book:'LENDO',game:'JOGANDO'},
    done:{movie:'VISTO',book:'LIDO',game:'ZERADO'} };

  async function drawMedia(){
    const poster = await loadImg(item.poster);
    const scene = await loadImg($('.scene__img.is-on')?.src);
    backdrop(poster || scene);
    const A = accentNow();

    // medir o bloco de texto pra centralizar tudo verticalmente
    const st = STATUS_LBL[item.status]?.[item.type] || '';
    const titleLines = wrap(item.title, '600 64px ' + TF, W - 200, 2);
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
    if (poster) coverG(poster, px, py, pw, ph);
    else { ctx.fillStyle = '#2a323d'; ctx.fillRect(px, py, pw, ph);
      ctx.fillStyle = DIM; ctx.font = '600 180px Outfit'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText((item.title || '?')[0].toUpperCase(), W / 2, py + ph / 2); }
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,255,255,.14)'; ctx.lineWidth = 1.5; rr(px, py, pw, ph, 26); ctx.stroke();

    // conteúdo (usa as métricas já calculadas)
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    let y = py + ph + 92;
    if (st){ ctx.font = '600 26px Outfit'; ctx.fillStyle = A;
      if ('letterSpacing' in ctx) ctx.letterSpacing = '4px';
      ctx.fillText(st, W / 2, y); if ('letterSpacing' in ctx) ctx.letterSpacing = '0px'; y += 62; }
    ctx.font = '600 64px ' + TF; ctx.fillStyle = INK;
    titleLines.forEach(l => { ctx.fillText(l, W / 2, y); y += 74; });
    if (item.sub || item.year){ ctx.font = '400 34px Outfit'; ctx.fillStyle = SOFT;
      ctx.fillText(String(item.sub || item.year), W / 2, y); y += 58; }
    if (item.rating){ ctx.font = '400 46px Outfit';
      const stars = '★★★★★'.slice(0, item.rating) + '☆☆☆☆☆'.slice(0, 5 - item.rating);
      ctx.fillStyle = A; ctx.fillText(stars, W / 2, y); y += 74; }
    if (noteLines.length){ y += 46 - 28; ctx.font = '400 34px Outfit'; ctx.fillStyle = SOFT;
      noteLines.forEach(l => { ctx.fillText(l, W / 2, y); y += 46; }); }

    finish();
    footer();
  }

  /* ---------- MOMENT card ---------- */
  async function drawMoment(){
    const scene = await loadImg($('.scene__img.is-on')?.src);
    const A = accentNow();
    if (styleKey === 'poster' || !scene){ backdrop(scene); }
    else {
      ctx.clearRect(0, 0, W, H); ctx.fillStyle = '#20262e'; ctx.fillRect(0, 0, W, H);
      coverG(scene, 0, 0, W, H);                                  // cena nítida (herói)
      let g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, 'rgba(14,17,22,.5)'); g.addColorStop(.35, 'rgba(14,17,22,.12)');
      g.addColorStop(.62, 'rgba(14,17,22,.32)'); g.addColorStop(1, 'rgba(9,11,15,.9)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      if (styleKey === 'sonho'){ const rg = ctx.createRadialGradient(W/2, H*.3, 0, W/2, H*.3, 820); rg.addColorStop(0, hexA(A, .26)); rg.addColorStop(1, hexA(A, 0)); ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H); }
    }

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
    ctx.textAlign = 'left'; ctx.fillStyle = INK; ctx.font = '200 200px ' + TF;
    ctx.fillText(hhmm, pad - 6, 1180);

    let y = 1300;
    const row = (tag, val) => {
      if (!val) return;
      ctx.font = '600 24px Outfit'; ctx.fillStyle = A;
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
    finish();
  }

  /* ---------- PROFILE card (o perfil inteiro) ---------- */
  async function drawProfile(){
    const d = profileData || {};
    const accent = d.accent || ACCENT;
    const scene = await loadImg($('.scene__img.is-on')?.src);
    const photo = await loadImg(d.photo);
    const posters = [];
    for (const u of (d.posters || []).slice(0, 4)) posters.push(await loadImg(u));

    backdrop(scene);

    // avatar
    const av = 260, ax = (W - av) / 2, ay = 296, acx = W / 2, acy = ay + av / 2;
    ctx.save(); ctx.beginPath(); ctx.arc(acx, acy, av / 2, 0, 7); ctx.closePath();
    ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = 50; ctx.shadowOffsetY = 20; ctx.fillStyle = '#2a323d'; ctx.fill(); ctx.restore();
    ctx.save(); ctx.beginPath(); ctx.arc(acx, acy, av / 2, 0, 7); ctx.clip();
    if (photo) coverG(photo, ax, ay, av, av);
    else { ctx.fillStyle = '#2a323d'; ctx.fillRect(ax, ay, av, av);
      ctx.fillStyle = accent; ctx.font = '600 130px Outfit'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText((d.name || '?')[0].toUpperCase(), acx, acy); }
    ctx.restore();
    ctx.lineWidth = 4; ctx.strokeStyle = hexA(accent, .9); ctx.beginPath(); ctx.arc(acx, acy, av / 2, 0, 7); ctx.stroke();

    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    let y = ay + av + 100;
    ctx.font = '600 74px ' + TF; ctx.fillStyle = INK; ctx.fillText(d.name || 'Você', W / 2, y); y += 58;
    if (d.insta){ ctx.font = '400 38px Outfit'; ctx.fillStyle = accent; ctx.fillText('@' + String(d.insta).replace(/^@/, ''), W / 2, y); }
    if (d.bio){ y += 66; ctx.font = '400 38px Outfit'; ctx.fillStyle = SOFT;
      wrap(d.bio, '400 38px Outfit', W - 260, 3).forEach(l => { ctx.fillText(l, W / 2, y); y += 52; }); y -= 6; }
    y += 54; ctx.font = '400 32px Outfit'; ctx.fillStyle = DIM;
    ctx.fillText(`${d.titles || 0} títulos    ·    ${d.places || 0} lugares`, W / 2, y);

    // favoritos
    const shown = posters.filter(Boolean).slice(0, 4);
    if (shown.length){
      const pw = 218, ph = 328, gap = 26, rowW = shown.length * pw + (shown.length - 1) * gap;
      let px = (W - rowW) / 2; const pyr = 1380;
      ctx.font = '600 26px Outfit'; ctx.fillStyle = accent;
      if ('letterSpacing' in ctx) ctx.letterSpacing = '5px';
      ctx.fillText('FAVORITOS', W / 2, pyr - 34); if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
      shown.forEach(im => {
        ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = 30; ctx.shadowOffsetY = 14;
        rr(px, pyr, pw, ph, 18); ctx.fillStyle = '#222'; ctx.fill(); ctx.restore();
        ctx.save(); rr(px, pyr, pw, ph, 18); ctx.clip(); coverG(im, px, pyr, pw, ph); ctx.restore();
        px += pw + gap;
      });
    }
    ctx.textAlign = 'center'; ctx.font = '400 34px Outfit'; ctx.fillStyle = SOFT;
    ctx.fillText('entra pra me conhecer ✨', W / 2, H - 214);
    finish();
    footer();
  }

  /* ---------- CITY card (minha cidade + colagem de lugares) ---------- */
  function drawCollage(tiles, top, bottomLimit){
    const list = tiles.slice(0, 6);
    if (!list.length) return;
    const M = 108, gap = 22, availW = W - M * 2, availH = bottomLimit - top;
    const cols = list.length === 1 ? 1 : list.length <= 4 ? 2 : 3;
    const rows = Math.ceil(list.length / cols);
    const tw = (availW - (cols - 1) * gap) / cols;
    const th = Math.min(tw * 1.15, (availH - (rows - 1) * gap) / rows);
    const gridH = rows * th + (rows - 1) * gap;
    const y0 = top + Math.max(0, (availH - gridH) / 2);
    list.forEach((t, i) => {
      const r = Math.floor(i / cols), c = i % cols;
      const inRow = Math.min(cols, list.length - r * cols);
      const rowW = inRow * tw + (inRow - 1) * gap;
      const rx = (W - rowW) / 2 + c * (tw + gap);
      const ry = y0 + r * (th + gap);
      // sombra + base
      ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = 28; ctx.shadowOffsetY = 12;
      rr(rx, ry, tw, th, 20); ctx.fillStyle = '#222'; ctx.fill(); ctx.restore();
      // conteúdo (foto ou tile colorido com emoji)
      ctx.save(); rr(rx, ry, tw, th, 20); ctx.clip();
      if (t.img) coverG(t.img, rx, ry, tw, th);
      else {
        const grd = ctx.createLinearGradient(rx, ry, rx, ry + th);
        grd.addColorStop(0, hexA(t.color, .55)); grd.addColorStop(1, hexA(t.color, .2));
        ctx.fillStyle = grd; ctx.fillRect(rx, ry, tw, th);
        ctx.font = '84px Outfit'; ctx.fillStyle = 'rgba(255,255,255,.92)';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(t.emoji || '✨', rx + tw / 2, ry + th / 2 - 10);
        ctx.textBaseline = 'alphabetic';
      }
      // véu inferior pro nome
      const bg2 = ctx.createLinearGradient(rx, ry + th - 96, rx, ry + th);
      bg2.addColorStop(0, 'rgba(8,10,14,0)'); bg2.addColorStop(1, 'rgba(8,10,14,.82)');
      ctx.fillStyle = bg2; ctx.fillRect(rx, ry + th - 96, tw, 96);
      ctx.restore();
      // emoji da categoria (canto) + nome
      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      if (t.img){ ctx.font = '32px Outfit'; ctx.fillText(t.emoji || '', rx + 16, ry + 46); }
      if (t.name){ ctx.font = '600 26px Outfit'; ctx.fillStyle = INK;
        const nm = wrap(t.name, '600 26px Outfit', tw - 30, 1)[0] || t.name;
        ctx.fillText(nm, rx + 16, ry + th - 26); }
      // borda na cor da categoria
      ctx.strokeStyle = hexA(t.color, .6); ctx.lineWidth = 2; rr(rx, ry, tw, th, 20); ctx.stroke();
    });
  }

  async function drawCity(){
    const d = cityData || {};
    const tiles = [];
    for (const t of (d.tiles || []).slice(0, 6)) tiles.push({ ...t, img: await loadImg(t.cover) });
    const scene = await loadImg($('.scene__img.is-on')?.src);
    const bg = tiles.find(t => t.img)?.img || scene;
    const A = accentNow();
    backdrop(bg);

    const pad = 108;
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left'; ctx.font = '600 30px Outfit'; ctx.fillStyle = INK;
    if ('letterSpacing' in ctx) ctx.letterSpacing = '8px';
    ctx.fillText('HAVEN', pad, 168); if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
    ctx.textAlign = 'right'; ctx.font = '400 30px Outfit'; ctx.fillStyle = SOFT; ctx.fillText(dateStr(), W - pad, 168);

    ctx.textAlign = 'center';
    ctx.font = '600 30px Outfit'; ctx.fillStyle = A;
    if ('letterSpacing' in ctx) ctx.letterSpacing = '6px';
    ctx.fillText('MINHA CIDADE', W / 2, 372); if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
    ctx.font = '600 96px ' + TF; ctx.fillStyle = INK;
    const nameLines = wrap(d.city || 'Minha cidade', '600 96px ' + TF, W - 220, 2);
    let ty = 466; nameLines.forEach(l => { ctx.fillText(l, W / 2, ty); ty += 104; });
    ctx.font = '400 40px Outfit'; ctx.fillStyle = SOFT;
    const n = d.count || tiles.length;
    ctx.fillText(`${n} ${n === 1 ? 'lugar' : 'lugares'} que eu amo`, W / 2, ty + 4);

    drawCollage(tiles, ty + 74, H - 300);

    ctx.textAlign = 'center'; ctx.font = '400 34px Outfit'; ctx.fillStyle = SOFT;
    ctx.fillText('vem conhecer meus cantinhos ✨', W / 2, H - 206);
    finish();
    footer();
  }

  /* ---------- PLACE card (um lugar: foto + nota + review) ---------- */
  async function drawPlace(){
    const d = placeData || {};
    const shot = await loadImg((d.photos || [])[0]);
    const scene = await loadImg($('.scene__img.is-on')?.src);
    const bg = shot || scene;
    const A = accentNow();
    backdrop(bg);

    // foto grande (ou bloco colorido com emoji)
    const pw = 760, ph = 760, px = (W - pw) / 2, py = 244;
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = 60; ctx.shadowOffsetY = 26;
    rr(px, py, pw, ph, 30); ctx.fillStyle = '#222'; ctx.fill(); ctx.restore();
    ctx.save(); rr(px, py, pw, ph, 30); ctx.clip();
    if (shot) coverG(shot, px, py, pw, ph);
    else {
      const grd = ctx.createLinearGradient(px, py, px, py + ph);
      grd.addColorStop(0, hexA(d.color, .5)); grd.addColorStop(1, hexA(d.color, .2));
      ctx.fillStyle = grd; ctx.fillRect(px, py, pw, ph);
      ctx.font = '260px Outfit'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = 'rgba(255,255,255,.92)';
      ctx.fillText(d.emoji || '📍', W / 2, py + ph / 2 - 10); ctx.textBaseline = 'alphabetic';
    }
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,255,255,.14)'; ctx.lineWidth = 1.5; rr(px, py, pw, ph, 30); ctx.stroke();

    // chip de categoria sobre a foto
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    const chip = `${d.emoji || ''} ${d.label || 'lugar'}`.trim();
    ctx.font = '600 30px Outfit';
    const cw = ctx.measureText(chip).width + 44;
    ctx.save(); rr(px + 22, py + 22, cw, 54, 27); ctx.fillStyle = hexA(d.color, .94); ctx.fill(); ctx.restore();
    ctx.fillStyle = '#12161c'; ctx.fillText(chip, px + 44, py + 57);

    // nome + estrelas + cidade + review
    ctx.textAlign = 'center';
    let y = py + ph + 92;
    ctx.font = '600 68px ' + TF; ctx.fillStyle = INK;
    wrap(d.name || 'Um lugar', '600 68px ' + TF, W - 200, 2).forEach(l => { ctx.fillText(l, W / 2, y); y += 78; });
    if (d.rating){ ctx.font = '400 46px Outfit'; ctx.fillStyle = A;
      ctx.fillText('★★★★★'.slice(0, d.rating) + '☆☆☆☆☆'.slice(0, 5 - d.rating), W / 2, y); y += 68; }
    if (d.city){ ctx.font = '400 32px Outfit'; ctx.fillStyle = DIM; ctx.fillText('em ' + d.city, W / 2, y); y += 52; }
    if (d.note){ y += 10; ctx.font = '400 34px Outfit'; ctx.fillStyle = SOFT;
      wrap('“' + d.note + '”', '400 34px Outfit', W - 220, 3).forEach(l => { ctx.fillText(l, W / 2, y); y += 46; }); }
    finish();
    footer();
  }

  function footer(){
    ctx.textAlign = 'center'; ctx.font = '600 26px Outfit'; ctx.fillStyle = SOFT;
    if ('letterSpacing' in ctx) ctx.letterSpacing = '7px';
    ctx.fillText('HAVEN', W / 2, H - 118); if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
    ctx.font = '400 24px Outfit'; ctx.fillStyle = DIM; ctx.fillText(dateStr(), W / 2, H - 78);
  }

  async function render(){ await fonts(); if (mode === 'media') await drawMedia(); else if (mode === 'profile') await drawProfile(); else if (mode === 'city') await drawCity(); else if (mode === 'place') await drawPlace(); else await drawMoment(); }

  /* ---------- open / close ---------- */
  function openModal(){
    buildStyles();
    // popular seletor de lugares (para o card do momento)
    if (mode === 'moment'){
      let places = []; try { places = JSON.parse(localStorage.getItem('haven.places.v1')) || []; } catch {}
      placeSel.innerHTML = places.map(p => `<option>${p.name}</option>`).join('');
    }
    togglesEl.hidden = mode !== 'moment';
    placeSel.hidden = !(mode === 'moment' && opts.place);
    captionEl.value = '';
    captionEl.hidden = mode === 'profile' || mode === 'city' || mode === 'place';   // perfil/cidade/lugar não usam legenda
    captionEl.placeholder = mode === 'media' ? 'sua frase (opcional)' : 'uma legenda (opcional)';
    modal.hidden = false;
    requestAnimationFrame(() => modal.classList.add('is-on'));
    setTimeout(() => modal.classList.add('is-on'), 20);
    render();
  }
  function close(){ modal.classList.remove('is-on'); setTimeout(() => { modal.hidden = true; }, 300); }

  /* ---------- export ---------- */
  function filename(){ return (mode === 'media' && item ? item.title.replace(/[^\w]+/g, '-').toLowerCase() : mode === 'profile' ? 'meu-haven' : mode === 'city' ? 'minha-cidade' : mode === 'place' ? 'lugar' : 'haven-momento') + '.png'; }
  async function exportBlob(){ return new Promise(res => canvas.toBlob(res, 'image/png')); }
  async function doShare(){
    const blob = await exportBlob(); if (!blob) return;
    const file = new File([blob], filename(), { type: 'image/png' });
    const text = (mode === 'media' && item ? item.title : mode === 'profile' ? 'meu Haven ✨' : mode === 'city' ? 'minha cidade ✨' : mode === 'place' ? (placeData?.name || 'um lugar') + ' ✨' : 'meu cantinho de hoje');
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

  const themeFont = () => (window.HavenTheme && window.HavenTheme.font) || 'Outfit';
  window.HavenShare = {
    open(){ mode = 'moment'; item = null; TF = themeFont(); openModal(); },
    openMedia(it){ mode = 'media'; item = it; TF = (it && it.font) || themeFont(); openModal(); },
    openProfile(data){ mode = 'profile'; item = null; profileData = data || {}; TF = (data && data.font) || themeFont(); openModal(); },
    openCity(data){ mode = 'city'; item = null; cityData = data || {}; TF = themeFont(); openModal(); },
    openPlace(data){ mode = 'place'; item = null; placeData = data || {}; TF = themeFont(); openModal(); }
  };
})();
