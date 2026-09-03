// ============================================================
// CredyFast — 02_SheetHelper.gs
// Abstracción de acceso a Google Sheets.
// Todas las operaciones de lectura/escritura pasan por aquí.
// ============================================================

const SheetHelper = (() => {

  // Cache interno de referencias a hojas (evita llamadas redundantes)
  let _ss = null;
  const _sheetCache = {};

  function _getSpreadsheet() {
    if (!_ss) _ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    return _ss;
  }

  function getSheet(sheetName) {
    if (!_sheetCache[sheetName]) {
      _sheetCache[sheetName] = _getSpreadsheet().getSheetByName(sheetName);
      if (!_sheetCache[sheetName]) throw new Error(`Hoja no encontrada: ${sheetName}`);
    }
    return _sheetCache[sheetName];
  }

  /**
   * Lee todas las filas como array de objetos usando la fila 1 como encabezados.
   */
  function getAll(sheetName) {
    const sheet = getSheet(sheetName);
    const data  = sheet.getDataRange().getValues();
    if (data.length <= 1) return [];
    const headers = data[0];
    return data.slice(1).map(row => {
      const obj = {};
      headers.forEach((h, i) => { obj[h] = row[i]; });
      return obj;
    });
  }

  /**
   * Busca filas que cumplan un predicado. Devuelve array de {rowIndex, data}.
   * rowIndex es 1-based (como en Sheets).
   */
  function findRows(sheetName, predicate) {
    const sheet = getSheet(sheetName);
    const data  = sheet.getDataRange().getValues();
    if (data.length <= 1) return [];
    const headers = data[0];
    const results = [];
    for (let i = 1; i < data.length; i++) {
      const obj = {};
      headers.forEach((h, j) => { obj[h] = data[i][j]; });
      if (predicate(obj)) results.push({ rowIndex: i + 1, data: obj });
    }
    return results;
  }

  /**
   * Busca la primera fila que cumple el predicado.
   */
  function findOne(sheetName, predicate) {
    const results = findRows(sheetName, predicate);
    return results.length > 0 ? results[0] : null;
  }

  /**
   * Inserta una nueva fila al final de la hoja.
   * @param {string} sheetName
   * @param {Object} rowObj - objeto clave:valor. Las claves deben coincidir con encabezados.
   */
  function insertRow(sheetName, rowObj) {
    const sheet   = getSheet(sheetName);
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const row     = headers.map(h => (rowObj[h] !== undefined ? rowObj[h] : ''));
    sheet.appendRow(row);
  }

  /**
   * Actualiza campos específicos de una fila (por rowIndex 1-based).
   * @param {string} sheetName
   * @param {number} rowIndex - Fila a actualizar (1-based)
   * @param {Object} updates  - {nombreColumna: nuevoValor}
   */
  function updateRow(sheetName, rowIndex, updates) {
    const sheet   = getSheet(sheetName);
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    Object.entries(updates).forEach(([key, value]) => {
      const colIndex = headers.indexOf(key);
      if (colIndex === -1) throw new Error(`Columna no encontrada: ${key} en ${sheetName}`);
      sheet.getRange(rowIndex, colIndex + 1).setValue(value);
    });
  }

  /**
   * Genera el siguiente ID secuencial para una hoja.
   * DEBE llamarse dentro de un LockService.
   */
  function nextId(sheetName, prefix, padLength) {
    const sheet    = getSheet(sheetName);
    const lastRow  = sheet.getLastRow();
    if (lastRow <= 1) return prefix + '1'.padStart(padLength, '0');
    const lastId = sheet.getRange(lastRow, 1).getValue().toString();
    const num    = parseInt(lastId.replace(prefix, ''), 10) || 0;
    return prefix + String(num + 1).padStart(padLength, '0');
  }

  /**
   * Devuelve el valor de la última celda de una columna específica.
   */
  function getLastColumnValue(sheetName, colIndex) {
    const sheet   = getSheet(sheetName);
    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) return null;
    return sheet.getRange(lastRow, colIndex).getValue();
  }

  /**
   * H-01: Inserta múltiples filas en una sola llamada setValues().
   * Mucho más eficiente que N llamadas a insertRow().
   * @param {string} sheetName
   * @param {Object[]} rowObjs - Array de objetos {columna: valor}
   */
  function batchInsert(sheetName, rowObjs) {
    if (!rowObjs || rowObjs.length === 0) return;
    const sheet   = getSheet(sheetName);
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const rows    = rowObjs.map(obj => headers.map(h => (obj[h] !== undefined ? obj[h] : '')));
    const startRow = sheet.getLastRow() + 1;
    sheet.getRange(startRow, 1, rows.length, headers.length).setValues(rows);
  }

  /**
   * Devuelve TODAS las filas con su rowIndex (1-based).
   * Equivalente a findRows(sheetName, () => true) pero más semántico.
   * @param {string} sheetName
   * @returns {Array<{rowIndex: number, data: Object}>}
   */
  function getAllRows(sheetName) {
    return findRows(sheetName, () => true);
  }

  return { getSheet, getAll, findRows, findOne, getAllRows, insertRow, updateRow, nextId, getLastColumnValue, batchInsert };

})();
