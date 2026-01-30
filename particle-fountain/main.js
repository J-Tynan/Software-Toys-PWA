// Particle Fountain Simulator - Bursts colorful particles with types, gravity, interactions, fireworks mode
document.addEventListener('DOMContentLoaded', () => {
  loadGlobalTheme(); // From shared/utils.js

  const canvas = document.getElementById('canvas');
  let width = window.innerWidth;
  let height = window.innerHeight;
  canvas.width = width;
  canvas.height = height;

  // Basic renderer variables declared early so layout helper can reference them
  let ctx = null;
  let gl = null;
  let useWebGL = false;

  // Layout helper: ensure the canvas sits between the header and the control panel
  // so it never overlaps header/footer UI. This prevents particles from drawing
  // under UI and keeps pointer coords consistent.
  function updateCanvasLayout() {
    const hdr = document.querySelector('div.fixed.top-0');
    const ctrl = document.getElementById('control-panel');

    const top = hdr ? Math.ceil(hdr.getBoundingClientRect().bottom) : 0;
    const bottom = ctrl ? Math.ceil(ctrl.getBoundingClientRect().height) : 0;

    canvas.style.position = 'absolute';
    canvas.style.top = top + 'px';
    canvas.style.left = '0px';
    canvas.style.width = '100%';
    canvas.style.height = `calc(100% - ${top + bottom}px)`;

    const dpr = Math.max(1, Math.round(window.devicePixelRatio || 1));
    const cssWidth = window.innerWidth;
    const cssHeight = Math.max(100, window.innerHeight - top - bottom);

    canvas.width = Math.floor(cssWidth * dpr);
    canvas.height = Math.floor(cssHeight * dpr);

    // Ensure 2D context draws in CSS pixels
    if (!useWebGL) {
      ctx = canvas.getContext('2d', { alpha: true });
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    } else if (gl) {
      // Update WebGL viewport
      gl.viewport(0, 0, canvas.width, canvas.height);
    }

    width = cssWidth;
    height = cssHeight;
  }

  // Initialize layout and respond to resizes
  updateCanvasLayout();
  window.addEventListener('resize', updateCanvasLayout);

  let program, positionLoc, colorLoc, sizeLoc;
  let posBuf = null, colorBuf = null, sizeBuf = null; // WebGL buffers
  gl = canvas.getContext('webgl') || canvas.getContext('webgl2');
  if (gl) {
    useWebGL = true;
    gl.clearColor(0, 0, 0, 0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    console.log('Using GPU WebGL for particles');
    const vsSource = `
      attribute vec2 aPosition;
      attribute vec4 aColor;
      attribute float aSize;
      varying vec4 vColor;
      void main() {
        gl_Position = vec4(aPosition * vec2(2.0 / ${width}.0, 2.0 / ${height}.0) - vec2(1.0, 1.0), 0.0, 1.0);
        gl_PointSize = aSize;
        vColor = aColor;
      }
    `;
    const fsSource = `
      precision mediump float;
      varying vec4 vColor;
      void main() {
        gl_FragColor = vColor;
      }
    `;
    const shader = (type, source) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, source);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) console.error(gl.getShaderInfoLog(s));
      return s;
    };
    program = gl.createProgram();
    gl.attachShader(program, shader(gl.VERTEX_SHADER, vsSource));
    gl.attachShader(program, shader(gl.FRAGMENT_SHADER, fsSource));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) console.error(gl.getProgramInfoLog(program));
    gl.useProgram(program);
    positionLoc = gl.getAttribLocation(program, 'aPosition');
    colorLoc = gl.getAttribLocation(program, 'aColor');
    sizeLoc = gl.getAttribLocation(program, 'aSize');

    // Create reusable buffers to avoid binding errors on bufferData
    posBuf = gl.createBuffer();
    colorBuf = gl.createBuffer();
    sizeBuf = gl.createBuffer();

    // Ensure layout/viewport is updated now that WebGL is active
    updateCanvasLayout();
  } else {
    ctx = canvas.getContext('2d', { alpha: true });
    console.log('Fallback to 2D Canvas');
  }

  const loadingOverlay = document.getElementById('loading-overlay');

  // Params (localStorage saved)
  // Default particleCount is reduced to avoid accidental massive spawns on confetti
  let particleCount = parseInt(localStorage.getItem('particleCount') || 100);
  let gravity = parseFloat(localStorage.getItem('gravity') || 0.05);
  let speedMultiplier = parseFloat(localStorage.getItem('speedMultiplier') || 1);
  let isPaused = false;
  let fountainType = localStorage.getItem('fountainType') || 'confetti';
  let colorPreset = localStorage.getItem('colorPreset') || 'rainbow';
  let fireworkSubType = localStorage.getItem('fireworkSubType') || 'burst'; // 'burst', 'sparkler', 'rocket'

  // Confetti-specific tweaks (persisted)
  let confettiShredDensity = parseFloat(localStorage.getItem('confettiShredDensity') || '0.01'); // probability (0..1)
  let confettiRotationEnabled = (localStorage.getItem('confettiRotationEnabled') !== 'false'); // default true

  // Firework-specific tweaks
  // Fireworks now auto-explode within the upper 40% of the canvas. Users can pick subtype and adjust per-firework particle budget.
  // fireworkParticleMode: 0 = Fewer, 1 = Default, 2 = More
  let fireworkParticleMode = parseInt(localStorage.getItem('fireworkParticleMode') || '1', 10);
  let fireworkTrailsEnabled = (localStorage.getItem('fireworkTrailsEnabled') !== 'false');

  // Aurora-specific tweaks
  let auroraWaveFrequency = parseFloat(localStorage.getItem('auroraWaveFrequency') || '1.0');
  let auroraPulseEnabled = (localStorage.getItem('auroraPulseEnabled') !== 'false');

  // Status message
  const statusMsg = document.createElement('div');
  statusMsg.className = 'text-center text-sm mt-2';

  // Particle pool
  const maxParticles = 10000;
  const particles = [];
  for (let i = 0; i < maxParticles; i++) {
    particles.push({ active: false });
  }

  // Visual flashes for 2D (e.g., firework HDR pulse)
  const flashEvents = [];

  // 'Tap screen to start' non-blocking hint — disappears on first interaction
  const tapOverlay = document.createElement('div');
  tapOverlay.id = 'tap-to-start';
  tapOverlay.className = 'fixed inset-0 flex items-center justify-center pointer-events-none z-10';
  tapOverlay.innerHTML = `<div class="bg-base-100/80 p-4 rounded shadow text-center"><p class="text-lg">Tap screen to start</p></div>`;
  document.body.appendChild(tapOverlay);
  let started = false;

  // Emit burst (type-specific)
  function emitBurst(x, y, count = particleCount) {
    // Avoid creating more particles than we're willing to manage. For performance
    // we cap the number of active particles depending on renderer.
    const currentActive = particles.reduce((n,p) => p.active ? n+1 : n, 0);
    const maxActive = (useWebGL ? 8000 : 2500);
    const available = Math.max(0, maxActive - currentActive);

    // For confetti, prefer smaller bursts
    const perBurstConfettiCap = 60;
    let desired = Math.min(count, available);
    if (fountainType === 'confetti') desired = Math.min(desired, perBurstConfettiCap);
    if (desired <= 0) return; // nothing to spawn

    for (let i = 0; i < desired; i++) {
      const p = particles.find(p => !p.active) || particles[0];
      p.active = true;
      p.x = x;
      p.y = y;
      p.vx = utils.random(-3, 3);
      p.vy = utils.random(-6, -3);
      p.size = utils.random(2, 6);
      p.life = utils.random(40, 80);
      p.color = getColorFromPreset();
      p.rotation = utils.random(0, Math.PI * 2);
      p.angularVel = utils.random(-0.1, 0.1);
      p.explodeTime = -1;
      p.waveAmp = 0;
      p.trailLength = 0;

      if (fountainType === 'confetti') {
        p.vy = utils.random(-4, -2);
      } else if (fountainType === 'firework') {
        p.explodeTime = utils.random(20, 40);
        // Choose a random target Y within the upper 40% of the canvas so fireworks explode near the top
        p.explodeTargetY = utils.random(0, height * 0.4);
        if (fireworkSubType === 'sparkler') p.trailLength = 5;
        if (fireworkSubType === 'rocket') p.vy = utils.random(-10, -8);
        if (fireworkSubType === 'burst') p.vx *= 1.5;
      } else if (fountainType === 'aurora') {
        // Aurora particles float gently and have a per-particle phase and frequency
        p.vy = utils.random(-0.1, 0.1);
        p.waveAmp = utils.random(20, 50);
        p.angularVel = 0;
        p.phase = utils.random(0, Math.PI * 2);
        p.waveFreq = auroraWaveFrequency * utils.random(0.75, 1.25);
        p.life = utils.random(80, 160);
        p.initialLife = p.life;
        p.size = utils.random(2, 8);
        p.color = getColorFromPreset();
      }
      if (isSoundEnabled()) playBurstSound();
      if (isVibrationEnabled() && 'vibrate' in navigator) navigator.vibrate(30);
    }
  }

  // Color from preset
  function getColorFromPreset() {
    const hue = utils.random(0, 360);
    switch (colorPreset) {
      case 'rainbow': return `hsl(${hue}, 100%, 50%)`;
      case 'fireworks': return `hsl(${utils.random(0, 60)}, 100%, 50%)`;
      case 'pastel': return `hsl(${hue}, 50%, 80%)`;
      default: return 'hsl(0, 100%, 50%)';
    }
  }

  // Convert CSS color (hex, rgb(), hsl()) to {r,g,b} object with 0-255 ints
  function cssToRgbObj(css) {
    if (!css || typeof css !== 'string') return { r: 0, g: 0, b: 0 };
    css = css.trim();
    // hex
    if (css[0] === '#') {
      const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(css);
      if (m) return { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) };
    }
    // rgb()
    let m = /rgb\(\s*([0-9]+)\s*,\s*([0-9]+)\s*,\s*([0-9]+)\s*\)/i.exec(css);
    if (m) return { r: parseInt(m[1], 10), g: parseInt(m[2], 10), b: parseInt(m[3], 10) };
    // hsl()
    m = /hsl\s*\(\s*([0-9.]+)\s*,\s*([0-9.]+)%\s*,\s*([0-9.]+)%/i.exec(css);
    if (m) {
      const h = parseFloat(m[1]) / 360;
      const s = parseFloat(m[2]) / 100;
      const l = parseFloat(m[3]) / 100;
      // HSL to RGB
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      function hue2rgb(p_, q_, t) {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1/6) return p_ + (q_ - p_) * 6 * t;
        if (t < 1/2) return q_;
        if (t < 2/3) return p_ + (q_ - p_) * (2/3 - t) * 6;
        return p_;
      }
      const R = Math.round(255 * hue2rgb(p, q, h + 1/3));
      const G = Math.round(255 * hue2rgb(p, q, h));
      const B = Math.round(255 * hue2rgb(p, q, h - 1/3));
      return { r: R, g: G, b: B };
    }
    return { r: 0, g: 0, b: 0 };
  }

  // Sound burst (guard creation — some browsers disallow auto-playing audio contexts)
  let audioCtx = null;
  try {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  } catch (e) {
    audioCtx = null;
  }

  function playBurstSound() {
    if (!audioCtx) return; // No audio available
    const osc = audioCtx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = utils.random(200, 500);
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    gain.gain.value = 0.2;
    osc.start();
    gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.2);
    osc.stop(audioCtx.currentTime + 0.2);
  }

  // Animation loop
  let lastTime = 0;
  let fps = 60;
  let fpsCount = 0;
  let fpsLast = performance.now();
  function animate(time) {
    if (isPaused || !started) return requestAnimationFrame(animate);
    let delta = (time - lastTime) / 16.67;
    lastTime = time;
    delta = Math.min(delta * speedMultiplier, 2);

    if (useWebGL) {
      gl.clear(gl.COLOR_BUFFER_BIT);
      let positions = new Float32Array(maxParticles * 2);
      let colors = new Float32Array(maxParticles * 4);
      let sizes = new Float32Array(maxParticles);
      let activeCount = 0;
      particles.forEach(p => {
        if (!p.active) return;

        // Shared physics update — keeps WebGL and 2D behavior consistent
        // Returns true if still active after update
        (function applyPhysics(p) {
          // Aurora floats without gravity and uses sine-based magnetic motion
          if (fountainType !== 'aurora') {
            p.vy += gravity * delta;
          } else {
            // Sine-based lateral push (magnetic-like forces)
            p.vx += Math.sin((time / 1000) * (p.waveFreq || auroraWaveFrequency) + (p.phase || 0)) * 0.04;
            // gentle vertical damping so particles drift slowly
            p.vy *= 0.995;
          }

          p.x += p.vx * delta;
          p.y += p.vy * delta;
          p.size *= 0.995;
          p.life -= delta;
          p.rotation += p.angularVel * delta;

          if (fountainType === 'confetti') {
            p.vy += (confettiRotationEnabled ? 0.01 : 0) * Math.sin(p.rotation);
            // Shred chance controlled by settings
            if (p.life < 20 && utils.random(0, 1) < confettiShredDensity) emitBurst(p.x, p.y, 3);
          } else if (fountainType === 'firework') {
            // Explode either when the timer runs out or we've reached the upper-40% target
            if (p.explodeTime-- <= 0 || (typeof p.explodeTargetY !== 'undefined' && p.y <= p.explodeTargetY)) {
              const modeMul = (fireworkParticleMode === 0 ? 0.5 : (fireworkParticleMode === 2 ? 1.5 : 1));

              // Firework explosion behavior varies by subtype
              if (fireworkSubType === 'burst') {
                const base = 60;
                emitBurst(p.x, p.y, Math.min(Math.max(1, Math.floor(base * modeMul)), particleCount));
              } else if (fireworkSubType === 'sparkler') {
                const base = 30;
                emitBurst(p.x, p.y, Math.min(Math.max(1, Math.floor(base * modeMul)), particleCount));
                if (fireworkTrailsEnabled) {
                  // optional trails for sparkler (small smoke/trail burst)
                  emitBurst(p.x, p.y, Math.min(6, particleCount));
                }
              } else if (fireworkSubType === 'rocket') {
                const base = 20;
                emitBurst(p.x, p.y, Math.min(Math.max(1, Math.floor(base * modeMul)), particleCount));
                setTimeout(() => emitBurst(p.x + utils.random(-40, 40), p.y + utils.random(-40, 40), Math.min(Math.max(1, Math.floor(40 * modeMul)), particleCount)), 150);
              }

              // HDR flash: WebGL uses additive blending briefly; 2D uses flashEvents
              if (gl) {
                gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
                setTimeout(() => gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA), 120);
              }
              flashEvents.push({ x: p.x, y: p.y, t0: time, ttl: 150 });
            }
          } else if (fountainType === 'aurora') {
            // Per-particle sine lateral motion already applied via vx; add a larger wave displacement
            p.x += p.waveAmp * Math.sin((time / 1000) * (p.waveFreq || auroraWaveFrequency) + (p.phase || 0)) * delta * 0.5;
            const lifeFrac = p.life / (p.initialLife || 80);
            const pulse = auroraPulseEnabled ? (0.6 + 0.4 * Math.sin(time * 0.005 + (p.phase || 0))) : 1;
            const alpha = Math.max(0, Math.min(1, lifeFrac * pulse));
            p.color = `hsla(${ (time / 20 + p.x) % 360 }, 80%, 60%, ${alpha})`;
          }

          if (p.life <= 0 || p.size < 0.1) p.active = false;
        })(p);

        if (p.active) {
          positions[activeCount * 2] = p.x / width * 2 - 1;
          positions[activeCount * 2 + 1] = 1 - p.y / height * 2;
          const rgb = cssToRgbObj(p.color);
          colors[activeCount * 4] = rgb.r / 255;
          colors[activeCount * 4 + 1] = rgb.g / 255;
          colors[activeCount * 4 + 2] = rgb.b / 255;
          // Aurora uses per-particle life fraction and optional pulsing
          let alpha = Math.max(0, Math.min(1, p.life / (p.initialLife || 80)));
          if (fountainType === 'aurora' && auroraPulseEnabled) alpha *= (0.6 + 0.4 * Math.sin(time * 0.005 + (p.phase || 0)));
          colors[activeCount * 4 + 3] = alpha;
          sizes[activeCount] = p.size;
          activeCount++;
        }
      });
      gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
      gl.bufferData(gl.ARRAY_BUFFER, positions.subarray(0, activeCount * 2), gl.DYNAMIC_DRAW);
      gl.enableVertexAttribArray(positionLoc);
      gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0);

      gl.bindBuffer(gl.ARRAY_BUFFER, colorBuf);
      gl.bufferData(gl.ARRAY_BUFFER, colors.subarray(0, activeCount * 4), gl.DYNAMIC_DRAW);
      gl.enableVertexAttribArray(colorLoc);
      gl.vertexAttribPointer(colorLoc, 4, gl.FLOAT, false, 0, 0);

      gl.bindBuffer(gl.ARRAY_BUFFER, sizeBuf);
      gl.bufferData(gl.ARRAY_BUFFER, sizes.subarray(0, activeCount), gl.DYNAMIC_DRAW);
      gl.enableVertexAttribArray(sizeLoc);
      gl.vertexAttribPointer(sizeLoc, 1, gl.FLOAT, false, 0, 0);

      // For aurora, use additive blending to create a glowing look
      if (fountainType === 'aurora') {
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
      } else {
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      }

      gl.drawArrays(gl.POINTS, 0, activeCount);
  } else {
      ctx.clearRect(0, 0, width, height);
      particles.forEach(p => {
        if (!p.active) return;

        // Apply same physics as WebGL path so both renderers behave identically
        // Aurora floats without gravity and uses sine-based magnetic motion
        if (fountainType !== 'aurora') {
          p.vy += gravity * delta;
        } else {
          p.vx += Math.sin((time / 1000) * (p.waveFreq || auroraWaveFrequency) + (p.phase || 0)) * 0.04;
          p.vy *= 0.995;
        }
        p.x += p.vx * delta;
        p.y += p.vy * delta;
        p.size *= 0.995;
        p.life -= delta;
        p.rotation += p.angularVel * delta;

        if (fountainType === 'confetti') {
            p.vy += (confettiRotationEnabled ? 0.01 : 0) * Math.sin(p.rotation);
            // Shred chance controlled by settings
            if (p.life < 20 && utils.random(0, 1) < confettiShredDensity) emitBurst(p.x, p.y, 3);
        } else if (fountainType === 'firework') {
          if (p.explodeTime-- <= 0 || (typeof p.explodeTargetY !== 'undefined' && p.y <= p.explodeTargetY)) {
            const modeMul = (fireworkParticleMode === 0 ? 0.5 : (fireworkParticleMode === 2 ? 1.5 : 1));
            if (fireworkSubType === 'burst') {
              emitBurst(p.x, p.y, Math.min(Math.max(1, Math.floor(60 * modeMul)), particleCount));
            } else if (fireworkSubType === 'sparkler') {
              emitBurst(p.x, p.y, Math.min(Math.max(1, Math.floor(30 * modeMul)), particleCount));
              if (fireworkTrailsEnabled) emitBurst(p.x, p.y, Math.min(6, particleCount));
            } else if (fireworkSubType === 'rocket') {
              emitBurst(p.x, p.y, Math.min(Math.max(1, Math.floor(20 * modeMul)), particleCount));
              setTimeout(() => emitBurst(p.x + utils.random(-40, 40), p.y + utils.random(-40, 40), Math.min(Math.max(1, Math.floor(40 * modeMul)), particleCount)), 150);
            }
          }
        } else if (fountainType === 'aurora') {
          p.x += p.waveAmp * Math.sin(time / 1000 + p.y / 100) * delta / 10;
          p.color = `hsla(${ (time / 20 + p.x) % 360 }, 80%, 60%, ${p.life / 80})`;
        }

        if (p.life <= 0 || p.size < 0.1) p.active = false;
        else {
          if (fountainType === 'aurora') {
            // Glow via radial gradient + additive composite
            const lifeFrac = p.life / (p.initialLife || 80);
            const pulse = auroraPulseEnabled ? (0.6 + 0.4 * Math.sin(time * 0.005 + (p.phase || 0))) : 1;
            const alpha = Math.max(0, Math.min(1, lifeFrac * pulse));
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            const rgb = cssToRgbObj(p.color);
            const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 4);
            g.addColorStop(0, `rgba(${rgb.r},${rgb.g},${rgb.b},${Math.min(0.6, alpha)})`);
            g.addColorStop(1, `rgba(${rgb.r},${rgb.g},${rgb.b},0)`);
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size * 4, 0, Math.PI * 2);
            ctx.fill();

            // Main particle
            ctx.globalCompositeOperation = 'source-over';
            ctx.fillStyle = `hsla(${ (time / 20 + p.x) % 360 }, 80%, 60%, ${alpha})`;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          } else {
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      });
    }

    fpsCount++;
    if (time - fpsLast > 1000) {
      fps = fpsCount;
      fpsCount = 0;
      fpsLast = time;
      if (fps < 30 && particleCount > 100) particleCount = Math.max(100, particleCount - 50);
    }

    requestAnimationFrame(animate);
  }

  // Header UI (same as fractal)
  ui.createHeader('Particle Fountain Simulator');

  // Footer UI (2 rows, same compact height as other toys)
  const playbackHtml = (window.ui && typeof window.ui.createPlaybackControls === 'function')
    ? window.ui.createPlaybackControls({ paused: isPaused, speed: speedMultiplier, mode: 'buttons' })
    : `
      <button id="playback-playpause-btn" class="btn btn-sm">Pause</button>
      <div class="btn-group">
        <button class="btn btn-xs playback-speed-btn" data-speed="0.5">1/2</button>
        <button class="btn btn-xs playback-speed-btn" data-speed="0.25">1/4</button>
        <button class="btn btn-xs playback-speed-btn" data-speed="0.125">1/8</button>
        <button class="btn btn-xs playback-speed-btn" data-speed="0.0625">1/16</button>
        <button class="btn btn-xs playback-speed-btn" data-speed="0.03125">1/32</button>
      </div>
    `;

  const controlsHtml = `
    <div class="flex flex-col justify-between py-2"> <!-- Row 1: controls -->
      <div class="flex justify-center">${playbackHtml}</div>
    </div>
    <div id="status-msg" class="text-center py-1">Normal speed (1x)</div>
  `;
  ui.createControlPanel(controlsHtml);

  // Make the control panel compact (match Fractal Explorer footer height)
  const controlPanelEl = document.getElementById('control-panel');
  if (controlPanelEl) {
    controlPanelEl.classList.remove('p-4');
    controlPanelEl.classList.add('p-0');
    // Observe size changes so we can re-layout the canvas if the panel grows/shrinks
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(updateCanvasLayout);
      ro.observe(controlPanelEl);
    }
  }

  // Helper to map speed -> message label (shows fractions like 1/4)
  function speedLabel(speed) {
    if (isPaused) return 'Paused';
    if (!speed || speed === 1) return 'Normal speed (1x)';
    const denom = Math.round(1 / speed);
    return `1/${denom} speed`;
  }

  // Status update function
  function updateStatus() {
    const el = document.getElementById('status-msg');
    if (el) el.textContent = speedLabel(isPaused ? null : speedMultiplier);
  }

  // Bind shared playback controls if available
  if (window.ui && typeof window.ui.bindPlaybackControls === 'function') {
    ui.bindPlaybackControls({
      onPauseChange: (paused) => { isPaused = paused; updateStatus(); },
      onSpeedChange: (speed) => { speedMultiplier = speed; updateStatus(); }
    });
  } else {
    // Fallback to local handlers for older markup
    document.getElementById('playback-playpause-btn')?.addEventListener('click', e => {
      isPaused = !isPaused;
      e.currentTarget.textContent = isPaused ? 'Play' : 'Pause';
      updateStatus();
    });
    document.querySelectorAll('.playback-speed-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const s = parseFloat(btn.dataset.speed);
        speedMultiplier = (speedMultiplier === s) ? 1 : s;
        document.querySelectorAll('.playback-speed-btn').forEach(b => b.classList.toggle('btn-active', parseFloat(b.dataset.speed) === speedMultiplier && speedMultiplier !== 1));
        updateStatus();
      });
    });
  }

  // Continuous emission (after start)
  let emissionInterval = null;
  canvas.addEventListener('pointerdown', e => {
    const rect = canvas.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;

    if (!started) {
      started = true;
      const tip = document.getElementById('tap-to-start');
      if (tip) tip.style.display = 'none';
      emissionInterval = setInterval(() => {
        // Continuous demo bursts should be modest to avoid tanking performance
        emitBurst(width / 2, height - 100, Math.min(30, particleCount));
      }, 300);
    }

    emitBurst(cx, cy);
  });

  // Drag to stir particles (pointermove)
  canvas.addEventListener('pointermove', e => {
    if (e.buttons !== 1) return;
    const rect = canvas.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    particles.forEach(p => {
      if (p.active) {
        const dx = cx - p.x;
        const dy = cy - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 100) {
          p.vx += (dx / dist) * 0.5;
          p.vy += (dy / dist) * 0.5;
        }
      }
    });
  });

  // ... (keep pointermove for stir, demo, reset as is)

  // Move particle-specific options into Settings pane
  const settingsExtra = `
    <div class="mb-4">
      <label class="label font-semibold">Fountain Type</label>
      <select id="type-dropdown" class="select select-bordered w-full">
        <option value="confetti">Confetti</option>
        <option value="firework">Firework</option>
        <option value="aurora">Aurora</option>
        </select>
      <p class="text-xs opacity-70 mt-1">Changing the fountain resets the view.</p>
    </div>

    <div class="mb-4">
      <label class="label font-semibold">Color Preset</label>
      <select id="color-preset" class="select select-bordered w-full">
        <option value="rainbow">Rainbow</option>
        <option value="fireworks">Fireworks</option>
        <option value="pastel">Pastel</option>
      </select>
    </div>

    <!-- Confetti options (type-specific) -->
    <div id="settings-confetti">
      <div class="mb-4">
        <label class="label font-semibold">Confetti: Shred Density</label>
        <div class="flex items-center gap-2">
          <input id="confetti-shred-density" type="range" min="0" max="0.1" step="0.005" value="${confettiShredDensity}" class="range" />
          <span id="confetti-shred-density-readout" class="text-sm opacity-80">${(confettiShredDensity*100).toFixed(1)}%</span>
        </div>
        <p class="text-xs opacity-70 mt-1">Chance a confetti particle will shred into fragments when near end of life.</p>
      </div>

      <div class="mb-4">
        <label class="label cursor-pointer flex justify-between">
          <span>Confetti Rotation</span>
          <input type="checkbox" id="confetti-rotation-toggle" class="toggle" ${confettiRotationEnabled ? 'checked' : ''} />
        </label>
      </div>
    </div>

    <!-- Firework options (type-specific) -->
    <div id="settings-firework" style="display:none;">
      <div class="mb-4">
        <label class="label font-semibold">Firework: Subtype</label>
        <select id="firework-subtype" class="select select-bordered w-full">
          <option value="burst">Burst</option>
          <option value="sparkler">Sparkler</option>
          <option value="rocket">Rocket</option>
        </select>
        <p class="text-xs opacity-70 mt-1">Choose the firework pattern.</p>
      </div>

      <div class="mb-4">
        <label class="label font-semibold">Particles per Firework</label>
        <div class="flex items-center gap-2">
          <input id="firework-particle-mode" type="range" min="0" max="2" step="1" value="${fireworkParticleMode}" class="range" />
          <span id="firework-particle-mode-readout" class="text-sm opacity-80">${fireworkParticleMode === 0 ? 'Fewer' : (fireworkParticleMode === 2 ? 'More' : 'Default')}</span>
        </div>
        <p class="text-xs opacity-70 mt-1">Reduce or increase particles per explosion for performance tuning.</p>
      </div>

      <div class="mb-4">
        <label class="label cursor-pointer flex justify-between">
          <span>Firework Trails</span>
          <input type="checkbox" id="firework-trails-toggle" class="toggle" ${fireworkTrailsEnabled ? 'checked' : ''} />
        </label>
        <p class="text-xs opacity-70 mt-1">Enable trailing particles for rockets and sparklers.</p>
      </div>
    </div>

    <!-- Aurora options (type-specific) -->
    <div id="settings-aurora" style="display:none;">
      <div class="mb-4">
        <label class="label font-semibold">Aurora: Wave Frequency</label>
        <div class="flex items-center gap-2">
          <input id="aurora-wave-frequency" type="range" min="0.1" max="3.0" step="0.1" value="${auroraWaveFrequency}" class="range" />
          <span id="aurora-wave-frequency-readout" class="text-sm opacity-80">${auroraWaveFrequency.toFixed(1)} Hz</span>
        </div>
        <p class="text-xs opacity-70 mt-1">Controls how quickly the aurora waves undulate.</p>
      </div>

      <div class="mb-4">
        <label class="label cursor-pointer flex justify-between">
          <span>Aurora: Pulse Intensity</span>
          <input type="checkbox" id="aurora-pulse-toggle" class="toggle" ${auroraPulseEnabled ? 'checked' : ''} />
        </label>
        <p class="text-xs opacity-70 mt-1">Enable shimmering pulsing of aurora curtains.</p>
      </div>
    </div>
  `;

  if (window.ui && typeof window.ui.createSettingsPanel === 'function') {
    ui.createSettingsPanel({ extraTopHtml: settingsExtra, showFractalSelection: false });
  }

  // Shared reset helper: clears simulation state and UI
  function resetSimulation() {
    // Clear particles
    particles.forEach(p => p.active = false);

    // Stop continuous emission
    if (emissionInterval) { clearInterval(emissionInterval); emissionInterval = null; }

    // Reset playback state
    isPaused = false;
    speedMultiplier = 1;

    // Reset started state and show tap hint so user explicitly restarts
    started = false;
    const tip = document.getElementById('tap-to-start');
    if (tip) tip.style.display = '';

    // Sync playback buttons UI
    const playPauseBtnEl = document.getElementById('playback-playpause-btn');
    if (playPauseBtnEl) { playPauseBtnEl.setAttribute('aria-pressed', 'false'); playPauseBtnEl.textContent = 'Pause'; }
    document.querySelectorAll('.playback-speed-btn').forEach(b => b.classList.remove('btn-active'));

    // Clear drawing immediately
    if (!useWebGL && ctx) ctx.clearRect(0, 0, width, height);
    if (useWebGL && gl) gl.clear(gl.COLOR_BUFFER_BIT);

    updateStatus();
  }

  // Attach listeners for settings items (if present)
  const typeEl = document.getElementById('type-dropdown');
  function updateTypeSpecificUI() {
    const conf = document.getElementById('settings-confetti');
    const fire = document.getElementById('settings-firework');
    const aur = document.getElementById('settings-aurora');
    if (conf) conf.style.display = (fountainType === 'confetti' ? '' : 'none');
    if (fire) fire.style.display = (fountainType === 'firework' ? '' : 'none');
    if (aur) aur.style.display = (fountainType === 'aurora' ? '' : 'none');
  }
  if (typeEl) {
    // Reflect saved selection in the dropdown
    typeEl.value = fountainType;
    updateTypeSpecificUI();

    typeEl.addEventListener('change', e => {
      fountainType = e.target.value;
      localStorage.setItem('fountainType', fountainType);

      // Reset the simulation and show 'Tap screen to start' so the user chooses when to begin
      resetSimulation();
      updateTypeSpecificUI();
    });
  }

  // Confetti settings listeners
  const confettiDensityEl = document.getElementById('confetti-shred-density');
  const confettiDensityReadout = document.getElementById('confetti-shred-density-readout');
  if (confettiDensityEl) {
    confettiDensityEl.addEventListener('input', (e) => {
      confettiShredDensity = parseFloat(e.target.value);
      if (confettiDensityReadout) confettiDensityReadout.textContent = (confettiShredDensity*100).toFixed(1) + '%';
      localStorage.setItem('confettiShredDensity', confettiShredDensity);
    });
  }

  // Aurora controls
  const auroraFreqEl = document.getElementById('aurora-wave-frequency');
  const auroraFreqReadout = document.getElementById('aurora-wave-frequency-readout');
  if (auroraFreqEl) {
    auroraFreqEl.addEventListener('input', (e) => {
      auroraWaveFrequency = parseFloat(e.target.value);
      if (auroraFreqReadout) auroraFreqReadout.textContent = auroraWaveFrequency.toFixed(1) + ' Hz';
      localStorage.setItem('auroraWaveFrequency', auroraWaveFrequency);
    });
  }

  const auroraPulseEl = document.getElementById('aurora-pulse-toggle');
  if (auroraPulseEl) {
    auroraPulseEl.addEventListener('change', (e) => {
      auroraPulseEnabled = !!e.target.checked;
      localStorage.setItem('auroraPulseEnabled', auroraPulseEnabled);
    });
  }

  // Firework controls
  const fireSubtypeEl = document.getElementById('firework-subtype');
  if (fireSubtypeEl) {
    fireSubtypeEl.value = fireworkSubType || 'burst';
    fireSubtypeEl.addEventListener('change', (e) => {
      fireworkSubType = e.target.value;
      localStorage.setItem('fireworkSubType', fireworkSubType);
    });
  }

  const fireParticleModeEl = document.getElementById('firework-particle-mode');
  const fireParticleModeReadout = document.getElementById('firework-particle-mode-readout');
  if (fireParticleModeEl) {
    // initialize readout
    if (fireParticleModeReadout) fireParticleModeReadout.textContent = fireworkParticleMode === 0 ? 'Fewer' : (fireworkParticleMode === 2 ? 'More' : 'Default');
    fireParticleModeEl.addEventListener('input', (e) => {
      fireworkParticleMode = parseInt(e.target.value, 10);
      if (fireParticleModeReadout) {
        fireParticleModeReadout.textContent = fireworkParticleMode === 0 ? 'Fewer' : (fireworkParticleMode === 2 ? 'More' : 'Default');
      }
      localStorage.setItem('fireworkParticleMode', fireworkParticleMode);
    });
  }

  const fireTrailsEl = document.getElementById('firework-trails-toggle');
  if (fireTrailsEl) {
    fireTrailsEl.addEventListener('change', (e) => {
      fireworkTrailsEnabled = !!e.target.checked;
      localStorage.setItem('fireworkTrailsEnabled', fireworkTrailsEnabled);
    });
  }

  const confettiRotEl = document.getElementById('confetti-rotation-toggle');
  if (confettiRotEl) {
    confettiRotEl.addEventListener('change', (e) => {
      confettiRotationEnabled = !!e.target.checked;
      localStorage.setItem('confettiRotationEnabled', confettiRotationEnabled);
    });
  }

  const colorEl = document.getElementById('color-preset');
  if (colorEl) colorEl.addEventListener('change', e => {
    colorPreset = e.target.value;
    localStorage.setItem('colorPreset', colorPreset);
    // immediate visual feedback if desired - nothing to change here
  });

  // Initialize status UI
  updateStatus();

  // Wire header Reset button to clear the simulation when clicked
  document.getElementById('reset-btn')?.addEventListener('click', () => {
    resetSimulation();
    ui.showToast('Simulation reset', 'info');
  });

  // Add Export button to the header (Particle Fountain) to export the current view as PNG
  (function addExportButton() {
    const resetBtn = document.getElementById('reset-btn');
    if (!resetBtn) return;
    if (document.getElementById('export-btn')) return; // avoid duplicate

    const exportBtn = document.createElement('button');
    exportBtn.id = 'export-btn';
    exportBtn.className = 'btn btn-xs btn-primary tooltip';
    exportBtn.setAttribute('data-tip', 'Export PNG');
    exportBtn.textContent = 'Export';

    resetBtn.parentNode.insertBefore(exportBtn, resetBtn);

    exportBtn.addEventListener('click', async () => {
      try {
        ui.showToast('Preparing high-quality export...', 'info');

        const q = localStorage.getItem('exportQuality') || 'hd';
        const dpr = Math.max(1, Math.round(window.devicePixelRatio || 1));
        let exportScale = 1;
        if (q === 'hd') exportScale = dpr;
        else if (q === 'ultra') exportScale = Math.min(4, dpr * 2); // cap multiplier
        else if (q === 'ultra4') exportScale = 4;

        let targetW = Math.max(1, Math.floor(width * exportScale));
        let targetH = Math.max(1, Math.floor(height * exportScale));

        // Safety cap for dimensions to avoid memory issues
        const MAX_DIM = 8000;
        if (targetW > MAX_DIM || targetH > MAX_DIM) {
          const scaleFactor = Math.min(MAX_DIM / targetW, MAX_DIM / targetH);
          targetW = Math.max(1, Math.floor(targetW * scaleFactor));
          targetH = Math.max(1, Math.floor(targetH * scaleFactor));
          ui.showToast('Export downscaled for performance', 'warn');
        }

        const exportCanvas = document.createElement('canvas');
        exportCanvas.width = targetW;
        exportCanvas.height = targetH;
        const ectx = exportCanvas.getContext('2d', { alpha: false });

        // Fill background and draw scaled canvas
        ectx.fillStyle = window.getComputedStyle(document.body).backgroundColor || '#000';
        ectx.fillRect(0, 0, targetW, targetH);
        ectx.drawImage(canvas, 0, 0, targetW, targetH);

        exportCanvas.toBlob((blob) => {
          if (!blob) {
            ui.showToast('Export failed', 'error');
            return;
          }
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'particle-fountain.png';
          document.body.appendChild(a);
          a.click();
          a.remove();
          setTimeout(() => URL.revokeObjectURL(url), 5000);
          ui.showToast('Export started', 'success');
        }, 'image/png');
      } catch (err) {
        ui.showToast('Export failed', 'error');
        console.error(err);
      }
    });
  })();

  // Hide loading
  loadingOverlay.style.display = 'none';
  canvas.classList.remove('opacity-0');

  // Resize
  window.addEventListener('resize', () => {
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;
  });

  requestAnimationFrame(animate);
});