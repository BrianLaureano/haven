/* ============================================================
   Haven — login/gate. Em modo Firebase, exige entrar com Google;
   em modo local, não gateia (usuário único do navegador).
   ============================================================ */
(() => {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const gate = $('[data-gate]');
  const nameEl = $('.hello__name');
  const outBtn = $('[data-signout]');
  const defaultName = nameEl ? nameEl.textContent : 'Brian';

  function firstName(n){ return (n || '').trim().split(/\s+/)[0] || defaultName; }

  const VISIT = new URLSearchParams(location.search).get('u');
  function update(user){
    const db = window.HavenDB;
    // visitante (link da bio) nunca loga — vê o perfil público
    const needLogin = !VISIT && db && db.mode === 'firebase' && !user;
    if (gate) gate.hidden = !needLogin;
    // saudação com o nome de quem entrou
    if (nameEl) nameEl.textContent = user ? firstName(user.name) : (db?.mode === 'firebase' ? 'você' : defaultName);
    if (outBtn) outBtn.hidden = !(db && db.mode === 'firebase' && user);
  }

  const errEl = document.querySelector('[data-gate-err]');
  function showErr(msg){ if (!errEl) return; errEl.textContent = msg || ''; errEl.hidden = !msg; }
  function friendly(err){
    const c = err?.code || '';
    if (c === 'auth/operation-not-allowed') return 'Ative o login com Google no console (Authentication → Google).';
    if (c === 'auth/unauthorized-domain') return `Domínio não autorizado — adicione "${location.hostname}" em Authentication → Settings → Domínios autorizados.`;
    if (c === 'auth/popup-closed-by-user') return '';   // usuário fechou; sem alarme
    if (c === 'auth/configuration-not-found') return 'Provedor Google ainda não configurado no console.';
    return (err?.code ? err.code + ' — ' : '') + (err?.message || 'falhou ao entrar');
  }

  $('[data-gate-signin]')?.addEventListener('click', async (e) => {
    const b = e.currentTarget; b.disabled = true; showErr('');
    try { await window.HavenDB.signIn(); }
    catch (err){ console.warn('[haven] login', err); showErr(friendly(err)); }
    finally { b.disabled = false; }
  });
  outBtn?.addEventListener('click', async () => {
    if (window.confirm('Sair da sua conta?')) { try { await window.HavenDB.signOut(); } catch {} }
  });

  (async () => {
    if (!window.HavenDB) return;
    await window.HavenDB.ready;
    update(window.HavenDB.user);
    window.HavenDB.onUser(update);
  })();
})();
