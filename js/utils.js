/* ============================================================
   CredyFast — utils.js  |  Utilidades globales
   ============================================================ */

const fmt = {
  currency(n) {
    const num = parseFloat(n) || 0;
    return '$' + num.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  },
  date(str) {
    if (!str) return '—';
    const d = new Date(str + (str.length === 10 ? 'T12:00:00' : ''));
    if (isNaN(d)) return str;
    return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
  },
  dateTime(str) {
    if (!str) return '—';
    const d = new Date(str);
    if (isNaN(d)) return str;
    return d.toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  },
  semana(n) { return `Semana ${n}`; },
  phone(s)  { return s || '—'; },
  id(s)     { return s || '—'; },
};

// ── Toast ─────────────────────────────────────────────────
const TOAST_ICONS = { success: '✔', error: '✖', warning: '⚠', info: 'ℹ' };

function toast(msg, type = 'info', duration = 3500) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.innerHTML = `<span style="font-size:1rem">${TOAST_ICONS[type] || 'ℹ'}</span><span>${msg}</span>`;
  container.appendChild(el);

  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transition = 'opacity 0.3s';
    setTimeout(() => el.remove(), 300);
  }, duration);
}

// ── Loading overlay ────────────────────────────────────────
function showLoading(visible) {
  const el = document.getElementById('loading-overlay');
  if (el) el.classList.toggle('hidden', !visible);
}

// ── DOM helpers ───────────────────────────────────────────
function $(id) { return document.getElementById(id); }

function setHTML(id, html) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = html;
}

function on(id, event, fn) {
  const el = typeof id === 'string' ? document.getElementById(id) : id;
  if (el) el.addEventListener(event, fn);
}

function delegate(containerId, selector, event, fn) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.addEventListener(event, e => {
    const target = e.target.closest(selector);
    if (target && container.contains(target)) fn(e, target);
  });
}

// ── Fecha actual formateada ────────────────────────────────
function nowDateStr() {
  return new Date().toLocaleDateString('es-MX', {
    weekday: 'short', day: '2-digit', month: 'short', year: 'numeric'
  });
}

// ── Validación básica ──────────────────────────────────────
function required(val, label) {
  if (!val || String(val).trim() === '') throw new Error(`${label} es requerido.`);
  return String(val).trim();
}

function requireNum(val, label, min = 0.01) {
  const n = parseFloat(val);
  if (isNaN(n) || n < min) throw new Error(`${label} debe ser mayor a ${min}.`);
  return n;
}

// ── Render tabla genérica ─────────────────────────────────
function renderTable(headers, rows, emptyMsg = 'Sin registros') {
  if (!rows || rows.length === 0) {
    return `<div class="table-empty">${emptyMsg}</div>`;
  }
  const ths = headers.map(h => `<th>${h.label}</th>`).join('');
  const trs = rows.map(row => {
    const tds = headers.map(h => `<td class="${h.class || ''}">${h.render ? h.render(row) : (row[h.key] ?? '—')}</td>`).join('');
    return `<tr>${tds}</tr>`;
  }).join('');
  return `<div class="table-wrap"><table><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table></div>`;
}

// ── Badge por estado operativo ────────────────────────────
function badgeEstado(estado) {
  const clsMap = {
    'AL_CORRIENTE':        'badge-success',
    'ATRASO_LEVE':          'badge-warning',
    'ATRASO_CRITICO':       'badge-danger',
    'ACTIVO':               'badge-info',
    'PENDIENTE':            'badge-warning',
    'APROBADO_EN_ESPERA':   'badge-gold',
    'APROVADO':             'badge-success',
    'FINALIZADO':           'badge-teal',
    'RECHAZADO':            'badge-danger',
    'PUNTUAL':              'badge-success',
    'NORMAL':               'badge-info',
    'MOROSO':               'badge-danger',
    'ATRASADO':             'badge-danger',
    'PARCIAL':              'badge-warning',
    'POR COBRAR':           'badge-muted',
    'PENDIENTE_DEPOSITO':   'badge-warning',
    'DEPOSITADO':           'badge-success',
  };
  const cls = clsMap[estado] || 'badge-muted';
  return `<span class="badge ${cls}">${estado || '—'}</span>`;
}
