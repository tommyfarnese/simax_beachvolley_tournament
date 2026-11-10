/* ============================================================
   SiMax AI – chatbot widget (vanilla JS, GitHub Pages friendly)
   Override any option before this script with window.SIMAX_CHAT_CONFIG = { ... }
============================================================ */
(function () {
  'use strict';

  const DEFAULT_CONFIG = {
    apiUrl: 'https://simax-api-ai-dkapbub7frg8e7ah.westeurope-01.azurewebsites.net/api/ai/chat',
    siteUrl: 'https://tommyfarnese.github.io/simax_beachvolley_tournament/',
    defaultLanguage: 'it',
    requestTimeoutMs: 60000,
    autoRetryEnabled: true,
    maxAutoRetries: 1,
    retryDelayMs: 3000,
    retryJitterMs: 1000,
    retryableStatuses: [502, 503, 504],
    // Fetch failures this fast are assumed to happen before the request reached the server
    retryOnEarlyNetworkError: true,
    earlyNetworkErrorMs: 1500,
    slowStatusAfterMs: 8000,
    verySlowStatusAfterMs: 20000,
    maxMessageLength: 2000,
    maxHistoryMessages: 10,
    abortOnClose: true,
    closeOnInternalLink: true,
    debug: null
  };

  const CONFIG = Object.freeze(Object.assign({}, DEFAULT_CONFIG, window.SIMAX_CHAT_CONFIG || {}));

  const SECTIONS = ['tornei', 'come-funziona', 'iscrizioni', 'gallery', 'regolamento', 'faq', 'contatti'];
  const LANGUAGES = ['it', 'en'];

  const DEBUG = CONFIG.debug !== null
    ? Boolean(CONFIG.debug)
    : ['localhost', '127.0.0.1', ''].includes(window.location.hostname);

  const I18N = {
    it: {
      launcherOpen: 'Chiedi a SiMax AI',
      launcherClose: 'Chiudi SiMax AI',
      subtitle: 'Assistente tornei SiMax',
      langGroup: 'Lingua della chat',
      langIt: 'Italiano',
      langEn: 'Inglese',
      newChat: 'Nuova conversazione',
      close: 'Chiudi chat',
      log: 'Conversazione con SiMax AI',
      inputLabel: 'Scrivi un messaggio a SiMax AI',
      placeholder: 'Scrivi la tua domanda...',
      send: 'Invia messaggio',
      you: 'Tu:',
      assistant: 'SiMax AI:',
      welcome: 'Ciao! 👋 Sono SiMax AI. Posso aiutarti con tornei, iscrizioni, regolamento e informazioni sugli eventi. Cosa vuoi sapere?',
      suggestionsLabel: 'Domande suggerite',
      suggestions: [
        { label: 'Prossimi tornei', message: 'Quali sono i prossimi tornei?' },
        { label: 'Come mi iscrivo?', message: 'Come mi iscrivo?' },
        { label: 'Regolamento', message: 'Qual è il regolamento dei tornei?' }
      ],
      status: [
        'Sto cercando le informazioni...',
        'Sto preparando la risposta...',
        'Ci vuole qualche istante in più, grazie per l\'attesa.'
      ],
      error: 'Al momento non riesco a recuperare la risposta. Puoi riprovare tra qualche istante.',
      interrupted: 'La richiesta è stata interrotta. Puoi riprovare quando vuoi.',
      rateLimited: 'Hai inviato diverse richieste in poco tempo. Riprova tra un minuto.',
      rateLimitedSeconds: (s) => 'Hai inviato diverse richieste in poco tempo. Riprova tra ' + s + (s === 1 ? ' secondo.' : ' secondi.'),
      retry: 'Riprova',
      tooLong: (max) => 'Il messaggio è troppo lungo: massimo ' + max + ' caratteri.',
      hint: 'Invio per inviare · Shift+Invio per andare a capo',
      sectionLabels: {
        '': 'home page',
        tornei: 'Tornei',
        'come-funziona': 'Come funziona',
        iscrizioni: 'Iscrizioni',
        regolamento: 'Regolamento',
        faq: 'FAQ',
        contatti: 'Contatti',
        gallery: 'Gallery'
      },
      formLabel: 'modulo di iscrizione'
    },
    en: {
      launcherOpen: 'Ask SiMax AI',
      launcherClose: 'Close SiMax AI',
      subtitle: 'SiMax tournament assistant',
      langGroup: 'Chat language',
      langIt: 'Italian',
      langEn: 'English',
      newChat: 'New conversation',
      close: 'Close chat',
      log: 'Conversation with SiMax AI',
      inputLabel: 'Write a message to SiMax AI',
      placeholder: 'Type your question...',
      send: 'Send message',
      you: 'You:',
      assistant: 'SiMax AI:',
      welcome: 'Hi! 👋 I\'m SiMax AI. I can help you with tournaments, registrations, rules and event information. What would you like to know?',
      suggestionsLabel: 'Suggested questions',
      suggestions: [
        { label: 'Upcoming tournaments', message: 'What are the upcoming tournaments?' },
        { label: 'How can I register?', message: 'How can I register?' },
        { label: 'Tournament rules', message: 'What are the tournament rules?' }
      ],
      status: [
        'I\'m looking up the information...',
        'I\'m preparing your answer...',
        'This is taking a little longer than usual. Thanks for your patience.'
      ],
      error: 'I couldn\'t retrieve the answer right now. Please try again in a moment.',
      interrupted: 'The request was interrupted. You can try again whenever you like.',
      rateLimited: 'You\'ve sent several messages in a short time. Please try again in a minute.',
      rateLimitedSeconds: (s) => 'You\'ve sent several messages in a short time. Please try again in ' + s + (s === 1 ? ' second.' : ' seconds.'),
      retry: 'Retry',
      tooLong: (max) => 'Your message is too long: maximum ' + max + ' characters.',
      hint: 'Enter to send · Shift+Enter for a new line',
      sectionLabels: {
        '': 'home page',
        tornei: 'Tournaments',
        'come-funziona': 'How it works',
        iscrizioni: 'Registrations',
        regolamento: 'Rules',
        faq: 'FAQ',
        contatti: 'Contacts',
        gallery: 'Gallery'
      },
      formLabel: 'registration form'
    }
  };

  const state = {
    lang: window.SiteI18n && LANGUAGES.includes(window.SiteI18n.lang)
      ? window.SiteI18n.lang
      : (LANGUAGES.includes(CONFIG.defaultLanguage) ? CONFIG.defaultLanguage : 'it'),
    isOpen: false,
    busy: false,
    history: [],
    controller: null,
    abortReason: null,
    requestSeq: 0,
    conversationStarted: false,
    welcomeEl: null,
    suggestionsEl: null,
    errorEl: null,
    typingEl: null,
    statusStage: 0,
    statusTimers: [],
    lastFocus: null
  };

  const ui = {};

  /* ---------- Utilities ---------- */
  function t(key) {
    return I18N[state.lang][key];
  }

  function debugLog() {
    if (!DEBUG) return;
    console.info.apply(console, ['[SiMax AI]'].concat(Array.from(arguments)));
  }

  function el(tag, attrs, children) {
    const node = document.createElement(tag);
    Object.entries(attrs || {}).forEach(([name, value]) => {
      if (value === null || value === undefined || value === false) return;
      if (name === 'className') node.className = value;
      else if (name === 'text') node.textContent = value;
      else node.setAttribute(name, value === true ? '' : String(value));
    });
    (children || []).forEach((child) => {
      if (child) node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
    });
    return node;
  }

  function icon(name) {
    return el('i', { className: 'fas ' + name, 'aria-hidden': 'true' });
  }

  // Inline SVG flags: Windows does not render flag emoji
  const FLAGS = {
    it: {
      viewBox: '0 0 3 2',
      shapes: [
        ['rect', { width: '1', height: '2', fill: '#009246' }],
        ['rect', { x: '1', width: '1', height: '2', fill: '#ffffff' }],
        ['rect', { x: '2', width: '1', height: '2', fill: '#ce2b37' }]
      ]
    },
    en: {
      viewBox: '0 0 60 30',
      shapes: [
        ['rect', { width: '60', height: '30', fill: '#012169' }],
        ['path', { d: 'M0,0 L60,30 M60,0 L0,30', stroke: '#ffffff', 'stroke-width': '6' }],
        ['path', { d: 'M0,0 L60,30 M60,0 L0,30', stroke: '#c8102e', 'stroke-width': '2' }],
        ['path', { d: 'M30,0 V30 M0,15 H60', stroke: '#ffffff', 'stroke-width': '10' }],
        ['path', { d: 'M30,0 V30 M0,15 H60', stroke: '#c8102e', 'stroke-width': '6' }]
      ]
    }
  };

  function flagIcon(lang) {
    const ns = 'http://www.w3.org/2000/svg';
    const spec = FLAGS[lang];
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('class', 'sxc-flag');
    svg.setAttribute('viewBox', spec.viewBox);
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    spec.shapes.forEach(([tag, attrs]) => {
      const shape = document.createElementNS(ns, tag);
      Object.entries(attrs).forEach(([name, value]) => shape.setAttribute(name, value));
      svg.appendChild(shape);
    });
    return svg;
  }

  function isCoarsePointer() {
    return window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
  }

  function prefersReducedMotion() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  /* ---------- URL validation ---------- */
  function normalizePath(pathname) {
    let path = String(pathname || '/').replace(/\/index\.html?$/i, '/');
    if (!path.endsWith('/')) path += '/';
    return path;
  }

  function formKey(url) {
    return url.origin + normalizePath(url.pathname).replace(/\/viewform\/$/i, '/');
  }

  function getAllowedFormKeys() {
    // Form URLs are rendered by the site from events.json: reuse them instead of fetching again
    const keys = new Set();
    document.querySelectorAll('[data-form-url], [data-single-form-url], [data-waitlist-form-url]').forEach((node) => {
      [node.dataset.formUrl, node.dataset.singleFormUrl, node.dataset.waitlistFormUrl].forEach((value) => {
        if (!value) return;
        try {
          const url = new URL(value);
          if (url.protocol === 'https:') keys.add(formKey(url));
        } catch (_) { /* ignore malformed config values */ }
      });
    });
    return keys;
  }

  function isCurrentSitePage(url) {
    const site = new URL(CONFIG.siteUrl);
    const samePublishedSite = url.origin === site.origin && normalizePath(url.pathname) === normalizePath(site.pathname);
    const sameLocalPage = url.origin === window.location.origin && normalizePath(url.pathname) === normalizePath(window.location.pathname);
    return samePublishedSite || sameLocalPage;
  }

  function resolveLink(raw) {
    const value = String(raw || '').trim();
    if (!value) return null;

    if (value.startsWith('#')) {
      const section = value.slice(1).toLowerCase();
      return SECTIONS.includes(section) ? { type: 'internal', section } : null;
    }

    let url;
    try {
      url = new URL(value, CONFIG.siteUrl);
    } catch (_) {
      return null;
    }

    if (url.username || url.password) return null;
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;

    if (isCurrentSitePage(url)) {
      let section = '';
      try { section = decodeURIComponent(url.hash.slice(1)).toLowerCase(); } catch (_) { return null; }
      if (!section) return { type: 'internal', section: null };
      return SECTIONS.includes(section) ? { type: 'internal', section } : null;
    }

    if (url.protocol === 'https:' && getAllowedFormKeys().has(formKey(url))) {
      return { type: 'external', href: url.href };
    }

    return null;
  }

  /* ---------- Rich text rendering (no innerHTML) ---------- */
  const TOKEN_RE = /\[([^\]\n]{1,300})\]\(\s*([^)\s]{1,2048})\s*\)|\*\*([^*\n]{1,300})\*\*|(https?:\/\/[^\s<>"'`]+)|(^|[\s(])#(tornei|come-funziona|iscrizioni|gallery|regolamento|faq|contatti)(?![\w-])/gi;

  function appendLink(container, label, rawUrl) {
    const target = resolveLink(rawUrl);
    let cleanLabel = String(label || '').replace(/\*\*/g, '').trim() || rawUrl;

    if (!target) {
      container.appendChild(document.createTextNode(cleanLabel === rawUrl ? rawUrl : cleanLabel + ' (' + rawUrl + ')'));
      return;
    }

    // Replace bare URLs / #anchors with a readable label
    if (cleanLabel === rawUrl || /^(https?:\/\/|#)/i.test(cleanLabel)) {
      cleanLabel = target.type === 'internal'
        ? t('sectionLabels')[target.section || '']
        : t('formLabel');
    }

    if (target.type === 'internal') {
      const link = el('a', { href: '#' + (target.section || ''), text: cleanLabel });
      link.addEventListener('click', (event) => {
        event.preventDefault();
        navigateToSection(target.section);
      });
      container.appendChild(link);
      return;
    }

    container.appendChild(el('a', {
      href: target.href,
      target: '_blank',
      rel: 'noopener noreferrer',
      text: cleanLabel
    }));
  }

  function renderInline(container, text) {
    let lastIndex = 0;
    TOKEN_RE.lastIndex = 0;
    let match;

    while ((match = TOKEN_RE.exec(text)) !== null) {
      if (match.index > lastIndex) {
        container.appendChild(document.createTextNode(text.slice(lastIndex, match.index)));
      }

      if (match[1] !== undefined) {
        appendLink(container, match[1], match[2]);
      } else if (match[3] !== undefined) {
        container.appendChild(el('strong', { text: match[3] }));
      } else if (match[4] !== undefined) {
        const rawUrl = match[4];
        const trimmed = rawUrl.replace(/[.,;:!?)\]]+$/, '');
        appendLink(container, trimmed, trimmed);
        if (trimmed.length < rawUrl.length) {
          container.appendChild(document.createTextNode(rawUrl.slice(trimmed.length)));
        }
      } else {
        const prefix = match[5] || '';
        if (prefix) container.appendChild(document.createTextNode(prefix));
        appendLink(container, '#' + match[6], '#' + match[6]);
      }

      lastIndex = TOKEN_RE.lastIndex;
    }

    if (lastIndex < text.length) {
      container.appendChild(document.createTextNode(text.slice(lastIndex)));
    }
  }

  function renderRichText(container, text) {
    const lines = String(text).split('\n');
    lines.forEach((line, index) => {
      const heading = line.match(/^\s{0,3}#{1,6}\s+(.*)$/);
      if (heading) {
        const strong = el('strong');
        renderInline(strong, heading[1]);
        container.appendChild(strong);
      } else {
        renderInline(container, line);
      }
      if (index < lines.length - 1) container.appendChild(document.createTextNode('\n'));
    });
  }

  /* ---------- Navigation ---------- */
  function navigateToSection(section) {
    if (CONFIG.closeOnInternalLink) closeChat({ abort: false, restoreFocus: false });

    const behavior = prefersReducedMotion() ? 'auto' : 'smooth';
    if (!section) {
      window.scrollTo({ top: 0, behavior });
      return;
    }

    const target = document.getElementById(section);
    if (!target) return;

    if (window.location.hash !== '#' + section) {
      history.pushState(null, '', '#' + section);
    }
    target.scrollIntoView({ behavior, block: 'start' });
    if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: true });
  }

  /* ---------- Messages rendering ---------- */
  function scrollToBottom() {
    if (ui.messages) ui.messages.scrollTop = ui.messages.scrollHeight;
  }

  function appendMessage(role, text, options) {
    const opts = options || {};
    const bubble = el('div', { className: 'sxc-bubble' });
    bubble.appendChild(el('span', { className: 'sxc-sr-only', text: role === 'user' ? t('you') + ' ' : t('assistant') + ' ' }));

    if (role === 'user') {
      bubble.appendChild(document.createTextNode(text));
    } else {
      renderRichText(bubble, text);
    }

    const classes = ['sxc-msg', 'sxc-msg--' + role];
    if (opts.error) classes.push('sxc-msg--error');
    const msg = el('div', { className: classes.join(' ') }, [bubble]);

    if (opts.before) ui.messages.insertBefore(msg, opts.before);
    else ui.messages.appendChild(msg);
    scrollToBottom();
    return msg;
  }

  function renderSuggestions() {
    removeSuggestions();
    const wrap = el('div', { className: 'sxc-suggestions', role: 'group', 'aria-label': t('suggestionsLabel') });
    t('suggestions').forEach((item) => {
      const chip = el('button', { type: 'button', className: 'sxc-chip', text: item.label });
      chip.disabled = state.busy;
      chip.addEventListener('click', () => sendMessage(item.message));
      wrap.appendChild(chip);
    });
    ui.messages.appendChild(wrap);
    state.suggestionsEl = wrap;
    scrollToBottom();
  }

  function removeSuggestions() {
    if (state.suggestionsEl) state.suggestionsEl.remove();
    state.suggestionsEl = null;
  }

  function renderWelcome() {
    state.welcomeEl = appendMessage('assistant', t('welcome'));
    renderSuggestions();
  }

  function removeErrorBubble() {
    if (state.errorEl) state.errorEl.remove();
    state.errorEl = null;
  }

  /* ---------- Waiting indicator (cold start friendly) ---------- */
  function updateTypingText() {
    if (!state.typingEl) return;
    const text = t('status')[state.statusStage];
    state.typingEl.querySelector('.sxc-typing-text').textContent = text;
    ui.srStatus.textContent = text;
  }

  function setStatusStage(stage) {
    state.statusStage = stage;
    updateTypingText();
  }

  function showTyping() {
    hideTyping();
    const dots = el('span', { className: 'sxc-dots' }, [el('span'), el('span'), el('span')]);
    const bubble = el('div', { className: 'sxc-bubble' }, [dots, el('span', { className: 'sxc-typing-text' })]);
    state.typingEl = el('div', { className: 'sxc-msg sxc-msg--assistant sxc-typing', 'aria-hidden': 'true' }, [bubble]);
    ui.messages.appendChild(state.typingEl);
    setStatusStage(0);
    state.statusTimers.push(setTimeout(() => setStatusStage(1), CONFIG.slowStatusAfterMs));
    state.statusTimers.push(setTimeout(() => setStatusStage(2), CONFIG.verySlowStatusAfterMs));
    scrollToBottom();
  }

  function hideTyping() {
    state.statusTimers.forEach(clearTimeout);
    state.statusTimers = [];
    if (state.typingEl) state.typingEl.remove();
    state.typingEl = null;
    if (ui.srStatus) ui.srStatus.textContent = '';
  }

  function setBusy(isBusy) {
    state.busy = isBusy;
    ui.send.disabled = isBusy;
    ui.messages.setAttribute('aria-busy', isBusy ? 'true' : 'false');
    if (state.suggestionsEl) {
      state.suggestionsEl.querySelectorAll('button').forEach((chip) => { chip.disabled = isBusy; });
    }
  }

  /* ---------- History ---------- */
  function buildHistoryPayload() {
    return state.history
      .slice(-CONFIG.maxHistoryMessages)
      .map((item) => ({ role: item.role, content: item.content.slice(0, CONFIG.maxMessageLength) }));
  }

  function pushExchange(userMessage, answer) {
    state.history.push({ role: 'user', content: userMessage }, { role: 'assistant', content: answer });
  }

  /* ---------- Network ---------- */
  function chatError(kind, extra) {
    return Object.assign({ isChatError: true, kind }, extra || {});
  }

  function parseRetryAfter(value) {
    if (!value) return null;
    const seconds = Number(value);
    if (Number.isFinite(seconds) && seconds >= 0) return Math.ceil(seconds);
    const date = Date.parse(value);
    if (Number.isNaN(date)) return null;
    return Math.max(0, Math.ceil((date - Date.now()) / 1000));
  }

  async function performAttempt(payload, outerSignal) {
    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; controller.abort(); }, CONFIG.requestTimeoutMs);
    const forwardAbort = () => controller.abort();
    outerSignal.addEventListener('abort', forwardAbort, { once: true });
    const startedAt = performance.now();

    try {
      const response = await fetch(CONFIG.apiUrl, {
        method: 'POST',
        mode: 'cors',
        credentials: 'omit',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      if (!response.ok) {
        throw chatError('http', {
          status: response.status,
          retryAfterSec: parseRetryAfter(response.headers.get('Retry-After'))
        });
      }

      let data;
      try {
        data = await response.json();
      } catch (_) {
        throw chatError('invalid');
      }

      const answer = data && typeof data.answer === 'string' ? data.answer.trim() : '';
      if (!answer) throw chatError('invalid');
      return answer;
    } catch (error) {
      if (error && error.isChatError) throw error;
      if (outerSignal.aborted) throw chatError('aborted');
      if (timedOut) throw chatError('timeout');
      if (error && error.name === 'AbortError') throw chatError('aborted');
      throw chatError('network', { elapsedMs: performance.now() - startedAt });
    } finally {
      clearTimeout(timer);
      outerSignal.removeEventListener('abort', forwardAbort);
      debugLog('attempt finished in', Math.round(performance.now() - startedAt), 'ms');
    }
  }

  function shouldAutoRetry(error, retriesDone) {
    if (!CONFIG.autoRetryEnabled || retriesDone >= CONFIG.maxAutoRetries) return false;
    if (error.kind === 'http') return CONFIG.retryableStatuses.includes(error.status);
    if (error.kind === 'network') {
      return CONFIG.retryOnEarlyNetworkError
        && error.elapsedMs < CONFIG.earlyNetworkErrorMs
        && navigator.onLine !== false;
    }
    return false;
  }

  function wait(ms, signal) {
    return new Promise((resolve, reject) => {
      if (signal.aborted) {
        reject(chatError('aborted'));
        return;
      }
      const timer = setTimeout(() => {
        signal.removeEventListener('abort', onAbort);
        resolve();
      }, ms);
      function onAbort() {
        clearTimeout(timer);
        reject(chatError('aborted'));
      }
      signal.addEventListener('abort', onAbort, { once: true });
    });
  }

  async function requestWithRetry(payload, signal) {
    let retriesDone = 0;
    for (;;) {
      try {
        return await performAttempt(payload, signal);
      } catch (error) {
        debugLog('attempt failed', { kind: error.kind, status: error.status, retry: retriesDone });
        if (!shouldAutoRetry(error, retriesDone)) throw error;
        retriesDone += 1;
        await wait(CONFIG.retryDelayMs + Math.random() * CONFIG.retryJitterMs, signal);
      }
    }
  }

  /* ---------- Errors ---------- */
  function showFailure(error, message) {
    let text = t('error');
    if (error.kind === 'http' && error.status === 429) {
      text = error.retryAfterSec ? t('rateLimitedSeconds')(error.retryAfterSec) : t('rateLimited');
    } else if (error.kind === 'aborted') {
      text = t('interrupted');
    }

    const msg = appendMessage('assistant', text, { error: true });
    const retryBtn = el('button', { type: 'button', className: 'sxc-retry' }, [icon('fa-rotate-right'), t('retry')]);
    retryBtn.addEventListener('click', () => {
      removeErrorBubble();
      sendMessage(message, { isRetry: true });
    });
    msg.querySelector('.sxc-bubble').appendChild(el('div', {}, [retryBtn]));
    state.errorEl = msg;
    scrollToBottom();
  }

  /* ---------- Send ---------- */
  async function sendMessage(rawText, options) {
    const isRetry = Boolean(options && options.isRetry);
    if (state.busy) return;

    const message = String(rawText || '').trim();
    if (!message) return;
    if (message.length > CONFIG.maxMessageLength) {
      showNotice(t('tooLong')(CONFIG.maxMessageLength));
      return;
    }

    showNotice('');
    removeSuggestions();
    removeErrorBubble();
    state.conversationStarted = true;

    if (!isRetry) {
      appendMessage('user', message);
      ui.input.value = '';
      onInputChange();
    }

    const payload = { message, language: state.lang, history: buildHistoryPayload() };
    const controller = new AbortController();
    const seq = ++state.requestSeq;
    state.controller = controller;
    state.abortReason = null;
    setBusy(true);
    showTyping();

    try {
      const answer = await requestWithRetry(payload, controller.signal);
      if (seq !== state.requestSeq) return;
      hideTyping();
      appendMessage('assistant', answer);
      pushExchange(message, answer);
      if (!state.isOpen) ui.root.classList.add('has-unread');
    } catch (error) {
      if (seq !== state.requestSeq) return;
      hideTyping();
      showFailure(error, message);
    } finally {
      if (seq === state.requestSeq) {
        state.controller = null;
        state.abortReason = null;
        setBusy(false);
        if (state.isOpen && !isCoarsePointer() && ui.panel.contains(document.activeElement)) {
          ui.input.focus();
        }
      }
    }
  }

  function abortPending(reason) {
    if (!state.controller) return;
    state.abortReason = reason;
    state.controller.abort();
  }

  /* ---------- Reset ---------- */
  function resetConversation() {
    abortPending('reset');
    state.requestSeq += 1;
    state.controller = null;
    hideTyping();
    setBusy(false);
    state.history = [];
    state.conversationStarted = false;
    state.errorEl = null;
    state.suggestionsEl = null;
    ui.messages.replaceChildren();
    ui.input.value = '';
    onInputChange();
    showNotice('');
    renderWelcome();
    if (!isCoarsePointer()) ui.input.focus();
  }

  /* ---------- Language ---------- */
  function applyLanguage() {
    ui.launcher.setAttribute('aria-label', state.isOpen ? t('launcherClose') : t('launcherOpen'));
    ui.tooltip.textContent = t('launcherOpen');
    ui.subtitle.textContent = t('subtitle');
    ui.langGroup.setAttribute('aria-label', t('langGroup'));
    ui.langButtons.forEach((button) => {
      const lang = button.dataset.lang;
      button.setAttribute('aria-pressed', lang === state.lang ? 'true' : 'false');
      button.setAttribute('aria-label', lang === 'it' ? t('langIt') : t('langEn'));
    });
    ui.newChat.setAttribute('aria-label', t('newChat'));
    ui.newChat.title = t('newChat');
    ui.close.setAttribute('aria-label', t('close'));
    ui.close.title = t('close');
    ui.messages.setAttribute('aria-label', t('log'));
    ui.inputLabel.textContent = t('inputLabel');
    ui.input.placeholder = t('placeholder');
    ui.send.setAttribute('aria-label', t('send'));
    ui.send.title = t('send');
    ui.hint.textContent = t('hint');
    updateTypingText();

    // Only the untouched local welcome is re-localised; past AI answers stay as they are
    if (!state.conversationStarted && state.welcomeEl) {
      const fresh = appendMessage('assistant', t('welcome'), { before: state.welcomeEl });
      state.welcomeEl.remove();
      state.welcomeEl = fresh;
      renderSuggestions();
    } else if (state.suggestionsEl) {
      renderSuggestions();
    }
  }

  function setLanguage(lang) {
    if (!LANGUAGES.includes(lang) || lang === state.lang) return;
    state.lang = lang;
    applyLanguage();
  }

  /* ---------- Input ---------- */
  function showNotice(text) {
    ui.notice.textContent = text;
    ui.hint.hidden = Boolean(text);
  }

  function autoResize() {
    ui.input.style.height = 'auto';
    ui.input.style.height = Math.min(ui.input.scrollHeight, 120) + 'px';
  }

  function onInputChange() {
    autoResize();
    const length = ui.input.value.length;
    const showCounter = length > CONFIG.maxMessageLength * 0.8;
    ui.counter.hidden = !showCounter;
    ui.counter.textContent = length + '/' + CONFIG.maxMessageLength;
    ui.counter.classList.toggle('is-over', length > CONFIG.maxMessageLength);
  }

  /* ---------- Open / close ---------- */
  function syncViewport() {
    const vv = window.visualViewport;
    if (!vv) return;
    ui.root.style.setProperty('--sxc-vv-height', vv.height + 'px');
    ui.root.style.setProperty('--sxc-vv-top', vv.offsetTop + 'px');
    if (state.isOpen) scrollToBottom();
  }

  function openChat() {
    if (state.isOpen) return;
    state.isOpen = true;
    state.lastFocus = document.activeElement;
    ui.panel.hidden = false;
    ui.root.classList.add('is-open');
    ui.root.classList.remove('has-unread');
    ui.launcher.setAttribute('aria-expanded', 'true');
    ui.launcher.setAttribute('aria-label', t('launcherClose'));
    document.documentElement.classList.add('sxc-lock-scroll');
    if (!state.welcomeEl) renderWelcome();
    syncViewport();
    scrollToBottom();
    requestAnimationFrame(() => {
      if (isCoarsePointer()) ui.title.focus();
      else ui.input.focus();
    });
  }

  function closeChat(options) {
    const opts = Object.assign({ abort: CONFIG.abortOnClose, restoreFocus: true }, options || {});
    if (!state.isOpen) return;
    if (opts.abort) abortPending('close');
    state.isOpen = false;
    ui.panel.hidden = true;
    ui.root.classList.remove('is-open');
    ui.launcher.setAttribute('aria-expanded', 'false');
    ui.launcher.setAttribute('aria-label', t('launcherOpen'));
    document.documentElement.classList.remove('sxc-lock-scroll');
    if (opts.restoreFocus) ui.launcher.focus();
  }

  /* ---------- Build UI ---------- */
  function buildUi() {
    ui.root = document.getElementById('simax-chat-root') || document.body.appendChild(el('div', { id: 'simax-chat-root' }));
    ui.root.classList.add('sxc-root');

    ui.tooltip = el('span', { className: 'sxc-tooltip', 'aria-hidden': 'true' });
    ui.launcher = el('button', {
      type: 'button',
      className: 'sxc-launcher',
      'aria-controls': 'sxc-panel',
      'aria-expanded': 'false'
    }, [
      el('i', { className: 'fas fa-comments sxc-icon-chat', 'aria-hidden': 'true' }),
      el('i', { className: 'fas fa-times sxc-icon-close', 'aria-hidden': 'true' }),
      el('span', { className: 'sxc-launcher-badge', 'aria-hidden': 'true' }),
      ui.tooltip
    ]);

    ui.title = el('h2', { id: 'sxc-title', className: 'sxc-title', tabindex: '-1', text: 'SiMax AI' });
    ui.subtitle = el('p', { className: 'sxc-subtitle' });

    ui.langButtons = LANGUAGES.map((lang) => el('button', {
      type: 'button',
      'data-lang': lang,
      lang: lang
    }, [flagIcon(lang), lang.toUpperCase()]));
    ui.langGroup = el('div', { className: 'sxc-lang', role: 'group' }, ui.langButtons);
    ui.newChat = el('button', { type: 'button', className: 'sxc-icon-btn' }, [icon('fa-rotate-right')]);
    ui.close = el('button', { type: 'button', className: 'sxc-icon-btn' }, [icon('fa-times')]);

    const header = el('div', { className: 'sxc-header' }, [
      el('div', { className: 'sxc-avatar', 'aria-hidden': 'true' }, [icon('fa-robot')]),
      el('div', { className: 'sxc-heading' }, [ui.title, ui.subtitle]),
      el('div', { className: 'sxc-header-actions' }, [ui.langGroup, ui.newChat, ui.close])
    ]);

    ui.messages = el('div', {
      className: 'sxc-messages',
      role: 'log',
      'aria-live': 'polite',
      'aria-relevant': 'additions',
      'aria-busy': 'false',
      tabindex: '0'
    });
    ui.srStatus = el('div', { className: 'sxc-sr-only', role: 'status', 'aria-live': 'polite' });

    ui.inputLabel = el('label', { className: 'sxc-sr-only', for: 'sxc-input' });
    ui.input = el('textarea', {
      id: 'sxc-input',
      className: 'sxc-input',
      rows: '1',
      maxlength: String(CONFIG.maxMessageLength),
      autocomplete: 'off',
      enterkeyhint: 'send'
    });
    ui.send = el('button', { type: 'submit', className: 'sxc-send' }, [icon('fa-paper-plane')]);
    ui.form = el('form', { className: 'sxc-form', novalidate: true }, [ui.inputLabel, ui.input, ui.send]);
    ui.notice = el('span', { className: 'sxc-notice', role: 'alert' });
    ui.hint = el('span', { className: 'sxc-hint' });
    ui.counter = el('span', { className: 'sxc-counter', 'aria-live': 'polite', hidden: true });

    const composer = el('div', { className: 'sxc-composer' }, [
      ui.form,
      el('div', { className: 'sxc-meta' }, [el('span', {}, [ui.notice, ui.hint]), ui.counter])
    ]);

    ui.panel = el('section', {
      id: 'sxc-panel',
      className: 'sxc-panel',
      role: 'dialog',
      'aria-modal': 'false',
      'aria-labelledby': 'sxc-title',
      hidden: true
    }, [header, ui.messages, ui.srStatus, composer]);

    ui.root.replaceChildren(ui.launcher, ui.panel);
  }

  function bindEvents() {
    ui.launcher.addEventListener('click', () => (state.isOpen ? closeChat() : openChat()));
    ui.close.addEventListener('click', () => closeChat());
    ui.newChat.addEventListener('click', resetConversation);
    ui.langButtons.forEach((button) => button.addEventListener('click', () => setLanguage(button.dataset.lang)));

    ui.form.addEventListener('submit', (event) => {
      event.preventDefault();
      sendMessage(ui.input.value);
    });

    ui.input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
        event.preventDefault();
        if (!state.busy) sendMessage(ui.input.value);
      }
    });
    ui.input.addEventListener('input', onInputChange);

    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape' || !state.isOpen) return;
      const siteModal = document.getElementById('modal');
      if (siteModal && siteModal.classList.contains('open')) return;
      closeChat();
    });

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', syncViewport);
      window.visualViewport.addEventListener('scroll', syncViewport);
    }

    window.addEventListener('pagehide', () => abortPending('unload'));

    // Follow the site-wide IT/EN switcher (i18n.js)
    document.addEventListener('simax:languagechange', (event) => setLanguage(event.detail && event.detail.lang));
  }

  function init() {
    if (document.getElementById('sxc-panel')) return;
    buildUi();
    bindEvents();
    applyLanguage();
    onInputChange();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
