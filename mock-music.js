/* Amostra de Música (capas REAIS via iTunes) pra desenhar o player rico
   (cover-flow + sobre o artista) sem backend. Mesmo shape das Cloud Functions.
   Carregado com ?mock=1 OU ?demo=1. As prévias são genéricas (SoundHelix) —
   é uma amostra; o áudio real exige o proxy do Spotify. */
(function () {
  const cov = {
    blinding: 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/61/e7/3f/61e73f94-018d-5f50-50ec-8521952bc72e/20UM1IM11629.rgb.jpg/600x600bb.jpg',
    saveyour: 'https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/83/3a/f7/833af71b-2e0c-3303-24f5-8f5c546c073b/20UMGIM21167.rgb.jpg/600x600bb.jpg',
    levit:    'https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/6c/11/d6/6c11d681-aa3a-d59e-4c2e-f77e181026ab/190295092665.jpg/600x600bb.jpg',
    dsn:      'https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/41/ee/66/41ee66fa-f8dd-7e82-155a-3a1b360dc562/190295322175.jpg/600x600bb.jpg',
    less:     'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/a0/9a/2c/a09a2ca3-a5a6-814b-0af7-640dc0aef0aa/091012682261.jpg/600x600bb.jpg',
    letit:    'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/a8/2e/b4/a82eb490-f30a-a321-461a-0383c88fec95/15UMGIM23316.rgb.jpg/600x600bb.jpg',
    pink:     'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/1c/9f/c9/1c9fc902-1385-a132-2251-342547bfd9a5/24UMGIM68019.rgb.jpg/600x600bb.jpg',
    nights:   'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/bb/45/68/bb4568f3-68cd-619d-fbcb-4e179916545d/BlondCover-Final.jpg/600x600bb.jpg'
  };
  const A = {
    weeknd: { id:'weeknd', name:'The Weeknd', image:cov.blinding,
      genres:['pop','r&b','canadian pop'], followers:98432110, popularity:96,
      bio:'Abel Makkonen Tesfaye, o The Weeknd, é um cantor e compositor canadense. Emergiu em 2010 com mixtapes de R&B alternativo carregadas de atmosfera noturna e se tornou um dos artistas mais influentes da sua geração, unindo pop sintético, soul e uma persona cinematográfica.' },
    dualipa:{ id:'dualipa', name:'Dua Lipa', image:cov.levit,
      genres:['pop','dance pop','uk pop'], followers:74210553, popularity:92,
      bio:'Dua Lipa é uma cantora e compositora britânica-albanesa. Seu disco Future Nostalgia redefiniu o pop de pista dos anos 2020 com uma releitura brilhante do disco e do nu-funk.' },
    tame:   { id:'tame', name:'Tame Impala', image:cov.less,
      genres:['psychedelic pop','neo-psychedelia'], followers:9123400, popularity:85,
      bio:'Projeto do multi-instrumentista australiano Kevin Parker, o Tame Impala funde rock psicodélico, synth-pop e produção meticulosa. Currents (2015) marcou a virada para pistas de dança introspectivas.' },
    frank:  { id:'frank', name:'Frank Ocean', image:cov.nights,
      genres:['r&b','alternative r&b'], followers:16540221, popularity:88,
      bio:'Frank Ocean é um cantor, compositor e produtor americano. Channel Orange e Blonde são marcos do R&B contemporâneo, com narrativas intimistas e uma produção despojada e ousada.' }
  };
  const trk = (name, a, cover, preview) => ({
    name, artist: A[a].name, artistId: a, cover,
    preview: preview ? 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-' + preview + '.mp3' : null,
    dur: (150 + (name.length * 7) % 90) * 1000,
    url: 'https://open.spotify.com/'
  });
  const TRACKS = [
    trk('Blinding Lights', 'weeknd', cov.blinding, 1),
    trk('Levitating', 'dualipa', cov.levit, 2),
    trk('The Less I Know The Better', 'tame', cov.less, 3),
    trk('Nights', 'frank', cov.nights, 4),
    trk('Save Your Tears', 'weeknd', cov.saveyour, 5),
    trk('Don’t Start Now', 'dualipa', cov.dsn, 6),
    trk('Let It Happen', 'tame', cov.letit, 7),
    trk('Pink + White', 'frank', cov.pink, 8)
  ];
  const PL = {
    '37i9dQZF1DWWQRwui0ExPn': { name:'No repeat', owner:'Haven', image:cov.blinding, url:'#', tracks: TRACKS },
    '37i9dQZF1DX4sWSpwq3LiO': { name:'Só as boas', owner:'Haven', image:cov.nights, url:'#', tracks: TRACKS.slice(2).concat(TRACKS.slice(0, 2)) }
  };
  window.__HAVEN_MOCK = {
    playlist: async (id) => PL[id] || PL['37i9dQZF1DWWQRwui0ExPn'],
    search: async () => Object.entries(PL).map(([id, p]) => ({ id, name:p.name, owner:p.owner, image:p.image, tracks:p.tracks.length })),
    artist: async (id) => {
      const a = A[id] || A.weeknd;
      const top = TRACKS.filter(t => t.artistId === a.id).slice(0, 5);
      return { ...a, top: top.length ? top : TRACKS.slice(0, 4) };
    }
  };
})();
