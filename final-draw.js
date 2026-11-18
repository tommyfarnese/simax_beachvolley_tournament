(function () {
  'use strict';

  function validateFinalDraw(draw, gameId) {
    const team = (item) => item && typeof item.teamId === 'string' && /^[a-z0-9-]+$/.test(item.teamId) &&
      typeof item.name === 'string' && item.name.trim() && (item.nameEn === undefined || typeof item.nameEn === 'string');
    const participant = (item) => item && typeof item.name === 'string' && item.name.trim() &&
      item.name.length <= 100 && !/[\u0000-\u001f\u007f]/.test(item.name) &&
      item.participantId === item.name.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();
    if (!draw || draw.version !== 2 || draw.gameId !== gameId || !['collecting', 'prepared', 'completed'].includes(draw.stage) ||
        !Number.isInteger(draw.responseCount) || draw.responseCount < 0 ||
        !Array.isArray(draw.finalists) || !Array.isArray(draw.participants) ||
        !draw.finalists.every(team) || !draw.participants.every(participant) ||
        new Set(draw.participants.map((item) => item.participantId)).size !== draw.participants.length ||
        draw.responseCount < draw.participants.length) throw new Error('Invalid public final draw response.');
    if (draw.stage === 'collecting') {
      if (draw.finalists.length || draw.participants.length || draw.winner !== null) throw new Error('Invalid collecting state.');
    } else if (draw.finalists.length !== 2 || draw.finalists[0].teamId === draw.finalists[1].teamId || !Number.isFinite(Date.parse(draw.preparedAt)) ||
        (draw.stage === 'prepared' && draw.winner !== null) ||
        (draw.stage === 'completed' && (!Number.isFinite(Date.parse(draw.drawnAt)) ||
          !participant(draw.winner) || !draw.participants.some((item) => item.participantId === draw.winner.participantId && item.name === draw.winner.name)))) {
      throw new Error('Invalid prepared or completed state.');
    }
    return draw;
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = { validateFinalDraw };
  if (typeof document === 'undefined') return;

  const IT = {
    title: 'Estrazione finale', refresh: 'Aggiorna risultato', loading: 'Aggiornamento...',
    collecting: 'Pronostici ricevuti: {count}. L\u0027elenco dei qualificati apparira\u0027 dopo la conferma delle finaliste Gold.',
    prepared: '{count} squadre in estrazione. Pronostici chiusi: elenco e finaliste sono definitivi.',
    completed: 'Estrazione conclusa. Questo risultato e\u0027 definitivo e uguale per tutti.',
    finalists: 'Finaliste Gold: ', roster: 'Squadre partecipanti all\u0027estrazione',
    noEligible: 'Nessuna squadra ha indovinato una finalista: non ci sono partecipanti da estrarre.',
    winner: 'Squadra vincitrice', admin: 'Avvio riservato agli organizzatori',
    first: 'Prima finalista Gold', second: 'Seconda finalista Gold', choose: 'Seleziona una squadra',
    password: 'Password riservata agli organizzatori',
    prepare: 'Prepara elenco e chiudi pronostici', run: 'Avvia estrazione finale', sending: 'Operazione in corso...',
    prepareHelp: 'Conferma le finaliste reali. La preparazione chiude gli invii e fissa l\u0027elenco: non potrai modificarlo dal sito.',
    runHelp: 'L\u0027elenco e\u0027 visibile a tutti. Inserisci la password per estrarre un solo vincitore, senza ripetizioni.',
    confirmPrepare: 'Confermi le finaliste {teams}? Chiuderai i pronostici e fisserai l\u0027elenco senza possibilita\u0027 di modifica dal sito.',
    confirmRun: 'Estrarre un vincitore tra le {count} squadre elencate? Il risultato verra\u0027 salvato e non potra\u0027 essere ripetuto.',
    required: 'Inserisci la password riservata.', invalid_teams: 'Seleziona due finaliste diverse.',
    unauthorized: 'Password degli organizzatori non corretta.',
    not_configured: 'Configurare FINAL_DRAW_PASSWORD nelle proprieta\u0027 Apps Script (12-128 caratteri).',
    unavailable: 'Estrazione non disponibile: verifica apertura e configurazione del gioco.',
    busy: 'Servizio occupato. Riprova tra qualche secondo.',
    not_prepared: 'Prepara prima l\u0027elenco dei partecipanti.',
    no_eligible: 'Non ci sono squadre qualificate da estrarre.',
    upgrade: 'Aggiorna il deployment Apps Script per abilitare l\u0027estrazione finale.',
    error: 'Impossibile confermare lo stato. Aggiorna il risultato prima di riprovare: un\u0027operazione gia\u0027 salvata non verra\u0027 ripetuta.'
  };
  const EN = {
    title: 'Final prize draw', refresh: 'Refresh result', loading: 'Refreshing...',
    collecting: '{count} predictions received. Qualified teams will appear after the Gold finalists are confirmed.',
    prepared: '{count} teams in the draw. Predictions are closed: the roster and finalists are final.',
    completed: 'Draw completed. This result is final and the same for everyone.',
    finalists: 'Gold finalists: ', roster: 'Teams participating in the draw',
    noEligible: 'No team predicted a finalist: there are no eligible teams to draw.',
    winner: 'Winning team', admin: 'Organisers-only controls',
    first: 'First Gold finalist', second: 'Second Gold finalist', choose: 'Select a team',
    password: 'Private organisers password',
    prepare: 'Prepare roster and close predictions', run: 'Start final draw', sending: 'Processing...',
    prepareHelp: 'Confirm the actual finalists. Preparation closes submissions and freezes the roster: it cannot be edited on the site.',
    runHelp: 'Everyone can see the roster. Enter the password to draw one winner, without rerolls.',
    confirmPrepare: 'Confirm finalists {teams}? This closes predictions and freezes the roster, with no editing on the site.',
    confirmRun: 'Draw one winner from the {count} listed teams? The result will be saved and cannot be rerolled.',
    required: 'Enter the private organisers password.', invalid_teams: 'Select two different finalists.',
    unauthorized: 'Incorrect organisers password.',
    not_configured: 'Configure FINAL_DRAW_PASSWORD in Apps Script properties (12-128 characters).',
    unavailable: 'Draw unavailable: check game status and configuration.',
    busy: 'Service busy. Try again in a few seconds.',
    not_prepared: 'Prepare the participants list first.',
    no_eligible: 'There are no eligible teams to draw.',
    upgrade: 'Update the Apps Script deployment to enable the final draw.',
    error: 'We cannot confirm the state. Refresh the result before retrying: an already saved operation will not be repeated.'
  };
  const records = new Map();
  const knownErrors = ['unauthorized', 'not_configured', 'unavailable', 'busy', 'not_prepared', 'no_eligible', 'invalid_teams'];
  const text = (record, key) => (record.lang === 'en' ? EN : IT)[key];
  const name = (record, team) => record.lang === 'en' && team.nameEn && team.nameEn.trim() ? team.nameEn : team.name;

  function update(record) {
    const find = (selector) => record.node.querySelector(selector);
    record.node.querySelectorAll('[data-final-text]').forEach((item) => { item.textContent = text(record, item.dataset.finalText); });
    const state = record.state;
    const stage = state ? state.stage : 'collecting';
    const count = state ? stage === 'collecting' ? state.responseCount : state.participants.length : 0;
    const message = state ? text(record, stage).replace('{count}', count) : text(record, 'loading');
    if (find('[data-final-status]').textContent !== message) find('[data-final-status]').textContent = message;
    find('[data-final-error]').textContent = record.error ? text(record, record.error) : '';
    find('[data-final-refresh]').disabled = record.loading || record.pending;
    find('[data-final-refresh]').textContent = text(record, record.loading ? 'loading' : 'refresh');
    const finalists = find('[data-final-finalists]');
    finalists.hidden = stage === 'collecting';
    finalists.textContent = state && state.finalists.length ? text(record, 'finalists') + state.finalists.map((team) => name(record, team)).join(' / ') : '';
    find('[data-final-roster]').hidden = stage === 'collecting';
    const roster = find('[data-final-list]');
    roster.replaceChildren();
    if (state) state.participants.forEach((team) => {
      const item = document.createElement('li');
      const label = document.createElement('span');
      label.textContent = name(record, team);
      item.append(label);
      if (state.winner && state.winner.participantId === team.participantId) item.className = 'final-draw-won';
      roster.append(item);
    });
    find('[data-final-empty]').hidden = !state || stage === 'collecting' || state.participants.length > 0;
    find('[data-final-winner]').hidden = stage !== 'completed';
    find('[data-final-winner-name]').textContent = state && state.winner ? name(record, state.winner) : '';
    find('[data-final-admin]').hidden = stage === 'completed';
    find('[data-final-selectors]').hidden = stage !== 'collecting';
    find('[data-final-help]').textContent = text(record, stage === 'collecting' ? 'prepareHelp' : 'runHelp');
    record.node.querySelectorAll('select').forEach((select) => {
      if (select.options.length !== record.game.teams.length + 1 ||
          record.game.teams.some((team, index) => select.options[index + 1].value !== team.id)) {
        const value = select.value;
        select.replaceChildren(new Option('', ''));
        record.game.teams.forEach((team) => select.append(new Option('', team.id)));
        select.value = value;
      }
      select.options[0].text = text(record, 'choose');
      record.game.teams.forEach((team, index) => { select.options[index + 1].text = name(record, team); });
      select.disabled = record.pending;
    });
    find('input[name=password]').disabled = record.pending;
    const button = find('[data-final-submit]');
    button.textContent = text(record, record.pending ? 'sending' : stage === 'collecting' ? 'prepare' : 'run');
    button.disabled = record.pending || !state || stage === 'completed' || record.game.status === 'upcoming' ||
      (stage === 'prepared' && !state.participants.length);
  }

  async function request(record, payload) {
    if (record.pending || (!payload && record.loading)) return;
    if (record.controller) record.controller.abort();
    const controller = new AbortController();
    record.controller = controller;
    record.pending = !!payload;
    record.loading = !payload;
    record.error = '';
    update(record);
    const timeout = setTimeout(() => controller.abort(), 25000);
    try {
      const url = new URL(record.game.submissionUrl);
      const options = { credentials: 'omit', referrerPolicy: 'no-referrer', signal: controller.signal };
      if (payload) {
        options.method = 'POST';
        options.headers = { 'Content-Type': 'text/plain;charset=UTF-8' };
        options.body = JSON.stringify(payload);
      } else {
        url.searchParams.set('action', 'final_draw');
        url.searchParams.set('gameId', record.game.id);
        url.searchParams.set('_', Date.now());
        options.cache = 'no-store';
      }
      const response = await fetch(url, options);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      if (record.controller !== controller) return;
      if (data.status === 'ok' && data.draw && data.draw.version === 1) record.error = 'upgrade';
      else if (data.status === 'ok') record.state = validateFinalDraw(data.draw, record.game.id);
      else if (knownErrors.includes(data.status)) record.error = data.status;
      else if (data.status === 'ready') record.error = 'upgrade';
      else throw new Error('Final draw operation was not confirmed.');
    } catch (error) {
      if (record.controller !== controller) return;
      record.error = 'error';
      console.error('SiMax final draw: operation could not be confirmed.', error);
    } finally {
      clearTimeout(timeout);
      if (record.controller === controller) {
        record.controller = null;
        record.loading = false;
        record.pending = false;
        update(record);
        if (payload) {
          record.node.querySelector(record.error ? '[data-final-error]' :
            record.state.stage === 'completed' ? '[data-final-winner]' : '[data-final-status]').focus();
        }
      }
    }
  }

  function render(game, lang) {
    let record = records.get(game.id);
    if (!record) {
      const node = document.getElementById('final-draw-template').content.firstElementChild.cloneNode(true);
      record = { game, lang, node, state: null, error: '', loading: false, pending: false, controller: null };
      records.set(game.id, record);
      const title = node.querySelector('h3');
      title.id = `final-draw-${game.id}`;
      node.setAttribute('aria-labelledby', title.id);
      node.querySelector('[data-final-refresh]').addEventListener('click', () => request(record));
      node.querySelector('form').addEventListener('submit', (event) => {
        event.preventDefault();
        if (record.pending || !record.state || record.state.stage === 'completed') return;
        const password = node.querySelector('input[name=password]');
        const finalists = Array.from(node.querySelectorAll('select'), (select) => select.value);
        record.error = !password.value ? 'required' : record.state.stage === 'collecting' &&
          (!finalists[0] || !finalists[1] || finalists[0] === finalists[1]) ? 'invalid_teams' : '';
        if (record.error) {
          update(record);
          if (record.error === 'required') password.focus();
          else node.querySelector('select').focus();
          return;
        }
        const preparing = record.state.stage === 'collecting';
        const confirmation = preparing ? text(record, 'confirmPrepare').replace('{teams}', finalists.map((id) =>
          name(record, record.game.teams.find((team) => team.id === id))).join(' / ')) :
          text(record, 'confirmRun').replace('{count}', record.state.participants.length);
        if (!window.confirm(confirmation)) return;
        const payload = { action: preparing ? 'prepare_draw' : 'run_draw', gameId: game.id, password: password.value };
        if (preparing) payload.finalists = finalists;
        password.value = '';
        request(record, payload);
      });
      request(record);
    }
    record.game = game;
    record.lang = lang;
    update(record);
    return record.node;
  }

  function refreshVisible() {
    if (document.hidden) return;
    records.forEach((record) => {
      if (record.node.isConnected && (!record.state || record.state.stage !== 'completed')) request(record);
    });
  }
  setInterval(refreshVisible, 20000);
  document.addEventListener('visibilitychange', refreshVisible);
  window.SiMaxFinalDraw = { render };
})();
