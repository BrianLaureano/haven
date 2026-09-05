/* ============================================================
   Haven — fachada de dados (local ↔ Firebase).
   Um só ponto pra ler/gravar dados de usuário e fotos.
   - Sem config Firebase → MODO LOCAL (localStorage + IndexedDB).
   - Com config → Firestore + Storage + Auth (multiusuário).
   Os apps (Coleção, Mapa, Wallpaper) falam só com window.HavenDB;
   trocar o backend não reescreve as features.

   API:
     HavenDB.ready            → Promise (resolve após init + 1º auth)
     HavenDB.mode             → 'local' | 'firebase'
     HavenDB.user             → { uid, name, photo } | null
     HavenDB.onUser(cb)       → chama cb(user) agora e a cada mudança
     HavenDB.signIn()/signOut()
     await HavenDB.getDoc(name)         → objeto | null   (name: collection|places|wallpaper|profile…)
     await HavenDB.setDoc(name, obj)
     await HavenDB.putPhoto(blob)       → { id, url }
     await HavenDB.photoURL(id)         → url | null
     await HavenDB.delPhoto(id)
   ============================================================ */
(() => {
  'use strict';
  const cfg = window.HAVEN_FIREBASE || {};
  // ?local=1 força o modo local (pra desenvolvimento/preview sem login Google)
  const forceLocal = /[?&]local=1\b/.test(location.search);
  const useFB = cfg.apiKey && !/^YOUR_/.test(cfg.apiKey) && !forceLocal;

  const loadScript = src => new Promise((res, rej) => {
    const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s);
  });

  /* ---------- IndexedDB (fotos, modo local + cache) ---------- */
  const idb = (() => {
    let dbp;
    const open = () => dbp || (dbp = new Promise((res, rej) => {
      const r = indexedDB.open('haven-db', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('blobs');
      r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
    }));
    const tx = m => open().then(db => db.transaction('blobs', m).objectStore('blobs'));
    return {
      get: k => tx('readonly').then(s => new Promise((res, rej) => { const q = s.get(k); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); })),
      set: (k, v) => tx('readwrite').then(s => new Promise((res, rej) => { const q = s.put(v, k); q.onsuccess = () => res(); q.onerror = () => rej(q.error); })),
      del: k => tx('readwrite').then(s => new Promise(res => { s.delete(k); res(); }))
    };
  })();
  const uid4 = () => 'x' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const objURLs = new Map();

  /* ============================================================
     MODO LOCAL
     ============================================================ */
  function localBackend(){
    const listeners = [];
    const user = { uid: 'local', name: 'Você', photo: null };
    const key = name => `haven.db.local.${name}`;
    return {
      mode: 'local',
      ready: Promise.resolve(),
      get user(){ return user; },
      onUser(cb){ listeners.push(cb); cb(user); },
      async signIn(){ return user; },
      async signOut(){ /* local não desloga */ },
      async getDoc(name){ try { return JSON.parse(localStorage.getItem(key(name))); } catch { return null; } },
      async setDoc(name, obj){ try { localStorage.setItem(key(name), JSON.stringify(obj)); } catch {} },
      async setPublic(obj){ try { localStorage.setItem('haven.public.' + user.uid, JSON.stringify(obj)); } catch {} },
      async getPublic(uid){ try { return JSON.parse(localStorage.getItem('haven.public.' + (uid || user.uid))); } catch { return null; } },
      async putPhoto(blob){ const id = uid4(); await idb.set(id, blob); const url = URL.createObjectURL(blob); objURLs.set(id, url); return { id, url }; },
      async photoURL(id){ if (objURLs.has(id)) return objURLs.get(id); const b = await idb.get(id); if (!b) return null; const u = URL.createObjectURL(b); objURLs.set(id, u); return u; },
      async delPhoto(id){ await idb.del(id); const u = objURLs.get(id); if (u){ URL.revokeObjectURL(u); objURLs.delete(id); } }
    };
  }

  /* ============================================================
     MODO FIREBASE
     ============================================================ */
  async function firebaseBackend(){
    const V = '10.12.0', base = `https://www.gstatic.com/firebasejs/${V}/`;
    await loadScript(base + 'firebase-app-compat.js');
    await Promise.all([
      loadScript(base + 'firebase-auth-compat.js'),
      loadScript(base + 'firebase-database-compat.js'),
      loadScript(base + 'firebase-storage-compat.js')
    ]);
    const fb = window.firebase;
    fb.initializeApp(cfg);
    const auth = fb.auth(), rtdb = fb.database(), storage = fb.storage();
    let user = null; const listeners = [];
    const emit = () => listeners.forEach(cb => cb(user));

    const ready = new Promise(res => {
      auth.onAuthStateChanged(u => {
        user = u ? { uid: u.uid, name: u.displayName || 'Você', photo: u.photoURL || null } : null;
        emit(); res();
      });
    });
    auth.getRedirectResult().catch(() => {});   // completa login via redirect (webview/popup bloqueado)
    const need = () => { if (!user) throw new Error('sem login'); return user.uid; };
    // cada doc guardado como JSON string em users/{uid}/data/{name} (evita as manhas de array do RTDB)
    const dref = name => rtdb.ref(`users/${need()}/data/${name}`);

    return {
      mode: 'firebase',
      ready,
      get user(){ return user; },
      onUser(cb){ listeners.push(cb); if (user !== undefined) cb(user); },
      async signIn(){
        const p = new fb.auth.GoogleAuthProvider();
        try { await auth.signInWithPopup(p); return user; }
        catch (e){
          // popup bloqueado (comum em webview) → tenta redirect
          if (['auth/popup-blocked','auth/operation-not-supported-in-this-environment','auth/cancelled-popup-request'].includes(e.code)){ await auth.signInWithRedirect(p); return; }
          throw e;
        }
      },
      async signOut(){ await auth.signOut(); },
      async getDoc(name){ const s = await dref(name).once('value'); const v = s.val(); try { return v ? JSON.parse(v) : null; } catch { return null; } },
      async setDoc(name, obj){ await dref(name).set(JSON.stringify(obj)); },
      // snapshot público (perfil da bio) — leitura sem login pelas regras
      async setPublic(obj){ await rtdb.ref('profiles/' + need()).set(JSON.stringify(obj)); },
      async getPublic(uid){ const s = await rtdb.ref('profiles/' + uid).once('value'); const v = s.val(); try { return v ? JSON.parse(v) : null; } catch { return null; } },
      // fotos no Storage; se indisponível (ex. plano Spark sem Storage), cai pro IndexedDB local (prefixo loc_)
      async putPhoto(blob){
        try { const id = uid4(); const ref = storage.ref(`users/${need()}/photos/${id}`); await ref.put(blob); return { id, url: await ref.getDownloadURL() }; }
        catch { const id = 'loc_' + uid4(); await idb.set(id, blob); const url = URL.createObjectURL(blob); objURLs.set(id, url); return { id, url }; }
      },
      async photoURL(id){
        if (String(id).startsWith('loc_')){ if (objURLs.has(id)) return objURLs.get(id); const b = await idb.get(id); if (!b) return null; const u = URL.createObjectURL(b); objURLs.set(id, u); return u; }
        try { return await storage.ref(`users/${need()}/photos/${id}`).getDownloadURL(); } catch { return null; }
      },
      async delPhoto(id){ if (String(id).startsWith('loc_')){ await idb.del(id); return; } try { await storage.ref(`users/${need()}/photos/${id}`).delete(); } catch {} }
    };
  }

  /* ---------- boot ---------- */
  let impl = localBackend();               // começa local; troca se Firebase subir
  const facade = {
    get mode(){ return impl.mode; },
    get user(){ return impl.user; },
    onUser(cb){ return impl.onUser(cb); },
    signIn(){ return impl.signIn(); },
    signOut(){ return impl.signOut(); },
    getDoc(n){ return impl.getDoc(n); },
    setDoc(n, o){ return impl.setDoc(n, o); },
    setPublic(o){ return impl.setPublic(o); },
    getPublic(uid){ return impl.getPublic(uid); },
    putPhoto(b){ return impl.putPhoto(b); },
    photoURL(id){ return impl.photoURL(id); },
    delPhoto(id){ return impl.delPhoto(id); }
  };
  facade.ready = (async () => {
    if (useFB){
      try { impl = await firebaseBackend(); await impl.ready; }
      catch (e){ console.warn('[haven-db] Firebase falhou, seguindo local:', e); impl = localBackend(); }
    }
    return facade;
  })();
  window.HavenDB = facade;
})();
