/* ============================================================
   CredyFast — caja.js  |  Módulo de Caja (NUEVO — Fase B)
   Cajero: saldo, retiros, venta contado, vaciar cartera
   Supervisor+: corte de caja
   ============================================================ */

const Caja = (() => {

  let _saldoData = null;
  let _productos = [];

  function render() {
    const user  = State.get('user');
    const esSup = ['SuperUsuario','Supervisor'].includes(user?.rol);

    return `
    <div>
      <div class="section-header">
        <h2>Caja</h2>
        <button class="btn btn-outline btn-sm" id="caja-refresh">↻ Actualizar</button>
      </div>

      <div class="caja-layout">

        <!-- Panel izquierdo: saldo + acciones -->
        <div>
          <div class="card" style="margin-bottom:14px">
            <div class="saldo-display">
              <div class="saldo-label">Saldo en Caja</div>
              <div class="saldo-main" id="saldo-main">—</div>
              <div class="saldo-sub" id="saldo-sub"></div>
            </div>
            <div style="padding:14px">
              <button class="caja-action-btn" id="btn-caja-pago">
                <span class="caja-btn-icon">💳</span><div><div>Registrar Pago</div><div style="font-size:.75rem;font-weight:400;color:var(--cf-muted)">Ir al POS</div></div>
              </button>
              <button class="caja-action-btn" id="btn-caja-contado">
                <span class="caja-btn-icon">🛒</span><div><div>Venta de Contado</div><div style="font-size:.75rem;font-weight:400;color:var(--cf-muted)">Venta directa</div></div>
              </button>
              <button class="caja-action-btn" id="btn-caja-retiro">
                <span class="caja-btn-icon">💸</span><div><div>Retiro</div><div style="font-size:.75rem;font-weight:400;color:var(--cf-muted)">Retiro de caja</div></div>
              </button>
              <button class="caja-action-btn" id="btn-caja-cartera">
                <span class="caja-btn-icon">🧳</span><div><div>Vaciar Cartera Cobrador</div><div style="font-size:.75rem;font-weight:400;color:var(--cf-muted)">Cobrador entregó dinero</div></div>
              </button>
              ${esSup ? `
              <button class="caja-action-btn" id="btn-caja-corte">
                <span class="caja-btn-icon">📊</span><div><div>Corte de Caja</div><div style="font-size:.75rem;font-weight:400;color:var(--cf-muted)">Reporte del día</div></div>
              </button>` : ''}
            </div>
          </div>

          <!-- Saldo cobradores en campo -->
          <div class="card">
            <div class="card-header"><h3>💼 Cobradores en Campo</h3></div>
            <div id="caja-cobradores"><div class="table-empty">Cargando…</div></div>
          </div>
        </div>

        <!-- Panel derecho: movimientos -->
        <div>
          <div class="card">
            <div class="card-header">
              <h3>Movimientos del Día</h3>
              <div style="display:flex;gap:8px">
                <select id="caja-filtro-tipo" class="btn btn-outline btn-sm" style="font-weight:500">
                  <option value="">Todos</option>
                  <option value="INGRESO">Ingresos</option>
                  <option value="EGRESO">Egresos</option>
                </select>
              </div>
            </div>
            <div id="caja-movimientos"><div class="table-empty">Cargando…</div></div>
          </div>
        </div>
      </div>

      <!-- Modal: Retiro -->
      <div id="modal-retiro" class="hidden" style="position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:200;display:flex;align-items:center;justify-content:center;padding:16px">
        <div class="card" style="width:100%;max-width:400px">
          <div class="card-header"><h3>Retiro de Caja</h3><button class="btn btn-ghost btn-sm" id="modal-retiro-close">✕</button></div>
          <div class="card-body">
            <div class="form-group">
              <label>Tipo de retiro *</label>
              <select id="retiro-tipo">
                <option value="Retiro de respaldo">Retiro de respaldo</option>
                <option value="Retiro de supervisor">Retiro de supervisor</option>
              </select>
            </div>
            <div class="form-group">
              <label>Monto ($) *</label>
              <input type="number" id="retiro-monto" class="input-lg" min="0.01" step="0.01" placeholder="0.00">
            </div>
            <div class="form-group">
              <label>Comentarios</label>
              <input type="text" id="retiro-comentarios" placeholder="Motivo del retiro…">
            </div>
            <button class="btn btn-danger btn-full" id="btn-retiro-confirm">💸 Confirmar Retiro</button>
          </div>
        </div>
      </div>

      <!-- Modal: Venta de Contado -->
      <div id="modal-contado" class="hidden" style="position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:200;display:flex;align-items:center;justify-content:center;padding:16px">
        <div class="card" style="width:100%;max-width:440px">
          <div class="card-header"><h3>Venta de Contado</h3><button class="btn btn-ghost btn-sm" id="modal-contado-close">✕</button></div>
          <div class="card-body">
            <div class="form-group">
              <label>Producto *</label>
              <select id="contado-producto"><option value="">-- Selecciona --</option></select>
            </div>
            <div id="contado-precio-info" class="hidden" style="background:var(--cf-bg);border-radius:var(--radius-sm);padding:12px;margin-bottom:12px;font-size:.87rem"></div>
            <div class="form-group">
              <label>Tipo de pago *</label>
              <div class="toggle-group">
                <button class="toggle-btn active" id="contado-efectivo" data-tipo="Efectivo" type="button">Efectivo</button>
                <button class="toggle-btn" id="contado-transfer" data-tipo="Transferencia_o_deposito" type="button">Transferencia</button>
              </div>
            </div>
            <button class="btn btn-success btn-full" id="btn-contado-confirm">🛒 Confirmar Venta</button>
          </div>
        </div>
      </div>

      <!-- Modal: Vaciar Cartera -->
      <div id="modal-cartera" class="hidden" style="position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:200;display:flex;align-items:center;justify-content:center;padding:16px">
        <div class="card" style="width:100%;max-width:420px">
          <div class="card-header"><h3>Vaciar Cartera Cobrador</h3><button class="btn btn-ghost btn-sm" id="modal-cartera-close">✕</button></div>
          <div class="card-body" id="cartera-body"></div>
        </div>
      </div>

      <!-- Modal: Corte de Caja -->
      <div id="modal-corte" class="hidden" style="position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:200;display:flex;align-items:center;justify-content:center;padding:16px">
        <div class="card" style="width:100%;max-width:440px">
          <div class="card-header"><h3>Corte de Caja</h3><button class="btn btn-ghost btn-sm" id="modal-corte-close">✕</button></div>
          <div class="card-body" id="corte-body"></div>
        </div>
      </div>
    </div>`;
  }

  function init() {
    _loadSaldo();
    _loadMovimientos();
    _loadCobradores();

    on('caja-refresh',       'click', () => { _loadSaldo(); _loadMovimientos(); _loadCobradores(); });
    on('caja-filtro-tipo',   'change', _loadMovimientos);
    on('btn-caja-pago',      'click', () => Router.navigate('#/pos'));
    on('btn-caja-retiro',    'click', _openRetiro);
    on('btn-caja-contado',   'click', _openContado);
    on('btn-caja-cartera',   'click', _openCartera);
    on('btn-caja-corte',     'click', _openCorte);
    on('modal-retiro-close',  'click', () => $('modal-retiro').classList.add('hidden'));
    on('modal-contado-close', 'click', () => $('modal-contado').classList.add('hidden'));
    on('modal-cartera-close', 'click', () => $('modal-cartera').classList.add('hidden'));
    on('modal-corte-close',   'click', () => $('modal-corte').classList.add('hidden'));
  }

  // ── Saldo ──────────────────────────────────────────────────
  async function _loadSaldo() {
    try {
      const res = await API.cajaSaldo();
      if (!res.ok) return;
      _saldoData = res;
      setHTML('saldo-main', fmt.currency(res.saldoCaja));
      setHTML('saldo-sub',
        `Campo: ${fmt.currency(res.saldoDomicilio)} · Total: ${fmt.currency(res.saldoTotal)}`);
    } catch(_) {}
  }

  // ── Movimientos ───────────────────────────────────────────
  async function _loadMovimientos() {
    const registro = $('caja-filtro-tipo')?.value;
    const hoy = new Date().toISOString().split('T')[0];
    try {
      const res = await API.cajaMovimientos({ fecha: hoy, ...(registro ? { registro } : {}) });
      if (!res.ok) return;
      setHTML('caja-movimientos', renderTable([
        { key: 'Marca_temporal', label: 'Hora',   render: r => fmt.dateTime(r['Marca_temporal']) },
        { key: 'Registro',       label: 'Tipo',   render: r => `<span class="badge ${r['Registro']==='INGRESO'?'badge-success':'badge-danger'}">${r['Registro']}</span>` },
        { key: 'Monto',          label: 'Monto',  class: 'td-right td-amount', render: r => fmt.currency(r['Monto']) },
        { key: 'Canal',          label: 'Canal',  render: r => `<span class="badge badge-muted">${r['Canal']||'—'}</span>` },
        { key: 'Comentarios',    label: 'Detalle' },
      ], res.data || [], 'Sin movimientos hoy.'));
    } catch(_) {}
  }

  // ── Cobradores ────────────────────────────────────────────
  async function _loadCobradores() {
    try {
      const res = await API.cajaSaldoCobrador();
      if (!res.ok || !res.data?.length) {
        setHTML('caja-cobradores', '<div class="table-empty">Sin cobradores con saldo pendiente.</div>');
        return;
      }
      setHTML('caja-cobradores', renderTable([
        { key: 'cobradorId', label: 'Cobrador' },
        { key: 'saldo', label: 'Saldo en Campo', class: 'td-right td-amount', render: r => fmt.currency(r['saldo']) },
        { key: '_acc', label: '', render: r => `<button class="btn btn-primary btn-sm" onclick="Caja._vaciarCobrador('${r['cobradorId']}',${r['saldo']})">Vaciar</button>` },
      ], res.data, ''));
    } catch(_) {}
  }

  // ── Retiro ────────────────────────────────────────────────
  function _openRetiro() {
    $('modal-retiro').classList.remove('hidden');
    $('modal-retiro').style.display = 'flex';
    on('btn-retiro-confirm', 'click', async () => {
      let monto; try { monto = requireNum($('retiro-monto').value, 'Monto', 0.01); }
      catch(e) { toast(e.message, 'warning'); return; }
      const tipo = $('retiro-tipo').value;
      const comentarios = $('retiro-comentarios').value;
      showLoading(true);
      try {
        const res = await API.cajaRetiro({ monto, tipo, comentarios });
        if (res.ok) { toast(res.message, 'success'); $('modal-retiro').classList.add('hidden'); _loadSaldo(); _loadMovimientos(); }
        else { toast(res.message, 'error'); }
      } catch(_) { toast('Error de conexión.', 'error'); }
      finally { showLoading(false); }
    });
  }

  // ── Venta de Contado ──────────────────────────────────────
  async function _openContado() {
    $('modal-contado').classList.remove('hidden');
    $('modal-contado').style.display = 'flex';
    // Cargar productos disponibles
    if (!_productos.length) {
      try {
        const res = await API.productList();
        if (res.ok) _productos = (res.data||[]).filter(p => p['Estatus']==='DISPONIBLE');
      } catch(_) {}
    }
    const sel = $('contado-producto');
    if (sel) sel.innerHTML = '<option value="">-- Selecciona --</option>' +
      _productos.map(p => `<option value="${p['IDProd']}">${p['MARCA']} ${p['MODELO']} ${p['COLOR']||''}</option>`).join('');

    on('contado-producto', 'change', () => {
      const IDProd = $('contado-producto').value;
      const prod = _productos.find(p => p['IDProd'] === IDProd);
      const info = $('contado-precio-info');
      if (prod && info) {
        info.classList.remove('hidden');
        info.innerHTML = `Precio de contado: <strong style="font-size:1.1rem;color:var(--cf-accent)">${fmt.currency(prod['Precio_de_contado'])}</strong>`;
      } else if (info) info.classList.add('hidden');
    });
    document.querySelectorAll('[data-tipo]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('[data-tipo]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });
    on('btn-contado-confirm', 'click', async () => {
      const IDProd = $('contado-producto').value;
      if (!IDProd) { toast('Selecciona un producto.', 'warning'); return; }
      const tipoActive = document.querySelector('[data-tipo].active');
      const tipo = tipoActive ? tipoActive.dataset.tipo : 'Efectivo';
      showLoading(true);
      try {
        const res = await API.cajaVentaContado({ IDProd, tipo });
        if (res.ok) {
          toast(`✔ Venta registrada: ${fmt.currency(res.monto)} — ${res.tipoPago}`, 'success', 5000);
          $('modal-contado').classList.add('hidden');
          _productos = []; // Reset cache para recargat disponibles
          _loadSaldo(); _loadMovimientos();
        } else { toast(res.message, 'error'); }
      } catch(_) { toast('Error de conexión.', 'error'); }
      finally { showLoading(false); }
    });
  }

  // ── Vaciar Cartera ────────────────────────────────────────
  function _openCartera() {
    _loadCobradores();
    $('modal-cartera').classList.remove('hidden');
    $('modal-cartera').style.display = 'flex';
    setHTML('cartera-body', `
      <p class="text-muted text-sm" style="margin-bottom:14px">Selecciona un cobrador de la lista o ingresa su ID manualmente.</p>
      <div class="form-group"><label>ID Cobrador *</label><input type="text" id="cartera-cobrador-id" placeholder="ID del cobrador"></div>
      <div class="form-group"><label>Monto recibido ($) *</label><input type="number" id="cartera-monto" class="input-lg" min="0.01" step="0.01"></div>
      <div class="form-group"><label>Comentarios</label><input type="text" id="cartera-comentarios"></div>
      <button class="btn btn-primary btn-full" id="btn-cartera-confirm">🧳 Confirmar Vaciado</button>
    `);
    on('btn-cartera-confirm', 'click', async () => {
      const cobradorId = $('cartera-cobrador-id')?.value.trim();
      let monto; try { monto = requireNum($('cartera-monto').value, 'Monto', 0.01); }
      catch(e) { toast(e.message, 'warning'); return; }
      if (!cobradorId) { toast('ID del cobrador es obligatorio.', 'warning'); return; }
      showLoading(true);
      try {
        const res = await API.cajaVaciarCartera({ cobradorId, monto, comentarios: $('cartera-comentarios').value });
        if (res.ok) { toast(res.message, 'success'); $('modal-cartera').classList.add('hidden'); _loadSaldo(); _loadMovimientos(); _loadCobradores(); }
        else { toast(res.message, 'error'); }
      } catch(_) { toast('Error de conexión.', 'error'); }
      finally { showLoading(false); }
    });
  }

  // ── Vaciar cobrador específico desde tabla ─────────────────
  function _vaciarCobrador(cobradorId, saldo) {
    $('modal-cartera').classList.remove('hidden');
    $('modal-cartera').style.display = 'flex';
    setHTML('cartera-body', `
      <div class="alert alert-info" style="margin-bottom:14px">
        Cobrador: <strong>${cobradorId}</strong><br>
        Saldo en campo: <strong>${fmt.currency(saldo)}</strong>
      </div>
      <div class="form-group"><label>Monto recibido ($) *</label><input type="number" id="cartera-monto" class="input-lg" value="${saldo}" min="0.01" step="0.01"></div>
      <div class="form-group"><label>Comentarios</label><input type="text" id="cartera-comentarios"></div>
      <input type="hidden" id="cartera-cobrador-id" value="${cobradorId}">
      <button class="btn btn-primary btn-full" id="btn-cartera-confirm">🧳 Confirmar Vaciado</button>
    `);
    on('btn-cartera-confirm', 'click', async () => {
      let monto; try { monto = requireNum($('cartera-monto').value, 'Monto', 0.01); }
      catch(e) { toast(e.message, 'warning'); return; }
      showLoading(true);
      try {
        const res = await API.cajaVaciarCartera({ cobradorId, monto, comentarios: $('cartera-comentarios').value });
        if (res.ok) { toast(res.message, 'success'); $('modal-cartera').classList.add('hidden'); _loadSaldo(); _loadMovimientos(); _loadCobradores(); }
        else { toast(res.message, 'error'); }
      } catch(_) { toast('Error de conexión.', 'error'); }
      finally { showLoading(false); }
    });
  }

  // ── Corte de Caja ─────────────────────────────────────────
  function _openCorte() {
    $('modal-corte').classList.remove('hidden');
    $('modal-corte').style.display = 'flex';
    const hoy = new Date().toISOString().split('T')[0];
    setHTML('corte-body', `
      <div class="form-group">
        <label>Fecha del corte</label>
        <input type="date" id="corte-fecha" value="${hoy}">
      </div>
      <button class="btn btn-primary btn-full" id="btn-corte-preview">📊 Generar Corte</button>
      <div id="corte-result" class="hidden" style="margin-top:14px"></div>
    `);
    on('btn-corte-preview', 'click', async () => {
      const fecha = $('corte-fecha').value;
      showLoading(true);
      try {
        const res = await API.cajaCorte({ fecha });
        if (res.ok) {
          setHTML('corte-result', `
            <div style="background:var(--cf-bg);border-radius:var(--radius-sm);padding:14px;font-size:.87rem">
              <div style="font-weight:700;margin-bottom:8px">Corte del ${res.fecha}</div>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
                <div><div class="text-muted text-sm">Ingresos</div><div style="color:var(--cf-accent);font-weight:700">${fmt.currency(res.ingresos)}</div></div>
                <div><div class="text-muted text-sm">Egresos</div><div style="color:var(--cf-danger);font-weight:700">${fmt.currency(res.egresos)}</div></div>
                <div><div class="text-muted text-sm">Neto</div><div style="font-weight:800;font-size:1.1rem">${fmt.currency(res.neto)}</div></div>
                <div><div class="text-muted text-sm">Movimientos</div><div>${res.totalMovimientos}</div></div>
              </div>
              <p style="font-size:.75rem;color:var(--cf-muted);margin-top:10px">${res.message}</p>
            </div>
          `);
          $('corte-result').classList.remove('hidden');
          toast('Corte generado y registrado en el sistema.', 'success');
        } else { toast(res.message, 'error'); }
      } catch(_) { toast('Error de conexión.', 'error'); }
      finally { showLoading(false); }
    });
  }

  return { render, init, _vaciarCobrador };
})();
