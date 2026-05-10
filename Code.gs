const ID_CRM_ORIGEN = "1tYDuVZFmaZOxUDqUfEjgap4PWSlvYSYwnZnZNFW_CgM";
const ID_KPI_ORIGEN = "1tvbOhTBnt1is3V-TYdhU1Ijq-AGAi_cTjbwi7heoB_U";
const HOJAS_A_IMPORTAR = ["Leads", "Aprobacion Leads", "Aux Cambio Estado"];

// --- API ENDPOINTS PARA VERCEL ---

function doGet(e) {
  try {
    var action = e.parameter.action;
    if (action === "getLeads") {
      var email = e.parameter.email || "";
      var data = getLeadsData(email);
      return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
    }
    return ContentService.createTextOutput(JSON.stringify({error: "Acción no válida"})).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({error: error.message})).setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  try {
    var payload = JSON.parse(e.postData.contents);
    if (payload.action === "actualizarEstado") {
      var res = actualizarEstadoBackend(payload.leadId, payload.nuevoEstado);
      return ContentService.createTextOutput(JSON.stringify(res)).setMimeType(ContentService.MimeType.JSON);
    }
    return ContentService.createTextOutput(JSON.stringify({success: false, message: "Acción no válida"})).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({success: false, message: error.message})).setMimeType(ContentService.MimeType.JSON);
  }
}

// --- LOGICA ORIGINAL DE BASE DE DATOS ---

function sincronizarCRM() {
  try {
    var destino = SpreadsheetApp.getActiveSpreadsheet();
    var origenCRM = SpreadsheetApp.openById(ID_CRM_ORIGEN);
    HOJAS_A_IMPORTAR.forEach(function(nombreHoja) {
      var hojaOrigen = origenCRM.getSheetByName(nombreHoja);
      if (hojaOrigen) {
        var datos = hojaOrigen.getDataRange().getValues();
        var hojaDestino = destino.getSheetByName(nombreHoja);
        if (!hojaDestino) hojaDestino = destino.insertSheet(nombreHoja);
        hojaDestino.clearContents();
        if (datos.length > 0) hojaDestino.getRange(1, 1, datos.length, datos[0].length).setValues(datos);
      }
    });

    var origenKPI = SpreadsheetApp.openById(ID_KPI_ORIGEN);
    var hojaOrigenKPI = origenKPI.getSheetByName("KPI dCaC");
    if (hojaOrigenKPI) {
      var lastRowKPI = hojaOrigenKPI.getLastRow();
      if (lastRowKPI > 0) {
        var datosKPI = hojaOrigenKPI.getRange("N1:V" + lastRowKPI).getValues();
        var hojaDestinoKPI = destino.getSheetByName("KPI_dCaC");
        if (!hojaDestinoKPI) hojaDestinoKPI = destino.insertSheet("KPI_dCaC");
        hojaDestinoKPI.clearContents();
        hojaDestinoKPI.getRange(1, 1, datosKPI.length, datosKPI[0].length).setValues(datosKPI);
      }
    }
    return "Sincronización exitosa.";
  } catch (e) {
    console.error("Error: " + e.message);
    throw new Error("Fallo al sincronizar: " + e.message);
  }
}

function getSafeDate(value) {
  if (!value || value === "") return null;
  if (value instanceof Date) {
    if (isNaN(value.getTime())) return null;
    return value.getTime();
  }
  var str = String(value).trim();
  var p = str.split(/[\/\-\sT]/);
  if (p.length >= 3) {
    var anio, mes, dia;
    if (p[2].length >= 4) {
      dia = parseInt(p[0], 10); mes = parseInt(p[1], 10) - 1; anio = parseInt(p[2].substring(0,4), 10);
    } else if (p[0].length === 4) {
      anio = parseInt(p[0], 10); mes = parseInt(p[1], 10) - 1; dia = parseInt(p[2].substring(0,2), 10);
    }
    if (anio && !isNaN(mes) && !isNaN(dia)) return new Date(anio, mes, dia).getTime();
  }
  var parsed = Date.parse(str);
  return isNaN(parsed) ? null : parsed;
}

function getLeadsData(emailUsuario) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheetLeads = ss.getSheetByName("Leads");
    var sheetKPI = ss.getSheetByName("KPI_dCaC");
    var sheetAux = ss.getSheetByName("Aux Cambio Estado");

    if (!sheetLeads || !sheetKPI || !sheetAux) {
      sincronizarCRM();
      sheetLeads = ss.getSheetByName("Leads");
      sheetKPI = ss.getSheetByName("KPI_dCaC");
      sheetAux = ss.getSheetByName("Aux Cambio Estado");
    }

    var mapKPI = {};
    if (sheetKPI) {
      var dataKPI = sheetKPI.getDataRange().getValues();
      var headKPI = []; var startRow = 0;
      for(var r = 0; r < Math.min(10, dataKPI.length); r++) {
         var rowStrings = dataKPI[r].map(function(c){ return String(c).trim().toUpperCase(); });
         if (rowStrings.indexOf("CUIT") >= 0 && rowStrings.indexOf("Q TOTAL") >= 0) { headKPI = rowStrings; startRow = r; break; }
      }
      if (headKPI.length > 0) {
        var idxCuitKPI = headKPI.indexOf("CUIT"), idxQTotal = headKPI.indexOf("Q TOTAL"), idxKPIdcac = headKPI.indexOf("KPI DCAC"), idxCabOp = headKPI.indexOf("CAB OP");
        for (var k = startRow + 1; k < dataKPI.length; k++) {
          var rowK = dataKPI[k]; var rawCuitK = rowK[idxCuitKPI] ? String(rowK[idxCuitKPI]) : ""; var cuitK = rawCuitK.replace(/\D/g, '');
          if (cuitK) {
            var rawQ = String(rowK[idxQTotal] || "0").replace(/,/g, '').replace(/\./g, '');
            mapKPI[cuitK] = { qTotal: parseInt(rawQ, 10) || 0, kpiScore: idxKPIdcac >= 0 ? rowK[idxKPIdcac] : 0, cabOp: idxCabOp >= 0 ? rowK[idxCabOp] : 0 };
          }
        }
      }
    }

    var mapUltimoEstado = {};
    if (sheetAux) {
      var dataAux = sheetAux.getDataRange().getValues();
      if (dataAux.length > 1) {
        var headAux = dataAux[0].map(function(c){ return String(c).trim().toUpperCase(); });
        var idxLeadAux = headAux.indexOf("LEADID"), idxFechaAux = headAux.indexOf("FECHA");
        if (idxLeadAux >= 0 && idxFechaAux >= 0) {
          for (var a = 1; a < dataAux.length; a++) {
            var idAux = String(dataAux[a][idxLeadAux]).trim(); var tsAux = getSafeDate(dataAux[a][idxFechaAux]);
            if (idAux && tsAux) {
              if (!mapUltimoEstado[idAux] || tsAux > mapUltimoEstado[idAux]) mapUltimoEstado[idAux] = tsAux;
            }
          }
        }
      }
    }

    var lastRow = sheetLeads.getLastRow();
    if (lastRow <= 1) return { rol: "comercial", leads: [] };
    var headers = sheetLeads.getRange(1, 1, 1, sheetLeads.getLastColumn()).getValues()[0];
    var admins = ["sdewey@decampoacampo.com", "arivas@decampoacampo.com", "jsineriz@decampoacampo.com", "ptaffarel@decampoacampo.com", "jtonon@decampoacampo.com", "asegobia@decampoacampo.com", "lbortolin@decampoacampo.com"];

    var indices = {
      id: headers.indexOf("LeadID"), fechaAsig: headers.indexOf("Fecha de asignación"), fechaReasig: headers.indexOf("Fecha reasignacion"),
      cuit: headers.indexOf("CUIT Sociedad"), titulo: headers.indexOf("Título"), razonSocial: headers.indexOf("Razón Social"),
      ac: headers.indexOf("AC asignado"), provincia: headers.indexOf("Provincia Usuario"), partido: headers.indexOf("Partido Usuario"),
      telefono: headers.indexOf("Teléfono"), email: headers.indexOf("Email"), actividad: headers.indexOf("Actividad (1)"),
      estado: headers.indexOf("ESTADO"), comentario: headers.indexOf("Ult Coment AC"), fuente: headers.indexOf("Fuente")
    };

    var data = sheetLeads.getRange(1, 1, lastRow, headers.length).getValues();
    var leads = []; var emailFiltro = emailUsuario ? emailUsuario.toLowerCase().trim() : ""; var isAdmin = admins.indexOf(emailFiltro) !== -1;
    var mList = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      if ((indices.id >= 0 && !row[indices.id]) && (indices.titulo >= 0 && !row[indices.titulo])) continue;
      var acAsignado = (indices.ac >= 0 ? row[indices.ac] : "").toString();

      if (isAdmin || acAsignado.toLowerCase().trim() === emailFiltro) {
        var leadIdStr = (indices.id >= 0 ? row[indices.id] : "").toString().trim() || "0";
        var cleanCuit = (indices.cuit >= 0 ? row[indices.cuit] : "").toString().replace(/\D/g, '');
        var kpiData = mapKPI[cleanCuit] || { qTotal: 0, kpiScore: 0, cabOp: 0 };

        var tsAsigOriginal = indices.fechaAsig >= 0 ? getSafeDate(row[indices.fechaAsig]) : null;
        var tsReasig = indices.fechaReasig >= 0 ? getSafeDate(row[indices.fechaReasig]) : null;
        var tsAsigFinal = tsReasig ? tsReasig : tsAsigOriginal;
        var tsUltimoEstado = mapUltimoEstado[leadIdStr] ? mapUltimoEstado[leadIdStr] : tsAsigFinal;
        var dAsig = tsAsigFinal ? new Date(tsAsigFinal) : null;

        leads.push({
          id: leadIdStr, tsAsig: tsAsigFinal, tsUltimo: tsUltimoEstado,
          mesFiltro: dAsig ? mList[dAsig.getMonth()] : "", anioFiltro: dAsig ? dAsig.getFullYear().toString() : "", mesNum: dAsig ? dAsig.getMonth() + 1 : null,
          mesAnioSort: dAsig ? dAsig.getFullYear() * 100 + (dAsig.getMonth() + 1) : 0, cuit: (indices.cuit >= 0 ? row[indices.cuit] : "").toString() || "-",
          titulo: (indices.titulo >= 0 ? row[indices.titulo] : "").toString() || "Sin Título", razonSocial: (indices.razonSocial >= 0 ? row[indices.razonSocial] : "").toString() || "-",
          ac: acAsignado || "Sin Asignar", provincia: (indices.provincia >= 0 ? row[indices.provincia] : "").toString() || "S/D",
          partido: (indices.partido >= 0 ? row[indices.partido] : "").toString() || "S/D", telefono: (indices.telefono >= 0 ? row[indices.telefono] : "").toString() || "",
          email: (indices.email >= 0 ? row[indices.email] : "").toString() || "", actividad: (indices.actividad >= 0 ? row[indices.actividad] : "").toString() || "S/D",
          estado: (indices.estado >= 0 ? row[indices.estado] : "").toString() || "NUEVO", comentario: (indices.comentario >= 0 ? row[indices.comentario] : "").toString() || "",
          fuente: (indices.fuente >= 0 ? row[indices.fuente] : "").toString() || "-", qTotal: kpiData.qTotal, kpiScore: kpiData.kpiScore, cabOp: kpiData.cabOp
        });
      }
    }
    leads.sort(function(a, b) { return Number(a.id) - Number(b.id); });
    return { rol: isAdmin ? "admin" : "comercial", leads: leads };
  } catch (error) { throw new Error("Error leyendo el Excel: " + error.message); }
}

function actualizarEstadoBackend(leadId, nuevoEstado) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheetLeads = ss.getSheetByName("Leads");
    if (!sheetLeads) throw new Error("Hoja 'Leads' no encontrada");

    var data = sheetLeads.getDataRange().getValues();
    var headers = data[0].map(function(h) { return String(h).trim().toUpperCase(); });

    var idIndex = headers.indexOf("LEADID");
    var estadoIndex = headers.indexOf("ESTADO");
    if (idIndex === -1 || estadoIndex === -1) throw new Error("No se encontraron las columnas LeadID o ESTADO");

    for (var i = 1; i < data.length; i++) {
      if (String(data[i][idIndex]).trim() === String(leadId).trim()) {
        sheetLeads.getRange(i + 1, estadoIndex + 1).setValue(nuevoEstado);
        return { success: true, message: "Estado actualizado correctamente" };
      }
    }
    return { success: false, message: "Lead no encontrado en la base" };
  } catch (e) { return { success: false, message: e.message }; }
}
