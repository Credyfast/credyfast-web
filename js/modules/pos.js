/* ============================================================
   CredyFast — pos.js  |  Punto de Venta / Registro de Pagos (Fase B)
   Alineado al schema real del backend (Fase A).
   ============================================================ */

const POS = (() => {

  let _creditoData = null;
  let _clienteData = null;
  let _pagosData = [];

  function render() {
    return `
    <div class="pos-layout">

      <!-- ── COLUMNA IZQUIERDA ── -->
      <div>
        <div class="card" style="padding:16px;margin-bottom:14px">
          <div class="pos-search-bar">
            <input type="text" id="pos-search-input"
              placeholder="Nombre del cliente o ID Cliente (CLxxxxx)…"
              class="input-lg" autocomplete="off" autofocus>
            <button class="btn btn-primary" id="pos-search-btn">🔍 Buscar</button>
          </div>
          <div id="pos-search-error" class="hidden" style="color:var(--cf-danger);font-size:.82rem;margin-top:4px"></div>
        </div>

        <div id="pos-client-panel" class="hidden">
          <div class="pos-client-card card card-body">
            <div class="pos-client-name" id="pos-client-name"></div>
            <div class="pos-client-meta" id="pos-client-meta"></div>
            <div class="pos-credit-status" id="pos-credit-status"></div>
          </div>
          <div class="card" style="margin-top:14px">
            <div class="card-header">
              <h3>Calendario de Pagos</h3>
              <span id="pos-saldo-badge" class="badge badge-info"></span>
            </div>
            <div id="pos-schedule-table"></div>
          </div>
        </div>

        <div id="pos-empty" class="empty-state">
          <div class="empty-icon">💳</div>
          <p>Busca un cliente o crédito para registrar un pago.</p>
        </div>
      </div>

      <!-- ── COLUMNA DERECHA: Panel de cobro ── -->
      <div>
        <div class="cobro-panel" id="cobro-panel">
          <div class="cobro-panel-title">Panel de Cobro</div>

          <div id="cobro-empty-msg" style="color:var(--cf-muted);font-size:.87rem;text-align:center;padding:24px 0">
            Selecciona un crédito para cobrar.
          </div>

          <div id="cobro-form-area" class="hidden">
            <div class="monto-sugerido">
              <span>Monto sugerido:</span>
              <strong id="cobro-monto-sugerido">—</strong>
            </div>
            <div id="cobro-semana-info" style="font-size:.8rem;color:var(--cf-muted);margin-bottom:12px;text-align:center"></div>
            <div class="form-group">
              <label for="cobro-monto-input">Monto a Cobrar ($)</label>
              <input type="number" id="cobro-monto-input" class="input-xl" min="0.01" step="0.01" placeholder="0.00">
            </div>
            <button class="btn btn-success btn-full btn-xl" id="cobro-btn" style="margin-bottom:10px">
              ✔ Registrar Pago
            </button>
            <button class="btn btn-ghost btn-full btn-sm" id="cobro-reset-btn">
              ✕ Cancelar / Nueva búsqueda
            </button>
          </div>

          <div id="cobro-result" class="hidden">
            <div class="ticket-result" id="cobro-ticket">
              <div style="font-size:.82rem;color:var(--cf-muted);margin-bottom:4px">Pago registrado</div>
              <div class="ticket-amount" id="ticket-amount"></div>
              <div class="ticket-detail" id="ticket-semana"></div>
              <div class="ticket-detail" id="ticket-estado"></div>
              <div class="ticket-detail" id="ticket-saldo"></div>
              <div class="ticket-detail" id="ticket-finalizado" style="color:var(--cf-accent);font-weight:800"></div>
            </div>
            <div style="display:flex;gap:8px;margin-top:12px">
              <button class="btn btn-outline btn-full" onclick="window.print()">🖨 Imprimir</button>
              <button class="btn btn-ghost btn-full" id="cobro-nuevo-btn">Nuevo cobro</button>
            </div>
          </div>
        </div>
      </div>

    </div>`;
  }

  function init() {
    _creditoData = null; _clienteData = null; _pagosData = [];
    const input = $('pos-search-input');
    if (input) { input.focus(); input.addEventListener('keydown', e => { if (e.key === 'Enter') _buscar(); }); }
    on('pos-search-btn', 'click', _buscar);
    on('cobro-btn', 'click', _cobrar);
    on('cobro-reset-btn', 'click', _reset);
    on('cobro-nuevo-btn', 'click', _reset);
    on('cobro-monto-input', 'keydown', e => { if (e.key === 'Enter') _cobrar(); });
  }

  // ── Búsqueda ───────────────────────────────────────────────
  async function _buscar() {
    const query = $('pos-search-input').value.trim();
    $('pos-search-error').classList.add('hidden');
    if (!query) {
      $('pos-search-error').textContent = 'Ingresa el nombre o ID del cliente.';
      $('pos-search-error').classList.remove('hidden');
      return;
    }
    showLoading(true);
    try {
      // Si parece un ID de crédito → cargar schedule directamente
      if (query.toUpperCase().startsWith('CR')) {
        await _loadSchedule(query.toUpperCase());
        return;
      }

      // Buscar por nombre o IDCliente
      const res = await API.pagoBuscarCliente({ query });
      if (!res.ok) { _showSearchError(res.message || 'No encontrado.'); return; }

      const resultados = res.resultados || [];
      if (!resultados.length) { _showSearchError('No se encontraron clientes.'); return; }

      // Si hay un solo cliente
      if (resultados.length === 1) {
        const { cliente, creditos } = resultados[0];
        _clienteData = cliente;
        if (!creditos.length) { _showSinCredito(cliente); return; }
        // Un solo crédito → cargarlo directo
        if (creditos.length === 1) {
          await _loadSchedule(creditos[0]['IDCredito'], cliente);
          return;
        }
        // Múltiples créditos → mostrar selector
        _mostrarSelectorCreditos(cliente, creditos);
        return;
      }

      // Múltiples clientes → mostrar lista seleccionable
      _mostrarListaClientes(resultados);

    } catch (_) { _showSearchError('Error de conexión.'); }
    finally { showLoading(false); }
  }

  function _mostrarListaClientes(resultados) {
    $('pos-empty').classList.add('hidden');
    $('pos-client-panel').classList.remove('hidden');
    $('cobro-form-area').classList.add('hidden');
    $('cobro-empty-msg').classList.remove('hidden');

    const html = resultados.map(({ cliente, creditos }) => {
      const nombre = cliente['Nombre_completo'] || cliente['IDCliente'];
      const tieneCredito = creditos.length > 0;
      const badgeHtml = tieneCredito
        ? `<span class="badge badge-success" style="margin-left:6px">💳 ${creditos.length} crédito${creditos.length > 1 ? 's' : ''}</span>`
        : `<span class="badge badge-muted" style="margin-left:6px">Sin crédito activo</span>`;
      const creditoId = tieneCredito ? creditos[0]['IDCredito'] : '';
      // Si tiene >1 créditos, el click muestra el selector; si tiene 1, va directo
      const onclick = !tieneCredito ? '' :
        creditos.length > 1
          ? `POS._seleccionarConMultiples('${cliente['IDCliente']}')`
          : `POS._seleccionarCliente('${cliente['IDCliente']}','${creditoId}')`;
      const subInfo = tieneCredito
        ? (creditos.length === 1 ? ` · Crédito: ${creditoId}` : ` · ${creditos.length} créditos activos`)
        : '';
      return `
        <div class="list-item" style="cursor:${tieneCredito ? 'pointer' : 'default'};opacity:${tieneCredito ? 1 : 0.5}"
             onclick="${onclick}">
          <div class="list-item-title">${nombre}${badgeHtml}</div>
          <div class="list-item-sub">${cliente['IDCliente']}${subInfo}</div>
        </div>`;
    }).join('');

    setHTML('pos-schedule-table', `
      <div style="padding:8px 0 4px;font-size:.82rem;font-weight:600;color:var(--cf-text-secondary);text-transform:uppercase">Se encontraron ${resultados.length} clientes — selecciona uno:</div>
      <div style="max-height:400px;overflow-y:auto">${html}</div>
    `);
    setHTML('pos-client-name', `${resultados.length} clientes encontrados`);
    setHTML('pos-client-meta', '');
    setHTML('pos-credit-status', '');
    setHTML('pos-saldo-badge', '');
  }

  // ── Selector de crédito cuando un cliente tiene más de uno ─
  function _mostrarSelectorCreditos(cliente, creditos) {
    _clienteData = cliente;
    $('pos-empty').classList.add('hidden');
    $('pos-client-panel').classList.remove('hidden');
    $('cobro-form-area').classList.add('hidden');
    $('cobro-empty-msg').classList.remove('hidden');

    setHTML('pos-client-name', cliente['Nombre_completo'] || cliente['IDCliente']);
    setHTML('pos-client-meta', `<span>📋 ${cliente['IDCliente']}</span>`);
    setHTML('pos-credit-status', '');
    setHTML('pos-saldo-badge', '');

    const items = creditos.map(cr => {
      const atrasadas = parseInt(cr['semanasAtrasadas']) || 0;
      const completos  = parseInt(cr['pagosCompletos'])  || 0;
      const total      = parseInt(cr['totalPagos'])      || 0;
      const badge = atrasadas > 0
        ? `<span class="badge badge-danger" style="margin-left:6px">${atrasadas} atrasada${atrasadas > 1 ? 's' : ''}</span>`
        : `<span class="badge badge-success" style="margin-left:6px">Al corriente</span>`;
      const proxFecha = cr['proximoPago'] ? cr['proximoPago']['Fecha_programada'] || '' : '';
      return `
        <div class="list-item" style="cursor:pointer"
             onclick="POS._seleccionarCliente('${cliente['IDCliente']}','${cr['IDCredito']}')">
          <div class="list-item-title">💳 ${cr['IDCredito']}${badge}</div>
          <div class="list-item-sub">Progreso: ${completos}/${total} pagos${proxFecha ? ' · Próximo: ' + proxFecha : ''}</div>
        </div>`;
    }).join('');

    setHTML('pos-schedule-table', `
      <div style="padding:8px 0 6px;font-size:.82rem;font-weight:700;color:var(--cf-text-secondary);text-transform:uppercase">Selecciona el crédito a cobrar:</div>
      <div>${items}</div>
    `);
  }

  // Busca los créditos del cliente y muestra el selector (llamado desde onclick)
  async function _seleccionarConMultiples(IDCliente) {
    showLoading(true);
    try {
      const [cRes, bRes] = await Promise.all([
        API.clientGet({ id: IDCliente }),
        API.pagoBuscarCliente({ query: IDCliente }),
      ]);
      const cliente = cRes.ok ? cRes.data : { IDCliente };
      if (bRes.ok && bRes.resultados?.length) {
        _mostrarSelectorCreditos(cliente, bRes.resultados[0].creditos);
      } else {
        _showSearchError('No se encontraron créditos para este cliente.');
      }
    } catch (_) { _showSearchError('Error al cargar créditos.'); }
    finally { showLoading(false); }
  }

  async function _seleccionarCliente(IDCliente, IDCredito) {
    showLoading(true);
    try {
      const cRes = await API.clientGet({ id: IDCliente });
      if (cRes.ok) _clienteData = cRes.data;
      await _loadSchedule(IDCredito, _clienteData);
    } catch (_) { _showSearchError('Error al cargar el cliente.'); }
    finally { showLoading(false); }
  }

  async function _loadSchedule(IDCredito, clientePreloaded = null) {
    const res = await API.pagoSchedule({ IDCredito });
    if (!res.ok) { _showSearchError(res.message || 'Crédito no encontrado.'); return; }
    _creditoData = res.credito;
    _pagosData = res.pagos || [];
    if (clientePreloaded) {
      _clienteData = clientePreloaded;
    } else {
      // Intentar obtener datos del cliente
      try {
        const cRes = await API.clientGet({ id: _creditoData['IDCliente'] });
        if (cRes.ok) _clienteData = cRes.data;
      } catch (_) { }
    }
    _showClientePanel();
  }

  function _showSearchError(msg) {
    $('pos-search-error').textContent = msg;
    $('pos-search-error').classList.remove('hidden');
    $('pos-client-panel').classList.add('hidden');
    $('pos-empty').classList.remove('hidden');
    $('cobro-form-area').classList.add('hidden');
    $('cobro-empty-msg').classList.remove('hidden');
    $('cobro-result').classList.add('hidden');
  }

  function _showSinCredito(cliente) {
    $('pos-empty').classList.add('hidden');
    $('pos-client-panel').classList.remove('hidden');
    setHTML('pos-client-name', cliente['Nombre_completo'] || cliente['IDCliente']);
    setHTML('pos-client-meta', `<span>${cliente['IDCliente']}</span>`);
    setHTML('pos-credit-status', `<span style="color:var(--cf-muted)">Sin crédito activo</span>`);
    setHTML('pos-schedule-table', '<div class="table-empty">Este cliente no tiene crédito activo (APROVADO).</div>');
  }

  function _showClientePanel() {
    const cr = _creditoData;
    const cl = _clienteData;

    $('pos-empty').classList.add('hidden');
    $('pos-client-panel').classList.remove('hidden');

    setHTML('pos-client-name', cl ? (cl['Nombre_completo'] || cr['Nombre_cliente']) : (cr['Nombre_cliente'] || cr['IDCredito']));
    const metaItems = [
      cl ? `📋 ${cl['IDCliente']}` : '',
      `💳 ${cr['IDCredito']}`,
      `Periodo: ${cr['Periodo']} sem.`,
      cr['Celular'] ? `📞 ${cr['Celular']}` : '',
    ].filter(Boolean).map(s => `<span>${s}</span>`).join('');
    setHTML('pos-client-meta', metaItems);

    const pagosCompletos = _pagosData.filter(p => ['PUNTUAL', 'NORMAL', 'MOROSO'].includes(p['Estatus_de_pago'])).length;
    const totalPagos = _pagosData.length;

    setHTML('pos-credit-status', `
      <div style="flex:1">
        <div style="font-size:.78rem;color:var(--cf-muted)">Estatus</div>
        <div style="font-weight:700">${badgeEstado(cr['ESTATUS'])}</div>
      </div>
      <div style="text-align:right">
        <div style="font-size:.78rem;color:var(--cf-muted)">Progreso</div>
        <div style="font-weight:700;font-size:1rem;color:var(--cf-primary)">${pagosCompletos}/${totalPagos} pagos</div>
      </div>
    `);

    setHTML('pos-saldo-badge', `${pagosCompletos} de ${totalPagos} pagadas`);
    _renderSchedule();
    _enableCobroPanel();
  }

  function _renderSchedule() {
    const headers = [
      { key: 'Semana_num', label: '#', render: r => `<strong>${r['Semana_num'] == 0 ? 'Eng.' : r['Semana_num']}</strong>` },
      { key: 'Fecha_programada', label: 'Vence', render: r => fmt.date(r['Fecha_programada']) },
      { key: 'Monto_esperado', label: 'Esperado', class: 'td-right td-amount', render: r => fmt.currency(r['Monto_esperado']) },
      { key: 'Monto_pagado', label: 'Pagado', class: 'td-right td-amount', render: r => fmt.currency(r['Monto_pagado']) },
      { key: 'Estatus_de_pago', label: 'Estado', render: r => badgeEstado(r['Estatus_de_pago']) },
    ];
    if (!_pagosData.length) {
      setHTML('pos-schedule-table', '<div class="table-empty">Sin cuotas registradas.</div>');
      return;
    }
    const rows = _pagosData.map(p => {
      const estatus = p['Estatus_de_pago'];
      const rowClass = ['PUNTUAL', 'NORMAL', 'MOROSO'].includes(estatus) ? 'cuota-row-puntual' :
        estatus === 'PARCIAL' ? 'cuota-row-parcial' :
          estatus === 'ATRASADO' ? 'cuota-row-atrasada' : '';
      const tds = headers.map(h => `<td class="${h.class || ''}">${h.render ? h.render(p) : (p[h.key] ?? '—')}</td>`).join('');
      return `<tr class="${rowClass}">${tds}</tr>`;
    }).join('');
    const ths = headers.map(h => `<th>${h.label}</th>`).join('');
    setHTML('pos-schedule-table',
      `<div class="table-wrap"><table><thead><tr>${ths}</tr></thead><tbody>${rows}</tbody></table></div>`
    );
  }

  function _enableCobroPanel() {
    $('cobro-empty-msg').classList.add('hidden');
    $('cobro-result').classList.add('hidden');
    $('cobro-form-area').classList.remove('hidden');

    const total = parseInt(_creditoData['Periodo']) || _pagosData.length - 1;

    // Separar atrasados y próximo por cobrar
    const atrasados = _pagosData.filter(p =>
      p['Estatus_de_pago'] === 'ATRASADO' || p['Estatus_de_pago'] === 'PARCIAL'
    );
    const siguientePorCobrar = _pagosData.find(p =>
      p['Estatus_de_pago'] === 'POR COBRAR'
    );

    let montoSug = 0;
    let infoText = '';

    if (atrasados.length === 0 && !siguientePorCobrar) {
      // Todo pagado
      infoText = 'Sin pagos pendientes';

    } else if (atrasados.length === 0) {
      // Cliente al corriente → solo la siguiente semana
      const faltante = Math.max(0,
        parseFloat(siguientePorCobrar['Monto_esperado']) -
        parseFloat(siguientePorCobrar['Monto_pagado'] || 0)
      );
      montoSug = faltante;
      const semNum = parseInt(siguientePorCobrar['Semana_num']);
      infoText = semNum === 0
        ? 'Cobro: <strong>Enganche</strong>'
        : `Semana <strong>${semNum}</strong> de ${total}`;

    } else {
      // Cliente con atrasos → suma todos los atrasados + siguiente por cobrar
      let sumaAtrasados = 0;
      atrasados.forEach(p => {
        sumaAtrasados += Math.max(0,
          parseFloat(p['Monto_esperado']) - parseFloat(p['Monto_pagado'] || 0)
        );
      });

      const montoSiguiente = siguientePorCobrar
        ? Math.max(0,
          parseFloat(siguientePorCobrar['Monto_esperado']) -
          parseFloat(siguientePorCobrar['Monto_pagado'] || 0)
        )
        : 0;

      montoSug = sumaAtrasados + montoSiguiente;

      const semsAtrasadas = atrasados.length;
      infoText = `<span style="color:var(--cf-danger)">${semsAtrasadas} sem. atrasada${semsAtrasadas > 1 ? 's' : ''}</span>` +
        (siguientePorCobrar ? ' + siguiente' : '');
    }

    setHTML('cobro-monto-sugerido', fmt.currency(montoSug));
    setHTML('cobro-semana-info', infoText);

    const input = $('cobro-monto-input');
    if (input) { input.value = montoSug > 0 ? montoSug.toFixed(2) : ''; setTimeout(() => input.focus(), 50); }
  }

  // ── Registrar pago ─────────────────────────────────────────
  async function _cobrar() {
    if (!_creditoData) return;
    let monto;
    try { monto = requireNum($('cobro-monto-input').value, 'Monto', 0.01); }
    catch (err) { toast(err.message, 'warning'); return; }

    const btn = $('cobro-btn');
    btn.disabled = true; btn.textContent = 'Procesando…';
    showLoading(true);
    try {
      const res = await API.pagoRegistrar({
        IDCredito: _creditoData['IDCredito'],
        montoRecibido: monto,
        canal: 'CAJA',
      });
      if (!res.ok) { toast(res.message || 'Error al registrar pago.', 'error'); return; }
      _showTicket(res, monto);
      toast('✔ Pago registrado correctamente.', 'success');
    } catch (_) { toast('Error de conexión al registrar pago.', 'error'); }
    finally { btn.disabled = false; btn.textContent = '✔ Registrar Pago'; showLoading(false); }
  }

  function _showTicket(res) {
    $('cobro-form-area').classList.add('hidden');
    $('cobro-result').classList.remove('hidden');

    const semActual = res.semanaActual;
    const semLabel = semActual === 0 ? 'Enganche' : `Semana ${semActual}`;
    const totalSem = res.totalSemanas || '?';

    setHTML('ticket-amount', fmt.currency(res.montoRecibido));
    setHTML('ticket-semana', semActual !== null
      ? `${semLabel} de ${totalSem} (${res.semanasRestantes} restantes)` : '');
    setHTML('ticket-estado', res.pagoCompleto ? '✔ Pago completo' :
      `⚠ Pago PARCIAL — Pendiente: ${fmt.currency(res.montoRestante)}`);
    setHTML('ticket-saldo', '');
    setHTML('ticket-finalizado', res.creditoFinalizado ? '🎉 ¡CRÉDITO COMPLETADO! Producto VENDIDO' : '');
  }

  function _reset() {
    _creditoData = null; _clienteData = null; _pagosData = [];
    if ($('pos-search-input')) { $('pos-search-input').value = ''; $('pos-search-input').focus(); }
    $('pos-search-error').classList.add('hidden');
    $('pos-client-panel').classList.add('hidden');
    $('pos-empty').classList.remove('hidden');
    $('cobro-form-area').classList.add('hidden');
    $('cobro-result').classList.add('hidden');
    $('cobro-empty-msg').classList.remove('hidden');
  }

  return { render, init, _seleccionarCliente, _seleccionarConMultiples };
})();
