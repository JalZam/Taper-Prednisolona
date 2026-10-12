/* ============================================================
   TAPER DE PREDNISOLONA — app.js
   Lógica: gestión de filas, cálculo de fechas, auto-reglas,
   preset KDIGO, renderizado de tabla/preview, PDF
   ============================================================ */

// ── Estado ───────────────────────────────────────────────────
let rows       = [];   // { id, dose, days, unit, startDate, endDate }
let autoRules  = [];   // { id, fromDose, reducBy, everyWeeks, untilDose }
let nextId     = 1;
let nextRuleId = 1;
let globalStart = null; // Date

// ── Utilidades de fechas ──────────────────────────────────────
function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}
function fmtDate(date) {
  if (!date) return '—';
  return date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
}
function fmtDateLong(date) {
  if (!date) return '—';
  return date.toLocaleDateString('es-ES', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
}
function parseDate(str) {
  if (!str) return null;
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}
function toInputDate(date) {
  if (!date) return '';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// ── Recalcular fechas en cadena desde la primera fila ─────────
function recalcDates() {
  if (!globalStart) { renderRows(); renderPreview(); return; }
  let cursor = new Date(globalStart);
  rows.forEach(row => {
    row.startDate = new Date(cursor);
    row.endDate   = addDays(cursor, row.days - 1);
    cursor        = addDays(row.endDate, 1);
  });
  renderRows();
  renderPreview();
}

// ── Agregar fila ──────────────────────────────────────────────
function addRow(dose, days, unit) {
  dose = dose !== undefined ? dose : '';
  days = days || 7;
  unit = unit || 'días';
  // Normalizar unidad
  if (unit === 'semanas') days = (days % 7 === 0) ? days : days * 7;

  let startDate = globalStart ? new Date(globalStart) : null;
  if (rows.length > 0) {
    const last = rows[rows.length - 1];
    startDate = last.endDate ? addDays(last.endDate, 1) : startDate;
  }
  const endDate = startDate ? addDays(startDate, days - 1) : null;
  const id = nextId++;
  rows.push({ id, dose, days, unit, startDate, endDate });
  renderRows();
  renderPreview();
}

// ── Eliminar fila ─────────────────────────────────────────────
function removeRow(id) {
  rows = rows.filter(r => r.id !== id);
  recalcDates();
}

// ── Actualizar dosis ──────────────────────────────────────────
function updateDose(id, val) {
  const row = rows.find(r => r.id === id);
  if (row) { row.dose = val === '' ? '' : parseFloat(val); renderPreview(); }
}

// ── Actualizar duración ───────────────────────────────────────
function updateDur(id, numVal, unitVal) {
  const row = rows.find(r => r.id === id);
  if (!row) return;
  const n = parseInt(numVal) || 1;
  row.unit = unitVal;
  row.days = unitVal === 'semanas' ? n * 7 : n;
  recalcDates();
}

// ── Cambio de fecha de inicio global ─────────────────────────
function handleStartChange() {
  const val = document.getElementById('global-start').value;
  globalStart = parseDate(val);
  recalcDates();
  updateGate();
}

// ── Calculadora de dosis ──────────────────────────────────────
let selectedDoseValue = null;
let _rawDose = null;
let _floor5  = null;
let _ceil5   = null;

function calcDose() {
  const w  = parseFloat(document.getElementById('weight').value);
  const mk = parseFloat(document.getElementById('dose-per-kg').value);
  const rawEl     = document.getElementById('dose-raw');
  const breakdown = document.getElementById('dose-breakdown');

  // Reset completo
  selectedDoseValue = null;
  _rawDose = _floor5 = _ceil5 = null;
  _hide('breakdown-row');
  _hide('warn-80');
  _hide('selected-dose-row');
  document.getElementById('btn-round-down').classList.remove('selected');
  document.getElementById('btn-round-up').classList.remove('selected');

  if (!w || !mk || w <= 0) {
    rawEl.textContent = '— mg/día';
    breakdown.style.display = 'none';
    updateGate();
    return;
  }

  _rawDose = +(w * mk).toFixed(4);
  const isExact = _rawDose % 5 === 0;
  _floor5 = Math.floor(_rawDose / 5) * 5 || 5;
  _ceil5  = isExact ? _rawDose : Math.ceil(_rawDose / 5) * 5;

  rawEl.textContent = `${w} kg × ${mk} mg/kg = ${_rawDose.toFixed(1)} mg/día`;
  breakdown.style.display = 'block';

  if (_rawDose > 80) {
    // Caso: supera 80 mg — mostrar SOLO la advertencia primero
    const lblBtn = isExact
      ? `Continuar con ${_rawDose} mg`
      : `Continuar (elegir múltiplo de 5)`;
    document.getElementById('btn-use-calc').textContent = lblBtn;
    _show('warn-80');

  } else if (isExact) {
    // Caso: exacto múltiplo de 5 y ≤ 80 — confirmar automáticamente, sin preguntas
    selectedDoseValue = _rawDose;
    _showSelected(_rawDose);

  } else {
    // Caso: no es múltiplo de 5 y ≤ 80 — mostrar opciones de redondeo
    _showRoundingOptions();
  }
  updateGate();
}

function _showRoundingOptions() {
  document.getElementById('breakdown-exact').textContent = `${_rawDose.toFixed(1)} mg`;
  document.getElementById('round-down-val').textContent  = _floor5;
  document.getElementById('round-up-val').textContent    = _ceil5;
  _show('breakdown-row');
}

function selectDose(direction) {
  const dose = direction === 'down' ? _floor5 : _ceil5;
  selectedDoseValue = dose;
  document.getElementById('btn-round-down').classList.toggle('selected', direction === 'down');
  document.getElementById('btn-round-up').classList.toggle('selected', direction === 'up');
  _showSelected(dose);
}

function forceMaxDose(maxVal) {
  _hide('warn-80');
  if (maxVal === 80) {
    // Usuario elige 80 mg (KDIGO)
    selectedDoseValue = 80;
    _showSelected(80);
  } else {
    // Usuario elige continuar con la dosis calculada > 80
    const isExact = _rawDose % 5 === 0;
    if (isExact) {
      selectedDoseValue = _rawDose;
      _showSelected(_rawDose);
    } else {
      // Mostrar opciones de redondeo
      _showRoundingOptions();
    }
  }
  updateGate();
}

function _showSelected(dose) {
  document.getElementById('selected-value').textContent = `${dose} mg/día`;
  _show('selected-dose-row');
  updateGate();
}

function startManual() {
  const startInput = document.getElementById('global-start').value;
  if (!startInput) { showMsg('paso2-msg', 'Falta la fecha de inicio (paso 1).'); return; }
  if (selectedDoseValue === null) { showMsg('paso2-msg', 'Falta elegir la dosis inicial (paso 1).'); return; }
  globalStart = parseDate(startInput);
  marcarOpcion('opt-manual');
  if (rows.length === 0) {
    addRow(selectedDoseValue, 28, 'días');
  } else {
    rows[0].dose = selectedDoseValue;
    recalcDates();
  }
  irAlPaso3();
}
const useDose = startManual; // compatibilidad

function _show(id) { document.getElementById(id).style.display = ''; }
function _hide(id) { document.getElementById(id).style.display = 'none'; }


// ── Preset KDIGO 2021 — Taper rápido 12–18 semanas ───────────
function applyKDIGOPreset() {
  const startInput = document.getElementById('global-start').value;
  if (!startInput) { showMsg('paso2-msg', 'Falta la fecha de inicio (paso 1).'); return; }
  if (selectedDoseValue === null) { showMsg('paso2-msg', 'Falta elegir la dosis inicial (paso 1).'); return; }
  const startDose = selectedDoseValue;
  marcarOpcion('opt-kdigo');

  rows = []; nextId = 1;
  globalStart = parseDate(startInput);

  const steps = generateKDIGOSteps(startDose);
  steps.forEach(s => {
    const unit = s.days % 7 === 0 ? 'semanas' : 'días';
    addRow(s.dose, s.days, unit);
  });
  recalcDates();
  irAlPaso3();
}


function generateKDIGOSteps(startDose) {
  const D = Math.min(Math.max(startDose, 5), 80);
  const steps = [];
  // Fase 1: dosis plena × 4 semanas
  steps.push({ dose: D, days: 28 });
  // Fase 2: reducir 10 mg/semana hasta 20 mg
  let cur = D;
  while (cur > 20) {
    cur = +Math.max(cur - 10, 20).toFixed(1);
    steps.push({ dose: cur, days: 7 });
  }
  // Fase 3: reducir 5 mg/semana hasta 10 mg
  while (cur > 10) {
    cur = +Math.max(cur - 5, 10).toFixed(1);
    steps.push({ dose: cur, days: 7 });
  }
  // Fase 4: 7.5 mg × 2 semanas (solo si la dosis actual es mayor)
  if (cur > 7.5) steps.push({ dose: 7.5, days: 14 });
  // Fase 5: 5 mg × 4 semanas (cierre; si ya se inició en 5 mg, la fase 1 es el cierre)
  if (cur > 5) steps.push({ dose: 5, days: 28 });
  return steps;
}

// ── Auto-reglas ───────────────────────────────────────────────
function addAutoRule() {
  const last = autoRules[autoRules.length - 1];
  const fromDose = last ? last.untilDose : (selectedDoseValue !== null ? selectedDoseValue : '');
  autoRules.push({ id: nextRuleId++, fromDose, reducBy: 10, everyWeeks: 1, untilDose: '' });
  renderAutoRules();
}

function removeAutoRule(id) {
  autoRules = autoRules.filter(r => r.id !== id);
  renderAutoRules();
}

function setAutoRule(id, field, val) {
  const rule = autoRules.find(r => r.id === id);
  if (rule) rule[field] = val;
}

function renderAutoRules() {
  const container = document.getElementById('auto-rules-list');
  container.innerHTML = '';
  autoRules.forEach((rule, i) => {
    const div = document.createElement('div');
    div.className = 'auto-rule-row';
    const fromReadonly = i > 0 ? 'readonly style="opacity:.65;background:#e8f0fe"' : '';
    div.innerHTML = `
      <span class="rule-label">Desde</span>
      <input type="number" class="rule-input" value="${rule.fromDose || ''}" placeholder="mg"
        step="0.5" oninput="setAutoRule(${rule.id},'fromDose',this.value)" ${fromReadonly} />
      <span class="rule-label">mg → reducir</span>
      <input type="number" class="rule-input sm" value="${rule.reducBy}" step="0.5"
        oninput="setAutoRule(${rule.id},'reducBy',this.value)" />
      <span class="rule-label">mg c/</span>
      <input type="number" class="rule-input sm" value="${rule.everyWeeks}" min="1"
        oninput="setAutoRule(${rule.id},'everyWeeks',this.value)" />
      <span class="rule-label">sem. hasta</span>
      <input type="number" class="rule-input" value="${rule.untilDose || ''}" placeholder="mg"
        step="0.5" oninput="setAutoRule(${rule.id},'untilDose',this.value); syncNextFromDose(${rule.id})" />
      <button class="btn-remove" onclick="removeAutoRule(${rule.id})">✕</button>
    `;
    container.appendChild(div);
  });
}

function syncNextFromDose(id) {
  const idx = autoRules.findIndex(r => r.id === id);
  if (idx >= 0 && idx < autoRules.length - 1) {
    autoRules[idx + 1].fromDose = autoRules[idx].untilDose;
    renderAutoRules();
  }
}

function applyAutoRules() {
  const startInput = document.getElementById('global-start').value;
  if (!startInput) { showMsg('paso2-msg', 'Falta la fecha de inicio (paso 1).'); return; }
  if (!autoRules.length) { showMsg('paso2-msg', 'Agrega al menos una regla.'); return; }
  const incompleta = autoRules.some(r => isNaN(parseFloat(r.fromDose)) || isNaN(parseFloat(r.reducBy)) || isNaN(parseFloat(r.untilDose)));
  if (incompleta) { showMsg('paso2-msg', 'Hay reglas sin completar: revisa "desde", "reducir" y "hasta".'); return; }
  globalStart = parseDate(startInput);
  rows = []; nextId = 1;
  marcarOpcion('opt-rules');

  autoRules.forEach((rule, ruleIdx) => {
    const from   = parseFloat(rule.fromDose);
    const reducBy = parseFloat(rule.reducBy);
    const weeks  = parseInt(rule.everyWeeks) || 1;
    const until  = parseFloat(rule.untilDose);
    if (isNaN(from) || isNaN(reducBy) || isNaN(until)) return;

    let cur = from;
    // Agregar dosis inicial del rango (solo en primera regla o si no solapó)
    if (ruleIdx === 0) addRow(cur, weeks * 7, 'semanas');

    while (cur > until + 0.001) {
      cur = +Math.max(cur - reducBy, until).toFixed(2);
      addRow(cur, weeks * 7, 'semanas');
    }
  });
  recalcDates();
  irAlPaso3();
}

// ── Renderizar filas de la tabla ──────────────────────────────
function renderRows() {
  const tbody = document.getElementById('taper-body');
  tbody.innerHTML = '';
  rows.forEach((row, i) => {
    const displayNum = row.unit === 'semanas'
      ? Math.round(row.days / 7)
      : row.days;

    const tr = document.createElement('tr');

    // Dose cell
    const tdDose = document.createElement('td');
    tdDose.innerHTML = `
      <div style="display:flex;align-items:center;gap:3px">
        <input type="number" class="dose-input" value="${row.dose}" min="0" step="0.5"
          placeholder="mg" id="dose-inp-${row.id}"
          oninput="updateDose(${row.id},this.value)" />
        <span class="mg-label">mg</span>
      </div>`;

    // Duration cell
    const tdDur = document.createElement('td');
    tdDur.innerHTML = `
      <div class="dur-cell">
        <input type="number" class="dur-num" value="${displayNum}" min="1"
          id="dur-num-${row.id}" oninput="handleDurChange(${row.id})" />
        <select class="dur-unit" id="dur-unit-${row.id}" onchange="handleDurChange(${row.id})">
          <option value="días" ${row.unit !== 'semanas' ? 'selected' : ''}>días</option>
          <option value="semanas" ${row.unit === 'semanas' ? 'selected' : ''}>semanas</option>
        </select>
      </div>`;

    // Start date
    const tdStart = document.createElement('td');
    tdStart.className = 'date-cell';
    tdStart.textContent = row.startDate ? fmtDate(row.startDate) : '—';

    // End date
    const tdEnd = document.createElement('td');
    tdEnd.className = 'date-cell';
    tdEnd.textContent = row.endDate ? fmtDate(row.endDate) : '—';

    // Delete button
    const tdDel = document.createElement('td');
    tdDel.innerHTML = `<button class="btn-remove" onclick="removeRow(${row.id})" title="Eliminar fila">✕</button>`;

    tr.appendChild(tdDose);
    tr.appendChild(tdDur);
    tr.appendChild(tdStart);
    tr.appendChild(tdEnd);
    tr.appendChild(tdDel);
    tbody.appendChild(tr);
  });
}

function handleDurChange(id) {
  const num  = document.getElementById(`dur-num-${id}`).value;
  const unit = document.getElementById(`dur-unit-${id}`).value;
  updateDur(id, num, unit);
}

// ── Limpiar todo ──────────────────────────────────────────────
let _clearArmed = null;
function clearAll() {
  if (rows.length && !_clearArmed) {
    showMsg('paso3-msg', 'Pulsa "Limpiar esquema" otra vez para confirmar. Se borrarán todos los escalones.', 'warn');
    _clearArmed = setTimeout(() => { _clearArmed = null; }, 4000);
    return;
  }
  clearTimeout(_clearArmed); _clearArmed = null;
  rows = []; nextId = 1;
  document.querySelectorAll('.option-card.active').forEach(el => el.classList.remove('active'));
  renderRows(); renderPreview();
}

// ── Renderizar Preview ────────────────────────────────────────
function renderPreview() {
  const empty   = document.getElementById('preview-empty');
  const content = document.getElementById('preview-content');
  const validRows = rows.filter(r => parseFloat(r.dose) > 0);

  if (!rows.length) {
    empty.style.display = 'flex';
    content.style.display = 'none';
    updateGate();
    return;
  }
  empty.style.display = 'none';
  content.style.display = 'block';
  updateGate();
  if (!validRows.length) {
    document.getElementById('preview-bars').innerHTML = '';
    document.getElementById('preview-table-wrap').innerHTML = '';
    return;
  }

  // Timeline bars
  const maxDose = Math.max(...validRows.map(r => parseFloat(r.dose)));
  document.getElementById('preview-bars').innerHTML = validRows.map(row => {
    const pct = maxDose > 0 ? ((parseFloat(row.dose) / maxDose) * 100).toFixed(1) : 0;
    const weeks = Math.floor(row.days / 7);
    const rem   = row.days % 7;
    const dur   = weeks > 0 && rem === 0 ? `${weeks}s` : `${row.days}d`;
    return `<div class="tl-row">
      <div class="tl-dose">${row.dose} mg</div>
      <div class="tl-bar-wrap"><div class="tl-bar" style="width:${pct}%"></div></div>
      <div class="tl-dates">${row.startDate ? fmtDate(row.startDate) : '...'} – ${row.endDate ? fmtDate(row.endDate) : '...'} <span style="color:#94a3b8">(${dur})</span></div>
    </div>`;
  }).join('');

  // Preview table
  document.getElementById('preview-table-wrap').innerHTML = `
    <table class="preview-table">
      <thead>
        <tr>
          <th>#</th>
          <th>Dosis (mg/día)</th>
          <th>Duración</th>
          <th>Inicio</th>
          <th>Fin</th>
        </tr>
      </thead>
      <tbody>
        ${validRows.map((row, i) => {
          const weeks = Math.floor(row.days / 7);
          const rem   = row.days % 7;
          const dur   = weeks > 0 && rem === 0
            ? `${weeks} semana${weeks > 1 ? 's' : ''}`
            : weeks > 0 ? `${weeks}s ${rem}d` : `${row.days} días`;
          return `<tr>
            <td>${i + 1}</td>
            <td class="td-dose">${row.dose}</td>
            <td>${dur}</td>
            <td>${row.startDate ? fmtDate(row.startDate) : '—'}</td>
            <td>${row.endDate ? fmtDate(row.endDate) : '—'}</td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>`;
}

// ── Toggle acordeón ───────────────────────────────────────────
function toggleSection(bodyId, chevId) {
  const body  = document.getElementById(bodyId);
  const chev  = document.getElementById(chevId);
  body.classList.toggle('collapsed');
  if (chev) chev.classList.toggle('open');
}

// ── Generar PDF / Imprimir ────────────────────────────────────
function printReport() {
  const validRows = rows.filter(r => parseFloat(r.dose) > 0);
  if (!validRows.length) {
    showMsg('paso3-msg', 'No hay escalones con dosis para imprimir. Arma el esquema en el paso 2.');
    return;
  }
  const patientInput = document.getElementById('patient-name').value;
  const startDate = validRows[0]?.startDate;
  const endDate   = validRows[validRows.length - 1]?.endDate;
  const totalDays = validRows.reduce((s, r) => s + r.days, 0);

  // Fecha del documento
  document.getElementById('pr-doc-date').textContent =
    new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' });

  // Caja del paciente
  const patientBox = document.getElementById('pr-patient-box');
  if (patientInput && patientInput.trim()) {
    patientBox.style.display = 'block';
    patientBox.innerHTML = `<strong>Paciente:</strong> ${patientInput.trim()}`;
  } else {
    patientBox.style.display = 'none';
    patientBox.innerHTML = '';
  }

  // Resumen
  document.getElementById('pr-summary').innerHTML = `
    <div class="pr-summary-item">
      <div class="pr-summary-label">Fecha de inicio</div>
      <div class="pr-summary-value">${startDate ? fmtDate(startDate) : '—'}</div>
    </div>
    <div class="pr-summary-item">
      <div class="pr-summary-label">Dosis inicial</div>
      <div class="pr-summary-value">${validRows[0]?.dose || '—'} mg/día</div>
    </div>
    <div class="pr-summary-item">
      <div class="pr-summary-label">Duración total</div>
      <div class="pr-summary-value">${Math.round(totalDays / 7)} semanas</div>
    </div>
    <div class="pr-summary-item">
      <div class="pr-summary-label">Fecha fin estimada</div>
      <div class="pr-summary-value">${endDate ? fmtDate(endDate) : '—'}</div>
    </div>
  `;

  // Tabla PDF
  document.getElementById('pr-tbody').innerHTML = validRows.map((row, i) => {
    const weeks = Math.floor(row.days / 7);
    const rem   = row.days % 7;
    const dur   = weeks > 0 && rem === 0
      ? `${weeks} semana${weeks > 1 ? 's' : ''}`
      : weeks > 0 ? `${weeks}s ${rem}d` : `${row.days} días`;
    return `<tr>
      <td>${i + 1}</td>
      <td>${row.startDate ? fmtDate(row.startDate) : '—'} — ${row.endDate ? fmtDate(row.endDate) : '—'}</td>
      <td class="td-big">${row.dose} mg</td>
      <td>${dur}</td>
    </tr>`;
  }).join('');

  window.print();
}

// ── Flujo en 3 pasos ──────────────────────────────────────────
function showMsg(_id, text, type) {
  // Aviso flotante siempre visible, sin importar dónde esté el scroll
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = text;
  el.className = 'toast show' + (type === 'warn' ? ' warn' : '');
  clearTimeout(el._t);
  el._t = setTimeout(() => { el.className = 'toast'; }, 5000);
}

function updateGate() {
  const hasDate = !!document.getElementById('global-start').value;
  const hasDose = selectedDoseValue !== null;
  const paso1 = document.getElementById('paso1');
  const paso2 = document.getElementById('paso2');
  const paso3 = document.getElementById('paso3');
  const s1 = document.getElementById('paso1-status');
  const s2 = document.getElementById('paso2-status');

  const faltan = [];
  if (!hasDose) faltan.push('la dosis inicial');
  if (!hasDate) faltan.push('la fecha de inicio');

  paso1.classList.toggle('done', faltan.length === 0);
  s1.textContent = faltan.length === 0 ? '✓ Listo' : 'Falta ' + faltan.join(' y ');

  const ready = faltan.length === 0;
  paso2.classList.toggle('locked', !ready);
  s2.textContent = ready ? 'Elige una opción' : 'Primero completa el paso 1';
  document.getElementById('kdigo-btn').disabled  = !ready;
  document.getElementById('manual-btn').disabled = !ready;
  document.getElementById('rules-btn').disabled  = !hasDate;
  document.getElementById('rules-apply-btn').disabled = !hasDate;

  paso3.classList.toggle('done', rows.length > 0);
  paso2.classList.toggle('done', rows.length > 0);
  document.getElementById('print-btn').disabled = !rows.some(r => parseFloat(r.dose) > 0);
}

function toggleRules() {
  const body = document.getElementById('auto-body');
  body.classList.toggle('collapsed');
  if (body.classList.contains('collapsed')) return;
  if (autoRules.length === 0) {
    addAutoRule();
  } else if (autoRules[0].fromDose === '' && selectedDoseValue !== null) {
    autoRules[0].fromDose = selectedDoseValue;
    renderAutoRules();
  }
}

function marcarOpcion(id) {
  document.querySelectorAll('.option-card.active').forEach(el => el.classList.remove('active'));
  const el = document.getElementById(id);
  if (el) el.classList.add('active');
}

function irAlPaso3() {
  const el = document.getElementById('paso3');
  if (el && el.scrollIntoView) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

document.addEventListener('DOMContentLoaded', () => { renderPreview(); updateGate(); });

// ── Reset completo ────────────────────────────────────────────
function fullReset() {
  if (confirm('¿Iniciar una nueva consulta? Se borrarán todos los datos actuales.')) {
    window.location.reload();
  }
}

// ── Init ──────────────────────────────────────────────────────

addAutoRule(); // una regla inicial de ejemplo
