const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');

const script = readFileSync(join(__dirname, 'google-predictions.gs'), 'utf8');

function harness() {
  const config = {
    games: [
      { id: 'draw', type: 'draw', codes: [{ code: 'A2B3C' }, { code: '01234' }] },
      {
        id: 'prediction', type: 'prediction', enabled: true, status: 'open', codeSourceGameId: 'draw',
        teams: [{ id: 'a', name: 'Squadra A' }, { id: 'b', name: 'Squadra B' }, { id: 'c', name: 'Squadra C' }]
      }
    ]
  };
  const rows = [];
  const writes = [];
  const logs = [];
  const properties = { SPREADSHEET_ID: 'private-sheet-id', GAMES_CONFIG_URL: 'https://example.test/games.json' };
  let sheetCreated = false;
  let busy = false;
  let failWrite = false;
  let releases = 0;
  let flushes = 0;
  const sheet = {
    getLastRow: () => rows.length,
    appendRow: row => rows.push(Array.from(row)),
    setFrozenRows: count => assert.equal(count, 1),
    getRange: (row, column, count, width) => {
      let textFormat = false;
      return {
        getValues: () => rows.slice(row - 1, row - 1 + count).map(values => values.slice(column - 1, column - 1 + width)),
        setNumberFormat: format => { assert.equal(format, '@'); textFormat = true; },
        setValues: values => {
          assert.equal(textFormat, true);
          if (failWrite) throw new Error('Simulated storage failure');
          writes.push(Array.from(values[0]));
          rows[row - 1] = Array.from(values[0], value => value.startsWith("'") ? value.slice(1) : value);
        }
      };
    }
  };
  const spreadsheet = {
    getSheetByName: name => { assert.equal(name, 'Pronostici sito'); return sheetCreated ? sheet : null; },
    insertSheet: name => { assert.equal(name, 'Pronostici sito'); sheetCreated = true; return sheet; }
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
      flush: () => { flushes += 1; }
    },
    LockService: { getScriptLock: () => ({ tryLock: () => !busy, releaseLock: () => { releases += 1; } }) },
    ContentService: {
      MimeType: { JSON: 'application/json' },
      createTextOutput: body => ({ setMimeType: () => JSON.parse(body) })
    },
    console: { error: (...args) => logs.push(args) }
  };
  vm.createContext(context);
  vm.runInContext(script, context);
  return {
    config, properties, rows, writes, logs,
    submit: payload => context.doPost({ postData: { contents: typeof payload === 'string' ? payload : JSON.stringify(payload) } }).status,
    ready: () => context.doGet().status,
    lock: value => { busy = value; },
    failWrites: () => { failWrite = true; },
    flushes: () => flushes,
    releases: () => releases
  };
}

const payload = (changes = {}) => ({ gameId: 'prediction', code: 'A2B3C', teams: ['a', 'b'], ...changes });

test('receiver persists normalized code and authoritative team names, then confirms', () => {
  const app = harness();
  assert.equal(app.submit(payload({ code: ' a2b3c ', names: ['Forged', 'Names'] })), 'saved');
  assert.equal(app.rows.length, 2);
  assert.deepEqual(app.rows[1].slice(1), ['prediction', 'A2B3C', 'a', 'Squadra A', 'b', 'Squadra B']);
  assert.equal(app.flushes(), 1);
  assert.equal(app.releases(), 1);
  assert.deepEqual(app.logs, []);
});

test('receiver rejects malformed requests, unknown codes and non-distinct or unknown teams', () => {
  const app = harness();
  for (const invalid of ['{', 'null', 'x'.repeat(4097), payload({ teams: ['a'] }), payload({ teams: ['a', 'b', 'c'] }), payload({ teams: ['a', 'a'] }), payload({ code: 123 })]) {
    assert.equal(app.submit(invalid), 'invalid_request');
  }
  assert.equal(app.submit(payload({ code: 'UNKNOWN' })), 'invalid_code');
  assert.equal(app.submit(payload({ teams: ['a', 'missing'] })), 'invalid_teams');
  assert.equal(app.rows.length, 0);
});

test('first prediction per game and code wins, irrespective of choice order or later changes', () => {
  const app = harness();
  assert.equal(app.submit(payload()), 'saved');
  assert.equal(app.submit(payload({ code: ' a2b3c ', teams: ['b', 'a'] })), 'duplicate');
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

test('receiver preserves leading-zero codes and escapes formula-like configured team names', () => {
  const app = harness();
  app.config.games[1].teams[0].name = '=HYPERLINK("https://example.test")';
  app.config.games[1].teams[1].name = '+Team B';
  assert.equal(app.submit(payload({ code: '01234' })), 'saved');
  assert.equal(app.rows[1][2], '01234');
  assert.equal(app.writes[0][4], '\'=HYPERLINK("https://example.test")');
  assert.equal(app.writes[0][6], "'+Team B");
  assert.equal(app.submit(payload({ code: '01234' })), 'duplicate');
});

test('receiver does not overwrite a prediction sheet with incompatible headers', () => {
  const app = harness();
  assert.equal(app.submit(payload()), 'saved');
  app.rows[0][0] = 'Custom header';
  assert.equal(app.submit(payload({ code: '01234' })), 'server_error');
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
