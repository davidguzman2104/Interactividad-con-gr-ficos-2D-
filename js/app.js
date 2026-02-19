// js/app.js
(() => {
  // =========================
  // CONFIGURACIÓN DE NEGOCIO
  // =========================
  const TOTAL_CIRCLES = 150;
  let GROUP_SIZE = 10; // configurable (10/15/20)
  let TOTAL_LEVELS = Math.ceil(TOTAL_CIRCLES / GROUP_SIZE);

  // Velocidad base y cómo aumenta por nivel
  const BASE_SPEED = 0.55;
  const SPEED_PER_LEVEL = 0.12;

  // Fade out (desaparece lentamente)
  const FADE_SPEED = 0.04;

  // =========================
  // CANVAS + UI
  // =========================
  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d");

  const yearEl = document.getElementById("year");
  const removedText = document.getElementById("removedText");
  const removedBar = document.getElementById("removedBar");
  const removedPct = document.getElementById("removedPct");

  const levelsText = document.getElementById("levelsText");
  const levelsBar = document.getElementById("levelsBar");
  const levelBadge = document.getElementById("levelBadge");
  const levelHint = document.getElementById("levelHint");

  const countBadge = document.getElementById("countBadge");
  const spawnBadge = document.getElementById("spawnBadge");

  const btnPause = document.getElementById("btnPause");
  const btnRestart = document.getElementById("btnRestart");

  // selector de objetos por nivel + música
  const groupSelect = document.getElementById("groupSelect");
  const btnMusic = document.getElementById("btnMusic");
  const bgMusic = document.getElementById("bgMusic");
  const hitSfx = document.getElementById("hitSfx");

  yearEl.textContent = new Date().getFullYear();

  // =========================
  // ESTADO GLOBAL
  // =========================
  let circles = [];
  let removedCount = 0;
  let spawnedCount = 0;

  let currentLevel = 1; // ✅ siempre inicia en nivel 1

  let paused = false;
  let mouse = { x: -9999, y: -9999 };

  // audio state
  let musicEnabled = false;
  let audioUnlocked = false;

  // =========================
  // UTILIDADES
  // =========================
  const rand = (min, max) => Math.random() * (max - min) + min;

  function getSpeedForLevel(level) {
    return BASE_SPEED + (level - 1) * SPEED_PER_LEVEL;
  }

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  function isPointInCircle(px, py, cx, cy, r) {
    const dx = px - cx;
    const dy = py - cy;
    return (dx * dx + dy * dy) <= (r * r);
  }

  // =========================
  // AUDIO (unlock + play helpers)
  // =========================
  async function unlockAudioOnce() {
    if (audioUnlocked) return;
    try {
      // ======= 🔊 AGREGA AQUÍ LA RUTA DEL SONIDO =======
      // Coloca tu archivo en: assets/audio/hit.mp3 (o cambia el nombre)
     if (!hitSfx.src) hitSfx.src = "assets/audio/hit.wav";


      hitSfx.volume = 0.9;
      hitSfx.currentTime = 0;
      await hitSfx.play();
      hitSfx.pause();
      hitSfx.currentTime = 0;

      bgMusic.volume = 0.35;
      audioUnlocked = true;
    } catch (_) {
      audioUnlocked = false;
    }
  }

  function toggleMusic() {
    musicEnabled = !musicEnabled;
    btnMusic.textContent = `Música: ${musicEnabled ? "ON" : "OFF"}`;

    if (!musicEnabled) {
      bgMusic.pause();
      bgMusic.currentTime = 0;
      return;
    }

    unlockAudioOnce().finally(() => {
      if (audioUnlocked) bgMusic.play().catch(() => {});
    });
  }

  function playHit() {
    unlockAudioOnce().finally(() => {
      try {
        hitSfx.currentTime = 0;
        hitSfx.play().catch(() => {});
      } catch (_) {}
    });
  }

  // =========================
  // PALETA DE COLORES (más bonita)
  // =========================
  const PALETTE = [
    { base: "rgba(124,58,237,0.90)", hover: "rgba(34,211,238,0.98)", glow: "rgba(34,211,238,0.14)" },  // morado -> cian
    { base: "rgba(255,61,127,0.90)", hover: "rgba(249,115,22,0.98)", glow: "rgba(255,61,127,0.14)" },  // rosa -> naranja
    { base: "rgba(34,197,94,0.90)",  hover: "rgba(34,211,238,0.98)", glow: "rgba(34,197,94,0.14)" },   // verde -> cian
    { base: "rgba(59,130,246,0.90)", hover: "rgba(124,58,237,0.98)", glow: "rgba(59,130,246,0.14)" },   // azul -> morado
    { base: "rgba(249,115,22,0.90)", hover: "rgba(255,61,127,0.98)", glow: "rgba(249,115,22,0.14)" }    // naranja -> rosa
  ];

  function pickPalette() {
    return PALETTE[Math.floor(rand(0, PALETTE.length))];
  }

  // =========================
  // CÍRCULO (OBJETO 2D)
  // =========================
  class Circle {
    constructor(x, y, r, vx, vy) {
      this.x = x;
      this.y = y;
      this.r = r;

      this.vx = vx;
      this.vy = vy;

      // ✅ colores más bonitos y variados
      const p = pickPalette();
      this.baseColor = p.base;
      this.hoverColor = p.hover;
      this.glowColor = p.glow;

      this.alpha = 1;
      this.isFading = false;
      this.isHovered = false;
    }

    update() {
      if (!this.isFading) {
        this.x += this.vx;
        this.y += this.vy;
      } else {
        this.alpha -= FADE_SPEED;
      }

      // Rebote lateral suave
      if (this.x - this.r < 0) {
        this.x = this.r;
        this.vx *= -1;
      }
      if (this.x + this.r > canvas.width) {
        this.x = canvas.width - this.r;
        this.vx *= -1;
      }

      // Hover
      this.isHovered = isPointInCircle(mouse.x, mouse.y, this.x, this.y, this.r);
    }

    draw() {
      ctx.save();
      ctx.globalAlpha = clamp(this.alpha, 0, 1);

      // Glow (más pro y con el color del círculo)
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.r + 7, 0, Math.PI * 2);
      ctx.fillStyle = this.isHovered ? "rgba(255,255,255,0.10)" : this.glowColor;
      ctx.fill();

      // Body
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
      ctx.fillStyle = this.isHovered ? this.hoverColor : this.baseColor;
      ctx.fill();

      // Ring
      ctx.lineWidth = 2;
      ctx.strokeStyle = this.isHovered ? "rgba(255,255,255,0.26)" : "rgba(255,255,255,0.16)";
      ctx.stroke();

      // Tiny highlight
      ctx.beginPath();
      ctx.arc(
        this.x - this.r * 0.25,
        this.y - this.r * 0.25,
        Math.max(2, this.r * 0.18),
        0,
        Math.PI * 2
      );
      ctx.fillStyle = "rgba(255,255,255,0.25)";
      ctx.fill();

      ctx.restore();
    }

    startFade() {
      this.isFading = true;
    }

    isDead() {
      return this.alpha <= 0 || (this.y + this.r) < 0;
    }
  }

  // =========================
  // SPAWN POR NIVELES
  // =========================
  function recalcLevels() {
    TOTAL_LEVELS = Math.ceil(TOTAL_CIRCLES / GROUP_SIZE);
    currentLevel = clamp(currentLevel, 1, TOTAL_LEVELS);
  }

  function spawnGroup() {
    if (spawnedCount >= TOTAL_CIRCLES) return;

    const remaining = TOTAL_CIRCLES - spawnedCount;
    const toSpawn = Math.min(GROUP_SIZE, remaining);

    const speed = getSpeedForLevel(currentLevel);

    for (let i = 0; i < toSpawn; i++) {
      // ✅ varios tamaños (ya estaba, se mantiene)
      const r = rand(10, 24);

      // Nacen debajo del canvas
      const x = rand(r, canvas.width - r);
      const y = canvas.height + rand(r + 10, 120);

      // Direcciones distintas
      const vx = rand(-0.45, 0.45) * (1 + currentLevel * 0.03);

      // Siempre hacia arriba, más rápido por nivel
      const vy = -speed * rand(0.9, 1.25);

      circles.push(new Circle(x, y, r, vx, vy));
      spawnedCount++;
    }

    updateUI();
  }

  // =========================
  // UI / ESTADÍSTICAS
  // =========================
  function updateUI() {
    const pct = TOTAL_CIRCLES === 0 ? 0 : Math.round((removedCount / TOTAL_CIRCLES) * 100);
    removedText.textContent = `${removedCount}`;
    removedPct.textContent = `${pct}%`;
    removedBar.style.width = `${pct}%`;

    levelsText.textContent = `${currentLevel} / ${TOTAL_LEVELS}`;
    levelBadge.textContent = `Nivel: ${currentLevel}/${TOTAL_LEVELS}`;

    // ✅ progreso más coherente (nivel actual / total)
    levelsBar.style.width = `${Math.round((currentLevel / TOTAL_LEVELS) * 100)}%`;

    levelHint.textContent = `Velocidad: ${getSpeedForLevel(currentLevel).toFixed(2)} • Objetos/Nivel: ${GROUP_SIZE}`;

    countBadge.textContent = `En pantalla: ${circles.length}`;
    spawnBadge.textContent = `Generados: ${spawnedCount}/${TOTAL_CIRCLES}`;
  }

  // =========================
  // EVENTOS (MOUSE)
  // =========================
  function getMousePos(evt) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    return {
      x: (evt.clientX - rect.left) * scaleX,
      y: (evt.clientY - rect.top) * scaleY
    };
  }

  canvas.addEventListener("mousemove", (e) => {
    mouse = getMousePos(e);
  });

  canvas.addEventListener("mouseleave", () => {
    mouse = { x: -9999, y: -9999 };
  });

  canvas.addEventListener("click", async (e) => {
    if (!audioUnlocked) await unlockAudioOnce();
    if (musicEnabled && audioUnlocked && bgMusic.paused) bgMusic.play().catch(() => {});

    const pos = getMousePos(e);

    for (let i = circles.length - 1; i >= 0; i--) {
      const c = circles[i];
      if (!c.isFading && isPointInCircle(pos.x, pos.y, c.x, c.y, c.r)) {
        c.startFade();
        removedCount++;
        playHit(); // 🔊 sonido al eliminar
        updateUI();
        break;
      }
    }
  });

  // =========================
  // LOOP PRINCIPAL
  // =========================
  function clear() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Fondo gamer suave
    const grd = ctx.createLinearGradient(0, 0, 0, canvas.height);
    grd.addColorStop(0, "rgba(124,58,237,0.05)");
    grd.addColorStop(0.5, "rgba(34,211,238,0.04)");
    grd.addColorStop(1, "rgba(255,61,127,0.04)");
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // estrellas
    ctx.save();
    ctx.globalAlpha = 0.35;
    for (let i = 0; i < 36; i++) {
      const x = (i * 73) % canvas.width;
      const y = (i * 41) % canvas.height;
      ctx.fillStyle = "rgba(255,255,255,0.06)";
      ctx.fillRect(x, y, 2, 2);
    }
    ctx.restore();
  }

  function tick() {
    if (!paused) {
      clear();

      circles.forEach(c => c.update());
      circles.forEach(c => c.draw());

      circles = circles.filter(c => !c.isDead());

      // ✅ SUBIR DE NIVEL SOLO CUANDO SE TERMINA EL GRUPO (ya no hay objetos en pantalla)
      if (circles.length === 0 && spawnedCount < TOTAL_CIRCLES) {
        // si ya se generó al menos un grupo y tocaba cambiar de nivel, sube antes de spawnear el nuevo grupo
        if (spawnedCount !== 0 && (spawnedCount % GROUP_SIZE === 0)) {
          currentLevel = clamp(currentLevel + 1, 1, TOTAL_LEVELS);
        }
        spawnGroup();
      }

      if (spawnedCount >= TOTAL_CIRCLES && circles.length === 0) {
        ctx.save();
        ctx.fillStyle = "rgba(255,255,255,0.85)";
        ctx.font = "800 34px system-ui, -apple-system, Segoe UI, Roboto, Arial";
        ctx.textAlign = "center";
        ctx.fillText("¡COMPLETADO!", canvas.width / 2, canvas.height / 2 - 10);

        ctx.fillStyle = "rgba(255,255,255,0.65)";
        ctx.font = "500 16px system-ui, -apple-system, Segoe UI, Roboto, Arial";
        ctx.fillText("Reinicia para volver a jugar.", canvas.width / 2, canvas.height / 2 + 22);
        ctx.restore();
      }

      updateUI();
    }

    requestAnimationFrame(tick);
  }

  // =========================
  // CONTROLES
  // =========================
  btnPause.addEventListener("click", () => {
    paused = !paused;
    btnPause.textContent = paused ? "Reanudar" : "Pausar";
  });

  btnRestart.addEventListener("click", () => resetGame());

  btnMusic.addEventListener("click", () => toggleMusic());

  groupSelect.addEventListener("change", () => {
    GROUP_SIZE = parseInt(groupSelect.value, 10); // ✅ 10/15/20
    recalcLevels();
    resetGame(); // aplica el nuevo grupo desde nivel 1
  });

  function resetGame() {
    circles = [];
    removedCount = 0;
    spawnedCount = 0;

    currentLevel = 1; // ✅ reinicia siempre en nivel 1

    paused = false;
    btnPause.textContent = "Pausar";

    recalcLevels();
    updateUI();
    spawnGroup();
  }

  // =========================
  // INIT
  // =========================
  function init() {
    recalcLevels();
    updateUI();
    spawnGroup();
    tick();
  }

  init();
})();
