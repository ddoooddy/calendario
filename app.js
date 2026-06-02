'use strict';
/* =========================================================================
   Mi Agenda — PWA calendar (vanilla JS, no frameworks)
   Data persists in localStorage. Recurring events are stored as rules and
   expanded on the fly when a day is rendered.
   ========================================================================= */
(function () {

  /* ----------------------------- Constants ----------------------------- */
  const STORE_KEY = 'mi-agenda.state.v1';
  const SEED_FLAG = 'mi-agenda.seeded.v1';

  const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  const MONTHS_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  const DOW_LONG = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']; // getDay()
  const GRID_DOW = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']; // Monday-first headers
  // weekday pills, Monday-first, mapped to getDay() indices
  const PILLS = [
    { label: 'L', dow: 1 }, { label: 'M', dow: 2 }, { label: 'M', dow: 3 },
    { label: 'J', dow: 4 }, { label: 'V', dow: 5 }, { label: 'S', dow: 6 }, { label: 'D', dow: 0 }
  ];
  const CAT_LABEL = {
    routine: 'Rutina', school: 'Colegio', university: 'Facultad',
    sport: 'Deporte', exam: 'Examen / Deadline', goal: 'Meta', personal: 'Personal'
  };

  /* ----------------------------- Date utils ---------------------------- */
  const pad2 = (n) => String(n).padStart(2, '0');
  const toISO = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  const parseISO = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const todayISO = () => toISO(new Date());
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  function startOfWeekMon(d) {
    const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const dow = (x.getDay() + 6) % 7; // Mon=0
    x.setDate(x.getDate() - dow);
    return x;
  }
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function humanDate(iso) {
    const d = parseISO(iso);
    return `${DOW_LONG[d.getDay()]} ${d.getDate()} de ${MONTHS[d.getMonth()]}`;
  }
  function shortDate(iso) {
    const d = parseISO(iso);
    return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
  }

  /* ------------------------------- State ------------------------------- */
  let state = { events: [], tasks: [] };
  let view = 'month';            // 'month' | 'week' | 'tasks'
  let cursor = new Date();       // anchors the visible month / week
  let selectedISO = todayISO();  // day shown in the detail sheet
  let editingId = null;          // event being edited, or null
  let deferredPrompt = null;     // PWA install prompt

  function loadState() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) state = JSON.parse(raw);
    } catch (e) { /* ignore corrupt/unavailable storage */ }
    if (!state.events) state.events = [];
    if (!state.tasks) state.tasks = [];

    let seeded = false;
    try { seeded = localStorage.getItem(SEED_FLAG) === '1'; } catch (e) {}
    if (!seeded && state.events.length === 0 && state.tasks.length === 0) {
      const seed = seedData();
      state.events = seed.events;
      state.tasks = seed.tasks;
      saveState();
      try { localStorage.setItem(SEED_FLAG, '1'); } catch (e) {}
    }
  }
  function saveState() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) {}
  }

  /* ------------------------------ Seed data ---------------------------- */
  function seedData() {
    const ev = (o) => Object.assign({
      id: uid(), title: '', notes: '', important: false,
      category: 'personal', date: null, start: null, end: null, repeat: null
    }, o);
    const rep = (days, extra) => Object.assign({ days: days }, extra || null);

    const events = [
      /* --- Rutina diaria (Lun-Vie) --- */
      ev({ title: 'Despertar + desayuno', start: '05:30', end: '06:40', category: 'routine', repeat: rep([2, 3, 4, 5]) }),
      ev({ title: 'Despertar + desayuno', start: '06:30', end: '08:45', category: 'routine', repeat: rep([1]), notes: 'Lunes: 06:30 o 07:00.' }),
      ev({ title: 'Prepararse para el colegio', start: '06:40', end: '07:25', category: 'routine', repeat: rep([2, 3, 4, 5]) }),

      /* --- Colegio --- */
      ev({ title: 'Colegio', start: '08:45', end: '13:00', category: 'school', repeat: rep([1]) }),
      ev({ title: 'Colegio', start: '07:25', end: '13:50', category: 'school', repeat: rep([2]) }),
      ev({ title: 'Colegio', start: '07:25', end: '13:00', category: 'school', repeat: rep([3]) }),
      ev({ title: 'Colegio', start: '07:25', end: '13:50', category: 'school', repeat: rep([4]) }),
      ev({ title: 'Colegio', start: '07:25', end: '13:50', category: 'school', repeat: rep([5]) }),

      /* --- Post-colegio: descanso + almuerzo (1 h) --- */
      ev({ title: 'Descanso + almuerzo', start: '13:00', end: '14:00', category: 'routine', repeat: rep([1]) }),
      ev({ title: 'Descanso + almuerzo', start: '13:50', end: '14:50', category: 'routine', repeat: rep([2]) }),
      ev({ title: 'Descanso + almuerzo', start: '13:00', end: '14:00', category: 'routine', repeat: rep([3]) }),
      ev({ title: 'Descanso + almuerzo', start: '13:50', end: '14:50', category: 'routine', repeat: rep([4]) }),
      ev({ title: 'Descanso + almuerzo', start: '13:50', end: '14:50', category: 'routine', repeat: rep([5]) }),

      /* --- Facultad y actividades --- */
      ev({ title: 'Facultad', start: '17:30', end: '19:15', category: 'university', repeat: rep([1]) }),
      ev({ title: 'Educación Física', start: '16:00', end: '17:00', category: 'sport', repeat: rep([3]) }),
      ev({ title: 'Facultad', start: '18:00', end: '19:15', category: 'university', repeat: rep([3]) }),
      ev({ title: 'Educación Física', start: '16:00', end: '17:00', category: 'sport', repeat: rep([5]) }),

      /* --- Eventos y deadlines --- */
      ev({ title: 'Final Precálculo (ingreso a Ingeniería)', date: '2026-07-15', category: 'exam', important: true, notes: 'Final del curso de ingreso a ingeniería.' }),
      ev({ title: 'Debate', date: '2026-06-30', category: 'exam', important: true, notes: 'Fin de junio — evento importante.' }),
      ev({ title: 'Recordatorio: Debate en 1 semana', date: '2026-06-23', category: 'exam', important: true, notes: 'Preparar todo para el debate.' }),
      ev({ title: 'Olimpiadas de Filosofía', date: '2026-08-01', category: 'goal', important: true, notes: 'Meta a largo plazo — 2º semestre 2026.' })
    ];

    const tk = (title, priority, notes) => ({ id: uid(), title: title, date: null, done: false, priority: priority || 'normal', notes: notes || '' });
    const tasks = [
      tk('Estudiar para el debate', 'alta'),
      tk('Estudiar para Olimpiadas de Filosofía', 'normal'),
      tk('Estudiar Precálculo', 'alta', 'Prioridad alta hasta el 15/07.'),
      tk('Aprender Python', 'normal'),
      tk('Ver curso Secret History + tomar notas', 'normal'),
      tk('Ver Matemática nivel universitario', 'normal')
    ];

    return { events: events, tasks: tasks };
  }

  /* --------------------------- Queries / rules ------------------------- */
  function occursOn(e, iso, dow) {
    if (e.repeat && Array.isArray(e.repeat.days)) {
      if (!e.repeat.days.includes(dow)) return false;
      if (e.repeat.from && iso < e.repeat.from) return false;
      if (e.repeat.until && iso > e.repeat.until) return false;
      return true;
    }
    return e.date === iso;
  }
  function eventsForISO(iso) {
    const dow = parseISO(iso).getDay();
    const list = state.events.filter((e) => occursOn(e, iso, dow));
    list.sort((a, b) => {
      const at = a.start || '', bt = b.start || '';
      if (!at && bt) return -1;
      if (at && !bt) return 1;
      if (!at && !bt) return (b.important ? 1 : 0) - (a.important ? 1 : 0);
      return at.localeCompare(bt);
    });
    return list;
  }
  const tasksForISO = (iso) => state.tasks.filter((t) => t.date === iso);
  const backlogTasks = () => state.tasks.filter((t) => !t.date);
  const datedTasks = () => state.tasks.filter((t) => t.date).sort((a, b) => a.date.localeCompare(b.date));

  /* ------------------------------ DOM refs ----------------------------- */
  const $ = (id) => document.getElementById(id);
  let viewEl, periodEl;

  /* ------------------------------ Rendering ---------------------------- */
  function render() {
    document.querySelectorAll('.seg').forEach((b) => b.classList.toggle('active', b.dataset.view === view));
    if (view === 'month') renderMonth();
    else if (view === 'week') renderWeek();
    else renderTasks();
  }

  function timeRangeHTML(e) {
    if (!e.start) return '<span class="agenda-time">Todo el día</span>';
    return `<span class="agenda-time">${esc(e.start)}${e.end ? `<span class="to">${esc(e.end)}</span>` : ''}</span>`;
  }

  function renderMonth() {
    const y = cursor.getFullYear(), m = cursor.getMonth();
    periodEl.textContent = `${MONTHS[m]} ${y}`;

    const first = new Date(y, m, 1);
    const gridStart = addDays(first, -((first.getDay() + 6) % 7));
    const tIso = todayISO();

    let html = '<div class="dow-row">' + GRID_DOW.map((d) => `<div class="dow">${d}</div>`).join('') + '</div>';
    html += '<div class="grid">';
    for (let i = 0; i < 42; i++) {
      const d = addDays(gridStart, i);
      const iso = toISO(d);
      const evs = eventsForISO(iso);
      const tks = tasksForISO(iso);
      const other = d.getMonth() !== m;
      const hasImportant = evs.some((e) => e.important);

      let dots = '';
      evs.slice(0, 4).forEach((e) => { dots += `<i class="dot cat-${e.category}"></i>`; });
      if (evs.length > 4) dots += `<i class="dot more">+${evs.length - 4}</i>`;

      const cls = ['cell'];
      if (other) cls.push('other');
      if (iso === tIso) cls.push('today');
      if (hasImportant) cls.push('has-important');

      html += `<button class="${cls.join(' ')}" data-day="${iso}">
        ${tks.length ? '<span class="task-flag">✓' + (tks.length > 1 ? tks.length : '') + '</span>' : ''}
        <span class="cell-date">${d.getDate()}</span>
        <span class="dots">${dots}</span>
      </button>`;
    }
    html += '</div>';
    viewEl.innerHTML = html;
  }

  function renderWeek() {
    const start = startOfWeekMon(cursor);
    const end = addDays(start, 6);
    periodEl.textContent = start.getMonth() === end.getMonth()
      ? `${start.getDate()} – ${end.getDate()} ${MONTHS_SHORT[start.getMonth()]} ${end.getFullYear()}`
      : `${start.getDate()} ${MONTHS_SHORT[start.getMonth()]} – ${end.getDate()} ${MONTHS_SHORT[end.getMonth()]} ${end.getFullYear()}`;

    const tIso = todayISO();
    let html = '';
    for (let i = 0; i < 7; i++) {
      const d = addDays(start, i);
      const iso = toISO(d);
      const evs = eventsForISO(iso);
      const tks = tasksForISO(iso);

      let rows = '';
      evs.forEach((e) => {
        rows += `<button class="agenda-item cat-${e.category}" data-edit="${e.id}">
          ${timeRangeHTML(e)}
          <span class="agenda-body">
            <span class="agenda-title">${e.important ? '<span class="star">★</span> ' : ''}${esc(e.title)}</span>
            ${e.notes ? `<span class="agenda-note">${esc(e.notes)}</span>` : ''}
          </span>
        </button>`;
      });
      tks.forEach((t) => { rows += taskHTML(t); });
      if (!rows) rows = '<div class="empty">Sin actividades — bloque libre.</div>';

      html += `<section class="week-day ${iso === tIso ? 'today' : ''}">
        <header class="wd-head" data-day="${iso}">
          <div><span class="wd-name">${DOW_LONG[d.getDay()]}</span><span class="wd-num">${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}</span></div>
          <button class="mini-add" data-add="${iso}" aria-label="Agregar evento">+</button>
        </header>
        <div class="agenda">${rows}</div>
      </section>`;
    }
    viewEl.innerHTML = html;
  }

  function taskHTML(t) {
    const meta = [];
    if (t.date) meta.push(shortDate(t.date));
    if (t.priority === 'alta') meta.push('<span class="badge prio-alta">Prioridad alta</span>');
    else if (t.priority === 'baja') meta.push('<span class="badge prio-baja">Baja</span>');
    if (t.notes) meta.push(esc(t.notes));
    return `<div class="task ${t.done ? 'done' : ''}">
      <input class="task-check" type="checkbox" data-toggle="${t.id}" ${t.done ? 'checked' : ''} aria-label="Completar tarea">
      <span class="task-main">
        <span class="task-title">${esc(t.title)}</span>
        ${meta.length ? `<span class="task-meta">${meta.join('')}</span>` : ''}
      </span>
      <button class="task-del" data-deltask="${t.id}" aria-label="Eliminar tarea">🗑</button>
    </div>`;
  }

  function renderTasks() {
    periodEl.textContent = 'Tareas';
    const backlog = backlogTasks();
    const dated = datedTasks();

    let html = '<h2 class="section-title">🔁 Tareas recurrentes</h2>';
    html += '<p class="section-hint">Sin horario fijo — distribuilas en tus bloques libres.</p>';
    html += '<div class="task-list">' + (backlog.length ? backlog.map(taskHTML).join('') : '<div class="empty">No hay tareas recurrentes.</div>') + '</div>';
    html += `<div class="add-row">
      <input id="addBacklog" type="text" placeholder="Nueva tarea recurrente…" enterkeyhint="done">
      <button class="btn btn-primary btn-sm" data-addbacklog>Agregar</button>
    </div>`;

    html += '<h2 class="section-title">📌 Tareas con fecha</h2>';
    html += '<div class="task-list">' + (dated.length ? dated.map(taskHTML).join('') : '<div class="empty">No hay tareas con fecha asignada.</div>') + '</div>';

    html += `<footer class="app-footer">
      <span>Mi Agenda · funciona sin conexión</span>
      <button class="btn btn-ghost btn-sm" data-reset>Restablecer datos de ejemplo</button>
    </footer>`;
    viewEl.innerHTML = html;
  }

  /* --------------------------- Day detail sheet ------------------------ */
  function openSheet(iso) {
    selectedISO = iso;
    $('sheetEyebrow').textContent = humanDate(iso);
    const d = parseISO(iso);
    $('sheetTitle').textContent = iso === todayISO() ? 'Hoy' : `${d.getDate()} de ${MONTHS[d.getMonth()]}`;

    const evs = eventsForISO(iso);
    const tks = tasksForISO(iso);
    let html = '<div class="sheet-section-title">Eventos</div>';
    if (evs.length) {
      html += '<div class="agenda">' + evs.map((e) => `
        <button class="agenda-item cat-${e.category}" data-edit="${e.id}">
          ${timeRangeHTML(e)}
          <span class="agenda-body">
            <span class="agenda-title">${e.important ? '<span class="star">★</span> ' : ''}${esc(e.title)}${e.repeat ? ' <span class="agenda-note">· se repite</span>' : ''}</span>
            ${e.notes ? `<span class="agenda-note">${esc(e.notes)}</span>` : ''}
          </span>
        </button>`).join('') + '</div>';
    } else {
      html += '<div class="empty">Sin eventos este día.</div>';
    }

    html += '<div class="sheet-section-title">Tareas del día</div>';
    html += '<div class="task-list">' + (tks.length ? tks.map(taskHTML).join('') : '<div class="empty">Sin tareas.</div>') + '</div>';
    html += `<div class="add-row">
      <input id="addDayTask" type="text" placeholder="Nueva tarea para este día…" enterkeyhint="done">
      <button class="btn btn-primary btn-sm" data-adddaytask>Agregar</button>
    </div>`;

    $('sheetBody').innerHTML = html;
    showOverlay('sheet');
  }

  /* ----------------------------- Event editor -------------------------- */
  function buildPills() {
    const wrap = $('weekdayPills');
    wrap.innerHTML = PILLS.map((p) => `<button type="button" class="wday" data-dow="${p.dow}">${p.label}</button>`).join('');
  }
  function setRepeatVisible(on) {
    $('weekdayPills').hidden = !on;
  }

  function openEditor(ev, defaultISO) {
    editingId = ev ? ev.id : null;
    $('editorTitle').textContent = ev ? 'Editar evento' : 'Nuevo evento';
    $('evDelete').hidden = !ev;

    $('evTitle').value = ev ? ev.title : '';
    $('evStart').value = ev && ev.start ? ev.start : '';
    $('evEnd').value = ev && ev.end ? ev.end : '';
    $('evCategory').value = ev ? ev.category : 'personal';
    $('evImportant').checked = ev ? !!ev.important : false;
    $('evNotes').value = ev ? ev.notes : '';

    const repeating = !!(ev && ev.repeat);
    $('evRepeat').checked = repeating;
    setRepeatVisible(repeating);
    const days = repeating ? ev.repeat.days : [];
    document.querySelectorAll('#weekdayPills .wday').forEach((p) => {
      p.classList.toggle('on', days.includes(Number(p.dataset.dow)));
    });
    // date field: single events use their date; recurring use repeat.from (optional)
    $('evDate').value = ev
      ? (ev.repeat ? (ev.repeat.from || '') : (ev.date || ''))
      : (defaultISO || selectedISO || todayISO());

    showOverlay('editor');
    setTimeout(() => $('evTitle').focus(), 60);
  }

  function saveEvent(e) {
    e.preventDefault();
    const title = $('evTitle').value.trim();
    if (!title) { $('evTitle').focus(); return; }

    const repeat = $('evRepeat').checked;
    const days = Array.from(document.querySelectorAll('#weekdayPills .wday.on')).map((p) => Number(p.dataset.dow));
    const dateVal = $('evDate').value;

    if (repeat && days.length === 0) { toast('Elegí al menos un día para repetir'); return; }

    const data = {
      title: title,
      start: $('evStart').value || null,
      end: $('evEnd').value || null,
      category: $('evCategory').value,
      important: $('evImportant').checked,
      notes: $('evNotes').value.trim(),
      date: repeat ? null : (dateVal || todayISO()),
      repeat: repeat ? { days: days, from: dateVal || null } : null
    };

    if (editingId) {
      const i = state.events.findIndex((x) => x.id === editingId);
      if (i >= 0) state.events[i] = Object.assign({}, state.events[i], data);
    } else {
      data.id = uid();
      state.events.push(data);
    }
    saveState();
    hideOverlay('editor');
    render();
    if (view !== 'tasks' && !$('sheet').classList.contains('hidden')) openSheet(selectedISO);
    toast(editingId ? 'Evento actualizado' : 'Evento agregado');
  }

  function deleteEvent() {
    if (!editingId) return;
    const ev = state.events.find((x) => x.id === editingId);
    const msg = ev && ev.repeat ? '¿Eliminar este evento y todas sus repeticiones?' : '¿Eliminar este evento?';
    if (!confirm(msg)) return;
    state.events = state.events.filter((x) => x.id !== editingId);
    saveState();
    hideOverlay('editor');
    render();
    if (!$('sheet').classList.contains('hidden')) openSheet(selectedISO);
    toast('Evento eliminado');
  }

  /* ------------------------------- Tasks ------------------------------- */
  function addTask(title, dateISO) {
    title = (title || '').trim();
    if (!title) return false;
    state.tasks.push({ id: uid(), title: title, date: dateISO || null, done: false, priority: 'normal', notes: '' });
    saveState();
    return true;
  }
  function toggleTask(id) {
    const t = state.tasks.find((x) => x.id === id);
    if (t) { t.done = !t.done; saveState(); }
  }
  function deleteTask(id) {
    state.tasks = state.tasks.filter((x) => x.id !== id);
    saveState();
  }

  /* ------------------------------ Overlays ----------------------------- */
  function showOverlay(id) {
    const el = $(id);
    el.classList.remove('hidden');
    el.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }
  function hideOverlay(id) {
    const el = $(id);
    el.classList.add('hidden');
    el.setAttribute('aria-hidden', 'true');
    if ($('sheet').classList.contains('hidden') && $('editor').classList.contains('hidden')) {
      document.body.style.overflow = '';
    }
  }

  /* ------------------------------- Toast ------------------------------- */
  let toastTimer = null;
  function toast(msg) {
    const t = $('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
  }

  /* ----------------------------- Navigation ---------------------------- */
  function navigate(dir) {
    if (view === 'month') cursor = new Date(cursor.getFullYear(), cursor.getMonth() + dir, 1);
    else if (view === 'week') cursor = addDays(cursor, dir * 7);
    else return;
    render();
  }
  function goToday() {
    cursor = new Date();
    selectedISO = todayISO();
    render();
  }
  function setView(v) {
    view = v;
    render();
  }

  /* ----------------------------- Event wiring -------------------------- */
  function wire() {
    $('prevBtn').addEventListener('click', () => navigate(-1));
    $('nextBtn').addEventListener('click', () => navigate(1));
    $('todayBtn').addEventListener('click', goToday);

    document.querySelector('.view-switch').addEventListener('click', (e) => {
      const b = e.target.closest('.seg');
      if (b) setView(b.dataset.view);
    });

    $('fab').addEventListener('click', () => {
      if (view === 'tasks') {
        const inp = $('addBacklog');
        if (inp) inp.focus();
      } else {
        openEditor(null, view === 'week' ? selectedISO : selectedISO);
      }
    });

    // Delegated clicks inside the main view
    viewEl.addEventListener('click', (e) => {
      const cell = e.target.closest('[data-day]');
      const edit = e.target.closest('[data-edit]');
      const add = e.target.closest('[data-add]');
      const delT = e.target.closest('[data-deltask]');
      const addBl = e.target.closest('[data-addbacklog]');
      const reset = e.target.closest('[data-reset]');

      if (edit) { const ev = state.events.find((x) => x.id === edit.dataset.edit); if (ev) openEditor(ev); return; }
      if (add) { selectedISO = add.dataset.add; openEditor(null, add.dataset.add); return; }
      if (delT) { deleteTask(delT.dataset.deltask); render(); return; }
      if (addBl) {
        const inp = $('addBacklog');
        if (inp && addTask(inp.value, null)) { inp.value = ''; render(); toast('Tarea agregada'); }
        return;
      }
      if (reset) { resetData(); return; }
      if (cell) { openSheet(cell.dataset.day); return; }
    });

    viewEl.addEventListener('change', (e) => {
      const tg = e.target.closest('[data-toggle]');
      if (tg) { toggleTask(tg.dataset.toggle); render(); }
    });
    viewEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.target.id === 'addBacklog') {
        if (addTask(e.target.value, null)) { e.target.value = ''; render(); toast('Tarea agregada'); }
      }
    });

    // Sheet interactions
    const sheetBody = $('sheetBody');
    sheetBody.addEventListener('click', (e) => {
      const edit = e.target.closest('[data-edit]');
      const delT = e.target.closest('[data-deltask]');
      const addDay = e.target.closest('[data-adddaytask]');
      if (edit) { const ev = state.events.find((x) => x.id === edit.dataset.edit); if (ev) openEditor(ev); return; }
      if (delT) { deleteTask(delT.dataset.deltask); openSheet(selectedISO); return; }
      if (addDay) {
        const inp = $('addDayTask');
        if (inp && addTask(inp.value, selectedISO)) { inp.value = ''; openSheet(selectedISO); render(); toast('Tarea agregada'); }
      }
    });
    sheetBody.addEventListener('change', (e) => {
      const tg = e.target.closest('[data-toggle]');
      if (tg) { toggleTask(tg.dataset.toggle); openSheet(selectedISO); render(); }
    });
    sheetBody.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.target.id === 'addDayTask') {
        if (addTask(e.target.value, selectedISO)) { e.target.value = ''; openSheet(selectedISO); render(); toast('Tarea agregada'); }
      }
    });

    $('addEventBtn').addEventListener('click', () => openEditor(null, selectedISO));
    $('addTaskBtn').addEventListener('click', () => { const i = $('addDayTask'); if (i) i.focus(); });

    // Editor
    buildPills();
    $('evRepeat').addEventListener('change', (e) => setRepeatVisible(e.target.checked));
    $('weekdayPills').addEventListener('click', (e) => {
      const p = e.target.closest('.wday');
      if (p) p.classList.toggle('on');
    });
    $('eventForm').addEventListener('submit', saveEvent);
    $('evDelete').addEventListener('click', deleteEvent);

    // Generic close buttons / backdrops
    document.querySelectorAll('[data-close]').forEach((el) => {
      el.addEventListener('click', () => hideOverlay(el.dataset.close));
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (!$('editor').classList.contains('hidden')) hideOverlay('editor');
        else if (!$('sheet').classList.contains('hidden')) hideOverlay('sheet');
      }
    });
  }

  function resetData() {
    if (!confirm('Esto borra tus cambios y vuelve a cargar el horario de ejemplo. ¿Continuar?')) return;
    try { localStorage.removeItem(STORE_KEY); localStorage.removeItem(SEED_FLAG); } catch (e) {}
    const seed = seedData();
    state = { events: seed.events, tasks: seed.tasks };
    saveState();
    try { localStorage.setItem(SEED_FLAG, '1'); } catch (e) {}
    render();
    toast('Datos restablecidos');
  }

  /* ------------------------------- PWA --------------------------------- */
  function initPWA() {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js').catch(() => {});
      });
    }
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredPrompt = e;
      $('installBanner').classList.remove('hidden');
    });
    $('installBtn').addEventListener('click', async () => {
      $('installBanner').classList.add('hidden');
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      deferredPrompt = null;
    });
    $('installDismiss').addEventListener('click', () => $('installBanner').classList.add('hidden'));
    window.addEventListener('appinstalled', () => { $('installBanner').classList.add('hidden'); deferredPrompt = null; });
  }

  /* ------------------------------- Init -------------------------------- */
  function init() {
    viewEl = $('view');
    periodEl = $('periodLabel');
    loadState();

    // Optional deep-link from manifest shortcuts: ?view=tasks|week
    const params = new URLSearchParams(location.search);
    const v = params.get('view');
    if (v === 'tasks' || v === 'week' || v === 'month') view = v;

    wire();
    initPWA();
    render();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

})();
