/* ============================================================
   CredyFast — dashboard.js  |  Dashboard Supervisor/Admin
   ============================================================ */

const Dashboard = (() => {

  function render() {
    return `
    <div class="dashboard-view">
      <div class="section-header">
        <h2>Resumen Operativo</h2>
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
    </div>`;
  }

  function _statsSkeleton() {
    return `
      <div class="stat-card" style="--stat-accent:var(--cf-teal)">
        <div class="stat-label">Saldo en Caja</div>
        <div class="stat-value" id="stat-caja">—</div>
        <div class="stat-sub">Saldo actual</div>
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
    await _load();
  }

  async function _load() {
    showLoading(true);
    try {
      const res = await API.dashboardData();
      if (!res.ok) { toast('Error cargando dashboard.', 'error'); return; }
      const d = res.data || res;
      _renderStats(d);
      _renderPagos(d.pagos || []);
      _renderCreditos(d.creditos || []);
    } catch(_) { toast('Error de conexión.', 'error'); }
    finally { showLoading(false); }
  }

  function _renderStats(d) {
    setHTML('stat-caja',      fmt.currency(d.caja?.saldo ?? d.saldoCaja ?? 0));
    setHTML('stat-activos',   d.creditosActivos ?? '—');
    setHTML('stat-morosos',   d.creditosMorosos ?? '—');
    setHTML('stat-ingresos',  fmt.currency(d.ingresosDia ?? 0));
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

  return { render, init };
})();
