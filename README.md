# CRM Web - De Campo a Campo

CRM Comercial deployado 100% en Vercel, con backend serverless que se conecta directo a Google Sheets via Service Account.

## Arquitectura

```
CRMWEB/
├── index.html          # Frontend (login + dashboard)
├── styles.css          # Estilos CSS
├── app.js              # Lógica JavaScript del frontend
├── vercel.json         # Configuración Vercel
└── api/
    ├── _lib/
    │   └── sheets.js   # Cliente Google Sheets API
    ├── leads.js        # GET /api/leads?email=...
    └── update.js       # POST /api/update
```

## Variables de entorno en Vercel

Configurar en Vercel → Settings → Environment Variables:

| Variable | Descripción |
|---|---|
| `GOOGLE_SERVICE_ACCOUNT_KEY` | JSON completo de la Service Account |
| `CRM_SPREADSHEET_ID` | ID del spreadsheet CRM (Leads, Aux Cambio Estado) |
| `KPI_SPREADSHEET_ID` | ID del spreadsheet KPI (KPI dCaC) |

## Setup Service Account

1. Ir a [Google Cloud Console](https://console.cloud.google.com)
2. Crear proyecto → Habilitar **Google Sheets API**
3. **IAM & Admin → Service Accounts → Crear**
4. Descargar el JSON de credenciales
5. Compartir los dos Spreadsheets con el email de la Service Account (rol: Editor)
6. Pegar el JSON completo en la variable `GOOGLE_SERVICE_ACCOUNT_KEY`

## Deploy

1. Conectar repo en Vercel → Deploy
2. Configurar las 3 variables de entorno
3. Redeploy
