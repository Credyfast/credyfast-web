/* ============================================================
   CredyFast — sucursales.js  |  Módulo de gestión de sucursales
   Solo SuperUsuario puede ver y administrar este módulo.
   ============================================================ */

const Sucursales = (() => {

  // ── Render ────────────────────────────────────────────────
  function render() {
    return `
    <div class="view-page" id="sucursales-view">

      <div class="page-header">
        <div>
          <h2 class="page-title">🏢 Gestión de Sucursales</h2>
          <p class="page-subtitle">Crea, edita y activa/desactiva las sucursales del sistema.</p>
        </div>
        <button class="btn btn-primary" id="suc-btn-nueva">+ Nueva Sucursal</button>
      </div>

      <!-- Formulario nueva/editar sucursal -->
      <div id="suc-form-area" class="card hidden" style="margin-bottom:20px">
        <h3 class="card-title" id="suc-form-titulo">Nueva Sucursal</h3>
        <div class="form-row">
          <div class="form-group">
            <label for="suc-inp-nombre">Nombre *</label>
            <input type="text" id="suc-inp-nombre" placeholder="Ej: NAOLINCO" maxlength="60">
          </div>
          <div class="form-group">
            <label for="suc-inp-dir">Dirección (opcional)</label>
            <input type="text" id="suc-inp-dir" placeholder="Ej: Calle Principal #12, Naolinco Ver.">
          </div>
        </div>
        <div class="form-actions">
          <button class="btn btn-primary" id="suc-btn-guardar">💾 Guardar</button>
          <button class="btn btn-outline" id="suc-btn-cancelar">Cancelar</button>
        </div>
        <p id="suc-form-error" class="form-error hidden"></p>
      </div>

      <!-- Tabla de sucursales -->
      <div class="card">
        <div id="suc-tabla-area">
          <div class="empty-state"><div class="loading-spinner" style="margin:0 auto 12px"></div><p>Cargando…</p></div>
        </div>
      </div>

    </div>`;
  }

  // ── Init ──────────────────────────────────────────────────
  function init() {
    _cargar();
    on('suc-btn-nueva',    'click', _abrirFormNueva);
    on('suc-btn-cancelar', 'click', _cerrarForm);
    on('suc-btn-guardar',  'click', _guardar);
  }

  // ── Estado interno ────────────────────────────────────────
  let _editId = null;

  // ── Cargar lista ──────────────────────────────────────────
  async function _cargar() {
    setHTML('suc-tabla-area', '<div class="empty-state"><div class="loading-spinner" style="margin:0 auto 12px"></div><p>Cargando…</p></div>');
    try {
      const res = await API.sucursalList();
      if (!res.ok) { setHTML('suc-tabla-area', `<p class="text-danger">${res.message}</p>`); return; }
      _renderTabla(res.data || []);
    } catch (_) {
      setHTML('suc-tabla-area', '<p class="text-danger">Error de conexión.</p>');
    }
  }

  function _renderTabla(sucursales) {
    if (!sucursales.length) {
      setHTML('suc-tabla-area', '<div class="empty-state"><p>No hay sucursales registradas.</p></div>');
      return;
    }
    setHTML('suc-tabla-area', `
      <table class="cf-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Nombre</th>
            <th>Dirección</th>
            <th>Estatus</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          ${sucursales.map(s => `
            <tr>
              <td><code style="font-size:.75rem">${s.id}</code></td>
              <td><strong>${s.nombre}</strong></td>
              <td style="color:var(--cf-text-secondary);font-size:.82rem">${s.direccion || '—'}</td>
              <td>
                <span class="badge ${s.activa ? 'badge-success' : 'badge-muted'}">
                  ${s.activa ? '✅ Activa' : '⛔ Inactiva'}
                </span>
              </td>
              <td>
                <div class="btn-group">
                  <button class="btn btn-outline btn-sm" data-suc-edit="${s.id}"
                          data-nombre="${s.nombre}" data-dir="${s.direccion || ''}">
                    ✏️ Editar
                  </button>
                  <button class="btn btn-sm ${s.activa ? 'btn-danger' : 'btn-success'}"
                          data-suc-toggle="${s.id}">
                    ${s.activa ? '⛔ Desactivar' : '✅ Activar'}
                  </button>
                </div>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `);

    // Eventos de tabla
    document.querySelectorAll('[data-suc-edit]').forEach(btn => {
      btn.addEventListener('click', () => {
        _editId = btn.dataset.sucEdit;
        $('suc-inp-nombre').value = btn.dataset.nombre || '';
        $('suc-inp-dir').value    = btn.dataset.dir || '';
        setHTML('suc-form-titulo', `Editar Sucursal — ${btn.dataset.nombre}`);
        $('suc-form-area').classList.remove('hidden');
        $('suc-inp-nombre').focus();
      });
    });
    document.querySelectorAll('[data-suc-toggle]').forEach(btn => {
      btn.addEventListener('click', () => _toggle(btn.dataset.sucToggle));
    });
  }

  // ── Abrir form nueva ──────────────────────────────────────
  function _abrirFormNueva() {
    _editId = null;
    $('suc-inp-nombre').value = '';
    $('suc-inp-dir').value    = '';
    setHTML('suc-form-titulo', 'Nueva Sucursal');
    $('suc-form-error').classList.add('hidden');
    $('suc-form-area').classList.remove('hidden');
    setTimeout(() => $('suc-inp-nombre').focus(), 50);
  }

  function _cerrarForm() {
    $('suc-form-area').classList.add('hidden');
    _editId = null;
  }

  // ── Guardar ───────────────────────────────────────────────
  async function _guardar() {
    const nombre    = ($('suc-inp-nombre').value || '').trim();
    const direccion = ($('suc-inp-dir').value    || '').trim();
    const errEl     = $('suc-form-error');
    errEl.classList.add('hidden');

    if (!nombre) {
      errEl.textContent = 'El nombre es obligatorio.';
      errEl.classList.remove('hidden');
      $('suc-inp-nombre').focus();
      return;
    }

    const btn = $('suc-btn-guardar');
    btn.disabled = true; btn.textContent = 'Guardando…';
    showLoading(true);
    try {
      let res;
      if (_editId) {
        res = await API.sucursalUpdate({ id: _editId, nombre, direccion });
      } else {
        res = await API.sucursalCreate({ nombre, direccion });
      }
      if (res.ok) {
        toast('✔ ' + res.message, 'success');
        _cerrarForm();
        _cargar();
      } else {
        errEl.textContent = res.message || 'Error al guardar.';
        errEl.classList.remove('hidden');
      }
    } catch (_) {
      errEl.textContent = 'Error de conexión.';
      errEl.classList.remove('hidden');
    } finally {
      btn.disabled = false; btn.textContent = '💾 Guardar';
      showLoading(false);
    }
  }

  // ── Toggle activo/inactivo ────────────────────────────────
  async function _toggle(id) {
    showLoading(true);
    try {
      const res = await API.sucursalToggle({ id });
      if (res.ok) { toast('✔ ' + res.message, 'success'); _cargar(); }
      else toast(res.message || 'Error.', 'error');
    } catch (_) { toast('Error de conexión.', 'error'); }
    finally { showLoading(false); }
  }

  return { render, init };
})();
