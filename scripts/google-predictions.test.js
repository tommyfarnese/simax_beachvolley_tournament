const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');
const { validateFinalDraw } = require(join(__dirname, '..', 'final-draw.js'));

const script = readFileSync(join(__dirname, 'google-predictions.gs'), 'utf8');

function harness() {
  const config = {
    games: [
      { id: 'draw', type: 'draw', codes: [{ code: 'A2B3C' }, { code: '01234' }] },
      {
        id: 'prediction', type: 'prediction', enabled: true, status: 'open',
        teams: [{ id: 'a', name: 'Squadra A' }, { id: 'b', name: 'Squadra B' }, { id: 'c', name: 'Squadra C' }]
      }
    ]
  };
  const rows = [];
  const writes = [];
  const drawRows = [];
  const drawWrites = [];
  const logs = [];
  const properties = { SPREADSHEET_ID: 'private-sheet-id', GAMES_CONFIG_URL: 'https://example.test/games.json' };
  let sheetCreated = false;
  let busy = false;
  let failWrite = false;
  let releases = 0;
  let flushes = 0;
  let failFlush = false;
  let randomCalls = 0;
  function makeSheet(data, output) { return {
    getLastRow: () => data.length,
    appendRow: row => data.push(Array.from(row)),
    setFrozenRows: count => assert.equal(count, 1),
    getRange: (row, column, count, width) => {
      let textFormat = false;
      return {
        getValues: () => data.slice(row - 1, row - 1 + count).map(values => values.slice(column - 1, column - 1 + width)),
        setNumberFormat: format => { assert.equal(format, '@'); textFormat = true; },
        setValues: values => {
          assert.equal(textFormat, true);
          if (failWrite) throw new Error('Simulated storage failure');
          output.push(Array.from(values[0]));
          data[row - 1] = Array.from(values[0], value => value.startsWith("'") ? value.slice(1) : value);
        }
      };
    }
  }; }
  const sheet = makeSheet(rows, writes);
  const drawSheet = makeSheet(drawRows, drawWrites);
  let drawCreated = false;
  const spreadsheet = {
    getSheetByName: name => {
      if (name === 'Estrazioni finali') return drawCreated ? drawSheet : null;
      assert.equal(name, 'Pronostici squadre'); return sheetCreated ? sheet : null;
    },
    insertSheet: name => {
      if (name === 'Estrazioni finali') { drawCreated = true; return drawSheet; }
      assert.equal(name, 'Pronostici squadre'); sheetCreated = true; return sheet;
    }
  };
  const context = {
    PropertiesService: { getScriptProperties: () => ({ getProperties: () => properties }) },
    UrlFetchApp: {
      fetch: url => {
        assert.match(url, /^https:\/\/example\.test\/games\.json\?_=\d+$/);
        return { getResponseCode: () => 200, getContentText: () => JSON.stringify(config) };
      }
    },
    SpreadsheetApp: {
      openById: id => { assert.equal(id, 'private-sheet-id'); return spreadsheet; },
      flush: () => { flushes += 1; if (failFlush) throw new Error('Simulated flush failure'); }
    },
    LockService: { getScriptLock: () => ({ tryLock: () => !busy, releaseLock: () => { releases += 1; } }) },
    ContentService: {
      MimeType: { JSON: 'application/json' },
      createTextOutput: body => ({ setMimeType: () => JSON.parse(body) })
    },
    console: { error: (...args) => logs.push(args) },
    Math: { floor: Math.floor, random: () => { randomCalls += 1; return 0.99; } }
  };
  function load() {
    const instance = vm.createContext({ ...context });
    vm.runInContext(script, instance);
    return instance;
  }
  let instance = load();
  const send = payload => instance.doPost({ postData: { contents: typeof payload === 'string' ? payload : JSON.stringify(payload) } });
  return {
    config, properties, rows, writes, logs, drawRows,
    send, submit: payload => send(payload).status,
    read: () => instance.doGet({ parameter: { action: 'final_draw', gameId: 'prediction' } }),
    ready: () => instance.doGet().status,
    lock: value => { busy = value; },
    failWrites: () => { failWrite = true; },
    failFlushes: value => { failFlush = value; },
    reload: () => { instance = load(); },
    randomCalls: () => randomCalls,
    flushes: () => flushes,
    releases: () => releases
  };
}

const payload = (changes = {}) => ({ gameId: 'prediction', teamName: 'Beach Uno', teams: ['a', 'b'], ...changes });

test('receiver persists the entered team name and authoritative prediction choices without a code source', () => {
  const app = harness();
  app.config.games.shift();
  assert.equal(app.submit(payload({ teamName: '  Beach   Uno  ', names: ['Forged', 'Names'] })), 'saved');
  assert.equal(app.rows.length, 2);
  assert.deepEqual(app.rows[1].slice(1), ['prediction', 'Beach Uno', 'a', 'Squadra A', 'b', 'Squadra B']);
  assert.equal(app.flushes(), 1);
  assert.equal(app.releases(), 1);
  assert.deepEqual(app.logs, []);
});

test('receiver rejects missing or invalid names, old code-only requests and invalid choices', () => {
  const app = harness();
  for (const invalid of ['{', 'null', 'x'.repeat(4097), payload({ teams: ['a'] }), payload({ teams: ['a', 'b', 'c'] }), payload({ teams: ['a', 'a'] }), payload({ teamName: 123 }), { gameId: 'prediction', code: 'A2B3C', teams: ['a', 'b'] }]) {
    assert.equal(app.submit(invalid), 'invalid_request');
  }
  for (const teamName of ['', '   ', 'x'.repeat(101), '\u0000Beach']) assert.equal(app.submit(payload({ teamName })), 'invalid_name');
  assert.equal(app.submit(payload({ teams: ['a', 'missing'] })), 'invalid_teams');
  assert.equal(app.rows.length, 0);
});

test('first prediction per normalized team name wins, ignoring case, Unicode equivalents and extra spaces', () => {
  const app = harness();
  assert.equal(app.submit(payload()), 'saved');
  assert.equal(app.submit(payload({ teamName: ' \uFF22EACH\u00A0  UNO ', teams: ['b', 'a'] })), 'duplicate');
  assert.equal(app.submit(payload({ teams: ['a', 'c'] })), 'duplicate');
  assert.equal(app.rows.length, 2);
  assert.equal(app.flushes(), 1);
  app.config.games.push({ ...app.config.games[1], id: 'another-prediction' });
  assert.equal(app.submit(payload({ gameId: 'another-prediction' })), 'saved');
  assert.equal(app.rows.length, 3);
});

test('receiver rereads published status and refuses closed, disabled and unknown games', () => {
  const app = harness();
  app.config.games[1].status = 'closed';
  assert.equal(app.submit(payload()), 'unavailable');
  app.config.games[1].status = 'open';
  app.config.games[1].enabled = false;
  assert.equal(app.submit(payload()), 'unavailable');
  assert.equal(app.submit(payload({ gameId: 'unknown' })), 'unavailable');
  assert.equal(app.rows.length, 0);
});

test('busy and storage errors are explicit, with no false saved response and no leaked lock', () => {
  const app = harness();
  app.lock(true);
  assert.equal(app.submit(payload()), 'busy');
  assert.equal(app.releases(), 0);
  app.lock(false);
  app.failWrites();
  assert.equal(app.submit(payload()), 'server_error');
  assert.equal(app.flushes(), 0);
  assert.equal(app.releases(), 1);
  assert.equal(app.logs.length, 1);
});

test('receiver stores names as literal text, preserving apostrophes and enforcing the 100-character limit', () => {
  const app = harness();
  app.config.games[1].teams[0].name = '=HYPERLINK("https://example.test")';
  app.config.games[1].teams[1].name = '+Team B';
  assert.equal(app.submit(payload({ teamName: '=Beach' })), 'saved');
  assert.equal(app.rows[1][2], '=Beach');
  assert.equal(app.writes[0][2], "'=Beach");
  assert.equal(app.writes[0][4], '\'=HYPERLINK("https://example.test")');
  assert.equal(app.writes[0][6], "'+Team B");
  assert.equal(app.submit(payload({ teamName: '=Beach' })), 'duplicate');
  assert.equal(app.submit(payload({ teamName: "'Beach" })), 'saved');
  assert.equal(app.rows[2][2], "'Beach");
  assert.equal(app.submit(payload({ teamName: "'BEACH" })), 'duplicate');
  assert.equal(app.submit(payload({ teamName: 'x'.repeat(100) })), 'saved');
  assert.equal(app.submit(payload({ teamName: 'x'.repeat(101) })), 'invalid_name');
});

test('receiver does not overwrite a prediction sheet with incompatible headers', () => {
  const app = harness();
  assert.equal(app.submit(payload()), 'saved');
  app.rows[0][0] = 'Custom header';
  assert.equal(app.submit(payload({ teamName: 'Beach Due' })), 'server_error');
  assert.equal(app.rows.length, 2);
  assert.equal(app.releases(), 2);
});

test('readiness verifies private settings and does not create response rows', () => {
  const app = harness();
  assert.equal(app.ready(), 'ready');
  assert.equal(app.rows.length, 0);
  delete app.properties.SPREADSHEET_ID;
  assert.equal(app.ready(), 'server_error');
  assert.equal(app.logs.length, 1);
});

function finalHarness() {
  const app = harness();
  app.properties.FINAL_DRAW_PASSWORD = 'Test-only-password-42';
  app.config.games[1].finalDraw = true;
  app.config.games[1].teams.push({ id: 'd', name: 'Squadra D' });
  app.prepare = (changes = {}) => app.send({
    action: 'prepare_draw', gameId: 'prediction', password: app.properties.FINAL_DRAW_PASSWORD, finalists: ['c', 'd'], ...changes
  });
  app.run = (changes = {}) => app.send({
    action: 'run_draw', gameId: 'prediction', password: app.properties.FINAL_DRAW_PASSWORD, ...changes
  });
  return app;
}

test('public roster contains only qualifying teams, once even when both finalists were predicted', () => {
  const app = finalHarness();
  assert.equal(app.submit(payload()), 'saved');
  assert.equal(app.submit(payload({ teamName: 'Beach Due', teams: ['a', 'c'] })), 'saved');
  assert.equal(app.submit(payload({ teamName: 'Beach Tre', teams: ['c', 'd'] })), 'saved');
  const collecting = app.read();
  assert.equal(collecting.draw.responseCount, 3);
  assert.equal(collecting.draw.participants.length, 0);
  const prepared = app.prepare();
  assert.equal(prepared.status, 'ok');
  assert.deepEqual(prepared.draw.participants.map(team => team.name), ['Beach Due', 'Beach Tre']);
  assert.deepEqual(prepared.draw.participants.map(team => team.participantId), ['beach due', 'beach tre']);
  assert.deepEqual(app.read().draw, prepared.draw);
  assert.doesNotThrow(() => validateFinalDraw(prepared.draw, 'prediction'));
  assert.equal(JSON.stringify(app.read()).includes(app.properties.FINAL_DRAW_PASSWORD), false);
  assert.equal(JSON.stringify(app.drawRows).includes(app.properties.FINAL_DRAW_PASSWORD), false);
  assert.equal(app.randomCalls(), 0);
});

test('only the private server-side password can prepare or run the final draw', () => {
  const app = finalHarness();
  for (const password of ['', 'WRONG', null]) {
    assert.equal(app.prepare({ password }).status, 'unauthorized');
    assert.equal(app.run({ password }).status, 'unauthorized');
  }
  assert.equal(app.drawRows.length, 0);
  assert.equal(app.randomCalls(), 0);
  app.config.accessPassword = app.properties.FINAL_DRAW_PASSWORD;
  assert.equal(app.prepare().status, 'not_configured');
  delete app.properties.FINAL_DRAW_PASSWORD;
  assert.equal(app.prepare({ password: 'anything' }).status, 'not_configured');
});

test('preparation requires real finalists but accepts entered participant names without a JSON mapping', () => {
  const app = finalHarness();
  assert.equal(app.submit(payload({ teamName: 'Nome libero', teams: ['a', 'c'] })), 'saved');
  for (const finalists of [['a'], ['c', 'c'], ['c', 'unknown']]) assert.equal(app.prepare({ finalists }).status, 'invalid_teams');
  const prepared = app.prepare();
  assert.equal(prepared.status, 'ok');
  assert.deepEqual(prepared.draw.participants, [{ participantId: 'nome libero', name: 'Nome libero' }]);
});

test('prepared roster closes new submissions and cannot be changed by another prepare request', () => {
  const app = finalHarness();
  app.submit(payload({ teamName: 'Beach Due', teams: ['a', 'c'] }));
  const original = app.prepare().draw;
  assert.equal(app.submit(payload()), 'unavailable');
  assert.deepEqual(app.prepare({ finalists: ['a', 'b'] }).draw, original);
  assert.equal(app.drawRows.length, 2);
  assert.equal(app.randomCalls(), 0);
});

test('final draw is persisted once and remains identical across retries, server restarts and public reads', () => {
  const app = finalHarness();
  app.submit(payload({ teamName: 'Beach Due', teams: ['a', 'c'] }));
  app.submit(payload({ teamName: 'Beach Tre', teams: ['c', 'd'] }));
  assert.equal(app.run().status, 'not_prepared');
  app.prepare();
  const result = app.run();
  assert.equal(result.status, 'ok');
  assert.equal(result.draw.stage, 'completed');
  assert.equal(result.draw.winner.name, 'Beach Tre');
  assert.doesNotThrow(() => validateFinalDraw(result.draw, 'prediction'));
  app.reload();
  assert.deepEqual(app.run().draw, result.draw);
  assert.deepEqual(app.prepare({ finalists: ['a', 'b'] }).draw, result.draw);
  assert.deepEqual(app.read().draw, result.draw);
  assert.equal(app.randomCalls(), 1);
  assert.equal(app.drawRows.length, 2);
});

test('no eligible teams means no random draw, while interrupted acknowledgement never rerolls a saved winner', () => {
  const empty = finalHarness();
  empty.submit(payload());
  assert.equal(empty.prepare().draw.participants.length, 0);
  assert.equal(empty.run().status, 'no_eligible');
  assert.equal(empty.randomCalls(), 0);
  const app = finalHarness();
  app.submit(payload({ teamName: 'Beach Due', teams: ['a', 'c'] }));
  app.prepare();
  app.failFlushes(true);
  assert.equal(app.run().status, 'server_error');
  app.failFlushes(false);
  assert.equal(app.run().draw.stage, 'completed');
  assert.equal(app.randomCalls(), 1);
});

test('simultaneous organizer requests respect the existing script lock', () => {
  const app = finalHarness();
  app.lock(true);
  assert.equal(app.prepare().status, 'busy');
  assert.equal(app.run().status, 'busy');
  assert.equal(app.drawRows.length, 0);
  assert.equal(app.randomCalls(), 0);
});

test('legacy saved draws are preserved and rejected rather than silently reset or rerolled', () => {
  const app = finalHarness();
  app.submit(payload({ teamName: 'Beach Due', teams: ['a', 'c'] }));
  app.prepare();
  const legacy = JSON.parse(app.drawRows[1][1]);
  legacy.version = 1;
  app.drawRows[1][1] = JSON.stringify(legacy);
  const before = app.drawRows[1][1];
  assert.equal(app.read().status, 'server_error');
  assert.equal(app.run().status, 'server_error');
  assert.equal(app.drawRows[1][1], before);
  assert.equal(app.randomCalls(), 0);
});
