/* ============================================================
   CredyFast — usuarios.js  |  Gestión de Usuarios del Sistema
   Roles: Solo SuperUsuario y Supervisor pueden acceder.
   ============================================================ */

const Usuarios = (() => {

  let _lista = [];

  const ROLES_DISPONIBLES = ['Supervisor', 'Cajero', 'Vendedor', 'Cobranza'];

  function render() {
    return `
    <div>
      <div class="section-header">
        <h2>Usuarios del Sistema</h2>
        <button class="btn btn-primary btn-sm" id="btn-nuevo-usuario">+ Nuevo Usuario</button>
      </div>

      <div class="alert alert-info" style="margin-bottom:16px">
        ℹ Los SuperUsuarios están configurados directamente en el código del backend y no se gestionan desde aquí.
      </div>

      <div class="card">
        <div id="usr-table"><div class="table-empty">Cargando…</div></div>
      </div>

      <!-- Modal nuevo usuario -->
      <div id="modal-usuario" class="hidden" style="
        position:fixed;inset:0;background:rgba(0,0,0,0.45);z-index:200;
        display:flex;align-items:center;justify-content:center;padding:16px">
        <div class="card" style="width:100%;max-width:460px">
          <div class="card-header">
            <h3>Nuevo Usuario</h3>
            <button class="btn btn-ghost btn-sm" id="modal-usr-close">✕</button>
          </div>
          <div class="card-body">

            <div class="form-group">
              <label>Nombre Completo *</label>
              <input type="text" id="usr-nombre" placeholder="Nombre completo del usuario">
            </div>

            <div class="form-row">
              <div class="form-group">
                <label>Username *</label>
                <input type="text" id="usr-username" placeholder="Sin espacios ni acentos"
                  autocomplete="off">
              </div>
              <div class="form-group">
                <label>Rol *</label>
                <select id="usr-rol">
                  <option value="">-- Seleccionar --</option>
                  ${ROLES_DISPONIBLES.map(r => `<option value="${r}">${r}</option>`).join('')}
                </select>
              </div>
            </div>

            <div class="form-group">
              <label>Contraseña Inicial *</label>
              <input type="password" id="usr-password" placeholder="Mínimo 8 caracteres" autocomplete="new-password">
              <div class="form-error" id="usr-pwd-hint" style="color:var(--cf-muted)">
                El usuario deberá cambiarla en su primer acceso.
              </div>
            </div>

            <div class="form-group">
              <label>Confirmar Contraseña *</label>
              <input type="password" id="usr-password2" placeholder="Repetir contraseña" autocomplete="new-password">
            </div>

            <div class="form-group">
              <label>Notas</label>
              <input type="text" id="usr-notas" placeholder="Opcional…">
            </div>

            <div id="usr-error" class="alert alert-danger hidden" style="margin-bottom:12px"></div>

            <button class="btn btn-primary btn-full" id="usr-submit-btn">
              Crear Usuario
            </button>
          </div>
        </div>
      </div>
    </div>`;
  }

  function init() {
    _cargar();
    on('btn-nuevo-usuario', 'click',  _abrirModal);
    on('modal-usr-close',   'click',  _cerrarModal);
    on('usr-submit-btn',    'click',  _crear);
  }

  // ── Cargar usuarios ───────────────────────────────────────
  async function _cargar() {
    showLoading(true);
    try {
      const res = await API.userList();
      if (!res.ok) { toast(res.message, 'error'); return; }
      _lista = res.data || [];
      _renderTabla(_lista);
    } catch(_) { toast('Error de conexión.', 'error'); }
    finally { showLoading(false); }
  }

  function _renderTabla(usuarios) {
    setHTML('usr-table', renderTable([
      { key: 'id',       label: 'ID',           class: 'td-mono', render: r => `<span style="font-size:.75rem">${(r['id']||'').substring(0,8)}…</span>` },
      { key: 'username', label: 'Username',     render: r => `<strong>${r['username'] || '—'}</strong>` },
      { key: 'nombre',   label: 'Nombre',       render: r => r['nombre'] || '—' },
      { key: 'rol',      label: 'Rol',          render: r => _badgeRol(r['rol']) },
      { key: 'activo',   label: 'Estado',       render: r => r['activo']
          ? '<span class="badge badge-success">Activo</span>'
          : '<span class="badge badge-muted">Inactivo</span>'
      },
      { key: 'acceso',   label: 'Último Acceso', render: r => fmt.dateTime(r['acceso']) },
      { key: '_acc',     label: '',             render: r => `<button class="btn btn-sm ${r['activo'] ? 'btn-danger' : 'btn-success'}"
          onclick="Usuarios._toggle('${r['id']}', ${r['activo']})">
          ${r['activo'] ? 'Desactivar' : 'Activar'}
        </button>`
      },
    ], usuarios, 'No hay usuarios registrados.'));
  }

  function _badgeRol(rol) {
    const mapa = {
      'SuperUsuario': 'badge-primary',
      'Supervisor':   'badge-teal',
      'Cajero':       'badge-info',
      'Vendedor':     'badge-gold',
      'Cobranza':     'badge-warning',
    };
    return `<span class="badge ${mapa[rol] || 'badge-muted'}">${rol || '—'}</span>`;
  }

  // ── Modal ─────────────────────────────────────────────────
  function _abrirModal() {
    const modal = $('modal-usuario');
    modal.classList.remove('hidden');
    modal.style.display = 'flex';
    ['usr-nombre','usr-username','usr-password','usr-password2','usr-notas']
      .forEach(id => { const el=$(id); if(el) el.value=''; });
    $('usr-rol').value = '';
    $('usr-error').classList.add('hidden');
    setTimeout(() => $('usr-nombre')?.focus(), 50);
  }

  function _cerrarModal() {
    $('modal-usuario').classList.add('hidden');
  }

  // ── Crear usuario ─────────────────────────────────────────
  async function _crear() {
    const errBox = $('usr-error');
    errBox.classList.add('hidden');

    const nombre   = $('usr-nombre')?.value.trim();
    const username = $('usr-username')?.value.trim();
    const rol      = $('usr-rol')?.value;
    const pwd      = $('usr-password')?.value;
    const pwd2     = $('usr-password2')?.value;

    if (!nombre)   { _error('El nombre es obligatorio.');    return; }
    if (!username) { _error('El username es obligatorio.');  return; }
    if (!rol)      { _error('Selecciona un rol.');           return; }
    if (!pwd || pwd.length < 8) { _error('La contraseña debe tener mínimo 8 caracteres.'); return; }
    if (pwd !== pwd2) { _error('Las contraseñas no coinciden.'); return; }

    // Hashear contraseña con SHA-256 (mismo algoritmo que el login)
    let passwordHash;
    try {
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(pwd));
      passwordHash = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
    } catch(_) { _error('Error al procesar la contraseña.'); return; }

    const btn = $('usr-submit-btn');
    btn.disabled = true;
    btn.textContent = 'Creando…';
    showLoading(true);

    try {
      const res = await API.userCreate({
        username,
        passwordHash,
        nombre,
        rol,
        notas: $('usr-notas')?.value.trim() || '',
      });

      if (res.ok) {
        toast(`Usuario "${username}" creado correctamente.`, 'success');
        _cerrarModal();
        _cargar();
      } else {
        _error(res.message || 'Error al crear el usuario.');
      }
    } catch(_) { _error('Error de conexión.'); }
    finally {
      btn.disabled = false;
      btn.textContent = 'Crear Usuario';
      showLoading(false);
    }
  }

  // ── Toggle activo/inactivo ────────────────────────────────
  async function _toggle(idUsuario, estaActivo) {
    const accion = estaActivo ? 'desactivar' : 'activar';
    if (!confirm(`¿${accion.charAt(0).toUpperCase() + accion.slice(1)} este usuario?`)) return;
    showLoading(true);
    try {
      const res = await API.userToggle({ id: idUsuario });
      if (res.ok) {
        toast(`Usuario ${accion}do.`, 'success');
        _cargar();
      } else {
        toast(res.message, 'error');
      }
    } catch(_) { toast('Error de conexión.', 'error'); }
    finally { showLoading(false); }
  }

  function _error(msg) {
    const errBox = $('usr-error');
    if (errBox) { errBox.textContent = msg; errBox.classList.remove('hidden'); }
  }

  return { render, init, _toggle };
})();
