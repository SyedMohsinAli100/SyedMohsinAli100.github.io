'use strict';

// ── Media theft deterrents (casual copying only) ───────
// Blocks right-click "Save as", drag-to-save, and long-press save on media.
// Note: cannot stop DevTools/screen capture — nothing client-side can.
document.addEventListener('contextmenu', e => {
  if (e.target.closest('img, video, .project-thumb, .overlay-media, .overlay-gallery')) {
    e.preventDefault();
  }
});
document.addEventListener('dragstart', e => {
  if (e.target.closest('img, video')) e.preventDefault();
});

// ── Intro + background waves run together (see boot sequence below) ──

// ── Theme Color Cycle ──────────────────────────────────
(function () {
  const themes = [
    { name: 'blue',   color: '#60a5fa', rgb: '96,165,250',   dim: 'rgba(96,165,250,0.12)',  glow: 'rgba(96,165,250,0.06)'  },
    { name: 'violet', color: '#a78bfa', rgb: '167,139,250',  dim: 'rgba(167,139,250,0.12)', glow: 'rgba(167,139,250,0.06)' },
    { name: 'amber',  color: '#f59e0b', rgb: '245,158,11',   dim: 'rgba(245,158,11,0.12)',  glow: 'rgba(245,158,11,0.06)'  },
  ];

  const root   = document.documentElement;
  const btn    = document.getElementById('theme-toggle');
  const dot    = document.getElementById('theme-dot');
  let current  = parseInt(localStorage.getItem('theme-index') || '0');

  function applyTheme(i) {
    const t = themes[i];
    root.style.setProperty('--cyan',      t.color);
    root.style.setProperty('--cyan-dim',  t.dim);
    root.style.setProperty('--cyan-glow', t.glow);
    if (dot) dot.style.background = t.color;
    localStorage.setItem('theme-index', i);
  }

  applyTheme(current);

  if (btn) {
    btn.addEventListener('click', () => {
      current = (current + 1) % themes.length;
      applyTheme(current);
    });
  }
})();

// ── Audio: hover SFX, intro sound, looping background music ──
const AudioSys = (function () {
  const KEY = 'sound-on';
  const saved = localStorage.getItem(KEY);
  let on = saved === null ? true : saved === '1';   // default on; speaker toggles mute
  let unlocked = false;
  let pendingMusic = false;
  const MUSIC_VOL = 0.18;

  const sHover = new Audio('assets/audio/hover.mp3'); sHover.volume = 0.25; sHover.preload = 'auto';
  const sIntro = new Audio('assets/audio/intro.mp3'); sIntro.volume = 0.60; sIntro.preload = 'auto';
  const sMusic = new Audio('assets/audio/ambient.mp3'); sMusic.loop = true; sMusic.volume = MUSIC_VOL; sMusic.preload = 'auto';

  const btn = document.getElementById('sound-switch');
  function syncUI() {
    if (!btn) return;
    btn.classList.toggle('muted', !on);
    btn.setAttribute('aria-label', on ? 'Mute sound' : 'Unmute sound');
  }
  syncUI();

  function fadeInMusic() {
    sMusic.volume = 0;
    sMusic.play().then(() => {
      const step = () => {
        sMusic.volume = Math.min(MUSIC_VOL, sMusic.volume + 0.012);
        if (sMusic.volume < MUSIC_VOL) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }).catch(() => {});
  }

  function playHover() {
    if (!on || !unlocked) return;
    try { sHover.currentTime = 0; sHover.play().catch(() => {}); } catch (e) {}
  }
  function playIntro() { if (on && unlocked) sIntro.play().catch(() => {}); }
  function startMusic() {
    if (!on) return;
    if (!unlocked) { pendingMusic = true; return; }
    fadeInMusic();
  }

  function setOn(v) {
    on = v;
    localStorage.setItem(KEY, v ? '1' : '0');
    syncUI();
    if (on) { if (unlocked) fadeInMusic(); }
    else sMusic.pause();
  }
  if (btn) btn.addEventListener('click', () => setOn(!on));

  // Audio can't start until the visitor interacts — unlock on the first gesture
  // and kick off any music that was waiting.
  function unlock() {
    if (unlocked) return;
    unlocked = true;
    if (pendingMusic && on) { pendingMusic = false; fadeInMusic(); }
  }
  ['pointerdown', 'keydown', 'touchstart'].forEach(ev =>
    window.addEventListener(ev, unlock, { once: true, passive: true })
  );

  document.querySelectorAll(
    '.nav-links a, .nav-logo, .filter-btn, .btn, .project-title, #theme-toggle, #sound-toggle, .contact-email, .overlay-close'
  ).forEach(el => el.addEventListener('mouseenter', playHover));

  return { unlock, playIntro, startMusic, isOn: () => on };
})();

// ── Background wave fields + intro sequence ────────────
// One crisp, "PS4-style" wave field plays during loading, blurs out, and hands
// off to a soft ambient field that drifts behind the whole site forever.
(function () {
  const introScreen = document.getElementById('intro-screen');
  const introBtn    = document.getElementById('intro-btn');
  const introCanvas = document.getElementById('intro-waves');
  const bgCanvas    = document.getElementById('bg-waves');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function hexToRgb(hex) {
    hex = (hex || '').trim().replace('#', '');
    if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
    const n = parseInt(hex || '7DD3E8', 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }
  const themeColor = () => hexToRgb(getComputedStyle(document.documentElement).getPropertyValue('--cyan'));
  const clamp = v => Math.max(0, Math.min(255, Math.round(v)));
  const tint = (c, s) => `${clamp(c.r + s)}, ${clamp(c.g + s * 0.4)}, ${clamp(c.b - s * 0.3)}`;

  function makeWaveField(canvas, opts) {
    if (!canvas) return null;
    const ctx = canvas.getContext('2d');
    const { res, frame, layers } = opts;
    const stroke = !!opts.prominent;
    const speedScale = opts.speedScale || 1;
    let base = themeColor();
    let W, H, raf = null, last = 0, t = 0, running = false;

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2) * res;
      W = canvas.width  = Math.max(1, Math.floor(canvas.clientWidth  * dpr));
      H = canvas.height = Math.max(1, Math.floor(canvas.clientHeight * dpr));
    }
    resize();
    window.addEventListener('resize', resize, { passive: true });

    function drawWave(l) {
      const baseY = H * l.yo, A = H * l.amp;
      const k = (Math.PI * 2) / (W * l.len);
      const ph = t * l.speed * speedScale * Math.PI * 2;
      const step = Math.max(5, Math.floor(W / 64));
      const pts = [];
      for (let x = 0; x <= W; x += step) {
        pts.push([x, baseY + Math.sin(x * k + ph) * A + Math.sin(x * k * 0.5 - ph * 1.4) * A * 0.45]);
      }
      const rgb = tint(base, l.shift);
      ctx.beginPath();
      ctx.moveTo(0, H);
      for (const p of pts) ctx.lineTo(p[0], p[1]);
      ctx.lineTo(W, H); ctx.closePath();
      const g = ctx.createLinearGradient(0, baseY - A, 0, H);
      g.addColorStop(0, `rgba(${rgb}, ${l.alpha})`);
      g.addColorStop(1, `rgba(${rgb}, 0)`);
      ctx.fillStyle = g; ctx.fill();
    }
    function render() {
      ctx.clearRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'lighter';
      for (const l of layers) drawWave(l);
      ctx.globalCompositeOperation = 'source-over';
    }
    function loop(now) {
      if (!running) return;
      raf = requestAnimationFrame(loop);
      if (document.hidden) { last = now; return; }
      if (now - last < frame) return;
      t += (now - last) / 1000; last = now;
      render();
    }
    return {
      start()   { if (running) return; running = true; last = 0; raf = requestAnimationFrame(loop); },
      stop()    { running = false; if (raf) cancelAnimationFrame(raf); },
      still()   { resize(); t = 8; render(); },
      recolor() { base = themeColor(); }
    };
  }

  const ambientLayers = [
    { amp: 0.10, yo: 0.34, len: 1.3, speed:  0.05,  alpha: 0.45, shift:  35 },
    { amp: 0.14, yo: 0.55, len: 0.9, speed: -0.035, alpha: 0.40, shift:   0 },
    { amp: 0.11, yo: 0.78, len: 1.7, speed:  0.025, alpha: 0.32, shift: -30 }
  ];
  const introLayers = [
    { amp: 0.07, yo: 0.30, len: 1.6,  speed:  0.06,  alpha: 0.28, shift:  45 },
    { amp: 0.10, yo: 0.44, len: 1.2,  speed: -0.05,  alpha: 0.36, shift:  20 },
    { amp: 0.13, yo: 0.58, len: 0.95, speed:  0.045, alpha: 0.40, shift:   0 },
    { amp: 0.11, yo: 0.72, len: 1.4,  speed: -0.035, alpha: 0.34, shift: -25 },
    { amp: 0.08, yo: 0.86, len: 2.0,  speed:  0.03,  alpha: 0.28, shift: -45 }
  ];

  const speedScale = reduceMotion ? 0.5 : 1;
  const ambient = makeWaveField(bgCanvas,    { res: 0.5, frame: 33, layers: ambientLayers, speedScale });
  const intro   = makeWaveField(introCanvas, { res: 0.6, frame: 24, layers: introLayers, speedScale });

  const toggle = document.getElementById('theme-toggle');
  if (toggle) toggle.addEventListener('click', () => setTimeout(() => {
    if (ambient) ambient.recolor();
    if (intro)   intro.recolor();
  }, 0));

  if (ambient) ambient.start();

  // No intro markup → just show the ambient field
  if (!introScreen) {
    if (bgCanvas) bgCanvas.classList.add('visible');
    return;
  }

  document.body.style.overflow = 'hidden';

  function runSequence() {
    AudioSys.unlock();
    AudioSys.playIntro();          // intro sound fires on the click
    if (introBtn) introBtn.classList.add('gone');
    if (intro) intro.start();      // waves begin flowing

    setTimeout(() => { if (introCanvas) introCanvas.classList.add('show'); }, 60);       // bloom in
    setTimeout(() => { if (introCanvas) introCanvas.classList.add('blurring'); }, 2600); // soften into blur (still moving)
    setTimeout(() => { if (bgCanvas) bgCanvas.classList.add('visible'); }, 3000);        // ambient ready
    setTimeout(() => {                                                                    // smooth reveal + music
      introScreen.classList.add('fade-out');
      document.body.style.overflow = '';
      AudioSys.startMusic();
    }, 3600);
    setTimeout(() => {
      introScreen.remove();
      if (intro) intro.stop();     // stop only once off-screen
    }, 5000);
  }

  if (introBtn) {
    introBtn.addEventListener('click', runSequence, { once: true });
  } else {
    runSequence();
  }
})();

// ── Nav scroll ─────────────────────────────────────────
const navPill = document.querySelector('.nav-pill');
window.addEventListener('scroll', () => {
  if (!navPill) return;
  navPill.style.background  = window.scrollY > 40 ? 'rgba(14,14,14,0.92)' : '';
  navPill.style.borderColor = window.scrollY > 40 ? 'rgba(255,255,255,0.1)' : '';
}, { passive: true });

// ── Smooth scroll ──────────────────────────────────────
document.querySelectorAll('a[href^="#"]').forEach(link => {
  link.addEventListener('click', e => {
    const target = document.querySelector(link.getAttribute('href'));
    if (target) {
      e.preventDefault();
      window.scrollTo({ top: target.getBoundingClientRect().top + window.scrollY - 80, behavior: 'smooth' });
    }
  });
});

// ── Overlay ────────────────────────────────────────────
const overlayPanel     = document.getElementById('project-overlay');
const overlayBackdrop  = document.getElementById('overlay-backdrop');
const overlayClose     = document.getElementById('overlay-close');
const overlayTitle     = document.getElementById('overlay-title');
const overlayDesc      = document.getElementById('overlay-desc');
const overlayTags      = document.getElementById('overlay-tags');
const overlayMedia     = document.getElementById('overlay-media');
const overlayEmpty     = document.getElementById('overlay-media-empty');
const overlayToolsList = document.getElementById('overlay-tools-list');

function openOverlay(card) {
  const title = card.dataset.title || 'Untitled';
  const desc  = card.dataset.desc  || '';
  const tags  = (card.dataset.tags || '').split(',').map(t => t.trim()).filter(Boolean);
  const year  = card.dataset.year  || '';
  let media   = [];
  try { media = JSON.parse(card.dataset.media || '[]'); } catch(e) {}

  overlayTitle.textContent   = title;
  overlayDesc.textContent    = desc;
  overlayTags.innerHTML      = tags.map(t => `<span class="tag">${t}</span>`).join('');
  overlayToolsList.innerHTML = tags.map(t => `<span class="tag">${t}</span>`).join('');

  overlayMedia.querySelectorAll('.overlay-media-item, .overlay-gallery').forEach(el => el.remove());
  overlayMedia.classList.remove('is-gallery');

  const isImageSrc = s => /\.(jpe?g|png|webp|gif|avif)$/i.test(s);
  // Image-only projects (e.g. Photography) render as a square grid gallery.
  const galleryMode = media.length > 0 && media.every(isImageSrc) && (media.length > 1 || !!card.dataset.folder);

  if (media.length === 0) {
    overlayEmpty.style.display = 'flex';
  } else if (galleryMode) {
    overlayEmpty.style.display = 'none';
    overlayMedia.classList.add('is-gallery');
    const grid = document.createElement('div');
    grid.className = 'overlay-gallery';
    media.forEach(src => {
      const fig = document.createElement('div');
      fig.className = 'overlay-gallery-item';
      const img = document.createElement('img');
      img.src = src; img.alt = ''; img.loading = 'lazy'; img.draggable = false;
      img.addEventListener('error', () => fig.remove());
      fig.appendChild(img);
      grid.appendChild(fig);
    });
    overlayMedia.insertBefore(grid, overlayEmpty);
  } else {
    overlayEmpty.style.display = 'none';
    // Reuse the card's thumbnail as a poster so the player has a correctly
    // sized frame to show immediately, instead of a blank 300x150 fallback
    // box while the actual video is still loading (or if it fails to load).
    const posterImg = card.querySelector('.project-thumb img');
    const posterSrc = posterImg ? posterImg.getAttribute('src') : '';

    media.forEach(src => {
      const wrap = document.createElement('div');
      wrap.className = 'overlay-media-item';
      const isVid = /\.(mp4|webm|mov)$/i.test(src);

      if (isVid) {
        const vid = document.createElement('video');
        vid.src = src;
        vid.controls = true;
        vid.playsInline = true;
        vid.preload = 'metadata';
        if (posterSrc) vid.poster = posterSrc;
        vid.setAttribute('controlslist', 'nodownload noplaybackrate noremoteplayback');
        vid.setAttribute('disablepictureinpicture', '');
        vid.addEventListener('error', () => {
          wrap.classList.add('media-broken');
          wrap.innerHTML = '<div class="media-broken-msg">Video failed to load.<br><span>Check that the file exists at the expected path.</span></div>';
        });
        wrap.appendChild(vid);
      } else {
        const img = document.createElement('img');
        img.src = src; img.alt = ''; img.loading = 'lazy'; img.draggable = false;
        img.addEventListener('error', () => { wrap.remove(); });
        wrap.appendChild(img);
      }
      overlayMedia.insertBefore(wrap, overlayEmpty);
    });
  }

  overlayPanel.classList.add('open');
  overlayPanel.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
  // Push a history state so swipe-back closes overlay instead of leaving the page
  history.pushState({ overlay: true }, '');
}

function closeOverlay() {
  overlayPanel.classList.remove('open');
  overlayPanel.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
  overlayMedia.querySelectorAll('video').forEach(v => v.pause());
}

// Intercept browser back gesture — close overlay instead of navigating away
window.addEventListener('popstate', (e) => {
  if (overlayPanel.classList.contains('open')) {
    closeOverlay();
  }
});

if (overlayClose)    overlayClose.addEventListener('click', () => { history.back(); });
if (overlayBackdrop) overlayBackdrop.addEventListener('click', () => { history.back(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') { history.back(); } });

// ── Project Filter ─────────────────────────────────────
const filterBtns   = document.querySelectorAll('.filter-btn');
const projectCards = document.querySelectorAll('.project-card');

filterBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    const filter = btn.dataset.filter;
    filterBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    projectCards.forEach(card => {
      const cat  = card.dataset.category || '';
      const show = filter === 'all' || cat.includes(filter);
      card.classList.toggle('hidden', !show);
      if (show) {
        card.style.animation = 'none';
        void card.offsetHeight;
        card.style.animation = 'fadeSlideUp 0.5s cubic-bezier(0.16,1,0.3,1) forwards';
      }
    });
  });
});

// ── Hide broken thumbnail images ──────────────────────
document.querySelectorAll('.project-thumb img').forEach(img => {
  img.addEventListener('error', () => { img.style.display = 'none'; });
});

// ── Hover Video + Card Click ───────────────────────────
const canHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

projectCards.forEach(card => {
  const thumb = card.querySelector('.project-thumb');
  if (!thumb) return;

  const hint = document.createElement('div');
  hint.className = 'card-hover-hint';
  hint.textContent = 'View Project';
  thumb.appendChild(hint);

  const src       = card.dataset.preview;
  const isVideo   = src && /\.(mp4|webm|mov)$/i.test(src);
  const posterImg = thumb.querySelector('img');   // static thumbnail, if the card has one

  if (canHover && isVideo) {
    const vid = document.createElement('video');
    vid.src = src;
    vid.muted = true; vid.loop = true; vid.playsInline = true;
    vid.preload = 'metadata';
    vid.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:0;transition:opacity 0.45s ease;z-index:2;';
    thumb.appendChild(vid);

    // No thumbnail image → freeze the video's own first frame as the still poster
    if (!posterImg) {
      vid.addEventListener('loadeddata', () => {
        try { vid.currentTime = 0.1; } catch (e) { vid.style.opacity = '1'; }
      }, { once: true });
      vid.addEventListener('seeked', () => { vid.style.opacity = '1'; }, { once: true });
    }

    let leaveTimer = null;
    card.addEventListener('mouseenter', () => {
      clearTimeout(leaveTimer);
      vid.style.opacity = '1';
      vid.play().catch(() => {});
    });
    card.addEventListener('mouseleave', () => {
      vid.pause();
      if (posterImg) {
        vid.style.opacity = '0';                        // fade back to the thumbnail
        leaveTimer = setTimeout(() => { try { vid.currentTime = 0; } catch (e) {} }, 450);
      } else {
        try { vid.currentTime = 0.1; } catch (e) {}     // keep the first frame showing
      }
    });
  }

  card.addEventListener('click', () => openOverlay(card));

  // Optional "Play Game" button (e.g. Zero Path) — links out to the game's
  // GitHub repo instead of opening the video overlay. Set the real URL via
  // the card's data-github attribute; until then it's inert.
  const playBtn = card.querySelector('.play-game-btn');
  if (playBtn) {
    const githubUrl = card.dataset.github || '';
    if (githubUrl && githubUrl !== '#') {
      playBtn.href = githubUrl;
    } else {
      playBtn.removeAttribute('href');
      playBtn.classList.add('is-disabled');
      playBtn.title = 'Play link coming soon';
    }
    playBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!playBtn.getAttribute('href')) e.preventDefault();
    });
  }
});

// ── Scroll Reveal ──────────────────────────────────────
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) { entry.target.classList.add('visible'); revealObserver.unobserve(entry.target); }
  });
}, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });

['.section-header', '.filter-bar', '.project-card', '.about-lead',
 '.about-body', '.skills-block', '.contact-title', '.contact-sub',
 '.contact-email'].forEach(sel => {
  document.querySelectorAll(sel).forEach((el, i) => {
    el.classList.add('fade-in-up');
    if (sel === '.project-card') el.style.transitionDelay = (i % 3) * 0.08 + 's';
    revealObserver.observe(el);
  });
});

const ks = document.createElement('style');
ks.textContent = `@keyframes fadeSlideUp { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }`;
document.head.appendChild(ks);

// ── Auto-load every image in a folder (no manual naming needed) ──────
// Any card with data-folder="path/" gets its images discovered automatically.
// Locally (Live Server) it reads the folder's directory listing.
// When deployed to a static host, it falls back to an optional photos.json.
async function discoverFolderImages(folder) {
  // Real photos only — skip the card's cover thumbnail and any *-thumb files.
  const isImg = n => /\.(jpe?g|png|webp|gif|avif)$/i.test(n) && !/^cover\.|[-_]thumb\./i.test(n);

  // 1) Live directory listing — works with Live Server, zero maintenance.
  try {
    const res = await fetch(folder, { cache: 'no-store' });
    if (res.ok) {
      const html = await res.text();
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const names = [...doc.querySelectorAll('a')]
        .map(a => (a.getAttribute('href') || '').split('?')[0].split('#')[0])
        .map(h => decodeURIComponent((h.split('/').filter(Boolean).pop() || '')))
        .filter(isImg);
      const uniq = [...new Set(names)]
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
      if (uniq.length) return uniq.map(n => folder + n);
    }
  } catch (e) {}

  // 2) Optional manifest fallback for static hosts (e.g. GitHub Pages).
  try {
    const res = await fetch(folder + 'photos.json', { cache: 'no-store' });
    if (res.ok) {
      const list = await res.json();
      const clean = Array.isArray(list) ? list.filter(isImg) : [];
      if (clean.length) return clean.map(n => folder + n);
    }
  } catch (e) {}

  return null; // keep whatever is already in data-media
}

document.querySelectorAll('.project-card[data-folder]').forEach(card => {
  discoverFolderImages(card.dataset.folder).then(imgs => {
    if (!imgs || !imgs.length) return;
    card.dataset.media = JSON.stringify(imgs);
    // Only auto-pick a cover when the card doesn't have its own fixed thumbnail
    if (card.dataset.thumb !== 'true') {
      const cover = card.querySelector('.project-thumb img');
      if (cover) { cover.src = imgs[0]; cover.style.display = ''; }
    }
  });
});

// ── Nav / controls hover-to-reveal ─────────────────────
// On mouse/trackpad devices, the top nav pill and the sound/theme controls
// stay hidden until the cursor comes near the top of the screen, then they
// slide down into view. Touch devices keep them always visible since
// "hovering near the top" isn't a thing there.
(() => {
  const canHoverReveal = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  if (!canHoverReveal) return;

  document.documentElement.classList.add('hover-reveal');

  const REVEAL_ZONE = 110; // px from top that counts as "near"
  const HIDE_DELAY = 10;  // ms grace period before hiding, so moving the
                            // cursor down onto the nav itself doesn't flicker
  let hideTimer = null;

  const show = () => {
    clearTimeout(hideTimer);
    document.documentElement.classList.add('nav-visible');
  };
  const scheduleHide = () => {
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
      document.documentElement.classList.remove('nav-visible');
    }, HIDE_DELAY);
  };

  window.addEventListener('mousemove', (e) => {
    if (e.clientY <= REVEAL_ZONE) show();
    else scheduleHide();
  });
})();
