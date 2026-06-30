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

// ── Background wave fields + intro sequence ────────────
// One crisp, "PS4-style" wave field plays during loading, blurs out, and hands
// off to a soft ambient field that drifts behind the whole site forever.
(function () {
  const introScreen = document.getElementById('intro-screen');
  const introText   = document.getElementById('intro-text');
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
      const ph = t * l.speed * Math.PI * 2;
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
      if (stroke) {
        ctx.beginPath();
        ctx.moveTo(pts[0][0], pts[0][1]);
        for (const p of pts) ctx.lineTo(p[0], p[1]);
        ctx.lineWidth = Math.max(1.5, H * 0.004);
        ctx.strokeStyle = `rgba(${rgb}, ${Math.min(0.9, l.alpha + 0.35)})`;
        ctx.stroke();
      }
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

  const ambient = makeWaveField(bgCanvas,    { res: 0.5, frame: 33, layers: ambientLayers });
  const intro   = makeWaveField(introCanvas, { res: 0.6, frame: 24, layers: introLayers, prominent: true });

  const toggle = document.getElementById('theme-toggle');
  if (toggle) toggle.addEventListener('click', () => setTimeout(() => {
    if (ambient) ambient.recolor();
    if (intro)   intro.recolor();
  }, 0));

  // No intro markup → just run the ambient field
  if (!introScreen) {
    if (ambient) { reduceMotion ? ambient.still() : ambient.start(); }
    if (bgCanvas) bgCanvas.classList.add('visible');
    return;
  }

  document.body.style.overflow = 'hidden';

  if (reduceMotion) {
    if (intro)   intro.still();
    if (ambient) ambient.still();
    if (introCanvas) introCanvas.classList.add('show');
    setTimeout(() => { if (bgCanvas) bgCanvas.classList.add('visible'); }, 200);
    setTimeout(() => { introScreen.classList.add('fade-out'); document.body.style.overflow = ''; }, 900);
    setTimeout(() => { introScreen.remove(); if (intro) intro.stop(); }, 1700);
    return;
  }

  if (intro)   intro.start();
  if (ambient) ambient.start();

  setTimeout(() => { if (introCanvas) introCanvas.classList.add('show'); }, 100);   // prominent waves in
  setTimeout(() => { if (introText)   introText.classList.add('show'); }, 300);     // loading text in
  setTimeout(() => {                                                                // blur out + text out
    if (introCanvas) introCanvas.classList.add('blurring');
    if (introText)   introText.classList.remove('show');
  }, 2000);
  setTimeout(() => { if (bgCanvas) bgCanvas.classList.add('visible'); }, 2700);     // ambient ready behind overlay
  setTimeout(() => { introScreen.classList.add('fade-out'); document.body.style.overflow = ''; }, 3100); // reveal site
  setTimeout(() => { introScreen.remove(); if (intro) intro.stop(); }, 3900);       // cleanup
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
const overlayYear      = document.getElementById('overlay-year');
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
  overlayYear.textContent    = year;
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
    media.forEach(src => {
      const wrap = document.createElement('div');
      wrap.className = 'overlay-media-item';
      const isVid = /\.(mp4|webm|mov)$/i.test(src);
      wrap.innerHTML = isVid
        ? `<video src="${src}" controls playsinline controlslist="nodownload noplaybackrate noremoteplayback" disablepictureinpicture></video>`
        : `<img src="${src}" alt="" loading="lazy" draggable="false" />`;
      overlayMedia.insertBefore(wrap, overlayEmpty);
    });
  }

  overlayPanel.classList.add('open');
  overlayPanel.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
}

function closeOverlay() {
  overlayPanel.classList.remove('open');
  overlayPanel.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
  overlayMedia.querySelectorAll('video').forEach(v => v.pause());
}

if (overlayClose)    overlayClose.addEventListener('click', closeOverlay);
if (overlayBackdrop) overlayBackdrop.addEventListener('click', closeOverlay);
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeOverlay(); });

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
    projectCards.forEach(card => {
      if (card.classList.contains('featured')) {
        card.style.gridColumn = card.classList.contains('hidden') ? '' : 'span 2';
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

  const src      = card.dataset.preview;
  const hasThumb = !!card.dataset.thumb;
  const isVideo  = src && /\.(mp4|webm|mov)$/i.test(src);

  if (canHover && isVideo && hasThumb) {
    // TIER 1 — static thumbnail jpg, video plays on hover
    const vid = document.createElement('video');
    vid.src = src; vid.muted = true; vid.loop = true; vid.playsInline = true; vid.preload = 'none';
    vid.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:0;transition:opacity 0.5s ease;z-index:2;';
    thumb.appendChild(vid);
    let leaveTimer = null;
    card.addEventListener('mouseenter', () => { clearTimeout(leaveTimer); vid.play().catch(() => {}); vid.style.opacity = '1'; });
    card.addEventListener('mouseleave', () => { vid.style.opacity = '0'; leaveTimer = setTimeout(() => { vid.pause(); vid.currentTime = 0; }, 500); });

  } else if (canHover && isVideo) {
    // TIER 2 — no thumbnail, dissolving random frames, live playback on hover
    const vidA = makeDissolveVid(src);
    const vidB = makeDissolveVid(src);
    thumb.appendChild(vidA);
    thumb.appendChild(vidB);

    let active = vidA, inactive = vidB;
    let cycleTimer = null, isHovered = false, isReady = false;

    function showFrame(v, cb) {
      if (!v.duration) return;
      v.currentTime = v.duration * (0.05 + Math.random() * 0.88);
      v.addEventListener('seeked', cb, { once: true });
    }

    function crossfade() {
      if (isHovered) return;
      inactive.pause();
      showFrame(inactive, () => {
        if (isHovered) return;
        inactive.style.opacity = '1';
        active.style.opacity   = '0';
        [active, inactive] = [inactive, active];
      });
    }

    function startCycle() { if (!cycleTimer) cycleTimer = setInterval(crossfade, 2400); }
    function stopCycle()  { clearInterval(cycleTimer); cycleTimer = null; }

    vidA.addEventListener('loadedmetadata', () => {
      isReady = true;
      showFrame(vidA, () => { vidA.style.opacity = '1'; startCycle(); });
    }, { once: true });
    vidA.addEventListener('error', () => console.error('Tier 2 video failed:', src));
    vidA.load(); vidB.load();

    card.addEventListener('mouseenter', () => {
      if (!isReady) return;
      isHovered = true; stopCycle();
      active.loop = true; active.play().catch(() => {});
      active.style.opacity = '1'; inactive.style.opacity = '0';
    });
    card.addEventListener('mouseleave', () => {
      isHovered = false;
      active.pause(); active.loop = false;
      startCycle();
    });
  }

  card.addEventListener('click', () => openOverlay(card));
});

function makeDissolveVid(src) {
  const v = document.createElement('video');
  v.src = src; v.muted = true; v.playsInline = true; v.preload = 'auto';
  v.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:0;transition:opacity 0.8s ease;z-index:2;';
  v.addEventListener('error', () => console.error('Video failed to load:', src));
  return v;
}

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
  const isImg = n => /\.(jpe?g|png|webp|gif|avif)$/i.test(n);

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
      if (Array.isArray(list) && list.length) return list.map(n => folder + n);
    }
  } catch (e) {}

  return null; // keep whatever is already in data-media
}

document.querySelectorAll('.project-card[data-folder]').forEach(card => {
  discoverFolderImages(card.dataset.folder).then(imgs => {
    if (!imgs || !imgs.length) return;
    card.dataset.media = JSON.stringify(imgs);
    const cover = card.querySelector('.project-thumb img');
    if (cover) { cover.src = imgs[0]; cover.style.display = ''; }
  });
});
