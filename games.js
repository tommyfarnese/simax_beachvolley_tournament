(function () {
  'use strict';

  function normalizeCode(code) {
    return code.trim().toUpperCase();
  }

  function normalizeTeamName(name) {
    return name.normalize('NFKC').trim().replace(/\s+/g, ' ');
  }

  function localizedText(item, field, lang) {
    const english = item[`${field}En`];
    return lang === 'en' && typeof english === 'string' && english.trim() ? english : item[field];
  }

  function safeImage(value) {
    if (typeof value !== 'string' || !value) return false;
    const url = new URL(value, 'https://simax.invalid/');
    return url.protocol === 'https:' && !url.username && !url.password;
  }

  function safeForm(value) {
    if (typeof value !== 'string' || !value) return false;
    try {
      const url = new URL(value);
      return url.protocol === 'https:' && !url.username && !url.password &&
        ((url.hostname === 'docs.google.com' && url.pathname.startsWith('/forms/')) || url.hostname === 'forms.gle');
    } catch (_) {
      return false;
    }
  }

  function safeSubmission(value) {
    if (typeof value !== 'string' || !value) return false;
    try {
      const url = new URL(value);
      return url.protocol === 'https:' && url.hostname === 'script.google.com' && !url.port &&
        !url.username && !url.password && !url.search && !url.hash &&
        /^\/macros\/s\/[a-zA-Z0-9_-]+\/exec$/.test(url.pathname);
    } catch (_) {
      return false;
    }
  }

  function validateConfig(config) {
    const fail = (message) => { throw new Error(message); };
    const text = (value) => typeof value === 'string' && value.trim().length > 0;
    if (!config || !Array.isArray(config.games)) fail('games must be an array.');
    if (config.accessPassword !== undefined && (typeof config.accessPassword !== 'string' ||
        config.accessPassword.length > 128 || (config.accessPassword.length > 0 && !config.accessPassword.trim()))) fail('accessPassword must be a string of up to 128 characters, empty to disable access.');
    const ids = new Set();
    config.games.forEach((game, index) => {
      const context = `games[${index}]`;
      if (!game || !text(game.id) || !/^[a-z0-9-]+$/.test(game.id) || ids.has(game.id)) fail(`${context}: invalid or duplicate id.`);
      ids.add(game.id);
      if (typeof game.enabled !== 'boolean') fail(`${context}: enabled must be boolean.`);
      if (!['upcoming', 'open', 'closed'].includes(game.status)) fail(`${context}: invalid status.`);
      if (!['draw', 'prediction'].includes(game.type)) fail(`${context}: invalid type.`);
      if (!['team', 'individual'].includes(game.participation)) fail(`${context}: invalid participation.`);
      if (![game.title, game.description, game.tournament].every(text)) fail(`${context}: title, description and tournament are required.`);
      if (![game.titleEn, game.descriptionEn, game.tournamentEn].every((value) => value === undefined || typeof value === 'string')) fail(`${context}: English translations must be strings.`);
      if (game.image && !safeImage(game.image)) fail(`${context}: invalid image URL.`);
      if (!Array.isArray(game.prizes)) fail(`${context}: prizes must be an array.`);
      const prizes = new Set();
      game.prizes.forEach((prize) => {
        if (!prize || !text(prize.id) || prizes.has(prize.id) || !text(prize.name) ||
            typeof prize.description !== 'string' || (prize.image && !safeImage(prize.image))) fail(`${context}: invalid or duplicate prize.`);
        prizes.add(prize.id);
        if (prize.quantity !== undefined && (!Number.isInteger(prize.quantity) || prize.quantity <= 0)) fail(`${context}: prize quantity must be a positive integer.`);
        if (![prize.nameEn, prize.descriptionEn].every((value) => value === undefined || typeof value === 'string')) fail(`${context}: English prize translations must be strings.`);
      });
      if (game.type === 'prediction') {
        if (game.finalDraw !== undefined && typeof game.finalDraw !== 'boolean') fail(`${context}: finalDraw must be boolean.`);
        if (game.finalDraw === true && game.teams === undefined) fail(`${context}: finalDraw requires on-site teams.`);
        if (game.formUrl && !safeForm(game.formUrl)) fail(`${context}: invalid Google Forms URL.`);
        if (game.teams !== undefined) {
          if (!Array.isArray(game.teams) || game.teams.length < 2) fail(`${context}: teams must contain at least two teams.`);
          const teams = new Set();
          game.teams.forEach((team) => {
            if (!team || !text(team.id) || team.id.length > 80 || !/^[a-z0-9-]+$/.test(team.id) ||
                teams.has(team.id) || !text(team.name) || team.name.length > 100 ||
                (team.nameEn !== undefined && (typeof team.nameEn !== 'string' || team.nameEn.length > 100))) fail(`${context}: invalid or duplicate team.`);
            teams.add(team.id);
          });
          if ((game.submissionUrl && !safeSubmission(game.submissionUrl)) ||
              (game.status === 'open' && !safeSubmission(game.submissionUrl))) fail(`${context}: a deployed Apps Script submissionUrl is required.`);
        } else if (game.status === 'open' && !safeForm(game.formUrl)) {
          fail(`${context}: a valid Google Forms URL is required.`);
        }
        return;
      }
      if (!Array.isArray(game.codes) || (game.status === 'open' && !game.codes.length)) fail(`${context}: codes must be an array, nonempty for an open draw.`);
      const codes = new Set();
      game.codes.forEach((entry) => {
        if (!entry || !text(entry.code) || entry.code.length > 80) fail(`${context}: invalid code.`);
        const code = normalizeCode(entry.code);
        if (codes.has(code)) fail(`${context}: duplicate code.`);
        codes.add(code);
        if (entry.prizeId !== undefined && !prizes.has(entry.prizeId)) fail(`${context}: unknown prizeId.`);
      });
    });
    return config.games;
  }

  function resolveCode(game, code) {
    if (!game.enabled || game.status !== 'open' || game.type !== 'draw') return { status: 'unavailable' };
    const entry = game.codes.find((item) => normalizeCode(item.code) === normalizeCode(code));
    if (!entry) return { status: 'invalid' };
    if (entry.prizeId === undefined) return { status: 'lose' };
    return { status: 'win', prize: game.prizes.find((prize) => prize.id === entry.prizeId) };
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { normalizeCode, normalizeTeamName, localizedText, validateConfig, resolveCode };
  }
  if (typeof document === 'undefined') return;

  const IT = {
    loading: 'Caricamento giochi...', empty: 'Nessun gioco disponibile al momento.',
    error: 'Impossibile caricare i giochi. Riprova o contatta gli organizzatori.',
    upcoming: 'Prossimamente', open: 'Aperto', closed: 'Chiuso',
    team: 'Gioco di squadra', individual: 'Gioco individuale',
    draw: 'Estrazione', prediction: 'Pronostico', play: 'Gioca',
    form: 'Invia il pronostico su Google Forms', prizes: 'Premi in palio',
    noPrizes: 'Nessun premio previsto.', teamCode: 'Codice della squadra',
    individualCode: 'Codice personale', required: 'Inserisci il codice ricevuto dagli organizzatori.',
    invalid: 'Codice non valido. Controllalo e riprova.', progress: 'Le palline si mescolano...',
    ready: 'Il prossimo protagonista sei tu.', choose: 'Tocca una pallina e scopri il risultato!',
    pickBall: 'Scegli la pallina {number}', again: 'Gioca con un altro codice',
    mix: 'Mescola le palline', mixing: 'Mescolando...', waiting: 'Scegli una pallina',
    accessRequired: 'Inserisci la password del torneo.',
    accessInvalid: 'Password non corretta. Riprova.',
    predictionHelp: 'Scegli esattamente due squadre per la finale Gold.',
    predictionCount: '{count}/2 squadre selezionate',
    predictionChoose: 'Seleziona due squadre diverse.',
    predictionName: 'Nome della tua squadra',
    predictionNameHelp: 'Una risposta per nome squadra. I nomi delle squadre qualificate saranno visibili a tutti.',
    predictionNameRequired: 'Inserisci il nome della tua squadra.',
    predictionNameInvalid: 'Inserisci un nome squadra valido di massimo 100 caratteri.',
    predictionSend: 'Invia pronostico',
    predictionSending: 'Invio in corso... Attendi la conferma prima di chiudere.',
    predictionSaved: 'Pronostico registrato per {team}!',
    predictionDuplicate: 'Questo nome squadra ha gia\u0027 inviato un pronostico. Le scelte precedenti non sono state modificate.',
    predictionClosed: 'Il pronostico non e\u0027 piu\u0027 aperto. Contatta gli organizzatori.',
    predictionBusy: 'Il servizio e\u0027 occupato. Riprova tra qualche secondo.',
    predictionUnconfirmed: 'Non possiamo confermare la registrazione. Riprova con lo stesso nome squadra: un eventuale invio gia\u0027 salvato non verra\u0027 duplicato. Se il problema continua, contatta gli organizzatori.',
    win: 'Hai vinto!', lose: 'Questa volta non hai vinto.',
    collect: 'Mostra questo risultato e il codice agli organizzatori per verificare e ritirare il premio.',
    repeat: 'Lo stesso codice restituisce sempre lo stesso risultato. Non viene effettuata una nuova estrazione.'
  };
  const EN = {
    loading: 'Loading games...', empty: 'No games available at the moment.',
    error: 'Unable to load games. Try again or contact the organisers.',
    upcoming: 'Coming soon', open: 'Open', closed: 'Closed',
    team: 'Team game', individual: 'Individual game',
    draw: 'Prize draw', prediction: 'Prediction', play: 'Play',
    form: 'Submit your prediction on Google Forms', prizes: 'Prizes',
    noPrizes: 'No prizes planned.', teamCode: 'Team code',
    individualCode: 'Personal code', required: 'Enter the code provided by the organisers.',
    invalid: 'Invalid code. Check it and try again.', progress: 'Mixing the balls...',
    ready: 'Your moment starts here.', choose: 'Tap a ball to reveal your result!',
    pickBall: 'Pick ball {number}', again: 'Play with another code',
    mix: 'Mix the balls', mixing: 'Mixing...', waiting: 'Pick a ball',
    accessRequired: 'Enter the tournament password.',
    accessInvalid: 'Incorrect password. Try again.',
    predictionHelp: 'Pick exactly two teams for the Gold final.',
    predictionCount: '{count}/2 teams selected',
    predictionChoose: 'Select two different teams.',
    predictionName: 'Your team name',
    predictionNameHelp: 'One response per team name. Qualified team names will be visible to everyone.',
    predictionNameRequired: 'Enter your team name.',
    predictionNameInvalid: 'Enter a valid team name of up to 100 characters.',
    predictionSend: 'Submit prediction',
    predictionSending: 'Sending... Wait for confirmation before closing.',
    predictionSaved: 'Prediction recorded for {team}!',
    predictionDuplicate: 'This team name has already submitted a prediction. The previous choices have not been changed.',
    predictionClosed: 'Predictions are no longer open. Contact the organisers.',
    predictionBusy: 'The service is busy. Please try again in a few seconds.',
    predictionUnconfirmed: 'We cannot confirm your submission. Try again with the same team name: an already saved entry will not be duplicated. If the problem persists, contact the organisers.',
    win: 'You won!', lose: 'No prize this time.',
    collect: 'Show this result and your code to the organisers to verify and collect your prize.',
    repeat: 'The same code always returns the same result. No new draw takes place.'
  };
  const t = (key) => (window.SiteI18n.lang === 'en' ? EN : IT)[key];
  const content = (item, field) => localizedText(item, field, window.SiteI18n.lang);
  const list = document.getElementById('games-list');
  const status = document.getElementById('games-status');
  const retry = document.getElementById('games-retry');
  const dialog = document.getElementById('game-dialog');
  const form = document.getElementById('game-form');
  const input = document.getElementById('game-code');
  const error = document.getElementById('code-error');
  const result = document.getElementById('game-result');
  const animation = document.getElementById('draw-animation');
  const progress = document.getElementById('draw-progress');
  const choices = document.getElementById('draw-choices');
  const submit = document.getElementById('game-submit');
  const accessForm = document.getElementById('game-access');
  const passwordInput = document.getElementById('game-password');
  const accessError = document.getElementById('access-error');
  const workspace = document.getElementById('game-workspace');
  const predictionLink = document.getElementById('game-prediction');
  const predictionPanel = document.getElementById('prediction-panel');
  const predictionForm = document.getElementById('prediction-form');
  const predictionInput = document.getElementById('prediction-team-name');
  const predictionChoices = document.getElementById('prediction-teams');
  const predictionError = document.getElementById('prediction-error');
  const predictionStatus = document.getElementById('prediction-status');
  const predictionSubmit = document.getElementById('prediction-submit');
  let selectedTeams = new Set();
  let predictionErrorKey = '';
  let predictionOutcome = '';
  let predictionController = null;
  let accessPassword = '';
  let unlocked = false;
  let accessErrorKey = '';
  let games = [];
  let selected = null;
  let outcome = null;
  let pendingOutcome = null;
  let drawState = 'idle';
  let timer = null;
  let loading = false;
  let failed = false;
  let errorKey = '';

  function element(tag, text, className) {
    const node = document.createElement(tag);
    if (text) node.textContent = text;
    if (className) node.className = className;
    return node;
  }

  function addImage(container, url, alt) {
    if (!url) return;
    const image = element('img');
    image.src = url;
    image.alt = alt;
    image.loading = 'lazy';
    container.append(image);
  }

  function renderPrizes(container, prizes, compact = true) {
    container.replaceChildren();
    container.classList.toggle('prizes-compact', compact);
    if (!prizes.length) container.append(element('p', t('noPrizes')));
    prizes.forEach((prize) => {
      const card = element('article', '', 'prize');
      const name = content(prize, 'name');
      if (compact) {
        card.classList.add('prize-compact');
        card.title = name;
        const quantity = prize.quantity === undefined ? 1 : prize.quantity;
        card.append(element('span', `${quantity} x`, 'prize-count'));
        if (prize.image) addImage(card, prize.image, name);
        else {
          const placeholder = element('span', '\u2605', 'prize-placeholder');
          placeholder.setAttribute('role', 'img');
          placeholder.setAttribute('aria-label', name);
          card.append(placeholder);
        }
        container.append(card);
        return;
      }
      addImage(card, prize.image, name);
      card.append(element('h4', name));
      const description = content(prize, 'description');
      if (description) card.append(element('p', description));
      container.append(card);
    });
  }

  function renderResult() {
    result.replaceChildren();
    result.hidden = !outcome;
    if (!outcome) return;
    result.classList.toggle('win', outcome.status === 'win');
    const emblem = element('div', outcome.status === 'win' ? '\u2605' : '\u2661', 'result-emblem');
    emblem.setAttribute('aria-hidden', 'true');
    result.append(emblem, element('h3', t(outcome.status)));
    if (outcome.status === 'win') {
      const confetti = element('div', '', 'confetti');
      confetti.setAttribute('aria-hidden', 'true');
      for (let index = 0; index < 12; index += 1) {
        const piece = element('span');
        piece.style.setProperty('--i', index);
        confetti.append(piece);
      }
      const prizes = element('div');
      renderPrizes(prizes, [outcome.prize], false);
      result.append(confetti, prizes, element('p', t('collect')));
    }
    result.append(element('p', t('repeat')));
  }

  function renderDialog() {
    if (!selected) return;
    document.getElementById('game-title').textContent = content(selected, 'title');
    document.getElementById('game-tournament').textContent = content(selected, 'tournament');
    document.getElementById('game-description').textContent = content(selected, 'description');
    accessForm.hidden = unlocked;
    workspace.hidden = !unlocked || selected.type !== 'draw';
    predictionLink.hidden = !unlocked || selected.type !== 'prediction' || selected.teams !== undefined;
    predictionPanel.hidden = !unlocked || selected.type !== 'prediction' || selected.teams === undefined;
    dialog.classList.toggle('access-locked', !unlocked);
    input.disabled = !unlocked;
    accessError.textContent = accessErrorKey ? t(accessErrorKey) : '';
    if (!unlocked) return;
    if (selected.type === 'prediction') {
      if (selected.teams !== undefined) {
        renderPrediction();
        return;
      }
      predictionLink.href = selected.formUrl;
      predictionLink.textContent = t('form');
      return;
    }
    document.getElementById('code-label').textContent = t(selected.participation === 'team' ? 'teamCode' : 'individualCode');
    renderPrizes(document.getElementById('game-prizes'), selected.prizes);
    error.textContent = errorKey ? t(errorKey) : '';
    dialog.dataset.drawState = drawState;
    animation.hidden = drawState === 'revealed';
    choices.hidden = drawState !== 'choosing';
    progress.textContent = drawState === 'mixing' ? t('progress') : drawState === 'choosing' ? t('choose') : drawState === 'idle' ? t('ready') : '';
    document.querySelectorAll('[data-ball]').forEach((button) => {
      button.setAttribute('aria-label', t('pickBall').replace('{number}', button.dataset.ball));
    });
    document.querySelectorAll('[data-step]').forEach((step) => {
      const active = step.dataset.step === (drawState === 'idle' ? 'code' : drawState === 'mixing' ? 'mix' : 'pick');
      step.classList.toggle('active', active);
      if (active) step.setAttribute('aria-current', 'step');
      else step.removeAttribute('aria-current');
    });
    const busy = drawState === 'mixing' || drawState === 'choosing';
    input.disabled = busy;
    submit.disabled = busy;
    submit.textContent = t(drawState === 'mixing' ? 'mixing' : drawState === 'choosing' ? 'waiting' : drawState === 'revealed' ? 'again' : 'mix');
    renderResult();
  }

  function renderPrediction() {
    const busy = predictionController !== null;
    document.getElementById('prediction-name-label').textContent = t('predictionName');
    document.getElementById('prediction-name-help').textContent = t('predictionNameHelp');
    document.getElementById('prediction-help').textContent = t('predictionHelp');
    document.getElementById('prediction-count').textContent = t('predictionCount').replace('{count}', selectedTeams.size);
    predictionChoices.querySelectorAll('input').forEach((checkbox, index) => {
      checkbox.checked = selectedTeams.has(checkbox.value);
      checkbox.disabled = busy || !!predictionOutcome || (selectedTeams.size === 2 && !checkbox.checked);
      checkbox.closest('label').classList.toggle('chosen', checkbox.checked);
      checkbox.nextElementSibling.textContent = content(selected.teams[index], 'name');
    });
    predictionInput.disabled = busy || !!predictionOutcome;
    predictionInput.setAttribute('aria-invalid', String(predictionErrorKey === 'predictionNameRequired' || predictionErrorKey === 'predictionNameInvalid'));
    predictionSubmit.disabled = busy || !!predictionOutcome;
    predictionSubmit.textContent = t('predictionSend');
    predictionForm.setAttribute('aria-busy', String(busy));
    predictionError.textContent = predictionErrorKey ? t(predictionErrorKey) : '';
    predictionStatus.textContent = busy ? t('predictionSending') : predictionOutcome ? t(predictionOutcome).replace('{team}', normalizeTeamName(predictionInput.value)) : '';
    predictionStatus.classList.toggle('prediction-saved', predictionOutcome === 'predictionSaved');
  }

  function focusGame() {
    if (!unlocked) passwordInput.focus();
    else if (selected.type === 'draw') input.focus();
    else if (selected.teams !== undefined) predictionInput.focus();
    else predictionLink.focus();
  }

  function openGame(game) {
    selected = game;
    outcome = null;
    pendingOutcome = null;
    drawState = 'idle';
    errorKey = '';
    accessErrorKey = '';
    unlocked = !accessPassword;
    accessForm.reset();
    passwordInput.removeAttribute('aria-invalid');
    form.reset();
    input.removeAttribute('aria-invalid');
    selectedTeams = new Set();
    predictionErrorKey = '';
    predictionOutcome = '';
    predictionForm.reset();
    predictionInput.removeAttribute('aria-invalid');
    predictionChoices.replaceChildren();
    if (game.type === 'prediction' && game.teams !== undefined) {
      game.teams.forEach((team) => {
        const label = element('label', '', 'prediction-team');
        const checkbox = element('input');
        checkbox.type = 'checkbox';
        checkbox.name = 'teams';
        checkbox.value = team.id;
        label.append(checkbox, element('span', content(team, 'name')));
        predictionChoices.append(label);
      });
    }
    renderDialog();
    dialog.showModal();
    focusGame();
  }

  function render() {
    list.replaceChildren();
    const visible = games.filter((game) => game.enabled);
    status.textContent = loading ? t('loading') : failed ? t('error') : visible.length ? '' : t('empty');
    retry.hidden = !failed;
    visible.forEach((game) => {
      const card = element('article', '', 'game-card');
      if (game.image) addImage(card, game.image, content(game, 'title'));
      else {
        const art = element('div', '', 'game-art');
        art.setAttribute('aria-hidden', 'true');
        art.append(element('span', 'SIMAX PLAY', 'art-label'));
        ['8', '53', '89'].forEach((label) => art.append(element('span', label, 'art-ball')));
        card.append(art);
      }
      const meta = element('div', '', 'card-meta');
      meta.append(element('p', content(game, 'tournament'), 'eyebrow'), element('span', t(game.status), `badge ${game.status}`));
      card.append(meta,
        element('h2', content(game, 'title')), element('p', `${t(game.type)} · ${t(game.participation)}`, 'game-kind'), element('p', content(game, 'description'), 'game-description'),
        element('h3', t('prizes')));
      const prizes = element('div', '', 'prizes');
      renderPrizes(prizes, game.prizes);
      card.append(prizes);
      if (game.type === 'prediction' && game.finalDraw === true) {
        card.append(window.SiMaxFinalDraw.render(game, window.SiteI18n.lang));
      }
      if (game.status === 'open' && game.type === 'prediction' && game.teams === undefined && !accessPassword) {
        const link = element('a', t('form'), 'primary play-link');
        link.href = game.formUrl;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        card.append(link);
      } else {
        const button = element('button', t(game.status === 'open' ? 'play' : game.status), game.status === 'open' ? 'primary' : '');
        button.type = 'button';
        button.disabled = game.status !== 'open';
        button.addEventListener('click', () => openGame(game));
        card.append(button);
      }
      list.append(card);
    });
    renderDialog();
  }

  async function load() {
    if (loading) return;
    loading = true;
    failed = false;
    render();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch(new URL('games.json', document.baseURI), { cache: 'no-store', signal: controller.signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const config = await response.json();
      games = validateConfig(config);
      accessPassword = config.accessPassword === undefined ? '' : config.accessPassword;
    } catch (loadError) {
      games = [];
      failed = true;
      console.error('SiMax games: configuration could not be loaded.', loadError);
    } finally {
      clearTimeout(timeout);
      loading = false;
      render();
    }
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!unlocked || pendingOutcome || !selected) return;
    if (drawState === 'revealed') {
      outcome = null;
      drawState = 'idle';
      errorKey = '';
      form.reset();
      input.removeAttribute('aria-invalid');
      renderDialog();
      input.focus();
      return;
    }
    const resolved = resolveCode(selected, input.value);
    errorKey = !input.value.trim() ? 'required' : resolved.status === 'invalid' ? 'invalid' : '';
    outcome = null;
    input.setAttribute('aria-invalid', errorKey ? 'true' : 'false');
    renderDialog();
    if (errorKey) { input.focus(); return; }
    if (resolved.status === 'unavailable') return;
    pendingOutcome = resolved;
    drawState = 'mixing';
    renderDialog();
    animation.scrollIntoView({ block: 'nearest', behavior: 'instant' });
    const offerBalls = () => {
      timer = null;
      drawState = 'choosing';
      renderDialog();
      choices.querySelector('button').focus({ preventScroll: true });
      choices.scrollIntoView({ block: 'nearest', behavior: 'instant' });
    };
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) offerBalls();
    else timer = setTimeout(offerBalls, 2800);
  });

  choices.addEventListener('click', (event) => {
    if (!unlocked || !event.target.closest('[data-ball]') || drawState !== 'choosing' || !pendingOutcome) return;
    outcome = pendingOutcome;
    pendingOutcome = null;
    drawState = 'revealed';
    renderDialog();
    result.focus({ preventScroll: true });
    result.scrollIntoView({ block: 'nearest', behavior: 'instant' });
  });

  accessForm.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!selected || unlocked) return;
    accessErrorKey = !passwordInput.value ? 'accessRequired' : passwordInput.value !== accessPassword ? 'accessInvalid' : '';
    passwordInput.setAttribute('aria-invalid', accessErrorKey ? 'true' : 'false');
    if (accessErrorKey) {
      renderDialog();
      passwordInput.focus();
      return;
    }
    unlocked = true;
    accessForm.reset();
    renderDialog();
    focusGame();
  });

  predictionChoices.addEventListener('change', () => {
    selectedTeams = new Set(Array.from(predictionChoices.querySelectorAll('input:checked'), (checkbox) => checkbox.value));
    if (selectedTeams.size === 2) predictionErrorKey = '';
    renderPrediction();
  });

  predictionForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!unlocked || !selected || selected.type !== 'prediction' || selected.teams === undefined ||
        predictionController || predictionOutcome) return;
    const teamName = normalizeTeamName(predictionInput.value);
    predictionErrorKey = !teamName ? 'predictionNameRequired' : teamName.length > 100 || /[\u0000-\u001f\u007f]/.test(teamName) ? 'predictionNameInvalid' :
      selectedTeams.size !== 2 ? 'predictionChoose' : '';
    if (predictionErrorKey) {
      renderPrediction();
      if (predictionErrorKey === 'predictionChoose') predictionChoices.querySelector('input').focus();
      else predictionInput.focus();
      return;
    }
    const controller = new AbortController();
    predictionController = controller;
    const timeout = setTimeout(() => controller.abort(), 25000);
    renderPrediction();
    try {
      const response = await fetch(selected.submissionUrl, {
        method: 'POST', headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
        credentials: 'omit', referrerPolicy: 'no-referrer', signal: controller.signal,
        body: JSON.stringify({ gameId: selected.id, teamName, teams: Array.from(selectedTeams) })
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      if (predictionController !== controller) return;
      if (data.status === 'saved') predictionOutcome = 'predictionSaved';
      else if (data.status === 'duplicate') predictionOutcome = 'predictionDuplicate';
      else if (data.status === 'invalid_name') predictionErrorKey = 'predictionNameInvalid';
      else if (data.status === 'invalid_teams') predictionErrorKey = 'predictionChoose';
      else if (data.status === 'unavailable') predictionErrorKey = 'predictionClosed';
      else if (data.status === 'busy') predictionErrorKey = 'predictionBusy';
      else throw new Error('The receiver did not confirm the prediction.');
    } catch (submissionError) {
      if (predictionController !== controller) return;
      predictionErrorKey = 'predictionUnconfirmed';
      console.error('SiMax predictions: submission could not be confirmed.', submissionError);
    } finally {
      clearTimeout(timeout);
      if (predictionController === controller) {
        predictionController = null;
        renderPrediction();
        if (predictionOutcome) predictionStatus.focus();
      }
    }
  });

  document.getElementById('game-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => {
    clearTimeout(timer);
    timer = null;
    animation.hidden = true;
    selected = null;
    outcome = null;
    pendingOutcome = null;
    drawState = 'idle';
    unlocked = false;
    accessForm.reset();
    accessErrorKey = '';
    workspace.hidden = true;
    predictionLink.hidden = true;
    predictionLink.removeAttribute('href');
    if (predictionController) predictionController.abort();
    predictionController = null;
    predictionPanel.hidden = true;
  });
  retry.addEventListener('click', load);
  document.addEventListener('simax:languagechange', render);
  load();
})();
