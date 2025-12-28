const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlayTitle');
const overlayKicker = document.getElementById('overlayKicker');
const overlayList = document.getElementById('overlayList');
const startButton = document.getElementById('startButton');
const resetButton = document.getElementById('resetButton');
const scoreValue = document.getElementById('scoreValue');
const bestValue = document.getElementById('bestValue');
const coinValue = document.getElementById('coinValue');

const tileSize = 40;
const cols = Math.floor(canvas.width / tileSize);
const rows = Math.floor(canvas.height / tileSize);

const randomBetween = (min, max) => Math.random() * (max - min) + min;

const colors = {
  road: ['#2f323b', '#262932'],
  laneStripe: '#4f5464',
  grass: '#75d83a',
  riverTop: '#58c9ff',
  riverBottom: '#2e7bc5',
  log: '#b87942',
  car: ['#f5425d', '#3ecfff', '#ffd166', '#7c3aed'],
  player: '#ffffff',
  playerDetail: '#ff3b30',
  coin: '#ffd166',
  coinEdge: '#f59e0b',
  textShadow: 'rgba(0,0,0,0.4)',
};

const player = {
  px: (Math.floor(cols / 2) + 0.5) * tileSize,
  py: (rows - 1 + 0.5) * tileSize,
  size: tileSize * 0.6,
  maxRow: rows - 1,
  coins: 0,
};

let gameState = 'idle'; // idle, running, over
let level = 1;
let score = 0;
let best = 0;

let lanes = [];
let vehicles = [];
let logs = [];
let coins = [];
let spawnTimers = [];
let lastTimestamp = 0;

function resetPlayer() {
  player.px = (Math.floor(cols / 2) + 0.5) * tileSize;
  player.py = (rows - 1 + 0.5) * tileSize;
  player.maxRow = rows - 1;
}

function buildLanes() {
  const speedBoost = 1 + (level - 1) * 0.12;
  lanes = [
    { type: 'goal' },
    { type: 'river', direction: 1, speed: 1.2 * speedBoost },
    { type: 'river', direction: -1, speed: 1.35 * speedBoost },
    { type: 'grass' },
    { type: 'road', direction: 1, speed: 2.6 * speedBoost },
    { type: 'road', direction: -1, speed: 2.3 * speedBoost },
    { type: 'road', direction: 1, speed: 3 * speedBoost },
    { type: 'grass' },
    { type: 'river', direction: -1, speed: 1.65 * speedBoost },
    { type: 'road', direction: -1, speed: 2.9 * speedBoost },
    { type: 'grass' },
    { type: 'road', direction: 1, speed: 2.2 * speedBoost },
    { type: 'grass' },
    { type: 'road', direction: -1, speed: 2.5 * speedBoost },
    { type: 'start' },
  ];

  vehicles = [];
  logs = [];
  coins = [];
  spawnTimers = lanes.map(() => randomBetween(0.4, 1.4));
}

function regenerateCoins() {
  coins = [];
  lanes.forEach((lane, idx) => {
    if (lane.type === 'grass' || lane.type === 'start') {
      const numberHere = Math.random() < 0.6 ? 1 : 0;
      for (let i = 0; i < numberHere; i += 1) {
        coins.push({
          x: Math.floor(randomBetween(1, cols - 1)),
          y: idx,
          radius: tileSize * 0.25,
        });
      }
    }
  });
}

function spawnEntityForLane(laneIndex) {
  const lane = lanes[laneIndex];
  if (lane.type === 'road') {
    const width = tileSize * randomBetween(1.4, 1.9);
    const speed = lane.speed;
    const direction = lane.direction;
    const y = laneIndex * tileSize;
    const x = direction > 0 ? -width : canvas.width + width;
    vehicles.push({ x, y, width, height: tileSize * 0.8, speed, direction, laneIndex });
  }

  if (lane.type === 'river') {
    const width = tileSize * randomBetween(2.5, 3.5);
    const speed = lane.speed;
    const direction = lane.direction;
    const y = laneIndex * tileSize;
    const x = direction > 0 ? -width : canvas.width + width;
    logs.push({ x, y, width, height: tileSize * 0.75, speed, direction, laneIndex });
  }
}

function handleSpawning(dt) {
  lanes.forEach((lane, idx) => {
    if (lane.type === 'road' || lane.type === 'river') {
      spawnTimers[idx] -= dt;
      const minInterval = lane.type === 'road' ? 0.9 : 1.4;
      const maxInterval = lane.type === 'road' ? 1.7 : 2.3;
      if (spawnTimers[idx] <= 0) {
        spawnEntityForLane(idx);
        spawnTimers[idx] = randomBetween(minInterval, maxInterval);
      }
    }
  });
}

function updateEntities(dt) {
  const allVehicles = [];
  vehicles.forEach((vehicle) => {
    const dx = vehicle.speed * vehicle.direction * dt * tileSize;
    vehicle.x += dx;
    if (vehicle.x + vehicle.width > 0 && vehicle.x < canvas.width + vehicle.width) {
      allVehicles.push(vehicle);
    }
  });
  vehicles = allVehicles;

  const allLogs = [];
  logs.forEach((log) => {
    const dx = log.speed * log.direction * dt * tileSize;
    log.x += dx;
    if (log.x + log.width > -tileSize * 2 && log.x < canvas.width + tileSize * 2) {
      allLogs.push(log);
    }
  });
  logs = allLogs;
}

function movePlayer(dx, dy) {
  if (gameState !== 'running') return;
  const targetGridX = clamp(Math.floor(player.px / tileSize) + dx, 0, cols - 1);
  const targetGridY = clamp(Math.floor(player.py / tileSize) + dy, 0, rows - 1);
  player.px = (targetGridX + 0.5) * tileSize;
  player.py = (targetGridY + 0.5) * tileSize;

  if (targetGridY < player.maxRow) {
    player.maxRow = targetGridY;
    score += 10;
    updateScoreboard();
  }
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function circleRectCollision(circleX, circleY, radius, rect) {
  const closestX = clamp(circleX, rect.x, rect.x + rect.width);
  const closestY = clamp(circleY, rect.y, rect.y + rect.height);
  const dx = circleX - closestX;
  const dy = circleY - closestY;
  return dx * dx + dy * dy < radius * radius;
}

function detectCollisions(dt) {
  const gridX = Math.floor(player.px / tileSize);
  const gridY = Math.floor(player.py / tileSize);
  const lane = lanes[gridY];

  if (!lane) return;

  if (lane.type === 'road') {
    const hit = vehicles.some(
      (v) => v.laneIndex === gridY && circleRectCollision(player.px, player.py, player.size * 0.5, v),
    );
    if (hit) {
      endRun('Splatted by traffic!');
      return;
    }
  }

  if (lane.type === 'river') {
    let standingOnLog = null;
    logs.forEach((log) => {
      if (log.laneIndex === gridY && player.px > log.x && player.px < log.x + log.width) {
        standingOnLog = log;
      }
    });
    if (!standingOnLog) {
      endRun('You fell into the river!');
      return;
    }
    player.px += standingOnLog.speed * standingOnLog.direction * dt * tileSize;
    if (player.px < tileSize * 0.4 || player.px > canvas.width - tileSize * 0.4) {
      endRun('Drifted off the log!');
      return;
    }
  }

  if (lane.type === 'goal') {
    score += 100;
    level += 1;
    buildLanes();
    regenerateCoins();
    resetPlayer();
    updateScoreboard();
    flashOverlay('Level up!', 'Speed increases — stay sharp.', [
      'Traffic moves faster.',
      'Logs drift quicker.',
      'Coins respawn on safe tiles.',
    ]);
    hideOverlayAfterDelay(1400);
    return;
  }

  const remainingCoins = [];
  coins.forEach((coin) => {
    const coinWorld = { x: (coin.x + 0.5) * tileSize, y: (coin.y + 0.5) * tileSize };
    const hitCoin = circleRectCollision(player.px, player.py, player.size * 0.45, {
      x: coinWorld.x - coin.radius,
      y: coinWorld.y - coin.radius,
      width: coin.radius * 2,
      height: coin.radius * 2,
    });
    if (hitCoin) {
      score += 15;
      player.coins += 1;
      updateScoreboard();
    } else {
      remainingCoins.push(coin);
    }
  });
  coins = remainingCoins;
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

function drawBackground() {
  lanes.forEach((lane, idx) => {
    const y = idx * tileSize;
    if (lane.type === 'road') {
      const gradient = ctx.createLinearGradient(0, y, 0, y + tileSize);
      gradient.addColorStop(0, colors.road[0]);
      gradient.addColorStop(1, colors.road[1]);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, y, canvas.width, tileSize);

      ctx.strokeStyle = colors.laneStripe;
      ctx.lineWidth = 2;
      ctx.setLineDash([12, 12]);
      ctx.beginPath();
      ctx.moveTo(0, y + tileSize / 2);
      ctx.lineTo(canvas.width, y + tileSize / 2);
      ctx.stroke();
      ctx.setLineDash([]);
    } else if (lane.type === 'river') {
      const gradient = ctx.createLinearGradient(0, y, 0, y + tileSize);
      gradient.addColorStop(0, colors.riverTop);
      gradient.addColorStop(1, colors.riverBottom);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, y, canvas.width, tileSize);
    } else {
      ctx.fillStyle = colors.grass;
      ctx.fillRect(0, y, canvas.width, tileSize);
    }
  });
}

function drawVehicles() {
  vehicles.forEach((vehicle) => {
    ctx.fillStyle = colors.car[vehicle.laneIndex % colors.car.length];
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(vehicle.x, vehicle.y + tileSize * 0.1, vehicle.width, vehicle.height, 8);
    ctx.fill();
    ctx.stroke();
  });
}

function drawLogs() {
  logs.forEach((log) => {
    ctx.fillStyle = colors.log;
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(log.x, log.y + tileSize * 0.15, log.width, log.height, 6);
    ctx.fill();
    ctx.stroke();
  });
}

function drawCoins() {
  coins.forEach((coin) => {
    const x = (coin.x + 0.5) * tileSize;
    const y = (coin.y + 0.5) * tileSize;
    const r = coin.radius;
    ctx.beginPath();
    ctx.fillStyle = colors.coin;
    ctx.strokeStyle = colors.coinEdge;
    ctx.lineWidth = 3;
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.font = 'bold 10px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('C', x, y + 3);
  });
}

function drawPlayer() {
  const width = player.size;
  const height = player.size * 1.1;
  const x = player.px - width / 2;
  const y = player.py - height / 2;

  ctx.fillStyle = colors.player;
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, 6);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = colors.playerDetail;
  ctx.fillRect(x + width * 0.35, y - height * 0.05, width * 0.3, height * 0.3);
}

function drawHUD() {
  ctx.save();
  ctx.fillStyle = colors.textShadow;
  ctx.font = 'bold 16px "Press Start 2P", monospace';
  ctx.textAlign = 'left';
  ctx.fillText(`Level ${level}`, 18, 24);
  ctx.textAlign = 'right';
  ctx.fillText(`Row ${Math.max(0, rows - Math.floor(player.py / tileSize) - 1)}`, canvas.width - 18, 24);
  ctx.restore();
}

function draw() {
  drawBackground();
  drawLogs();
  drawVehicles();
  drawCoins();
  drawPlayer();
  drawHUD();
}

function tick(timestamp) {
  const dt = Math.min((timestamp - lastTimestamp) / 1000, 0.05);
  lastTimestamp = timestamp;
  if (gameState === 'running') {
    handleSpawning(dt);
    updateEntities(dt);
    detectCollisions(dt);
  }
  draw();
  requestAnimationFrame(tick);
}

function startRun() {
  score = 0;
  player.coins = 0;
  level = 1;
  resetPlayer();
  buildLanes();
  regenerateCoins();
  updateScoreboard();
  gameState = 'running';
  overlay.classList.add('hidden');
}

function resetBest() {
  best = 0;
  score = 0;
  player.coins = 0;
  level = 1;
  resetPlayer();
  buildLanes();
  regenerateCoins();
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
regenerateCoins();
updateScoreboard();
handleKeys();
requestAnimationFrame((ts) => {
  lastTimestamp = ts;
  requestAnimationFrame(tick);
});
