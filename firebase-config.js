/* ============================================================
   Haven — config do Firebase (projeto haven-9a311).
   O config web é PÚBLICO por design (quem protege os dados são
   as Security Rules, não a chave). Segredos de API (TMDB/RAWG/
   Spotify) NÃO vêm aqui — ficam nas Cloud Functions.
   ============================================================ */
window.HAVEN_FIREBASE = {
  apiKey: "AIzaSyD3ri5oPfZ3Vp4s4jdWFoEGz2m5xkjGZW8",
  authDomain: "haven-9a311.firebaseapp.com",
  projectId: "haven-9a311",
  // URL do Realtime Database — CONFIRME no topo da tela do RTDB no console.
  // Padrão us-central: https://haven-9a311-default-rtdb.firebaseio.com
  // Regional (ex. São Paulo): https://haven-9a311-default-rtdb.southamerica-east1.firebasedatabase.app
  databaseURL: "https://haven-9a311-default-rtdb.firebaseio.com",
  storageBucket: "haven-9a311.firebasestorage.app",
  messagingSenderId: "333154308602",
  appId: "1:333154308602:web:8523ba04f18652b5271443",
  measurementId: "G-QLZQM1HTD7"
};

/* Chaves DA PLATAFORMA (nós fornecemos — o usuário NUNCA conecta nada).
   Preencha uma vez com suas chaves grátis:
   - TMDB (filmes): https://www.themoviedb.org/settings/api  → "Chave da API (v3)"
   - RAWG (jogos):  https://rawg.io/apidocs                  → sua API key
   Obs: por enquanto vão no cliente (MVP). Depois migram pro proxy das
   Cloud Functions (Blaze), aí some do cliente de vez. Livros não precisam. */
window.HAVEN_KEYS = {
  tmdb: "e49176f59a36df95d59319117fe9e1d8",
  rawg: ""
};
