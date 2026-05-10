// api/update.js
// POST /api/update
// Body: { leadId: "123", nuevoEstado: "ABIERTO" }
// Actualiza la columna ESTADO en la hoja Leads

const { getSheetData, updateCell, g, CRM_SPREADSHEET_ID } = require('./_lib/sheets');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ success: false, message: 'Method not allowed' });

  const { leadId, nuevoEstado } = req.body || {};
  if (!leadId || !nuevoEstado) {
    return res.status(400).json({ success: false, message: 'leadId y nuevoEstado son requeridos' });
  }

  try {
    const dataLeads = await getSheetData(CRM_SPREADSHEET_ID, 'Leads');
    if (dataLeads.length < 2) return res.json({ success: false, message: 'Hoja Leads vacía' });

    const headers = dataLeads[0].map(h => String(h).trim().toUpperCase());
    const idIndex = headers.indexOf('LEADID');
    const estadoIndex = headers.indexOf('ESTADO');

    if (idIndex === -1 || estadoIndex === -1) {
      return res.json({ success: false, message: 'No se encontraron columnas LeadID o ESTADO' });
    }

    for (let i = 1; i < dataLeads.length; i++) {
      const rowId = String(g(dataLeads[i], idIndex, '')).trim();
      if (rowId === String(leadId).trim()) {
        // i+1 porque la API de Sheets es 1-indexed y la fila 1 es el header
        await updateCell(CRM_SPREADSHEET_ID, 'Leads', i + 1, estadoIndex + 1, nuevoEstado);
        return res.json({ success: true, message: 'Estado actualizado correctamente' });
      }
    }

    return res.json({ success: false, message: 'Lead no encontrado en la base' });
  } catch (err) {
    console.error('[api/update] Error:', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
};
