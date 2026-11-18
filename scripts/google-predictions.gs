const PREDICTION_SHEET = 'Pronostici squadre';
const PREDICTION_HEADERS = ['Data e ora UTC', 'Gioco', 'Nome squadra', 'ID squadra 1', 'Squadra 1', 'ID squadra 2', 'Squadra 2'];
const FINAL_DRAW_SHEET = 'Estrazioni finali';
const FINAL_DRAW_HEADERS = ['Gioco', 'Stato JSON'];

function predictionResponse(status, draw) {
  const body = { status: status };
  if (draw) body.draw = draw;
  return ContentService.createTextOutput(JSON.stringify(body)).setMimeType(ContentService.MimeType.JSON);
}

function predictionSettings() {
  const settings = PropertiesService.getScriptProperties().getProperties();
  if (!settings.SPREADSHEET_ID || !/^https:\/\/[^/?#]+\/[^#]*games\.json(?:\?[^#]*)?$/.test(settings.GAMES_CONFIG_URL || '')) {
    throw new Error('Configure SPREADSHEET_ID and the public HTTPS GAMES_CONFIG_URL in script properties.');
  }
  return settings;
}

function predictionConfig(settings) {
  const separator = settings.GAMES_CONFIG_URL.indexOf('?') === -1 ? '?' : '&';
  const response = UrlFetchApp.fetch(settings.GAMES_CONFIG_URL + separator + '_=' + Date.now(), { muteHttpExceptions: true });
  if (response.getResponseCode() !== 200) throw new Error('Games configuration could not be loaded.');
  const config = JSON.parse(response.getContentText());
  if (!config || !Array.isArray(config.games)) throw new Error('Games configuration is invalid.');
  return config;
}

function doGet(event) {
  try {
    const settings = predictionSettings();
    const spreadsheet = SpreadsheetApp.openById(settings.SPREADSHEET_ID);
    const config = predictionConfig(settings);
    if (event && event.parameter && event.parameter.action) {
      if (event.parameter.action !== 'final_draw') return predictionResponse('invalid_request');
      const game = config.games.find(function (item) { return item.id === event.parameter.gameId; });
      if (!game || game.enabled !== true || game.type !== 'prediction' || game.finalDraw !== true) return predictionResponse('unavailable');
      const stored = readFinalDraw(spreadsheet, game.id);
      return predictionResponse('ok', stored ? stored.draw : collectingFinalDraw(spreadsheet, game));
    }
    return predictionResponse('ready');
  } catch (error) {
    console.error('SiMax predictions: readiness check failed.', error);
    return predictionResponse('server_error');
  }
}

function doPost(event) {
  try {
    if (!event || !event.postData || typeof event.postData.contents !== 'string' || event.postData.contents.length > 4096) {
      return predictionResponse('invalid_request');
    }
    let request;
    try {
      request = JSON.parse(event.postData.contents);
    } catch (error) {
      if (error instanceof SyntaxError) return predictionResponse('invalid_request');
      throw error;
    }
    if (request && (request.action === 'prepare_draw' || request.action === 'run_draw')) return finalDrawAction(request);
    if (request && request.action !== undefined) return predictionResponse('invalid_request');
    if (!request || typeof request.gameId !== 'string' || !/^[a-z0-9-]+$/.test(request.gameId) ||
        typeof request.teamName !== 'string' ||
        !Array.isArray(request.teams) || request.teams.length !== 2 ||
        request.teams.some(function (id) { return typeof id !== 'string' || !/^[a-z0-9-]{1,80}$/.test(id); }) ||
        request.teams[0] === request.teams[1]) return predictionResponse('invalid_request');
    const teamName = normalizePredictionName(request.teamName);
    if (!validPredictionName(teamName)) return predictionResponse('invalid_name');
    const participantId = teamName.toLowerCase();

    const settings = predictionSettings();
    const config = predictionConfig(settings);
    const game = config.games.find(function (item) { return item.id === request.gameId; });
    if (!game || game.type !== 'prediction' || game.enabled !== true || game.status !== 'open') return predictionResponse('unavailable');
    if (!Array.isArray(game.teams)) throw new Error('The game has no on-site team configuration.');
    const teams = request.teams.map(function (id) {
      return game.teams.find(function (team) { return team.id === id; });
    });
    if (teams.some(function (team) { return !team || typeof team.name !== 'string' || !team.name.trim(); })) return predictionResponse('invalid_teams');

    const lock = LockService.getScriptLock();
    if (!lock.tryLock(10000)) return predictionResponse('busy');
    try {
      const spreadsheet = SpreadsheetApp.openById(settings.SPREADSHEET_ID);
      if (game.finalDraw === true && readFinalDraw(spreadsheet, game.id)) return predictionResponse('unavailable');
      let sheet = spreadsheet.getSheetByName(PREDICTION_SHEET);
      if (!sheet) sheet = spreadsheet.insertSheet(PREDICTION_SHEET);
      if (sheet.getLastRow() === 0) {
        sheet.appendRow(PREDICTION_HEADERS);
        sheet.setFrozenRows(1);
      }
      const headers = sheet.getRange(1, 1, 1, PREDICTION_HEADERS.length).getValues()[0];
      if (PREDICTION_HEADERS.some(function (header, index) { return header !== headers[index]; })) {
        throw new Error('The prediction sheet headers do not match. Do not overwrite the Forms response tab.');
      }
      if (sheet.getLastRow() > 1) {
        const entries = sheet.getRange(2, 2, sheet.getLastRow() - 1, 2).getValues();
        if (entries.some(function (entry) { return entry[0] === game.id && normalizePredictionName(String(entry[1])).toLowerCase() === participantId; })) {
          return predictionResponse('duplicate');
        }
      }

      const row = [new Date().toISOString(), game.id, teamName, teams[0].id, teams[0].name, teams[1].id, teams[1].name].map(function (value) {
        // Keep names as literal text, including leading apostrophes and formula-like input.
        return /^[=+\-@'\t\r]/.test(value) ? "'" + value : value;
      });
      const range = sheet.getRange(sheet.getLastRow() + 1, 1, 1, row.length);
      range.setNumberFormat('@');
      range.setValues([row]);
      SpreadsheetApp.flush();
      return predictionResponse('saved');
    } finally {
      lock.releaseLock();
    }
  } catch (error) {
    console.error('SiMax predictions: submission failed.', error);
    return predictionResponse('server_error');
  }
}

function normalizePredictionName(name) {
  return name.normalize('NFKC').trim().replace(/\s+/g, ' ');
}

function validPredictionName(name) {
  return name.trim().length > 0 && name.length <= 100 && !/[\u0000-\u001f\u007f]/.test(name);
}

function predictionRows(spreadsheet, game) {
  const sheet = spreadsheet.getSheetByName(PREDICTION_SHEET);
  if (!sheet || sheet.getLastRow() === 0) return [];
  const headers = sheet.getRange(1, 1, 1, PREDICTION_HEADERS.length).getValues()[0];
  if (PREDICTION_HEADERS.some(function (header, index) { return header !== headers[index]; })) throw new Error('Invalid prediction sheet headers.');
  if (sheet.getLastRow() === 1) return [];
  if (!Array.isArray(game.teams)) throw new Error('Invalid prediction configuration.');
  const seen = new Set();
  return sheet.getRange(2, 1, sheet.getLastRow() - 1, PREDICTION_HEADERS.length).getValues().filter(function (row) {
    return row[1] === game.id;
  }).map(function (row) {
    const name = normalizePredictionName(String(row[2]));
    const participantId = name.toLowerCase();
    if (!validPredictionName(name) || seen.has(participantId) ||
        row[3] === row[5] || ![row[3], row[5]].every(function (id) { return game.teams.some(function (team) { return team.id === id; }); })) {
      throw new Error('Prediction rows contain duplicate team names or invalid entries. Check the sheet before preparing the draw.');
    }
    seen.add(participantId);
    return { participantId: participantId, name: name, picks: [row[3], row[5]] };
  });
}

function collectingFinalDraw(spreadsheet, game) {
  return { version: 2, gameId: game.id, stage: 'collecting', responseCount: predictionRows(spreadsheet, game).length, finalists: [], participants: [], winner: null };
}

function finalDrawTeam(team) {
  const result = { teamId: team.id, name: team.name };
  if (typeof team.nameEn === 'string') result.nameEn = team.nameEn;
  return result;
}

function readFinalDraw(spreadsheet, gameId) {
  const sheet = spreadsheet.getSheetByName(FINAL_DRAW_SHEET);
  if (!sheet || sheet.getLastRow() === 0) return null;
  const rows = sheet.getRange(1, 1, sheet.getLastRow(), FINAL_DRAW_HEADERS.length).getValues();
  if (FINAL_DRAW_HEADERS.some(function (header, index) { return rows[0][index] !== header; })) throw new Error('Invalid final draw sheet headers.');
  let stored = null;
  rows.slice(1).forEach(function (row, index) {
    if (row[0] !== gameId) return;
    if (stored) throw new Error('Duplicate final draw records.');
    const draw = JSON.parse(row[1]);
    const validTeam = function (team) {
      return team && typeof team.teamId === 'string' && typeof team.name === 'string' && team.name.trim();
    };
    const validParticipant = function (team) {
      return team && typeof team.name === 'string' && validPredictionName(team.name) &&
        team.participantId === normalizePredictionName(team.name).toLowerCase();
    };
    if (!draw || draw.version !== 2 || draw.gameId !== gameId || !['prepared', 'completed'].includes(draw.stage) ||
        !Array.isArray(draw.participants) || !Array.isArray(draw.finalists) || draw.finalists.length !== 2 ||
        !draw.finalists.every(validTeam) || draw.finalists[0].teamId === draw.finalists[1].teamId ||
        !draw.participants.every(validParticipant) ||
        new Set(draw.participants.map(function (team) { return team.participantId; })).size !== draw.participants.length ||
        !Number.isInteger(draw.responseCount) || draw.responseCount < draw.participants.length || !Number.isFinite(Date.parse(draw.preparedAt)) ||
        (draw.stage === 'prepared' && draw.winner !== null) ||
        (draw.stage === 'completed' && (!validParticipant(draw.winner) || !Number.isFinite(Date.parse(draw.drawnAt)) ||
          !draw.participants.some(function (team) { return team.participantId === draw.winner.participantId && team.name === draw.winner.name; })))) {
      throw new Error('Invalid or legacy final draw. Preserve existing results and use a new game ID for the new format.');
    }
    stored = { sheet: sheet, row: index + 2, draw: draw };
  });
  return stored;
}

function saveFinalDraw(spreadsheet, draw, stored) {
  const json = JSON.stringify(draw);
  if (json.length > 45000) throw new Error('Final draw snapshot exceeds the supported sheet cell size.');
  let sheet = stored ? stored.sheet : spreadsheet.getSheetByName(FINAL_DRAW_SHEET);
  if (!sheet) sheet = spreadsheet.insertSheet(FINAL_DRAW_SHEET);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(FINAL_DRAW_HEADERS);
    sheet.setFrozenRows(1);
  }
  const range = sheet.getRange(stored ? stored.row : sheet.getLastRow() + 1, 1, 1, 2);
  range.setNumberFormat('@');
  range.setValues([[draw.gameId, json]]);
  SpreadsheetApp.flush();
}

function finalDrawAction(request) {
  if (typeof request.gameId !== 'string' || !/^[a-z0-9-]+$/.test(request.gameId)) return predictionResponse('invalid_request');
  const settings = predictionSettings();
  if (typeof settings.FINAL_DRAW_PASSWORD !== 'string' || settings.FINAL_DRAW_PASSWORD.length < 12 || settings.FINAL_DRAW_PASSWORD.length > 128) {
    console.error('SiMax final draw: configure FINAL_DRAW_PASSWORD with 12 to 128 characters in script properties.');
    return predictionResponse('not_configured');
  }
  if (typeof request.password !== 'string' || request.password !== settings.FINAL_DRAW_PASSWORD) return predictionResponse('unauthorized');
  const config = predictionConfig(settings);
  if (config.accessPassword === settings.FINAL_DRAW_PASSWORD) {
    console.error('SiMax final draw: the private password must differ from the public participant password.');
    return predictionResponse('not_configured');
  }
  const game = config.games.find(function (item) { return item.id === request.gameId; });
  if (!game || game.enabled !== true || game.type !== 'prediction' || game.finalDraw !== true ||
      !['open', 'closed'].includes(game.status)) return predictionResponse('unavailable');
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return predictionResponse('busy');
  try {
    const spreadsheet = SpreadsheetApp.openById(settings.SPREADSHEET_ID);
    const stored = readFinalDraw(spreadsheet, game.id);
    if (stored && (request.action === 'prepare_draw' || stored.draw.stage === 'completed')) return predictionResponse('ok', stored.draw);
    if (request.action === 'run_draw') {
      if (!stored) return predictionResponse('not_prepared');
      if (!stored.draw.participants.length) return predictionResponse('no_eligible');
      const draw = stored.draw;
      draw.winner = draw.participants[Math.floor(Math.random() * draw.participants.length)];
      draw.stage = 'completed';
      draw.drawnAt = new Date().toISOString();
      saveFinalDraw(spreadsheet, draw, stored);
      return predictionResponse('ok', draw);
    }
    if (!Array.isArray(request.finalists) || request.finalists.length !== 2 || request.finalists[0] === request.finalists[1] ||
        !Array.isArray(game.teams) || !request.finalists.every(function (id) { return game.teams.some(function (team) { return team.id === id; }); })) {
      return predictionResponse('invalid_teams');
    }
    const rows = predictionRows(spreadsheet, game);
    const participants = rows.filter(function (row) {
      return row.picks.some(function (id) { return request.finalists.includes(id); });
    }).map(function (row) { return { participantId: row.participantId, name: row.name }; });
    const draw = {
      version: 2, gameId: game.id, stage: 'prepared', preparedAt: new Date().toISOString(),
      responseCount: rows.length, finalists: request.finalists.map(function (id) {
        return finalDrawTeam(game.teams.find(function (team) { return team.id === id; }));
      }), participants: participants, winner: null
    };
    saveFinalDraw(spreadsheet, draw, null);
    return predictionResponse('ok', draw);
  } finally {
    lock.releaseLock();
  }
}
