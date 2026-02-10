// ======== ORMAN AVCISI 3D — Three.js FPS Game ========
// --- CONFIG ---
const CFG = {
    ammoMax: 15, reloadTime: 1.8, playerMaxHP: 100,
    baseSpawnInterval: 1.8, comboTimeout: 2.0,
    fieldW: 60, fieldD: 80, treeCount: 80,
    normalFOV: 70, adsFOV: 40,
};

// --- STATE ---
let state = 'menu';
let score = 0, combo = 0, comboTimer = 0, bestScore = 0;
let hp = CFG.playerMaxHP, ammo = CFG.ammoMax, reloading = false, reloadTimer = 0;
let wave = 1, waveTimer = 0, spawnTimer = 0, toSpawn = 0;
let screenShake = 0, muzzleFlash = 0, gunRecoil = 0;
let aiming = false, adsLerp = 0;
let clock, enemies = [], flashLights = [];
let mouse = { x: 0, y: 0, nx: 0, ny: 0 };
// FPS camera control
let yaw = 0, pitch = 0;
const MOUSE_SENS = 0.002;
let pointerLocked = false;

// --- THREE.JS SETUP ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x050510);
scene.fog = new THREE.FogExp2(0x0a1510, 0.008);

const camera = new THREE.PerspectiveCamera(CFG.normalFOV, window.innerWidth / window.innerHeight, 0.1, 200);
camera.position.set(0, 2.5, 0);
camera.lookAt(0, 2.5, -10);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.4;
document.body.insertBefore(renderer.domElement, document.body.firstChild);
renderer.domElement.style.position = 'fixed';
renderer.domElement.style.top = '0';
renderer.domElement.style.left = '0';
renderer.domElement.style.cursor = 'none';

// HUD
const hudCanvas = document.getElementById('hudCanvas');
const hud = hudCanvas.getContext('2d');
let HW, HH;
function resizeHUD() {
    HW = hudCanvas.width = window.innerWidth * window.devicePixelRatio;
    HH = hudCanvas.height = window.innerHeight * window.devicePixelRatio;
    hudCanvas.style.width = window.innerWidth + 'px';
    hudCanvas.style.height = window.innerHeight + 'px';
}

// --- RESIZE ---
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    resizeHUD();
});
resizeHUD();

// --- LIGHTING ---
const ambientLight = new THREE.AmbientLight(0x4466aa, 0.8);
scene.add(ambientLight);

const moonLight = new THREE.DirectionalLight(0x8899cc, 1.0);
moonLight.position.set(20, 30, -15);
moonLight.castShadow = true;
moonLight.shadow.mapSize.set(1024, 1024);
moonLight.shadow.camera.left = -40; moonLight.shadow.camera.right = 40;
moonLight.shadow.camera.top = 40; moonLight.shadow.camera.bottom = -40;
scene.add(moonLight);

const moonGlow = new THREE.PointLight(0xaabbdd, 0.5, 100);
moonGlow.position.set(20, 25, -30);
scene.add(moonGlow);

// Muzzle flash light
const flashLight = new THREE.PointLight(0xff8800, 0, 15);
flashLight.position.set(0, 2.2, -1.5);
scene.add(flashLight);

// === GUN ILLUMINATION LIGHT (attached to camera) ===
const gunLight = new THREE.PointLight(0xffeedd, 1.5, 3);
gunLight.position.set(0.2, -0.1, -0.3);
camera.add(gunLight);

// Secondary fill light for gun
const gunFill = new THREE.DirectionalLight(0xaabbcc, 0.6);
gunFill.position.set(-1, 1, 0.5);
camera.add(gunFill);

// --- GROUND ---
const groundGeo = new THREE.PlaneGeometry(200, 200, 20, 20);
const groundMat = new THREE.MeshStandardMaterial({
    color: 0x1a2a0c, roughness: 0.95, metalness: 0,
});
const ground = new THREE.Mesh(groundGeo, groundMat);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// Ground detail - dark patches
for (let i = 0; i < 40; i++) {
    const s = 1 + Math.random() * 4;
    const patch = new THREE.Mesh(
        new THREE.CircleGeometry(s, 8),
        new THREE.MeshStandardMaterial({ color: 0x0d1a06, roughness: 1 })
    );
    patch.rotation.x = -Math.PI / 2;
    patch.position.set((Math.random() - 0.5) * 80, 0.01, (Math.random() - 0.5) * 80);
    scene.add(patch);
}

// --- MOON ---
const moonSphere = new THREE.Mesh(
    new THREE.SphereGeometry(3, 16, 16),
    new THREE.MeshBasicMaterial({ color: 0xfffde0 })
);
moonSphere.position.set(30, 35, -60);
scene.add(moonSphere);

// --- TREES ---
function createTree(x, z) {
    const group = new THREE.Group();
    const h = 6 + Math.random() * 8;
    const r = 0.15 + Math.random() * 0.15;
    // trunk
    const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(r * 0.7, r, h * 0.4, 6),
        new THREE.MeshStandardMaterial({ color: 0x2a1a0a, roughness: 0.9 })
    );
    trunk.position.y = h * 0.2;
    trunk.castShadow = true;
    group.add(trunk);
    // foliage layers
    const fColors = [0x0a1f0a, 0x0d2b0d, 0x103010];
    for (let i = 0; i < 3; i++) {
        const cr = (2 + Math.random()) * (1 - i * 0.2);
        const ch = h * (0.3 - i * 0.05);
        const cone = new THREE.Mesh(
            new THREE.ConeGeometry(cr, ch, 7),
            new THREE.MeshStandardMaterial({ color: fColors[i], roughness: 0.8 })
        );
        cone.position.y = h * (0.35 + i * 0.18);
        cone.castShadow = true;
        group.add(cone);
    }
    group.position.set(x, 0, z);
    return group;
}
// Place trees around the field edges
for (let i = 0; i < CFG.treeCount; i++) {
    const angle = (i / CFG.treeCount) * Math.PI * 2;
    const dist = 25 + Math.random() * 20;
    const x = Math.cos(angle) * dist + (Math.random() - 0.5) * 8;
    const z = Math.sin(angle) * dist + (Math.random() - 0.5) * 8;
    scene.add(createTree(x, z));
}
// Dense back forest
for (let i = 0; i < 60; i++) {
    const x = (Math.random() - 0.5) * 100;
    const z = -30 - Math.random() * 40;
    scene.add(createTree(x, z));
}
// Side trees closer
for (let i = 0; i < 30; i++) {
    const side = Math.random() > 0.5 ? 1 : -1;
    const x = side * (15 + Math.random() * 25);
    const z = (Math.random() - 0.5) * 50;
    scene.add(createTree(x, z));
}

// --- STARS (particles) ---
const starGeo = new THREE.BufferGeometry();
const starPos = [];
for (let i = 0; i < 500; i++) {
    starPos.push((Math.random() - 0.5) * 200, 30 + Math.random() * 40, (Math.random() - 0.5) * 200);
}
starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.15, transparent: true, opacity: 0.7 });
scene.add(new THREE.Points(starGeo, starMat));

// --- GUN MODEL ---
const gunGroup = new THREE.Group();
function buildGun() {
    const mat = {
        metal: new THREE.MeshStandardMaterial({ color: 0x555560, roughness: 0.35, metalness: 0.8, emissive: 0x111118, emissiveIntensity: 0.3 }),
        metalD: new THREE.MeshStandardMaterial({ color: 0x3a3a42, roughness: 0.25, metalness: 0.85, emissive: 0x0a0a10, emissiveIntensity: 0.2 }),
        grip: new THREE.MeshStandardMaterial({ color: 0x6a4828, roughness: 0.7, metalness: 0, emissive: 0x1a1208, emissiveIntensity: 0.15 }),
        sight: new THREE.MeshStandardMaterial({ color: 0x00ff44, emissive: 0x00ff44, emissiveIntensity: 3, roughness: 0.2 }),
        skin: new THREE.MeshStandardMaterial({ color: 0xd4a27a, roughness: 0.5, metalness: 0, emissive: 0x3a2a1a, emissiveIntensity: 0.15 }),
    };
    // Barrel
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.025, 0.35, 8), mat.metalD);
    barrel.rotation.x = Math.PI / 2; barrel.position.set(0, 0, -0.3);
    gunGroup.add(barrel);
    // Slide
    const slide = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.05, 0.32), mat.metal);
    slide.position.set(0, 0.01, -0.12);
    gunGroup.add(slide);
    // Slide serrations
    for (let i = 0; i < 5; i++) {
        const s = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.005, 0.003), mat.metalD);
        s.position.set(0, 0.01, -0.02 + i * 0.03);
        gunGroup.add(s);
    }
    // Frame
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.04, 0.2), mat.metal);
    frame.position.set(0, -0.03, -0.06);
    gunGroup.add(frame);
    // Trigger guard
    const tgGeo = new THREE.TorusGeometry(0.02, 0.004, 6, 8, Math.PI);
    const tg = new THREE.Mesh(tgGeo, mat.metal);
    tg.position.set(0, -0.05, -0.04); tg.rotation.x = Math.PI;
    gunGroup.add(tg);
    // Trigger
    const trigger = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.025, 0.004), mat.metalD);
    trigger.position.set(0, -0.045, -0.04);
    gunGroup.add(trigger);
    // Grip
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.12, 0.06), mat.grip);
    grip.position.set(0, -0.11, 0.0); grip.rotation.x = 0.15;
    gunGroup.add(grip);
    // Grip texture lines
    for (let i = 0; i < 6; i++) {
        const line = new THREE.Mesh(new THREE.BoxGeometry(0.056, 0.002, 0.061), new THREE.MeshStandardMaterial({ color: 0x4a2a10, roughness: 1 }));
        line.position.set(0, -0.07 + i * 0.015, 0.0); line.rotation.x = 0.15;
        gunGroup.add(line);
    }
    // Front sight
    const fSight = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.012, 0.008), mat.metal);
    fSight.position.set(0, 0.04, -0.28);
    gunGroup.add(fSight);
    // Front sight dot
    const fDot = new THREE.Mesh(new THREE.SphereGeometry(0.004, 6, 6), mat.sight);
    fDot.position.set(0, 0.048, -0.28);
    gunGroup.add(fDot);
    // Rear sights
    const rS1 = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.01, 0.008), mat.metal);
    rS1.position.set(-0.015, 0.04, 0.02); gunGroup.add(rS1);
    const rS2 = rS1.clone(); rS2.position.x = 0.015; gunGroup.add(rS2);
    // Hand
    const hand = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 0.1), mat.skin);
    hand.position.set(0, -0.15, 0.02); hand.rotation.x = 0.2;
    gunGroup.add(hand);
    // Fingers
    for (let i = 0; i < 4; i++) {
        const finger = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.009, 0.06, 5), mat.skin);
        finger.position.set(-0.025 + i * 0.017, -0.14, -0.03);
        finger.rotation.z = 0.1; finger.rotation.x = 0.8;
        gunGroup.add(finger);
    }
    // Thumb
    const thumb = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.01, 0.05, 5), mat.skin);
    thumb.position.set(0.04, -0.1, 0.01); thumb.rotation.z = -0.5;
    gunGroup.add(thumb);
    // Muzzle flash mesh (hidden by default)
    const flashGeo = new THREE.SphereGeometry(0.08, 8, 8);
    const flashMat = new THREE.MeshBasicMaterial({ color: 0xffaa00, transparent: true, opacity: 0 });
    const flashMesh = new THREE.Mesh(flashGeo, flashMat);
    flashMesh.position.set(0, 0, -0.48);
    flashMesh.name = 'flash';
    gunGroup.add(flashMesh);
    // Flash spikes
    for (let i = 0; i < 6; i++) {
        const spike = new THREE.Mesh(
            new THREE.ConeGeometry(0.015, 0.12, 4),
            new THREE.MeshBasicMaterial({ color: 0xffcc00, transparent: true, opacity: 0 })
        );
        const a = (i / 6) * Math.PI * 2;
        spike.position.set(Math.cos(a) * 0.03, Math.sin(a) * 0.03, -0.5);
        spike.rotation.x = Math.PI / 2 + Math.sin(a) * 0.3;
        spike.rotation.z = a;
        spike.name = 'spike';
        gunGroup.add(spike);
    }
}
buildGun();
// Gun positioning
const gunPivot = new THREE.Group();
gunPivot.add(gunGroup);
camera.add(gunPivot);
scene.add(camera);

// Hip and ADS positions — gun is big and prominent
const GUN_HIP = new THREE.Vector3(0.32, -0.2, -0.38);
const GUN_ADS = new THREE.Vector3(0.0, -0.13, -0.3);
gunGroup.scale.setScalar(1.6);
gunGroup.position.copy(GUN_HIP);

// --- AUDIO ---
let audioCtx;
function initAudio() { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); }
function playSound(type) {
    if (!audioCtx) return;
    const now = audioCtx.currentTime;
    if (type === 'shoot') {
        const buf = audioCtx.createBuffer(1, audioCtx.sampleRate * 0.18, audioCtx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 2.5);
        const src = audioCtx.createBufferSource(); src.buffer = buf;
        const flt = audioCtx.createBiquadFilter(); flt.type = 'lowpass'; flt.frequency.setValueAtTime(4000, now); flt.frequency.exponentialRampToValueAtTime(200, now + 0.18);
        const g = audioCtx.createGain(); g.gain.setValueAtTime(0.7, now); g.gain.exponentialRampToValueAtTime(0.01, now + 0.18);
        src.connect(flt); flt.connect(g); g.connect(audioCtx.destination); src.start(now);
    } else if (type === 'hit') {
        const o = audioCtx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(900, now); o.frequency.exponentialRampToValueAtTime(200, now + 0.08);
        const g = audioCtx.createGain(); g.gain.setValueAtTime(0.3, now); g.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
        o.connect(g); g.connect(audioCtx.destination); o.start(now); o.stop(now + 0.08);
    } else if (type === 'reload') {
        const o = audioCtx.createOscillator(); o.type = 'square'; o.frequency.setValueAtTime(600, now); o.frequency.setValueAtTime(900, now + 0.05);
        const g = audioCtx.createGain(); g.gain.setValueAtTime(0.15, now); g.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        o.connect(g); g.connect(audioCtx.destination); o.start(now); o.stop(now + 0.1);
    } else if (type === 'death') {
        const o = audioCtx.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(400, now); o.frequency.exponentialRampToValueAtTime(50, now + 0.35);
        const g = audioCtx.createGain(); g.gain.setValueAtTime(0.25, now); g.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
        o.connect(g); g.connect(audioCtx.destination); o.start(now); o.stop(now + 0.35);
    } else if (type === 'empty') {
        const o = audioCtx.createOscillator(); o.type = 'triangle'; o.frequency.setValueAtTime(200, now);
        const g = audioCtx.createGain(); g.gain.setValueAtTime(0.2, now); g.gain.exponentialRampToValueAtTime(0.01, now + 0.06);
        o.connect(g); g.connect(audioCtx.destination); o.start(now); o.stop(now + 0.06);
    }
}

// --- ENEMY (3D Animal) ---
const ENEMY_TYPES = {
    wolf: { name: 'Kurt', bodyColor: 0x4a4a55, eyeColor: 0xffee00, speed: 5, hp: 2, pts: 200, scale: 1.1, earType: 'pointed' },
    wolfAlpha: { name: 'Alfa Kurt', bodyColor: 0x2a2a35, eyeColor: 0xff3300, speed: 3.5, hp: 4, pts: 400, scale: 1.4, earType: 'pointed' },
    dog: { name: 'Kuduz Köpek', bodyColor: 0x8a6530, eyeColor: 0xff4444, speed: 6.5, hp: 1, pts: 100, scale: 0.85, earType: 'floppy' },
    dogBig: { name: 'Kuduz Köpek', bodyColor: 0x6a4520, eyeColor: 0xff2200, speed: 5, hp: 2, pts: 180, scale: 1.05, earType: 'floppy' },
};

function createEnemy(type) {
    const cfg = ENEMY_TYPES[type];
    const g = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color: cfg.bodyColor, roughness: 0.6, emissive: cfg.bodyColor, emissiveIntensity: 0.15 });
    const darkMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(cfg.bodyColor).multiplyScalar(0.6), roughness: 0.7, emissive: cfg.bodyColor, emissiveIntensity: 0.1 });
    const eyeMat = new THREE.MeshBasicMaterial({ color: cfg.eyeColor });
    // Collect all materials for fast flash/death effects (no traverse needed)
    const allMats = [bodyMat, darkMat];
    // Body (CylinderGeometry used for r128 compatibility)
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.22, 0.8, 8), bodyMat);
    body.rotation.z = Math.PI / 2; body.position.set(0, 0.5, 0);
    g.add(body);
    // Head
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 6), bodyMat);
    head.position.set(0.55, 0.55, 0); head.scale.set(1.2, 0.9, 0.9);
    g.add(head);
    // Snout
    const snout = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.09, 0.2, 6), bodyMat);
    snout.rotation.z = -Math.PI / 2; snout.position.set(0.72, 0.5, 0);
    g.add(snout);
    // Nose
    const noseMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 4), noseMat);
    nose.position.set(0.82, 0.52, 0);
    g.add(nose); allMats.push(noseMat);
    // Eyes — large glowing spheres (NO PointLight, much cheaper)
    const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 4), eyeMat);
    eyeL.position.set(0.6, 0.62, 0.12); g.add(eyeL);
    const eyeR = eyeL.clone(); eyeR.position.z = -0.12; g.add(eyeR);
    // Ears
    if (cfg.earType === 'pointed') {
        const ear = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.15, 4), darkMat);
        ear.position.set(0.45, 0.78, 0.1); g.add(ear);
        const ear2 = ear.clone(); ear2.position.z = -0.1; g.add(ear2);
    } else {
        const ear = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.04, 0.08), darkMat);
        ear.position.set(0.42, 0.65, 0.16); ear.rotation.z = 0.5; g.add(ear);
        const ear2 = ear.clone(); ear2.position.z = -0.16; ear2.rotation.z = 0.5; g.add(ear2);
    }
    // Teeth
    const toothMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const t1 = new THREE.Mesh(new THREE.ConeGeometry(0.012, 0.04, 3), toothMat);
    t1.position.set(0.78, 0.44, 0.03); t1.rotation.x = Math.PI; g.add(t1);
    const t2 = t1.clone(); t2.position.z = -0.03; g.add(t2);
    // Legs (4)
    const legs = [];
    const legPositions = [[0.25, 0, 0.15], [0.25, 0, -0.15], [-0.25, 0, 0.15], [-0.25, 0, -0.15]];
    legPositions.forEach(([lx, ly, lz]) => {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.035, 0.4, 5), darkMat);
        leg.position.set(lx, 0.2, lz); g.add(leg);
        legs.push(leg);
    });
    // Tail
    const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.035, 0.3, 4), darkMat);
    tail.position.set(-0.5, 0.55, 0); tail.rotation.z = 0.8; g.add(tail);
    // Foam for rabid dogs
    const foamBalls = [];
    if (type === 'dog' || type === 'dogBig') {
        for (let i = 0; i < 4; i++) {
            const foam = new THREE.Mesh(
                new THREE.SphereGeometry(0.015, 4, 4),
                new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 })
            );
            foam.position.set(0.8 + Math.random() * 0.05, 0.42 - Math.random() * 0.06, (Math.random() - 0.5) * 0.08);
            g.add(foam); foamBalls.push(foam);
        }
    }
    g.scale.setScalar(cfg.scale);
    scene.add(g);

    // Spawn at visible distance
    const spawnX = (Math.random() - 0.5) * 20;
    const spawnZ = -(18 + Math.random() * 12);
    g.position.set(spawnX, 0, spawnZ);
    g.lookAt(0, 0, 5);

    return {
        group: g, type, cfg, currentHP: cfg.hp, dead: false, deathTimer: 0,
        flash: 0, legs, foamBalls, legPhase: Math.random() * Math.PI * 2,
        zigzagPhase: Math.random() * Math.PI * 2,
        allMats, // stored for fast access
        origEmissiveIntensities: allMats.map(m => m.emissiveIntensity),
    };
}

const _whiteColor = new THREE.Color(0xffffff);
function updateEnemy(e, dt) {
    if (e.dead) {
        e.deathTimer += dt;
        e.group.position.y -= dt * 2;
        // Fade out using stored materials (no traverse!)
        const fadeOpacity = Math.max(0, 1 - e.deathTimer / 0.6);
        e.allMats.forEach(m => { m.transparent = true; m.opacity = fadeOpacity; });
        if (e.deathTimer > 0.6) { scene.remove(e.group); return false; }
        return true;
    }
    const speed = e.cfg.speed * (1 + wave * 0.06);
    e.group.position.z += speed * dt;
    // Zigzag for wolves
    if (e.cfg.earType === 'pointed') {
        e.zigzagPhase += dt * 3;
        e.group.position.x += Math.sin(e.zigzagPhase) * dt * 2;
    }
    e.group.lookAt(camera.position.x, 0, camera.position.z);
    // Leg animation
    e.legPhase += dt * speed * 3;
    for (let i = 0; i < e.legs.length; i++) {
        const off = i < 2 ? 0 : Math.PI;
        e.legs[i].rotation.x = Math.sin(e.legPhase + off + (i % 2) * Math.PI) * 0.4;
    }
    // Foam animation
    for (let i = 0; i < e.foamBalls.length; i++) {
        e.foamBalls[i].position.y = 0.42 - Math.abs(Math.sin(e.legPhase * 2 + i)) * 0.04;
    }
    // Flash effect (hit feedback) — use stored mats, no traverse!
    if (e.flash > 0) {
        e.flash -= dt * 5;
        for (let i = 0; i < e.allMats.length; i++) {
            e.allMats[i].emissive.copy(_whiteColor);
            e.allMats[i].emissiveIntensity = e.flash * 0.5;
        }
    } else if (e.flash <= 0 && e.flash > -1) {
        // Reset emissive once after flash ends
        for (let i = 0; i < e.allMats.length; i++) {
            e.allMats[i].emissiveIntensity = e.origEmissiveIntensities[i];
        }
        e.flash = -1; // mark as reset
    }
    // Reached player?
    if (e.group.position.z > -1) {
        hp -= 15 + wave * 2;
        screenShake = 0.5;
        e.dead = true;
        playSound('hit');
    }
    return true;
}

// --- RAYCASTER ---
const raycaster = new THREE.Raycaster();
raycaster.far = 100;

function shoot() {
    if (state !== 'playing' || reloading) return;
    if (ammo <= 0) { playSound('empty'); return; }
    ammo--;
    playSound('shoot');
    muzzleFlash = 1;
    gunRecoil = 1;
    screenShake = 0.15;
    flashLight.intensity = 5;
    // Show muzzle flash meshes
    gunGroup.traverse(c => {
        if (c.name === 'flash' || c.name === 'spike') { c.material.opacity = 1; }
    });
    // Raycast from screen center
    raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
    const targets = enemies.filter(e => !e.dead).map(e => e.group);
    const allMeshes = [];
    targets.forEach(g => g.traverse(c => { if (c.isMesh) allMeshes.push(c); }));
    const hits = raycaster.intersectObjects(allMeshes);
    if (hits.length > 0) {
        // Find which enemy was hit
        const hitObj = hits[0].object;
        for (const e of enemies) {
            if (e.dead) continue;
            let found = false;
            e.group.traverse(c => { if (c === hitObj) found = true; });
            if (found) {
                e.currentHP--;
                e.flash = 1;
                playSound('hit');
                if (e.currentHP <= 0) {
                    e.dead = true;
                    playSound('death');
                    combo++;
                    comboTimer = CFG.comboTimeout;
                    score += e.cfg.pts * combo;
                }
                break;
            }
        }
    }
    if (ammo <= 0) startReload();
}

function startReload() {
    if (reloading || ammo === CFG.ammoMax) return;
    reloading = true; reloadTimer = CFG.reloadTime;
    playSound('reload');
}

// --- GAME LOGIC ---
function startGame() {
    if (!audioCtx) initAudio();
    score = 0; combo = 0; comboTimer = 0;
    hp = CFG.playerMaxHP; ammo = CFG.ammoMax;
    reloading = false; reloadTimer = 0;
    wave = 1; enemies.forEach(e => scene.remove(e.group)); enemies = [];
    screenShake = 0; muzzleFlash = 0; gunRecoil = 0;
    state = 'waveIntro'; waveTimer = 2.5;
}

function startWave() {
    toSpawn = 4 + wave * 3;
    spawnTimer = 0.5;
    state = 'playing';
}

function spawnEnemy() {
    const types = ['dog', 'dog', 'wolf'];
    if (wave >= 2) types.push('wolf', 'dogBig');
    if (wave >= 3) types.push('wolfAlpha', 'dog');
    if (wave >= 5) types.push('wolfAlpha', 'wolfAlpha');
    enemies.push(createEnemy(types[Math.floor(Math.random() * types.length)]));
}

// --- HUD DRAWING ---
function drawHUD() {
    hud.clearRect(0, 0, HW, HH);
    const s = HW / 1200;
    const pad = 25 * s;

    if (state === 'menu') { drawMenuHUD(s, pad); return; }
    if (state === 'gameOver') { drawGameOverHUD(s, pad); return; }
    if (state === 'waveIntro') { drawWaveIntroHUD(s, pad); }

    // Crosshair
    const cx = HW / 2, cy = HH / 2;
    const hovering = false;
    const color = hovering ? '#ff3030' : '#00ff88';
    const r = (18 - adsLerp * 10) * s, gap = (6 - adsLerp * 3) * s, lineLen = (12 - adsLerp * 6) * s;
    hud.strokeStyle = color; hud.lineWidth = (2 - adsLerp * 0.5) * s;
    hud.shadowColor = color; hud.shadowBlur = 4 * s;
    if (adsLerp < 0.8) { hud.beginPath(); hud.arc(cx, cy, r, 0, Math.PI * 2); hud.stroke(); }
    hud.beginPath();
    hud.moveTo(cx - r - lineLen, cy); hud.lineTo(cx - gap, cy);
    hud.moveTo(cx + gap, cy); hud.lineTo(cx + r + lineLen, cy);
    hud.moveTo(cx, cy - r - lineLen); hud.lineTo(cx, cy - gap);
    hud.moveTo(cx, cy + gap); hud.lineTo(cx, cy + r + lineLen);
    hud.stroke();
    hud.fillStyle = color; hud.beginPath(); hud.arc(cx, cy, (adsLerp > 0.5 ? 1.5 : 2.5) * s, 0, Math.PI * 2); hud.fill();
    hud.shadowBlur = 0;

    // ADS vignette
    if (adsLerp > 0.1) {
        hud.save(); hud.globalAlpha = adsLerp * 0.5;
        const grad = hud.createRadialGradient(HW / 2, HH / 2, HW * 0.2, HW / 2, HH / 2, HW * 0.55);
        grad.addColorStop(0, 'transparent'); grad.addColorStop(1, '#000');
        hud.fillStyle = grad; hud.fillRect(0, 0, HW, HH);
        hud.restore();
    }

    if (state !== 'playing' && state !== 'waveIntro') return;

    // Score
    hud.textAlign = 'right'; hud.font = `bold ${28 * s}px Orbitron, monospace`;
    hud.fillStyle = '#ffcc00'; hud.shadowColor = '#ffcc00'; hud.shadowBlur = 10;
    hud.fillText(`SKOR: ${score}`, HW - pad, pad + 28 * s);
    hud.shadowBlur = 0;
    hud.font = `${14 * s}px Inter, sans-serif`; hud.fillStyle = '#888';
    hud.fillText(`EN İYİ: ${bestScore}`, HW - pad, pad + 50 * s);
    if (combo > 1) {
        hud.font = `bold ${22 * s}px Orbitron`; hud.fillStyle = `hsl(${30 + combo * 15},100%,60%)`;
        hud.shadowColor = hud.fillStyle; hud.shadowBlur = 8;
        hud.fillText(`x${combo} COMBO!`, HW - pad, pad + 78 * s);
        hud.shadowBlur = 0;
    }
    // Wave
    hud.textAlign = 'center'; hud.font = `bold ${20 * s}px Orbitron`; hud.fillStyle = '#88ccff';
    hud.fillText(`DALGA ${wave}`, HW / 2, pad + 22 * s);
    // HP bar
    hud.textAlign = 'left';
    const hpW = 220 * s, hpH = 18 * s, hpX = pad, hpY = HH - pad - hpH;
    hud.fillStyle = 'rgba(0,0,0,0.5)'; hud.fillRect(hpX - 2, hpY - 2, hpW + 4, hpH + 4);
    const pct = Math.max(0, hp / CFG.playerMaxHP);
    hud.fillStyle = pct > 0.5 ? '#00cc44' : pct > 0.25 ? '#ffaa00' : '#ff2020';
    hud.fillRect(hpX, hpY, hpW * pct, hpH);
    hud.strokeStyle = '#555'; hud.lineWidth = 1; hud.strokeRect(hpX - 2, hpY - 2, hpW + 4, hpH + 4);
    hud.font = `bold ${14 * s}px Inter`; hud.fillStyle = '#fff';
    hud.fillText(`❤️ ${Math.ceil(hp)}`, hpX + 5, hpY + hpH - 3);
    // Ammo
    hud.textAlign = 'right';
    const ammoY = HH - pad;
    hud.font = `bold ${22 * s}px Orbitron`;
    if (reloading) {
        hud.fillStyle = '#ffaa00';
        hud.fillText(`SARJÖR... ${Math.floor((1 - reloadTimer / CFG.reloadTime) * 100)}%`, HW - pad, ammoY);
    } else {
        hud.fillStyle = ammo > 3 ? '#fff' : '#ff4444';
        let bar = ''; for (let i = 0; i < CFG.ammoMax; i++) bar += i < ammo ? '|' : '·';
        hud.fillText(`${ammo}/${CFG.ammoMax}  ${bar}`, HW - pad, ammoY);
    }
    hud.font = `${12 * s}px Inter`; hud.fillStyle = '#888';
    hud.fillText('[R] Şarjör Değiştir  •  Sağ Tık: Nişan', HW - pad, ammoY - 26 * s);

    // hit flash
    if (muzzleFlash > 0.5) {
        hud.save(); hud.globalAlpha = (muzzleFlash - 0.5) * 0.15;
        hud.fillStyle = '#ffcc88'; hud.fillRect(0, 0, HW, HH);
        hud.restore();
    }
    // damage flash
    if (hp < CFG.playerMaxHP * 0.3 && hp > 0) {
        const pulse = Math.sin(Date.now() * 0.006) * 0.15 + 0.1;
        hud.save(); hud.globalAlpha = pulse;
        const dg = hud.createRadialGradient(HW / 2, HH / 2, HW * 0.3, HW / 2, HH / 2, HW * 0.55);
        dg.addColorStop(0, 'transparent'); dg.addColorStop(1, '#ff0000');
        hud.fillStyle = dg; hud.fillRect(0, 0, HW, HH);
        hud.restore();
    }
}

function drawMenuHUD(s, pad) {
    hud.fillStyle = 'rgba(0,0,0,0.5)'; hud.fillRect(0, 0, HW, HH);
    hud.textAlign = 'center';
    hud.font = `900 ${64 * s}px Orbitron`; hud.fillStyle = '#ff6600';
    hud.shadowColor = '#ff4400'; hud.shadowBlur = 30;
    hud.fillText('ORMAN AVCISI', HW / 2, HH * 0.3);
    hud.shadowBlur = 0;
    hud.font = `${22 * s}px Inter`; hud.fillStyle = '#88ccaa';
    hud.fillText('🌲 Forest Hunter 3D 🌲', HW / 2, HH * 0.37);
    hud.font = `bold ${20 * s}px Inter`; hud.fillStyle = '#fff';
    hud.fillText('🖱️  Sol Tık: Ateş et   •   Sağ Tık: Nişan Al (Zoom)', HW / 2, HH * 0.52);
    hud.fillText('[R] Şarjör değiştir', HW / 2, HH * 0.57);
    const pulse = Math.sin(Date.now() * 0.004) * 0.3 + 0.7;
    hud.globalAlpha = pulse;
    hud.font = `bold ${28 * s}px Orbitron`; hud.fillStyle = '#ffcc00';
    hud.fillText('BAŞLAMAK İÇİN TIKLA', HW / 2, HH * 0.75);
    hud.globalAlpha = 1;
}

function drawWaveIntroHUD(s, pad) {
    hud.fillStyle = 'rgba(0,0,0,0.35)'; hud.fillRect(0, 0, HW, HH);
    const a = Math.min(1, (2.5 - waveTimer) * 2);
    hud.globalAlpha = a;
    hud.textAlign = 'center'; hud.font = `900 ${56 * s}px Orbitron`;
    hud.fillStyle = '#ffcc00'; hud.shadowColor = '#ffaa00'; hud.shadowBlur = 20;
    hud.fillText(`DALGA ${wave}`, HW / 2, HH * 0.45);
    hud.shadowBlur = 0;
    hud.font = `${20 * s}px Inter`; hud.fillStyle = '#aaa';
    hud.fillText(`${4 + wave * 3} düşman yaklaşıyor...`, HW / 2, HH * 0.53);
    hud.globalAlpha = 1;
}

function drawGameOverHUD(s, pad) {
    hud.fillStyle = 'rgba(10,0,0,0.7)'; hud.fillRect(0, 0, HW, HH);
    hud.textAlign = 'center';
    hud.font = `900 ${54 * s}px Orbitron`; hud.fillStyle = '#ff2020';
    hud.shadowColor = '#ff0000'; hud.shadowBlur = 25;
    hud.fillText('OYUN BİTTİ', HW / 2, HH * 0.33);
    hud.shadowBlur = 0;
    hud.font = `bold ${30 * s}px Orbitron`; hud.fillStyle = '#ffcc00';
    hud.fillText(`SKOR: ${score}`, HW / 2, HH * 0.45);
    if (score >= bestScore) {
        hud.font = `${20 * s}px Inter`; hud.fillStyle = '#ff8800';
        hud.fillText('🏆 YENİ REKOR! 🏆', HW / 2, HH * 0.52);
    }
    hud.font = `${18 * s}px Inter`; hud.fillStyle = '#aaa';
    hud.fillText(`Ulaşılan Dalga: ${wave}`, HW / 2, HH * 0.59);
    const pulse = Math.sin(Date.now() * 0.004) * 0.3 + 0.7;
    hud.globalAlpha = pulse;
    hud.font = `bold ${24 * s}px Orbitron`; hud.fillStyle = '#ffcc00';
    hud.fillText('TEKRAR OYNAMAK İÇİN TIKLA', HW / 2, HH * 0.75);
    hud.globalAlpha = 1;
}

// --- MAIN LOOP ---
clock = new THREE.Clock();
function gameLoop() {
    requestAnimationFrame(gameLoop);
    try {
        const dt = Math.min(clock.getDelta(), 0.05);

        // ADS lerp
        const adsTarget = aiming ? 1 : 0;
        adsLerp += (adsTarget - adsLerp) * Math.min(1, dt * 8);
        camera.fov = CFG.normalFOV + (CFG.adsFOV - CFG.normalFOV) * adsLerp;
        camera.updateProjectionMatrix();

        // Gun position lerp
        gunGroup.position.lerpVectors(GUN_HIP, GUN_ADS, adsLerp);

        // Gun recoil & effects
        if (gunRecoil > 0) {
            gunGroup.rotation.x = -gunRecoil * 0.15;
            gunRecoil -= dt * 5;
            if (gunRecoil < 0) gunRecoil = 0;
        } else {
            gunGroup.rotation.x *= 0.9;
        }

        // Muzzle flash decay
        if (muzzleFlash > 0) {
            muzzleFlash -= dt * 8;
            flashLight.intensity = muzzleFlash * 5;
            gunGroup.traverse(c => {
                if (c.name === 'flash') c.material.opacity = muzzleFlash;
                if (c.name === 'spike') c.material.opacity = muzzleFlash * 0.8;
            });
            if (muzzleFlash <= 0) { muzzleFlash = 0; flashLight.intensity = 0; }
        }

        // Screen shake
        if (screenShake > 0) {
            camera.position.x = (Math.random() - 0.5) * screenShake * 0.3;
            camera.position.y = 2.5 + (Math.random() - 0.5) * screenShake * 0.2;
            screenShake -= dt * 3;
            if (screenShake < 0) { screenShake = 0; camera.position.set(0, 2.5, 0); }
        }

        // Gun sway (gentle idle bob)
        const t = Date.now() * 0.001;
        gunGroup.position.x += Math.sin(t * 1.2) * 0.0002;
        gunGroup.position.y += Math.sin(t * 1.8) * 0.00015;

        if (state === 'waveIntro') {
            waveTimer -= dt;
            if (waveTimer <= 0) startWave();
        }

        if (state === 'playing') {
            // Reload
            if (reloading) { reloadTimer -= dt; if (reloadTimer <= 0) { reloading = false; ammo = CFG.ammoMax; playSound('reload'); } }
            // Combo
            if (comboTimer > 0) { comboTimer -= dt; if (comboTimer <= 0) combo = 0; }
            // Spawn
            spawnTimer -= dt;
            if (spawnTimer <= 0 && toSpawn > 0) { spawnEnemy(); toSpawn--; spawnTimer = Math.max(0.4, CFG.baseSpawnInterval - wave * 0.1); }
            // Update enemies
            enemies = enemies.filter(e => updateEnemy(e, dt));
            // Check wave complete
            if (toSpawn <= 0 && enemies.length === 0) { wave++; state = 'waveIntro'; waveTimer = 2.5; }
            // Check game over
            if (hp <= 0) { hp = 0; if (score > bestScore) bestScore = score; state = 'gameOver'; }
        }

        renderer.render(scene, camera);
        drawHUD();
    } catch (err) { console.error('GameLoop error:', err); }
}

// --- INPUT (Pointer Lock FPS Controls) ---
function requestPointerLock() {
    renderer.domElement.requestPointerLock();
}

document.addEventListener('pointerlockchange', () => {
    pointerLocked = !!document.pointerLockElement;
});

document.addEventListener('mousemove', e => {
    mouse.x = e.clientX; mouse.y = e.clientY;
    mouse.nx = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.ny = -(e.clientY / window.innerHeight) * 2 + 1;
    // FPS camera look (only when pointer is locked)
    if (pointerLocked && (state === 'playing' || state === 'waveIntro')) {
        yaw -= e.movementX * MOUSE_SENS;
        pitch -= e.movementY * MOUSE_SENS;
        // Clamp pitch to prevent flipping
        pitch = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, pitch));
        // Apply to camera
        camera.rotation.order = 'YXZ';
        camera.rotation.y = yaw;
        camera.rotation.x = pitch;
    }
});

document.addEventListener('mousedown', e => {
    if (e.button === 0) {
        if (state === 'menu' || state === 'gameOver') {
            startGame();
            requestPointerLock();
            return;
        }
        if (!pointerLocked) { requestPointerLock(); return; }
        shoot();
    }
    if (e.button === 2) aiming = true;
});
document.addEventListener('mouseup', e => {
    if (e.button === 2) aiming = false;
});
document.addEventListener('keydown', e => {
    if (e.key === 'r' || e.key === 'R') startReload();
    // Press Escape to release pointer lock (handled by browser)
});
document.addEventListener('contextmenu', e => e.preventDefault());

// --- START ---
gameLoop();
