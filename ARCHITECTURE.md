# ARCHITECTURE.md — Garage App

> **Propósito de este documento:** Proporcionar la única fuente de verdad y contexto completo del proyecto para que cualquier nueva sesión de desarrollo (Antigravity AI u otro desarrollador) pueda entender al 100% el estado exacto de la aplicación en ese momento y continuar el trabajo sin pérdida de contexto.

---

## 1. Regla Mandatoria de Contexto y Actualización (CRÍTICA — Respetar en Cada Sesión)

> 🧠 **Para el Asistente AI / Desarrollador:**
> Al leer este documento al inicio de una conversación o sesión, debes asumir y comprender el estado completo del proyecto aquí descrito.
> **Cada vez que se añada, modifique o elimine cualquier funcionalidad, componente, lógica de negocio, estilo o regla en la aplicación:**
> 1. **Integrar al contexto global:** No limitarse a añadir una fila en la tabla de historial; se deben actualizar las secciones correspondientes de este documento (**Sección 4: Estructura de archivos**, **Sección 5: Base de datos**, **Sección 6: Lógica de negocio clave**, **Sección 7: Componentes y responsabilidades**, **Sección 8: CSS y diseño**).
> 2. **Garantizar continuidad:** El documento debe quedar siempre redactado de modo que la siguiente sesión que lo lea entienda exactamente cómo funciona la aplicación tal cual está en ese instante, sin requerir inferencias ni revisar el historial de commits.
> 3. **Actualizar antes del push:** Toda modificación del código debe ir acompañada de su respectiva actualización en `ARCHITECTURE.md` en el mismo commit o antes de solicitar el push.

---

## 2. Visión General del Proyecto

**Garage** es una herramienta de gestión de proyectos estilo Kanban, orientada a equipos de desarrollo de hardware/software. Está construida como SPA (Single Page App) con React + Vite, backend en Supabase (PostgreSQL + Realtime + Auth) y desplegada en GitHub Pages.

- **URL producción:** https://daniih03.github.io/garage
- **Repo GitHub:** https://github.com/daniih03/garage (rama: `main`)
- **Supabase Project URL:** https://onucbhqanztyzaokadcj.supabase.co
- **Stack:** React 18, Vite, Supabase JS v2, GitHub OAuth, CSS puro (sin frameworks CSS)
- **Despliegue:** GitHub Actions → GitHub Pages automático en cada push a `main`

---

## 3. Regla de Push (CRÍTICA — Respetar Siempre)

> El usuario **siempre** quiere ser consultado antes del push.  
> **Nunca ejecutar `git push` sin preguntar primero y recibir confirmación explícita.**

Protocolo:
1. Terminar implementación y hacer `npm run build` para verificar
2. Decir: `"Ya está todo listo para hacer push, ¿lo hago?"`
3. Esperar que el usuario responda `"push"` (o equivalente) antes de ejecutar

---

## 4. Stack Técnico

| Capa | Tecnología |
|---|---|
| Frontend framework | React 18 + Vite 5 |
| Lenguaje | JavaScript (JSX) — sin TypeScript |
| Estilos | CSS puro (`src/styles/global.css`) — sin Tailwind ni CSS Modules |
| Backend / DB | Supabase (PostgreSQL, Auth, Realtime, RLS) |
| Autenticación | GitHub OAuth via Supabase |
| Despliegue | GitHub Pages (`gh-pages` package) |
| Variables de entorno | `.env` (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY) |

---

## 5. Estructura de Archivos

```
garage/
├── public/
│   ├── build-meta.json          # Timestamp del build (auto-generado)
│   └── logos/                   # Logos de la app
├── src/
│   ├── App.jsx                  # Raíz: gestión de sesión, routing entre vistas
│   ├── main.jsx                 # Entry point React
│   ├── lib/
│   │   ├── supabase.js          # Cliente Supabase singleton
│   │   ├── github.js            # Helpers: fetchUserRepos, fetchRepoCollaboratorsDetails, provider token storage
│   │   └── csvExportImport.js   # Helpers: escapeCSV, parseCSV, generateProjectCSV, parseProjectCSV, downloadCSV
│   ├── styles/
│   │   └── global.css           # TODOS los estilos (~3500+ líneas, temática oscura)
│   └── components/
│       ├── Auth/
│       │   └── LoginPage.jsx    # Pantalla de login con GitHub OAuth
│       ├── Layout/
│       │   └── Header.jsx       # Cabecera global con logo y navegación
│       ├── Home/
│       │   ├── HomePage.jsx     # Vista principal: lista de proyectos + notificaciones de invitación
│       │   ├── ProjectCard.jsx  # Tarjeta de proyecto con progress ring y métricas
│       │   ├── AddProjectModal.jsx    # Modal para añadir nuevo proyecto desde GitHub
│       │   └── EditProjectModal.jsx   # Modal para editar proyecto existente
│       ├── Project/
│       │   ├── ProjectView.jsx  # Vista de proyecto: barra de miembros, hitos, export/import CSV, tablero Kanban
│       │   ├── MilestoneBar.jsx # Barra de selección de hitos con progreso
│       │   ├── MilestoneModal.jsx     # Modal crear/editar hito
│       │   ├── InviteModal.jsx  # Modal invitar colaborador con autocompletado en tiempo real
│       │   └── ImportProjectModal.jsx # Modal importar hitos y tarjetas desde CSV
│       ├── Board/
│       │   ├── Board.jsx        # Tablero Kanban: columnas, filtros visuales, botón nueva tarjeta, drag & drop, realtime
│       │   ├── Column.jsx       # Columna del Kanban (To do / Doing / Blocked / Done)
│       │   ├── Card.jsx         # Tarjeta individual con badges, menciones @, indicador comentarios, fecha creación
│       │   └── CardModal.jsx    # Modal crear/editar tarjeta con menciones, estado obligatorio, comparativa paralela, comentarios
│       ├── Common/
│       │   ├── ConfirmModal.jsx      # Modal de confirmación genérico simple
│       │   └── DangerConfirmModal.jsx # Modal de confirmación peligrosa (requiere escribir CONFIRM)
│       └── Shared/              # Componentes compartidos (actualmente vacío)
├── supabase/
│   ├── schema.sql               # Schema completo de Supabase con tablas, RLS y funciones
│   └── migration_add_leave_kick_policy.sql  # Migración: política DELETE en project_members
└── vite.config.js               # Config Vite con base: '/garage/'
```

---

## 6. Base de Datos Supabase

### Tablas

#### `profiles`
Creada automáticamente al hacer login via trigger `on_auth_user_created`.
| Columna | Tipo | Descripción |
|---|---|---|
| `id` | uuid PK | = `auth.users.id` |
| `github_username` | text UNIQUE | Username de GitHub (en minúsculas) |
| `avatar_url` | text | URL del avatar de GitHub |
| `created_at` | timestamptz | Fecha de registro |

**RLS:** `SELECT` abierto a cualquier usuario autenticado.

#### `projects`
| Columna | Tipo | Descripción |
|---|---|---|
| `id` | uuid PK | |
| `repo_full_name` | text UNIQUE | `owner/repo` (ej: `daniih03/garage`) |
| `repo_name` | text | Nombre del repo (ej: `garage`) |
| `repo_url` | text | URL del repo en GitHub |
| `repo_acronym` | text | Acrónimo para IDs de tarjetas (ej: `GRGTL`) |
| `description` | text | Descripción personalizada |
| `github_collaborators` | text[] | Lista de usernames de colaboradores de GitHub |
| `created_by` | uuid | FK → `auth.users.id` |
| `created_at` | timestamptz | |

**RLS:** Solo miembros en `project_members` pueden hacer cualquier operación.

#### `project_members`
| Columna | Tipo | Descripción |
|---|---|---|
| `project_id` | uuid PK | FK → `projects.id` |
| `user_id` | uuid PK | FK → `auth.users.id` |
| `added_by` | uuid | FK → `auth.users.id` (quién invitó) |
| `added_at` | timestamptz | Fecha de incorporación |

**RLS:**
- `SELECT`: Solo ver tu propio row (`user_id = auth.uid()`)
- `INSERT`: Solo si ya eres miembro del proyecto
- `DELETE`: Si eres tú mismo (salir) O si eres el creador del proyecto (expulsar)

> ⚠️ La política DELETE `"Salir o expulsar miembros"` se añadió como migración y debe ejecutarse en el SQL Editor de Supabase si no está aplicada.

#### `milestones`
| Columna | Tipo | Descripción |
|---|---|---|
| `id` | uuid PK | |
| `project_id` | uuid | FK → `projects.id` |
| `number` | integer | Número secuencial (renumerados al borrar) |
| `title` | text | Nombre del hito |
| `created_at` | timestamptz | |

**UNIQUE:** `(project_id, number)`

#### `cards`
| Columna | Tipo | Descripción |
|---|---|---|
| `id` | uuid PK | |
| `project_id` | uuid | FK → `projects.id` |
| `milestone_id` | uuid | FK → `milestones.id` |
| `card_number` | integer | Número secuencial dentro del hito |
| `display_id` | text | ID visual: `ACRONIMO-MS-NNN` (ej: `GRGTL-01-003`) |
| `title` | text | Título de la tarjeta |
| `description` | text | Descripción con soporte para menciones `@DISPLAY_ID` |
| `status` | text | `todo`, `doing`, `blocked`, `done` |
| `primary_type` | text | `HW` o `SW` |
| `secondary_type` | text | `task`, `bug`, `spike`, `stock` |
| `priority` | text | `low`, `mid`, `high`, `critical` |
| `position` | integer | Orden dentro de la columna |
| `created_by` | uuid | FK → `auth.users.id` |

**UNIQUE:** `(project_id, milestone_id, card_number)`

#### `card_comments`
| Columna | Tipo | Descripción |
|---|---|---|
| `id` | uuid PK | |
| `card_id` | uuid | FK → `cards.id` |
| `content` | text | Contenido del comentario |
| `created_by` | uuid | FK → `auth.users.id` |
| `created_at` | timestamptz | |

### Funciones RPC Supabase

- **`sync_user_projects(user_repos text[], github_user text)`**: Sincroniza automáticamente al usuario con proyectos donde esté como colaborador GitHub. Se llama en cada carga de `HomePage`.
- **`handle_new_user()`** (trigger): Crea el perfil automáticamente al registrarse.
- **`auto_add_known_collaborators()`** (trigger): Al crear un proyecto, auto-añade al creador y a los colaboradores GitHub conocidos.

### Realtime
Todos los canales suscritos usan `postgres_changes`:
- `home-projects` → `projects` + `project_members`
- `milestones-{projectId}` → `milestones`
- `members-{projectId}` → `project_members`
- `board-{projectId}-{milestoneId}` → `cards` + `card_comments`

---

## 7. Lógica de Negocio Clave

### IDs de Tarjetas
Formato: `ACRONIMO-MS-NNN`
- `ACRONIMO`: `repo_acronym` del proyecto (ej: `GRGTL`)
- `MS`: número de hito con 2 dígitos (ej: `01`, `02`)
- `NNN`: número de tarjeta con 3 dígitos (ej: `001`, `023`)
- Ejemplo completo: `GRGTL-01-023`
- Auto-migración de IDs legados de 1 dígito de hito al formato de 2 dígitos en `fetchCards()`

### Sistema de Comentarios No Leídos
- **localStorage key:** `garage_viewed_comments_{userId}` → objeto `{ [cardId]: ISO_timestamp }`
- Una tarjeta muestra el icono de comentario **rojo** (relleno) si hay comentarios de **otro usuario** (`created_by !== currentUser.id`) cuyo `created_at` > `lastViewedAt`
- Al abrir una tarjeta → se actualiza `viewedMap[cardId]` con timestamp actual
- Al escribir un comentario → se llama `onCardViewed(card.id)` en `CardModal` para actualizar inmediatamente
- `fetchCards()` en `Board.jsx` recupera el usuario con `supabase.auth.getUser()` de forma síncrona (evita race condition de estado `currentUser` aún no inicializado)
- `commentsMeta[cardId]` contiene: `{ count, latestAt, latestOtherCommentAt }`

### Sistema de Invitaciones de Proyecto
Las invitaciones **no son una tabla separada**; se detectan desde `project_members`:
- Si `added_by !== user.id` AND `!isCreator` AND no está en `garage_accepted_invites_{userId}` → aparece como invitación pendiente
- **Aceptar:** Añade al array `garage_accepted_invites_{userId}` en localStorage, mueve al listado activo
- **Denegar:** Añade al array `garage_declined_invites_{userId}` en localStorage Y borra el row de `project_members` en DB
- Si se limpia localStorage, las invitaciones aceptadas/rechazadas vuelven a aparecer como pendientes

> ⚠️ **Gotcha conocido:** Si el usuario fue añadido por auto-sync (`sync_user_projects`) con `added_by = created_by`, el proyecto se considera "activo" directamente, no como invitación pendiente.

### Menciones de Tarjetas (`@DISPLAY_ID`)
- En título y descripción de `CardModal`, escribir `@` despliega un autocomplete con las tarjetas del mismo hito (excluyendo la tarjeta actual)
- Regex de detección: `/@([A-Z0-9]+-\d{2}-\d{3})/g`
- Al seleccionar una mención, se activa la vista de **comparativa paralela**: el modal se divide en 2 columnas (la tarjeta editada a la izquierda, la referenciada a la derecha)
- Con múltiples referencias, se navega entre ellas con los botones `@DISPLAY_ID` en la barra de cambio
- `milestoneCards` (prop en `CardModal`) limita las menciones al hito actual

### Drag & Drop del Kanban
- HTML5 nativo con `draggable`, `onDragStart`, `onDrop`
- Al soltar en una columna diferente: actualiza `status` y `position` en Supabase
- La columna `doing` acepta tanto `doing` como `inprogress` (alias legacy)
- Las tarjetas se ordenan por prioridad: `critical > high > mid > low`

### Ordenación de Tarjetas en Tablero
- Prioridad principal: `critical > high > mid > low`
- **Desempate por tags idénticos:** Si dos tarjetas coinciden en todos sus tags (`priority`, `primary_type` y `secondary_type`), se ordena de forma cronológica por antigüedad de creación (`created_at` más antiguo primero, arriba)
- En caso contrario, se preserva el orden por posición manual (`position`)

### Exportación e Importación de Proyectos (CSV)
- **Exportar:** Botón en `ProjectView.jsx` que genera un archivo `.csv` (RFC 4180 con BOM UTF-8 `\uFEFF` para Excel) incluyendo metadatos del proyecto y todas sus tarjetas e hitos con estados, tags, posiciones y fechas de creación.
- **Importar:** Lee el archivo `.csv`, muestra una vista previa con el conteo de hitos/tarjetas y los inserta correlativamente en Supabase (respetando la numeración secuencial y calculando IDs).

---

## 8. Componentes Clave — Responsabilidades

### `App.jsx`
- Estado global: `session`, `view` (`'home'` | `'project'`), `activeProject`, `activeMilestone`
- Gestión de sesión y token de GitHub
- Auto-logout en nuevos deploys

### `HomePage.jsx`
- Carga proyectos activos + detección de invitaciones pendientes
- Caja de notificación de invitaciones (acepar/denegar)
- Invoca `sync_user_projects` RPC al montar
- Realtime en `projects` y `project_members`

### `ProjectView.jsx`
- Barra de miembros: avatares con botón de expulsión (✕ visible al hover, solo para el dueño), indicador propio (borde azul), contador
- Botón "Salir" del proyecto (solo para no-dueños)
- Gestión de hitos: CRUD completo con renumeración secuencial
- Exportación del proyecto completo a archivo `.csv` (con metadatos, hitos y tarjetas)
- Modales: Invitar, Importar Proyecto (CSV), Editar Proyecto, Eliminar Proyecto, Expulsar Miembro, Salir del Proyecto

### `Board.jsx`
- Estado: `cards`, `allProjectCards`, `commentsMeta`, `viewedMap`, `currentUser`, filtros
- Barra de filtros: primary (single select), secondary (multi), priority (multi) — con visual pills
- Botón genérico "Nueva tarjeta" que abre el modal con estado vacío
- Ordenación con desempate por antigüedad ante tarjetas con tags coincidentes
- `fetchCards()`: recupera tarjetas + comentarios meta con `activeUser` obtenido síncronamente
- `handleRealtimeChange()`: INSERT deduplicado, UPDATE, DELETE
- Pasa `onCardViewed` a `CardModal` para actualizar el mapa de visualización

### `CardModal.jsx`
- Formulario completo de creación/edición de tarjeta
- Campo Estado desmarcado por defecto en creación y validado como obligatorio
- Sistema de menciones `@` con dropdown contextual
- Vista de comparativa paralela (modal se ensancha con CSS `modal--parallel`)
- Switcher de tarjetas referenciadas: botones clickables por `@DISPLAY_ID`
- Sección de comentarios con realtime, delete, y actualización de `viewedMap` al escribir
- `currentUser` obtenido desde Supabase Auth directamente

### `Card.jsx`
- Tarjeta Kanban con drag & drop nativo
- Badges: `primary_type` | `secondary_type` | `priority` | comentario (rojo relleno = sin leer, contorno = leído)
- Fecha de creación mostrada en el pie de la tarjeta con formato localizado y tooltip
- `renderTextWithMentions()`: resalta `@DISPLAY_ID` con `.card-mention-badge`

### `InviteModal.jsx`
- Autocompletado en tiempo real (debounce 180ms) contra tabla `profiles` (ilike)
- Excluye al usuario actual y muestra "Ya es miembro" si ya pertenece al proyecto
- Bloquea el INSERT si el usuario ya es miembro (doble check: en UI y antes del DB call)
- Maneja race condition con código de error `23505` (unique constraint)

---

## 9. CSS y Diseño

- **Un solo fichero:** `src/styles/global.css` (~3500+ líneas)
- **Temática:** Dark mode exclusivo, inspirado en herramientas de comando
- **Variables CSS clave:**
  - `--bg-primary`, `--bg-secondary`, `--bg-panel`, `--bg-card`, `--bg-input`
  - `--text-primary`, `--text-secondary`, `--text-muted`
  - `--accent` (azul #38BDF8), `--accent-subtle`
  - `--border`, `--border-subtle`
  - `--danger` (rojo), `--success` (verde)
  - `--radius`, `--radius-sm`, `--radius-md`, `--radius-lg`
  - `--font-mono` (JetBrains Mono)
  - `--transition`, `--ease-out`
- **Mobile:** `@media (max-width: 768px)` al final del fichero. El Kanban se convierte en carrusel horizontal swipeable. Nunca tocar estilos desktop al hacer cambios mobile.
- **Clases de badges:**
  - Primary: `.badge-primary--hw` / `.badge-primary--sw`
  - Secondary: `.badge-secondary--task/bug/spike/stock`
  - Priority: `.badge-priority--critical/high/mid/low`
- **Comentario indicator:** `.card-comment-indicator--unread` (rojo #EF4444) / `--read` (contorno)
- **Botón de peligro:** `.btn--danger` (fondo rojo semitransparente)

---

## 10. Convenciones y Patrones

- **Sin Router:** La navegación es por estado de React (`view` en `App.jsx`)
- **Sin Redux / Zustand:** Estado local con `useState` y paso de props/callbacks
- **Supabase Realtime:** Canal por componente, cleanup en `useEffect` return
- **Portales:** Los modales usan `createPortal` hacia `document.body`
- **Fechas:** Siempre ISO string (`new Date().toISOString()`)
- **Deduplicación:** Al recibir eventos INSERT de Realtime, siempre comprobar si el ID ya existe en el array local
- **IDs de tarjetas:** Siempre formato 2 dígitos para el hito: `String(milestoneNum).padStart(2, '0')`

---

## 11. Usuarios y Colaboradores Conocidos

| GitHub Username | Rol |
|---|---|
| `daniih03` | Dueño principal / desarrollador |
| `yemii1` | Colaborador |

**Proyecto de prueba en Supabase:**
- `Garage Tool` → `project_id: 8c7243f1-83f1-48be-b572-509c36dda343`
- `daniih03` UUID: `6edc3930-1c0a-436c-a70c-824ad620315f`
- `yemii1` UUID: `d4f28b28-8c93-47f2-ab75-e285bb10f464`

---

## 12. Migraciones Pendientes de Supabase

Las siguientes queries deben haberse ejecutado en el SQL Editor de Supabase (además del `schema.sql` base):

```sql
-- Política para salir del proyecto (yo mismo) o expulsar miembros (solo el creador del proyecto)
CREATE POLICY "Salir o expulsar miembros" ON project_members
  FOR DELETE USING (
    user_id = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = project_members.project_id
        AND p.created_by = auth.uid()
    )
  );
```

> El archivo `supabase/migration_add_leave_kick_policy.sql` contiene esta migración.

---

## 13. Funcionalidades Implementadas (Historial)

| Fase | Funcionalidad | Commit |
|---|---|---|
| Base | Auth GitHub, Kanban CRUD básico | — |
| 1 | Modal de confirmación de peligro con verificación CONFIRM | `e2e870b` |
| 2 | Edición de proyectos y campos obligatorios en tarjetas | `b38bb15` |
| 3 | Ordenación por prioridad y filtros por tipo/prioridad | `b38bb15..c863ce0` |
| 4 | Filter pills visuales | `113c7db..cf69d7e` |
| 5 | Renumeración secuencial de hitos/tarjetas al borrar | `cf69d7e` |
| 6 | Logo Command, header permanente | `f5de4b2` |
| 7 | IDs de 2 dígitos para hitos + auto-migración | `923328c` |
| 8 | Avatares de colaboradores con links GitHub | `d37fd97` |
| 9 | Mobile responsive + swipe Kanban | `558c1e2..2bc1854` |
| 10 | ProjectCard con progress ring y métricas | `51729cb..fdd26ab` |
| 11 | Botón Refrescar en proyecto | `8f1a59c` |
| 12 | Menciones `@DISPLAY_ID` con comparativa paralela | `8f1a59c` |
| 13 | Indicador de comentarios leído/no leído (icono rojo/contorno) | `f4c1597` |
| 14 | Picker de tarjetas referenciables del hito | `f4c1597` |
| 15 | Simplificación switcher paralelo (sin scrollbar, solo IDs) | `c7d30ed` |
| 16 | Fix comentarios propios no marcan como no leído | `5adea19` |
| 17 | Navegación por flechas cíclica entre referencias | `5adea19` |
| 18 | Fix tarjetas duplicadas en creación | `5adea19` |
| 19 | Selección de referencia por clic (sin flechas) | `0951ffb` |
| 20 | Fix unread comments para otros usuarios (race condition) | `0951ffb` |
| 21 | Autocompletado al invitar (realtime, excluye miembros) | `0951ffb` |
| 22 | Caja de notificación de invitaciones en HomePage | `0951ffb` |
| 23 | Bloqueo de invitar a ya-miembros | `f7b7048` |
| 24 | Expulsar colaboradores (solo dueño) | `f7b7048` |
| 25 | Salir del proyecto (solo no-dueños) | `f7b7048` |
| 26 | Migración RLS DELETE en project_members | `f7b7048` |
| 27 | Botón genérico Nueva tarjeta en barra de filtros y eliminación de '+' en columnas | `84482c4` |
| 28 | Campo Estado desmarcado por defecto en creación y obligatorio para guardar | `5bf733e` |
| 29 | Fecha de creación en tarjeta y ordenación por antigüedad cuando coinciden tags | `287eeb1` |
| 30 | Exportar e Importar proyecto completo en formato .csv con hitos y tarjetas | `b5a9fdd` |

---

## 14. Cómo Actualizar Este Documento

Al terminar cualquier sesión de desarrollo con cambios significativos:
1. Actualizar la sección **13** con las nuevas funcionalidades y sus commits correspondientes
2. Actualizar las secciones **5, 6, 7, 8 y 9** para reflejar fielmente la arquitectura actual de la aplicación
3. Actualizar la sección **12** si hay nuevas migraciones de Supabase
4. Hacer commit junto con el resto de cambios

```bash
git add ARCHITECTURE.md
# (incluirlo en el mismo commit de features)
```
