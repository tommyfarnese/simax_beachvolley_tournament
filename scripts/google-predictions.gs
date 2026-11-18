const PREDICTION_SHEET = 'Pronostici sito';
const PREDICTION_HEADERS = ['Data e ora UTC', 'Gioco', 'Codice squadra', 'ID squadra 1', 'Squadra 1', 'ID squadra 2', 'Squadra 2'];

function predictionResponse(status) {
  return ContentService.createTextOutput(JSON.stringify({ status: status })).setMimeType(ContentService.MimeType.JSON);
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

function doGet() {
  try {
    const settings = predictionSettings();
    SpreadsheetApp.openById(settings.SPREADSHEET_ID);
    predictionConfig(settings);
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
    if (!request || typeof request.gameId !== 'string' || !/^[a-z0-9-]+$/.test(request.gameId) ||
        typeof request.code !== 'string' || !request.code.trim() || request.code.length > 80 ||
        !Array.isArray(request.teams) || request.teams.length !== 2 ||
        request.teams.some(function (id) { return typeof id !== 'string' || !/^[a-z0-9-]{1,80}$/.test(id); }) ||
        request.teams[0] === request.teams[1]) return predictionResponse('invalid_request');

    const settings = predictionSettings();
    const config = predictionConfig(settings);
    const game = config.games.find(function (item) { return item.id === request.gameId; });
    if (!game || game.type !== 'prediction' || game.enabled !== true || game.status !== 'open') return predictionResponse('unavailable');
    if (!Array.isArray(game.teams)) throw new Error('The game has no on-site team configuration.');
    const teams = request.teams.map(function (id) {
      return game.teams.find(function (team) { return team.id === id; });
    });
    if (teams.some(function (team) { return !team || typeof team.name !== 'string' || !team.name.trim(); })) return predictionResponse('invalid_teams');
    const source = config.games.find(function (item) { return item.id === game.codeSourceGameId && item.type === 'draw'; });
    if (!source || !Array.isArray(source.codes)) throw new Error('The participation code source is invalid.');
    const code = request.code.trim().toUpperCase();
    if (!source.codes.some(function (entry) { return entry.code.trim().toUpperCase() === code; })) return predictionResponse('invalid_code');

    const lock = LockService.getScriptLock();
    if (!lock.tryLock(10000)) return predictionResponse('busy');
    try {
      const spreadsheet = SpreadsheetApp.openById(settings.SPREADSHEET_ID);
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
        if (entries.some(function (entry) { return entry[0] === game.id && String(entry[1]).trim().toUpperCase() === code; })) {
          return predictionResponse('duplicate');
        }
      }
      const row = [new Date().toISOString(), game.id, code, teams[0].id, teams[0].name, teams[1].id, teams[1].name].map(function (value) {
        // Keep configured names and codes from being interpreted as spreadsheet formulas.
        return /^[=+\-@\t\r]/.test(value) ? "'" + value : value;
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
