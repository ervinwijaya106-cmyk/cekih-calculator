/* ============================================================
   SCORE CEKIH — APP.JS  v2.0 (Complete, No Bugs)
   Sadewa Corp
   ============================================================ */
'use strict';

// ────────────────────────────────────────────────────────────
// CONSTANTS & ASSET MAPS
// ────────────────────────────────────────────────────────────
const SETUP_ANIMALS      = ['Dragon 🐉', 'Tiger 🐯', 'Eagle 🦅', 'Qilin 🦄'];
const SETUP_BORDER_VID   = ['video/border_1.webm','video/border_2.webm','video/border_3.webm','video/border_4.webm'];
const SETUP_WATERMARKS   = ['images/card_1.png','images/card_2.png','images/card_3.png','images/card_4.png'];
const SETUP_REWARD_VID   = ['video/dragon.mp4','video/tiger.mp4','video/eagle.mp4','video/qilin.mp4'];
const SUIT_SYMBOLS       = ['♠','♥','♦','♣'];
const CHART_COLORS       = ['#c9a84c','#4fc3f7','#81c784','#ef9a9a'];

const AI_COMMENTS = [
  'Wah tipis banget selisihnya!',
  'Kayaknya ada yang mau comeback nih',
  'Hati-hati yang di bawah lagi ngintip!',
  'Situasi makin panas!',
  'Siapa yang bakal menang ya?',
  'Jangan santai dulu, masih panjang!',
  'Fokus fokus!',
  'Wah berbahaya ini!',
  'Permainan semakin seru!',
  'Siapa yang bakal kena bakar berikutnya?'
];

const ACH_DEF = [
  { key:'tukang_ngocok',  label:'Tukang Ngocok Kartu',          desc:'Score < 0',         icon:'🃏',     check: s => s.score < 0 },
  { key:'tukang_bakar',   label:'Tukang Bakar',                  desc:'Burns >= 3',        icon:'🔥',     check: s => (s.burns||0) >= 3 },
  { key:'hari_apes',      label:'Hari Apes Gak Ada Yang Tau',    desc:'Burned >= 5',       icon:'💀',     check: s => (s.burned||0) >= 5 },
  { key:'dewa_kartu',     label:'Dewa Kartu',                    desc:'Highest Score ≥500',icon:'👑',     check: s => (s.highestScore||0) >= 500 },
  { key:'dewa_dewa',      label:'Dewa Dari Segala Dewa',         desc:'Stars > 1',         icon:'⭐⭐',  check: s => (s.stars||0) > 1 },
  { key:'triple_burn',    label:'Triple Burn',                   desc:'Triple Burn > 0',   icon:'🔥🔥🔥', check: s => (s.tripleBurn||0) > 0 },
];

// ────────────────────────────────────────────────────────────
// CENTRALIZED STATE
// ────────────────────────────────────────────────────────────
let GS = {
  screen: 'setup',   // 'setup' | 'game' | 'newround'
  round: 1,
  turn: 1,
  target: 1000,
  players: [],
  // player shape: { id, name, setupIndex, score, rank, prevRank,
  //   stars, burns, burned, tripleBurn, highestScore,
  //   isInRecoveryMode, recoveryStartTurn,
  //   consecutiveMinus, minusStreakPlayed }
  burnCandidates: [],
  history: [],
  chartData: [],
  aiComment: '',
  playerArchive: {},
  bgMusicOn: true,
  lightMode: false,
  activeTab: 'ranking',
  isFirstTurnOfRound: true,
  rewardVideoPlaying: false,
  undoStack: [],
  inputCache: {},   // { playerId: rawString }
};

// ────────────────────────────────────────────────────────────
// AUDIO
// ────────────────────────────────────────────────────────────
let bgMusic    = null;
let bgVol      = 1.0;
let activeWav  = null;

function initBgMusic() {
  bgMusic = new Audio('audio/casino_bg.mp3');
  bgMusic.loop = true;
  bgMusic.volume = bgVol;
  if (GS.bgMusicOn) bgMusic.play().catch(()=>{});
}

function duck()   { if (bgMusic) bgMusic.volume = 0.15; }
function unduck() { if (bgMusic) bgMusic.volume = GS.bgMusicOn ? bgVol : 0; }

function getMaleVoice() {
  return new Promise(resolve => {
    const pick = list => {
      return list.find(v => v.lang==='id-ID' && /male|pria|laki/i.test(v.name))
          || list.find(v => v.lang==='id-ID')
          || list.find(v => v.lang.startsWith('id'))
          || list[0];
    };
    const voices = speechSynthesis.getVoices();
    if (voices.length) return resolve(pick(voices));
    speechSynthesis.addEventListener('voiceschanged', function h() {
      speechSynthesis.removeEventListener('voiceschanged', h);
      resolve(pick(speechSynthesis.getVoices()));
    });
  });
}

async function speak(text) {
  return new Promise(async resolve => {
    duck();
    speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(text);
    utt.lang    = 'id-ID';
    utt.rate    = 1;
    utt.pitch   = 0.8;
    utt.volume  = 1;
    try { utt.voice = await getMaleVoice(); } catch(e){}
    utt.onend   = () => { unduck(); resolve(); };
    utt.onerror = () => { unduck(); resolve(); };
    speechSynthesis.speak(utt);
  });
}

function playWav(src) {
  return new Promise(resolve => {
    duck();
    const a = new Audio(src);
    activeWav = a;
    a.onended = () => { activeWav=null; unduck(); resolve(); };
    a.onerror = () => { activeWav=null; unduck(); resolve(); };
    a.play().catch(() => { activeWav=null; unduck(); resolve(); });
  });
}

function playKlik() {
  const a = new Audio('audio/klik.wav');
  a.volume = 0.5;
  a.play().catch(() => {
    try {
      const ctx = new (window.AudioContext||window.webkitAudioContext)();
      const osc = ctx.createOscillator(), g = ctx.createGain();
      osc.connect(g); g.connect(ctx.destination);
      osc.frequency.value = 800;
      g.gain.setValueAtTime(0.15, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime+0.08);
      osc.start(); osc.stop(ctx.currentTime+0.08);
    } catch(e){}
  });
}

function stopAllAudio() {
  speechSynthesis.cancel();
  if (activeWav) { try { activeWav.pause(); activeWav.currentTime=0; } catch(e){} activeWav=null; }
  unduck();
}

// ────────────────────────────────────────────────────────────
// NUMBER → BAHASA INDONESIA
// ────────────────────────────────────────────────────────────
function numID(n) {
  n = Math.round(Number(n)||0);
  if (n < 0) return 'minus ' + numID(-n);
  if (n === 0) return 'nol';
  const o = ['','satu','dua','tiga','empat','lima','enam','tujuh','delapan','sembilan',
    'sepuluh','sebelas','dua belas','tiga belas','empat belas','lima belas',
    'enam belas','tujuh belas','delapan belas','sembilan belas'];
  if (n < 20) return o[n];
  const t = ['','','dua puluh','tiga puluh','empat puluh','lima puluh','enam puluh','tujuh puluh','delapan puluh','sembilan puluh'];
  if (n < 100)  return t[Math.floor(n/10)] + (n%10 ? ' '+o[n%10] : '');
  if (n < 200)  return 'seratus'+(n%100?' '+numID(n%100):'');
  if (n < 1000) return o[Math.floor(n/100)]+' ratus'+(n%100?' '+numID(n%100):'');
  if (n < 2000) return 'seribu'+(n%1000?' '+numID(n%1000):'');
  if (n < 1e6)  return numID(Math.floor(n/1000))+' ribu'+(n%1000?' '+numID(n%1000):'');
  return String(n);
}

// ────────────────────────────────────────────────────────────
// PURE CALCULATION FUNCTIONS
// ────────────────────────────────────────────────────────────
function calcRank(players) {
  const sorted = [...players].sort((a,b) => b.score - a.score);
  return players.map(p => ({
    ...p,
    prevRank: p.rank,
    rank: sorted.findIndex(s => s.id===p.id)+1
  }));
}

function detectBurns(before, after, isFirstTurn) {
  if (isFirstTurn) return [];
  const cands = [];
  for (const pA of after) {
    const pB = before.find(x=>x.id===pA.id); if (!pB) continue;
    if (pA.rank >= pB.rank) continue; // attacker did not rise
    for (const vA of after) {
      if (vA.id === pA.id) continue;
      const vB = before.find(x=>x.id===vA.id); if (!vB) continue;
      if (vB.rank >= pB.rank) continue; // victim was NOT above attacker before
      if (vA.rank <= pA.rank) continue; // victim is NOT below attacker now
      if ((vA.score||0) <= 0) continue; // victim score must be > 0
      if (vA.isInRecoveryMode) continue; // victim in recovery → skip
      // Both just exited recovery this turn → cannot burn each other
      const atkExited = pB.isInRecoveryMode && !pA.isInRecoveryMode;
      const vicExited = vB.isInRecoveryMode && !vA.isInRecoveryMode;
      if (atkExited && vicExited) continue;
      // Prevent duplicates
      if (cands.find(c=>c.attackerId===pA.id&&c.victimId===vA.id)) continue;
      cands.push({ attackerId:pA.id, victimId:vA.id, attackerName:pA.name, victimName:vA.name });
    }
  }
  return cands;
}

function updateRecovery(players, currentTurn) {
  return players.map(p => {
    if (p.isInRecoveryMode && currentTurn > (p.recoveryStartTurn||0)+1) {
      return {...p, isInRecoveryMode:false, recoveryStartTurn:null};
    }
    return {...p};
  });
}

function dangerLevel(score, target) {
  if (score < 0) return { label:'🔴 Critical', cls:'badge-critical' };
  const r = score/target;
  if (r >= 0.8) return { label:'🔴 Critical', cls:'badge-critical' };
  if (r >= 0.6) return { label:'🟠 Danger',   cls:'badge-danger'   };
  if (r >= 0.4) return { label:'🟡 Caution',  cls:'badge-caution'  };
  return              { label:'🟢 Safe',      cls:'badge-safe'     };
}

// ────────────────────────────────────────────────────────────
// ARCHIVE & ACHIEVEMENTS
// ────────────────────────────────────────────────────────────
function ensureArc(name) {
  if (!GS.playerArchive[name]) GS.playerArchive[name] = { stars:0,burns:0,burned:0,tripleBurn:0,highestScore:0,achievements:[] };
}

function syncArc(p) {
  ensureArc(p.name);
  const a = GS.playerArchive[p.name];
  a.stars       = Math.max(a.stars||0,       p.stars||0);
  a.burns       = Math.max(a.burns||0,       p.burns||0);
  a.burned      = Math.max(a.burned||0,      p.burned||0);
  a.tripleBurn  = Math.max(a.tripleBurn||0,  p.tripleBurn||0);
  a.highestScore= Math.max(a.highestScore||0, p.highestScore||0, p.score||0);
  if (!a.achievements) a.achievements = [];
  const stats = { score:p.score||0, burns:a.burns, burned:a.burned, tripleBurn:a.tripleBurn, highestScore:a.highestScore, stars:a.stars };
  ACH_DEF.forEach(ac => { if (!a.achievements.includes(ac.key) && ac.check(stats)) a.achievements.push(ac.key); });
}

// ────────────────────────────────────────────────────────────
// LOCALSTORAGE
// ────────────────────────────────────────────────────────────
function save() { try { localStorage.setItem('sc_gs', JSON.stringify(GS)); } catch(e){} }

function load() {
  try {
    const raw = localStorage.getItem('sc_gs');
    if (!raw) return;
    const s = JSON.parse(raw);
    GS = {...GS, ...s};
    GS.undoStack = s.undoStack || [];
    GS.rewardVideoPlaying = false;
  } catch(e){}
}

// ────────────────────────────────────────────────────────────
// UNDO SYSTEM
// ────────────────────────────────────────────────────────────
function snap() {
  const s = JSON.parse(JSON.stringify(GS));
  s.rewardVideoPlaying = false;
  GS.undoStack.push(s);
  if (GS.undoStack.length > 40) GS.undoStack.shift();
}

function doUndo() {
  playKlik();
  stopAllAudio();
  // Stop reward video if playing
  if (GS.rewardVideoPlaying) {
    const rv = document.getElementById('reward-video');
    if (rv) { rv.pause(); rv.currentTime=0; }
    const ro = document.getElementById('reward-overlay');
    if (ro) { ro.classList.remove('active'); }
    unduck();
    GS.rewardVideoPlaying = false;
  }
  if (!GS.undoStack.length) { toast('Tidak ada yang bisa di-undo'); return; }
  const prev = GS.undoStack.pop();
  const stack = GS.undoStack;
  GS = prev;
  GS.undoStack = stack;
  GS.rewardVideoPlaying = false;
  save();
  render();
  toast('↩ Undo berhasil');
}

// ────────────────────────────────────────────────────────────
// TOAST
// ────────────────────────────────────────────────────────────
function toast(msg, ms=2400) {
  let el = document.getElementById('sc-toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'sc-toast';
    Object.assign(el.style, {
      position:'fixed', bottom:'72px', left:'50%', transform:'translateX(-50%)',
      background:'rgba(8,22,8,0.97)', border:'1px solid rgba(201,168,76,0.45)',
      color:'#f0d080', padding:'8px 18px', borderRadius:'8px', fontSize:'0.78rem',
      zIndex:'9600', pointerEvents:'none', textAlign:'center', maxWidth:'300px',
      boxShadow:'0 4px 16px rgba(0,0,0,0.6)', transition:'opacity 0.3s'
    });
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.style.opacity = '1';
  clearTimeout(el._t);
  el._t = setTimeout(() => { el.style.opacity='0'; }, ms);
}

// ────────────────────────────────────────────────────────────
// RENDER — MAIN
// ────────────────────────────────────────────────────────────
function render() {
  const setup    = document.getElementById('setup-screen');
  const game     = document.getElementById('game-screen');
  const newRound = document.getElementById('new-round-screen');
  const rtBar    = document.getElementById('round-turn-bar');

  if (!setup||!game||!newRound) return;

  setup.classList.toggle('hidden',    GS.screen!=='setup');
  game.classList.toggle('hidden',     GS.screen!=='game');
  newRound.classList.toggle('hidden', GS.screen!=='newround');
  if (rtBar) rtBar.classList.toggle('hidden', GS.screen!=='game');

  document.body.classList.toggle('light-mode', !!GS.lightMode);

  const bm = document.getElementById('btn-music');
  if (bm) { bm.textContent = GS.bgMusicOn?'🎵 ON':'🎵 OFF'; bm.classList.toggle('off',!GS.bgMusicOn); }

  if (GS.screen==='game')     { renderGame();     }
  if (GS.screen==='newround') { renderNewRound(); }
  renderTabs();
}

// ────────────────────────────────────────────────────────────
// RENDER GAME SCREEN
// ────────────────────────────────────────────────────────────
function renderGame() {
  const rtBar = document.getElementById('round-turn-bar');
  if (rtBar) rtBar.innerHTML =
    `<span class="rt-badge">ROUND ${GS.round}</span>
     <span class="rt-badge">TURN ${GS.turn}</span>
     <span class="rt-badge" style="color:#f0d080;">🎯 ${GS.target}</span>`;

  const ai = document.getElementById('ai-comment-box');
  if (ai && GS.aiComment) ai.textContent = '🃏 ' + GS.aiComment;

  const btnBurn = document.getElementById('btn-burn');
  if (btnBurn) btnBurn.classList.toggle('hidden', !GS.burnCandidates.length);

  renderCards();
  renderChart();
}

// ────────────────────────────────────────────────────────────
// PLAYER CARDS
// ────────────────────────────────────────────────────────────
function renderCards() {
  const grid = document.getElementById('cards-grid');
  if (!grid) return;

  const players = [...GS.players].sort((a,b)=>a.setupIndex-b.setupIndex);

  // Remove stale cards
  grid.querySelectorAll('.player-card').forEach(c => {
    if (!GS.players.find(p=>p.id===c.id.replace('pc-',''))) c.remove();
  });

  players.forEach(p => {
    let card = document.getElementById('pc-'+p.id);
    if (!card) { card = buildCard(p); grid.appendChild(card); }
    updateCard(card, p);
  });
}

function buildCard(p) {
  const card = document.createElement('div');
  card.className = 'player-card';
  card.id = 'pc-'+p.id;

  // Animated border video (fixed by setupIndex)
  const vid = document.createElement('video');
  vid.className = 'card-border-video';
  vid.src = SETUP_BORDER_VID[p.setupIndex];
  vid.autoplay = true; vid.loop = true; vid.muted = true;
  vid.setAttribute('playsinline','');
  vid.setAttribute('webkit-playsinline','');
  card.appendChild(vid);
  vid.play().catch(()=>{});

  // Watermark
  const wm = document.createElement('img');
  wm.className = 'card-watermark';
  wm.src = SETUP_WATERMARKS[p.setupIndex];
  wm.alt = '';
  card.appendChild(wm);

  // Content
  const content = document.createElement('div');
  content.className = 'card-content';
  content.id = 'cc-'+p.id;
  card.appendChild(content);

  // Burn FX layer
  const fx = document.createElement('div');
  fx.className = 'burn-effect-container';
  fx.id = 'bfx-'+p.id;
  card.appendChild(fx);

  return card;
}

function updateCard(card, p) {
  // Ranking border
  card.dataset.rank = p.rank;

  // Rebuild content if anything changed
  const sig = `${p.score}|${p.rank}|${p.isInRecoveryMode}|${p.stars}|${GS.target}`;
  if (card.dataset.sig === sig) return;
  card.dataset.sig = sig;

  const content = document.getElementById('cc-'+p.id);
  if (!content) return;
  content.innerHTML = cardHTML(p);

  // Bounce rank badge if rank changed
  if (card.dataset.lastRank && card.dataset.lastRank !== String(p.rank)) {
    const badge = document.getElementById('rb-'+p.id);
    if (badge) {
      badge.classList.remove('bounce');
      void badge.offsetWidth;
      badge.classList.add('bounce');
      setTimeout(()=>badge.classList.remove('bounce'), 600);
    }
  }
  card.dataset.lastRank = String(p.rank);

  // Keep video playing
  const vid = card.querySelector('.card-border-video');
  if (vid && vid.paused) vid.play().catch(()=>{});
}

function cardHTML(p) {
  const rankClass = 'rank-'+p.rank;
  const isNeg = (p.score||0) < 0;
  const pct = Math.min(100, Math.max(0, (p.score||0)/GS.target*100));
  const danger = dangerLevel(p.score||0, GS.target);
  const animal = SETUP_ANIMALS[p.setupIndex];
  const stars  = '⭐'.repeat(p.stars||0);
  const inputVal = GS.inputCache&&GS.inputCache[p.id]!==undefined ? GS.inputCache[p.id] : '';

  const rankColors = {1:'#c9a84c',2:'#a8a8b8',3:'#cd7f32',4:'#e53e3e'};
  const progColor = rankColors[p.rank]||'#c9a84c';

  return `
    <div class="card-top">
      <span class="rank-badge ${rankClass}" id="rb-${p.id}">#${p.rank}</span>
      <span style="font-size:0.55rem;color:rgba(255,255,255,0.45);flex:1;text-align:center;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;">${animal}</span>
      <span class="card-stars">${stars}</span>
    </div>
    <div class="card-name" title="${escHtml(p.name)}">${escHtml(p.name)}</div>
    <div class="card-score${isNeg?' negative':''}" id="sd-${p.id}">${p.score||0}</div>
    <div class="card-badges">
      ${p.isInRecoveryMode ? '<span class="badge badge-recovery">🔄 Recovery</span>' : ''}
      ${isNeg ? '<span class="badge badge-thumb">👎</span>' : ''}
      <span class="badge ${danger.cls}">${danger.label}</span>
    </div>
    <div class="card-progress-wrap">
      <div class="card-progress-bar" style="width:${pct}%;background:linear-gradient(90deg,#1b4332,${progColor});"></div>
    </div>
    <div class="card-input-row">
      <input type="number" class="card-score-input" id="inp-${p.id}"
        placeholder="Score" value="${inputVal}" min="-99999" max="1000"
        oninput="cacheInput('${p.id}',this.value)"
        onkeydown="if(event.key==='Enter')saveTurn()"
        aria-label="Score untuk ${escHtml(p.name)}">
      <button class="btn-edit-name" onclick="openEditName('${p.id}')" title="Edit Nama">✏️</button>
    </div>
  `;
}

function escHtml(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

function cacheInput(id, val) {
  if (!GS.inputCache) GS.inputCache = {};
  GS.inputCache[id] = val;
}

// ────────────────────────────────────────────────────────────
// SAVE TURN
// ────────────────────────────────────────────────────────────
async function saveTurn() {
  playKlik();
  if (!GS.players.length) return;

  // Collect inputs
  const add = {};
  GS.players.forEach(p => {
    const el = document.getElementById('inp-'+p.id);
    const raw = el ? el.value.trim() : (GS.inputCache&&GS.inputCache[p.id]||'');
    let v = raw==='' ? 0 : parseInt(raw,10);
    if (isNaN(v)) v = 0;
    v = Math.max(-99999, Math.min(1000, v));
    add[p.id] = v;
  });

  snap(); // undo snapshot

  const beforePlayers = JSON.parse(JSON.stringify(GS.players));

  // 1. Update recovery status for this turn
  let players = updateRecovery(JSON.parse(JSON.stringify(GS.players)), GS.turn);

  // 2. Apply scores
  players = players.map(p => {
    const newScore = (p.score||0) + (add[p.id]||0);
    const newHigh  = Math.max(p.highestScore||0, newScore);
    let consec = p.consecutiveMinus||0;
    let msPlayed = p.minusStreakPlayed||false;
    if (newScore < 0) {
      consec++;
      if (consec >= 3 && !msPlayed) msPlayed = true;
      else if (consec < 3) msPlayed = false;
    } else { consec = 0; msPlayed = false; }
    return {...p, score:newScore, highestScore:newHigh, consecutiveMinus:consec, minusStreakPlayed:msPlayed};
  });

  // 3. Ranking
  players = calcRank(players);

  // 4. Detect burns (compare with ranking from beforePlayers which had their ranks set)
  const burnable = detectBurns(
    beforePlayers.map(p=>({...p,rank:p.rank})),
    players,
    GS.isFirstTurnOfRound
  );

  // 5. Sync archive & achievements
  players.forEach(p => syncArc(p));

  // 6. Chart entry
  const chartEntry = { round:GS.round, turn:GS.turn, scores:{} };
  players.forEach(p => { chartEntry.scores[p.id] = p.score; });

  // 7. History entry
  const histEntry = {
    round:GS.round, turn:GS.turn, additions:{...add},
    scoresAfter:{}, ranksAfter:{}, burnsExecuted:[]
  };
  players.forEach(p => { histEntry.scoresAfter[p.id]=p.score; histEntry.ranksAfter[p.id]=p.rank; });

  // 8. AI comment
  const ai = buildAI(players, burnable);

  // Apply to state
  GS.players         = players;
  GS.burnCandidates  = burnable;
  GS.chartData.push(chartEntry);
  GS.history.unshift(histEntry);
  GS.aiComment       = ai;
  GS.isFirstTurnOfRound = false;
  GS.inputCache      = {};

  // Clear input fields
  GS.players.forEach(p => { const el=document.getElementById('inp-'+p.id); if(el) el.value=''; });

  // Card flip animation
  document.querySelectorAll('.player-card').forEach(c => {
    c.classList.add('flip-anim');
    setTimeout(()=>c.classList.remove('flip-anim'), 600);
  });

  // Score counter animation
  animateScores(beforePlayers, players);

  save();
  render();

  // Consecutive-minus WAV list
  const minusPlayers = players.filter(p => (p.consecutiveMinus||0)>=3 && p.minusStreakPlayed);

  // Check win (score >= target) — only if no burn candidates
  const winner = players.find(p => (p.score||0) >= GS.target);

  if (!burnable.length) {
    // No burns → run audio immediately
    await runNoburn(players, winner, minusPlayers);
  }
  // If burns exist, audio waits for confirm burn button
}

function animateScores(before, after) {
  after.forEach(pA => {
    const pB = before.find(x=>x.id===pA.id); if (!pB) return;
    const el = document.getElementById('sd-'+pA.id); if (!el) return;
    const s = pB.score||0, e = pA.score||0; if (s===e) return;
    const dur=420, t0=performance.now();
    (function step(now) {
      const frac = Math.min(1,(now-t0)/dur);
      const cur  = Math.round(s+(e-s)*frac);
      el.textContent = cur;
      el.className = 'card-score'+(cur<0?' negative':'');
      if (frac<1) requestAnimationFrame(step);
    })(t0);
  });
}

// ────────────────────────────────────────────────────────────
// AUDIO SEQUENCES
// ────────────────────────────────────────────────────────────
async function runNoburn(players, winner, minusPlayers) {
  // Consecutive minus WAV
  if (minusPlayers.length) await playWav('audio/kok_minus_terus_sih_gamau_menang.wav');
  // Shuffle card
  const sh = findShuffler(players, []);
  if (sh) await speak(`${sh.name} tolong kocok kartunya ya`);
  // Total score
  for (const p of [...players].sort((a,b)=>a.rank-b.rank))
    await speak(`${p.name} mendapatkan ${numID(p.score)} poin`);
  // AI comment
  await speak(AI_COMMENTS[Math.floor(Math.random()*AI_COMMENTS.length)]);
  // Win
  if (winner) await runWinSequence(winner, players);
  else GS.turn++;   // advance turn only if no win
  save(); render();
}

async function runBurnSeq(players, burned, winner, minusPlayers) {
  // Burn TTS (called after confirmBurn has already updated state)
  for (const b of burned) await speak(`${b.attackerName} membakar ${b.victimName}`);
  // mulai_dari_0 WAV for repeatedly burned
  const multi = players.filter(p => (p.burned||0)>=2 && burned.find(b=>b.victimId===p.id));
  if (multi.length) await playWav('audio/mulai_dari_0_ya_bapak.wav');
  // Consecutive minus
  if (minusPlayers.length) await playWav('audio/kok_minus_terus_sih_gamau_menang.wav');
  // Shuffle
  const sh = findShuffler(players, burned.map(b=>b.victimId));
  if (sh) await speak(`${sh.name} tolong kocok kartunya ya`);
  // Total score
  for (const p of [...players].sort((a,b)=>a.rank-b.rank))
    await speak(`${p.name} mendapatkan ${numID(p.score)} poin`);
  // AI comment
  await speak(AI_COMMENTS[Math.floor(Math.random()*AI_COMMENTS.length)]);
  // Win
  if (winner) await runWinSequence(winner, players);
}

function findShuffler(players, burnedIds) {
  const negs = players.filter(p=>(p.score||0)<0);
  if (negs.length) return negs.reduce((a,b)=>a.score<b.score?a:b);
  return [...players].sort((a,b)=>(a.score||0)-(b.score||0))[0]||players[0];
}

// ────────────────────────────────────────────────────────────
// WIN SEQUENCE
// ────────────────────────────────────────────────────────────
async function runWinSequence(winner, players) {
  // Award star
  GS.players = GS.players.map(p => p.id===winner.id ? {...p, stars:(p.stars||0)+1} : p);
  const wp = GS.players.find(p=>p.id===winner.id);
  if (wp) { syncArc(wp); }
  GS.burnCandidates = [];
  save(); render();

  showGoldFlash();
  await playRewardVideo(SETUP_REWARD_VID[winner.setupIndex]);
  await speak(`Selamat ya ${winner.name} mendapatkan bintang satu`);
  await speak('Ronde selesai, selamat berjuang dan fokus');
  endRound();
}

function showGoldFlash() {
  const el = document.getElementById('gold-flash');
  if (!el) return;
  el.style.display='block';
  el.style.animation='none';
  void el.offsetWidth;
  el.style.animation='goldFlash 0.8s ease-out forwards';
  setTimeout(()=>{ el.style.display='none'; }, 900);
}

function playRewardVideo(src) {
  return new Promise(resolve => {
    const ov = document.getElementById('reward-overlay');
    const rv = document.getElementById('reward-video');
    if (!ov||!rv) return resolve();
    duck();
    GS.rewardVideoPlaying = true;
    rv.src = src;
    ov.classList.add('active');
    const done = () => {
      ov.classList.remove('active');
      rv.pause(); rv.src='';
      unduck();
      GS.rewardVideoPlaying = false;
      resolve();
    };
    const timer = setTimeout(done, 7000);
    rv.onended = ()=>{ clearTimeout(timer); done(); };
    rv.onerror = ()=>{ clearTimeout(timer); done(); };
    rv.play().catch(()=>{ clearTimeout(timer); done(); });
  });
}

function endRound() {
  GS.round++;
  GS.turn = 1;
  GS.burnCandidates = [];
  GS.isFirstTurnOfRound = true;
  GS.screen = 'newround';
  save(); render();
}

// ────────────────────────────────────────────────────────────
// BURN MODAL
// ────────────────────────────────────────────────────────────
function openBurnModal() {
  playKlik();
  const modal = document.getElementById('burn-modal');
  const list  = document.getElementById('burn-candidate-list');
  if (!modal||!list) return;
  if (!GS.burnCandidates.length) return;

  list.innerHTML = '';
  GS.burnCandidates.forEach((c,i) => {
    const lbl = document.createElement('label');
    lbl.className = 'burn-candidate-item';
    lbl.innerHTML = `
      <input type="checkbox" id="bc-${i}" checked>
      <div class="burn-candidate-label">
        🔥 <strong>${escHtml(c.attackerName)}</strong>
        <span class="burn-arrow"> → bakar → </span>
        <strong>${escHtml(c.victimName)}</strong>
      </div>`;
    list.appendChild(lbl);
  });
  modal.style.display='flex';
  modal.classList.remove('hidden');
}

function closeBurnModal() {
  const modal = document.getElementById('burn-modal');
  if (modal) { modal.style.display=''; modal.classList.add('hidden'); }
}

async function confirmBurn() {
  playKlik();
  const cands = GS.burnCandidates;
  if (!cands.length) { closeBurnModal(); return; }

  // Which are checked?
  const chosen = cands.filter((_,i) => {
    const cb = document.getElementById('bc-'+i);
    return cb && cb.checked;
  });
  closeBurnModal();

  snap(); // undo snapshot for burn action

  if (!chosen.length) {
    // No burns confirmed — clear candidates, advance turn, run no-burn audio
    GS.burnCandidates = [];
    const winner = GS.players.find(p=>(p.score||0)>=GS.target);
    GS.turn++;
    save(); render();
    await runNoburn(GS.players, winner, []);
    return;
  }

  // Group by attacker
  const byAtk = {};
  chosen.forEach(c => { (byAtk[c.attackerId]||(byAtk[c.attackerId]=[])).push(c); });

  let players = JSON.parse(JSON.stringify(GS.players));
  const executed = [];

  for (const atkId in byAtk) {
    const bs = byAtk[atkId];
    const victimIds = bs.map(b=>b.victimId);

    // Triple burn?
    if (victimIds.length >= 3) {
      const atk = players.find(p=>p.id===atkId);
      if (atk) { atk.tripleBurn=(atk.tripleBurn||0)+1; syncArc(atk); }
    }

    // Update attacker burns count
    const atk = players.find(p=>p.id===atkId);
    if (atk) { atk.burns=(atk.burns||0)+bs.length; syncArc(atk); }

    // Update victims
    victimIds.forEach(vid => {
      const v = players.find(p=>p.id===vid);
      if (!v) return;
      v.burned=(v.burned||0)+1;
      v.score=0;
      v.isInRecoveryMode=true;
      v.recoveryStartTurn=GS.turn;
      syncArc(v);
      const b = bs.find(x=>x.victimId===vid);
      if (b) executed.push(b);
    });
  }

  // Re-rank
  players = calcRank(players);

  // Triple burn screen shake
  for (const atkId in byAtk) {
    if (byAtk[atkId].length >= 3) {
      const app = document.getElementById('app');
      if (app) {
        app.classList.add('screen-shake');
        setTimeout(()=>app.classList.remove('screen-shake'), 700);
      }
      break;
    }
  }

  // Burn animations on victim cards
  chosen.forEach(c => {
    const atk = GS.players.find(p=>p.id===c.attackerId);
    if (atk) triggerBurnFx(atk.setupIndex, c.victimId);
  });

  // Chart entry for burn (shows drop to 0)
  const chartBurn = { round:GS.round, turn:GS.turn, scores:{}, isBurn:true };
  players.forEach(p=>{ chartBurn.scores[p.id]=p.score; });
  GS.chartData.push(chartBurn);

  // Update history with burn info
  if (GS.history.length) GS.history[0].burnsExecuted = executed;

  GS.players = players;
  GS.burnCandidates = [];

  // Consecutive minus
  const minusPlayers = players.filter(p=>(p.consecutiveMinus||0)>=3&&p.minusStreakPlayed);

  // Check win after burns
  const winner = players.find(p=>(p.score||0)>=GS.target);

  // Advance turn
  GS.turn++;
  save(); render();

  await runBurnSeq(players, executed, winner, minusPlayers);
  if (!winner) { save(); render(); }
}

// ────────────────────────────────────────────────────────────
// BURN VISUAL EFFECT
// ────────────────────────────────────────────────────────────
function triggerBurnFx(attackerIdx, victimId) {
  const card = document.getElementById('pc-'+victimId);
  if (!card) return;
  card.classList.add('card-shake');
  setTimeout(()=>card.classList.remove('card-shake'), 600);

  const fx = document.getElementById('bfx-'+victimId);
  if (!fx) return;
  fx.innerHTML = '';

  switch(attackerIdx) {
    case 0: // Dragon → fire breath
      for (let i=0;i<22;i++) {
        const p=document.createElement('div'); p.className='fire-particle';
        const tx=(Math.random()-0.5)*130, ty=(Math.random()-0.5)*110;
        p.style.cssText=`left:${15+Math.random()*70}%;top:${15+Math.random()*70}%;
          --tx:${tx}px;--ty:${ty}px;
          animation-delay:${Math.random()*0.4}s;
          animation-duration:${0.55+Math.random()*0.45}s;
          width:${5+Math.random()*9}px;height:${5+Math.random()*9}px;`;
        fx.appendChild(p);
      } break;
    case 1: // Tiger → slash
      for (let i=0;i<5;i++) {
        const s=document.createElement('div'); s.className='slash-line';
        s.style.cssText=`left:${5+i*18}%;top:${18+i*13}%;width:${35+Math.random()*30}%;
          animation-delay:${i*0.07}s;transform:rotate(${-38+i*7}deg);`;
        fx.appendChild(s);
      } break;
    case 2: // Eagle → dive
      for (let i=0;i<3;i++) {
        const d=document.createElement('div'); d.className='dive-shape';
        d.style.cssText=`left:${25+i*22}%;animation-delay:${i*0.14}s;`;
        fx.appendChild(d);
      } break;
    case 3: // Qilin → lightning
      for (let i=0;i<4;i++) {
        const b=document.createElement('div'); b.className='lightning-bolt';
        b.style.cssText=`left:${18+i*22}%;animation-delay:${i*0.09}s;width:${2+Math.random()*3}px;`;
        fx.appendChild(b);
      } break;
  }
  setTimeout(()=>{ fx.innerHTML=''; }, 1600);
}

// ────────────────────────────────────────────────────────────
// AI COMMENT
// ────────────────────────────────────────────────────────────
function buildAI(players, burns) {
  if (burns.length) return `🔥 Ada ${burns.length} kandidat bakar! Klik 🔥 BURN untuk konfirmasi!`;
  const sorted = [...players].sort((a,b)=>b.score-a.score);
  const diff = (sorted[0].score||0)-(sorted[sorted.length-1].score||0);
  if (diff<50) return 'Wah tipis banget selisihnya! Siapapun bisa menang!';
  const rec = players.filter(p=>p.isInRecoveryMode);
  if (rec.length) return `🔄 ${rec.map(p=>p.name).join(', ')} lagi recovery, hati-hati!`;
  const neg = players.filter(p=>(p.score||0)<0);
  if (neg.length) return `😬 ${neg.map(p=>p.name).join(', ')} lagi minus, bahaya!`;
  return AI_COMMENTS[Math.floor(Math.random()*AI_COMMENTS.length)];
}

// ────────────────────────────────────────────────────────────
// SETUP
// ────────────────────────────────────────────────────────────
function startGame() {
  playKlik();
  const names = [1,2,3,4].map(i => {
    const el = document.getElementById('sn-'+i);
    return el&&el.value.trim() ? el.value.trim() : `Player ${i}`;
  });
  const cEl = document.getElementById('custom-target');
  if (cEl&&cEl.value.trim()) {
    const cv=parseInt(cEl.value.trim(),10);
    if (!isNaN(cv)&&cv>0) GS.target=cv;
  }

  GS.players = names.map((name,i) => {
    ensureArc(name);
    const arc = GS.playerArchive[name]||{};
    return {
      id:'p'+(i+1)+'_'+Date.now(),
      name, setupIndex:i, score:0, rank:i+1, prevRank:i+1,
      stars: arc.stars||0, burns:0, burned:0, tripleBurn:0,
      highestScore: arc.highestScore||0,
      isInRecoveryMode:false, recoveryStartTurn:null,
      consecutiveMinus:0, minusStreakPlayed:false,
    };
  });
  GS.players = calcRank(GS.players);
  GS.screen = 'game';
  GS.round = 1; GS.turn = 1;
  GS.isFirstTurnOfRound = true;
  GS.burnCandidates = [];
  GS.history = []; GS.chartData = [];
  GS.undoStack = [];
  GS.inputCache = {};
  GS.aiComment = 'Permainan dimulai! Semangat semua!';
  GS.activeTab = 'ranking';
  GS.players.forEach(p=>ensureArc(p.name));
  save(); render();
  speak('Permainan dimulai');
}

function setTarget(t) {
  GS.target = t;
  document.querySelectorAll('.target-btn').forEach(b => b.classList.toggle('active', +b.dataset.t===t));
}

// ────────────────────────────────────────────────────────────
// NEW ROUND
// ────────────────────────────────────────────────────────────
function renderNewRound() {
  const sc = document.getElementById('new-round-screen');
  if (!sc) return;
  sc.innerHTML = `
    <img src="images/joker.png" class="setup-logo" alt="Logo">
    <div class="setup-title"><h2>🔄 RONDE ${GS.round}</h2><p>SADEWA CORP</p></div>
    <div class="setup-card" style="width:100%;max-width:400px;">
      <h3>⚙️ Setup Ronde Baru</h3>
      ${GS.players.map(p=>`
        <div class="player-input-row">
          <label>${SUIT_SYMBOLS[p.setupIndex]} Player ${p.setupIndex+1}</label>
          <input type="text" class="input-field" id="nr-${p.id}" value="${escHtml(p.name)}" placeholder="Nama">
        </div>`).join('')}
      <div class="target-row" style="margin-top:12px;">
        <label>🎯 Target:</label>
        ${[500,750,1000,1500].map(t=>`<button class="target-btn${GS.target===t?' active':''}" data-t="${t}" onclick="setNRTarget(${t})">${t}</button>`).join('')}
        <input type="number" class="input-field" id="nr-custom" placeholder="Custom" style="width:70px;">
      </div>
    </div>
    <button class="btn-start" onclick="startNewRound()" style="width:100%;max-width:400px;">🚀 MULAI RONDE BARU</button>
  `;
}

function setNRTarget(t) {
  GS.target = t;
  document.querySelectorAll('#new-round-screen .target-btn').forEach(b=>b.classList.toggle('active',+b.dataset.t===t));
}

function startNewRound() {
  playKlik();
  const cEl = document.getElementById('nr-custom');
  if (cEl&&cEl.value.trim()) {
    const cv=parseInt(cEl.value.trim(),10);
    if (!isNaN(cv)&&cv>0) GS.target=cv;
  }
  GS.players = GS.players.map(p => {
    const el = document.getElementById('nr-'+p.id);
    const nm = el&&el.value.trim()?el.value.trim():p.name;
    ensureArc(nm);
    return {
      ...p, name:nm, score:0, rank:p.setupIndex+1, prevRank:p.setupIndex+1,
      isInRecoveryMode:false, recoveryStartTurn:null,
      consecutiveMinus:0, minusStreakPlayed:false,
      burned:0, burns:0,
    };
  });
  GS.players = calcRank(GS.players);
  GS.screen = 'game';
  GS.turn = 1;
  GS.isFirstTurnOfRound = true;
  GS.burnCandidates = [];
  GS.inputCache = {};
  GS.history = [];
  GS.chartData = [];
  GS.aiComment = 'Ronde baru dimulai! Semangat!';
  save(); render();
  speak('Permainan dimulai');
}

// ────────────────────────────────────────────────────────────
// EDIT NAME
// ────────────────────────────────────────────────────────────
function openEditName(pid) {
  playKlik();
  const p = GS.players.find(x=>x.id===pid); if (!p) return;
  const modal = document.getElementById('edit-name-modal');
  if (!modal) return;
  modal.innerHTML = `
    <div class="modal-box">
      <div class="modal-title">✏️ Edit Nama</div>
      <input type="text" class="input-field" id="en-inp" value="${escHtml(p.name)}" style="width:100%;margin-bottom:14px;">
      <div class="modal-btns">
        <button class="btn-confirm-burn" style="background:linear-gradient(135deg,#1a5c1a,#2d8b2d);border-color:#3dbb3d;color:#ccffcc;" onclick="saveEditName('${pid}')">✅ Simpan</button>
        <button class="btn-cancel" onclick="closeModal('edit-name-modal')">❌ Batal</button>
      </div>
    </div>`;
  modal.style.display='flex';
  modal.classList.remove('hidden');
  setTimeout(()=>{ const i=document.getElementById('en-inp'); if(i){i.focus();i.select();} },80);
}

function saveEditName(pid) {
  const el = document.getElementById('en-inp'); if (!el) return;
  const nm = el.value.trim(); if (!nm) return;
  const p  = GS.players.find(x=>x.id===pid); if (!p) return;
  const old = p.name;
  if (old!==nm) {
    const arc = GS.playerArchive[old]||{};
    if (!GS.playerArchive[nm]) GS.playerArchive[nm] = {...arc};
  }
  GS.players = GS.players.map(x=>x.id===pid?{...x,name:nm}:x);
  closeModal('edit-name-modal');
  save(); render();
  toast(`Nama diubah ke "${nm}"`);
}

function closeModal(id) {
  const m=document.getElementById(id);
  if(m) { m.style.display=''; m.classList.add('hidden'); }
}

// ────────────────────────────────────────────────────────────
// TAB SYSTEM
// ────────────────────────────────────────────────────────────
function switchTab(name) {
  playKlik();
  GS.activeTab = name;
  renderTabs();
}

function renderTabs() {
  const at = GS.activeTab||'ranking';
  document.querySelectorAll('.tab-btn').forEach(b=>b.classList.toggle('active',b.dataset.tab===at));
  document.querySelectorAll('.tab-panel').forEach(p=>p.classList.toggle('active',p.dataset.tabPanel===at));
  switch(at) {
    case 'ranking':     renderRankingTab();     break;
    case 'history':     renderHistoryTab();     break;
    case 'achievement': renderAchTab();         break;
    case 'statistics':  renderStatsTab();       break;
    case 'archive':     renderArchiveTab();     break;
    case 'chart':       renderChart();          break;
  }
}

// ── Ranking
function renderRankingTab() {
  const p = document.querySelector('[data-tab-panel="ranking"]'); if (!p) return;
  if (!GS.players.length) { p.innerHTML='<div class="empty-state">Belum ada data</div>'; return; }
  const medals = ['🥇','🥈','🥉','4️⃣'];
  p.innerHTML = `<div class="section-title">🏆 Ranking Saat Ini</div>`+
    [...GS.players].sort((a,b)=>a.rank-b.rank).map(pl=>`
      <div class="ranking-item">
        <div class="ranking-pos">${medals[pl.rank-1]||pl.rank}</div>
        <div class="ranking-name">${escHtml(pl.name)} ${pl.isInRecoveryMode?'<span style="font-size:0.6rem;color:#8bd0ff">🔄</span>':''}</div>
        <div class="ranking-score">${pl.score}</div>
        <div class="ranking-stars">${'⭐'.repeat(pl.stars||0)}</div>
      </div>`).join('');
}

// ── History
function renderHistoryTab() {
  const p = document.querySelector('[data-tab-panel="history"]'); if (!p) return;
  if (!GS.history.length) { p.innerHTML='<div class="empty-state">Belum ada riwayat</div>'; return; }
  p.innerHTML = '<div class="section-title">📜 Riwayat Turn</div>'+
    GS.history.map(h => {
      const scores = GS.players.map(pl=>{
        const a=h.additions&&h.additions[pl.id]!==undefined?h.additions[pl.id]:0;
        const s=h.scoresAfter&&h.scoresAfter[pl.id]!==undefined?h.scoresAfter[pl.id]:0;
        return `${escHtml(pl.name)}: ${a>=0?'+':''}${a} (${s})`;
      }).join(' | ');
      const burns = (h.burnsExecuted||[]).map(b=>`🔥 ${escHtml(b.attackerName)} → ${escHtml(b.victimName)}`).join(', ');
      return `<div class="history-item">
        <div class="turn-label">R${h.round} T${h.turn}</div>
        <div>${scores}</div>
        ${burns?`<div class="history-burn">${burns}</div>`:''}
      </div>`;
    }).join('');
}

// ── Achievement
function renderAchTab() {
  const p = document.querySelector('[data-tab-panel="achievement"]'); if (!p) return;
  const unlocked = {};
  Object.entries(GS.playerArchive).forEach(([nm,d])=>{
    (d.achievements||[]).forEach(k=>{ (unlocked[k]||(unlocked[k]=[])).push(nm); });
  });
  p.innerHTML = '<div class="section-title">🏅 Pencapaian</div>'+
    ACH_DEF.map(ac => {
      const holders = unlocked[ac.key]||[];
      const ok = holders.length>0;
      return `<div class="achievement-item${ok?' unlocked':''}">
        <div class="ach-icon">${ac.icon}</div>
        <div class="ach-info">
          <h4>${ac.label}</h4>
          <p>${ac.desc}</p>
          ${ok?`<p style="color:#c9a84c;font-size:0.62rem;">Oleh: ${holders.map(escHtml).join(', ')}</p>`:''}
        </div>
        <div class="ach-lock">${ok?'✅':'🔒'}</div>
      </div>`;
    }).join('');
}

// ── Statistics
function renderStatsTab() {
  const p = document.querySelector('[data-tab-panel="statistics"]'); if (!p) return;
  if (!GS.players.length) { p.innerHTML='<div class="empty-state">Belum ada data</div>'; return; }
  p.innerHTML = '<div class="section-title">📊 Statistik Pemain</div>'+
    GS.players.map(pl => {
      const a = GS.playerArchive[pl.name]||{};
      return `<div class="setup-card" style="margin-bottom:8px;padding:12px;">
        <div style="font-size:0.82rem;font-weight:700;color:var(--gold);margin-bottom:8px;">${SUIT_SYMBOLS[pl.setupIndex]} ${escHtml(pl.name)}</div>
        <div class="stat-item"><span class="stat-label">⭐ Stars</span><span class="stat-value">${a.stars||0}</span></div>
        <div class="stat-item"><span class="stat-label">🔥 Burns (total)</span><span class="stat-value">${a.burns||0}</span></div>
        <div class="stat-item"><span class="stat-label">💀 Burned (total)</span><span class="stat-value">${a.burned||0}</span></div>
        <div class="stat-item"><span class="stat-label">🔥🔥🔥 Triple Burn</span><span class="stat-value">${a.tripleBurn||0}</span></div>
        <div class="stat-item"><span class="stat-label">📈 Highest Score</span><span class="stat-value">${a.highestScore||0}</span></div>
        <div class="stat-item"><span class="stat-label">💰 Skor Sekarang</span><span class="stat-value">${pl.score||0}</span></div>
      </div>`;
    }).join('');
}

// ── Archive
function renderArchiveTab() {
  const p = document.querySelector('[data-tab-panel="archive"]'); if (!p) return;
  const names = Object.keys(GS.playerArchive);
  if (!names.length) { p.innerHTML='<div class="empty-state">Belum ada arsip</div>'; return; }
  p.innerHTML = '<div class="section-title">📁 Arsip Semua Pemain</div>'+
    names.map(nm => {
      const d = GS.playerArchive[nm]||{};
      return `<div class="archive-item">
        <div class="archive-name">👤 ${escHtml(nm)}</div>
        <div class="archive-stats">
          <span>⭐${d.stars||0}</span>
          <span>🔥${d.burns||0}</span>
          <span>💀${d.burned||0}</span>
          <span>🔥×3: ${d.tripleBurn||0}</span>
          <span>Max: ${d.highestScore||0}</span>
        </div>
        ${(d.achievements||[]).length?`<div style="margin-top:4px;font-size:0.6rem;color:#c9a84c;">
          ${(d.achievements||[]).map(k=>{ const ac=ACH_DEF.find(a=>a.key===k); return ac?ac.icon+' '+ac.label:k; }).join(' · ')}
        </div>`:''}
      </div>`;
    }).join('');
}

// ── Chart
function renderChart() {
  const canvas = document.getElementById('score-chart'); if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.parentElement ? canvas.parentElement.clientWidth-16 : 300;
  const H = 240;
  canvas.width = W; canvas.height = H;
  ctx.clearRect(0,0,W,H);

  const data = GS.chartData;
  const players = GS.players;
  if (!data.length||!players.length) {
    ctx.fillStyle='rgba(201,168,76,0.3)';
    ctx.font='13px Arial'; ctx.textAlign='center';
    ctx.fillText('Belum ada data chart', W/2, H/2);
    return;
  }

  const pad={t:16,r:14,b:28,l:44};
  const cW=W-pad.l-pad.r, cH=H-pad.t-pad.b;

  let mn=0, mx=GS.target;
  data.forEach(d=>players.forEach(p=>{
    const s=d.scores[p.id]||0;
    if(s<mn)mn=s; if(s>mx)mx=s;
  }));
  const rng=mx-mn||1;
  const xStep=data.length>1?cW/(data.length-1):cW;

  // BG
  ctx.fillStyle='rgba(0,0,0,0.25)'; ctx.fillRect(0,0,W,H);

  // Grid
  for(let i=0;i<=4;i++){
    const y=pad.t+(cH/4)*i;
    ctx.strokeStyle='rgba(255,255,255,0.07)'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(pad.l,y); ctx.lineTo(pad.l+cW,y); ctx.stroke();
    ctx.fillStyle='rgba(255,255,255,0.35)'; ctx.font='9px Arial'; ctx.textAlign='right';
    ctx.fillText(Math.round(mx-(rng/4)*i), pad.l-4, y+3);
  }

  // Target line
  const tY=pad.t+cH-((GS.target-mn)/rng)*cH;
  ctx.strokeStyle='rgba(201,168,76,0.4)'; ctx.lineWidth=1; ctx.setLineDash([4,4]);
  ctx.beginPath(); ctx.moveTo(pad.l,tY); ctx.lineTo(pad.l+cW,tY); ctx.stroke();
  ctx.setLineDash([]);

  // X labels
  ctx.fillStyle='rgba(255,255,255,0.35)'; ctx.font='8px Arial'; ctx.textAlign='center';
  data.forEach((d,i)=>{
    const x=pad.l+(data.length>1?i*xStep:cW/2);
    ctx.fillText(`T${d.turn}`,x,H-5);
  });

  // Lines
  players.forEach((pl,pi)=>{
    const col=CHART_COLORS[pi]||'#fff';
    ctx.strokeStyle=col; ctx.lineWidth=2; ctx.beginPath();
    data.forEach((d,i)=>{
      const x=pad.l+(data.length>1?i*xStep:cW/2);
      const s=d.scores[pl.id]!==undefined?d.scores[pl.id]:0;
      const y=pad.t+cH-((s-mn)/rng)*cH;
      i===0?ctx.moveTo(x,y):ctx.lineTo(x,y);
    });
    ctx.stroke();
    // Dots
    data.forEach((d,i)=>{
      const x=pad.l+(data.length>1?i*xStep:cW/2);
      const s=d.scores[pl.id]!==undefined?d.scores[pl.id]:0;
      const y=pad.t+cH-((s-mn)/rng)*cH;
      ctx.fillStyle=d.isBurn?'#ff4444':col;
      ctx.beginPath(); ctx.arc(x,y,d.isBurn?4:3,0,Math.PI*2); ctx.fill();
    });
  });

  // Legend
  const leg=document.getElementById('chart-legend');
  if(leg) leg.innerHTML=players.map((pl,i)=>`<div class="legend-item"><div class="legend-dot" style="background:${CHART_COLORS[i]};"></div>${escHtml(pl.name)}</div>`).join('');
}

// ────────────────────────────────────────────────────────────
// SCREENSHOT
// ────────────────────────────────────────────────────────────
function takeScreenshot() {
  playKlik();
  toast('📸 Gunakan tombol screenshot bawaan perangkat Anda');
}

// ────────────────────────────────────────────────────────────
// FULLSCREEN
// ────────────────────────────────────────────────────────────
function toggleFullscreen() {
  playKlik();
  if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(()=>{});
  else document.exitFullscreen().catch(()=>{});
}

// ────────────────────────────────────────────────────────────
// MUSIC
// ────────────────────────────────────────────────────────────
function toggleMusic() {
  playKlik();
  GS.bgMusicOn = !GS.bgMusicOn;
  if (bgMusic) { GS.bgMusicOn?bgMusic.play().catch(()=>{}):bgMusic.pause(); }
  bgVol = GS.bgMusicOn ? 1.0 : 0;
  save(); render();
}

// ────────────────────────────────────────────────────────────
// LIGHT MODE
// ────────────────────────────────────────────────────────────
function toggleLightMode() {
  playKlik();
  GS.lightMode = !GS.lightMode;
  save(); render();
}

// ────────────────────────────────────────────────────────────
// RESET
// ────────────────────────────────────────────────────────────
function confirmReset() {
  playKlik();
  const m = document.getElementById('confirm-modal');
  if (m) m.style.display='flex';
}
function cancelReset() {
  const m = document.getElementById('confirm-modal');
  if (m) m.style.display='none';
}
function executeReset() {
  const m = document.getElementById('confirm-modal');
  if (m) m.style.display='none';
  stopAllAudio();
  const arc = JSON.parse(JSON.stringify(GS.playerArchive));
  GS = {
    screen:'setup', round:1, turn:1, target:1000,
    players:[], burnCandidates:[], history:[], chartData:[],
    aiComment:'', playerArchive:arc, bgMusicOn:GS.bgMusicOn, lightMode:GS.lightMode,
    activeTab:'ranking', isFirstTurnOfRound:true, rewardVideoPlaying:false,
    undoStack:[], inputCache:{},
  };
  save(); render();
  toast('🗑 Game direset');
}

// ────────────────────────────────────────────────────────────
// BUILD APP DOM
// ────────────────────────────────────────────────────────────
function buildDOM() {
  const app = document.getElementById('app');
  if (!app) return;
  app.innerHTML = `
    <!-- Header -->
    <div id="header">
      <img src="images/joker.png" id="header-logo" alt="Logo">
      <div id="header-title"><h1>SCORE CEKIH</h1><p>SADEWA CORP</p></div>
      <div class="header-btns">
        <button class="btn-icon" id="btn-music" onclick="toggleMusic()">🎵 ON</button>
        <button class="btn-icon" onclick="toggleLightMode()">🌙</button>
        <button class="btn-icon" onclick="toggleFullscreen()">⛶</button>
      </div>
    </div>

    <!-- Round/Turn Bar (game only) -->
    <div id="round-turn-bar" class="hidden"></div>

    <!-- ── SETUP SCREEN ── -->
    <div id="setup-screen">
      <img src="images/joker.png" class="setup-logo" alt="Logo">
      <div class="setup-title">
        <h2>SCORE CEKIH</h2>
        <p>SADEWA CORP — PREMIUM CARD SCORE TRACKER</p>
      </div>
      <div class="setup-card">
        <h3>🃏 SETUP PEMAIN</h3>
        ${[1,2,3,4].map(i=>`
          <div class="player-input-row">
            <label><span class="player-suit-icon">${SUIT_SYMBOLS[i-1]}</span> Player ${i}</label>
            <input type="text" class="input-field" id="sn-${i}" placeholder="Nama Player ${i}">
          </div>`).join('')}
        <div class="target-row">
          <label>🎯 Target:</label>
          ${[500,750,1000,1500].map(t=>`
            <button class="target-btn${GS.target===t?' active':''}" data-t="${t}" onclick="setTarget(${t})">${t}</button>`).join('')}
          <input type="number" class="input-field" id="custom-target" placeholder="Custom" style="width:70px;">
        </div>
      </div>
      <button class="btn-start" onclick="startGame()">🚀 START GAME</button>
    </div>

    <!-- ── GAME SCREEN ── -->
    <div id="game-screen" class="hidden">

      <!-- AI Comment -->
      <div id="ai-comment-box">🃏 Permainan dimulai!</div>

      <!-- Cards Grid -->
      <div id="cards-grid"></div>

      <!-- Game Controls -->
      <div id="game-controls">
        <div class="controls-row">
          <button class="btn-game btn-save" onclick="saveTurn()">💾 SAVE TURN</button>
          <button class="btn-game btn-burn hidden" id="btn-burn" onclick="openBurnModal()">🔥 BURN</button>
          <button class="btn-game btn-undo" onclick="doUndo()">↩ UNDO</button>
        </div>
        <div class="controls-row">
          <button class="btn-game btn-screenshot" onclick="takeScreenshot()">📸 SS</button>
          <button class="btn-game btn-fullscreen" onclick="toggleFullscreen()">⛶ FS</button>
          <button class="btn-game btn-undo" style="color:#ff9999;border-color:rgba(255,100,100,0.4);" onclick="confirmReset()">🗑 RESET</button>
        </div>
      </div>

      <!-- Tab Menu -->
      <div id="tab-menu">
        ${[['ranking','🏆 Rank'],['history','📜 History'],['achievement','🏅 Ach'],['statistics','📊 Stats'],['archive','📁 Arsip'],['chart','📈 Chart']].map(([t,l])=>
          `<button class="tab-btn" data-tab="${t}" onclick="switchTab('${t}')">${l}</button>`).join('')}
      </div>

      <!-- Tab Content -->
      <div id="tab-content">
        ${['ranking','history','achievement','statistics','archive','chart'].map(t=>`
          <div class="tab-panel" data-tab-panel="${t}">
            ${t==='chart'?`<div id="chart-container"><div class="chart-legend" id="chart-legend"></div><canvas id="score-chart"></canvas></div>`:''}
          </div>`).join('')}
      </div>

      <button id="btn-reset" onclick="confirmReset()">🗑 RESET GAME</button>
    </div>

    <!-- ── NEW ROUND SCREEN ── -->
    <div id="new-round-screen" class="hidden"></div>

    <!-- ── BURN MODAL ── -->
    <div class="modal-overlay hidden" id="burn-modal">
      <div class="modal-box">
        <div class="modal-title">🔥 KONFIRMASI BAKAR</div>
        <div id="burn-candidate-list"></div>
        <div class="modal-btns">
          <button class="btn-confirm-burn" onclick="confirmBurn()">✅ CONFIRM BURN</button>
          <button class="btn-cancel" onclick="closeBurnModal()">❌ Batal</button>
        </div>
      </div>
    </div>

    <!-- ── EDIT NAME MODAL ── -->
    <div class="modal-overlay hidden" id="edit-name-modal"></div>

    <!-- ── CONFIRM RESET MODAL ── -->
    <div id="confirm-modal" style="position:fixed;inset:0;background:rgba(0,0,0,0.72);z-index:800;display:none;align-items:center;justify-content:center;padding:20px;">
      <div class="confirm-box">
        <h3>🗑 Reset Game?</h3>
        <p>Reset menghapus sesi aktif. Statistik permanen tetap aman.</p>
        <div class="confirm-btns">
          <button class="confirm-yes" onclick="executeReset()">✅ Ya, Reset</button>
          <button class="confirm-no" onclick="cancelReset()">❌ Batal</button>
        </div>
      </div>
    </div>

    <!-- ── REWARD OVERLAY ── -->
    <div id="reward-overlay">
      <video id="reward-video" playsinline webkit-playsinline muted></video>
      <div id="reward-win-text">⭐ BINTANG! ⭐</div>
    </div>

    <!-- ── GOLD FLASH ── -->
    <div id="gold-flash"></div>
  `;

  // Confirm modal init
  const cm = document.getElementById('confirm-modal');
  if (cm) cm.style.display='none';
}

// ────────────────────────────────────────────────────────────
// INIT
// ────────────────────────────────────────────────────────────
function init() {
  const bar = document.getElementById('loading-bar');
  const txt = document.getElementById('loading-text');
  let pct = 0;
  const iv = setInterval(()=>{
    pct += Math.random()*14+5;
    if (pct>88) pct=88;
    if (bar) bar.style.width=pct+'%';
    if (txt) txt.textContent=['Memuat...','Membaca data...','Menyiapkan game...'][Math.floor(pct/32)]||'Menyiapkan...';
  }, 160);

  load();

  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(()=>{});

  buildDOM();

  setTimeout(()=>{
    clearInterval(iv);
    if (bar) bar.style.width='100%';
    if (txt) txt.textContent='Siap!';
    setTimeout(()=>{
      const ls = document.getElementById('loading-screen');
      if (ls) { ls.classList.add('fade-out'); setTimeout(()=>ls.style.display='none', 750); }
      render();
      initBgMusic();
    }, 350);
  }, 1100);

  // Pre-load voices
  speechSynthesis.getVoices();
  if (speechSynthesis.addEventListener) {
    speechSynthesis.addEventListener('voiceschanged', ()=>speechSynthesis.getVoices());
  }
}

document.addEventListener('DOMContentLoaded', init);

// Keep border videos playing on tab return
document.addEventListener('visibilitychange', ()=>{
  if (!document.hidden) {
    document.querySelectorAll('.card-border-video').forEach(v=>{ if(v.paused) v.play().catch(()=>{}); });
  }
});
