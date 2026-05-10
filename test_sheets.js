require('dotenv').config({ path: '.env.local' });

const email = (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || '').trim().replace(/^"|"$/g, '');
const rawPk = process.env.GOOGLE_PRIVATE_KEY || '';
const pk = rawPk.trim().replace(/\\n/g, '\n').replace(/^"|"$/g, '');
const crmId = process.env.CRM_SPREADSHEET_ID || '';
const kpiId = process.env.KPI_SPREADSHEET_ID || '';

console.log('=== CREDENCIALES ===');
console.log('Email:', email || '(VACÍO)');
console.log('PK primeras 50 chars:', pk.substring(0, 50));
console.log('PK contiene newlines reales:', pk.includes('\n'));
console.log('CRM ID:', crmId || '(VACÍO)');
console.log('KPI ID:', kpiId || '(VACÍO)');

if (!email || !pk) {
  console.error('\nERROR: Credenciales faltantes');
  process.exit(1);
}

const { google } = require('googleapis');

async function test() {
  const auth = new google.auth.GoogleAuth({
    credentials: { client_email: email, private_key: pk },
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });

  const client = await auth.getClient();
  const sheets = google.sheets({ version: 'v4', auth: client });

  console.log('\n=== TEST CRM SPREADSHEET ===');
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: crmId,
      range: 'Leads!A1:A3',
      valueRenderOption: 'UNFORMATTED_VALUE',
    });
    console.log('✅ Acceso OK. Filas obtenidas:', res.data.values ? res.data.values.length : 0);
    if (res.data.values && res.data.values[0]) {
      console.log('Primera celda:', res.data.values[0][0]);
    }
  } catch (e) {
    console.error('❌ Error:', e.message);
    console.error('   Code:', e.code);
  }

  console.log('\n=== TEST KPI SPREADSHEET ===');
  try {
    const res2 = await sheets.spreadsheets.get({ spreadsheetId: kpiId });
    console.log('✅ Acceso OK. Título:', res2.data.properties.title);
    const sheetNames = res2.data.sheets.map(s => s.properties.title);
    console.log('   Hojas:', sheetNames.join(', '));
  } catch (e) {
    console.error('❌ Error:', e.message);
  }
}

test().catch(console.error);
