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

  // =========================
  // AUDIO (SIN ARCHIVOS) - WebAudio
  // =========================
  let musicEnabled = false;
  let audioUnlocked = false;

  /** @type {AudioContext|null} */
  let audioCtx = null;
  let musicTimer = null;
  let musicGain = null;

  const clamp01 = (v) => Math.max(0, Math.min(1, v));

  function ensureAudioCtx() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    return audioCtx;
  }

  async function unlockAudioOnce() {
    if (audioUnlocked) return;
    try {
      const ac = ensureAudioCtx();
      if (ac.state === "suspended") await ac.resume();
      audioUnlocked = true;
    } catch (_) {
      audioUnlocked = false;
    }
  }

  function beep({ freq = 440, dur = 0.08, type = "sine", vol = 0.25, glideTo = null }) {
    if (!audioUnlocked) return;
    const ac = ensureAudioCtx();

    const o = ac.createOscillator();
    const g = ac.createGain();

    const now = ac.currentTime;
    const end = now + dur;

    o.type = type;
    o.frequency.setValueAtTime(freq, now);

    if (glideTo) {
      o.frequency.exponentialRampToValueAtTime(glideTo, end);
    }

    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(clamp01(vol), now + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, end);

    o.connect(g);
    g.connect(ac.destination);

    o.start(now);
    o.stop(end + 0.01);
  }

  function playHit() {
    // SFX gamer: doble "blip" corto
    beep({ freq: 860, glideTo: 520, dur: 0.07, type: "triangle", vol: 0.28 });
    setTimeout(() => beep({ freq: 520, glideTo: 980, dur: 0.05, type: "square", vol: 0.18 }), 35);
  }

  function stopMusicSynth() {
    if (musicTimer) {
      clearInterval(musicTimer);
      musicTimer = null;
    }
    if (musicGain && audioCtx) {
      const now = audioCtx.currentTime;
      musicGain.gain.cancelScheduledValues(now);
      musicGain.gain.setValueAtTime(musicGain.gain.value, now);
      musicGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
    }
  }

  function startMusicSynth() {
    if (!audioUnlocked) return;
    const ac = ensureAudioCtx();

    if (!musicGain) {
      musicGain = ac.createGain();
      musicGain.gain.value = 0.0001;
      musicGain.connect(ac.destination);
    }

    const now = ac.currentTime;
    musicGain.gain.cancelScheduledValues(now);
    musicGain.gain.setValueAtTime(0.0001, now);
    musicGain.gain.exponentialRampToValueAtTime(0.12, now + 0.12);

    // Secuencia simple (arpegio loop) - suena "retro"
    const scale = [261.63, 311.13, 392.0, 466.16, 523.25, 622.25, 784.0]; // C, Eb, G, Bb, C, Eb, G
    let step = 0;

    const bpm = 132;
    const intervalMs = Math.round((60_000 / bpm) / 2); // corcheas

    musicTimer = setInterval(() => {
      if (!musicEnabled || paused) return;

      const base = scale[step % scale.length];
      const accent = (step % 8 === 0);

      // Nota principal
      {
        const o = ac.createOscillator();
        const g = ac.createGain();
        const t = ac.currentTime;

        o.type = "sawtooth";
        o.frequency.setValueAtTime(base, t);

        const v = accent ? 0.11 : 0.07;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(v, t + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);

        o.connect(g);
        g.connect(musicGain);

        o.start(t);
        o.stop(t + 0.13);
      }

      // Nota de apoyo (octava/cinco)
      if (step % 2 === 0) {
        const o2 = ac.createOscillator();
        const g2 = ac.createGain();
        const t2 = ac.currentTime;

        o2.type = "square";
        o2.frequency.setValueAtTime(base * 2, t2);

        g2.gain.setValueAtTime(0.0001, t2);
        g2.gain.exponentialRampToValueAtTime(0.035, t2 + 0.01);
        g2.gain.exponentialRampToValueAtTime(0.0001, t2 + 0.09);

        o2.connect(g2);
        g2.connect(musicGain);

        o2.start(t2);
        o2.stop(t2 + 0.1);
      }

      step++;
    }, intervalMs);
  }

  async function toggleMusic() {
    musicEnabled = !musicEnabled;
    btnMusic.textContent = `Música: ${musicEnabled ? "ON" : "OFF"}`;

    await unlockAudioOnce();
    if (!audioUnlocked) return;

    if (!musicEnabled) {
      stopMusicSynth();
      return;
    }

    stopMusicSynth();
    startMusicSynth();
  }

  // Desbloquea audio al primer gesto del usuario (por políticas del navegador)
  window.addEventListener(
    "pointerdown",
    () => {
      unlockAudioOnce();
    },
    { once: true }
  );

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
    return dx * dx + dy * dy <= r * r;
  }

  // =========================
  // PALETA DE COLORES
  // =========================
  const PALETTE = [
    { base: "rgba(124,58,237,0.90)", hover: "rgba(34,211,238,0.98)", glow: "rgba(34,211,238,0.14)" },
    { base: "rgba(255,61,127,0.90)", hover: "rgba(249,115,22,0.98)", glow: "rgba(255,61,127,0.14)" },
    { base: "rgba(34,197,94,0.90)", hover: "rgba(34,211,238,0.98)", glow: "rgba(34,197,94,0.14)" },
    { base: "rgba(59,130,246,0.90)", hover: "rgba(124,58,237,0.98)", glow: "rgba(59,130,246,0.14)" },
    { base: "rgba(249,115,22,0.90)", hover: "rgba(255,61,127,0.98)", glow: "rgba(249,115,22,0.14)" }
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

      this.isHovered = isPointInCircle(mouse.x, mouse.y, this.x, this.y, this.r);
    }

    draw() {
      ctx.save();
      ctx.globalAlpha = clamp(this.alpha, 0, 1);

      // Glow
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

      // Highlight
      ctx.beginPath();
      ctx.arc(this.x - this.r * 0.25, this.y - this.r * 0.25, Math.max(2, this.r * 0.18), 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,255,255,0.25)";
      ctx.fill();

      ctx.restore();
    }

    startFade() {
      this.isFading = true;
    }

    isDead() {
      return this.alpha <= 0 || this.y + this.r < 0;
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
      const r = rand(10, 24);

      const x = rand(r, canvas.width - r);
      const y = canvas.height + rand(r + 10, 120);

      const vx = rand(-0.45, 0.45) * (1 + currentLevel * 0.03);
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
    await unlockAudioOnce();
    // si el usuario ya activó música y estaba pausada por unlock, reanuda
    if (musicEnabled && audioUnlocked && !musicTimer) startMusicSynth();

    const pos = getMousePos(e);

    for (let i = circles.length - 1; i >= 0; i--) {
      const c = circles[i];
      if (!c.isFading && isPointInCircle(pos.x, pos.y, c.x, c.y, c.r)) {
        c.startFade();
        removedCount++;
        playHit(); // 🔊 SFX sin archivos
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

    const grd = ctx.createLinearGradient(0, 0, 0, canvas.height);
    grd.addColorStop(0, "rgba(124,58,237,0.05)");
    grd.addColorStop(0.5, "rgba(34,211,238,0.04)");
    grd.addColorStop(1, "rgba(255,61,127,0.04)");
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

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

      circles.forEach((c) => c.update());
      circles.forEach((c) => c.draw());

      circles = circles.filter((c) => !c.isDead());

      if (circles.length === 0 && spawnedCount < TOTAL_CIRCLES) {
        if (spawnedCount !== 0 && spawnedCount % GROUP_SIZE === 0) {
          currentLevel = clamp(currentLevel + 1, 1, TOTAL_LEVELS);
          // mini sfx al subir nivel (sin archivos)
          if (audioUnlocked) beep({ freq: 330, glideTo: 660, dur: 0.12, type: "triangle", vol: 0.18 });
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

    // si está pausado, baja música; si reanuda, vuelve
    if (musicEnabled && audioUnlocked) {
      if (paused) stopMusicSynth();
      else {
        stopMusicSynth();
        startMusicSynth();
      }
    }
  });

  btnRestart.addEventListener("click", () => resetGame());

  btnMusic.addEventListener("click", () => toggleMusic());

  groupSelect.addEventListener("change", () => {
    GROUP_SIZE = parseInt(groupSelect.value, 10);
    recalcLevels();
    resetGame();
  });

  function resetGame() {
    circles = [];
    removedCount = 0;
    spawnedCount = 0;

    currentLevel = 1;

    paused = false;
    btnPause.textContent = "Pausar";

    recalcLevels();
    updateUI();
    spawnGroup();

    if (musicEnabled && audioUnlocked) {
      stopMusicSynth();
      startMusicSynth();
    }
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
