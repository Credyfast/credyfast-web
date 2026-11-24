/* ============================================================
   CredyFast — dashboard.js  |  Dashboard Supervisor/Admin
   ============================================================ */

const Dashboard = (() => {

  let _retirosData = [];
  let _retirosVisibles = 5;
  let _arqueosData = [];
  let _arqueosVisibles = 5;

  function render() {
    return `
    <div class="dashboard-view">
      <div class="section-header">
        <div>
          <h2>Resumen Operativo</h2>
          <p id="dash-sucursal-label" style="font-size:.82rem;color:var(--cf-teal-light);margin:2px 0 0"></p>
        </div>
        <button class="btn btn-outline btn-sm" id="dash-refresh">↻ Actualizar</button>
      </div>

      <div class="stats-grid" id="dash-stats">
        ${_statsSkeleton()}
      </div>

      <div class="dashboard-tables">
        <div class="card">
          <div class="card-header"><h3>Últimos Pagos</h3></div>
          <div id="dash-pagos"><div class="table-empty">Cargando...</div></div>
        </div>
        <div class="card">
          <div class="card-header"><h3>Créditos Recientes</h3></div>
          <div id="dash-creditos"><div class="table-empty">Cargando...</div></div>
        </div>
      </div>

      <!-- Tabla exclusiva: Retiros de Supervisor -->
      <div class="card" style="margin-top:20px">
        <div class="card-header" style="display:flex;justify-content:space-between;align-items:center">
          <div>
            <h3>Retiros de Supervisor</h3>
            <span style="font-size:.78rem;color:var(--cf-text-secondary)">Historial de retiros de caja autorizados</span>
          </div>
          <span id="dash-retiros-badge" class="badge badge-info">0 retiros</span>
        </div>
        <div id="dash-retiros-container">
          <div id="dash-retiros-table"><div class="table-empty">Cargando...</div></div>
          <div id="dash-retiros-actions" class="hidden" style="padding:12px;text-align:center;border-top:1px solid var(--cf-border);background:var(--cf-surface-2)">
            <button class="btn btn-outline btn-sm" id="dash-retiros-more" type="button">
              ⬇ Cargar 5 más (<span id="dash-retiros-count"></span>)
            </button>
          </div>
        </div>
      </div>

      <!-- Tabla exclusiva: Arqueos de Caja -->
      <div class="card" style="margin-top:20px">
        <div class="card-header" style="display:flex;justify-content:space-between;align-items:center">
          <div>
            <h3>Arqueos de Caja</h3>
            <span style="font-size:.78rem;color:var(--cf-text-secondary)">Historial de cortes físicos y arqueos realizados</span>
          </div>
          <span id="dash-arqueos-badge" class="badge badge-info">0 arqueos</span>
        </div>
        <div id="dash-arqueos-container">
          <div id="dash-arqueos-table"><div class="table-empty">Cargando...</div></div>
          <div id="dash-arqueos-actions" class="hidden" style="padding:12px;text-align:center;border-top:1px solid var(--cf-border);background:var(--cf-surface-2)">
            <button class="btn btn-outline btn-sm" id="dash-arqueos-more" type="button">
              ⬇ Cargar 5 más (<span id="dash-arqueos-count"></span>)
            </button>
          </div>
        </div>
      </div>
    </div>`;
  }

  function _statsSkeleton() {
    return `
      <div class="stat-card" style="--stat-accent:var(--cf-teal)">
        <div class="stat-label">Saldo en Caja</div>
        <div class="stat-value" id="stat-caja">—</div>
        <div class="stat-sub">Efectivo físico</div>
      </div>
      <div class="stat-card" style="--stat-accent:#0284c7">
        <div class="stat-label">Saldo en Cuenta</div>
        <div class="stat-value" id="stat-cuenta">—</div>
        <div class="stat-sub">Transf. y depósitos</div>
      </div>
      <div class="stat-card" style="--stat-accent:var(--cf-accent)">
        <div class="stat-label">Créditos Activos</div>
        <div class="stat-value" id="stat-activos">—</div>
        <div class="stat-sub">En operación</div>
      </div>
      <div class="stat-card" style="--stat-accent:var(--cf-danger)">
        <div class="stat-label">Créditos Morosos</div>
        <div class="stat-value" id="stat-morosos">—</div>
        <div class="stat-sub">Con atraso crítico</div>
      </div>
      <div class="stat-card" style="--stat-accent:var(--cf-gold)">
        <div class="stat-label">Ingresos del Día</div>
        <div class="stat-value" id="stat-ingresos">—</div>
        <div class="stat-sub">Pagos registrados hoy</div>
      </div>
      <div class="stat-card" style="--stat-accent:var(--cf-warning)">
        <div class="stat-label">Pendientes Aprob.</div>
        <div class="stat-value" id="stat-pendientes">—</div>
        <div class="stat-sub">Solicitudes en espera</div>
      </div>`;
  }

  async function init() {
    on('dash-refresh', 'click', _load);
    on('dash-retiros-more', 'click', _cargarMasRetiros);
    on('dash-arqueos-more', 'click', _cargarMasArqueos);
    await _load();
  }

  async function _load() {
    showLoading(true);
    try {
      const res = await API.dashboardData();
      if (!res.ok) {
        toast('Error dashboard: ' + (res.message || res.error || 'Desconocido'), 'error');
        setHTML('dash-stats', `<div style="color:var(--cf-danger);padding:16px">Error: ${res.message || res.error}</div>`);
        return;
      }
      const d = res.data || res;
      _renderStats(d);
      _renderPagos(d.pagos || []);
      _renderCreditos(d.creditos || []);
      _retirosData = d.retirosSupervisor || [];
      _retirosVisibles = 5;
      _renderRetiros();
      _arqueosData = d.arqueos || [];
      _arqueosVisibles = 5;
      _renderArqueos();
    } catch(err) { toast('Error de conexión: ' + err.message, 'error'); }
    finally { showLoading(false); }
  }

  function _renderStats(d) {
    // Etiqueta de sucursal activa
    const labelEl = $('dash-sucursal-label');
    if (labelEl) {
      labelEl.textContent = d.sucursalNombre && d.sucursalNombre !== 'Global'
        ? '🏢 Datos de sucursal: ' + d.sucursalNombre
        : '🌐 Vista consolidada — todas las sucursales';
    }

    setHTML('stat-caja',       fmt.currency(d.saldoCaja ?? d.caja?.saldo ?? 0));
    setHTML('stat-cuenta',     fmt.currency(d.saldoCuenta ?? 0));
    setHTML('stat-activos',    d.creditosActivos ?? '—');
    setHTML('stat-morosos',    d.creditosMorosos ?? '—');
    setHTML('stat-ingresos',   fmt.currency(d.ingresosDia ?? 0));
    setHTML('stat-pendientes', d.pendientesAprobacion ?? '—');
  }

  function _renderPagos(pagos) {
    setHTML('dash-pagos', renderTable([
      { key: 'ID_Credito',     label: 'Crédito',  class: 'td-mono' },
      { key: 'Num_Semana',     label: 'Sem.',      render: r => `Sem. ${r['Num_Semana']}` },
      { key: 'Monto_Pagado',   label: 'Monto',     class: 'td-amount td-right', render: r => fmt.currency(r['Monto_Pagado']) },
      { key: 'Estado_Pago',    label: 'Estado',    render: r => badgeEstado(r['Estado_Pago']) },
      { key: 'Fecha_Ultimo_Abono', label: 'Fecha', render: r => fmt.dateTime(r['Fecha_Ultimo_Abono']) },
    ], pagos, 'Sin pagos recientes.'));
  }

  function _renderCreditos(creditos) {
    setHTML('dash-creditos', renderTable([
      { key: 'ID_Credito',  label: 'ID',          class: 'td-mono' },
      { key: 'ID_Cliente',  label: 'Cliente',     class: 'td-mono' },
      { key: 'Estado',      label: 'Estado',      render: r => badgeEstado(r['Estado']) },
      { key: 'Estado_Operativo', label: 'Operativo', render: r => badgeEstado(r['Estado_Operativo']) },
      { key: 'Fecha_Aprobacion', label: 'Aprobado', render: r => fmt.date(r['Fecha_Aprobacion']) },
    ], creditos, 'Sin créditos recientes.'));
  }

  function _renderRetiros() {
    const total = _retirosData.length;
    setHTML('dash-retiros-badge', `${total} retiro${total !== 1 ? 's' : ''}`);

    if (total === 0) {
      setHTML('dash-retiros-table', '<div class="table-empty">Sin retiros de supervisor registrados.</div>');
      const actions = $('dash-retiros-actions');
      if (actions) actions.classList.add('hidden');
      return;
    }

    const mostrados = _retirosData.slice(0, _retirosVisibles);
    setHTML('dash-retiros-table', `
      <div class="dash-retiros-scroll-wrap">
        ${renderTable([
          { key: 'Fecha',          label: 'Fecha y Hora', render: r => fmt.dateTime(r['Fecha']) },
          { key: 'Monto',          label: 'Monto',        class: 'td-amount td-right', render: r => `<strong style="color:var(--cf-danger)">-${fmt.currency(r['Monto'])}</strong>` },
          { key: 'Tipo',           label: 'Método',       render: r => `<span class="badge badge-info">${r['Tipo']}</span>` },
          { key: 'Comentarios',    label: 'Motivo / Comentarios', render: r => r['Comentarios'] ? `<span>${r['Comentarios']}</span>` : '<span style="color:var(--cf-muted)">—</span>' },
          { key: 'Registrado_por', label: 'Cajero',       class: 'td-mono', render: r => r['Registrado_por'] || '—' },
          { key: 'Sucursal',       label: 'Sucursal',     render: r => `<span class="badge">${r['Sucursal'] || '—'}</span>` },
        ], mostrados, 'Sin retiros de supervisor registrados.')}
      </div>
    `);

    const actions = $('dash-retiros-actions');
    if (actions) {
      if (_retirosVisibles < total) {
        actions.classList.remove('hidden');
        const restantes = total - _retirosVisibles;
        const prox = Math.min(5, restantes);
        setHTML('dash-retiros-count', `mostrando ${mostrados.length} de ${total}`);
        const btnMore = $('dash-retiros-more');
        if (btnMore) btnMore.textContent = `⬇ Cargar ${prox} más (mostrando ${mostrados.length} de ${total})`;
      } else {
        actions.classList.add('hidden');
      }
    }
  }

  function _cargarMasRetiros() {
    _retirosVisibles += 5;
    _renderRetiros();
  }

  function _renderArqueos() {
    const total = _arqueosData.length;
    setHTML('dash-arqueos-badge', `${total} arqueo${total !== 1 ? 's' : ''}`);

    if (total === 0) {
      setHTML('dash-arqueos-table', '<div class="table-empty">Sin arqueos de caja registrados.</div>');
      const actions = $('dash-arqueos-actions');
      if (actions) actions.classList.add('hidden');
      return;
    }

    const mostrados = _arqueosData.slice(0, _arqueosVisibles);
    setHTML('dash-arqueos-table', `
      <div class="dash-scroll-wrap">
        ${renderTable([
          { key: 'Fecha',           label: 'Fecha y Hora', render: r => fmt.dateTime(r['Fecha']) },
          { key: 'Cajero_Username', label: 'Cajero',       class: 'td-bold', render: r => `<strong>${r['Cajero_Username']}</strong>` },
          { key: 'Total_Fisico',    label: 'Total Físico', class: 'td-amount td-right', render: r => fmt.currency(r['Total_Fisico']) },
          { key: 'Resultado',       label: 'Resultado',    render: r => badgeEstado(r['Resultado']) },
          { key: 'Supervisado_Por', label: 'Supervisó',    render: r => r['Supervisado_Por'] || '—' },
          { key: 'Sucursal',        label: 'Sucursal',     render: r => `<span class="badge">${r['Sucursal'] || '—'}</span>` },
        ], mostrados, 'Sin arqueos de caja registrados.')}
      </div>
    `);

    const actions = $('dash-arqueos-actions');
    if (actions) {
      if (_arqueosVisibles < total) {
        actions.classList.remove('hidden');
        const restantes = total - _arqueosVisibles;
        const prox = Math.min(5, restantes);
        const btnMore = $('dash-arqueos-more');
        if (btnMore) btnMore.textContent = `⬇ Cargar ${prox} más (mostrando ${mostrados.length} de ${total})`;
      } else {
        actions.classList.add('hidden');
      }
    }
  }

  function _cargarMasArqueos() {
    _arqueosVisibles += 5;
    _renderArqueos();
  }

  return { render, init };
})();
