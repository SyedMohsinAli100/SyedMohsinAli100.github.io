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

// ── Intro Screen ───────────────────────────────────────
(function () {
  const intro = document.getElementById('intro-screen');
  const text  = document.getElementById('intro-text');
  if (!intro) return;

  document.body.style.overflow = 'hidden';
  setTimeout(() => { text.classList.add('show'); }, 200);
  setTimeout(() => { intro.classList.add('fade-out'); document.body.style.overflow = ''; }, 1800);
  setTimeout(() => { intro.remove(); }, 2600);
})();

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
