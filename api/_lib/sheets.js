// api/_lib/sheets.js
// Autenticación con Google Sheets API via Service Account.
// Variables de entorno requeridas:
//   GOOGLE_SERVICE_ACCOUNT_KEY  → JSON completo de la SA (preferido)
//   o bien: GOOGLE_SERVICE_ACCOUNT_EMAIL + GOOGLE_PRIVATE_KEY
//   CRM_SPREADSHEET_ID          → ID del spreadsheet CRM
//   KPI_SPREADSHEET_ID          → ID del spreadsheet KPI

const { google } = require('googleapis');

const CRM_SPREADSHEET_ID = process.env.CRM_SPREADSHEET_ID || '';
const KPI_SPREADSHEET_ID = process.env.KPI_SPREADSHEET_ID || '';

let _authClient = null;

async function getAuthClient() {
  if (_authClient) return _authClient;
  let credentials;
  const rawKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (rawKey && rawKey.trim().startsWith('{')) {
    credentials = JSON.parse(rawKey);
  } else {
    const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || '';
    const privateKey = (process.env.GOOGLE_PRIVATE_KEY || '')
      .trim().replace(/\\n/g, '\n').replace(/"/g, '');
    credentials = { client_email: email.trim(), private_key: privateKey };
  }
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: [
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/drive.readonly',
    ],
  });
  _authClient = await auth.getClient();
  return _authClient;
}

async function getSheetData(spreadsheetId, sheetName) {
  const auth = await getAuthClient();
  const sheets = google.sheets({ version: 'v4', auth });
  const range = sheetName.includes(' ') ? `'${sheetName}'` : sheetName;
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
      valueRenderOption: 'UNFORMATTED_VALUE',
      dateTimeRenderOption: 'SERIAL_NUMBER',
    });
    return res.data.values || [];
  } catch (e) {
    console.error(`[sheets] Error leyendo "${sheetName}":`, e.message);
    return [];
  }
}

async function updateCell(spreadsheetId, sheetName, row, col, value) {
  const auth = await getAuthClient();
  const sheets = google.sheets({ version: 'v4', auth });
  // row y col son 1-indexed
  const colLetter = String.fromCharCode(64 + col);
  const range = `${sheetName}!${colLetter}${row}`;
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range,
    valueInputOption: 'RAW',
    requestBody: { values: [[value]] },
  });
}

function g(row, idx, def = '') {
  const v = row && row.length > idx ? row[idx] : undefined;
  if (v !== null && v !== undefined && v !== '') return v;
  return def;
}

module.exports = { getSheetData, updateCell, g, CRM_SPREADSHEET_ID, KPI_SPREADSHEET_ID };
