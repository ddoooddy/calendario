# Mi Agenda — Calendario PWA

Una agenda/calendario personal en **HTML, CSS y JavaScript puro** (sin frameworks).
Funciona 100 % sin conexión, guarda los datos en el dispositivo y se instala en la
pantalla de inicio de Android como una app.

## Características

- 📅 **Vista mensual** (cuadrícula, semana de lunes a domingo) y **vista semanal** (agenda por día).
- ➕ **Eventos**: crear, editar y eliminar — con título, fecha, hora de inicio/fin, categoría, notas y marca de *importante*.
- 🔁 **Eventos que se repiten** cada semana (elegís los días). El horario fijo viene precargado como recurrencia.
- ✅ **Tareas / to-do por día** + una bandeja de **tareas recurrentes** sin horario fijo para distribuir en los bloques libres.
- 💾 **Persistencia local** con `localStorage` — no hay backend ni cuenta.
- 📲 **Instalable** (manifest + service worker) y **offline-first**.
- 🌗 Diseño *mobile-first*, táctil, con modo claro/oscuro automático.

## Cómo ejecutarla

Un Service Worker necesita HTTP(S) o `localhost` (no funciona abriendo el `index.html` con `file://`).

```bash
cd calendar
python3 -m http.server 8000
# Abrí http://localhost:8000 en el navegador
```

También se puede publicar gratis en **GitHub Pages**, **Netlify** o **Vercel** (es estático).

## Instalar en Android

1. Abrí la URL en **Chrome** (debe ser `https://` o `localhost`).
2. Menú ⋮ → **Agregar a la pantalla principal** / **Instalar app**
   (o tocá el botón **Instalar** que aparece dentro de la app).
3. Se abre en pantalla completa, sin barra del navegador, y funciona sin internet.

## Datos precargados

El horario de ejemplo se carga la primera vez:

- **Rutina (Lun–Vie):** despertar + desayuno y preparación (con la excepción del lunes 06:30).
- **Colegio:** horario distinto por día (Lun 08:45–13:00, Mar/Jue/Vie 07:25–13:50, Mié 07:25–13:00).
- **Post-colegio:** descanso + almuerzo (1 h) después de salir.
- **Facultad y actividades:** Facultad (Lun y Mié) y Educación Física (Mié y Vie).
- **Deadlines:** Final de Precálculo (15/07/2026), Debate (fin de junio, con recordatorio 1 semana antes) y Olimpiadas de Filosofía (meta del 2º semestre).
- **Tareas recurrentes:** debate, Olimpiadas, Precálculo (prioridad alta), Python, Secret History y Matemática universitaria.

> Para volver al ejemplo: pestaña **Tareas → "Restablecer datos de ejemplo"**.

## Estructura

```
calendar/
├── index.html        # markup + meta tags PWA
├── styles.css        # estilos (mobile-first, claro/oscuro)
├── app.js            # estado, datos de ejemplo, render e interacción
├── manifest.json     # manifiesto PWA
├── sw.js             # service worker (cache del app shell, offline)
├── make_icons.py     # genera los íconos (opcional, requiere Pillow)
└── icons/            # íconos 192/512 (any + maskable)
```

## Regenerar los íconos (opcional)

```bash
python3 -m pip install pillow
python3 make_icons.py
```
