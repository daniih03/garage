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
│   │   ├── csvExportImport.js   # Helpers: escapeCSV, parseCSV, generateProjectCSV, parseProjectCSV, downloadCSV
│   │   └── notifications.js     # Helpers: createUserNotification, markAllNotificationsRead, markNotificationRead
│   ├── styles/
│   │   └── global.css           # TODOS los estilos (~3700+ líneas, temática oscura)
│   └── components/
│       ├── Auth/
│       │   └── LoginPage.jsx    # Pantalla de login con GitHub OAuth
│       ├── Layout/
│       │   ├── Header.jsx       # Cabecera global con logo, navegación, badge de rol y campana
│       │   └── NotificationBell.jsx # Campana de notificaciones con badge no leídas y dropdown interactivo
│       ├── Home/
│       │   ├── HomePage.jsx     # Vista principal: lista de proyectos + notificaciones de invitación
│       │   ├── ProjectCard.jsx  # Tarjeta de proyecto con progress ring y métricas
│       │   ├── AddProjectModal.jsx    # Modal para añadir nuevo proyecto desde GitHub
│       │   └── EditProjectModal.jsx   # Modal para editar proyecto existente
│       ├── Project/
│       │   ├── ProjectView.jsx  # Vista de proyecto: barra de miembros, hitos, export/import CSV, RBAC, tablero Kanban
│       │   ├── MilestoneBar.jsx # Barra de selección de hitos con progreso (restringida por rol)
│       │   ├── MilestoneModal.jsx     # Modal crear/editar hito
│       │   ├── InviteModal.jsx  # Modal invitar colaborador con autocompletado en tiempo real y notificación
│       │   ├── ManageMembersModal.jsx # Modal para cambiar roles y expulsar según jerarquía
│       │   └── ImportProjectModal.jsx # Modal importar hitos y tarjetas desde CSV
│       ├── Board/
│       │   ├── Board.jsx        # Tablero Kanban: columnas, filtros visuales, botón nueva tarjeta, drag & drop, RBAC
│       │   ├── Column.jsx       # Columna del Kanban con control de arrastre según rol
│       │   ├── Card.jsx         # Tarjeta individual con badges, menciones @, indicador comentarios, fecha creación
│       │   └── CardModal.jsx    # Modal crear/editar tarjeta (modo solo lectura para Guest)
│       ├── Common/
│       │   ├── ConfirmModal.jsx      # Modal de confirmación genérico simple
│       │   └── DangerConfirmModal.jsx # Modal de confirmación peligrosa (requiere escribir CONFIRM)
│       └── Shared/              # Componentes compartidos (actualmente vacío)
├── supabase/
│   ├── schema.sql               # Schema completo de Supabase con tablas, RLS y funciones
│   ├── migration_add_leave_kick_policy.sql  # Migración: política DELETE en project_members
│   ├── migration_roles_and_notifications.sql # Migración: roles RBAC, user_notifications y RLS reforzado
│   └── migration_fix_milestones_and_invites.sql # Migración: fix hitos, RLS creator owner, eliminación auto-invitaciones
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

**RLS:** Permitido para miembros en `project_members` o si el usuario autenticado es el creador (`created_by = auth.uid()`).

#### `project_members`
| Columna | Tipo | Descripción |
|---|---|---|
| `project_id` | uuid PK | FK → `projects.id` |
| `user_id` | uuid PK | FK → `auth.users.id` |
| `added_by` | uuid | FK → `auth.users.id` (quién invitó) |
| `added_at` | timestamptz | Fecha de incorporación |
| `role` | text | `'owner'`, `'admin'`, `'member'`, `'guest'` (default: `'member'`) |

**RLS:**
- `SELECT`: Solo ver tu propio row (`user_id = auth.uid()`)
- `INSERT`: Solo si eres Admin u Owner del proyecto
- `UPDATE`: Owner puede cambiar roles de Admin, Member y Guest; Admin solo de Member y Guest. Anti-auto-bloqueo.
- `DELETE`: Si eres tú mismo (salir, no aplica a Owner) O según jerarquía de roles (Owner puede expulsar a cualquiera; Admin a Member y Guest).

#### `user_notifications`
Tabla global por usuario para invitaciones, cambios de rango y expulsiones.
| Columna | Tipo | Descripción |
|---|---|---|
| `id` | uuid PK | Identificador único |
| `user_id` | uuid | FK → `auth.users.id` (destinatario) |
| `project_id` | uuid | FK → `projects.id` (opcional si el proyecto fue borrado) |
| `project_name` | text | Nombre legible del proyecto |
| `type` | text | `'project_invite'`, `'role_change'`, `'project_kick'` |
| `title` | text | Título de la notificación |
| `message` | text | Contenido descriptivo |
| `metadata` | jsonb | Metadatos adicionales |
| `read` | boolean | Estado de lectura (default: `false`) |
| `created_at` | timestamptz | Fecha de creación |

**RLS:** Cada usuario tiene control sobre sus propias notificaciones (`user_id = auth.uid()`), permitiendo inserciones de otros miembros del proyecto.

#### `milestones`
| Columna | Tipo | Descripción |
|---|---|---|
| `id` | uuid PK | |
| `project_id` | uuid | FK → `projects.id` |
| `number` | integer | Número secuencial (renumerados al borrar) |
| `title` | text | Nombre del hito |
| `created_at` | timestamptz | |

**UNIQUE:** `(project_id, number)`
**UNIQUE:** `(project_id, number)`
**RLS:** Mutaciones (`INSERT`, `UPDATE`, `DELETE`) restringidas a roles `'owner'` y `'admin'` (evaluadas mediante `get_project_role` o por coincidencia directa de `projects.created_by = auth.uid()`).

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
**RLS:** Mutaciones (`INSERT`, `UPDATE`, `DELETE`) bloqueadas para rol `'guest'`. Permitidas para `'owner'`, `'admin'` y `'member'`.

#### `card_comments`
| Columna | Tipo | Descripción |
|---|---|---|
| `id` | uuid PK | |
| `card_id` | uuid | FK → `cards.id` |
| `content` | text | Contenido del comentario |
| `created_by` | uuid | FK → `auth.users.id` |
| `created_at` | timestamptz | |

**RLS:** Creación permitida para `'owner'`, `'admin'` y `'member'`. Bloqueada para `'guest'`.

### Funciones RPC Supabase

- **`get_project_role(p_id uuid, u_id uuid)`**: Retorna el rol efectivo (`owner`, `admin`, `member`, `guest`) de un usuario en un proyecto. Si `projects.created_by = u_id`, garantiza retornar `'owner'`.
- **`sync_user_projects(user_repos text[], github_user text)`**: Registra o actualiza el username del usuario en `profiles`. Ya no auto-enrola ni inserta membresías automáticamente en `project_members`.
- **`handle_new_user()`** (trigger): Crea el perfil automáticamente al registrarse.
- **`auto_add_known_collaborators()`** (trigger): Al crear un proyecto, añade únicamente al creador con rol `owner`. Se eliminó la auto-invitación de colaboradores de GitHub.

### Realtime
Todos los canales suscritos usan `postgres_changes`:
- `home-projects` → `projects` + `project_members`
- `user-notifs-{userId}` → `user_notifications` (campana global en tiempo real)
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

#### Sistema de Roles y Permisos (RBAC)
- **Roles:**
  - **`owner`**: Creador del proyecto (`created_by`). Solo existe 1 por proyecto. No se puede transferir ni ascender a nadie a Owner. Control total: edita/borra proyecto, gestiona hitos, gestiona tarjetas, invita y administra colaboradores (puede cambiar roles de Admin/Member/Guest y expulsar a cualquier miembro). Puede exportar e importar a CSV. No puede degradarse ni expulsarse a sí mismo.
  - **`admin`**: Puede crear, editar o eliminar hitos y tarjetas. Puede invitar miembros. Puede administrar colaboradores con rol inferior (`member` y `guest`), cambiándoles el rol o expulsándolos. Puede exportar e importar a CSV. No puede degradar ni expulsar al Owner ni a otros Admins, ni degradarse a sí mismo. No puede eliminar el proyecto.
  - **`member`**: Puede crear, editar, mover y borrar tarjetas. No puede gestionar hitos, ni invitar, ni administrar colaboradores, ni exportar el proyecto a CSV, ni editar/borrar el proyecto.
  - **`guest`**: Permisos de solo lectura (visualización). Puede ver el proyecto, hitos y tarjetas y abrir el modal en modo consulta. No puede crear, editar, mover ni borrar tarjetas ni hitos, ni añadir comentarios, ni exportar a CSV.
- **Header:** A la izquierda del avatar de usuario se muestra el badge con el rol activo en el proyecto (`OWNER`, `ADMIN`, `MEMBER`, `GUEST`) con código de color distintivo.
- **Salir del proyecto y expulsiones (Fuente de verdad única):**
  - Cualquier colaborador (excepto el Owner) puede salirse voluntariamente del proyecto. Al salir o ser expulsado, se elimina físicamente su registro de `project_members`.
  - La lista de colaboradores en el proyecto y en el modal de administración se basa **exclusivamente en los miembros reales presentes en `project_members`** (enriquecidos opcionalmente con avatares de GitHub). Esto garantiza que un usuario expulsado o que haya abandonado el proyecto desaparezca de inmediato y no reaparezca erróneamente.
- **Panel de Administrar Colaboradores (Ordenación jerárquica):**
  - Los miembros en el modal de colaboradores se presentan ordenados estrictamente de arriba a abajo según la importancia de su rol: **Owner → Admin → Member → Guest** (y alfabéticamente ante el mismo rol).

### Sistema de Notificaciones Globales y Campana
- **Campana de notificaciones (`NotificationBell.jsx`):** Situada a la izquierda del badge de rol en la cabecera. Muestra un badge numérico rojo animado si existen notificaciones no leídas (`read = false`).
- Al hacer clic en la campana, se despliega una lista interactiva con soporte en tiempo real (`postgres_changes` en `user_notifications`).
- **Tipos de notificación:**
  - `project_invite`: Notificación al ser invitado a un proyecto. Permite aceptar o rechazar directamente desde el dropdown.
  - `role_change`: Notificación cuando un Admin u Owner asciende o degrada el rol de un usuario.
  - `project_kick`: Notificación cuando un usuario es expulsado de un proyecto (visible inmediatamente desde su panel principal).
- Al marcar como leídas (individualmente o con "Marcar todas como leídas"), el badge numérico y el color rojo desaparecen.

### Sistema de Invitaciones de Proyecto
Las invitaciones son **estrictamente manuales y explícitas**:
- Ya no se auto-invita a colaboradores de GitHub al registrar un proyecto nuevo ni mediante auto-sync de repositorios.
- Para invitar a un usuario, un `owner` o `admin` debe hacerlo expresamente desde el modal de invitación (`InviteModal.jsx`).
- Al invitar, se inserta la membresía en `project_members` (rol `'member'`) y una notificación `project_invite` en `user_notifications`.
- **Campana de notificaciones como único canal:** La invitación aparece y se gestiona **exclusivamente en la campana de notificaciones de la cabecera (`NotificationBell.jsx`)**, donde el usuario puede Aceptar o Rechazar. Se eliminó cualquier banner o cuadro central en `HomePage`.
- **Aceptar:** El invitado pulsa "Aceptar" en la campana. La notificación se marca como leída y el proyecto pasa a mostrarse inmediatamente en su grid de proyectos activos de `HomePage`.
- **Rechazar:** El invitado pulsa "Rechazar" en la campana. Se elimina su fila de `project_members` y se marca la notificación como leída.
- En `HomePage.jsx`, los proyectos con invitaciones pendientes no aceptadas permanecen ocultos del grid principal.

### Permisos de Eliminación en Tarjetas de Proyecto (`ProjectCard`)
- En el visualizador principal (`HomePage.jsx`), el icono de la papelera para eliminar un proyecto solo se renderiza si el usuario actual es el `owner` del proyecto (`project.created_by === currentUser.id` o rol `owner`). Los colaboradores (`admin`, `member`, `guest`) no ven el botón de papelera.

### Creación y Gestión de Hitos
- **Cálculo seguro de correlativo:** En `MilestoneModal.jsx` y `MilestoneBar.jsx`, el número de nuevo hito se calcula con `Math.max(0, ...milestones.map(m => m.number || 0)) + 1` y se contrasta en tiempo real con el `MAX(number)` existente en la base de datos para prevenir conflictos de `UNIQUE(project_id, number)`.
- **Actualización inmediata de UI:** `MilestoneModal` no depende únicamente del canal Realtime; invoca el callback `onMilestoneCreated(createdMilestone)` devuelto por `.select().single()`, integrándolo al instante en el estado local de `ProjectView` y seleccionándolo si no había un hito activo previo.
- **Acceso rápido en proyectos vacíos:** Cuando un proyecto no tiene hitos (`milestones.length === 0`), si el usuario tiene rol `owner` o `admin`, se muestra un botón central prominente *"Crear primer hito"* para facilitar la configuración inicial.

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
- Estado global: `session`, `view` (`'home'` | `'project'`), `activeProject`, `activeMilestone`, `activeUserRole`, `homeRefreshKey`
- Gestión de sesión y token de GitHub
- Auto-logout en nuevos deploys
- Distribuye `activeUserRole` a `Header` y `ProjectView`

### `Header.jsx`
- Logo Command Garage y navegación breadcrumb interactiva
- **Campana de notificaciones (`NotificationBell.jsx`):** A la izquierda del badge de rol.
- **Badge de rol del usuario:** Muestra el rol activo (`OWNER`, `ADMIN`, `MEMBER`, `GUEST`) con estilo y color distintivo inmediatamente a la izquierda del avatar.
- Menú de usuario con avatar y botón "Salir" de sesión.

### `NotificationBell.jsx`
- Botón campana con badge numérico rojo animado si existen notificaciones no leídas (`user_notifications` con `read = false`).
- Desplegable interactivo en tiempo real (`postgres_changes`):
  - `project_invite`: permite aceptar o declinar invitaciones directamente.
  - `role_change`: notifica cambios de rol (ascensos y degradaciones).
  - `project_kick`: notifica expulsiones de proyectos.
- Botón "Marcar todas como leídas" y marcado individual.

### `HomePage.jsx`
- Carga proyectos activos donde el usuario es creador o miembro aceptado.
- Oculta proyectos con invitaciones pendientes que no hayan sido aceptadas aún por el usuario.
- Notificaciones de invitación centralizadas exclusivamente en la campana de cabecera (`NotificationBell.jsx`), sin banner ni caja central.
- Evalúa si el usuario es `owner` de cada proyecto para restringir la visibilidad del botón de papelera en `ProjectCard`.
- Invoca `sync_user_projects` RPC al montar para mantener actualizado el perfil.
- Realtime en `projects` y `project_members`.

### `ProjectCard.jsx`
- Tarjeta de proyecto con progress ring y métricas de tarjetas e hitos completados.
- Recibe prop `isOwner`: el botón de papelera para eliminar proyecto (`project-card__action-btn--delete`) solo se muestra y habilita si `isOwner && onDelete`.

### `AddProjectModal.jsx`
- Modal para registrar nuevo proyecto desde GitHub.
- Inserta el proyecto en `projects` y asegura explícitamente al creador en `project_members` con rol `'owner'`.
- No auto-invita a ningún colaborador de GitHub.

### `ProjectView.jsx`
- Carga miembros basándose **estrictamente en `project_members`** con sus roles correspondientes y detecta el rol del usuario actual (`currentUserRole`).
- Si el usuario actual es el creador (`project.created_by`), auto-repara su membresía en `project_members` con rol `'owner'` si faltara en BD.
- Barra de miembros con avatares, conteo de colaboradores y botón *"Administrar colaboradores"* (visible solo para `owner` y `admin`).
- Expulsión directa desde avatar restringida por jerarquía RBAC.
- Botón "Salir" del proyecto disponible para todos los miembros excepto el `owner`.
- Botones de acción del proyecto condicionados por rol:
  - "Nuevo hito", "Invitar", "Editar", "Exportar CSV", "Importar CSV": solo `owner` y `admin`.
  - "Eliminar proyecto": exclusivo de `owner`.
- Estado vacío (`milestones.length === 0`): muestra botón destacado "Crear primer hito" para roles con privilegios (`owner`, `admin`).
- Conexión inmediata de hitos vía `handleMilestoneCreated` sin esperar a Realtime.
- Modales: Invitar, Administrar Miembros, Importar Proyecto (CSV), Editar Proyecto, Eliminar Proyecto, Expulsar Miembro, Salir del Proyecto, Crear Hito.

### `ManageMembersModal.jsx`
- Administración integral de colaboradores y roles:
  - Listado de colaboradores **ordenado de arriba a abajo por jerarquía de roles (Owner → Admin → Member → Guest)**.
  - Distinción de usuario propio ("Tú") y badges visuales.
  - Dropdown para cambiar rol respetando la jerarquía estricta: `owner` puede asignar `admin`, `member` y `guest`; `admin` solo puede asignar `member` y `guest`.
  - Regla contra el auto-bloqueo: ningún usuario puede cambiarse el rol a sí mismo ni el `owner` puede ser modificado.
  - Botón "Expulsar" con confirmación de seguridad `DangerConfirmModal`: `owner` puede expulsar a cualquiera menos a sí mismo; `admin` solo a `member` y `guest`.
  - Inserta notificaciones globales en `user_notifications` para los usuarios afectados.

### `MilestoneBar.jsx`
- Barra de selección de hitos con progreso.
- Cálculo de `nextNumber` seguro mediante `Math.max(0, ...milestones.map(m => m.number || 0)) + 1`.
- Botón "Nuevo hito" y botones de edición/eliminación de hito en pestañas visibles únicamente para `owner` y `admin`.
- Conecta `onMilestoneCreated` recibido del padre a `MilestoneModal`.

### `MilestoneModal.jsx`
- Modal para crear y editar hitos.
- Consulta el número máximo real en base de datos antes de insertar para prevenir violaciones de `UNIQUE(project_id, number)`.
- Invoca el callback `onMilestoneCreated` con el registro retornado por Supabase (`select().single()`) para refresco inmediato de interfaz.

### `Board.jsx`
- Estado: `cards`, `allProjectCards`, `commentsMeta`, `viewedMap`, `currentUser`, `currentUserRole`, filtros.
- Permisos RBAC: si el rol es `guest`, se bloquean mutaciones (`canMutateCards = false`):
  - Botón "Nueva tarjeta" oculto.
  - Drag & Drop bloqueado en columnas.
  - Botón eliminar tarjeta oculto.
  - Abre `CardModal` en modo de solo lectura.
- Barra de filtros visuales y ordenación por prioridad con desempate por antigüedad.
- Realtime en `cards` y `card_comments`.

### `CardModal.jsx`
- Formulario de creación/edición de tarjeta. Si `canMutate` es `false` (rol `guest`), oculta los botones de guardar y eliminar, dejando solo el botón "Cerrar".
- Campo Estado obligatorio al crear tarjeta.
- Sistema de menciones `@` con vista comparativa paralela.
- Sección de comentarios con realtime.

### `Card.jsx`
- Tarjeta Kanban con badges, menciones `@`, indicador de comentarios no leídos y fecha de creación.
- `draggable` y botón de borrado deshabilitados si `canMutate` es `false`.

### `InviteModal.jsx`
- Autocompletado en tiempo real sobre `profiles`.
- Bloquea duplicados e inserta registros en `project_members` con `role = 'member'` e inserta notificación en `user_notifications`.

---

## 9. CSS y Diseño

- **Un solo fichero:** `src/styles/global.css` (~3700+ líneas)
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
- **Componentes específicos añadidos:**
  - `.header-role-badge` y sus variantes `--owner`, `--admin`, `--member`, `--guest`.
  - `.notif-wrapper`, `.notif-bell-btn`, `.notif-badge`, `.notif-dropdown`, `.notif-item`.
  - `.manage-members-list`, `.manage-member-row`, `.role-select`, `.btn-kick-member`.
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

### 1. Migración de Roles y Notificaciones Globales
> Archivo: `supabase/migration_roles_and_notifications.sql`

### 2. Migración: Corrección de hitos y eliminación de auto-invitaciones
> Archivo: `supabase/migration_fix_milestones_and_invites.sql`

```sql
-- 1. Actualizar get_project_role para que si el usuario es el creador del proyecto (projects.created_by),
-- devuelva siempre 'owner', incluso si su registro en project_members faltase o tuviera otro rol.
CREATE OR REPLACE FUNCTION get_project_role(p_id uuid, u_id uuid)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
  v_role text;
  v_creator uuid;
BEGIN
  -- Si es el creador del proyecto en la tabla projects, es inequívocamente el owner
  SELECT created_by INTO v_creator FROM projects WHERE id = p_id;
  IF v_creator IS NOT NULL AND v_creator = u_id THEN
    RETURN 'owner';
  END IF;

  SELECT role INTO v_role FROM project_members WHERE project_id = p_id AND user_id = u_id LIMIT 1;
  RETURN v_role;
END;
$$;

-- 2. Asegurar que todos los creadores de proyectos existentes tengan registro en project_members con rol 'owner'
INSERT INTO project_members (project_id, user_id, added_by, role)
SELECT id, created_by, created_by, 'owner'
FROM projects
WHERE created_by IS NOT NULL
ON CONFLICT (project_id, user_id) DO UPDATE SET role = 'owner';

-- 3. Reforzar las políticas RLS sobre la tabla milestones
DROP POLICY IF EXISTS "Ver hitos miembros" ON milestones;
CREATE POLICY "Ver hitos miembros" ON milestones
  FOR SELECT USING (
    get_project_role(project_id, auth.uid()) IS NOT NULL
    OR
    EXISTS (SELECT 1 FROM projects p WHERE p.id = milestones.project_id AND p.created_by = auth.uid())
  );

DROP POLICY IF EXISTS "Gestionar hitos (Owner y Admin)" ON milestones;
CREATE POLICY "Gestionar hitos (Owner y Admin)" ON milestones
  FOR ALL USING (
    get_project_role(project_id, auth.uid()) IN ('owner', 'admin')
    OR
    EXISTS (SELECT 1 FROM projects p WHERE p.id = milestones.project_id AND p.created_by = auth.uid())
  )
  WITH CHECK (
    get_project_role(project_id, auth.uid()) IN ('owner', 'admin')
    OR
    EXISTS (SELECT 1 FROM projects p WHERE p.id = milestones.project_id AND p.created_by = auth.uid())
  );

-- 4. Actualizar trigger on_project_created para que SOLO añada al creador como 'owner'.
-- Ya NO se auto-invitan colaboradores de GitHub. Toda invitación debe ser explícita.
CREATE OR REPLACE FUNCTION auto_add_known_collaborators()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Añadir creador con rol 'owner'
  IF NEW.created_by IS NOT NULL THEN
    INSERT INTO project_members (project_id, user_id, added_by, role)
    VALUES (NEW.id, NEW.created_by, NEW.created_by, 'owner')
    ON CONFLICT (project_id, user_id) DO UPDATE SET role = 'owner';
  END IF;

  RETURN NEW;
END;
$$;

-- 5. Actualizar sync_user_projects para que NO auto-enrole en proyectos.
CREATE OR REPLACE FUNCTION sync_user_projects(user_repos text[], github_user text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF github_user IS NOT NULL THEN
    INSERT INTO profiles (id, github_username)
    VALUES (auth.uid(), lower(github_user))
    ON CONFLICT (id) DO UPDATE SET
      github_username = lower(EXCLUDED.github_username);
  END IF;
END;
$$;

-- 6. Asegurar que el creador de un proyecto siempre pueda verlo y gestionarlo
DROP POLICY IF EXISTS "Solo miembros — projects" ON projects;
CREATE POLICY "Solo miembros — projects" ON projects
  FOR ALL USING (
    created_by = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM project_members pm
      WHERE pm.project_id = projects.id AND pm.user_id = auth.uid()
    )
  )
  WITH CHECK (auth.role() = 'authenticated');
```

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
| 31 | Sistema de Rangos de Usuario (Owner, Admin, Member, Guest), Campana de Notificaciones interactiva y Gestión de Colaboradores | `28c4863` |
| 32 | Fix persistencia de miembros expulsados, bloqueo de exportar CSV a Member/Guest y ordenación jerárquica de roles en modal | `5d2fca2` |
| 33 | Corrección de creación de hitos, eliminación de auto-invitaciones de GitHub, centralización de invitaciones en campana de cabecera y restricción de papelera de proyecto solo a Owner | `3a4676c` |

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
