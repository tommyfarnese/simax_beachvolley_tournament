/* ============================================================
   SiMax – IT/EN site language switcher
   Static text: data-i18n="key" (innerHTML) and data-i18n-attr="attr:key;attr2:key2".
   Long blocks (legal pages): data-lang-block="it|en".
   Italian is the source language written in the HTML; this file holds the English strings.
============================================================ */
(function () {
  'use strict';

  const STORAGE_KEY = 'simax_lang';
  const SUPPORTED = ['it', 'en'];

  const EN = {
    // Navbar
    'nav.tournaments': 'Tournaments',
    'nav.how': 'How it works',
    'nav.rules': 'Rules',
    'nav.contacts': 'Contacts',
    'nav.standings': 'Hall of fame',
    'nav.register': 'Register',
    'nav.registerNow': '🏐 Register now',

    // Hero + countdown
    'hero.badge': '2026 Tournament Season',
    'hero.title': 'Join the best <span>Beach Volley</span><br>in town',
    'hero.sub': 'Beach volleyball tournaments for every level. Gold and Silver categories, 3×3 and 2×2 formats. Challenge the best, enjoy the sun, win with your team.',
    'hero.cta': 'Register now',
    'hero.cta2': 'See tournaments',
    'cd.label': 'Next tournament in',
    'cd.days': 'Days',
    'cd.hours': 'Hours',
    'cd.minutes': 'Minutes',
    'cd.seconds': 'Seconds',

    // Tournaments
    'tournaments.tag': 'Calendar &amp; Registration',
    'tournaments.title': 'Upcoming <span>Tournaments</span>',
    'tournaments.desc': 'Pick the tournament, format and category that suit you best and register straight from the card.',
    'notice.open': 'Open the full-size image',
    'notice.image': 'Tornei/banner-rinunce-en.png',
    'notice.alt': 'If you need to withdraw, please let us know at least 48 hours before the tournament. Contact Massimo on 327 352 1791, Silvia on 340 394 6892 or Instagram simax_beachvolley_tournament. Please do not make us introduce mandatory advance payment.',
    'reg.intro': '<strong>How to register:</strong> click "Team registration" or "Individual registration" and the form opens right here. If the tournament is full, the same button opens the waiting list (if available). Any problems? Message us on <a href="https://wa.me/393273521791" style="color:var(--gold);" target="_blank" rel="noopener">WhatsApp</a>.',
    'tournaments.loading': 'Loading tournaments...',
    'tournaments.empty': 'There are no upcoming tournaments at the moment.',
    'tournaments.error': 'Unable to load the tournament calendar. Please try again later.',
    'tournaments.time': 'Time',
    'tournaments.format': 'Format',
    'tournaments.category': 'Category',
    'tournaments.price': 'Fee per person',
    'tournaments.maxTeams': 'Max teams',
    'tournaments.level': 'Level',
    'tournaments.na': 'n/a',
    'tournaments.open': 'Registration open',
    'tournaments.soldOut': 'Sold Out',
    'tournaments.spots': 'Available spots:',
    'tournaments.spotsValue': 'Available spots: {available} / {max}',
    'tournaments.spotsAria': 'Available spots: {available} of {max}',
    'tournaments.spotsUnknownMax': 'Available spots: n/a / {max}',
    'tournaments.spotsUnknown': 'Available spots: n/a',
    'tournaments.spotsUnknownAria': 'Spot availability unknown',
    'tournaments.spotsLoading': 'Loading available spots',
    'tournaments.teamRegistration': 'Team registration',
    'tournaments.singleRegistration': 'Individual registration',
    'tournaments.waitlist': 'Waiting list',
    'tournaments.joinWaitlist': 'Join the waiting list',
    'tournaments.waitlistInactive': 'Waiting list: not active',
    'tournaments.waitlistActive': 'Waiting list active',
    'tournaments.waitlistOne': '{count} team on the waiting list',
    'tournaments.waitlistMany': '{count} teams on the waiting list',
    'tournaments.waitlistNote': 'If a spot opens up or we expand the tournament, we will contact you in waiting-list order.',
    'tournaments.registrationFallback': 'Tournament registration',
    'tournaments.addToCalendar': 'Add to calendar',
    'tournaments.share': 'Share',
    'tournaments.openMaps': 'Open in Google Maps',
    'tournaments.calendarTimeNa': 'time n/a',
    'tournaments.calendarPerPerson': 'per person',
    'tournaments.calendarInfo': 'Info and registration',
    'tournaments.shareAt': 'at',
    'tournaments.shareCta': 'Register here:',
    'period.Mattina': 'Morning',
    'period.Pomeriggio': 'Afternoon',
    'period.Sera': 'Evening',
    'period.Giornata intera': 'All day',

    // Modal
    'modal.loadingForm': 'Loading the form...',
    'modal.fallbackText': 'The registration form for <strong>{title}</strong> will open on Google Forms.<br>Click the button below to continue.',
    'modal.fallbackButton': 'Open Google form',
    'modal.fallbackNote': '⚙️ The organiser has not set up the link yet. Contact us if it is urgent.',

    // How it works
    'how.tag': 'Process',
    'how.title': 'How to <span>Register</span>',
    'how.desc': 'Just a few steps to secure your spot. Fast, simple, from any device.',
    'how.s1t': 'Build your team',
    'how.s1d': 'Find your teammate(s) and choose the format together (3×3 or 2×2).',
    'how.s2t': 'Fill in the form',
    'how.s2d': 'Click "Team registration" or "Individual registration" on the tournament you like and fill in the Google form.',
    'how.s3t': 'Play and win!',
    'how.s3d': 'On tournament day, show up at the court at the scheduled time. Bring your energy, we take care of the rest.',

    // Gallery
    'gallery.tag': 'Gallery &amp; Hall of fame',
    'gallery.title': 'Past <span>Tournaments</span>',
    'gallery.desc': 'Relive the best moments and find out who made it to the podium.',
    'gallery.photos': '{count} photos',
    'gallery.album': 'All photos',
    'gallery.hallOfFame': 'Hall of fame',
    'gallery.photoAlt': 'Photo {index} of {count} – {title}',
    'gallery.carouselLabel': 'Photos – {title}',
    'gallery.prev': 'Previous photos',
    'gallery.next': 'Next photos',
    'gallery.place1': '1st',
    'gallery.place2': '2nd',
    'gallery.place3': '3rd',
    'archive.viewAll': 'View all past tournaments and the hall of fame',
    'archive.title': 'Gallery &amp; Hall of fame',
    'archive.back': 'Back to the website',
    'archive.year': 'Year',
    'archive.allYears': 'All years',
    'archive.more': 'Show more tournaments',
    'archive.count': '{shown} of {total} tournaments',
    'archive.empty': 'No tournaments available.',
    'archive.error': 'Unable to load the Gallery. Reload the page to try again.',
    'archive.standings': 'All-time hall of fame',
    'archive.search': 'Search team',
    'archive.team': 'Team',
    'archive.noTeams': 'No matching teams.',
    'archive.order': 'All years. Ordered by 1st, 2nd and 3rd Gold places, then Silver places. Counts are based on recorded results.',
    'lightbox.close': 'Close',
    'lightbox.prev': 'Previous photo',
    'lightbox.next': 'Next photo',

    // Rules
    'rules.tag': 'Rules',
    'rules.title': 'Rules of the <span>Game</span>',
    'rules.desc': 'Everything you need to know before stepping onto the court.',
    'rules.1t': 'Team composition',
    'rules.1b': '<ul><li>Each team must register <strong>all of its players</strong> in the registration form.</li><li><strong>3×3 Mix</strong> format: 3 starting players (at least 1 woman), 2 optional substitutes.</li><li><strong>2×2 Mix</strong> format: 2 starting players.</li><li>Players can register for more than one tournament on the same day.</li></ul>',
    'rules.2t': 'Format and pools',
    'rules.2b': '<ul><li><strong>Pool</strong> stage: teams are split into 3 pools of 4 teams and play a round robin.</li><li>Pool winners, runners-up and the 2 best third-placed teams advance to the <strong>GOLD tournament knockout stage</strong>.</li><li>The last-placed teams and the worst third-placed team advance to the <strong>SILVER tournament knockout stage</strong>.</li><li>Detailed rules will be shared before the tournament.</li></ul>',
    'rules.3t': 'Mix category',
    'rules.3b': '<p><strong>Mix:</strong> each team must include players of different genders (men and women together). The category is open to all levels.</p><br><p>Goal: have fun, play together and share beach volleyball regardless of skill level.</p>',
    'rules.4t': 'Prizes',
    'rules.4b': '<ul><li>Each tournament awards a trophy to the winners and runners-up of both the GOLD and SILVER categories.</li><li>Gadgets are also up for grabs during the tournaments through games and challenges.</li><li>Prize details will be announced before the event.</li></ul>',
    'rules.5t': 'Bad weather',
    'rules.5b': '<p>In case of bad weather, the decision to postpone or cancel the tournament will be announced on WhatsApp/social media at least <strong>2 hours before</strong> the start time.</p>',

    // FAQ
    'faq.title': 'Frequently Asked <span>Questions</span>',
    'faq.1q': 'Do I need to be experienced to take part?',
    'faq.1a': '<p>No! The tournament is open to anyone who wants to play and has team spirit.</p>',
    'faq.2q': 'Can I register without a complete team?',
    'faq.2a': '<p>We recommend having your full team before registering. However, if you are looking for teammates, message us: we will try to put you in touch with other players in the same situation.</p>',
    'faq.3q': 'How is my registration confirmed?',
    'faq.3a': '<p>After submitting the form you will receive a <strong>confirmation email</strong>. If you do not receive it within 24 hours, contact us on social media or WhatsApp.</p>',
    'faq.4q': 'Can I register for more than one tournament on the same day?',
    'faq.4a': '<p>Yes. Check the times on each tournament card before proceeding.</p>',
    'faq.5q': 'What happens if a tournament is full?',
    'faq.5a': '<p>When all spots are taken, registration closes. Don\'t wait too long! You can contact us to join a <strong>waiting list</strong>, as the number of teams may be increased if there is high demand.</p>',
    'faq.6q': 'What should I bring on tournament day?',
    'faq.6a': '<ul><li>Beach volleyball clothing (recommended)</li><li>Water and snacks</li><li>Sunscreen</li><li>Team spirit 🏐</li><li>Lots of enthusiasm</li></ul><p style="margin-top:10px">Balls are provided by the organisers, but we recommend bringing your own to warm up between matches.</p>',

    // Contacts
    'contact.tag': 'Contacts',
    'contact.title': 'Stay in <span>Touch</span>',
    'contact.desc': 'Questions, doubts or want to know all about the next dates? Message us, we reply quickly.',
    'contact.wa': 'Message us on WhatsApp',
    'contact.where': 'Where we play',

    // Footer + CTA
    'footer.tagline': 'Beach volleyball tournaments &nbsp;·&nbsp; More than a tournament',
    'footer.manageCookies': 'Manage cookies',
    'footer.admin': 'Organisers area',
    'footer.rights': 'All rights reserved.',
    'footer.made': 'Website made with ❤️ and sand between our toes.',
    'cta.mobile': 'Register for the next tournament',

    // Cookie banner
    'cookie.aria': 'Cookie preferences',
    'cookie.title': 'Cookies and statistics',
    'cookie.text': 'We use necessary technical cookies and, only with your consent, Google Analytics for statistics on visits and button clicks. You can accept or decline at any time.',
    'cookie.accept': 'Accept',
    'cookie.reject': 'Decline',
    'cookie.manage': 'Customise',
    'cookie.techTitle': 'Necessary technical cookies',
    'cookie.techHelp': 'Always active: required for the site to work properly.',
    'cookie.statsTitle': 'Statistics cookies (Google Analytics)',
    'cookie.statsHelp': 'If enabled, we collect aggregated data on visits and clicks on the main buttons.',
    'cookie.save': 'Save preferences'
  };

  function readStoredLanguage() {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch (_) {
      return null;
    }
  }

  function detectLanguage() {
    const fromUrl = new URLSearchParams(window.location.search).get('lang');
    if (SUPPORTED.includes(fromUrl)) return fromUrl;
    const stored = readStoredLanguage();
    if (SUPPORTED.includes(stored)) return stored;
    const browserLanguages = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || 'it'];
    return browserLanguages.some((lang) => String(lang).toLowerCase().startsWith('it')) ? 'it' : 'en';
  }

  let current = detectLanguage();
  const italianHtml = new Map();
  const italianAttrs = new Map();

  function interpolate(text, vars) {
    if (!vars) return text;
    return String(text).replace(/\{(\w+)\}/g, (match, name) => (name in vars ? String(vars[name]) : match));
  }

  function t(key, italian, vars) {
    const text = current === 'en' && Object.prototype.hasOwnProperty.call(EN, key) ? EN[key] : italian;
    return interpolate(text, vars);
  }

  function applyStaticTranslations(root) {
    root.querySelectorAll('[data-i18n]').forEach((el) => {
      if (!italianHtml.has(el)) italianHtml.set(el, el.innerHTML);
      const key = el.getAttribute('data-i18n');
      // Dictionary entries are static strings defined in this file, never user input
      el.innerHTML = current === 'en' && EN[key] !== undefined ? EN[key] : italianHtml.get(el);
    });

    root.querySelectorAll('[data-i18n-attr]').forEach((el) => {
      el.getAttribute('data-i18n-attr').split(';').forEach((pair) => {
        const [attr, key] = pair.split(':').map((part) => part.trim());
        if (!attr || !key) return;
        const cacheKey = el;
        if (!italianAttrs.has(cacheKey)) italianAttrs.set(cacheKey, {});
        const cache = italianAttrs.get(cacheKey);
        if (!(attr in cache)) cache[attr] = el.getAttribute(attr) || '';
        el.setAttribute(attr, current === 'en' && EN[key] !== undefined ? EN[key] : cache[attr]);
      });
    });

    root.querySelectorAll('[data-lang-block]').forEach((el) => {
      el.hidden = el.getAttribute('data-lang-block') !== current;
    });

    root.querySelectorAll('[data-lang-switch]').forEach((button) => {
      button.setAttribute('aria-pressed', button.getAttribute('data-lang-switch') === current ? 'true' : 'false');
    });
  }

  function apply() {
    document.documentElement.lang = current;
    applyStaticTranslations(document);
  }

  function setLanguage(lang) {
    if (!SUPPORTED.includes(lang) || lang === current) return;
    current = lang;
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch (_) { /* storage disabled: keep the choice for this page only */ }
    apply();
    document.dispatchEvent(new CustomEvent('simax:languagechange', { detail: { lang } }));
  }

  document.addEventListener('click', (event) => {
    const button = event.target.closest('[data-lang-switch]');
    if (button) setLanguage(button.getAttribute('data-lang-switch'));
  });

  window.SiteI18n = {
    get lang() { return current; },
    get locale() { return current === 'en' ? 'en-GB' : 'it-IT'; },
    t,
    setLanguage,
    apply
  };

  if (document.readyState === 'loading') {
    // Loaded at the end of <body>: markup above is already parsed, avoid a flash of Italian text
    if (document.body) apply();
    document.addEventListener('DOMContentLoaded', apply);
  } else {
    apply();
  }
})();
