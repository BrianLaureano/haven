/* CONTEÚDO DE AMOSTRA (real e apurado) — ?demo=1 semeia um Haven cheio no modo local.
   Pôsteres reais: TMDB (filmes), OpenLibrary (livros por ISBN), Steam (jogos por appid).
   Lugares reais de São Paulo com coordenadas certas. Fotos incidentais: Lorem Picsum
   (fotografias reais) e i.pravatar (rosto). Abra: ?local=1&demo=1&mock=1
   Roda ANTES do haven-db.js e grava os localStorage keys que o HavenDB local lê. */
(function () {
  const set = (name, obj) => { try { localStorage.setItem('haven.db.local.' + name, JSON.stringify(obj)); } catch (_) {} };
  const pic = (s, w, h) => `https://picsum.photos/seed/${s}/${w}/${h || w}`;
  const tmdb = p => `https://image.tmdb.org/t/p/w500${p}`;
  const book = isbn => `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg`;
  const game = id => `https://cdn.cloudflare.steamstatic.com/steam/apps/${id}/library_600x900.jpg`;
  const now = Date.now();
  const it = (type, slug, title, poster, rating, sub) => ({ id: type + ':' + slug, title, poster, rating, sub, addedAt: now - Math.random() * 1e9, type });

  const profileObj = {
    widgets: ['status','destaque','now','favoritos','video','galeria','frase','cidade','filmes','livros','jogos','semana','contador','links','memories','social'],
    accent: '#c9a8f0', font: 'space', theme: '',
    photo: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=320&h=320&fit=crop&crop=faces',
    cover: pic('havencover', 1000, 340),
    bio: 'designer de produto · café de especialidade, cinema e um bom RPG. construindo coisas bonitas em São Paulo ✨',
    instagram: 'brian.haven',
    socials: { instagram: 'brian.haven', tiktok: 'brianhaven', twitch: 'brianplays', x: 'brianx' },
    status: { emoji: '🎧', text: 'codando e ouvindo lo-fi' },
    pin: { img: pic('portfolio', 800, 600), title: 'Meu portfólio', caption: 'projetos de UI/UX e front-end', link: 'https://example.com' },
    gallery: [pic('sp1',400),pic('sp2',400),pic('sp3',400),pic('sp4',400),pic('sp5',400),pic('sp6',400)].map(u => ({ url: u })),
    links: [
      { emoji: '💼', label: 'Portfólio', url: 'https://example.com' },
      { emoji: '💌', label: 'Fala comigo', url: 'https://wa.me/5511999999999' },
      { emoji: '☕', label: 'Me paga um café', url: 'https://example.com/tip' }
    ],
    video: 'https://youtu.be/DWcJFNfaw9c',   // Lofi Girl — beats to sleep/chill (embed OK, verificado)
    week: { mon:'💪', tue:'📚', wed:'🎮', thu:'☕', fri:'🍻', sat:'🎬', sun:'🌿' },
    counter: { label: 'Férias', date: '2026-12-20' },
    quote: 'faça o que te dá paz ✨',
    moment: { read: 'O Nome do Vento', watch: 'The Bear', play: 'Elden Ring' },
    layout: { destaque: { v: 1 }, galeria: { v: 0 } }, blocks: {}, hiddenCats: []
  };
  set('profile', profileObj);

  const collection = {
    movie: [
      it('movie','parasita','Parasita', tmdb('/igw938inb6Fy0YVcwIyxQ7Lu5FO.jpg'), 5, '2019'),
      it('movie','cidade-de-deus','Cidade de Deus', tmdb('/gfnXixcGC060QcG6JPxN6AMdVsq.jpg'), 5, '2002'),
      it('movie','interestelar','Interestelar', tmdb('/6ricSDD83BClJsFdGB6x7cM0MFQ.jpg'), 5, '2014'),
      it('movie','duna-2','Duna: Parte Dois', tmdb('/hH5lhwd8RzvVGbpRixPvIOltZLt.jpg'), 4, '2024'),
      it('movie','central-do-brasil','Central do Brasil', tmdb('/qfyWFhUhqeNRU9HmCaBDAxVKRZ9.jpg'), 5, '1998')
    ],
    book: [
      it('book','nome-do-vento','O Nome do Vento', book('9780756404741'), 5, 'Patrick Rothfuss'),
      it('book','duna','Duna', book('9780441172719'), 5, 'Frank Herbert'),
      it('book','sapiens','Sapiens', book('9780062316097'), 4, 'Yuval N. Harari'),
      it('book','1984','1984', book('9780451524935'), 5, 'George Orwell')
    ],
    game: [
      it('game','elden-ring','Elden Ring', game(1245620), 5, 'FromSoftware'),
      it('game','hades','Hades', game(1145360), 5, 'Supergiant'),
      it('game','hollow-knight','Hollow Knight', game(367520), 5, 'Team Cherry'),
      it('game','rdr2','Red Dead Redemption 2', game(1174180), 5, 'Rockstar')
    ],
    $cats: []
  };
  set('collection', collection);

  // lugares REAIS de São Paulo (coordenadas conferidas)
  const placesArr = [
    { id:'p1', cat:'cafe',   name:'Coffee Lab',          lat:-23.5546, lng:-46.6899, rating:5, note:'Referência de café de especialidade na Vila Madalena. Balcão, método e tempo parando.', photos:[{ id:'ph1', url: pic('coffeelab',600), ts: now-1e8 }] },
    { id:'p2', cat:'outro',  name:'MASP',                lat:-23.5614, lng:-46.6558, rating:5, note:'O vão livre e o acervo nos cavaletes de vidro da Lina Bo Bardi. Ícone da Paulista.', photos:[{ id:'ph2', url: pic('masp',600), ts: now-2e8 }] },
    { id:'p3', cat:'role',   name:'Beco do Batman',      lat:-23.5548, lng:-46.6912, rating:4, note:'Grafite de ponta a ponta na Vila Madalena. Melhor no fim de tarde, sem multidão.', photos:[{ id:'ph3', url: pic('beco',600), ts: now-3e8 }] },
    { id:'p4', cat:'parque', name:'Parque Ibirapuera',   lat:-23.5874, lng:-46.6576, rating:5, note:'Tarde de domingo, o gramado inteiro nosso. Volto sempre que a cabeça pesa.', photos:[{ id:'ph4', url: pic('ibira',600), ts: now-4e8 }] },
    { id:'p5', cat:'comida', name:'Mercado Municipal',   lat:-23.5416, lng:-46.6294, rating:4, note:'O sanduíche de mortadela e o pastel de bacalhau. Vai com fome.', photos:[{ id:'ph5', url: pic('mercadao',600), ts: now-5e8 }] },
    { id:'p6', cat:'vista',  name:'Mirante 9 de Julho',  lat:-23.5709, lng:-46.6403, rating:4, note:'Café com a cidade toda embaixo e pôr do sol de graça.', photos:[{ id:'ph6', url: pic('mirante',600), ts: now-6e8 }] }
  ];
  set('places', placesArr);

  // SNAPSHOT PÚBLICO (perfil do visitante, aberto pela bio) — mesmo formato do setPublic().
  // Link: ?local=1&demo=1&u=local  → modo visitante com o conteúdo real.
  const trim = a => (a||[]).slice(0,10).map(i => ({ poster:i.poster, title:i.title, addedAt:i.addedAt, type:i.type, rating:i.rating }));
  try { localStorage.setItem('haven.public.local', JSON.stringify({
    name: 'Brian', photo: profileObj.photo, cover: profileObj.cover, font: profileObj.font,
    widgets: profileObj.widgets, bio: profileObj.bio, instagram: profileObj.instagram, playlist: '',
    accent: profileObj.accent, moment: profileObj.moment, socials: profileObj.socials, theme: profileObj.theme || '',
    quote: profileObj.quote, counter: profileObj.counter, status: profileObj.status, pin: profileObj.pin,
    gallery: profileObj.gallery, links: profileObj.links, video: profileObj.video, week: profileObj.week,
    layout: profileObj.layout, blocks: profileObj.blocks,
    col: { movie: trim(collection.movie), book: trim(collection.book), game: trim(collection.game) },
    cats: [], catItems: {},
    places: placesArr.map(p => ({ cat: p.cat })),
    memories: placesArr.flatMap(p => (p.photos||[]).map(ph => ({ id: ph.id, url: ph.url, ts: ph.ts }))),
    at: now
  })); } catch (_) {}

  // rôle agora (camada ao vivo) — nó COMPARTILHADO (chave haven.shared.role)
  try { localStorage.setItem('haven.shared.role', JSON.stringify([
    { _k:'r1', placeId:'p1', placeName:'Coffee Lab',        cat:'cafe',   lat:-23.5546, lng:-46.6899, vibe:'tranquilo',   photoUrl:pic('coffeelive',600),  ts: now-1000*60*9,  by:'u2', byName:'Marina', confirms:3 },
    { _k:'r2', placeId:'p5', placeName:'Mercado Municipal', cat:'comida', lat:-23.5416, lng:-46.6294, vibe:'lotado',      photoUrl:pic('mercalive',600),   ts: now-1000*60*26, by:'u3', byName:'Léo',    confirms:5 },
    { _k:'r3', placeId:'p4', placeName:'Parque Ibirapuera', cat:'parque', lat:-23.5874, lng:-46.6576, vibe:'movimentado', photoUrl:pic('ibiralive',600),   ts: now-1000*60*48, by:'u4', byName:'Duda',   confirms:2 }
  ])); } catch (_) {}

  set('wallpaper', { sel: { mode: 'scene', name: 'lavender' } });
  try { localStorage.setItem('haven.onboarded', '1'); } catch (_) {}
})();
