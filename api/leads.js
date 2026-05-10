// api/leads.js
// GET /api/leads?email=usuario@decampoacampo.com
// Devuelve { rol: "admin"|"comercial", leads: [...] }

const { getSheetData, g, CRM_SPREADSHEET_ID, KPI_SPREADSHEET_ID } = require('./_lib/sheets');

const ADMINS = [
  'sdewey@decampoacampo.com',
  'arivas@decampoacampo.com',
  'jsineriz@decampoacampo.com',
  'ptaffarel@decampoacampo.com',
  'jtonon@decampoacampo.com',
  'asegobia@decampoacampo.com',
  'lbortolin@decampoacampo.com',
];

// Convierte número de serie de Google Sheets a timestamp JS (ms)
function serialToTs(serial) {
  if (!serial || typeof serial !== 'number') return null;
  // Google Sheets epoch: 30/12/1899
  const ms = (serial - 25569) * 86400 * 1000;
  return isNaN(ms) ? null : ms;
}

function getSafeDate(value) {
  if (!value && value !== 0) return null;
  if (typeof value === 'number') return serialToTs(value);
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value.getTime();
  const str = String(value).trim();
  const p = str.split(/[\/\-\sT]/);
  if (p.length >= 3) {
    let anio, mes, dia;
    if (p[2] && p[2].length >= 4) {
      dia = parseInt(p[0], 10); mes = parseInt(p[1], 10) - 1; anio = parseInt(p[2].substring(0, 4), 10);
    } else if (p[0] && p[0].length === 4) {
      anio = parseInt(p[0], 10); mes = parseInt(p[1], 10) - 1; dia = parseInt(p[2].substring(0, 2), 10);
    }
    if (anio && !isNaN(mes) && !isNaN(dia)) return new Date(anio, mes, dia).getTime();
  }
  const parsed = Date.parse(str);
  return isNaN(parsed) ? null : parsed;
}

module.exports = async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const emailUsuario = (req.query.email || '').toLowerCase().trim();
  if (!emailUsuario) return res.status(400).json({ error: 'Email requerido' });

  try {
    // 1. Leer datos de los tres spreadsheets en paralelo
    const [dataLeads, dataAux, dataKPI] = await Promise.all([
      getSheetData(CRM_SPREADSHEET_ID, 'Leads'),
      getSheetData(CRM_SPREADSHEET_ID, 'Aux Cambio Estado'),
      getSheetData(KPI_SPREADSHEET_ID, 'KPI dCaC'),
    ]);

    // 2. Construir mapa KPI por CUIT
    const mapKPI = {};
    if (dataKPI.length > 1) {
      let headKPI = [], startRow = 0;
      for (let r = 0; r < Math.min(10, dataKPI.length); r++) {
        const rowStr = dataKPI[r].map(c => String(c).trim().toUpperCase());
        if (rowStr.indexOf('CUIT') >= 0 && rowStr.indexOf('Q TOTAL') >= 0) {
          headKPI = rowStr; startRow = r; break;
        }
      }
      if (headKPI.length > 0) {
        const iCuit = headKPI.indexOf('CUIT');
        const iQTotal = headKPI.indexOf('Q TOTAL');
        const iKPI = headKPI.indexOf('KPI DCAC');
        const iCab = headKPI.indexOf('CAB OP');
        for (let k = startRow + 1; k < dataKPI.length; k++) {
          const row = dataKPI[k];
          const cuit = String(g(row, iCuit, '')).replace(/\D/g, '');
          if (cuit) {
            const rawQ = String(g(row, iQTotal, '0')).replace(/,/g, '').replace(/\./g, '');
            mapKPI[cuit] = {
              qTotal: parseInt(rawQ, 10) || 0,
              kpiScore: iKPI >= 0 ? g(row, iKPI, 0) : 0,
              cabOp: iCab >= 0 ? g(row, iCab, 0) : 0,
            };
          }
        }
      }
    }

    // 3. Construir mapa último estado por LeadID
    const mapUltimoEstado = {};
    if (dataAux.length > 1) {
      const headAux = dataAux[0].map(c => String(c).trim().toUpperCase());
      const iLeadAux = headAux.indexOf('LEADID');
      const iFechaAux = headAux.indexOf('FECHA');
      if (iLeadAux >= 0 && iFechaAux >= 0) {
        for (let a = 1; a < dataAux.length; a++) {
          const idAux = String(g(dataAux[a], iLeadAux, '')).trim();
          const tsAux = getSafeDate(g(dataAux[a], iFechaAux, ''));
          if (idAux && tsAux) {
            if (!mapUltimoEstado[idAux] || tsAux > mapUltimoEstado[idAux]) {
              mapUltimoEstado[idAux] = tsAux;
            }
          }
        }
      }
    }

    // 4. Procesar Leads
    if (dataLeads.length <= 1) return res.json({ rol: 'comercial', leads: [] });

    const headers = dataLeads[0].map(h => String(h).trim());
    const idx = {
      id:        headers.indexOf('LeadID'),
      fechaAsig: headers.indexOf('Fecha de asignación'),
      fechaReas: headers.indexOf('Fecha reasignacion'),
      cuit:      headers.indexOf('CUIT Sociedad'),
      titulo:    headers.indexOf('Título'),
      razon:     headers.indexOf('Razón Social'),
      ac:        headers.indexOf('AC asignado'),
      provincia: headers.indexOf('Provincia Usuario'),
      partido:   headers.indexOf('Partido Usuario'),
      telefono:  headers.indexOf('Teléfono'),
      email:     headers.indexOf('Email'),
      actividad: headers.indexOf('Actividad (1)'),
      estado:    headers.indexOf('ESTADO'),
      comentario:headers.indexOf('Ult Coment AC'),
      fuente:    headers.indexOf('Fuente'),
    };

    const isAdmin = ADMINS.includes(emailUsuario);
    const mList = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
    const leads = [];

    for (let i = 1; i < dataLeads.length; i++) {
      const row = dataLeads[i];
      const leadId = String(g(row, idx.id, '')).trim();
      const titulo = String(g(row, idx.titulo, '')).trim();
      if (!leadId && !titulo) continue;

      const acAsignado = String(g(row, idx.ac, ''));
      if (!isAdmin && acAsignado.toLowerCase().trim() !== emailUsuario) continue;

      const cleanCuit = String(g(row, idx.cuit, '')).replace(/\D/g, '');
      const kpiData = mapKPI[cleanCuit] || { qTotal: 0, kpiScore: 0, cabOp: 0 };

      const tsAsigOrig = getSafeDate(g(row, idx.fechaAsig, ''));
      const tsReasig = getSafeDate(g(row, idx.fechaReas, ''));
      const tsAsigFinal = tsReasig || tsAsigOrig;
      const tsUltimo = mapUltimoEstado[leadId] || tsAsigFinal;
      const dAsig = tsAsigFinal ? new Date(tsAsigFinal) : null;

      leads.push({
        id: leadId || '0',
        tsAsig: tsAsigFinal,
        tsUltimo,
        mesFiltro:   dAsig ? mList[dAsig.getMonth()] : '',
        anioFiltro:  dAsig ? String(dAsig.getFullYear()) : '',
        mesNum:      dAsig ? dAsig.getMonth() + 1 : null,
        mesAnioSort: dAsig ? dAsig.getFullYear() * 100 + (dAsig.getMonth() + 1) : 0,
        cuit:        String(g(row, idx.cuit, '-')),
        titulo:      titulo || 'Sin Título',
        razonSocial: String(g(row, idx.razon, '-')),
        ac:          acAsignado || 'Sin Asignar',
        provincia:   String(g(row, idx.provincia, 'S/D')),
        partido:     String(g(row, idx.partido, 'S/D')),
        telefono:    String(g(row, idx.telefono, '')),
        email:       String(g(row, idx.email, '')),
        actividad:   String(g(row, idx.actividad, 'S/D')),
        estado:      String(g(row, idx.estado, 'NUEVO')),
        comentario:  String(g(row, idx.comentario, '')),
        fuente:      String(g(row, idx.fuente, '-')),
        qTotal:      kpiData.qTotal,
        kpiScore:    kpiData.kpiScore,
        cabOp:       kpiData.cabOp,
      });
    }

    leads.sort((a, b) => Number(a.id) - Number(b.id));
    return res.json({ rol: isAdmin ? 'admin' : 'comercial', leads });

  } catch (err) {
    console.error('[api/leads] Error:', err.message);
    return res.status(500).json({ error: err.message });
  }
};
