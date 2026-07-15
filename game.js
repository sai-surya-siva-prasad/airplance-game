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

  const WIDTH = canvas.width;
  const HEIGHT = canvas.height;
  const keys = new Set();
  const clouds = [];
  const obstacles = [];
  const bullets = [];
  const particles = [];
  const streaks = [];

  const BULLET_SPEED = 720;
  const BULLET_COOLDOWN = 0.16;
  const BULLET_SCORE = 100;

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
    distanceElement.textContent = `${distance.toFixed(1)} km`;
  }

  function resetGame() {
    score = 0;
    distance = 0;
    health = 3;
    elapsed = 0;
    spawnTimer = 0.8;
    screenShake = 0;
    fireCooldown = 0;
    rightMouseDown = false;
    obstacles.length = 0;
    bullets.length = 0;
    particles.length = 0;
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

    bullets.push({
      x: player.x + 42,
      y: player.y,
      width: 16,
      height: 5,
      speed: BULLET_SPEED,
    });
    fireCooldown = BULLET_COOLDOWN;
    burst(player.x + 46, player.y, "#ffe08a", 4);
  }

  function startGame() {
    resetGame();
    state = "playing";
    overlay.classList.add("hidden");
    lastTime = performance.now();
  }

  function showGameOver() {
    state = "gameover";
    panelKicker.textContent = `Flight distance · ${distance.toFixed(1)} km`;
    panelTitle.textContent = "Mayday!";
    panelCopy.textContent = `Final score: ${Math.floor(score).toLocaleString()}. The squadron is ready when you are.`;
    startButton.innerHTML = "Fly again <span>→</span>";
    overlay.classList.remove("hidden");
  }

  function togglePause() {
    if (state === "playing") {
      state = "paused";
      panelKicker.textContent = "Flight suspended";
      panelTitle.textContent = "Paused";
      panelCopy.textContent = "Catch your breath. Your aircraft is holding position.";
      startButton.innerHTML = "Resume flight <span>→</span>";
      overlay.classList.remove("hidden");
    } else if (state === "paused") {
      state = "playing";
      overlay.classList.add("hidden");
      lastTime = performance.now();
    }
  }

  function createObstacle() {
    const type = Math.random() < 0.68 ? "plane" : "balloon";
    const speed = 225 + elapsed * 3.2 + random(0, 60);
    const y = random(100, HEIGHT - 85);

    obstacles.push({
      type,
      x: WIDTH + 80,
      y,
      width: type === "plane" ? 67 : 39,
      height: type === "plane" ? 31 : 58,
      speed,
      phase: random(0, Math.PI * 2),
      hit: false,
      nearMiss: false,
    });
  }

  function burst(x, y, color, count = 18) {
    for (let i = 0; i < count; i += 1) {
      const angle = random(0, Math.PI * 2);
      const speed = random(45, 230);
      particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: random(0.35, 0.85),
        maxLife: 0.85,
        size: random(2, 6),
        color,
      });
    }
  }

  function boxesOverlap(a, b, padding = 0) {
    return (
      a.x - a.width / 2 + padding < b.x + b.width / 2 - padding &&
      a.x + a.width / 2 - padding > b.x - b.width / 2 + padding &&
      a.y - a.height / 2 + padding < b.y + b.height / 2 - padding &&
      a.y + a.height / 2 - padding > b.y - b.height / 2 + padding
    );
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
    if (rightMouseDown) fireBullet();
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
    if (spawnTimer <= 0) {
      createObstacle();
      spawnTimer = Math.max(0.48, random(0.85, 1.45) - elapsed * 0.006);
    }

    for (let i = bullets.length - 1; i >= 0; i -= 1) {
      const bullet = bullets[i];
      bullet.x += bullet.speed * dt;

      let impact = false;
      for (let j = obstacles.length - 1; j >= 0; j -= 1) {
        const obstacle = obstacles[j];
        if (obstacle.hit) continue;
        if (!boxesOverlap(bullet, obstacle, 2)) continue;

        obstacle.hit = true;
        score += BULLET_SCORE;
        burst(obstacle.x, obstacle.y, obstacle.type === "balloon" ? "#ffb44a" : "#f1655f", 20);
        obstacles.splice(j, 1);
        impact = true;
        break;
      }

      if (impact || bullet.x > WIDTH + 40) bullets.splice(i, 1);
    }

    for (let i = obstacles.length - 1; i >= 0; i -= 1) {
      const obstacle = obstacles[i];
      obstacle.x -= obstacle.speed * dt;
      obstacle.phase += dt * 2.5;
      if (obstacle.type === "balloon") obstacle.y += Math.sin(obstacle.phase) * 18 * dt;

      if (!obstacle.hit && player.invulnerable <= 0 && boxesOverlap(player, obstacle, 7)) {
        obstacle.hit = true;
        health -= 1;
        player.invulnerable = 1.25;
        screenShake = 8;
        burst(player.x + 20, player.y, "#ffb44a", 24);
        updateHealth();
        if (health <= 0) {
          showGameOver();
          return;
        }
      }

      const nearDistance = Math.hypot(player.x - obstacle.x, player.y - obstacle.y);
      if (!obstacle.hit && !obstacle.nearMiss && obstacle.x < player.x && nearDistance < 105) {
        obstacle.nearMiss = true;
        score += 150;
        burst(obstacle.x, obstacle.y, "#59e6ff", 8);
      }

      if (obstacle.x < -100) obstacles.splice(i, 1);
    }

    for (let i = particles.length - 1; i >= 0; i -= 1) {
      const particle = particles[i];
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vx *= 0.98;
      particle.vy += 50 * dt;
      particle.life -= dt;
      if (particle.life <= 0) particles.splice(i, 1);
    }

    updateHud();
  }

  function drawBackground(time) {
    const gradient = ctx.createLinearGradient(0, 0, 0, HEIGHT);
    gradient.addColorStop(0, "#176fa8");
    gradient.addColorStop(0.56, "#56b8dd");
    gradient.addColorStop(1, "#b7e6ed");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    const sunGlow = ctx.createRadialGradient(780, 100, 10, 780, 100, 130);
    sunGlow.addColorStop(0, "rgba(255,245,195,.76)");
    sunGlow.addColorStop(1, "rgba(255,245,195,0)");
    ctx.fillStyle = sunGlow;
    ctx.fillRect(630, -50, 300, 300);

    for (const cloud of clouds) drawCloud(cloud);

    ctx.fillStyle = "rgba(24, 84, 121, .24)";
    ctx.beginPath();
    ctx.moveTo(0, HEIGHT);
    for (let x = 0; x <= WIDTH; x += 80) {
      const y = 490 + Math.sin(x * 0.012 + time * 0.00005) * 20;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(WIDTH, HEIGHT);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = "rgba(222, 250, 255, .18)";
    ctx.lineWidth = 1;
    for (const streak of streaks) {
      ctx.beginPath();
      ctx.moveTo(streak.x, streak.y);
      ctx.lineTo(streak.x + streak.length, streak.y);
      ctx.stroke();
    }
  }

  function drawCloud(cloud) {
    ctx.save();
    ctx.globalAlpha = cloud.alpha;
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

  function drawBalloon(obstacle) {
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
      const glow = ctx.createLinearGradient(
        bullet.x - bullet.width / 2,
        bullet.y,
        bullet.x + bullet.width / 2,
        bullet.y
      );
      glow.addColorStop(0, "rgba(255, 228, 120, 0)");
      glow.addColorStop(0.35, "#ffe27a");
      glow.addColorStop(1, "#fff8d8");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.roundRect(
        bullet.x - bullet.width / 2,
        bullet.y - bullet.height / 2,
        bullet.width,
        bullet.height,
        3
      );
      ctx.fill();
    }
  }

  function draw(time) {
    ctx.save();
    if (screenShake > 0) ctx.translate(random(-screenShake, screenShake), random(-screenShake, screenShake));
    drawBackground(time);

    for (const obstacle of obstacles) {
      if (obstacle.type === "plane") {
        drawPlane(obstacle.x, obstacle.y, 0.82, obstacle.hit ? "#7b8990" : "#f1655f", -1, 0);
      } else {
        drawBalloon(obstacle);
      }
    }

    drawBullets();

    if (state !== "gameover" || health > 0) {
      const blink = player.invulnerable > 0 && Math.floor(player.invulnerable * 12) % 2 === 0;
      if (!blink) drawPlane(player.x, player.y, 1, "#edf8ff", 1, player.tilt);
    }

    drawParticles();
    ctx.restore();
  }

  function gameLoop(time) {
    const dt = Math.min((time - lastTime) / 1000, 0.033) || 0;
    lastTime = time;
    if (state === "playing") update(dt);
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
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(event.code)) {
      event.preventDefault();
    }

    if (event.code === "KeyP" && !event.repeat) {
      togglePause();
      return;
    }

    if ((event.code === "Enter" || event.code === "Space") && !event.repeat && state !== "playing") {
      state === "paused" ? togglePause() : startGame();
      return;
    }

    keys.add(event.code);
  });

  window.addEventListener("keyup", (event) => keys.delete(event.code));
  window.addEventListener("blur", () => {
    keys.clear();
    rightMouseDown = false;
    if (state === "playing") togglePause();
  });

  canvas.addEventListener("contextmenu", (event) => {
    event.preventDefault();
  });

  canvas.addEventListener("pointerdown", (event) => {
    if (event.button === 2) {
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
    state === "paused" ? togglePause() : startGame();
  });

  initializeSky();
  updateHealth();
  updateHud();
  requestAnimationFrame(gameLoop);
})();
