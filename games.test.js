const { test } = require('node:test');
const assert = require('node:assert/strict');
const { localizedText, validateConfig, resolveCode } = require('./games.js');

function config() {
  return {
    games: [
      {
        id: 'draw-test', enabled: true, status: 'open', type: 'draw', participation: 'team',
        title: 'Estrazione', description: 'Gioco di prova', tournament: 'Torneo',
        prizes: [{ id: 'prize', name: 'Premio', description: '' }],
        codes: [{ code: 'ESEMPIO-VINCE', prizeId: 'prize' }, { code: 'ESEMPIO-RIPROVA' }]
      },
      {
        id: 'prediction-test', enabled: true, status: 'upcoming', type: 'prediction', participation: 'team',
        title: 'Pronostico', description: 'Gioco di prova', tournament: 'Torneo', prizes: [],
        formUrl: '', submissionUrl: '', codeSourceGameId: 'draw-test',
        teams: [{ id: 'a', name: 'Squadra A', nameEn: 'Team A' }, { id: 'b', name: 'Squadra B' }]
      }
    ]
  };
}

test('draw distinguishes invalid, losing and winning codes with stable prizes', () => {
  const game = validateConfig(config())[0];
  assert.deepEqual(resolveCode(game, 'unknown'), { status: 'invalid' });
  assert.deepEqual(resolveCode(game, '  esempio-riprova  '), { status: 'lose' });
  const expected = { status: 'win', prize: game.prizes[0] };
  assert.deepEqual(resolveCode(game, '  esempio-vince  '), expected);
  assert.deepEqual(resolveCode(game, 'ESEMPIO-VINCE'), expected);
});

test('codes cannot play a disabled, upcoming or closed draw', () => {
  for (const change of [{ enabled: false }, { status: 'upcoming' }, { status: 'closed' }]) {
    const game = { ...config().games[0], ...change };
    assert.deepEqual(resolveCode(game, 'ESEMPIO-VINCE'), { status: 'unavailable' });
  }
});

test('configuration rejects ambiguous codes, duplicate games and missing prizes', () => {
  for (const mutate of [
    (data) => data.games[0].codes.push({ code: ' esempio-vince ' }),
    (data) => { data.games[0].codes[0].prizeId = 'missing'; },
    (data) => data.games.push(data.games[0]),
    (data) => { data.games[0].codes = []; },
    (data) => { data.games[0].participation = 'other'; }
  ]) {
    const data = config();
    mutate(data);
    assert.throws(() => validateConfig(data));
  }
});

test('individual participation and multiple distinct prizes resolve correctly', () => {
  const data = config();
  const game = data.games[0];
  game.participation = 'individual';
  game.prizes.push({ id: 'second', name: 'Second prize', description: '' });
  game.codes.push({ code: 'OTHER-WINNER', prizeId: 'second' });
  validateConfig(data);
  assert.equal(resolveCode(game, 'other-winner').prize.id, 'second');
  assert.equal(resolveCode(game, 'esempio-vince').prize.id, game.prizes[0].id);
});

test('open predictions require a safe Google Forms link', () => {
  const data = config();
  const prediction = data.games[1];
  delete prediction.teams;
  prediction.status = 'open';
  for (const url of ['', 'javascript:alert(1)', 'https://docs.google.com.evil.test/forms/a', 'https://example.com']) {
    prediction.formUrl = url;
    assert.throws(() => validateConfig(data));
  }
  for (const url of ['https://docs.google.com/forms/d/e/example/viewform', 'https://forms.gle/example']) {
    prediction.formUrl = url;
    assert.doesNotThrow(() => validateConfig(data));
  }
});

test('image URLs cannot execute scripts or load insecure resources', () => {
  const data = config();
  for (const url of ['javascript:alert(1)', 'data:text/html,test', 'http://example.com/a.png']) {
    data.games[0].image = url;
    assert.throws(() => validateConfig(data));
  }
  data.games[0].image = 'Tornei/logo.png';
  assert.doesNotThrow(() => validateConfig(data));
});

test('game and prize content uses English only when selected, preserving Italian fallback', () => {
  const game = config().games[0];
  for (const [item, fields] of [[game, ['title', 'description', 'tournament']], [game.prizes[0], ['name', 'description']]]) {
    for (const field of fields) {
      item[`${field}En`] = `English ${field}`;
      assert.equal(localizedText(item, field, 'en'), `English ${field}`);
      assert.equal(localizedText(item, field, 'it'), item[field]);
      for (const missing of [undefined, '', '   ']) {
        item[`${field}En`] = missing;
        assert.equal(localizedText(item, field, 'en'), item[field]);
      }
    }
  }
});

test('configuration allows absent English translations but rejects malformed ones', () => {
  const data = config();
  for (const [item, fields] of [[data.games[0], ['titleEn', 'descriptionEn', 'tournamentEn']], [data.games[0].prizes[0], ['nameEn', 'descriptionEn']]]) {
    for (const field of fields) {
      const original = item[field];
      for (const value of [42, {}, null]) {
        item[field] = value;
        assert.throws(() => validateConfig(data), /English/);
      }
      delete item[field];
      assert.doesNotThrow(() => validateConfig(data));
      item[field] = original;
    }
  }
});

test('prize quantities must be positive integers when specified', () => {
  const data = config();
  const prize = data.games[0].prizes[0];
  for (const quantity of [0, -1, 1.5, '5', null]) {
    prize.quantity = quantity;
    assert.throws(() => validateConfig(data), /quantity/);
  }
  for (const quantity of [1, 5]) {
    prize.quantity = quantity;
    assert.doesNotThrow(() => validateConfig(data));
  }
  delete prize.quantity;
  assert.doesNotThrow(() => validateConfig(data));
});

test('shared access password is optional and rejects malformed configuration', () => {
  const data = config();
  for (const password of [null, 123, {}, '   ', 'x'.repeat(129)]) {
    data.accessPassword = password;
    assert.throws(() => validateConfig(data), /accessPassword/);
  }
  for (const password of ['', 'Tournament-2026']) {
    data.accessPassword = password;
    assert.doesNotThrow(() => validateConfig(data));
  }
  delete data.accessPassword;
  assert.doesNotThrow(() => validateConfig(data));
});

test('on-site predictions require distinct named teams, a code source and a production Apps Script URL', () => {
  const data = config();
  const prediction = data.games[1];
  prediction.status = 'open';
  prediction.submissionUrl = 'https://script.google.com/macros/s/test-deployment/exec';
  assert.doesNotThrow(() => validateConfig(data));
  for (const change of [
    { teams: [] }, { teams: prediction.teams.slice(0, 1) },
    { teams: [prediction.teams[0], prediction.teams[0]] },
    { teams: [{ id: 'a', name: '' }, prediction.teams[1]] },
    { teams: [{ id: 'a', name: 'Team A', nameEn: 5 }, prediction.teams[1]] },
    { codeSourceGameId: prediction.id }, { codeSourceGameId: 'missing' },
    { submissionUrl: '' }, { submissionUrl: 'https://example.com/exec' },
    { submissionUrl: 'https://script.google.com.evil.test/macros/s/test/exec' },
    { submissionUrl: 'https://script.google.com/macros/s/test/dev' },
    { submissionUrl: 'https://script.google.com/macros/s/test/exec?test=1' }
  ]) {
    const changed = structuredClone(data);
    Object.assign(changed.games[1], change);
    assert.throws(() => validateConfig(changed));
  }
  prediction.status = 'upcoming';
  prediction.submissionUrl = '';
  assert.doesNotThrow(() => validateConfig(data));
  assert.equal(localizedText(prediction.teams[0], 'name', 'en'), prediction.teams[0].nameEn);
});
