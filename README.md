# ⚙️ Garage

Aplicación web colaborativa para gestión de proyectos de hardware y software.  
Accede en: **https://daniih03.github.io/garage**

## Stack

| Capa | Tecnología |
|------|-----------|
| Framework | React 18 + Vite 5 |
| Auth | Supabase Auth (GitHub OAuth) |
| Base de datos | Supabase Postgres + Realtime |
| Estilos | CSS puro (dark theme) |
| Deploy | GitHub Pages via GitHub Actions |

---

## Setup inicial (una sola vez)

### 1. Instalar dependencias

```bash
npm install
```

### 2. Configurar Supabase

Ejecuta el esquema SQL en el **SQL Editor** de tu proyecto Supabase:

```
supabase/schema.sql
```

### 3. Activar GitHub OAuth en Supabase

En tu dashboard de Supabase:

1. **Authentication → Providers → GitHub** → habilitar
2. Crea una GitHub OAuth App en https://github.com/settings/developers:
   - **Homepage URL**: `https://daniih03.github.io/garage`
   - **Authorization callback URL**: `https://<tu-ref>.supabase.co/auth/v1/callback`
3. Copia el `Client ID` y `Client Secret` a Supabase

### 4. Añadir Redirect URL

En Supabase → **Authentication → URL Configuration**:

- **Site URL**: `https://daniih03.github.io/garage`
- **Redirect URLs**: `https://daniih03.github.io/garage`

### 5. Añadir secrets en GitHub

En el repositorio → **Settings → Secrets and variables → Actions**:

| Secret | Valor |
|--------|-------|
| `VITE_SUPABASE_URL` | URL de tu proyecto Supabase |
| `VITE_SUPABASE_ANON_KEY` | Anon key de Supabase |

### 6. Habilitar GitHub Pages

En el repositorio → **Settings → Pages**:
- **Source**: `GitHub Actions`

---

## Desarrollo local

```bash
npm run dev
```

La app corre en `http://localhost:5173/garage/`

> Para login local, cambia temporalmente el `redirectTo` en `LoginPage.jsx` a `http://localhost:5173/garage`
> y añade esa URL a los Redirect URLs en Supabase.

## Build y deploy

```bash
npm run build    # genera dist/
```

El deploy se hace automáticamente al hacer push a `main` via GitHub Actions.

---

## Estructura

```
src/
├── App.jsx                       # Auth gate
├── lib/supabase.js               # Supabase client
├── styles/global.css             # Design system
└── components/
    ├── Auth/LoginPage.jsx        # GitHub OAuth login
    ├── Layout/Header.jsx         # Header con usuario
    └── Board/
        ├── Board.jsx             # Tablero principal + Realtime
        ├── Column.jsx            # Columna drag-and-drop
        ├── Card.jsx              # Tarjeta arrastrable
        └── CardModal.jsx         # Modal crear/editar
```
