/* ============================================================
   CredyFast — pos.js  |  Punto de Venta / Registro de Pagos (Fase B)
   Alineado al schema real del backend (Fase A).
   ============================================================ */

const POS = (() => {

  let _creditoData = null;
  let _clienteData = null;
  let _pagosData = [];
  let _lastTicketPrintUrl = null;

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
            <button class="btn btn-primary" id="pos-search-btn">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:6px"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>Buscar
            </button>
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
          <div class="empty-icon">
            <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="color:var(--cf-text-secondary)"><rect x="2" y="4" width="20" height="16" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/><line x1="6" y1="15" x2="10" y2="15"/></svg>
          </div>
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
            <!-- Selector tipo de pago pago normal -->
            <div class="form-group" style="margin-bottom:10px">
              <label style="font-size:.78rem;font-weight:600;color:var(--cf-text-secondary)">Método de pago</label>
              <div class="toggle-group" id="pos-tipo-grupo">
                <button class="toggle-btn active" data-pos-tipo="Efectivo" type="button">💵 Efectivo</button>
                <button class="toggle-btn" data-pos-tipo="Transferencia_o_deposito" type="button">🏦 Transf/Depósito</button>
              </div>
              <div id="pos-tipo-aviso" style="font-size:.72rem;color:var(--cf-muted);margin-top:4px">💵 Entra al cajón físico — suma al Saldo en Caja</div>
            </div>
            <button class="btn btn-success btn-full btn-xl" id="cobro-btn" style="margin-bottom:10px">
              ✔ Registrar Pago
            </button>
            <button class="btn btn-ghost btn-full btn-sm" id="cobro-reset-btn">
              ✕ Cancelar / Nueva búsqueda
            </button>

            <div style="border-top:1px solid var(--cf-border);margin-top:14px;padding-top:12px">
              <div style="font-size:.72rem;color:var(--cf-text-secondary);text-transform:uppercase;font-weight:600;margin-bottom:8px">Opciones adicionales</div>
              <div style="display:flex;gap:8px">
                <button class="btn btn-outline btn-sm" id="cobro-btn-capital" style="flex:1;font-size:.75rem">💰 Abonar a Capital</button>
                <button class="btn btn-outline btn-sm" id="cobro-btn-liquidar" style="flex:1;font-size:.75rem">🔒 Liquidar</button>
              </div>

              <!-- Panel: Abonar a Capital -->
              <div id="cobro-capital-panel" class="hidden" style="margin-top:10px;background:var(--cf-bg);border:1px solid var(--cf-border);border-radius:var(--radius-sm);padding:12px">
                <div style="font-size:.8rem;font-weight:600;margin-bottom:8px">Abono a Capital</div>
                <div id="cobro-capital-info" style="font-size:.78rem;color:var(--cf-text-secondary);margin-bottom:8px"></div>
                <div id="cobro-capital-alerta" class="hidden" style="font-size:.78rem;color:var(--cf-danger);margin-bottom:8px;padding:8px;background:rgba(239,68,68,.08);border-radius:4px"></div>
                <div id="cobro-capital-form" class="hidden">
                  <div class="form-group" style="margin-bottom:8px">
                    <label style="font-size:.78rem">Monto a abonar a capital ($)</label>
                    <input type="number" id="cobro-capital-monto" min="0.01" step="0.01" placeholder="0.00" style="font-size:.9rem">
                  </div>
                  <!-- Selector tipo de pago capital -->
                  <div style="margin-bottom:8px">
                    <div style="font-size:.72rem;font-weight:600;color:var(--cf-text-secondary);margin-bottom:4px">Método de pago</div>
                    <div class="toggle-group" id="capital-tipo-grupo">
                      <button class="toggle-btn active" data-capital-tipo="Efectivo" type="button">💵 Efectivo</button>
                      <button class="toggle-btn" data-capital-tipo="Transferencia_o_deposito" type="button">🏦 Transf/Dep</button>
                    </div>
                    <div id="capital-tipo-aviso" style="font-size:.7rem;color:var(--cf-muted);margin-top:3px">💵 Suma al Saldo en Caja</div>
                  </div>
                  <button class="btn btn-primary btn-full btn-sm" id="cobro-capital-confirmar">✔ Confirmar Abono a Capital</button>
                </div>
              </div>

              <!-- Panel: Liquidar -->
              <div id="cobro-liquidar-panel" class="hidden" style="margin-top:10px;background:var(--cf-bg);border:1px solid var(--cf-border);border-radius:var(--radius-sm);padding:12px">
                <div style="font-size:.8rem;font-weight:600;margin-bottom:8px">Cálculo de Liquidación</div>
                <!-- Selector tipo de pago liquidar -->
                <div style="margin-bottom:8px">
                  <div style="font-size:.72rem;font-weight:600;color:var(--cf-text-secondary);margin-bottom:4px">Método de pago</div>
                  <div class="toggle-group" id="liquidar-tipo-grupo">
                    <button class="toggle-btn active" data-liq-tipo="Efectivo" type="button">💵 Efectivo</button>
                    <button class="toggle-btn" data-liq-tipo="Transferencia_o_deposito" type="button">🏦 Transf/Dep</button>
                  </div>
                  <div id="liquidar-tipo-aviso" style="font-size:.7rem;color:var(--cf-muted);margin-top:3px">💵 Suma al Saldo en Caja</div>
                </div>
                <div id="cobro-liquidar-detalle" style="font-size:.8rem"></div>
              </div>
            </div>
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
              <button class="btn btn-outline btn-full" id="cobro-termica-btn" disabled>🖨 Preparando Ticket...</button>
            </div>
            <div style="display:flex;gap:8px;margin-top:8px">
              <button class="btn btn-ghost btn-full" id="cobro-pdf-btn" disabled>Generando PDF...</button>
              <button class="btn btn-primary btn-full" id="cobro-nuevo-btn">Nuevo cobro</button>
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
    on('cobro-btn-capital',  'click', _toggleCapitalPanel);
    on('cobro-btn-liquidar', 'click', _toggleLiquidarPanel);

    // Inicializar toggle de tipo de pago (pago normal)
    _initTipoPagoToggle('pos-tipo-grupo', 'pos-tipo-aviso', 'data-pos-tipo');
  }

  // ── Helper: selector de método de pago en paneles del POS ────
  function _initTipoPagoToggle(grupoId, avisoId, attr) {
    const grupo = $(grupoId);
    if (!grupo) return;
    grupo.querySelectorAll('[' + attr + ']').forEach(function(btn) {
      btn.addEventListener('click', function() {
        grupo.querySelectorAll('[' + attr + ']').forEach(function(b) { b.classList.remove('active'); });
        btn.classList.add('active');
        const aviso = $(avisoId);
        if (aviso) {
          if (btn.getAttribute(attr) === 'Efectivo') {
            aviso.textContent = '💵 Entra al cajón físico — suma al Saldo en Caja';
            aviso.style.color = 'var(--cf-muted)';
          } else {
            aviso.textContent = '🏦 Ingreso bancario — suma al Saldo en Cuenta (no al cajón)';
            aviso.style.color = '#0284c7';
          }
        }
      });
    });
  }

  function _getTipoPago(attr) {
    const active = document.querySelector('[' + attr + '].active');
    return active ? active.getAttribute(attr) : 'Efectivo';
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
      const esC1M      = Boolean(cr['infoContado1Mes'] || cr['Modalidad'] === 'CONTADO_1MES');
      const badge = esC1M
        ? `<span class="badge" style="background:#059669;color:#fff;margin-left:6px">🌟 Contado 1 Mes</span>`
        : (atrasadas > 0
          ? `<span class="badge badge-danger" style="margin-left:6px">${atrasadas} atrasada${atrasadas > 1 ? 's' : ''}</span>`
          : `<span class="badge badge-success" style="margin-left:6px">Al corriente</span>`);
      const proxFecha = cr['proximoPago'] ? cr['proximoPago']['Fecha_programada'] || '' : '';
      const subInfo = esC1M && cr['infoContado1Mes']
        ? `Saldo contado: ${fmt.currency(cr['infoContado1Mes'].saldoPendiente)} · Quedan ${cr['infoContado1Mes'].diasRestantes} días`
        : `Progreso: ${completos}/${total} pagos${proxFecha ? ' · Próximo: ' + proxFecha : ''}`;
      return `
        <div class="list-item" style="cursor:pointer"
             onclick="POS._seleccionarCliente('${cliente['IDCliente']}','${cr['IDCredito']}')">
          <div class="list-item-title">💳 ${cr['IDCredito']}${badge}</div>
          <div class="list-item-sub">${subInfo}</div>
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
      cr['Modalidad'] === 'CONTADO_1MES' ? '🌟 Contado 1 Mes' : `Periodo: ${cr['Periodo']} sem.`,
      cr['Celular'] ? `📞 ${cr['Celular']}` : '',
    ].filter(Boolean).map(s => `<span>${s}</span>`).join('');
    setHTML('pos-client-meta', metaItems);

    const pagosCompletos = _pagosData.filter(p => ['PUNTUAL', 'NORMAL', 'MOROSO', 'CAPITAL'].includes(p['Estatus_de_pago'])).length;
    const totalPagos = _pagosData.length;

    let bannerC1M = '';
    const info = cr['infoContado1Mes'];
    if (info && info.esContado1Mes) {
      bannerC1M = `
        <div style="grid-column:1/-1; background:linear-gradient(135deg, rgba(16,185,129,0.12) 0%, rgba(5,150,105,0.06) 100%); border:1.5px solid #10b981; border-radius:var(--radius-sm); padding:12px 14px; margin-top:10px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
            <span style="font-weight:800; font-size:0.92rem; color:#047857; display:flex; align-items:center; gap:6px;">
              🌟 PROMOCIÓN: VENTA CONTADO 1 MES
            </span>
            <span class="badge" style="background:#059669; color:#fff; font-size:0.75rem; font-weight:700; padding:3px 8px;">
              ⏳ Quedan ${info.diasRestantes} días (Vence: ${fmt.date(info.fechaLimite)})
            </span>
          </div>
          <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap:10px; font-size:0.85rem; margin-top:8px; border-top:1px dashed rgba(16,185,129,0.3); padding-top:8px;">
            <div>
              <div style="color:var(--cf-text-secondary); font-size:0.72rem;">Precio Contado</div>
              <div style="font-weight:700; font-size:1rem;">${fmt.currency(info.precioContado)}</div>
            </div>
            <div>
              <div style="color:var(--cf-text-secondary); font-size:0.72rem;">Total Abonado</div>
              <div style="font-weight:700; font-size:1rem; color:#047857;">${fmt.currency(info.totalAbonado)}</div>
            </div>
            <div>
              <div style="color:var(--cf-text-secondary); font-size:0.72rem;">Saldo Pendiente</div>
              <div style="font-weight:800; font-size:1.1rem; color:#059669;">${fmt.currency(info.saldoPendiente)}</div>
            </div>
          </div>
        </div>
      `;
    } else if (cr['Modalidad'] === '13_SEMANAS_CONVERTIDO') {
      bannerC1M = `
        <div style="grid-column:1/-1; background:rgba(245,158,11,0.12); border:1.5px solid #f59e0b; border-radius:var(--radius-sm); padding:10px 12px; margin-top:10px; font-size:0.82rem; color:#92400e;">
          ⚠ <strong>Crédito Convertido a 13 Semanas:</strong> Los 30 días de la promoción de contado concluyeron. El saldo se recalculó al plan de 13 semanas a partir de su entrega original.
        </div>
      `;
    }

    setHTML('pos-credit-status', `
      <div style="flex:1">
        <div style="font-size:.78rem;color:var(--cf-muted)">Estatus</div>
        <div style="font-weight:700">${badgeEstado(cr['ESTATUS'])}</div>
      </div>
      <div style="text-align:right">
        <div style="font-size:.78rem;color:var(--cf-muted)">Progreso</div>
        <div style="font-weight:700;font-size:1rem;color:var(--cf-primary)">${info && info.esContado1Mes ? (info.saldoPendiente <= 0 ? 'Liquidado' : 'Abonos de Contado') : `${pagosCompletos}/${totalPagos} pagos`}</div>
      </div>
      ${bannerC1M}
    `);

    setHTML('pos-saldo-badge', info && info.esContado1Mes
      ? `Saldo: ${fmt.currency(info.saldoPendiente)}`
      : `${pagosCompletos} de ${totalPagos} pagadas`);
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
      { key: 'Ticket_URL', label: 'Ticket', class: 'td-center', render: r => r['Ticket_URL']
        ? `<a href="${r['Ticket_URL']}" target="_blank" rel="noopener" class="btn btn-outline btn-sm" style="font-size:.7rem;padding:2px 8px;text-decoration:none">🖨 Ver ticket</a>`
        : '—'
      },
    ];
    if (!_pagosData.length) {
      setHTML('pos-schedule-table', '<div class="table-empty">Sin cuotas registradas.</div>');
      return;
    }
    const rows = _pagosData.map(p => {
      const estatus = p['Estatus_de_pago'];
      const rowClass = ['PUNTUAL', 'NORMAL', 'MOROSO', 'CAPITAL'].includes(estatus) ? 'cuota-row-puntual' :
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

    const info = _creditoData['infoContado1Mes'];
    const opcAdic = $('cobro-form-area')?.querySelector('div[style*="border-top"]');

    if (info && info.esContado1Mes) {
      if (opcAdic) opcAdic.classList.add('hidden');
      const saldo = info.saldoPendiente;
      setHTML('cobro-monto-sugerido', fmt.currency(saldo) + ' (Liquidación 100%)');
      setHTML('cobro-semana-info', `🌟 <strong>Abono libre a precio de contado</strong> (Quedan ${info.diasRestantes} días)`);
      const input = $('cobro-monto-input');
      if (input) { input.value = saldo > 0 ? saldo.toFixed(2) : ''; setTimeout(() => input.focus(), 50); }
      return;
    }

    if (opcAdic) opcAdic.classList.remove('hidden');

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

    const tipoPago = _getTipoPago('data-pos-tipo');

    const btn = $('cobro-btn');
    // Bloquear inmediatamente — solo re-habilitar en error, nunca en éxito
    btn.disabled = true; btn.textContent = 'Procesando…';
    showLoading(true);
    try {
      const res = await API.pagoRegistrar({
        IDCredito: _creditoData['IDCredito'],
        montoRecibido: monto,
        canal: 'CAJA',
        tipoPago,
      });
      if (!res.ok) {
        toast(res.message || 'Error al registrar pago.', 'error');
        btn.disabled = false; btn.textContent = '✔ Registrar Pago'; // Solo re-habilitar en error
        return;
      }
      _showTicket(res, monto);
      const metodoLabel = tipoPago === 'Transferencia_o_deposito' ? '🏦 Transferencia/Depósito' : '💵 Efectivo';
      toast('✔ Pago registrado — ' + metodoLabel, 'success');
      // Botón permanece deshabilitado: el cobro-form-area se oculta
    } catch (_) {
      toast('Error de conexión al registrar pago.', 'error');
      btn.disabled = false; btn.textContent = '✔ Registrar Pago';
    } finally { showLoading(false); }
  }


  // ── Abonar a Capital ───────────────────────────────────────
  function _toggleCapitalPanel() {
    if (!_creditoData) return;
    const panel = $('cobro-capital-panel');
    const liqPanel = $('cobro-liquidar-panel');
    if (liqPanel) liqPanel.classList.add('hidden');
    if (panel.classList.contains('hidden')) {
      panel.classList.remove('hidden');
      _iniciarCapitalPanel();
    } else {
      panel.classList.add('hidden');
    }
  }

  async function _iniciarCapitalPanel() {
    const IDCredito = _creditoData['IDCredito'];
    const periodo = parseInt(_creditoData['Periodo']) || 1;
    const contado = parseFloat(_creditoData['Precio_de_contado']) || 0;
    const cuotaCapital = Math.ceil(contado / periodo); // redondear al peso superior

    const infoEl  = $('cobro-capital-info');
    const alertEl = $('cobro-capital-alerta');
    const formEl  = $('cobro-capital-form');

    setHTML('cobro-capital-info', `Cuota sin interés: <strong>${fmt.currency(cuotaCapital)}</strong> / semana`);
    alertEl.classList.add('hidden');
    formEl.classList.add('hidden');

    // Verificar si tiene atrasos localmente
    const atrasados = _pagosData.filter(p => p['Estatus_de_pago'] === 'ATRASADO');
    if (atrasados.length > 0) {
      setHTML('cobro-capital-alerta',
        `⚠ El cliente tiene <strong>${atrasados.length}</strong> semana(s) atrasada(s). Debe ponerse al corriente antes de abonar a capital.`);
      alertEl.classList.remove('hidden');
    } else {
      formEl.classList.remove('hidden');
      // Inicializar toggle de tipo de pago capital
      _initTipoPagoToggle('capital-tipo-grupo', 'capital-tipo-aviso', 'data-capital-tipo');
      const montoInput = $('cobro-capital-monto');
      if (montoInput) { montoInput.value = ''; setTimeout(() => montoInput.focus(), 50); }
      // Asignar confirmación solo una vez
      const confirmBtn = $('cobro-capital-confirmar');
      if (confirmBtn) {
        confirmBtn.onclick = async () => {
          const monto = parseFloat($('cobro-capital-monto')?.value);
          if (!monto || monto <= 0) { toast('Ingresa un monto válido.', 'warning'); return; }
          const tipoPago = _getTipoPago('data-capital-tipo');
          confirmBtn.disabled = true;
          showLoading(true);
          try {
            const res = await API.pagoCapital({ IDCredito, montoCapital: monto, tipoPago });
            if (res.ok) {
              const metodoLabel = tipoPago === 'Transferencia_o_deposito' ? '🏦 Transferencia/Depósito' : '💵 Efectivo';
              toast(`✔ ${res.message} — ${metodoLabel}`, 'success', 5000);
              $('cobro-capital-panel').classList.add('hidden');
              // Calcular semanas restantes usando datos locales
              const semanasYaCompletas = (res.resultados || []).filter(r => r.estatus === 'CAPITAL').length;
              const semanasRestantesAntes = _pagosData.filter(p =>
                ['POR COBRAR', 'ATRASADO', 'PARCIAL', 'CAPITAL PARCIAL'].includes(p['Estatus_de_pago'])
              ).length;
              const semanasRestantesAhora = Math.max(0, semanasRestantesAntes - semanasYaCompletas);

              const ticketData = {
                IDCredito,
                tipoOperacion:    'CAPITAL',
                montoRecibido:    monto,
                montoRestante:    0,
                semanaActual:     res.resultados?.[0]?.semana ?? null,
                semanasRestantes: semanasRestantesAhora,
                totalSemanas:     parseInt(_creditoData?.['Periodo'] || 0),
                pagoCompleto:     true,
                creditoFinalizado: semanasRestantesAhora === 0,
                resultados:       res.resultados || [],
              };

              // Generar ticket; recargar calendario en segundo plano via callback
              _showTicket(ticketData, async () => {
                const sched = await API.pagoSchedule({ IDCredito });
                if (sched.ok) {
                  _pagosData = sched.pagos || [];
                  _renderSchedule();
                  const pagosCompletos = _pagosData.filter(p => ['PUNTUAL','NORMAL','MOROSO','CAPITAL'].includes(p['Estatus_de_pago'])).length;
                  const totalPagos = _pagosData.length;
                  setHTML('pos-saldo-badge', `${pagosCompletos} de ${totalPagos} pagadas`);
                }
              });
            } else { toast(res.message, 'error'); }
          } catch (_) { toast('Error de conexión.', 'error'); }
          finally { confirmBtn.disabled = false; showLoading(false); }
        };
      }
    }
  }

  // ── Liquidar ───────────────────────────────────────────────
  function _toggleLiquidarPanel() {
    if (!_creditoData) return;
    const panel = $('cobro-liquidar-panel');
    const capPanel = $('cobro-capital-panel');
    if (capPanel) capPanel.classList.add('hidden');
    if (panel.classList.contains('hidden')) {
      panel.classList.remove('hidden');
      _cargarLiquidacion();
    } else {
      panel.classList.add('hidden');
    }
  }

  async function _cargarLiquidacion() {
    const IDCredito = _creditoData['IDCredito'];
    // Inicializar toggle de tipo de pago de liquidar
    _initTipoPagoToggle('liquidar-tipo-grupo', 'liquidar-tipo-aviso', 'data-liq-tipo');
    setHTML('cobro-liquidar-detalle', '<div style="opacity:.6;font-size:.78rem">Calculando…</div>');
    try {
      const res = await API.pagoLiquidar({ IDCredito });
      if (!res.ok) { setHTML('cobro-liquidar-detalle', `<span style="color:var(--cf-danger)">${res.message}</span>`); return; }
      setHTML('cobro-liquidar-detalle', `
        <table style="width:100%;font-size:.78rem;border-collapse:collapse">
          <tr><td style="padding:3px 0;color:var(--cf-text-secondary)">Cuota sin interés</td>
              <td style="text-align:right">${fmt.currency(res.cuotaSinInteres)} / sem</td></tr>
          <tr><td style="padding:3px 0;color:var(--cf-danger)">Semanas atrasadas (${res.semanasAtrasadas})</td>
              <td style="text-align:right;color:var(--cf-danger)">${fmt.currency(res.totalAtrasados)}</td></tr>
          <tr><td style="padding:3px 0;color:var(--cf-text-secondary)">Semanas restantes (${res.semanasRestantes} × sin interés)</td>
              <td style="text-align:right">${fmt.currency(res.totalRestantes)}</td></tr>
          <tr style="border-top:2px solid var(--cf-border)">
              <td style="padding:6px 0;font-weight:800;font-size:.92rem">TOTAL A LIQUIDAR</td>
              <td style="text-align:right;font-weight:800;font-size:.92rem;color:var(--cf-primary)">${fmt.currency(res.total)}</td></tr>
        </table>
        <button class="btn btn-danger btn-full btn-sm" style="margin-top:10px" id="cobro-liquidar-confirmar">🔒 Confirmar Liquidación Total</button>
      `);
      on('cobro-liquidar-confirmar', 'click', async () => {
        const btn = $('cobro-liquidar-confirmar');
        btn.disabled = true;
        showLoading(true);
        try {
          const tipoPago = _getTipoPago('data-liq-tipo');
          const resReg = await API.pagoLiquidarRegistrar({
            IDCredito,
            montoTotal: res.total,
            tipoPago,
          });
          if (resReg.ok) {
            const metodoLabel = tipoPago === 'Transferencia_o_deposito' ? '🏦 Transferencia/Depósito' : '💵 Efectivo';
            toast('✔ Liquidación registrada — ' + metodoLabel, 'success', 5000);
            $('cobro-liquidar-panel').classList.add('hidden');
            _showTicket({ ...resReg, montoRecibido: resReg.montoRecibido ?? res.total });
          } else { toast(resReg.message, 'error'); }
        } catch (_) { toast('Error de conexión.', 'error'); }
        finally { btn.disabled = false; showLoading(false); }
      });
    } catch (_) { setHTML('cobro-liquidar-detalle', '<span style="color:var(--cf-danger)">Error al calcular.</span>'); }
  }

  async function _showTicket(res, afterTicketFn) {
    $('cobro-form-area').classList.add('hidden');
    $('cobro-result').classList.remove('hidden');

    if (res.esContado1Mes) {
      setHTML('ticket-amount', fmt.currency(res.montoRecibido));
      setHTML('ticket-semana', `Venta Contado 1 Mes (Vence: ${fmt.date(res.fechaLimiteContado)})`);
      setHTML('ticket-estado', res.liquidado
        ? '🎉 ¡VENTA DE CONTADO LIQUIDADA AL 100%!'
        : `Abono a capital registrado · Saldo restante: <strong>${fmt.currency(res.saldoPendiente)}</strong>`);
      setHTML('ticket-saldo', `Total abonado a la fecha: ${fmt.currency(res.totalAbonado)} de ${fmt.currency(res.precioContado)}`);
      setHTML('ticket-finalizado', res.liquidado ? '✔ PRODUCTO VENDIDO DE CONTADO' : '');
    } else {
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

    // Resetear botón térmico y PDF
    const btnTermica = $('cobro-termica-btn');
    if (btnTermica) {
      btnTermica.disabled = true;
      btnTermica.textContent = '🖨 Preparando Ticket...';
      btnTermica.onclick = null;
    }
    const btnPdf = $('cobro-pdf-btn');
    if (btnPdf) {
      btnPdf.disabled = true;
      btnPdf.textContent = 'Generando PDF...';
      btnPdf.onclick = null;
    }

    // Generar Ticket (Respaldo Drive + HTML Térmico)
    try {
      const tktRes = await API.ticketGenerate(res);
      if (tktRes.ok) {
        // Guardar printUrl para posible reimpresión
        _lastTicketPrintUrl = tktRes.printUrl || null;

        // Botón Térmico
        if (btnTermica && tktRes.rawHtml) {
          btnTermica.disabled = false;
          btnTermica.textContent = '🖨 Imprimir (Térmica)';
          btnTermica.onclick = () => {
            const printWin = window.open('', '_blank', 'width=400,height=600');
            printWin.document.write(tktRes.rawHtml);
            printWin.document.close();
            printWin.focus();
            setTimeout(() => { printWin.print(); printWin.close(); }, 500);
          };
        }

        // Botón PDF
        if (btnPdf && tktRes.printUrl) {
          btnPdf.disabled = false;
          btnPdf.textContent = '📄 Ver PDF de Respaldo';
          btnPdf.onclick = () => window.open(tktRes.printUrl, '_blank');
        }
      } else {
        if (btnTermica) { btnTermica.disabled = false; btnTermica.textContent = '⚠ Error'; }
        if (btnPdf) { btnPdf.disabled = false; btnPdf.textContent = '⚠ Error en Respaldo'; }
      }
    } catch (_) {
      if (btnTermica) { btnTermica.disabled = false; btnTermica.textContent = '⚠ Sin conexión'; }
      if (btnPdf) { btnPdf.disabled = false; btnPdf.textContent = '⚠ Sin conexión'; }
    }

    // Ejecutar callback post-ticket (ej: recargar calendario en segundo plano)
    if (typeof afterTicketFn === 'function') {
      try { await afterTicketFn(); } catch (_) {}
    }
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
