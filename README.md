# Recursividad OneDrive - API para n8n

Aplicación TypeScript con arquitectura DDD que obtiene todos los archivos de una carpeta de OneDrive de forma recursiva y los retorna en el formato que n8n espera.

## 🏗️ Arquitectura

La aplicación sigue los principios de Domain-Driven Design (DDD) con las siguientes capas:

```
src/
├── domain/              # Capa de dominio
│   ├── entities/        # Entidades del dominio (File, Folder)
│   ├── repositories/    # Interfaces de repositorios
│   └── services/        # Servicios de dominio
├── infrastructure/      # Capa de infraestructura
│   ├── clients/        # Cliente Microsoft Graph API
│   └── repositories/    # Implementación de repositorios
├── application/         # Capa de aplicación
│   └── use-cases/       # Casos de uso
└── presentation/        # Capa de presentación
    ├── controllers/     # Controladores
    └── routes/          # Rutas de Express
```

## 🚀 Instalación

```bash
npm install
```

## 🔨 Compilación

```bash
npm run build
```

## ▶️ Ejecución

### Modo desarrollo (con hot reload)
```bash
npm run dev
```

### Modo producción
```bash
npm start
```

## 📡 Endpoints

### POST `/get-files`
Obtiene todos los archivos recursivamente desde el body de la petición.

**Body (JSON):**
```json
{
  "folderId": "tu-folder-id-aqui",
  "accessToken": "tu-access-token-aqui"  // Opcional si tienes credenciales en .env
}
```

**Nota**: Si tienes `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET` y `MICROSOFT_TENANT_ID` en tu archivo `.env`, puedes omitir el `accessToken` y la aplicación lo obtendrá automáticamente.

**Respuesta:**
```json
[
  {
    "json": {
      "id": "file-id-1",
      "name": "archivo1.pdf",
      "mimeType": "application/pdf",
      "size": 12345,
      "webUrl": "https://...",
      "downloadUrl": "https://...",
      "createdDateTime": "2024-01-01T00:00:00Z",
      "lastModifiedDateTime": "2024-01-01T00:00:00Z",
      "parentReference": {
        "id": "parent-folder-id",
        "name": "Carpeta Padre",
        "path": "/drive/root:/Carpeta Padre"
      }
    }
  }
]
```

### POST `/get-files-header`
Obtiene todos los archivos recursivamente usando el token en el header.

**Headers:**
```
Authorization: Bearer tu-access-token-aqui  // Opcional si tienes credenciales en .env
```

**Body (JSON):**
```json
{
  "folderId": "tu-folder-id-aqui"
}
```

**Nota**: Si tienes credenciales configuradas en `.env`, puedes omitir el header `Authorization` y la aplicación obtendrá el token automáticamente.

### GET `/health`
Health check del servidor.

## 🔌 Uso desde n8n

### Opción 1: HTTP Request Node (con credenciales en .env)

Si configuraste las credenciales en `.env`, solo necesitas pasar el `folderId`:

1. Agrega un nodo **HTTP Request** en tu flujo de n8n
2. Configura:
   - **Method**: `POST`
   - **URL**: `http://localhost:3000/get-files` (o la URL donde esté desplegado)
   - **Body Content Type**: `JSON`
   - **Body**:
     ```json
     {
       "folderId": "{{ $json.folderId }}"
     }
     ```

### Opción 1b: HTTP Request Node (con accessToken en body)

Si prefieres pasar el token en cada petición:

1. Agrega un nodo **HTTP Request** en tu flujo de n8n
2. Configura:
   - **Method**: `POST`
   - **URL**: `http://localhost:3000/get-files` (o la URL donde esté desplegado)
   - **Body Content Type**: `JSON`
   - **Body**:
     ```json
     {
       "folderId": "{{ $json.folderId }}",
       "accessToken": "{{ $json.accessToken }}"
     }
     ```

### Opción 2: Con token en header

1. Agrega un nodo **HTTP Request** en tu flujo de n8n
2. Configura:
   - **Method**: `POST`
   - **URL**: `http://localhost:3000/get-files-header`
   - **Headers**:
     - `Authorization`: `Bearer {{ $json.accessToken }}`
   - **Body Content Type**: `JSON`
   - **Body**:
     ```json
     {
       "folderId": "{{ $json.folderId }}"
     }
     ```

## 🔑 Configuración de Credenciales de Microsoft

⚠️ **IMPORTANTE**: Hay dos tipos de autenticación y debes elegir la correcta según tu caso:

### Tipo 1: Application Permissions (Client Credentials)
- **Usa**: Credenciales en `.env` (MICROSOFT_CLIENT_ID, etc.)
- **Funciona para**: Recursos compartidos de la organización
- **NO funciona para**: Carpetas personales de usuarios específicos
- **Error común**: "interaction_required" o "AADSTS160021" cuando intentas acceder a carpetas de usuarios

### Tipo 2: Delegated Permissions (OAuth2 con usuario) ⭐ RECOMENDADO
- **Usa**: Access token obtenido desde n8n (nodo Microsoft OAuth2)
- **Funciona para**: Carpetas personales de usuarios específicos
- **Cómo obtenerlo**: Desde n8n, usa el nodo "Microsoft" > "OAuth2 API" y autentícate con la cuenta que tiene la carpeta
- **Esta es la solución** si tienes el error "interaction_required" en Azure Portal

---

### Opción 1: Usar Token Delegado desde n8n (Recomendado para carpetas de usuarios)

Esta es la opción más simple y funciona para acceder a carpetas de usuarios específicos:

1. **En n8n, obtén el access token**:
   - Agrega un nodo **Microsoft** > **OAuth2 API**
   - Configura la conexión OAuth2 con tu cuenta de Microsoft
   - Autentícate con la cuenta que tiene la carpeta que quieres acceder
   - El nodo te dará un `accessToken` en la salida

2. **Pasa el token a esta API**:
   - En tu flujo de n8n, después del nodo Microsoft, agrega un nodo **HTTP Request**
   - URL: `http://localhost:3000/get-files`
   - Body:
     ```json
     {
       "folderId": "{{ $json.folderId }}",
       "accessToken": "{{ $json.accessToken }}"
     }
     ```

**Ventajas**:
- ✅ Funciona para carpetas personales de usuarios
- ✅ No necesitas configurar nada en `.env`
- ✅ No tienes problemas con "interaction_required"
- ✅ Es exactamente como lo haces en n8n normalmente

### Opción 2: Credenciales en archivo `.env` (Solo para recursos compartidos)

La aplicación puede obtener automáticamente el access token usando credenciales de Azure.

⚠️ **LIMITACIÓN**: Esta opción solo funciona para acceder a recursos compartidos de la organización. **NO funciona para acceder a carpetas personales de usuarios específicos**. Si necesitas acceder a carpetas de usuarios, usa la Opción 1 (tokens delegados desde n8n).

#### Pasos para obtener las credenciales:

1. **Ir a Azure Portal**
   - Ve a https://portal.azure.com
   - Inicia sesión con tu cuenta de Microsoft

2. **Crear App Registration**
   - Busca "Azure Active Directory" o "Microsoft Entra ID"
   - Ve a **App registrations** > **New registration**
   - Nombre: `OneDrive Recursive API` (o el que prefieras)
   - Supported account types: Selecciona según tus necesidades
   - Redirect URI: No es necesario para este caso
   - Click en **Register**

3. **Obtener Client ID y Tenant ID**
   - En la página de Overview de tu aplicación, copia:
     - **Application (client) ID** → Este es tu `MICROSOFT_CLIENT_ID`
     - **Directory (tenant) ID** → Este es tu `MICROSOFT_TENANT_ID`

4. **Crear Client Secret**
   - Ve a **Certificates & secrets** en el menú lateral
   - Click en **New client secret**
   - Description: `API Secret` (o el que prefieras)
   - Expires: Selecciona la duración (recomendado: 24 meses)
   - Click en **Add**
   - ⚠️ **IMPORTANTE**: Copia el **Value** del secret inmediatamente (solo se muestra una vez)
     - Este es tu `MICROSOFT_CLIENT_SECRET`

5. **Configurar Permisos de API**
   - Ve a **API permissions** en el menú lateral
   - Click en **Add a permission**
   - Selecciona **Microsoft Graph**
   - Selecciona **Application permissions** (no Delegated)
   - Busca y agrega:
     - `Files.Read.All` (para leer archivos)
     - `Sites.Read.All` (si necesitas acceso a SharePoint)
   - Click en **Add permissions**
   - ⚠️ **IMPORTANTE**: Click en **Grant admin consent** para tu organización
     - Sin esto, los permisos no funcionarán

6. **Configurar el archivo `.env`**
   ```env
   PORT=3000
   MICROSOFT_CLIENT_ID=tu-client-id-aqui
   MICROSOFT_CLIENT_SECRET=tu-client-secret-aqui
   MICROSOFT_TENANT_ID=tu-tenant-id-aqui
   ```

Con esto configurado, la aplicación obtendrá automáticamente el access token y no necesitarás pasarlo en cada petición.

### Opción 2: Pasar Access Token en cada petición

Si prefieres no configurar credenciales en `.env`, puedes pasar el `accessToken` en cada petición:

- En el **body** del request (endpoint `/get-files`)
- En el **header Authorization** (endpoint `/get-files-header`)

Para obtener un access token manualmente:

1. **n8n Microsoft OAuth2**: Usar el nodo de Microsoft en n8n para autenticarte
2. **Microsoft Graph Explorer**: https://developer.microsoft.com/graph/graph-explorer
3. **Azure Portal**: Usar la sección "Test" de tu App Registration

## 📋 Formato de respuesta compatible con n8n

La respuesta está formateada exactamente como n8n espera del nodo "Get Items in Folder":

- Cada item está envuelto en un objeto con la propiedad `json`
- Los campos incluyen: `id`, `name`, `mimeType`, `size`, `webUrl`, `downloadUrl`, `createdDateTime`, `lastModifiedDateTime`, `parentReference`

## 🛠️ Tecnologías

- **TypeScript**: Lenguaje principal
- **Express**: Framework web
- **Axios**: Cliente HTTP para Microsoft Graph API
- **ES Modules**: Sistema de módulos moderno

## 📝 Variables de entorno

Crea un archivo `.env` en la raíz del proyecto (puedes usar `.env.example` como referencia):

```env
PORT=3000

# Credenciales de Microsoft Azure (Opcional)
# Si las configuras, la app obtendrá automáticamente el access token
# Si no, debes pasar accessToken en cada petición
MICROSOFT_CLIENT_ID=tu-client-id-aqui
MICROSOFT_CLIENT_SECRET=tu-client-secret-aqui
MICROSOFT_TENANT_ID=tu-tenant-id-aqui
```

**Nota**: Si configuras las credenciales de Microsoft en `.env`, la aplicación las usará automáticamente y no necesitarás pasar el `accessToken` en cada petición. Si no las configuras, puedes pasar el `accessToken` en el body de la petición o como header.

## 🧪 Desarrollo

```bash
# Verificar tipos sin compilar
npm run type-check

# Compilar
npm run build

# Ejecutar en modo desarrollo
npm run dev
```
