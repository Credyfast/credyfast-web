/* ============================================================
   CredyFast — cobranza.js  |  Módulo Cobranza en Campo (Fase B)
   Usa el backend real: cobranza_ruta, pago_registrar (Canal DOMICILIO),
   cobranza_visita (ticket sin pago persistido en Sheets).
   ============================================================ */

const Cobranza = (() => {

  let _rutaData = [];

  function render() {
    return `
    <div>
      <div class="section-header">
        <h2>Cobranza en Campo</h2>
        <button class="btn btn-outline btn-sm" id="cob-refresh">↻ Actualizar</button>
      </div>

      <!-- Saldo del cobrador actual -->
      <div id="cob-saldo-bar" style="background:var(--cf-surface);border:1px solid var(--cf-border);border-radius:var(--radius-sm);padding:10px 16px;margin-bottom:14px;font-size:.85rem;display:flex;justify-content:space-between;align-items:center">
        <span>💼 Dinero en tu cartera:</span>
        <strong id="cob-saldo-val" style="color:var(--cf-accent);font-size:1.1rem">…</strong>
      </div>

      <!-- Tabs -->
      <div style="display:flex;border-bottom:2px solid var(--cf-border);margin-bottom:16px">
        <button class="toggle-btn active" id="tab-ruta"   data-tab="ruta"   style="flex:none;padding:10px 18px;border-radius:0">Ruta del Día</button>
        <button class="toggle-btn"        id="tab-visitas" data-tab="visitas" style="flex:none;padding:10px 18px;border-radius:0">Registrar Visita Sin Pago</button>
      </div>

      <!-- Ruta del día -->
      <div id="tab-content-ruta">
        <div id="cob-ruta-list">
          <div class="empty-state"><div class="empty-icon">🏠</div><p>Cargando ruta…</p></div>
        </div>
      </div>

      <!-- Registrar visita sin pago -->
      <div id="tab-content-visitas" class="hidden">
        <div class="card card-body">
          <div class="form-group">
            <label>ID Crédito *</label>
            <div style="display:flex;gap:8px">
              <input type="text" id="visita-id-credito" placeholder="CR00001">
              <button class="btn btn-teal btn-sm" id="visita-buscar">Verificar</button>
            </div>
            <div id="visita-cliente-info" class="text-sm text-muted" style="margin-top:4px"></div>
          </div>
          <div class="form-group">
            <label>Motivo de la visita *</label>
            <select id="visita-motivo">
              <option value="">-- Selecciona --</option>
              <option value="Cliente ausente">Cliente ausente</option>
              <option value="Cliente sin dinero">Cliente sin dinero</option>
              <option value="Negativa de pago">Negativa de pago</option>
              <option value="Dirección incorrecta">Dirección incorrecta</option>
              <option value="Otro">Otro</option>
            </select>
          </div>
          <div class="form-group">
            <label>Comentarios adicionales</label>
            <textarea id="visita-comentarios" rows="3" placeholder="Observaciones del cobrador…"></textarea>
          </div>
          <button class="btn btn-primary btn-full" id="btn-guardar-visita">💾 Guardar Visita y Generar Ticket</button>
          <!-- Ticket imprimible -->
          <div id="ticket-visita-area" class="ticket-visita hidden">
            <div style="text-align:center;margin-bottom:12px">
              <strong style="font-size:1rem">CREDYFAST</strong><br>
              <span style="font-size:.75rem">TICKET DE VISITA SIN PAGO</span>
            </div>
            <hr style="border:1px dashed #000;margin:8px 0">
            <div id="ticket-visita-contenido"></div>
            <hr style="border:1px dashed #000;margin:8px 0">
            <div style="text-align:center;font-size:.75rem;margin-top:8px">Fecha: <strong id="ticket-visita-fecha"></strong></div>
          </div>
          <div id="ticket-visita-btns" class="hidden" style="display:flex;gap:8px;margin-top:12px">
            <button class="btn btn-outline btn-full" onclick="window.print()">🖨 Imprimir Ticket</button>
            <button class="btn btn-ghost btn-full" id="btn-nueva-visita">Nueva visita</button>
          </div>
        </div>
      </div>

      <!-- Modal: Cobro en campo -->
      <div id="modal-cobro-campo" class="hidden" style="position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:200;display:flex;align-items:flex-end;justify-content:center;padding:0">
        <div class="card" style="width:100%;max-width:520px;border-radius:var(--radius-lg) var(--radius-lg) 0 0;padding:24px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
            <h3 id="cobro-campo-title" style="font-size:1rem;font-weight:700">Registrar Cobro</h3>
            <button class="btn btn-ghost btn-sm" id="modal-campo-close">✕</button>
          </div>
          <div id="cobro-campo-info" style="background:var(--cf-bg);border-radius:var(--radius-sm);padding:10px 14px;margin-bottom:14px;font-size:.85rem"></div>
          <div class="form-group">
            <label>Monto Cobrado ($)</label>
            <input type="number" id="campo-monto-input" class="input-xl" min="0.01" step="0.01" placeholder="0.00">
          </div>
          <div class="form-group">
            <label>Notas (opcional)</label>
            <input type="text" id="campo-notas-input" placeholder="Observación del cobro…">
          </div>

          <!-- Ticket de cobro en campo -->
          <div id="cobro-campo-result" class="hidden" style="margin-bottom:14px">
            <div class="ticket-result" style="padding:14px">
              <div style="font-size:.78rem;color:var(--cf-muted);margin-bottom:4px">Cobro en campo registrado</div>
              <div class="ticket-amount" id="campo-ticket-monto"></div>
              <div class="ticket-detail" id="campo-ticket-semana"></div>
              <div class="ticket-detail" id="campo-ticket-estado"></div>
            </div>
            <div style="display:flex;gap:8px;margin-top:10px">
              <button class="btn btn-outline btn-full" onclick="window.print()">🖨 Imprimir</button>
              <button class="btn btn-ghost btn-full" id="campo-nuevo-btn">Nuevo cobro</button>
            </div>
          </div>

          <button class="btn btn-success btn-full btn-xl" id="campo-cobrar-btn">
            💰 Registrar Cobro en Campo
          </button>
        </div>
      </div>
    </div>`;
  }

  function init() {
    // Tabs
    document.querySelectorAll('[data-tab]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('[data-tab]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        $('tab-content-ruta').classList.toggle('hidden', btn.dataset.tab !== 'ruta');
        $('tab-content-visitas').classList.toggle('hidden', btn.dataset.tab !== 'visitas');
      });
    });

    on('cob-refresh', 'click', _loadAll);
    on('modal-campo-close', 'click', () => $('modal-cobro-campo').classList.add('hidden'));
    on('visita-buscar', 'click', _verificarCreditoVisita);
    on('visita-id-credito', 'keydown', e => { if (e.key==='Enter') _verificarCreditoVisita(); });
    on('btn-guardar-visita', 'click', _guardarVisita);
    on('btn-nueva-visita', 'click', _resetVisita);
    on('campo-nuevo-btn', 'click', () => { $('cobro-campo-result').classList.add('hidden'); $('campo-cobrar-btn').classList.remove('hidden'); });

    _loadAll();
  }

  async function _loadAll() {
    _loadRuta();
    _loadSaldoCobrador();
  }

  async function _loadSaldoCobrador() {
    try {
      const res = await API.cajaSaldoCobrador();
      if (!res.ok) return;
      const user = State.get('user');
      const uid  = user?.username || user?.id || '';
      const entry = (res.data||[]).find(c => c.cobradorId === uid);
      setHTML('cob-saldo-val', fmt.currency(entry?.saldo || 0));
    } catch(_) {}
  }

  async function _loadRuta() {
    showLoading(true);
    try {
      const res = await API.cobranzaRuta();
      if (!res.ok) {
        setHTML('cob-ruta-list', `<div class="alert alert-warning">${res.message}</div>`);
        return;
      }
      _rutaData = res.data || [];
      _renderRuta(_rutaData);
    } catch(_) { setHTML('cob-ruta-list', '<div class="alert alert-danger">Error de conexión.</div>'); }
    finally { showLoading(false); }
  }

  function _renderRuta(ruta) {
    if (!ruta.length) {
      setHTML('cob-ruta-list', '<div class="empty-state"><div class="empty-icon">✅</div><p>Sin visitas pendientes. ¡Ruta completada!</p></div>');
      return;
    }
    setHTML('cob-ruta-list', ruta.map(r => {
      const mapsUrl = r['Ubicacion'] ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(r['Ubicacion'])}` : '';
      // Calcular deuda total: atrasadas*moroso + siguiente semana
      const puntual = parseFloat(r['Pago_puntual']) || 0;
      const normal  = parseFloat(r['Pago_normal'])  || 0;
      const moroso  = parseFloat(r['Pago_moroso'])  || 0;
      const atrasadas     = parseInt(r['Semanas_atrasadas']) || 0;
      const montoEsperado = parseFloat(r['Monto_esperado']) || 0;
      const montoPagado   = parseFloat(r['Monto_pagado'])   || 0;
      const faltanteSem   = Math.max(0, montoEsperado - montoPagado);
      // Deuda total: semanas atrasadas * moroso + siguiente cuota normal
      const deudaTotal = atrasadas > 0
        ? (atrasadas * moroso) + normal
        : faltanteSem;

      return `
        <div class="cobranza-card" style="${atrasadas > 0 ? 'border-left:4px solid var(--cf-danger)' : ''}">
          <div class="cobranza-card-info">
            <div style="font-weight:700;font-size:1rem;margin-bottom:3px">${r['Nombre_completo']}</div>
            <div style="font-size:.8rem;color:var(--cf-text-secondary);margin-bottom:8px">
              ${r['IDCredito']} · ${r['Direccion'] || 'Sin dirección'}
            </div>

            <!-- Semanas atrasadas -->
            <div style="margin-bottom:8px">
              ${atrasadas > 0
                ? `<span class="badge badge-danger" style="font-size:.82rem;padding:4px 10px">⚠️ ${atrasadas} sem. atrasada${atrasadas > 1 ? 's' : ''}</span>`
                : `<span class="badge badge-success">Al corriente</span>`
              }
              ${r['Semana_proxima'] === 0 ? '<span class="badge badge-warning" style="margin-left:4px">Enganche</span>' : `<span class="badge badge-muted" style="margin-left:4px">Sem. ${r['Semana_proxima']}</span>`}
            </div>

            <!-- 3 tipos de cobro -->
            <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-bottom:8px">
              <div style="background:var(--cf-bg);border-radius:var(--radius-sm);padding:6px 8px;text-align:center">
                <div style="font-size:.68rem;color:var(--cf-muted);font-weight:700;text-transform:uppercase;margin-bottom:2px">Puntual</div>
                <div style="font-weight:800;color:var(--cf-accent);font-size:.95rem">${fmt.currency(puntual)}</div>
                <div style="font-size:.65rem;color:var(--cf-muted)">hoy</div>
              </div>
              <div style="background:var(--cf-bg);border-radius:var(--radius-sm);padding:6px 8px;text-align:center">
                <div style="font-size:.68rem;color:var(--cf-muted);font-weight:700;text-transform:uppercase;margin-bottom:2px">Normal</div>
                <div style="font-weight:800;color:var(--cf-warning);font-size:.95rem">${fmt.currency(normal)}</div>
                <div style="font-size:.65rem;color:var(--cf-muted)">1-7 días</div>
              </div>
              <div style="background:var(--cf-bg);border-radius:var(--radius-sm);padding:6px 8px;text-align:center">
                <div style="font-size:.68rem;color:var(--cf-muted);font-weight:700;text-transform:uppercase;margin-bottom:2px">Moroso</div>
                <div style="font-weight:800;color:var(--cf-danger);font-size:.95rem">${fmt.currency(moroso)}</div>
                <div style="font-size:.65rem;color:var(--cf-muted)">8+ días</div>
              </div>
            </div>

            <!-- Deuda total -->
            ${atrasadas > 0 ? `
            <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:var(--radius-sm);padding:7px 12px;display:flex;justify-content:space-between;align-items:center">
              <span style="font-size:.8rem;font-weight:700;color:#991b1b">Deuda total estimada:</span>
              <span style="font-size:1.05rem;font-weight:900;color:#dc2626">${fmt.currency(deudaTotal)}</span>
            </div>` : ''}
          </div>
          <div class="cobranza-card-actions">
            ${mapsUrl ? `<a href="${mapsUrl}" target="_blank" rel="noopener" class="btn btn-outline btn-sm">📍 Maps</a>` : ''}
            <button class="btn btn-success btn-sm" onclick="Cobranza._openCobroCampo(${JSON.stringify(r).replace(/"/g,'&quot;')})">
              💰 Cobrar
            </button>
            ${r['Celular'] ? `<a href="tel:${r['Celular']}" class="btn btn-ghost btn-sm">📞 Llamar</a>` : ''}
          </div>
        </div>`;
    }).join(''));
  }

  // ── Cobro en campo ────────────────────────────────────────
  let _cobroTarget = null;

  function _openCobroCampo(registro) {
    _cobroTarget = registro;
    const modal = $('modal-cobro-campo');
    modal.classList.remove('hidden');
    modal.style.display = 'flex';
    $('cobro-campo-result').classList.add('hidden');
    $('campo-cobrar-btn').classList.remove('hidden');
    setHTML('cobro-campo-title', `Cobrar — ${registro['Nombre_completo']}`);
    const puntual = parseFloat(registro['Pago_puntual']) || 0;
    const normal  = parseFloat(registro['Pago_normal'])  || 0;
    const moroso  = parseFloat(registro['Pago_moroso'])  || 0;
    const atrasadas = parseInt(registro['Semanas_atrasadas']) || 0;
    // Monto sugerido: si tiene atrasos usa moroso, si no puntual
    const montoSug  = atrasadas > 0 ? moroso : puntual;
    const deudaTotal = atrasadas > 0 ? (atrasadas * moroso) + normal : puntual;

    setHTML('cobro-campo-info', `
      <div style="font-weight:700;font-size:1rem;margin-bottom:4px">${registro['Nombre_completo']}</div>
      <div style="font-size:.8rem;color:var(--cf-muted);margin-bottom:10px">${registro['IDCredito']} · Sem. ${registro['Semana_proxima']}</div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-bottom:${atrasadas > 0 ? '8px' : '0'}">
        <div style="text-align:center;padding:6px;background:#f0fdf4;border-radius:6px">
          <div style="font-size:.65rem;font-weight:700;color:var(--cf-muted);text-transform:uppercase">Puntual</div>
          <div style="font-weight:800;color:var(--cf-accent)">${fmt.currency(puntual)}</div>
        </div>
        <div style="text-align:center;padding:6px;background:#fffbeb;border-radius:6px">
          <div style="font-size:.65rem;font-weight:700;color:var(--cf-muted);text-transform:uppercase">Normal</div>
          <div style="font-weight:800;color:var(--cf-warning)">${fmt.currency(normal)}</div>
        </div>
        <div style="text-align:center;padding:6px;background:#fef2f2;border-radius:6px">
          <div style="font-size:.65rem;font-weight:700;color:var(--cf-muted);text-transform:uppercase">Moroso</div>
          <div style="font-weight:800;color:var(--cf-danger)">${fmt.currency(moroso)}</div>
        </div>
      </div>
      ${atrasadas > 0 ? `<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:6px;padding:7px 12px;display:flex;justify-content:space-between">
        <span style="font-size:.8rem;font-weight:700;color:#991b1b">⚠️ Deuda total (${atrasadas} sem.):</span>
        <span style="font-weight:900;color:#dc2626">${fmt.currency(deudaTotal)}</span>
      </div>` : ''}
    `);
    const input = $('campo-monto-input');
    if (input) { input.value = montoSug.toFixed(2); setTimeout(()=>input.focus(),50); }
    // Re-attach button
    const btn = $('campo-cobrar-btn');
    if (btn) { const nb = btn.cloneNode(true); btn.parentNode.replaceChild(nb, btn); nb.addEventListener('click', _submitCobroCampo); }
  }

  async function _submitCobroCampo() {
    if (!_cobroTarget) return;
    let monto; try { monto = requireNum($('campo-monto-input').value, 'Monto', 0.01); }
    catch(e) { toast(e.message, 'warning'); return; }
    const notas = $('campo-notas-input')?.value || '';
    showLoading(true);
    try {
      const res = await API.pagoRegistrar({
        IDCredito:     _cobroTarget['IDCredito'],
        montoRecibido: monto,
        canal:         'DOMICILIO',
      });
      if (res.ok) {
        $('campo-cobrar-btn').classList.add('hidden');
        $('cobro-campo-result').classList.remove('hidden');
        const semLabel = res.semanaActual === 0 ? 'Enganche' : `Sem. ${res.semanaActual} de ${res.totalSemanas}`;
        setHTML('campo-ticket-monto', fmt.currency(monto));
        setHTML('campo-ticket-semana', semLabel);
        setHTML('campo-ticket-estado', res.pagoCompleto ? '✔ Pago completo' : `⚠ Parcial — Pendiente: ${fmt.currency(res.montoRestante)}`);
        toast('✔ Cobro registrado en campo.', 'success');
        _loadSaldoCobrador();
        _loadRuta();
      } else { toast(res.message, 'error'); }
    } catch(_) { toast('Error de conexión.', 'error'); }
    finally { showLoading(false); }
  }

  // ── Visita sin pago ───────────────────────────────────────
  let _visitaCredito = null;

  async function _verificarCreditoVisita() {
    const id = $('visita-id-credito')?.value.trim();
    if (!id) return;
    setHTML('visita-cliente-info', 'Buscando…');
    try {
      const res = await API.pagoBuscarCliente({ query: id });
      if (res.ok && res.cliente) {
        _visitaCredito = res.creditos?.[0] || { IDCredito: id };
        setHTML('visita-cliente-info', `<span style="color:var(--cf-accent)">✔ ${res.cliente['Nombre_completo']}</span>`);
        if (!_visitaCredito.IDCredito && id.toUpperCase().startsWith('CR')) {
          _visitaCredito = { IDCredito: id.toUpperCase() };
        }
      } else {
        // Intentar directamente como IDCredito
        _visitaCredito = { IDCredito: id.toUpperCase() };
        setHTML('visita-cliente-info', `<span style="color:var(--cf-warning)">Crédito: ${id.toUpperCase()}</span>`);
      }
    } catch(_) { setHTML('visita-cliente-info', 'Error de búsqueda.'); }
  }

  async function _guardarVisita() {
    const IDCredito  = _visitaCredito?.IDCredito || $('visita-id-credito')?.value.trim();
    const motivo     = $('visita-motivo')?.value;
    const comentarios= $('visita-comentarios')?.value || '';
    if (!IDCredito)  { toast('Verifica el crédito primero.', 'warning'); return; }
    if (!motivo)     { toast('Selecciona un motivo.', 'warning'); return; }

    showLoading(true);
    try {
      const res = await API.cobranzaVisita({ IDCredito, motivo, comentarios });
      if (res.ok) {
        toast(`✔ Visita ${res.id} registrada.`, 'success');
        // Mostrar ticket imprimible
        const ahora = new Date().toLocaleString('es-MX');
        const user  = State.get('user');
        setHTML('ticket-visita-contenido', `
          <div><strong>Crédito:</strong> ${IDCredito}</div>
          <div><strong>Cobrador:</strong> ${user?.username || '—'}</div>
          <div><strong>Motivo:</strong> ${motivo}</div>
          ${comentarios ? `<div><strong>Notas:</strong> ${comentarios}</div>` : ''}
          <div><strong>Folio visita:</strong> ${res.id}</div>
        `);
        setHTML('ticket-visita-fecha', ahora);
        $('ticket-visita-area').classList.remove('hidden');
        $('ticket-visita-btns').style.display = 'flex';
        $('ticket-visita-btns').classList.remove('hidden');
        $('btn-guardar-visita').disabled = true;
      } else { toast(res.message, 'error'); }
    } catch(_) { toast('Error de conexión.', 'error'); }
    finally { showLoading(false); }
  }

  function _resetVisita() {
    _visitaCredito = null;
    const fields = ['visita-id-credito','visita-motivo','visita-comentarios'];
    fields.forEach(id => { const el=$(id); if(el) el.value=''; });
    setHTML('visita-cliente-info', '');
    $('ticket-visita-area').classList.add('hidden');
    $('ticket-visita-btns').classList.add('hidden');
    $('btn-guardar-visita').disabled = false;
  }

  return { render, init, _openCobroCampo };
})();
