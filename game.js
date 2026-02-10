// ======== ORMAN AVCISI (Forest Hunter) — FPS Web Game ========
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// ======== CONFIG ========
const CFG = {
  horizonY: 0.32,
  groundColor: '#1a2a0a',
  skyTop: '#050510', skyBot: '#101828',
  ammoMax: 15, reloadTime: 1.8,
  playerMaxHP: 100,
  baseSpawnInterval: 2.0,
  comboTimeout: 2.0,
  adsZoom: 1.4,
  adsFOV: 0.7,
};

// ======== STATE ========
let W, H, mouse = { x: 0, y: 0 }, mouseDown = false;
let state = 'menu'; // menu, playing, waveIntro, gameOver
let score = 0, combo = 0, comboTimer = 0, bestScore = 0;
let hp = CFG.playerMaxHP, ammo = CFG.ammoMax, reloading = false, reloadTimer = 0;
let wave = 1, waveTimer = 0, spawnTimer = 0, animalsToSpawn = 0;
let animals = [], particles = [], floaters = [];
let screenShake = 0, muzzleFlash = 0, gunRecoil = 0;
let lastTime = 0;
let stars = [], treeLayers = [];
let aiming = false, adsLerp = 0; // ADS state

// ======== AUDIO ========
let audioCtx;
function initAudio() { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); }
function playSound(type) {
  if (!audioCtx) return;
  const now = audioCtx.currentTime;
  if (type === 'shoot') {
    const buf = audioCtx.createBuffer(1, audioCtx.sampleRate * 0.15, audioCtx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3);
    const src = audioCtx.createBufferSource(); src.buffer = buf;
    const flt = audioCtx.createBiquadFilter(); flt.type = 'lowpass'; flt.frequency.setValueAtTime(3000, now); flt.frequency.exponentialRampToValueAtTime(300, now + 0.15);
    const gain = audioCtx.createGain(); gain.gain.setValueAtTime(0.6, now); gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
    src.connect(flt); flt.connect(gain); gain.connect(audioCtx.destination); src.start(now);
  } else if (type === 'hit') {
    const osc = audioCtx.createOscillator(); osc.type = 'sine'; osc.frequency.setValueAtTime(800, now); osc.frequency.exponentialRampToValueAtTime(200, now + 0.1);
    const gain = audioCtx.createGain(); gain.gain.setValueAtTime(0.3, now); gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
    osc.connect(gain); gain.connect(audioCtx.destination); osc.start(now); osc.stop(now + 0.1);
  } else if (type === 'reload') {
    const osc = audioCtx.createOscillator(); osc.type = 'square'; osc.frequency.setValueAtTime(600, now); osc.frequency.setValueAtTime(900, now + 0.05);
    const gain = audioCtx.createGain(); gain.gain.setValueAtTime(0.15, now); gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
    osc.connect(gain); gain.connect(audioCtx.destination); osc.start(now); osc.stop(now + 0.1);
  } else if (type === 'death') {
    const osc = audioCtx.createOscillator(); osc.type = 'sawtooth'; osc.frequency.setValueAtTime(400, now); osc.frequency.exponentialRampToValueAtTime(60, now + 0.3);
    const gain = audioCtx.createGain(); gain.gain.setValueAtTime(0.25, now); gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
    osc.connect(gain); gain.connect(audioCtx.destination); osc.start(now); osc.stop(now + 0.3);
  } else if (type === 'empty') {
    const osc = audioCtx.createOscillator(); osc.type = 'triangle'; osc.frequency.setValueAtTime(200, now);
    const gain = audioCtx.createGain(); gain.gain.setValueAtTime(0.2, now); gain.gain.exponentialRampToValueAtTime(0.01, now + 0.06);
    osc.connect(gain); gain.connect(audioCtx.destination); osc.start(now); osc.stop(now + 0.06);
  }
}

// ======== RESIZE ========
function resize() {
  W = canvas.width = window.innerWidth * window.devicePixelRatio;
  H = canvas.height = window.innerHeight * window.devicePixelRatio;
  canvas.style.width = window.innerWidth + 'px';
  canvas.style.height = window.innerHeight + 'px';
  generateStars();
  generateTrees();
}
window.addEventListener('resize', resize);

function generateStars() {
  stars = [];
  for (let i = 0; i < 120; i++) stars.push({ x: Math.random() * W, y: Math.random() * H * CFG.horizonY * 0.9, size: Math.random() * 2 + 0.5, bright: Math.random() });
}
function generateTrees() {
  treeLayers = [];
  for (let layer = 0; layer < 4; layer++) {
    const trees = [];
    const count = 12 + layer * 6;
    for (let i = 0; i < count; i++) {
      trees.push({ x: (i / count) * W + (Math.random() - 0.5) * (W / count) * 0.8, h: (0.15 + layer * 0.06 + Math.random() * 0.05) * H, w: (10 + layer * 8 + Math.random() * 12) });
    }
    treeLayers.push(trees);
  }
}

// ======== ANIMAL TYPES ========
const ANIMAL_TYPES = {
  wolf: { name: 'Kurt', color: '#4a4a55', eyeColor: '#ffee00', speed: 0.13, hp: 2, points: 200, bodyW: 50, bodyH: 28, zigzag: true, earType: 'pointed' },
  wolfBig: { name: 'Alfa Kurt', color: '#333340', eyeColor: '#ff3300', speed: 0.10, hp: 4, points: 400, bodyW: 62, bodyH: 36, zigzag: true, earType: 'pointed' },
  dog: { name: 'Kuduz Köpek', color: '#7a5530', eyeColor: '#ff4444', speed: 0.16, hp: 1, points: 100, bodyW: 40, bodyH: 22, earType: 'floppy' },
  dogBig: { name: 'Kuduz Köpek', color: '#5a3a20', eyeColor: '#ff2200', speed: 0.12, hp: 2, points: 180, bodyW: 48, bodyH: 28, earType: 'floppy' },
};

// ======== ANIMAL CLASS ========
class Animal {
  constructor(type) {
    const t = ANIMAL_TYPES[type];
    Object.assign(this, { type, ...t, depth: 0.98 + Math.random() * 0.02, worldX: (Math.random() - 0.5) * 1.6, currentHP: t.hp, flash: 0, dead: false, deathTimer: 0, phase: Math.random() * Math.PI * 2, legAnim: 0 });
  }
  update(dt) {
    if (this.dead) { this.deathTimer += dt; return this.deathTimer < 0.4; }
    this.depth -= this.speed * dt * (0.8 + wave * 0.05);
    this.legAnim += dt * this.speed * 25;
    if (this.zigzag) this.worldX += Math.sin(this.phase + this.depth * 12) * dt * 0.3;
    if (this.flash > 0) this.flash -= dt * 4;
    if (this.depth <= 0.05) { hp -= 15 + wave * 2; screenShake = 8; this.dead = true; }
    return this.depth > -0.1;
  }
  getScreen() {
    const p = 1 - this.depth;
    const hY = H * CFG.horizonY;
    const sy = hY + p * (H - hY);
    const sx = W / 2 + this.worldX * p * W * 0.45;
    const sc = 0.15 + p * 0.85;
    return { x: sx, y: sy, scale: sc };
  }
  draw() {
    const { x, y, scale } = this.getScreen();
    const s = scale * (W / 1200);
    const bw = this.bodyW * s, bh = this.bodyH * s;
    ctx.save();
    ctx.translate(x, y);
    if (this.dead) { ctx.globalAlpha = 1 - this.deathTimer / 0.4; ctx.translate(0, this.deathTimer * 60); }
    const c = this.flash > 0 ? '#fff' : this.color;
    const darker = this.flash > 0 ? '#ddd' : shadeColor(this.color, -30);
    // legs
    const legH = bh * 0.7, legW = bw * 0.12;
    const legOff = Math.sin(this.legAnim) * legH * 0.2;
    ctx.fillStyle = darker;
    ctx.fillRect(-bw * 0.35, 0, legW, legH + legOff);
    ctx.fillRect(-bw * 0.1, 0, legW, legH - legOff);
    ctx.fillRect(bw * 0.1, 0, legW, legH + legOff);
    ctx.fillRect(bw * 0.3, 0, legW, legH - legOff);
    // body
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.ellipse(0, -bh * 0.15, bw * 0.55, bh * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
    // head
    const headX = bw * 0.5, headR = bh * 0.35;
    ctx.beginPath();
    ctx.ellipse(headX, -bh * 0.3, headR, headR * 0.8, 0, 0, Math.PI * 2);
    ctx.fill();
    // eyes
    ctx.fillStyle = this.eyeColor;
    ctx.beginPath(); ctx.arc(headX + headR * 0.3, -bh * 0.35, headR * 0.18, 0, Math.PI * 2); ctx.fill();
    // ears
    ctx.fillStyle = darker;
    if (this.earType === 'pointed') {
      ctx.beginPath(); ctx.moveTo(headX - headR * 0.3, -bh * 0.6); ctx.lineTo(headX - headR * 0.1, -bh * 0.95); ctx.lineTo(headX + headR * 0.1, -bh * 0.6); ctx.fill();
      ctx.beginPath(); ctx.moveTo(headX + headR * 0.1, -bh * 0.6); ctx.lineTo(headX + headR * 0.3, -bh * 0.95); ctx.lineTo(headX + headR * 0.5, -bh * 0.6); ctx.fill();
    } else {
      ctx.beginPath(); ctx.ellipse(headX - headR * 0.3, -bh * 0.5, headR * 0.22, headR * 0.35, 0.4, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(headX + headR * 0.4, -bh * 0.5, headR * 0.22, headR * 0.35, -0.4, 0, Math.PI * 2); ctx.fill();
    }
    // snout/mouth
    ctx.fillStyle = this.flash > 0 ? '#eee' : shadeColor(this.color, 20);
    ctx.beginPath(); ctx.ellipse(headX + headR * 0.7, -bh * 0.22, headR * 0.3, headR * 0.2, 0, 0, Math.PI * 2); ctx.fill();
    // teeth (showing aggression)
    ctx.fillStyle = '#fff';
    ctx.fillRect(headX + headR * 0.75, -bh * 0.15, headR * 0.08, headR * 0.12);
    ctx.fillRect(headX + headR * 0.88, -bh * 0.15, headR * 0.08, headR * 0.1);
    // foam for rabid dogs
    if (this.type === 'dog' || this.type === 'dogBig') {
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      for (let fi = 0; fi < 3; fi++) { ctx.beginPath(); ctx.arc(headX + headR * (0.8 + fi * 0.12), -bh * 0.08 + Math.sin(this.legAnim * 2 + fi) * 2, 2 * s, 0, Math.PI * 2); ctx.fill(); }
    }
    ctx.restore();
  }
  hitTest(mx, my) {
    const { x, y, scale } = this.getScreen();
    const s = scale * (W / 1200);
    const bw = this.bodyW * s * 0.6, bh = this.bodyH * s * 0.7;
    return Math.abs(mx - x) < bw && Math.abs(my - (y - bh * 0.5)) < bh;
  }
}

function shadeColor(hex, pct) {
  let r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
  r = Math.max(0, Math.min(255, r + pct)); g = Math.max(0, Math.min(255, g + pct)); b = Math.max(0, Math.min(255, b + pct));
  return `rgb(${r},${g},${b})`;
}

// ======== PARTICLES ========
class Particle {
  constructor(x, y, vx, vy, color, life, size) {
    Object.assign(this, { x, y, vx, vy, color, life, maxLife: life, size, gravity: 200 });
  }
  update(dt) { this.x += this.vx * dt; this.y += this.vy * dt; this.vy += this.gravity * dt; this.life -= dt; return this.life > 0; }
  draw() {
    const a = this.life / this.maxLife;
    ctx.globalAlpha = a;
    ctx.fillStyle = this.color;
    ctx.beginPath(); ctx.arc(this.x, this.y, this.size * a, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  }
}

function spawnHitParticles(x, y) {
  for (let i = 0; i < 12; i++) {
    const angle = Math.random() * Math.PI * 2, speed = 100 + Math.random() * 250;
    particles.push(new Particle(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed - 100, ['#ff3030', '#ff6030', '#ff9030', '#ffcc00'][i % 4], 0.4 + Math.random() * 0.3, 3 + Math.random() * 4));
  }
}
function spawnDeathParticles(x, y) {
  for (let i = 0; i < 25; i++) {
    const angle = Math.random() * Math.PI * 2, speed = 80 + Math.random() * 350;
    particles.push(new Particle(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed - 150, ['#ff2020', '#cc1010', '#ff8000', '#ffcc00', '#fff'][i % 5], 0.5 + Math.random() * 0.5, 3 + Math.random() * 6));
  }
}
function spawnMuzzleParticles() {
  const gunInfo = getGunPosition();
  const tipX = gunInfo.tipX, tipY = gunInfo.tipY;
  for (let i = 0; i < 15; i++) {
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.0, speed = 150 + Math.random() * 400;
    particles.push(new Particle(tipX, tipY, Math.cos(angle) * speed, Math.sin(angle) * speed, ['#ff8800', '#ffcc00', '#fff', '#ff4400'][i % 4], 0.12 + Math.random() * 0.15, 2 + Math.random() * 5));
  }
  // shell casing
  particles.push(new Particle(gunInfo.x + 30, gunInfo.tipY + 40, 150 + Math.random() * 100, -200 - Math.random() * 100, '#ccaa44', 0.6, 3));
}
function getGunPosition() {
  const ads = adsLerp;
  const hipX = W * 0.62, hipY = H * 0.88;
  const adsX = W * 0.5, adsY = H * 0.72;
  const gx = hipX + (adsX - hipX) * ads + (mouse.x - W / 2) * (0.06 - ads * 0.04);
  const gy = hipY + (adsY - hipY) * ads + gunRecoil * 35;
  return { x: gx, y: gy, tipX: gx - 5, tipY: gy - 200 * (W / 1200) - gunRecoil * 20 };
}

// ======== FLOATERS (ambient fireflies) ========
function initFloaters() {
  floaters = [];
  for (let i = 0; i < 30; i++) floaters.push({ x: Math.random() * W, y: H * CFG.horizonY + Math.random() * H * 0.5, vx: (Math.random() - 0.5) * 20, vy: (Math.random() - 0.5) * 15, phase: Math.random() * Math.PI * 2 });
}

// ======== DRAWING ========
function drawBackground() {
  // sky gradient
  const skyGrad = ctx.createLinearGradient(0, 0, 0, H * CFG.horizonY);
  skyGrad.addColorStop(0, CFG.skyTop); skyGrad.addColorStop(1, CFG.skyBot);
  ctx.fillStyle = skyGrad; ctx.fillRect(0, 0, W, H * CFG.horizonY + 10);
  // stars
  for (const s of stars) {
    const twinkle = 0.4 + Math.sin(s.bright * 100 + Date.now() * 0.002) * 0.3 + 0.3;
    ctx.globalAlpha = twinkle; ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
  // moon
  const moonX = W * 0.8, moonY = H * 0.1, moonR = Math.min(W, H) * 0.04;
  ctx.fillStyle = '#fffde0'; ctx.shadowColor = '#fffde0'; ctx.shadowBlur = moonR * 2;
  ctx.beginPath(); ctx.arc(moonX, moonY, moonR, 0, Math.PI * 2); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = CFG.skyTop;
  ctx.beginPath(); ctx.arc(moonX - moonR * 0.3, moonY - moonR * 0.1, moonR * 0.85, 0, Math.PI * 2); ctx.fill();
  // ground
  const groundGrad = ctx.createLinearGradient(0, H * CFG.horizonY, 0, H);
  groundGrad.addColorStop(0, '#0d1a06'); groundGrad.addColorStop(0.4, '#142008'); groundGrad.addColorStop(1, '#1a2a0c');
  ctx.fillStyle = groundGrad; ctx.fillRect(0, H * CFG.horizonY, W, H);
  // ground lines for depth
  ctx.strokeStyle = 'rgba(30,60,15,0.3)'; ctx.lineWidth = 1;
  for (let i = 0; i < 15; i++) {
    const p = i / 15;
    const ly = H * CFG.horizonY + p * p * H * (1 - CFG.horizonY);
    ctx.beginPath(); ctx.moveTo(0, ly); ctx.lineTo(W, ly); ctx.stroke();
  }
  // tree layers (back to front)
  const layerColors = ['#060d04', '#081006', '#0a1408', '#0d180a'];
  for (let l = 0; l < treeLayers.length; l++) {
    const baseY = H * CFG.horizonY + l * H * 0.02;
    ctx.fillStyle = layerColors[l];
    for (const t of treeLayers[l]) {
      drawTreeSilhouette(t.x, baseY, t.h * (0.5 + l * 0.2), t.w * (0.7 + l * 0.15));
    }
    // fill ground strip
    ctx.fillRect(0, baseY, W, H * 0.03);
  }
  // fog overlay
  const fogGrad = ctx.createLinearGradient(0, H * CFG.horizonY, 0, H * CFG.horizonY + H * 0.25);
  fogGrad.addColorStop(0, 'rgba(15,25,10,0.7)'); fogGrad.addColorStop(1, 'rgba(15,25,10,0)');
  ctx.fillStyle = fogGrad; ctx.fillRect(0, H * CFG.horizonY, W, H * 0.25);
}

function drawTreeSilhouette(x, baseY, h, w) {
  ctx.beginPath();
  ctx.moveTo(x - w * 0.1, baseY);
  ctx.lineTo(x - w * 0.1, baseY - h * 0.35);
  // foliage triangles
  ctx.lineTo(x - w * 0.5, baseY - h * 0.3);
  ctx.lineTo(x, baseY - h * 0.6);
  ctx.lineTo(x - w * 0.4, baseY - h * 0.55);
  ctx.lineTo(x, baseY - h * 0.85);
  ctx.lineTo(x - w * 0.3, baseY - h * 0.75);
  ctx.lineTo(x, baseY - h);
  ctx.lineTo(x + w * 0.3, baseY - h * 0.75);
  ctx.lineTo(x, baseY - h * 0.85);
  ctx.lineTo(x + w * 0.4, baseY - h * 0.55);
  ctx.lineTo(x, baseY - h * 0.6);
  ctx.lineTo(x + w * 0.5, baseY - h * 0.3);
  ctx.lineTo(x + w * 0.1, baseY - h * 0.35);
  ctx.lineTo(x + w * 0.1, baseY);
  ctx.closePath();
  ctx.fill();
}

function drawFloaters(dt) {
  for (const f of floaters) {
    f.x += f.vx * dt; f.y += f.vy * dt; f.phase += dt;
    if (f.x < 0) f.x = W; if (f.x > W) f.x = 0;
    if (f.y < H * CFG.horizonY) f.y = H * CFG.horizonY + 10;
    if (f.y > H * 0.85) f.y = H * 0.85;
    const a = (Math.sin(f.phase * 2) * 0.5 + 0.5) * 0.6;
    ctx.globalAlpha = a; ctx.fillStyle = '#aaffaa'; ctx.shadowColor = '#aaffaa'; ctx.shadowBlur = 8;
    ctx.beginPath(); ctx.arc(f.x, f.y, 2, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1; ctx.shadowBlur = 0;
}

function drawGun() {
  const S = W / 1200;
  const info = getGunPosition();
  const gx = info.x, gy = info.y;
  const tilt = (mouse.x - W / 2) / W * (0.06 - adsLerp * 0.04);
  ctx.save();
  ctx.translate(gx, gy);
  ctx.rotate(tilt);
  const sc = S * (1.8 + adsLerp * 0.3);
  // shadow under gun
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath(); ctx.ellipse(0, 10 * sc, 55 * sc, 12 * sc, 0, 0, Math.PI * 2); ctx.fill();
  // === BARREL ===
  ctx.fillStyle = '#1c1c1c';
  ctx.fillRect(-8 * sc, -200 * sc, 16 * sc, 130 * sc); // main barrel
  ctx.fillStyle = '#151515';
  ctx.fillRect(-10 * sc, -210 * sc, 20 * sc, 15 * sc); // muzzle
  // barrel grooves
  ctx.fillStyle = '#222'; ctx.fillRect(-6 * sc, -180 * sc, 12 * sc, 2 * sc); ctx.fillRect(-6 * sc, -160 * sc, 12 * sc, 2 * sc);
  // === SLIDE ===
  ctx.fillStyle = '#2a2a2a';
  ctx.beginPath();
  ctx.roundRect(-18 * sc, -75 * sc, 36 * sc, 85 * sc, 3 * sc);
  ctx.fill();
  // slide serrations
  ctx.strokeStyle = '#333'; ctx.lineWidth = 1.5 * sc;
  for (let i = 0; i < 6; i++) { const sy = -20 * sc + i * 8 * sc; ctx.beginPath(); ctx.moveTo(-18 * sc, sy); ctx.lineTo(-13 * sc, sy); ctx.stroke(); ctx.beginPath(); ctx.moveTo(18 * sc, sy); ctx.lineTo(13 * sc, sy); ctx.stroke(); }
  // === FRAME ===
  ctx.fillStyle = '#222';
  ctx.beginPath(); ctx.roundRect(-16 * sc, 5 * sc, 32 * sc, 35 * sc, 2 * sc); ctx.fill();
  // trigger guard
  ctx.strokeStyle = '#2a2a2a'; ctx.lineWidth = 3 * sc;
  ctx.beginPath(); ctx.arc(0, 25 * sc, 14 * sc, 0.1, Math.PI - 0.1); ctx.stroke();
  // trigger
  ctx.fillStyle = '#181818';
  ctx.fillRect(-2 * sc, 14 * sc, 4 * sc, 16 * sc);
  // === GRIP ===
  ctx.fillStyle = '#3a2818';
  ctx.beginPath();
  ctx.moveTo(-16 * sc, 38 * sc); ctx.lineTo(-20 * sc, 100 * sc); ctx.lineTo(-10 * sc, 108 * sc); ctx.lineTo(10 * sc, 108 * sc); ctx.lineTo(20 * sc, 100 * sc); ctx.lineTo(16 * sc, 38 * sc);
  ctx.closePath(); ctx.fill();
  // grip texture
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  for (let gy2 = 48 * sc; gy2 < 95 * sc; gy2 += 6 * sc) { ctx.fillRect(-14 * sc, gy2, 28 * sc, 2 * sc); }
  // grip cross-hatch
  ctx.strokeStyle = 'rgba(0,0,0,0.15)'; ctx.lineWidth = 1 * sc;
  for (let i = 0; i < 8; i++) { const yy = 50 * sc + i * 6 * sc; ctx.beginPath(); ctx.moveTo(-12 * sc, yy); ctx.lineTo(12 * sc, yy + 10 * sc); ctx.stroke(); }
  // === SIGHTS ===
  // rear sight
  ctx.fillStyle = '#111'; ctx.fillRect(-12 * sc, -78 * sc, 6 * sc, 6 * sc); ctx.fillRect(6 * sc, -78 * sc, 6 * sc, 6 * sc);
  // front sight
  ctx.fillStyle = '#111'; ctx.fillRect(-3 * sc, -205 * sc, 6 * sc, 8 * sc);
  // front sight dot (glowing)
  ctx.fillStyle = '#00ff44'; ctx.shadowColor = '#00ff44'; ctx.shadowBlur = 6 * sc;
  ctx.beginPath(); ctx.arc(0, -206 * sc, 2 * sc, 0, Math.PI * 2); ctx.fill();
  ctx.shadowBlur = 0;
  // rear sight dots
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(-9 * sc, -75 * sc, 1.5 * sc, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(9 * sc, -75 * sc, 1.5 * sc, 0, Math.PI * 2); ctx.fill();
  // === HAND ===
  ctx.fillStyle = '#c4926a';
  ctx.beginPath();
  ctx.moveTo(-22 * sc, 65 * sc); ctx.quadraticCurveTo(-28 * sc, 80 * sc, -24 * sc, 100 * sc);
  ctx.lineTo(-12 * sc, 106 * sc); ctx.lineTo(-16 * sc, 65 * sc); ctx.closePath(); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(22 * sc, 65 * sc); ctx.quadraticCurveTo(28 * sc, 80 * sc, 24 * sc, 100 * sc);
  ctx.lineTo(12 * sc, 106 * sc); ctx.lineTo(16 * sc, 65 * sc); ctx.closePath(); ctx.fill();
  // fingers wrapping
  ctx.fillStyle = '#b8845e';
  for (let fi = 0; fi < 4; fi++) { const fy = 68 * sc + fi * 9 * sc; ctx.beginPath(); ctx.ellipse(-19 * sc, fy, 5 * sc, 4 * sc, 0.2, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.ellipse(19 * sc, fy, 5 * sc, 4 * sc, -0.2, 0, Math.PI * 2); ctx.fill(); }
  // thumb on right
  ctx.fillStyle = '#c4926a';
  ctx.beginPath(); ctx.ellipse(22 * sc, 50 * sc, 6 * sc, 14 * sc, 0.15, 0, Math.PI * 2); ctx.fill();
  // === MUZZLE FLASH ===
  if (muzzleFlash > 0) {
    const fa = muzzleFlash, tipY = -210 * sc;
    ctx.globalAlpha = fa;
    // outer glow
    ctx.fillStyle = '#ff6600'; ctx.shadowColor = '#ff4400'; ctx.shadowBlur = 40 * sc * fa;
    ctx.beginPath(); ctx.arc(0, tipY, 35 * sc * fa, 0, Math.PI * 2); ctx.fill();
    // inner core
    ctx.fillStyle = '#ffcc00';
    ctx.beginPath(); ctx.arc(0, tipY, 18 * sc * fa, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(0, tipY, 8 * sc * fa, 0, Math.PI * 2); ctx.fill();
    // directional flash spikes
    ctx.strokeStyle = '#ffaa00'; ctx.lineWidth = 3 * sc;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 - Math.PI / 2; const len = (30 + Math.random() * 25) * sc * fa;
      ctx.beginPath(); ctx.moveTo(Math.cos(a) * 12 * sc, tipY + Math.sin(a) * 12 * sc); ctx.lineTo(Math.cos(a) * len, tipY + Math.sin(a) * len); ctx.stroke();
    }
    ctx.shadowBlur = 0; ctx.globalAlpha = 1;
    // screen flash overlay
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = `rgba(255,200,100,${fa * 0.08})`; ctx.fillRect(0, 0, W, H); ctx.restore();
  }
  ctx.restore();
}

function drawCrosshair() {
  const cx = mouse.x, cy = mouse.y;
  const hovering = animals.some(a => !a.dead && a.hitTest(cx, cy));
  const color = hovering ? '#ff3030' : '#00ff88';
  const ads = adsLerp;
  const r = 18 - ads * 10, gap = 6 - ads * 3, lineLen = 12 - ads * 6;
  ctx.strokeStyle = color; ctx.lineWidth = 2 - ads * 0.5; ctx.shadowColor = color; ctx.shadowBlur = 4;
  if (ads < 0.8) {
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(cx - r - lineLen, cy); ctx.lineTo(cx - gap, cy);
  ctx.moveTo(cx + gap, cy); ctx.lineTo(cx + r + lineLen, cy);
  ctx.moveTo(cx, cy - r - lineLen); ctx.lineTo(cx, cy - gap);
  ctx.moveTo(cx, cy + gap); ctx.lineTo(cx, cy + r + lineLen);
  ctx.stroke();
  ctx.fillStyle = color; ctx.beginPath(); ctx.arc(cx, cy, ads > 0.5 ? 1.5 : 2.5, 0, Math.PI * 2); ctx.fill();
  ctx.shadowBlur = 0;
  // ADS vignette
  if (ads > 0.1) {
    ctx.save(); ctx.globalAlpha = ads * 0.4;
    const grad = ctx.createRadialGradient(W / 2, H / 2, W * 0.25, W / 2, H / 2, W * 0.6);
    grad.addColorStop(0, 'transparent'); grad.addColorStop(1, '#000');
    ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
}

function drawHUD() {
  const scale = W / 1200;
  const pad = 25 * scale;
  // Score (top right)
  ctx.textAlign = 'right'; ctx.font = `bold ${28 * scale}px Orbitron, monospace`;
  ctx.fillStyle = '#ffcc00'; ctx.shadowColor = '#ffcc00'; ctx.shadowBlur = 10;
  ctx.fillText(`SKOR: ${score}`, W - pad, pad + 28 * scale);
  ctx.shadowBlur = 0;
  // Best score
  ctx.font = `${14 * scale}px Inter, sans-serif`; ctx.fillStyle = '#888';
  ctx.fillText(`EN İYİ: ${bestScore}`, W - pad, pad + 50 * scale);
  // Combo
  if (combo > 1) {
    ctx.font = `bold ${22 * scale}px Orbitron`; ctx.fillStyle = `hsl(${30 + combo * 15}, 100%, 60%)`;
    ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 8;
    ctx.fillText(`x${combo} COMBO!`, W - pad, pad + 78 * scale);
    ctx.shadowBlur = 0;
  }
  // Wave (top center)
  ctx.textAlign = 'center'; ctx.font = `bold ${20 * scale}px Orbitron`;
  ctx.fillStyle = '#88ccff';
  ctx.fillText(`DALGA ${wave}`, W / 2, pad + 22 * scale);
  // Health bar (bottom left)
  ctx.textAlign = 'left';
  const hpW = 220 * scale, hpH = 18 * scale, hpX = pad, hpY = H - pad - hpH;
  ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(hpX - 2, hpY - 2, hpW + 4, hpH + 4);
  const hpPct = Math.max(0, hp / CFG.playerMaxHP);
  const hpColor = hpPct > 0.5 ? '#00cc44' : hpPct > 0.25 ? '#ffaa00' : '#ff2020';
  ctx.fillStyle = hpColor; ctx.fillRect(hpX, hpY, hpW * hpPct, hpH);
  ctx.strokeStyle = '#555'; ctx.lineWidth = 1; ctx.strokeRect(hpX - 2, hpY - 2, hpW + 4, hpH + 4);
  ctx.font = `bold ${14 * scale}px Inter`; ctx.fillStyle = '#fff';
  ctx.fillText(`❤️ ${Math.ceil(hp)}`, hpX + 5, hpY + hpH - 3);
  // Ammo (bottom right)
  ctx.textAlign = 'right';
  const ammoY = H - pad;
  ctx.font = `bold ${22 * scale}px Orbitron`;
  if (reloading) {
    const rPct = 1 - reloadTimer / CFG.reloadTime;
    ctx.fillStyle = '#ffaa00';
    ctx.fillText(`SARJÖR... ${Math.floor(rPct * 100)}%`, W - pad, ammoY);
  } else {
    ctx.fillStyle = ammo > 2 ? '#fff' : '#ff4444';
    let ammoStr = '';
    for (let i = 0; i < CFG.ammoMax; i++) ammoStr += i < ammo ? '|' : '·';
    ctx.fillText(`${ammo}/${CFG.ammoMax}  ${ammoStr}`, W - pad, ammoY);
  }
  ctx.font = `${12 * scale}px Inter`; ctx.fillStyle = '#888';
  ctx.fillText('[R] Şarjör Değiştir', W - pad, ammoY - 26 * scale);
}

// ======== GAME LOGIC ========
function shoot() {
  if (state !== 'playing') return;
  if (reloading) return;
  if (ammo <= 0) { playSound('empty'); return; }
  ammo--;
  playSound('shoot');
  muzzleFlash = 1;
  gunRecoil = 1;
  screenShake = 4;
  spawnMuzzleParticles();
  // hit detection (front to back so closer animals are hit first)
  const sorted = [...animals].filter(a => !a.dead).sort((a, b) => a.depth - b.depth);
  for (const a of sorted) {
    if (a.hitTest(mouse.x, mouse.y)) {
      a.currentHP--;
      a.flash = 1;
      playSound('hit');
      const { x, y } = a.getScreen();
      spawnHitParticles(x, y);
      if (a.currentHP <= 0) {
        a.dead = true;
        playSound('death');
        spawnDeathParticles(x, y);
        combo++;
        comboTimer = CFG.comboTimeout;
        score += a.points * combo;
      }
      break;
    }
  }
  if (ammo <= 0) startReload();
}

function startReload() {
  if (reloading || ammo === CFG.ammoMax) return;
  reloading = true; reloadTimer = CFG.reloadTime;
  playSound('reload');
}

function startWave() {
  animalsToSpawn = 4 + wave * 3;
  spawnTimer = 0.5;
  state = 'playing';
}

function spawnAnimal() {
  const types = ['dog', 'dog', 'wolf'];
  if (wave >= 2) types.push('wolf', 'dogBig');
  if (wave >= 3) types.push('wolfBig', 'dog');
  if (wave >= 5) types.push('wolfBig', 'wolfBig');
  animals.push(new Animal(types[Math.floor(Math.random() * types.length)]));
}

function startGame() {
  if (!audioCtx) initAudio();
  score = 0; combo = 0; comboTimer = 0;
  hp = CFG.playerMaxHP; ammo = CFG.ammoMax;
  reloading = false; reloadTimer = 0;
  wave = 1; animals = []; particles = [];
  screenShake = 0; muzzleFlash = 0; gunRecoil = 0;
  initFloaters();
  state = 'waveIntro'; waveTimer = 2;
}

// ======== SCREENS ========
function drawMenuScreen() {
  drawBackground();
  drawFloaters(0.016);
  // dark overlay
  ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(0, 0, W, H);
  const scale = W / 1200;
  // title
  ctx.textAlign = 'center';
  ctx.font = `900 ${64 * scale}px Orbitron`; ctx.fillStyle = '#ff6600';
  ctx.shadowColor = '#ff4400'; ctx.shadowBlur = 30;
  ctx.fillText('ORMAN AVCISI', W / 2, H * 0.32);
  ctx.shadowBlur = 0;
  // subtitle
  ctx.font = `${22 * scale}px Inter`; ctx.fillStyle = '#88ccaa';
  ctx.fillText('🌲 Forest Hunter 🌲', W / 2, H * 0.39);
  // crosshair icon
  drawCrosshairIcon(W / 2, H * 0.52, 35 * scale);
  // instructions
  ctx.font = `bold ${20 * scale}px Inter`; ctx.fillStyle = '#fff';
  ctx.fillText('🖱️  Sol Tık: Ateş  •  Sağ Tık: Nişan Al (Zoom)', W / 2, H * 0.64);
  ctx.fillText('[R] Şarjör değiştir', W / 2, H * 0.69);
  // start prompt
  const pulse = Math.sin(Date.now() * 0.004) * 0.3 + 0.7;
  ctx.globalAlpha = pulse;
  ctx.font = `bold ${28 * scale}px Orbitron`; ctx.fillStyle = '#ffcc00';
  ctx.fillText('BAŞLAMAK İÇİN TIKLA', W / 2, H * 0.82);
  ctx.globalAlpha = 1;
}
function drawCrosshairIcon(x, y, r) {
  ctx.strokeStyle = '#ff4400'; ctx.lineWidth = 3; ctx.shadowColor = '#ff4400'; ctx.shadowBlur = 12;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x - r * 1.4, y); ctx.lineTo(x - r * 0.3, y); ctx.moveTo(x + r * 0.3, y); ctx.lineTo(x + r * 1.4, y);
  ctx.moveTo(x, y - r * 1.4); ctx.lineTo(x, y - r * 0.3); ctx.moveTo(x, y + r * 0.3); ctx.lineTo(x, y + r * 1.4); ctx.stroke();
  ctx.shadowBlur = 0;
}

function drawWaveIntro() {
  const scale = W / 1200;
  ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(0, 0, W, H);
  const a = Math.min(1, (2 - waveTimer) * 2);
  ctx.globalAlpha = a;
  ctx.textAlign = 'center'; ctx.font = `900 ${56 * scale}px Orbitron`;
  ctx.fillStyle = '#ffcc00'; ctx.shadowColor = '#ffaa00'; ctx.shadowBlur = 20;
  ctx.fillText(`DALGA ${wave}`, W / 2, H * 0.45);
  ctx.shadowBlur = 0;
  ctx.font = `${20 * scale}px Inter`; ctx.fillStyle = '#aaa';
  ctx.fillText(`${4 + wave * 3} hayvan yaklaşıyor...`, W / 2, H * 0.53);
  ctx.globalAlpha = 1;
}

function drawGameOver() {
  drawBackground();
  ctx.fillStyle = 'rgba(10,0,0,0.7)'; ctx.fillRect(0, 0, W, H);
  const scale = W / 1200;
  ctx.textAlign = 'center';
  ctx.font = `900 ${54 * scale}px Orbitron`; ctx.fillStyle = '#ff2020';
  ctx.shadowColor = '#ff0000'; ctx.shadowBlur = 25;
  ctx.fillText('OYUN BİTTİ', W / 2, H * 0.33);
  ctx.shadowBlur = 0;
  ctx.font = `bold ${30 * scale}px Orbitron`; ctx.fillStyle = '#ffcc00';
  ctx.fillText(`SKOR: ${score}`, W / 2, H * 0.45);
  if (score >= bestScore) {
    ctx.font = `${20 * scale}px Inter`; ctx.fillStyle = '#ff8800';
    ctx.fillText('🏆 YENİ REKOR! 🏆', W / 2, H * 0.52);
  }
  ctx.font = `${18 * scale}px Inter`; ctx.fillStyle = '#aaa';
  ctx.fillText(`Ulaşılan Dalga: ${wave}`, W / 2, H * 0.59);
  const pulse = Math.sin(Date.now() * 0.004) * 0.3 + 0.7;
  ctx.globalAlpha = pulse;
  ctx.font = `bold ${24 * scale}px Orbitron`; ctx.fillStyle = '#ffcc00';
  ctx.fillText('TEKRAR OYNAMAK İÇİN TIKLA', W / 2, H * 0.75);
  ctx.globalAlpha = 1;
}

// ======== MAIN LOOP ========
function gameLoop(timestamp) {
  const dt = Math.min((timestamp - lastTime) / 1000, 0.05);
  lastTime = timestamp;
  // clear
  ctx.clearRect(0, 0, W, H);

  if (state === 'menu') {
    drawMenuScreen();
    drawCrosshair();
    requestAnimationFrame(gameLoop);
    return;
  }
  if (state === 'gameOver') {
    drawGameOver();
    drawCrosshair();
    requestAnimationFrame(gameLoop);
    return;
  }

  // update
  if (state === 'waveIntro') {
    drawBackground(); drawFloaters(dt);
    drawWaveIntro();
    drawCrosshair();
    waveTimer -= dt;
    if (waveTimer <= 0) startWave();
    requestAnimationFrame(gameLoop);
    return;
  }

  // playing
  // reload
  if (reloading) {
    reloadTimer -= dt;
    if (reloadTimer <= 0) { reloading = false; ammo = CFG.ammoMax; playSound('reload'); }
  }
  // combo
  if (comboTimer > 0) { comboTimer -= dt; if (comboTimer <= 0) combo = 0; }
  // ADS lerp
  const adsTarget = aiming ? 1 : 0;
  adsLerp += (adsTarget - adsLerp) * Math.min(1, dt * 8);
  // effects decay
  if (muzzleFlash > 0) muzzleFlash -= dt * 8;
  if (gunRecoil > 0) gunRecoil -= dt * 5;
  if (screenShake > 0) screenShake -= dt * 20;
  // spawn
  spawnTimer -= dt;
  if (spawnTimer <= 0 && animalsToSpawn > 0) {
    spawnAnimal(); animalsToSpawn--;
    spawnTimer = Math.max(0.3, CFG.baseSpawnInterval - wave * 0.12);
  }
  // update animals
  animals = animals.filter(a => a.update(dt));
  // update particles
  particles = particles.filter(p => p.update(dt));
  // check wave complete
  if (animalsToSpawn <= 0 && animals.length === 0) {
    wave++;
    state = 'waveIntro'; waveTimer = 2.5;
  }
  // check game over
  if (hp <= 0) {
    hp = 0;
    if (score > bestScore) bestScore = score;
    state = 'gameOver';
  }

  // render with screen shake
  ctx.save();
  if (screenShake > 0) {
    ctx.translate((Math.random() - 0.5) * screenShake * 3, (Math.random() - 0.5) * screenShake * 3);
  }
  drawBackground();
  drawFloaters(dt);
  // sort animals by depth (far first)
  animals.sort((a, b) => b.depth - a.depth);
  for (const a of animals) a.draw();
  for (const p of particles) p.draw();
  drawGun();
  ctx.restore();
  drawCrosshair();
  drawHUD();

  requestAnimationFrame(gameLoop);
}

// ======== INPUT ========
canvas.addEventListener('mousemove', e => {
  mouse.x = e.clientX * window.devicePixelRatio;
  mouse.y = e.clientY * window.devicePixelRatio;
});
canvas.addEventListener('mousedown', e => {
  if (e.button === 0) {
    if (state === 'menu') { startGame(); return; }
    if (state === 'gameOver') { startGame(); return; }
    shoot();
  }
  if (e.button === 2) { aiming = true; }
});
canvas.addEventListener('mouseup', e => {
  if (e.button === 2) { aiming = false; }
});
window.addEventListener('keydown', e => {
  if (e.key === 'r' || e.key === 'R') startReload();
});
canvas.addEventListener('contextmenu', e => e.preventDefault());

// ======== INIT ========
resize();
initFloaters();
requestAnimationFrame(gameLoop);
