(() => {
  "use strict";

  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d");
  const overlay = document.getElementById("overlay");
  const startButton = document.getElementById("startButton");
  const panelKicker = document.getElementById("panelKicker");
  const panelTitle = document.getElementById("panelTitle");
  const panelCopy = document.getElementById("panelCopy");
  const scoreElement = document.getElementById("score");
  const distanceElement = document.getElementById("distance");
  const healthElement = document.getElementById("health");
  const distanceLabel = distanceElement.previousElementSibling;
  const modeButtons = document.getElementById("modeButtons");
  const multiButton = document.getElementById("multiButton");
  const mpPanel = document.getElementById("mpPanel");
  const createRoomButton = document.getElementById("createRoomButton");
  const joinCodeInput = document.getElementById("joinCodeInput");
  const joinRoomButton = document.getElementById("joinRoomButton");
  const mpStatus = document.getElementById("mpStatus");
  const mpBackButton = document.getElementById("mpBackButton");

  const WIDTH = canvas.width;
  const HEIGHT = canvas.height;
  const keys = new Set();
  const clouds = [];
  const obstacles = [];
  const bullets = [];
  const enemyBullets = [];
  const particles = [];
  const shockwaves = [];
  const scorePopups = [];
  const streaks = [];

  const BULLET_SPEED = 900;
  const BULLET_COOLDOWN = 0.12;
  const BULLET_SCORE = 100;
  const ENEMY_BULLET_SPEED = 330;

  let state = "menu";
  let score = 0;
  let distance = 0;
  let health = 3;
  let elapsed = 0;
  let spawnTimer = 0;
  let lastTime = 0;
  let screenShake = 0;
  let pointerActive = false;
  let rightMouseDown = false;
  let fireCooldown = 0;
  let muzzleFlash = 0;
  let combo = 0;
  let comboTimer = 0;

  let gameMode = "single";
  let mqttClients = [];
  let conn = null;
  let isHost = false;
  let netTimer = 0;
  let roomCode = "";
  let heartbeatTimer = null;
  let handshakeTimer = null;
  let connectTimeout = null;
  let lastReceivedAt = 0;
  let round = 0;
  let mySid = "";
  let sendSeq = 0;
  const seenKeys = new Set();
  const seenOrder = [];
  const remote = { x: 0, y: 0, targetX: 0, targetY: 0, tilt: 0, health: 3, active: false };

  const STAGES = [
    {
      name: "Daybreak",
      at: 0,
      top: [23, 111, 168],
      mid: [86, 184, 221],
      bottom: [183, 230, 237],
      horizon: [24, 84, 121],
      celestial: "sun",
      cloudDim: 1,
      difficulty: 1,
    },
    {
      name: "Sunset Squadron",
      at: 2,
      top: [74, 32, 92],
      mid: [217, 106, 78],
      bottom: [247, 200, 115],
      horizon: [58, 30, 58],
      celestial: "sun-low",
      cloudDim: 0.8,
      difficulty: 1.25,
    },
    {
      name: "Night Raid",
      at: 4,
      top: [4, 18, 43],
      mid: [13, 43, 78],
      bottom: [32, 72, 110],
      horizon: [8, 22, 42],
      celestial: "moon",
      stars: true,
      cloudDim: 0.4,
      difficulty: 1.5,
    },
    {
      name: "Storm Front",
      at: 6.5,
      top: [20, 28, 38],
      mid: [55, 72, 90],
      bottom: [92, 112, 128],
      horizon: [16, 24, 34],
      rain: true,
      lightning: true,
      cloudDim: 0.75,
      difficulty: 1.75,
    },
    {
      name: "Deep Space",
      at: 9,
      top: [2, 3, 15],
      mid: [10, 13, 42],
      bottom: [22, 27, 66],
      horizon: [8, 10, 30],
      stars: true,
      space: true,
      cloudDim: 0,
      difficulty: 2.05,
    },
    {
      name: "Manhattan Run",
      at: 11.5,
      top: [6, 10, 28],
      mid: [22, 26, 56],
      bottom: [46, 42, 74],
      horizon: [10, 12, 30],
      celestial: "moon",
      stars: true,
      city: true,
      cloudDim: 0.18,
      difficulty: 2.4,
    },
  ];

  const stars = [];
  const powerups = [];
  const skylineFar = [];
  const skylineNear = [];
  const SKYLINE_TILE = 2200;
  let cityScroll = 0;
  let stageIndex = 0;
  let stageBanner = { text: "", sub: "", life: 0, maxLife: 2.4 };
  let lightningTimer = 4;
  let lightningFlash = 0;
  let shieldTime = 0;
  let tripleTime = 0;
  let powerupTimer = 9;
  let boss = null;
  let bossDelay = 0;

  const POWERUP_TYPES = ["shield", "triple", "repair"];

  function stageIndexForDistance(travelled) {
    let index = 0;
    for (let i = 0; i < STAGES.length; i += 1) {
      if (travelled >= STAGES[i].at) index = i;
    }
    return index;
  }

  function stageDifficulty() {
    if (gameMode === "versus") return 1;
    return STAGES[stageIndexForDistance(distance)].difficulty;
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function lerpColor(from, to, t) {
    return [Math.round(lerp(from[0], to[0], t)), Math.round(lerp(from[1], to[1], t)), Math.round(lerp(from[2], to[2], t))];
  }

  function css(color, alpha = 1) {
    return `rgba(${color[0]},${color[1]},${color[2]},${alpha})`;
  }

  function blendedPalette() {
    const travelled = gameMode === "versus" ? 0 : distance;
    const index = stageIndexForDistance(travelled);
    const stage = STAGES[index];
    if (index === 0) {
      return {
        index,
        top: stage.top,
        mid: stage.mid,
        bottom: stage.bottom,
        horizon: stage.horizon,
        celestial: stage.celestial,
        cloudDim: stage.cloudDim,
        starsAlpha: 0,
        rainAlpha: 0,
        spaceAlpha: 0,
        cityAlpha: 0,
        lightning: false,
      };
    }
    const previous = STAGES[index - 1];
    const t = Math.min(1, (travelled - stage.at) / 0.35);
    return {
      index,
      top: lerpColor(previous.top, stage.top, t),
      mid: lerpColor(previous.mid, stage.mid, t),
      bottom: lerpColor(previous.bottom, stage.bottom, t),
      horizon: lerpColor(previous.horizon, stage.horizon, t),
      celestial: t < 0.5 ? previous.celestial : stage.celestial,
      cloudDim: lerp(previous.cloudDim, stage.cloudDim, t),
      starsAlpha: (previous.stars ? 1 - t : 0) + (stage.stars ? t : 0),
      rainAlpha: (previous.rain ? 1 - t : 0) + (stage.rain ? t : 0),
      spaceAlpha: (previous.space ? 1 - t : 0) + (stage.space ? t : 0),
      cityAlpha: (previous.city ? 1 - t : 0) + (stage.city ? t : 0),
      lightning: stage.lightning && t > 0.4,
    };
  }

  function announceStage(index) {
    const stage = STAGES[index];
    stageBanner = { text: `Stage ${index + 1}`, sub: stage.name, life: 2.4, maxLife: 2.4 };
    updateStageLabel();
    if (index >= 1 && gameMode === "single") bossDelay = 2.6;
  }

  function spawnPowerup(x, y, forcedType) {
    powerups.push({
      type: forcedType || POWERUP_TYPES[Math.floor(Math.random() * POWERUP_TYPES.length)],
      x: x === undefined ? WIDTH + 30 : x,
      y: y === undefined ? random(130, HEIGHT - 110) : y,
      phase: random(0, Math.PI * 2),
    });
  }

  function applyPowerup(powerup) {
    if (powerup.type === "shield") {
      shieldTime = 7;
      scorePopups.push({ x: player.x, y: player.y - 40, text: "SHIELD", life: 0.9, maxLife: 0.9 });
    } else if (powerup.type === "triple") {
      tripleTime = 8;
      scorePopups.push({ x: player.x, y: player.y - 40, text: "TRIPLE SHOT", life: 0.9, maxLife: 0.9 });
    } else {
      health = Math.min(3, health + 1);
      updateHealth();
      scorePopups.push({ x: player.x, y: player.y - 40, text: "REPAIRED", life: 0.9, maxLife: 0.9 });
    }
    burst(powerup.x, powerup.y, powerup.type === "repair" ? "#7dffa8" : "#59e6ff", 16, 0.6);
  }

  function spawnBoss() {
    const difficulty = stageDifficulty();
    boss = {
      x: WIDTH + 160,
      y: HEIGHT / 2,
      targetX: WIDTH - 190,
      width: 118,
      height: 52,
      health: 7 + stageIndex * 3,
      maxHealth: 7 + stageIndex * 3,
      phase: random(0, Math.PI * 2),
      fireTimer: 1.4,
      entering: true,
      difficulty,
    };
    stageBanner = { text: "Warning", sub: "Stage guardian inbound", life: 2, maxLife: 2 };
  }

  function bossFireSpread() {
    const aimX = player.x - (boss.x - 46);
    const aimY = player.y - boss.y;
    const baseAngle = Math.atan2(aimY, aimX);
    const speed = 275 + stageIndex * 22;
    for (const offset of [-0.24, 0, 0.24]) {
      const angle = baseAngle + offset;
      enemyBullets.push({
        x: boss.x - 46,
        y: boss.y,
        previousX: boss.x - 46,
        previousY: boss.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        width: 12,
        height: 8,
        life: 5,
      });
    }
    burst(boss.x - 48, boss.y, "#ff6f5d", 6, 0.25);
  }

  function killBoss() {
    const points = 800 + stageIndex * 400;
    score += points;
    screenShake = 12;
    burst(boss.x, boss.y, "#ffb44a", 42, 1.1);
    burst(boss.x - 30, boss.y + 14, "#f1655f", 30, 0.9);
    shockwaves.push({ x: boss.x, y: boss.y, radius: 14, life: 0.6, maxLife: 0.6, color: "#ffd97a" });
    scorePopups.push({ x: boss.x, y: boss.y - 40, text: `BOSS DOWN +${points}`, life: 1.2, maxLife: 1.2 });
    spawnPowerup(boss.x, boss.y, "repair");
    boss = null;
  }

  function updateBoss(dt) {
    if (boss.entering) {
      boss.x += (boss.targetX - boss.x) * Math.min(1, dt * 2.4);
      if (boss.x - boss.targetX < 8) boss.entering = false;
      return;
    }

    boss.phase += dt;
    boss.y = HEIGHT / 2 + Math.sin(boss.phase * 0.9) * 150;
    boss.x = boss.targetX + Math.sin(boss.phase * 0.5) * 36;

    boss.fireTimer -= dt;
    if (boss.fireTimer <= 0) {
      bossFireSpread();
      boss.fireTimer = Math.max(1.05, 2.2 - stageIndex * 0.15);
    }

    if (player.invulnerable <= 0 && boxesOverlap(player, boss, 10)) {
      damagePlayer(player.x + 20, player.y);
    }
  }

  function updateStageLabel() {
    if (gameMode === "versus") return;
    const stage = STAGES[stageIndex];
    distanceLabel.textContent = `Stage ${stageIndex + 1} · ${stage.name}`;
  }

  function localFacing() {
    return gameMode === "versus" && !isHost ? -1 : 1;
  }

  const player = {
    x: 180,
    y: HEIGHT / 2,
    width: 72,
    height: 34,
    vx: 0,
    vy: 0,
    invulnerable: 0,
    tilt: 0,
  };

  function random(min, max) {
    return min + Math.random() * (max - min);
  }

  function initializeSky() {
    clouds.length = 0;
    streaks.length = 0;
    stars.length = 0;

    for (let i = 0; i < 12; i += 1) {
      clouds.push({
        x: random(0, WIDTH),
        y: random(65, HEIGHT - 110),
        size: random(28, 75),
        speed: random(8, 24),
        alpha: random(0.12, 0.38),
      });
    }

    for (let i = 0; i < 16; i += 1) {
      streaks.push({
        x: random(0, WIDTH),
        y: random(0, HEIGHT),
        length: random(15, 70),
        speed: random(100, 180),
      });
    }

    for (let i = 0; i < 70; i += 1) {
      stars.push({
        x: random(0, WIDTH),
        y: random(0, HEIGHT - 60),
        size: random(0.6, 2.2),
        twinkle: random(0, Math.PI * 2),
      });
    }

    skylineFar.length = 0;
    skylineNear.length = 0;
    let cursor = 0;
    while (cursor < SKYLINE_TILE) {
      const width = random(46, 92);
      skylineFar.push({ x: cursor, width, height: random(70, 190), seed: Math.random() });
      cursor += width + random(4, 20);
    }
    cursor = 0;
    while (cursor < SKYLINE_TILE) {
      const width = random(60, 120);
      skylineNear.push({
        x: cursor,
        width,
        height: random(90, 240),
        seed: Math.random(),
        spire: Math.random() < 0.22,
      });
      cursor += width + random(10, 34);
    }
  }

  function updateHealth() {
    healthElement.innerHTML = "";
    for (let i = 0; i < 3; i += 1) {
      const pip = document.createElement("i");
      if (i >= health) pip.className = "lost";
      healthElement.appendChild(pip);
    }
    healthElement.setAttribute("aria-label", `${health} hull point${health === 1 ? "" : "s"}`);
  }

  function updateHud() {
    scoreElement.textContent = Math.floor(score).toString().padStart(5, "0");
    if (gameMode === "versus") return;
    distanceElement.textContent = `${distance.toFixed(1)} km`;
  }

  function updateRivalHud() {
    const remaining = Math.max(0, Math.min(3, remote.health));
    distanceLabel.textContent = "Rival hull";
    distanceElement.textContent = "●".repeat(remaining) + "○".repeat(3 - remaining);
  }

  function resetGame() {
    score = 0;
    distance = 0;
    health = 3;
    elapsed = 0;
    spawnTimer = 0.8;
    screenShake = 0;
    fireCooldown = 0;
    muzzleFlash = 0;
    combo = 0;
    comboTimer = 0;
    stageIndex = 0;
    stageBanner.life = 0;
    lightningTimer = 4;
    lightningFlash = 0;
    shieldTime = 0;
    tripleTime = 0;
    powerupTimer = 9;
    boss = null;
    bossDelay = 0;
    powerups.length = 0;
    rightMouseDown = false;
    obstacles.length = 0;
    bullets.length = 0;
    enemyBullets.length = 0;
    particles.length = 0;
    shockwaves.length = 0;
    scorePopups.length = 0;
    player.x = 180;
    player.y = HEIGHT / 2;
    player.vx = 0;
    player.vy = 0;
    player.invulnerable = 0;
    player.tilt = 0;
    updateHealth();
    updateHud();
  }

  function fireBullet() {
    if (state !== "playing" || fireCooldown > 0) return;

    const facing = localFacing();
    const spawnX = player.x + 42 * facing;
    const verticalSpeeds = tripleTime > 0 && gameMode === "single" ? [-140, 0, 140] : [0];
    for (const vy of verticalSpeeds) {
      bullets.push({
        x: spawnX,
        previousX: spawnX,
        y: player.y,
        width: 24,
        height: 7,
        speed: BULLET_SPEED * facing,
        vy,
      });
    }
    fireCooldown = BULLET_COOLDOWN;
    muzzleFlash = 0.08;
    burst(player.x + 47 * facing, player.y, "#ffe08a", 7, 0.24);
    sendMessage({ t: "fire", x: spawnX, y: player.y, v: BULLET_SPEED * facing });
  }

  // Debug/preview helper: open the page with ?km=9 to start that far in.
  const START_KM = Math.max(0, parseFloat(new URLSearchParams(window.location.search).get("km")) || 0);

  function startGame() {
    destroyNetwork();
    gameMode = "single";
    resetGame();
    if (START_KM > 0) {
      distance = START_KM;
      stageIndex = stageIndexForDistance(distance);
    }
    updateStageLabel();
    state = "playing";
    overlay.classList.add("hidden");
    lastTime = performance.now();
  }

  function readBestScore() {
    try {
      return Number(window.localStorage.getItem("skyace-best")) || 0;
    } catch {
      return 0;
    }
  }

  function saveBestScore(value) {
    try {
      window.localStorage.setItem("skyace-best", String(value));
    } catch {
      /* storage unavailable (private mode) */
    }
  }

  function showGameOver() {
    state = "gameover";
    panelKicker.textContent = `Flight distance · ${distance.toFixed(1)} km · Stage ${stageIndex + 1} — ${STAGES[stageIndex].name}`;
    panelTitle.textContent = "Mayday!";
    const finalScore = Math.floor(score);
    const best = readBestScore();
    if (finalScore > best) {
      saveBestScore(finalScore);
      panelCopy.textContent = `Final score: ${finalScore.toLocaleString()} — new personal best! The squadron is ready when you are.`;
    } else {
      panelCopy.textContent = `Final score: ${finalScore.toLocaleString()}. Personal best: ${best.toLocaleString()}. The squadron is ready when you are.`;
    }
    startButton.innerHTML = "Fly again <span>→</span>";
    multiButton.classList.remove("is-hidden");
    mpPanel.classList.add("is-hidden");
    modeButtons.classList.remove("is-hidden");
    overlay.classList.remove("hidden");
  }

  function endVersus(won, kicker) {
    state = "gameover";
    remote.active = true;
    panelKicker.textContent = kicker || (won ? "Enemy splashed" : "Hull destroyed");
    panelTitle.textContent = won ? "Victory!" : "Defeated";
    panelCopy.textContent = won
      ? `Your rival went down in flames. Hits scored: ${Math.floor(score / 100)}.`
      : "Your plane is in the drink. Call for a rematch and even the score.";
    const connected = conn && conn.open;
    startButton.innerHTML = connected ? "Rematch <span>→</span>" : "Back to menu <span>→</span>";
    modeButtons.classList.remove("is-hidden");
    multiButton.classList.add("is-hidden");
    mpPanel.classList.add("is-hidden");
    overlay.classList.remove("hidden");
  }

  function resetToMenu() {
    destroyNetwork();
    gameMode = "single";
    isHost = false;
    remote.active = false;
    distanceLabel.textContent = "Distance";
    resetGame();
    state = "menu";
    panelKicker.textContent = "Ready for takeoff?";
    panelTitle.textContent = "Skyline Ace";
    panelCopy.textContent =
      "Fight through five stages — daybreak, sunset, night, storm, and deep space — each faster and meaner than the last. Watch for the red lock-on ring and chain hits for a score multiplier.";
    startButton.innerHTML = "Single flight <span>→</span>";
    modeButtons.classList.remove("is-hidden");
    multiButton.classList.remove("is-hidden");
    mpPanel.classList.add("is-hidden");
    mpStatus.textContent = "";
    overlay.classList.remove("hidden");
  }

  function togglePause() {
    if (state === "playing") {
      state = "paused";
      panelKicker.textContent = "Flight suspended";
      panelTitle.textContent = "Paused";
      panelCopy.textContent = "Catch your breath. Your aircraft is holding position.";
      startButton.innerHTML = "Resume flight <span>→</span>";
      multiButton.classList.add("is-hidden");
      overlay.classList.remove("hidden");
    } else if (state === "paused") {
      state = "playing";
      overlay.classList.add("hidden");
      lastTime = performance.now();
    }
  }

  function createObstacle() {
    const difficulty = stageDifficulty();
    const cityStage = gameMode === "single" && STAGES[stageIndexForDistance(distance)].city;

    if (cityStage && Math.random() < 0.42) {
      const towerHeight = random(190, 420);
      obstacles.push({
        type: "tower",
        x: WIDTH + 90,
        y: HEIGHT - towerHeight / 2,
        baseY: HEIGHT - towerHeight / 2,
        width: random(62, 96),
        height: towerHeight,
        speed: 250 * (1 + (difficulty - 1) * 0.3),
        phase: random(0, Math.PI * 2),
        amplitude: 0,
        fireTimer: Infinity,
        isAce: false,
        tilt: 0,
        hit: false,
        nearMiss: false,
        seed: Math.random(),
      });
      return;
    }

    const type = Math.random() < 0.68 ? "plane" : "balloon";
    const speed = (225 + Math.min(elapsed, 90) * 2.2 + random(0, 60)) * (1 + (difficulty - 1) * 0.45);
    const y = random(100, HEIGHT - 85);
    const isAce =
      type === "plane" && elapsed > 18 && Math.random() < Math.min(0.65, elapsed / 130 + (difficulty - 1) * 0.35);
    const phase = random(0, Math.PI * 2);
    const amplitude = type === "plane" ? random(12, isAce ? 64 : 30) : random(16, 28);

    obstacles.push({
      type,
      x: WIDTH + 80,
      y,
      baseY: y - Math.sin(phase) * amplitude,
      width: type === "plane" ? 67 : 39,
      height: type === "plane" ? 31 : 58,
      speed,
      phase,
      amplitude,
      fireTimer: type === "plane" ? random(1.15, 2.35) : Infinity,
      isAce,
      tilt: 0,
      hit: false,
      nearMiss: false,
    });
  }

  function burst(x, y, color, count = 18, maxLife = 0.85) {
    for (let i = 0; i < count; i += 1) {
      const angle = random(0, Math.PI * 2);
      const speed = random(45, 230);
      particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: random(maxLife * 0.45, maxLife),
        maxLife,
        size: random(2, 6),
        color,
      });
    }
  }

  function addImpact(x, y, color, points) {
    burst(x, y, color, 26, 0.9);
    shockwaves.push({ x, y, radius: 5, life: 0.45, maxLife: 0.45, color });
    scorePopups.push({ x, y: y - 18, text: `+${points}`, life: 0.8, maxLife: 0.8 });
  }

  function damagePlayer(x, y) {
    if (player.invulnerable > 0) return false;

    if (shieldTime > 0 && gameMode === "single") {
      shieldTime = 0;
      player.invulnerable = 0.5;
      screenShake = Math.max(screenShake, 4);
      burst(player.x, player.y, "#59e6ff", 22, 0.7);
      shockwaves.push({ x: player.x, y: player.y, radius: 30, life: 0.45, maxLife: 0.45, color: "#59e6ff" });
      scorePopups.push({ x: player.x, y: player.y - 40, text: "SHIELD DOWN", life: 0.9, maxLife: 0.9 });
      return false;
    }

    health -= 1;
    player.invulnerable = 1.25;
    screenShake = 10;
    combo = 0;
    comboTimer = 0;
    burst(x, y, "#ffb44a", 28, 0.95);
    shockwaves.push({ x, y, radius: 8, life: 0.5, maxLife: 0.5, color: "#ff704d" });
    updateHealth();
    if (gameMode === "versus") {
      sendMessage({ t: "hit", h: health });
      if (health <= 0) {
        sendMessage({ t: "over" });
        endVersus(false);
      }
    } else if (health <= 0) {
      showGameOver();
    }
    return true;
  }

  function sendMessage(message) {
    if (gameMode === "versus" && conn && conn.open) conn.send(message);
  }

  function destroyNetwork() {
    clearInterval(heartbeatTimer);
    clearInterval(handshakeTimer);
    clearTimeout(connectTimeout);
    heartbeatTimer = null;
    handshakeTimer = null;
    connectTimeout = null;
    if (conn && conn.open) publishToRival({ t: "bye" });
    for (const client of mqttClients) {
      try {
        client.end(true);
      } catch {
        /* already closed */
      }
    }
    mqttClients = [];
    conn = null;
    roomCode = "";
    sendSeq = 0;
    seenKeys.clear();
    seenOrder.length = 0;
  }

  const ROOM_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  // Several public brokers on different ports: players connect to all of
  // them at once, so the duel works as long as each side can reach at least
  // one broker in common. Messages carry sequence ids and are deduplicated.
  const MQTT_BROKERS = [
    "wss://broker.emqx.io:8084/mqtt",
    "wss://broker.hivemq.com:8884/mqtt",
    "wss://test.mosquitto.org:8081",
  ];

  function generateRoomCode() {
    let code = "";
    for (let i = 0; i < 4; i += 1) {
      code += ROOM_ALPHABET[Math.floor(Math.random() * ROOM_ALPHABET.length)];
    }
    return code;
  }

  function mqttLibraryMissing() {
    if (typeof window.mqtt !== "undefined") return false;
    mpStatus.textContent = "Multiplayer library failed to load. Check your connection and refresh the page.";
    return true;
  }

  // Each side publishes to the rival's topic and listens on its own, so
  // messages relay through the broker without echoing back to the sender.
  function ownTopic() {
    return `skyace-duel/${roomCode}/${isHost ? "h" : "g"}`;
  }

  function rivalTopic() {
    return `skyace-duel/${roomCode}/${isHost ? "g" : "h"}`;
  }

  function publishToRival(message) {
    message.sid = mySid;
    message.q = ++sendSeq;
    const transient = message.t === "s" || message.t === "hb";
    const payload = JSON.stringify(message);
    for (const client of mqttClients) {
      if (client.connected) client.publish(rivalTopic(), payload, { qos: transient ? 0 : 1 });
    }
  }

  function alreadySeen(message) {
    if (message.sid === undefined || message.q === undefined) return false;
    const key = `${message.sid}:${message.q}`;
    if (seenKeys.has(key)) return true;
    seenKeys.add(key);
    seenOrder.push(key);
    if (seenOrder.length > 600) seenKeys.delete(seenOrder.shift());
    return false;
  }

  function openBroker(onReady) {
    mySid = Math.random().toString(36).slice(2, 8);
    let readyFired = false;

    connectTimeout = setTimeout(() => {
      if (!mqttClients.some((client) => client.connected)) {
        destroyNetwork();
        mpStatus.textContent =
          "Could not reach any relay server. Your network may block WebSockets — try a different network or a phone hotspot.";
      }
    }, 12000);

    for (const brokerUrl of MQTT_BROKERS) {
      let client;
      try {
        client = window.mqtt.connect(brokerUrl, {
          connectTimeout: 8000,
          keepalive: 30,
          clean: true,
        });
      } catch {
        continue;
      }
      mqttClients.push(client);

      client.on("connect", () => {
        client.subscribe(ownTopic(), (error) => {
          if (error || readyFired) return;
          readyFired = true;
          clearTimeout(connectTimeout);
          connectTimeout = null;
          onReady();
        });
      });

      client.on("message", (topic, payload) => {
        let message = null;
        try {
          message = JSON.parse(payload.toString());
        } catch {
          return;
        }
        if (alreadySeen(message)) return;
        handleTransportMessage(message);
      });

      client.on("error", () => {
        /* other brokers may still connect; the overall timeout reports failure */
      });
    }
  }

  function establishLink() {
    conn = {
      open: true,
      send(message) {
        publishToRival(message);
      },
    };
    round = 1;
    lastReceivedAt = Date.now();
    clearInterval(handshakeTimer);
    handshakeTimer = null;
    clearInterval(heartbeatTimer);
    heartbeatTimer = setInterval(() => {
      if (!conn) return;
      // Heartbeats repeat our health and round so a lost one-shot message
      // can never strand the rival (e.g. missing the killing blow).
      conn.send({ t: "hb", h: health, r: round });
      if (Date.now() - lastReceivedAt > 10000) handleDisconnect();
    }, 1000);
  }

  function setRivalHealth(value) {
    if (typeof value !== "number" || value === remote.health) return;
    if (value < remote.health) {
      screenShake = Math.max(screenShake, 2);
      burst(remote.x, remote.y, "#ffb44a", 18, 0.8);
      shockwaves.push({ x: remote.x, y: remote.y, radius: 6, life: 0.4, maxLife: 0.4, color: "#ff704d" });
    }
    remote.health = value;
    updateRivalHud();
    if (value <= 0 && state === "playing" && gameMode === "versus") endVersus(true);
  }

  function syncRound(messageRound) {
    if (typeof messageRound !== "number" || messageRound <= round) return messageRound === round;
    // The rival is already in a newer round (their rematch message may have
    // been lost) — jump forward and restart with them.
    round = messageRound;
    startVersus();
    return true;
  }

  function handleTransportMessage(message) {
    if (!message || typeof message !== "object") return;
    lastReceivedAt = Date.now();

    if (message.t === "hello") {
      if (!isHost) return;
      // Re-send the welcome for repeated hellos so a missed packet cannot
      // strand the guest on "Connecting".
      if (!conn) {
        establishLink();
        conn.send({ t: "welcome" });
        startVersus();
      } else {
        conn.send({ t: "welcome" });
      }
      return;
    }

    if (message.t === "welcome") {
      if (isHost || conn) return;
      establishLink();
      startVersus();
      return;
    }

    if (message.t === "hb") {
      syncRound(message.r);
      setRivalHealth(message.h);
      return;
    }

    if (message.t === "bye") {
      handleDisconnect();
      return;
    }

    handleMessage(message);
  }

  function hostRoom() {
    if (mqttLibraryMissing()) return;
    destroyNetwork();
    isHost = true;
    roomCode = generateRoomCode();
    mpStatus.textContent = "Creating room…";
    openBroker(() => {
      mpStatus.textContent = `Room code: ${roomCode} — share it with your rival and keep this page open.`;
    });
  }

  function joinRoom() {
    const code = joinCodeInput.value.trim().toUpperCase();
    if (code.length !== 4) {
      mpStatus.textContent = "Enter the 4-character room code.";
      return;
    }
    if (mqttLibraryMissing()) return;
    destroyNetwork();
    isHost = false;
    roomCode = code;
    mpStatus.textContent = "Connecting…";
    openBroker(() => {
      mpStatus.textContent = "Looking for the room…";
      let attempts = 0;
      const sayHello = () => {
        if (conn || !mqttClients.some((client) => client.connected)) return;
        attempts += 1;
        if (attempts > 15) {
          destroyNetwork();
          mpStatus.textContent =
            "No answer from that room. Double-check the code and make sure your rival's page is still open, then try again.";
          return;
        }
        publishToRival({ t: "hello" });
      };
      sayHello();
      handshakeTimer = setInterval(sayHello, 1000);
    });
  }

  function handleDisconnect() {
    if (gameMode !== "versus" && !conn) return;
    conn = null;
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
    if (state === "playing" && gameMode === "versus") {
      endVersus(false, "Connection lost");
    } else if (state === "gameover" && gameMode === "versus") {
      startButton.innerHTML = "Back to menu <span>→</span>";
    } else {
      mpStatus.textContent = "Rival disconnected.";
    }
  }

  function startVersus() {
    gameMode = "versus";
    resetGame();
    player.x = isHost ? 180 : WIDTH - 180;
    player.y = HEIGHT / 2;
    remote.x = isHost ? WIDTH - 180 : 180;
    remote.y = HEIGHT / 2;
    remote.targetX = remote.x;
    remote.targetY = remote.y;
    remote.tilt = 0;
    remote.health = 3;
    remote.active = true;
    netTimer = 0;
    updateRivalHud();
    state = "playing";
    overlay.classList.add("hidden");
    lastTime = performance.now();
  }

  function handleMessage(message) {
    if (!message || typeof message !== "object") return;

    if (message.t === "s") {
      remote.targetX = message.x;
      remote.targetY = message.y;
      remote.tilt = message.k || 0;
    } else if (message.t === "fire") {
      enemyBullets.push({
        x: message.x,
        y: message.y,
        previousX: message.x,
        previousY: message.y,
        vx: message.v,
        vy: 0,
        width: 24,
        height: 7,
        life: 3,
      });
    } else if (message.t === "hit") {
      setRivalHealth(message.h);
    } else if (message.t === "over") {
      setRivalHealth(0);
    } else if (message.t === "rematch") {
      syncRound(message.r);
    }
  }

  function fireEnemyBullet(obstacle) {
    const dx = player.x - obstacle.x;
    const dy = player.y - obstacle.y;
    const distance = Math.hypot(dx, dy) || 1;
    const lead = Math.min(0.45, distance / ENEMY_BULLET_SPEED);
    const targetX = player.x + player.vx * lead;
    const targetY = player.y + player.vy * lead;
    const aimX = targetX - obstacle.x;
    const aimY = targetY - obstacle.y;
    const aimDistance = Math.hypot(aimX, aimY) || 1;
    const speed = ENEMY_BULLET_SPEED + Math.min(120, elapsed * 1.5);

    enemyBullets.push({
      x: obstacle.x - 35,
      y: obstacle.y,
      previousX: obstacle.x - 35,
      previousY: obstacle.y,
      vx: (aimX / aimDistance) * speed,
      vy: (aimY / aimDistance) * speed,
      width: 12,
      height: 8,
      life: 4,
    });
    burst(obstacle.x - 37, obstacle.y, "#ff6f5d", 5, 0.25);
  }

  function boxesOverlap(a, b, padding = 0) {
    return (
      a.x - a.width / 2 + padding < b.x + b.width / 2 - padding &&
      a.x + a.width / 2 - padding > b.x - b.width / 2 + padding &&
      a.y - a.height / 2 + padding < b.y + b.height / 2 - padding &&
      a.y + a.height / 2 - padding > b.y - b.height / 2 + padding
    );
  }

  function sweptBulletHits(bullet, target) {
    const left = target.x - target.width / 2;
    const right = target.x + target.width / 2;
    const top = target.y - target.height / 2;
    const bottom = target.y + target.height / 2;
    const bulletTop = bullet.y - bullet.height / 2;
    const bulletBottom = bullet.y + bullet.height / 2;
    const travelLeft = Math.min(bullet.previousX, bullet.x) - bullet.width / 2;
    const travelRight = Math.max(bullet.previousX, bullet.x) + bullet.width / 2;
    return bulletBottom >= top && bulletTop <= bottom && travelRight >= left && travelLeft <= right;
  }

  function movePlayer(dt) {
    const horizontal =
      (keys.has("ArrowRight") || keys.has("KeyD") ? 1 : 0) -
      (keys.has("ArrowLeft") || keys.has("KeyA") ? 1 : 0);
    const vertical =
      (keys.has("ArrowDown") || keys.has("KeyS") ? 1 : 0) -
      (keys.has("ArrowUp") || keys.has("KeyW") ? 1 : 0);
    const acceleration = 1050;
    const drag = Math.pow(0.0008, dt);

    if (!pointerActive) {
      player.vx += horizontal * acceleration * dt;
      player.vy += vertical * acceleration * dt;
      player.vx *= drag;
      player.vy *= drag;
      player.x += player.vx * dt;
      player.y += player.vy * dt;
    }

    player.x = Math.max(55, Math.min(WIDTH - 65, player.x));
    player.y = Math.max(82, Math.min(HEIGHT - 55, player.y));
    player.tilt += ((pointerActive ? 0 : Math.max(-0.5, Math.min(0.5, player.vy / 400))) - player.tilt) * 0.12;
    player.invulnerable = Math.max(0, player.invulnerable - dt);
  }

  function update(dt) {
    elapsed += dt;
    const worldSpeed = 1 + elapsed / 90;
    score += dt * 18 * worldSpeed;
    distance += dt * 0.09 * worldSpeed;
    screenShake = Math.max(0, screenShake - dt * 22);
    fireCooldown = Math.max(0, fireCooldown - dt);
    muzzleFlash = Math.max(0, muzzleFlash - dt);
    comboTimer = Math.max(0, comboTimer - dt);
    if (comboTimer === 0) combo = 0;

    const newStageIndex = stageIndexForDistance(distance);
    if (newStageIndex !== stageIndex) {
      stageIndex = newStageIndex;
      announceStage(stageIndex);
    }
    stageBanner.life = Math.max(0, stageBanner.life - dt);
    lightningFlash = Math.max(0, lightningFlash - dt * 2.4);
    if (STAGES[stageIndex].lightning) {
      lightningTimer -= dt;
      if (lightningTimer <= 0) {
        lightningFlash = 0.75;
        screenShake = Math.max(screenShake, 4);
        lightningTimer = random(2.5, 6.5);
      }
    }

    shieldTime = Math.max(0, shieldTime - dt);
    tripleTime = Math.max(0, tripleTime - dt);
    cityScroll += dt * 60;

    if (bossDelay > 0) {
      bossDelay -= dt;
      if (bossDelay <= 0 && !boss) spawnBoss();
    }
    if (boss) {
      updateBoss(dt);
      if (health <= 0) return;
    }

    powerupTimer -= dt;
    if (powerupTimer <= 0) {
      spawnPowerup();
      powerupTimer = random(11, 17);
    }

    for (let i = powerups.length - 1; i >= 0; i -= 1) {
      const powerup = powerups[i];
      powerup.x -= 92 * dt;
      powerup.phase += dt * 3;
      powerup.y += Math.sin(powerup.phase) * 14 * dt;
      const pickupBox = { x: powerup.x, y: powerup.y, width: 34, height: 34 };
      if (boxesOverlap(player, pickupBox, 0)) {
        applyPowerup(powerup);
        powerups.splice(i, 1);
        continue;
      }
      if (powerup.x < -40) powerups.splice(i, 1);
    }

    if (rightMouseDown || pointerActive || keys.has("Space")) fireBullet();
    movePlayer(dt);

    for (const cloud of clouds) {
      cloud.x -= cloud.speed * dt * worldSpeed;
      if (cloud.x < -cloud.size * 2) {
        cloud.x = WIDTH + cloud.size * 2;
        cloud.y = random(75, HEIGHT - 95);
      }
    }

    for (const streak of streaks) {
      streak.x -= streak.speed * dt * worldSpeed;
      if (streak.x < -streak.length) {
        streak.x = WIDTH + random(0, 180);
        streak.y = random(0, HEIGHT);
      }
    }

    spawnTimer -= dt;
    if (spawnTimer <= 0 && !boss && bossDelay <= 0) {
      createObstacle();
      const difficulty = stageDifficulty();
      spawnTimer = Math.max(0.3, (random(0.78, 1.35) - elapsed * 0.006) / (1 + (difficulty - 1) * 0.7));
    }

    for (let i = bullets.length - 1; i >= 0; i -= 1) {
      const bullet = bullets[i];
      bullet.previousX = bullet.x;
      bullet.x += bullet.speed * dt;
      bullet.y += (bullet.vy || 0) * dt;

      let impact = false;

      if (boss && !boss.entering && sweptBulletHits(bullet, boss)) {
        boss.health -= 1;
        score += 40;
        burst(bullet.x, bullet.y, "#ffd97a", 8, 0.4);
        if (boss.health <= 0) killBoss();
        bullets.splice(i, 1);
        continue;
      }

      for (let j = obstacles.length - 1; j >= 0; j -= 1) {
        const obstacle = obstacles[j];
        if (obstacle.hit) continue;
        if (!sweptBulletHits(bullet, obstacle)) continue;

        if (obstacle.type === "tower") {
          burst(bullet.x, bullet.y, "#c9d6e4", 6, 0.32);
          impact = true;
          break;
        }

        obstacle.hit = true;
        combo += 1;
        comboTimer = 2.2;
        const points = BULLET_SCORE * Math.min(combo, 5);
        score += points;
        screenShake = Math.max(screenShake, 3);
        addImpact(
          obstacle.x,
          obstacle.y,
          obstacle.type === "balloon" ? "#ffb44a" : "#f1655f",
          points
        );
        obstacles.splice(j, 1);
        impact = true;
        break;
      }

      if (impact || bullet.x > WIDTH + 40) bullets.splice(i, 1);
    }

    for (let i = enemyBullets.length - 1; i >= 0; i -= 1) {
      const bullet = enemyBullets[i];
      bullet.previousX = bullet.x;
      bullet.previousY = bullet.y;
      bullet.x += bullet.vx * dt;
      bullet.y += bullet.vy * dt;
      bullet.life -= dt;

      if (boxesOverlap(bullet, player, 5)) {
        damagePlayer(bullet.x, bullet.y);
        enemyBullets.splice(i, 1);
        if (health <= 0) return;
        continue;
      }

      if (
        bullet.life <= 0 ||
        bullet.x < -40 ||
        bullet.x > WIDTH + 40 ||
        bullet.y < -40 ||
        bullet.y > HEIGHT + 40
      ) {
        enemyBullets.splice(i, 1);
      }
    }

    for (let i = obstacles.length - 1; i >= 0; i -= 1) {
      const obstacle = obstacles[i];
      obstacle.x -= obstacle.speed * dt;
      obstacle.phase += dt * 2.5;
      const previousY = obstacle.y;
      obstacle.y = obstacle.baseY + Math.sin(obstacle.phase) * obstacle.amplitude;
      obstacle.tilt += (Math.max(-0.35, Math.min(0.35, (obstacle.y - previousY) * 0.18)) - obstacle.tilt) * 0.18;
      obstacle.fireTimer -= dt;

      if (
        obstacle.type === "plane" &&
        elapsed > 6 &&
        !boss &&
        obstacle.x < WIDTH - 60 &&
        obstacle.x > player.x + 230 &&
        obstacle.fireTimer <= 0
      ) {
        fireEnemyBullet(obstacle);
        obstacle.fireTimer = Math.max(0.6, (random(1.25, 2.4) - elapsed * 0.006) / (1 + (stageDifficulty() - 1) * 0.5));
      }

      if (!obstacle.hit && player.invulnerable <= 0 && boxesOverlap(player, obstacle, 7)) {
        if (obstacle.type === "tower") {
          damagePlayer(player.x + 20, player.y);
          if (health <= 0) return;
          continue;
        }
        obstacle.hit = true;
        damagePlayer(player.x + 20, player.y);
        obstacles.splice(i, 1);
        if (health <= 0) return;
        continue;
      }

      const nearDistance = Math.hypot(player.x - obstacle.x, player.y - obstacle.y);
      if (!obstacle.hit && !obstacle.nearMiss && obstacle.x < player.x && nearDistance < 105) {
        obstacle.nearMiss = true;
        score += 150;
        burst(obstacle.x, obstacle.y, "#59e6ff", 8);
      }

      if (obstacle.x < -100) obstacles.splice(i, 1);
    }

    updateEffects(dt);
    updateHud();
  }

  function updateEffects(dt) {
    for (let i = particles.length - 1; i >= 0; i -= 1) {
      const particle = particles[i];
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vx *= 0.98;
      particle.vy += 50 * dt;
      particle.life -= dt;
      if (particle.life <= 0) particles.splice(i, 1);
    }

    for (let i = shockwaves.length - 1; i >= 0; i -= 1) {
      const shockwave = shockwaves[i];
      shockwave.radius += 150 * dt;
      shockwave.life -= dt;
      if (shockwave.life <= 0) shockwaves.splice(i, 1);
    }

    for (let i = scorePopups.length - 1; i >= 0; i -= 1) {
      const popup = scorePopups[i];
      popup.y -= 35 * dt;
      popup.life -= dt;
      if (popup.life <= 0) scorePopups.splice(i, 1);
    }
  }

  function updateVersus(dt) {
    screenShake = Math.max(0, screenShake - dt * 22);
    fireCooldown = Math.max(0, fireCooldown - dt);
    muzzleFlash = Math.max(0, muzzleFlash - dt);
    comboTimer = Math.max(0, comboTimer - dt);
    if (comboTimer === 0) combo = 0;
    if (rightMouseDown || pointerActive || keys.has("Space")) fireBullet();
    movePlayer(dt);

    for (const cloud of clouds) {
      cloud.x -= cloud.speed * dt;
      if (cloud.x < -cloud.size * 2) {
        cloud.x = WIDTH + cloud.size * 2;
        cloud.y = random(75, HEIGHT - 95);
      }
    }

    for (const streak of streaks) {
      streak.x -= streak.speed * dt;
      if (streak.x < -streak.length) {
        streak.x = WIDTH + random(0, 180);
        streak.y = random(0, HEIGHT);
      }
    }

    remote.x += (remote.targetX - remote.x) * Math.min(1, dt * 14);
    remote.y += (remote.targetY - remote.y) * Math.min(1, dt * 14);

    const rival = { x: remote.x, y: remote.y, width: player.width, height: player.height };

    for (let i = bullets.length - 1; i >= 0; i -= 1) {
      const bullet = bullets[i];
      bullet.previousX = bullet.x;
      bullet.x += bullet.speed * dt;

      if (remote.active && sweptBulletHits(bullet, rival)) {
        combo += 1;
        comboTimer = 2.2;
        const points = BULLET_SCORE * Math.min(combo, 5);
        score += points;
        addImpact(bullet.x, bullet.y, "#f1655f", points);
        bullets.splice(i, 1);
        continue;
      }

      if (bullet.x > WIDTH + 40 || bullet.x < -40) bullets.splice(i, 1);
    }

    for (let i = enemyBullets.length - 1; i >= 0; i -= 1) {
      const bullet = enemyBullets[i];
      bullet.previousX = bullet.x;
      bullet.previousY = bullet.y;
      bullet.x += bullet.vx * dt;
      bullet.y += bullet.vy * dt;
      bullet.life -= dt;

      if (boxesOverlap(bullet, player, 5)) {
        damagePlayer(bullet.x, bullet.y);
        enemyBullets.splice(i, 1);
        if (health <= 0) return;
        continue;
      }

      if (bullet.life <= 0 || bullet.x < -40 || bullet.x > WIDTH + 40) enemyBullets.splice(i, 1);
    }

    updateEffects(dt);

    netTimer -= dt;
    if (netTimer <= 0) {
      sendMessage({ t: "s", x: player.x, y: player.y, k: player.tilt });
      netTimer = 0.05;
    }

    updateHud();
  }

  function drawBackground(time) {
    const palette = blendedPalette();

    const gradient = ctx.createLinearGradient(0, 0, 0, HEIGHT);
    gradient.addColorStop(0, css(palette.top));
    gradient.addColorStop(0.56, css(palette.mid));
    gradient.addColorStop(1, css(palette.bottom));
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    if (palette.starsAlpha > 0.02) {
      ctx.save();
      for (const star of stars) {
        const twinkle = 0.55 + 0.45 * Math.sin(time * 0.003 + star.twinkle);
        ctx.globalAlpha = palette.starsAlpha * twinkle;
        ctx.fillStyle = "#eaf6ff";
        ctx.fillRect(star.x, star.y, star.size, star.size);
      }
      ctx.restore();
    }

    if (palette.celestial === "sun") {
      const sunGlow = ctx.createRadialGradient(780, 100, 10, 780, 100, 130);
      sunGlow.addColorStop(0, "rgba(255,245,195,.76)");
      sunGlow.addColorStop(1, "rgba(255,245,195,0)");
      ctx.fillStyle = sunGlow;
      ctx.fillRect(630, -50, 300, 300);
    } else if (palette.celestial === "sun-low") {
      const sunGlow = ctx.createRadialGradient(780, 330, 20, 780, 330, 190);
      sunGlow.addColorStop(0, "rgba(255,171,84,.9)");
      sunGlow.addColorStop(0.35, "rgba(255,140,80,.4)");
      sunGlow.addColorStop(1, "rgba(255,140,80,0)");
      ctx.fillStyle = sunGlow;
      ctx.fillRect(560, 130, 440, 400);
      ctx.fillStyle = "#ffd9a0";
      ctx.beginPath();
      ctx.arc(780, 330, 34, 0, Math.PI * 2);
      ctx.fill();
    } else if (palette.celestial === "moon") {
      const moonGlow = ctx.createRadialGradient(780, 100, 10, 780, 100, 110);
      moonGlow.addColorStop(0, "rgba(214,235,255,.5)");
      moonGlow.addColorStop(1, "rgba(214,235,255,0)");
      ctx.fillStyle = moonGlow;
      ctx.fillRect(650, -30, 260, 260);
      ctx.fillStyle = "#e8f2fb";
      ctx.beginPath();
      ctx.arc(780, 100, 30, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = css(palette.top, 0.85);
      ctx.beginPath();
      ctx.arc(792, 92, 26, 0, Math.PI * 2);
      ctx.fill();
    }

    if (palette.spaceAlpha > 0.02) {
      ctx.save();
      ctx.globalAlpha = palette.spaceAlpha;
      const planetGradient = ctx.createRadialGradient(788, 122, 12, 800, 130, 62);
      planetGradient.addColorStop(0, "#ffcf9e");
      planetGradient.addColorStop(0.55, "#d98d5a");
      planetGradient.addColorStop(1, "#8a4a3a");
      ctx.fillStyle = planetGradient;
      ctx.beginPath();
      ctx.arc(800, 130, 52, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(233, 208, 176, .75)";
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.ellipse(800, 130, 84, 20, -0.32, 0, Math.PI * 2);
      ctx.stroke();

      const nebula = ctx.createRadialGradient(220, 420, 30, 220, 420, 240);
      nebula.addColorStop(0, "rgba(120, 80, 200, .16)");
      nebula.addColorStop(1, "rgba(120, 80, 200, 0)");
      ctx.fillStyle = nebula;
      ctx.fillRect(0, 180, 520, 420);
      ctx.restore();
    }

    if (palette.cloudDim > 0.02) {
      for (const cloud of clouds) drawCloud(cloud, palette.cloudDim);
    }

    if (palette.spaceAlpha < 0.6 && palette.cityAlpha < 0.6) {
      ctx.fillStyle = css(palette.horizon, 0.24 * (1 - palette.spaceAlpha));
      ctx.beginPath();
      ctx.moveTo(0, HEIGHT);
      for (let x = 0; x <= WIDTH; x += 80) {
        const y = 490 + Math.sin(x * 0.012 + time * 0.00005) * 20;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(WIDTH, HEIGHT);
      ctx.closePath();
      ctx.fill();
    }

    if (palette.cityAlpha > 0.02) drawSkyline(time, palette.cityAlpha);

    ctx.strokeStyle = "rgba(222, 250, 255, .18)";
    ctx.lineWidth = 1;
    for (const streak of streaks) {
      ctx.beginPath();
      ctx.moveTo(streak.x, streak.y);
      ctx.lineTo(streak.x + streak.length, streak.y);
      ctx.stroke();
    }

    if (palette.rainAlpha > 0.02) {
      ctx.save();
      ctx.strokeStyle = `rgba(178, 202, 224, ${0.4 * palette.rainAlpha})`;
      ctx.lineWidth = 1.4;
      for (const streak of streaks) {
        ctx.beginPath();
        ctx.moveTo(streak.x, streak.y);
        ctx.lineTo(streak.x - 13, streak.y + 30);
        ctx.stroke();
      }
      ctx.restore();
    }

    if (lightningFlash > 0.02) {
      ctx.fillStyle = `rgba(235, 244, 255, ${lightningFlash * 0.42})`;
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
    }
  }

  function drawSkylineLayer(buildings, offset, alpha, bodyColor, windowColor, windowChance) {
    for (let tile = -1; tile <= 1; tile += 1) {
      for (const building of buildings) {
        const x = building.x - offset + tile * SKYLINE_TILE;
        if (x + building.width < -20 || x > WIDTH + 20) continue;
        const top = HEIGHT - building.height;

        ctx.globalAlpha = alpha;
        ctx.fillStyle = bodyColor;
        ctx.fillRect(x, top, building.width, building.height);

        if (building.spire) {
          ctx.fillRect(x + building.width / 2 - 2, top - 26, 4, 26);
          ctx.fillStyle = "#ff5a5a";
          ctx.globalAlpha = alpha * (0.4 + 0.6 * Math.abs(Math.sin(building.seed * 20 + cityScroll * 0.05)));
          ctx.fillRect(x + building.width / 2 - 2.5, top - 30, 5, 5);
          ctx.fillStyle = bodyColor;
          ctx.globalAlpha = alpha;
        }

        ctx.fillStyle = windowColor;
        const columns = Math.floor(building.width / 14);
        const rows = Math.floor(building.height / 20);
        for (let c = 0; c < columns; c += 1) {
          for (let r = 0; r < rows; r += 1) {
            // Deterministic per-window "is it lit" hash so windows don't flicker
            const lit = Math.sin(building.seed * 1000 + c * 13.7 + r * 7.3) > 1 - windowChance * 2;
            if (!lit) continue;
            ctx.globalAlpha = alpha * 0.8;
            ctx.fillRect(x + 5 + c * 14, top + 8 + r * 20, 6, 9);
          }
        }
      }
    }
  }

  function drawSkyline(time, alpha) {
    ctx.save();

    drawSkylineLayer(skylineFar, (cityScroll * 0.45) % SKYLINE_TILE, alpha * 0.85, "#101530", "rgba(255, 214, 140, .35)", 0.16);
    drawSkylineLayer(skylineNear, (cityScroll * 1.1) % SKYLINE_TILE, alpha, "#080c20", "rgba(255, 224, 150, .8)", 0.24);

    // Sweeping searchlights rising from the streets
    for (const beam of [
      { x: 190, speed: 0.00021, phase: 0 },
      { x: 660, speed: 0.00017, phase: 2.1 },
    ]) {
      const angle = -Math.PI / 2 + Math.sin(time * beam.speed + beam.phase) * 0.5;
      const beamGradient = ctx.createLinearGradient(beam.x, HEIGHT, beam.x + Math.cos(angle) * 620, HEIGHT + Math.sin(angle) * 620);
      beamGradient.addColorStop(0, `rgba(210, 226, 255, ${0.16 * alpha})`);
      beamGradient.addColorStop(1, "rgba(210, 226, 255, 0)");
      ctx.fillStyle = beamGradient;
      ctx.beginPath();
      ctx.moveTo(beam.x - 14, HEIGHT);
      ctx.lineTo(beam.x + Math.cos(angle) * 640 - 52, HEIGHT + Math.sin(angle) * 640);
      ctx.lineTo(beam.x + Math.cos(angle) * 640 + 52, HEIGHT + Math.sin(angle) * 640);
      ctx.lineTo(beam.x + 14, HEIGHT);
      ctx.closePath();
      ctx.fill();
    }

    // Street glow along the bottom edge
    const glow = ctx.createLinearGradient(0, HEIGHT - 46, 0, HEIGHT);
    glow.addColorStop(0, "rgba(255, 170, 90, 0)");
    glow.addColorStop(1, `rgba(255, 170, 90, ${0.28 * alpha})`);
    ctx.fillStyle = glow;
    ctx.fillRect(0, HEIGHT - 46, WIDTH, 46);

    ctx.restore();
  }

  function drawTower(obstacle) {
    const left = obstacle.x - obstacle.width / 2;
    const top = obstacle.y - obstacle.height / 2;
    ctx.save();

    const body = ctx.createLinearGradient(left, top, left + obstacle.width, top);
    body.addColorStop(0, "#232a4d");
    body.addColorStop(0.5, "#2f3763");
    body.addColorStop(1, "#1a2040");
    ctx.fillStyle = body;
    ctx.fillRect(left, top, obstacle.width, obstacle.height);

    ctx.fillStyle = "#12172f";
    ctx.fillRect(left - 4, top, obstacle.width + 8, 10);

    // Antenna with blinking aircraft-warning light
    ctx.strokeStyle = "#3c456f";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(obstacle.x, top);
    ctx.lineTo(obstacle.x, top - 30);
    ctx.stroke();
    ctx.fillStyle = "#ff4d4d";
    ctx.globalAlpha = 0.35 + 0.65 * Math.abs(Math.sin(obstacle.phase * 1.6));
    ctx.beginPath();
    ctx.arc(obstacle.x, top - 33, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    ctx.fillStyle = "rgba(255, 224, 150, .75)";
    const columns = Math.floor(obstacle.width / 15);
    const rows = Math.floor(obstacle.height / 24);
    for (let c = 0; c < columns; c += 1) {
      for (let r = 0; r < rows; r += 1) {
        const lit = Math.sin(obstacle.seed * 1000 + c * 11.9 + r * 5.7) > 0.35;
        if (!lit) continue;
        ctx.fillRect(left + 6 + c * 15, top + 16 + r * 24, 7, 11);
      }
    }
    ctx.restore();
  }

  function drawCloud(cloud, dim = 1) {
    ctx.save();
    ctx.globalAlpha = cloud.alpha * dim;
    ctx.fillStyle = "#f2fbff";
    ctx.beginPath();
    ctx.ellipse(cloud.x, cloud.y, cloud.size, cloud.size * 0.27, 0, 0, Math.PI * 2);
    ctx.ellipse(cloud.x - cloud.size * 0.35, cloud.y - cloud.size * 0.12, cloud.size * 0.42, cloud.size * 0.34, 0, 0, Math.PI * 2);
    ctx.ellipse(cloud.x + cloud.size * 0.2, cloud.y - cloud.size * 0.2, cloud.size * 0.5, cloud.size * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawPlane(x, y, scale, color, facing = 1, tilt = 0) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(facing * scale, scale);
    ctx.rotate(facing * tilt);

    ctx.fillStyle = "rgba(0,0,0,.16)";
    ctx.beginPath();
    ctx.ellipse(-2, 18, 34, 7, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(40, 0);
    ctx.lineTo(12, -8);
    ctx.lineTo(-28, -8);
    ctx.lineTo(-42, -21);
    ctx.lineTo(-34, 2);
    ctx.lineTo(-43, 12);
    ctx.lineTo(-25, 10);
    ctx.lineTo(16, 8);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = color === "#edf8ff" ? "#9adff2" : "#d94b49";
    ctx.beginPath();
    ctx.moveTo(9, -5);
    ctx.lineTo(-10, -29);
    ctx.lineTo(-23, -27);
    ctx.lineTo(-10, -4);
    ctx.lineTo(-20, 29);
    ctx.lineTo(-5, 28);
    ctx.lineTo(13, 5);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#153a56";
    ctx.beginPath();
    ctx.ellipse(18, -5, 11, 5, -0.18, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#ffb44a";
    ctx.fillRect(-37, -3, 11, 5);
    ctx.restore();
  }

  function drawAsteroid(obstacle) {
    ctx.save();
    ctx.translate(obstacle.x, obstacle.y);
    ctx.rotate(obstacle.phase * 0.35);

    const rockGradient = ctx.createRadialGradient(-7, -8, 3, 0, 0, 30);
    rockGradient.addColorStop(0, "#b3a89b");
    rockGradient.addColorStop(0.55, "#7d7367");
    rockGradient.addColorStop(1, "#4c443c");
    ctx.fillStyle = rockGradient;
    ctx.beginPath();
    ctx.moveTo(-22, -6);
    ctx.lineTo(-12, -22);
    ctx.lineTo(6, -24);
    ctx.lineTo(21, -12);
    ctx.lineTo(24, 6);
    ctx.lineTo(12, 22);
    ctx.lineTo(-8, 23);
    ctx.lineTo(-21, 12);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "rgba(30, 26, 22, .45)";
    ctx.beginPath();
    ctx.arc(-6, 4, 5, 0, Math.PI * 2);
    ctx.arc(9, -7, 3.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawBalloon(obstacle) {
    if (STAGES[stageIndex].space) {
      drawAsteroid(obstacle);
      return;
    }
    ctx.save();
    ctx.translate(obstacle.x, obstacle.y);
    const balloonGradient = ctx.createRadialGradient(-8, -15, 2, 0, -12, 24);
    balloonGradient.addColorStop(0, "#ffe7aa");
    balloonGradient.addColorStop(0.25, "#ffb44a");
    balloonGradient.addColorStop(1, "#c55c35");
    ctx.fillStyle = balloonGradient;
    ctx.beginPath();
    ctx.ellipse(0, -10, 21, 27, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(42,42,42,.6)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-8, 14);
    ctx.lineTo(-6, 33);
    ctx.moveTo(8, 14);
    ctx.lineTo(6, 33);
    ctx.stroke();
    ctx.fillStyle = "#694630";
    ctx.fillRect(-8, 31, 16, 10);
    ctx.restore();
  }

  function drawParticles() {
    for (const particle of particles) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, particle.life / particle.maxLife);
      ctx.fillStyle = particle.color;
      ctx.fillRect(particle.x, particle.y, particle.size, particle.size);
      ctx.restore();
    }
  }

  function drawBullets() {
    for (const bullet of bullets) {
      const direction = bullet.speed < 0 ? -1 : 1;
      ctx.save();
      ctx.translate(bullet.x, bullet.y);
      ctx.scale(direction, 1);

      const glow = ctx.createLinearGradient(-52, 0, 12, 0);
      glow.addColorStop(0, "rgba(255, 228, 120, 0)");
      glow.addColorStop(0.72, "rgba(255, 210, 80, .45)");
      glow.addColorStop(1, "#fff8d8");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.roundRect(-52, -bullet.height / 2, 64, bullet.height, 3);
      ctx.fill();

      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.ellipse(7, 0, 7, 3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawEnemyBullets(time) {
    const spaceLasers = STAGES[stageIndex].space && gameMode === "single";
    for (const bullet of enemyBullets) {
      const pulse = 1 + Math.sin(time * 0.02 + bullet.x * 0.04) * 0.22;
      const tailX = bullet.x - bullet.vx * 0.075;
      const tailY = bullet.y - bullet.vy * 0.075;
      const gradient = ctx.createLinearGradient(tailX, tailY, bullet.x, bullet.y);
      if (spaceLasers) {
        gradient.addColorStop(0, "rgba(80, 255, 120, 0)");
        gradient.addColorStop(0.7, "rgba(90, 255, 130, .65)");
        gradient.addColorStop(1, "#eafff0");
      } else {
        gradient.addColorStop(0, "rgba(255, 75, 60, 0)");
        gradient.addColorStop(0.7, "rgba(255, 100, 70, .6)");
        gradient.addColorStop(1, "#fff1d0");
      }
      ctx.strokeStyle = gradient;
      ctx.lineWidth = 5 * pulse;
      ctx.beginPath();
      ctx.moveTo(tailX, tailY);
      ctx.lineTo(bullet.x, bullet.y);
      ctx.stroke();
      ctx.fillStyle = "#fff5d6";
      ctx.beginPath();
      ctx.arc(bullet.x, bullet.y, 4 * pulse, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawCombatEffects() {
    for (const shockwave of shockwaves) {
      ctx.save();
      ctx.globalAlpha = shockwave.life / shockwave.maxLife;
      ctx.strokeStyle = shockwave.color;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(shockwave.x, shockwave.y, shockwave.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    ctx.save();
    ctx.textAlign = "center";
    ctx.font = "800 18px Trebuchet MS";
    for (const popup of scorePopups) {
      ctx.globalAlpha = Math.min(1, popup.life / popup.maxLife * 2);
      ctx.fillStyle = "#fff3ad";
      ctx.shadowColor = "#ff9d3d";
      ctx.shadowBlur = 8;
      ctx.fillText(popup.text, popup.x, popup.y);
    }
    ctx.restore();
  }

  function drawPowerups(time) {
    for (const powerup of powerups) {
      const bob = Math.sin(time * 0.004 + powerup.phase) * 4;
      const x = powerup.x;
      const y = powerup.y + bob;
      ctx.save();

      const glowColor = powerup.type === "repair" ? "125, 255, 168" : "89, 230, 255";
      const glow = ctx.createRadialGradient(x, y, 3, x, y, 26);
      glow.addColorStop(0, `rgba(${glowColor}, .5)`);
      glow.addColorStop(1, `rgba(${glowColor}, 0)`);
      ctx.fillStyle = glow;
      ctx.fillRect(x - 26, y - 26, 52, 52);

      ctx.fillStyle = "rgba(6, 24, 44, .85)";
      ctx.strokeStyle = powerup.type === "repair" ? "#7dffa8" : "#59e6ff";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, 15, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      if (powerup.type === "shield") {
        ctx.strokeStyle = "#a6f0ff";
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.arc(x, y, 8, -Math.PI * 0.85, Math.PI * 0.85);
        ctx.stroke();
      } else if (powerup.type === "triple") {
        ctx.fillStyle = "#ffe08a";
        for (const offset of [-6, 0, 6]) {
          ctx.beginPath();
          ctx.roundRect(x - 5, y + offset - 1.6, 10, 3.2, 2);
          ctx.fill();
        }
      } else {
        ctx.fillStyle = "#7dffa8";
        ctx.fillRect(x - 2.2, y - 8, 4.4, 16);
        ctx.fillRect(x - 8, y - 2.2, 16, 4.4);
      }
      ctx.restore();
    }
  }

  function drawBoss(time) {
    const flash = boss.health < boss.maxHealth && Math.sin(time * 0.05) > 0.7;
    drawPlane(boss.x, boss.y, 1.7, flash ? "#ff8f8a" : STAGES[stageIndex].space ? "#2f3550" : "#8e2f4d", -1, Math.sin(boss.phase || 0) * 0.06);

    const barWidth = 130;
    const ratio = Math.max(0, boss.health / boss.maxHealth);
    ctx.save();
    ctx.fillStyle = "rgba(4, 20, 38, .7)";
    ctx.beginPath();
    ctx.roundRect(boss.x - barWidth / 2, boss.y - 68, barWidth, 9, 4);
    ctx.fill();
    ctx.fillStyle = ratio > 0.4 ? "#ff704d" : "#ffd97a";
    ctx.beginPath();
    ctx.roundRect(boss.x - barWidth / 2 + 1.5, boss.y - 66.5, (barWidth - 3) * ratio, 6, 3);
    ctx.fill();
    ctx.restore();
  }

  function drawMuzzleFlash(time) {
    if (muzzleFlash <= 0) return;
    const radius = 12 + Math.sin(time * 0.08) * 4;
    const facing = localFacing();
    ctx.save();
    ctx.translate(player.x + 44 * facing, player.y);
    ctx.scale(facing, 1);
    ctx.fillStyle = "rgba(255, 244, 170, .95)";
    ctx.shadowColor = "#ff9c34";
    ctx.shadowBlur = 18;
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(radius + 16, 0);
    ctx.lineTo(0, 6);
    ctx.lineTo(6, 0);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function draw(time) {
    ctx.save();
    if (screenShake > 0) ctx.translate(random(-screenShake, screenShake), random(-screenShake, screenShake));
    drawBackground(time);

    for (const obstacle of obstacles) {
      if (obstacle.type === "plane") {
        if (obstacle.fireTimer < 0.35 && obstacle.x < WIDTH - 60 && obstacle.x > player.x + 230) {
          ctx.save();
          ctx.globalAlpha = 0.35 + Math.sin(time * 0.035) * 0.2;
          ctx.strokeStyle = "#ff604f";
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(obstacle.x, obstacle.y, 48, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }
        const spaceStage = STAGES[stageIndex].space;
        drawPlane(
          obstacle.x,
          obstacle.y,
          obstacle.isAce ? 0.9 : 0.82,
          spaceStage ? (obstacle.isAce ? "#3d4463" : "#565e80") : obstacle.isAce ? "#dc3f5b" : "#f1655f",
          -1,
          obstacle.tilt
        );
      } else if (obstacle.type === "tower") {
        drawTower(obstacle);
      } else {
        drawBalloon(obstacle);
      }
    }

    if (gameMode === "versus" && remote.active && remote.health > 0) {
      drawPlane(remote.x, remote.y, 1, "#f1655f", isHost ? -1 : 1, remote.tilt);
    }

    if (boss) drawBoss(time);
    drawPowerups(time);
    drawBullets();
    drawEnemyBullets(time);

    if (state !== "gameover" || health > 0) {
      const blink = player.invulnerable > 0 && Math.floor(player.invulnerable * 12) % 2 === 0;
      if (!blink) drawPlane(player.x, player.y, 1, "#edf8ff", localFacing(), player.tilt);
      if (shieldTime > 0) {
        const pulse = 1 + Math.sin(time * 0.012) * 0.06;
        const fade = shieldTime < 1.5 ? 0.35 + 0.3 * Math.sin(time * 0.03) : 0.65;
        ctx.save();
        ctx.globalAlpha = fade;
        ctx.strokeStyle = "#59e6ff";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.ellipse(player.x, player.y, 52 * pulse, 36 * pulse, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = fade * 0.16;
        ctx.fillStyle = "#59e6ff";
        ctx.fill();
        ctx.restore();
      }
    }

    drawMuzzleFlash(time);
    drawParticles();
    drawCombatEffects();

    if (stageBanner.life > 0) {
      const fade = Math.min(1, stageBanner.life / 0.45, (stageBanner.maxLife - stageBanner.life) / 0.35);
      ctx.save();
      ctx.globalAlpha = Math.max(0, fade);
      ctx.textAlign = "center";
      ctx.fillStyle = "#ffffff";
      ctx.shadowColor = "rgba(0,0,0,.55)";
      ctx.shadowBlur = 14;
      ctx.font = "800 21px Trebuchet MS";
      ctx.fillText(stageBanner.text.toUpperCase(), WIDTH / 2, HEIGHT / 2 - 78);
      ctx.font = "800 44px Trebuchet MS";
      ctx.fillStyle = "#ffd97a";
      ctx.fillText(stageBanner.sub.toUpperCase(), WIDTH / 2, HEIGHT / 2 - 32);
      ctx.restore();
    }

    ctx.restore();
  }

  function gameLoop(time) {
    const dt = Math.min((time - lastTime) / 1000, 0.033) || 0;
    lastTime = time;
    if (state === "playing") {
      if (gameMode === "versus") {
        updateVersus(dt);
      } else {
        update(dt);
      }
    }
    draw(time);
    requestAnimationFrame(gameLoop);
  }

  function moveToPointer(event) {
    if (state !== "playing") return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = WIDTH / rect.width;
    const scaleY = HEIGHT / rect.height;
    const targetX = (event.clientX - rect.left) * scaleX;
    const targetY = (event.clientY - rect.top) * scaleY;
    player.x += (targetX - player.x) * 0.32;
    player.y += (targetY - player.y) * 0.32;
    player.vx = 0;
    player.vy = 0;
  }

  window.addEventListener("keydown", (event) => {
    if (event.target === joinCodeInput) return;

    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(event.code)) {
      event.preventDefault();
    }

    if (event.code === "KeyP" && !event.repeat && gameMode === "single") {
      togglePause();
      return;
    }

    if (
      (event.code === "Enter" || event.code === "Space") &&
      !event.repeat &&
      state !== "playing" &&
      gameMode === "single" &&
      mpPanel.classList.contains("is-hidden")
    ) {
      state === "paused" ? togglePause() : startGame();
      return;
    }

    if (event.code === "Space" && state === "playing" && !event.repeat) {
      fireBullet();
    }

    keys.add(event.code);
  });

  window.addEventListener("keyup", (event) => keys.delete(event.code));
  window.addEventListener("blur", () => {
    keys.clear();
    rightMouseDown = false;
    if (state === "playing" && gameMode === "single") togglePause();
  });

  canvas.addEventListener("contextmenu", (event) => {
    event.preventDefault();
  });

  // Keep a mouse-specific fallback in addition to pointer events. Some browsers
  // do not consistently dispatch right-button pointer events on canvas.
  canvas.addEventListener("mousedown", (event) => {
    if (event.button !== 2) return;
    event.preventDefault();
    rightMouseDown = true;
    fireBullet();
  });

  canvas.addEventListener("pointerdown", (event) => {
    if (event.button === 2) {
      event.preventDefault();
      rightMouseDown = true;
      fireBullet();
      return;
    }

    if (event.button !== 0) return;

    pointerActive = true;
    canvas.setPointerCapture(event.pointerId);
    moveToPointer(event);
  });
  canvas.addEventListener("pointermove", (event) => {
    if (event.pointerType === "mouse" && (event.buttons & 2) !== 0) {
      rightMouseDown = true;
    }
    if (pointerActive) moveToPointer(event);
  });
  canvas.addEventListener("pointerup", (event) => {
    if (event.button === 2) {
      rightMouseDown = false;
      return;
    }

    if (event.button !== 0) return;

    pointerActive = false;
    if (canvas.hasPointerCapture(event.pointerId)) {
      canvas.releasePointerCapture(event.pointerId);
    }
  });
  canvas.addEventListener("pointercancel", () => {
    pointerActive = false;
    rightMouseDown = false;
  });
  window.addEventListener("mouseup", (event) => {
    if (event.button === 2) rightMouseDown = false;
  });

  startButton.addEventListener("click", () => {
    if (gameMode === "versus") {
      if (conn && conn.open) {
        round += 1;
        sendMessage({ t: "rematch", r: round });
        startVersus();
      } else {
        resetToMenu();
      }
      return;
    }
    state === "paused" ? togglePause() : startGame();
  });

  multiButton.addEventListener("click", () => {
    modeButtons.classList.add("is-hidden");
    mpPanel.classList.remove("is-hidden");
    panelKicker.textContent = "Multiplayer dogfight";
    panelTitle.textContent = "Find a rival";
    panelCopy.textContent =
      "Create a room and share the 4-letter code, or enter a friend's code to join their sky. First to shoot the rival down wins.";
    mpStatus.textContent = "";
  });

  mpBackButton.addEventListener("click", resetToMenu);
  createRoomButton.addEventListener("click", hostRoom);
  joinRoomButton.addEventListener("click", joinRoom);
  joinCodeInput.addEventListener("keydown", (event) => {
    event.stopPropagation();
    if (event.key === "Enter") joinRoom();
  });

  // Read-only snapshot for automated tests; exposes no mutating behavior.
  window.skyaceDebug = () => ({
    state,
    stageIndex,
    boss: boss ? { health: boss.health, maxHealth: boss.maxHealth, entering: boss.entering, x: boss.x, y: boss.y } : null,
    powerups: powerups.map((p) => p.type),
    shieldTime,
    tripleTime,
    health,
    score: Math.floor(score),
  });

  initializeSky();
  updateHealth();
  updateHud();
  requestAnimationFrame(gameLoop);
})();
