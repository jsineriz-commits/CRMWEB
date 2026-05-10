# CRM Web - De Campo a Campo

CRM Comercial para gestión de leads, deployado en Vercel y conectado a Google Sheets vía Apps Script API.

## Estructura

```
CRMWEB/
├── index.html      # Frontend (estructura HTML)
├── styles.css      # Estilos CSS
├── app.js          # Lógica JavaScript
└── Code.gs         # Backend API en Google Apps Script (no va a Vercel)
```

## Setup

### 1. Configurar la API en Google Apps Script

1. Pegá el contenido de `Code.gs` en tu proyecto de Google Apps Script
2. **Implementar** → **Nueva Implementación** → Tipo: **Aplicación Web**
3. Ejecutar como: **"Yo (tu correo)"**
4. Quién tiene acceso: **"Cualquier persona"**
5. Hacé clic en **Implementar** y copiá la URL generada

### 2. Conectar Vercel con Google

Abrí `app.js` y reemplazá en la línea 3:
```js
const GAS_API_URL = "https://script.google.com/macros/s/SU_ID_AQUI/exec";
```
por la URL real de tu implementación.

### 3. Deploy en Vercel

1. Subí `index.html`, `styles.css` y `app.js` a este repositorio
2. En Vercel → **Add New Project** → seleccioná este repo → **Deploy**

> ⚠️ `Code.gs` es solo para referencia. No se despliega en Vercel.

## Usuarios Admin

Los siguientes emails tienen acceso como administrador (vista completa + ranking):
- sdewey@decampoacampo.com
- arivas@decampoacampo.com
- jsineriz@decampoacampo.com
- ptaffarel@decampoacampo.com
- jtonon@decampoacampo.com
- asegobia@decampoacampo.com
- lbortolin@decampoacampo.com
