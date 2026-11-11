  /* ---------- Gallery + Albo d'oro (gallery.json) ---------- */
  const GALLERY_CONFIG_URL = new URL('./gallery.json', document.baseURI).toString();
  const GALLERY_ALBUM_HOSTS = ['drive.google.com', 'photos.google.com', 'photos.app.goo.gl'];
  let galleryItems = [];
  let galleryVisibleCount = 6;
  let galleryYear = '';
  const isGalleryArchive = document.body.dataset.galleryArchive === 'true';
  const lightboxState = { photos: [], index: 0, title: '', returnFocus: null };

  function galleryText(key, italian, vars) {
    if (window.SiteI18n) return window.SiteI18n.t(key, italian, vars);
    return String(italian).replace(/\{(\w+)\}/g, (match, name) => vars && name in vars ? vars[name] : match);
  }

  function galleryLocale() {
    return window.SiteI18n ? window.SiteI18n.locale : 'it-IT';
  }

  function galleryEscape(value) {
    return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function galleryNormalizeKeys(value) {
    if (Array.isArray(value)) return value.map(galleryNormalizeKeys);
    if (!value || typeof value !== 'object') return value;
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [
      key.charAt(0).toLowerCase() + key.slice(1), galleryNormalizeKeys(item)
    ]));
  }

  function teamNameKey(name) {
    return String(name).normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('it-IT');
  }

  function aggregateStandings(items) {
    const teams = new Map();
    items.forEach((item) => {
      const seen = new Set();
      item.results.forEach((result) => {
        const category = result.category.trim().toLowerCase();
        if (!['gold', 'silver'].includes(category)) return;
        result.podium.forEach((entry) => {
          if (!entry.team || ![1, 2, 3].includes(entry.position)) return;
          const key = teamNameKey(entry.team);
          const placement = category + entry.position;
          const unique = JSON.stringify([key, placement]);
          if (seen.has(unique)) return;
          seen.add(unique);
          if (!teams.has(key)) teams.set(key, {
            name: entry.team.trim().replace(/\s+/g, ' '),
            gold1: 0, gold2: 0, gold3: 0, silver1: 0, silver2: 0, silver3: 0
          });
          teams.get(key)[placement] += 1;
        });
      });
    });
    const columns = ['gold1', 'gold2', 'gold3', 'silver1', 'silver2', 'silver3'];
    return [...teams.values()].sort((first, second) => {
      for (const column of columns) {
        if (first[column] !== second[column]) return second[column] - first[column];
      }
      return first.name.localeCompare(second.name, galleryLocale());
    });
  }

  function renderStandings() {
    const body = document.getElementById('standings-body');
    if (!body) return;
    const search = document.getElementById('team-search');
    const allTeams = aggregateStandings(galleryItems);
    document.getElementById('team-options').innerHTML = allTeams
      .map((team) => `<option value="${galleryEscape(team.name)}"></option>`).join('');
    document.getElementById('standings-toolbar').hidden = allTeams.length === 0;
    document.getElementById('standings-scroll').hidden = allTeams.length === 0;
    const query = teamNameKey(search.value);
    const teams = allTeams.filter((team) => teamNameKey(team.name).includes(query));
    const columns = ['gold1', 'gold2', 'gold3', 'silver1', 'silver2', 'silver3'];
    body.innerHTML = teams.map((team) => `<tr><th scope="row">${galleryEscape(team.name)}</th>${columns.map((column) => `<td>${team[column]}</td>`).join('')}</tr>`).join('');
    document.getElementById('standings-empty').hidden = teams.length > 0;
  }

  function resolvePhotoUrl(raw, width) {
    const value = String(raw || '').trim();
    if (!value) return null;

    // Relative path: image stored in this repository
    if (!/^[a-z][a-z0-9+.-]*:/i.test(value) && !value.startsWith('//')) {
      const local = new URL(value, document.baseURI);
      return local.origin === window.location.origin ? local.href : null;
    }

    let url;
    try { url = new URL(value); } catch (_) { return null; }
    if (url.protocol !== 'https:') return null;

    if (url.hostname === 'drive.google.com') {
      const fromPath = url.pathname.match(/\/file\/d\/([\w-]{10,})/);
      const fromQuery = url.searchParams.get('id');
      const id = fromPath ? fromPath[1] : (/^[\w-]{10,}$/.test(fromQuery || '') ? fromQuery : null);
      return id ? 'https://drive.google.com/thumbnail?id=' + encodeURIComponent(id) + '&sz=w' + width : null;
    }

    return url.hostname === 'lh3.googleusercontent.com' ? url.href : null;
  }

  function safeAlbumUrl(raw) {
    try {
      const url = new URL(String(raw || '').trim());
      return url.protocol === 'https:' && GALLERY_ALBUM_HOSTS.includes(url.hostname) ? url.href : '';
    } catch (_) {
      return '';
    }
  }

  function normalizeGallery(payload) {
    const list = Array.isArray(payload) ? payload : (payload && payload.tournaments) || [];
    return galleryNormalizeKeys(list)
      .map((item, index) => ({
        key: 'g' + index,
        title: String(item.title || '').trim(),
        date: /^\d{4}-\d{2}-\d{2}/.test(String(item.date || '')) ? String(item.date).slice(0, 10) : '',
        location: String(item.location || '').trim(),
        albumUrl: safeAlbumUrl(item.albumUrl),
        photos: (Array.isArray(item.photos) ? item.photos : [])
          .map((photo) => ({ thumb: resolvePhotoUrl(photo, 800), full: resolvePhotoUrl(photo, 2000) }))
          .filter((photo) => photo.thumb),
        results: (Array.isArray(item.results) ? item.results : [])
          .map((result) => ({
            category: String(result.category || '').trim(),
            podium: (Array.isArray(result.podium) ? result.podium : [])
              .map((entry) => ({
                position: Number(entry.position) || 0,
                team: String(entry.team || '').trim(),
                players: (Array.isArray(entry.players) ? entry.players : []).map((p) => String(p).trim()).filter(Boolean)
              }))
              .filter((entry) => entry.team)
              .sort((a, b) => a.position - b.position)
          }))
          .filter((result) => result.podium.length)
      }))
      .filter((item) => item.title && (item.photos.length || item.results.length))
      .sort((a, b) => b.date.localeCompare(a.date));
  }

  function formatGalleryDate(isoDate) {
    if (!isoDate) return { day: '', month: '', label: '' };
    const [y, m, d] = isoDate.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    const month = new Intl.DateTimeFormat(galleryLocale(), { month: 'short' }).format(date).replace('.', '');
    return {
      day: String(d).padStart(2, '0'),
      month: month.charAt(0).toUpperCase() + month.slice(1),
      label: new Intl.DateTimeFormat(galleryLocale(), { day: 'numeric', month: 'long', year: 'numeric' }).format(date)
    };
  }

  function renderPodium(item) {
    if (!item.results.length) return '';
    const columns = item.results.map((result) => {
      const tone = /gold/i.test(result.category) ? ' podium-gold' : (/silver/i.test(result.category) ? ' podium-silver' : '');
      const rows = result.podium.map((entry) => `
            <li>
              <span class="medal medal-${Math.min(Math.max(entry.position, 1), 4)}">${galleryEscape(galleryText('gallery.place' + entry.position, entry.position + '°'))}</span>
              <div><strong>${galleryEscape(entry.team)}</strong>${entry.players.length ? `<span>${galleryEscape(entry.players.join(', '))}</span>` : ''}</div>
            </li>`).join('');
      return `
          <div class="podium-col${tone}">
            <h5><i class="fas fa-trophy"></i> ${galleryEscape(result.category)}</h5>
            <ol>${rows}</ol>
          </div>`;
    }).join('');

    return `
        <div class="podium">
          <h4 class="podium-title"><i class="fas fa-medal"></i> ${galleryEscape(galleryText('gallery.hallOfFame', 'Albo d\'oro'))}</h4>
          <div class="podium-grid">${columns}</div>
        </div>`;
  }

  function renderGalleryCard(item) {
    const date = formatGalleryDate(item.date);
    const count = item.photos.length;
    const meta = [item.location, date.label].filter(Boolean).join(' · ');
    const slides = item.photos.map((photo, index) => `
            <button type="button" class="carousel-slide" data-gallery="${item.key}" data-index="${index}">
              <img src="${galleryEscape(photo.thumb)}" alt="${galleryEscape(galleryText('gallery.photoAlt', 'Foto {index} di {count} – {title}', { index: index + 1, count, title: item.title }))}" loading="lazy" referrerpolicy="no-referrer" />
            </button>`).join('');

    return `
      <article class="gallery-card">
        <header class="gallery-card-header">
          ${date.day ? `<div class="event-date-badge"><span class="day">${galleryEscape(date.day)}</span><span class="month">${galleryEscape(date.month)}</span></div>` : ''}
          <div class="gallery-card-info">
            <h3>${galleryEscape(item.title)}</h3>
            <p>${galleryEscape(meta)}${count ? ` · ${galleryEscape(galleryText('gallery.photos', '{count} foto', { count }))}` : ''}</p>
          </div>
          ${item.albumUrl ? `<a class="event-action-btn" href="${galleryEscape(item.albumUrl)}" target="_blank" rel="noopener noreferrer"><i class="fab fa-google-drive"></i> ${galleryEscape(galleryText('gallery.album', 'Tutte le foto'))}</a>` : ''}
        </header>
        ${count ? `
        <div class="carousel" role="region" aria-roledescription="carousel" aria-label="${galleryEscape(galleryText('gallery.carouselLabel', 'Foto – {title}', { title: item.title }))}">
          <button type="button" class="carousel-nav prev" data-dir="-1" aria-label="${galleryEscape(galleryText('gallery.prev', 'Foto precedenti'))}"><i class="fas fa-chevron-left"></i></button>
          <div class="carousel-track" tabindex="0">${slides}
          </div>
          <button type="button" class="carousel-nav next" data-dir="1" aria-label="${galleryEscape(galleryText('gallery.next', 'Foto successive'))}"><i class="fas fa-chevron-right"></i></button>
        </div>` : ''}
        ${renderPodium(item)}
      </article>`;
  }

  function updateCarouselNav(track) {
    const carousel = track.closest('.carousel');
    const maxScroll = track.scrollWidth - track.clientWidth - 2;
    carousel.querySelector('.carousel-nav.prev').disabled = track.scrollLeft <= 2;
    carousel.querySelector('.carousel-nav.next').disabled = track.scrollLeft >= maxScroll;
  }

  function renderGallery() {
    const section = document.getElementById('gallery');
    const list = section && section.querySelector('.gallery-list');
    if (!list) return;

    const hasItems = galleryItems.length > 0;
    section.hidden = !hasItems && !isGalleryArchive;
    document.querySelectorAll('.js-gallery-link').forEach((link) => { link.hidden = !hasItems; });
    const filtered = galleryItems.filter((item) => !galleryYear || item.date.slice(0, 4) === galleryYear);
    const visible = isGalleryArchive ? filtered.slice(0, galleryVisibleCount) : galleryItems.slice(0, 1);
    list.innerHTML = visible.map(renderGalleryCard).join('');

    const archiveLink = document.getElementById('gallery-archive-link');
    if (archiveLink) archiveLink.href = 'gallery.html?lang=' + (window.SiteI18n?.lang || 'it');
    document.querySelectorAll('.js-standings-link').forEach((link) => {
      link.href = 'gallery.html?lang=' + (window.SiteI18n?.lang || 'it') + '#hall-of-fame';
    });

    if (isGalleryArchive) {
      const yearSelect = document.getElementById('gallery-year');
      const years = [...new Set(galleryItems.map((item) => item.date.slice(0, 4)).filter(Boolean))].sort().reverse();
      yearSelect.innerHTML = `<option value="">${galleryEscape(galleryText('archive.allYears', 'Tutti gli anni'))}</option>` + years.map((year) => `<option value="${year}">${year}</option>`).join('');
      yearSelect.value = galleryYear;
      document.getElementById('gallery-more').hidden = filtered.length <= galleryVisibleCount;
      document.getElementById('gallery-empty').hidden = filtered.length > 0;
      document.getElementById('gallery-count').textContent = galleryText('archive.count', '{shown} di {total} tornei', { shown: visible.length, total: filtered.length });
      renderStandings();
    }

    list.querySelectorAll('.carousel-track').forEach((track) => {
      track.addEventListener('scroll', () => updateCarouselNav(track), { passive: true });
      updateCarouselNav(track);
    });
  }

  function showLightboxPhoto(index) {
    const { photos, title } = lightboxState;
    if (!photos.length) return;
    lightboxState.index = (index + photos.length) % photos.length;
    const box = document.getElementById('lightbox');
    const img = box.querySelector('.lightbox-img');
    img.src = photos[lightboxState.index].full;
    img.alt = galleryText('gallery.photoAlt', 'Foto {index} di {count} – {title}', { index: lightboxState.index + 1, count: photos.length, title });
    box.querySelector('.lightbox-caption').textContent = `${title} – ${lightboxState.index + 1} / ${photos.length}`;
    box.querySelectorAll('.lightbox-prev, .lightbox-next').forEach((btn) => { btn.hidden = photos.length < 2; });
  }

  function openLightbox(item, index, trigger) {
    lightboxState.photos = item.photos;
    lightboxState.title = item.title;
    lightboxState.returnFocus = trigger;
    const box = document.getElementById('lightbox');
    box.hidden = false;
    document.documentElement.classList.add('lightbox-open');
    showLightboxPhoto(index);
    box.querySelector('.lightbox-close').focus();
  }

  function closeLightbox() {
    const box = document.getElementById('lightbox');
    if (box.hidden) return;
    box.hidden = true;
    box.querySelector('.lightbox-img').removeAttribute('src');
    document.documentElement.classList.remove('lightbox-open');
    if (lightboxState.returnFocus) lightboxState.returnFocus.focus();
  }

  function setupGalleryInteractions() {
    const list = document.querySelector('#gallery .gallery-list');
    const box = document.getElementById('lightbox');
    if (!list || !box) return;

    list.addEventListener('click', (event) => {
      const nav = event.target.closest('.carousel-nav');
      if (nav) {
        const track = nav.closest('.carousel').querySelector('.carousel-track');
        track.scrollBy({ left: Number(nav.dataset.dir) * track.clientWidth * 0.85, behavior: 'smooth' });
        return;
      }
      const slide = event.target.closest('.carousel-slide');
      if (!slide) return;
      const item = galleryItems.find((entry) => entry.key === slide.dataset.gallery);
      if (item) openLightbox(item, Number(slide.dataset.index), slide);
    });

    // Image load errors do not bubble: listen in capture phase
    list.addEventListener('error', (event) => {
      if (event.target.tagName === 'IMG') event.target.closest('.carousel-slide')?.classList.add('is-broken');
    }, true);

    box.addEventListener('click', (event) => {
      if (event.target.closest('.lightbox-close') || event.target === box) closeLightbox();
      else if (event.target.closest('.lightbox-prev')) showLightboxPhoto(lightboxState.index - 1);
      else if (event.target.closest('.lightbox-next')) showLightboxPhoto(lightboxState.index + 1);
    });

    document.addEventListener('keydown', (event) => {
      if (box.hidden) return;
      if (event.key === 'Escape') closeLightbox();
      else if (event.key === 'ArrowLeft') showLightboxPhoto(lightboxState.index - 1);
      else if (event.key === 'ArrowRight') showLightboxPhoto(lightboxState.index + 1);
      else if (event.key === 'Tab') {
        const buttons = [...box.querySelectorAll('button')].filter((button) => !button.hidden);
        const first = buttons[0];
        const last = buttons[buttons.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    });

    let touchStartX = null;
    box.addEventListener('touchstart', (event) => { touchStartX = event.touches[0].clientX; }, { passive: true });
    box.addEventListener('touchend', (event) => {
      if (touchStartX === null) return;
      const delta = event.changedTouches[0].clientX - touchStartX;
      touchStartX = null;
      if (Math.abs(delta) > 50) showLightboxPhoto(lightboxState.index + (delta < 0 ? 1 : -1));
    });
  }

  async function initializeGallery() {
    setupGalleryInteractions();
    try {
      const response = await fetch(GALLERY_CONFIG_URL, { cache: 'no-store' });
      if (!response.ok) throw new Error('HTTP ' + response.status);
      galleryItems = normalizeGallery(await response.json());
    } catch (error) {
      console.warn('Gallery non disponibile:', error.message || error);
      galleryItems = [];
    }
    renderGallery();
  }

  if (isGalleryArchive) {
    document.getElementById('gallery-year').addEventListener('change', (event) => {
      galleryYear = event.target.value;
      galleryVisibleCount = 6;
      renderGallery();
    });
    document.getElementById('gallery-more').addEventListener('click', () => {
      galleryVisibleCount += 6;
      renderGallery();
    });
    document.getElementById('team-search').addEventListener('input', renderStandings);
    document.addEventListener('simax:languagechange', renderGallery);
    initializeGallery();
  }

  const archiveYear = document.getElementById('year');
  if (archiveYear) archiveYear.textContent = String(new Date().getFullYear());

