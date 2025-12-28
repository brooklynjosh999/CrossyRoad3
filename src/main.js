import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.159.0/build/three.module.js';

const canvas = document.getElementById('gameCanvas');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlayTitle');
const overlayKicker = document.getElementById('overlayKicker');
const overlayList = document.getElementById('overlayList');
const startButton = document.getElementById('startButton');
const resetButton = document.getElementById('resetButton');
const scoreValue = document.getElementById('scoreValue');
const bestValue = document.getElementById('bestValue');
const coinValue = document.getElementById('coinValue');

const tile = 6;
const cols = 11;
const lanesVisible = 15;
const halfWidth = (cols * tile) / 2;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87c7ff);

const camera = new THREE.PerspectiveCamera(48, canvas.width / canvas.height, 0.1, 500);
camera.position.set(0, 60, 64);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(canvas.width, canvas.height, false);
renderer.shadowMap.enabled = true;

const ambient = new THREE.AmbientLight(0xffffff, 0.65);
scene.add(ambient);
const sun = new THREE.DirectionalLight(0xffffff, 0.75);
sun.position.set(40, 80, 30);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
scene.add(sun);

const laneGroup = new THREE.Group();
scene.add(laneGroup);

const vehicleGroup = new THREE.Group();
scene.add(vehicleGroup);

const logGroup = new THREE.Group();
scene.add(logGroup);

const coinGroup = new THREE.Group();
scene.add(coinGroup);

const colors = {
  grass: 0x7bcf3a,
  road: 0x2f323b,
  roadStripe: 0xdadada,
  river: 0x3095ff,
  start: 0x9be579,
  goal: 0xf2f5f7,
  car: [0xf5425d, 0x3ecfff, 0xffd166, 0x9b6bff],
  log: 0xa5673b,
  coin: 0xffd166,
  coinEdge: 0xf59e0b,
  player: 0xffffff,
  beak: 0xff3b30,
};

let lanes = [];
let spawnTimers = [];
let vehicles = [];
let logs = [];
let coins = [];
let level = 1;
let score = 0;
let best = 0;
let lastTime = 0;
let gameState = 'idle'; // idle | running | over

const player = createPlayer();
resetPlayerPosition();
scene.add(player.mesh);

const laneTemplates = () => [
  { type: 'goal' },
  { type: 'river', direction: 1, speed: 1.25 },
  { type: 'river', direction: -1, speed: 1.45 },
  { type: 'grass' },
  { type: 'road', direction: 1, speed: 2.5 },
  { type: 'road', direction: -1, speed: 2.2 },
  { type: 'road', direction: 1, speed: 2.8 },
  { type: 'grass' },
  { type: 'river', direction: -1, speed: 1.7 },
  { type: 'road', direction: -1, speed: 2.9 },
  { type: 'grass' },
  { type: 'road', direction: 1, speed: 2.1 },
  { type: 'grass' },
  { type: 'road', direction: -1, speed: 2.4 },
  { type: 'start' },
];

function resetPlayerPosition() {
  player.col = Math.floor(cols / 2);
  player.lane = laneTemplates().length - 1;
  player.maxProgress = player.lane;
  player.worldX = toWorldX(player.col);
  player.worldZ = toWorldZ(player.lane);
  player.mesh.position.set(player.worldX, player.height / 2, player.worldZ);
}

function createPlayer() {
  const bodyGeo = new THREE.BoxGeometry(tile * 0.6, tile * 0.9, tile * 0.6);
  const bodyMat = new THREE.MeshStandardMaterial({ color: colors.player });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.castShadow = true;
  body.position.y = (tile * 0.9) / 2;

  const beakGeo = new THREE.BoxGeometry(tile * 0.2, tile * 0.2, tile * 0.4);
  const beakMat = new THREE.MeshStandardMaterial({ color: colors.beak });
  const beak = new THREE.Mesh(beakGeo, beakMat);
  beak.position.set(0, body.position.y, bodyGeo.parameters.depth / 2 + beakGeo.parameters.depth / 2);
  beak.castShadow = true;

  const group = new THREE.Group();
  group.add(body);
  group.add(beak);

  return {
    mesh: group,
    col: 0,
    lane: 0,
    maxProgress: 0,
    height: tile * 0.9,
    radius: tile * 0.35,
    coins: 0,
    worldX: 0,
    worldZ: 0,
  };
}

function toWorldX(col) {
  return (col - (cols / 2 - 0.5)) * tile;
}

function toWorldZ(laneIndex) {
  return (laneTemplates().length - 1 - laneIndex) * tile;
}

function randomBetween(min, max) {
  return Math.random() * (max - min) + min;
}

function buildLanes() {
  laneGroup.clear();
  lanes = laneTemplates().map((lane) => {
    const speedBoost = 1 + (level - 1) * 0.14;
    const data = { ...lane };
    if (data.speed) data.speed *= speedBoost;
    return data;
  });

  lanes.forEach((lane, idx) => {
    const isRoad = lane.type === 'road';
    const isRiver = lane.type === 'river';
    const baseColor =
      lane.type === 'start'
        ? colors.start
        : lane.type === 'goal'
        ? colors.goal
        : lane.type === 'grass'
        ? colors.grass
        : isRoad
        ? colors.road
        : colors.river;

    const geo = new THREE.BoxGeometry(cols * tile + tile, tile * 0.25, tile);
    const mat = new THREE.MeshStandardMaterial({ color: baseColor, roughness: 0.9, metalness: 0.05 });
    const base = new THREE.Mesh(geo, mat);
    base.receiveShadow = true;
    base.position.set(0, -geo.parameters.height / 2, toWorldZ(idx));
    laneGroup.add(base);

    if (isRoad) {
      const stripeGeo = new THREE.BoxGeometry(cols * tile + tile, 0.05, 0.4);
      const stripeMat = new THREE.MeshStandardMaterial({ color: colors.roadStripe });
      const stripe = new THREE.Mesh(stripeGeo, stripeMat);
      stripe.position.set(0, 0, base.position.z);
      laneGroup.add(stripe);
    }

    if (lane.type === 'goal') {
      const textGeo = new THREE.BoxGeometry(cols * tile + tile, 0.02, 0.2);
      const textMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
      const stripe = new THREE.Mesh(textGeo, textMat);
      stripe.position.set(0, 0, base.position.z);
      laneGroup.add(stripe);
    }
  });

  spawnTimers = lanes.map(() => randomBetween(0.4, 1.3));
  vehicles = [];
  logs = [];
  coins = [];
  vehicleGroup.clear();
  logGroup.clear();
  coinGroup.clear();
  spawnCoins();
}

function spawnCoins() {
  coinGroup.clear();
  coins = [];
  lanes.forEach((lane, idx) => {
    if (lane.type === 'grass' || lane.type === 'start') {
      if (Math.random() < 0.6) {
        const col = Math.floor(randomBetween(1, cols - 1));
        const coin = createCoin(col, idx);
        coins.push(coin);
        coinGroup.add(coin.mesh);
      }
    }
  });
}

function createCoin(col, lane) {
  const geo = new THREE.CylinderGeometry(tile * 0.22, tile * 0.22, tile * 0.1, 20);
  const mat = new THREE.MeshStandardMaterial({ color: colors.coin, emissive: 0xffb703, emissiveIntensity: 0.2 });
  const mesh = new THREE.Mesh(geo, mat);
  const edgeMat = new THREE.MeshStandardMaterial({ color: colors.coinEdge });
  const edge = new THREE.Mesh(new THREE.TorusGeometry(tile * 0.22, tile * 0.05, 8, 20), edgeMat);
  mesh.add(edge);
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  mesh.position.set(toWorldX(col), geo.parameters.height / 2, toWorldZ(lane));
  return { col, lane, mesh };
}

function spawnEntityForLane(laneIndex) {
  const lane = lanes[laneIndex];
  if (!lane) return;
  if (lane.type === 'road') {
    const length = tile * randomBetween(1.4, 2.2);
    const height = tile * 0.7;
    const geo = new THREE.BoxGeometry(length, height, tile * 0.8);
    const mat = new THREE.MeshStandardMaterial({ color: colors.car[laneIndex % colors.car.length], metalness: 0.05 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    const dir = lane.direction;
    const xStart = dir > 0 ? -halfWidth - length : halfWidth + length;
    const zPos = toWorldZ(laneIndex);
    mesh.position.set(xStart, height / 2, zPos);
    vehicleGroup.add(mesh);
    vehicles.push({ mesh, dir, speed: lane.speed, length, laneIndex });
  }

  if (lane.type === 'river') {
    const length = tile * randomBetween(2.6, 3.8);
    const height = tile * 0.5;
    const geo = new THREE.BoxGeometry(length, height, tile * 0.7);
    const mat = new THREE.MeshStandardMaterial({ color: colors.log, roughness: 1 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    const dir = lane.direction;
    const xStart = dir > 0 ? -halfWidth - length : halfWidth + length;
    const zPos = toWorldZ(laneIndex);
    mesh.position.set(xStart, height / 2, zPos);
    logGroup.add(mesh);
    logs.push({ mesh, dir, speed: lane.speed, length, laneIndex });
  }
}

function handleSpawning(dt) {
  lanes.forEach((lane, idx) => {
    if (lane.type === 'road' || lane.type === 'river') {
      spawnTimers[idx] -= dt;
      const minInterval = lane.type === 'road' ? 0.9 : 1.6;
      const maxInterval = lane.type === 'road' ? 1.7 : 2.5;
      if (spawnTimers[idx] <= 0) {
        spawnEntityForLane(idx);
        spawnTimers[idx] = randomBetween(minInterval, maxInterval);
      }
    }
  });
}

function updateEntities(dt) {
  const activeVehicles = [];
  vehicles.forEach((vehicle) => {
    vehicle.mesh.position.x += vehicle.speed * vehicle.dir * dt * tile;
    if (Math.abs(vehicle.mesh.position.x) < halfWidth + vehicle.length * 2) {
      activeVehicles.push(vehicle);
    } else {
      vehicleGroup.remove(vehicle.mesh);
    }
  });
  vehicles = activeVehicles;

  const activeLogs = [];
  logs.forEach((log) => {
    log.mesh.position.x += log.speed * log.dir * dt * tile;
    if (Math.abs(log.mesh.position.x) < halfWidth + log.length * 2) {
      activeLogs.push(log);
    } else {
      logGroup.remove(log.mesh);
    }
  });
  logs = activeLogs;
}

function movePlayer(dx, dz) {
  if (gameState !== 'running') return;
  const targetCol = THREE.MathUtils.clamp(player.col + dx, 0, cols - 1);
  const targetLane = THREE.MathUtils.clamp(player.lane + dz, 0, lanes.length - 1);
  player.col = targetCol;
  player.lane = targetLane;
  player.worldX = toWorldX(player.col);
  player.worldZ = toWorldZ(player.lane);
  player.mesh.position.set(player.worldX, player.height / 2, player.worldZ);

  if (targetLane < player.maxProgress) {
    player.maxProgress = targetLane;
    score += 10;
    updateScoreboard();
  }
}

function detectCollisions(dt) {
  const lane = lanes[player.lane];
  if (!lane) return;

  if (lane.type === 'road') {
    const hit = vehicles.some((vehicle) => {
      if (vehicle.laneIndex !== player.lane) return false;
      return boxAndSphereIntersect(vehicle.mesh, player.radius);
    });
    if (hit) {
      endRun('Splatted by traffic!');
      return;
    }
  }

  if (lane.type === 'river') {
    let onLog = null;
    logs.forEach((log) => {
      if (log.laneIndex !== player.lane) return;
      if (boxAndSphereIntersect(log.mesh, player.radius)) {
        onLog = log;
      }
    });
    if (!onLog) {
      endRun('You fell into the water!');
      return;
    }
    player.worldX += onLog.speed * onLog.dir * dt * tile;
    if (Math.abs(player.worldX) > halfWidth + tile * 0.3) {
      endRun('Drifted off the log!');
      return;
    }
    player.col = Math.round(player.worldX / tile + cols / 2 - 0.5);
    player.col = THREE.MathUtils.clamp(player.col, 0, cols - 1);
    player.mesh.position.x = player.worldX;
  }

  if (lane.type === 'goal') {
    score += 120;
    level += 1;
    buildLanes();
    spawnCoins();
    resetPlayerPosition();
    updateScoreboard();
    flashOverlay('Level up!', 'World speeds up—watch traffic.', [
      'Cars drive faster.',
      'Logs drift quicker.',
      'Coins respawn on grass and start.',
    ]);
    hideOverlayAfterDelay(1400);
    return;
  }

  const remainingCoins = [];
  coins.forEach((coin) => {
    const distance = player.mesh.position.distanceTo(coin.mesh.position);
    if (distance < tile * 0.6) {
      score += 15;
      player.coins += 1;
      coinGroup.remove(coin.mesh);
      updateScoreboard();
    } else {
      remainingCoins.push(coin);
    }
  });
  coins = remainingCoins;
}

function boxAndSphereIntersect(boxMesh, radius) {
  const box = new THREE.Box3().setFromObject(boxMesh);
  const closestPoint = box.clampPoint(player.mesh.position, new THREE.Vector3());
  const distanceSq = closestPoint.distanceToSquared(player.mesh.position);
  return distanceSq < radius * radius;
}

function endRun(reason) {
  gameState = 'over';
  best = Math.max(best, score);
  updateScoreboard();
  flashOverlay('Run over.', reason, ['Press start to try again.', `Level reached: ${level}`]);
}

function hideOverlayAfterDelay(ms) {
  setTimeout(() => {
    overlay.classList.add('hidden');
  }, ms);
}

function flashOverlay(title, kicker, bullets) {
  overlayTitle.textContent = title;
  overlayKicker.textContent = kicker;
  overlayList.innerHTML = '';
  bullets.forEach((text) => {
    const li = document.createElement('li');
    li.innerText = text;
    overlayList.appendChild(li);
  });
  overlay.classList.remove('hidden');
}

function updateScoreboard() {
  scoreValue.textContent = score.toString();
  bestValue.textContent = best.toString();
  coinValue.textContent = player.coins.toString();
}

function tick(timestamp) {
  const dt = Math.min((timestamp - lastTime) / 1000, 0.05);
  lastTime = timestamp;
  if (gameState === 'running') {
    handleSpawning(dt);
    updateEntities(dt);
    detectCollisions(dt);
    player.mesh.rotation.y = Math.sin(timestamp * 0.001) * 0.08;
  }
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}

function startRun() {
  score = 0;
  player.coins = 0;
  level = 1;
  resetPlayerPosition();
  buildLanes();
  spawnCoins();
  updateScoreboard();
  gameState = 'running';
  overlay.classList.add('hidden');
}

function resetBest() {
  best = 0;
  score = 0;
  player.coins = 0;
  level = 1;
  resetPlayerPosition();
  buildLanes();
  spawnCoins();
  updateScoreboard();
}

function handleKeys() {
  const actions = new Map([
    ['ArrowUp', () => movePlayer(0, -1)],
    ['KeyW', () => movePlayer(0, -1)],
    ['ArrowDown', () => movePlayer(0, 1)],
    ['KeyS', () => movePlayer(0, 1)],
    ['ArrowLeft', () => movePlayer(-1, 0)],
    ['KeyA', () => movePlayer(-1, 0)],
    ['ArrowRight', () => movePlayer(1, 0)],
    ['KeyD', () => movePlayer(1, 0)],
  ]);

  window.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    const action = actions.get(event.code);
    if (action) {
      action();
      event.preventDefault();
    }
  });
}

startButton.addEventListener('click', () => {
  startRun();
});

resetButton.addEventListener('click', () => {
  resetBest();
  flashOverlay('Score reset', 'Best score cleared.', [
    'Start a new run to set a record.',
    'Coins and level go back to zero.',
  ]);
});

buildLanes();
spawnCoins();
updateScoreboard();
handleKeys();
requestAnimationFrame((ts) => {
  lastTime = ts;
  requestAnimationFrame(tick);
});
