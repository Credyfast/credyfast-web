/* ============================================================
   CredyFast — autorizaciones.js
   Gestión y Generación de Códigos de Autorización / Descuentos
   Válido para Venta de Contado y Enganche a Crédito (6 dígitos, máx 20 min).
   ============================================================ */

const AutorizacionesView = (() => {

  let _codigos = [];
  let _timerInterval = null;
  let _sucursales = [];
  let _ultimoCodigo = null;

  function render() {
    return `
    <div class="view-header">
      <div>
        <h2 style="display:flex;align-items:center;gap:8px">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></svg>
          Códigos de Autorización y Descuentos
        </h2>
        <p class="text-secondary" style="font-size:0.85rem;margin-top:2px">
          Genera códigos numéricos de 6 dígitos de uso único con vigencia máxima de 20 minutos.
        </p>
      </div>
      <div style="display:flex;gap:10px">
        <button class="btn btn-outline" id="btn-auth-refresh">Actualizar</button>
        <button class="btn btn-primary" id="btn-auth-nuevo">+ Generar Nuevo Código</button>
      </div>
    </div>

    <!-- ── STATS CARDS (3 casillas en la misma fila con líneas de color) ── -->
    <div style="display:grid;grid-template-columns:repeat(3, 1fr);gap:16px;margin-bottom:20px">
      <div class="stat-card" style="--stat-accent:#047857;border-top:3.5px solid #047857">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div class="stat-label">Códigos Activos</div>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#047857" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/></svg>
        </div>
        <div class="stat-value" id="stat-auth-activos">0</div>
        <div class="stat-sub">Vigentes y listos para uso</div>
      </div>
      <div class="stat-card" style="--stat-accent:#0284c7;border-top:3.5px solid #0284c7">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div class="stat-label">Usados</div>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0284c7" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        </div>
        <div class="stat-value" id="stat-auth-usados">0</div>
        <div class="stat-sub">Aplicados en ventas</div>
      </div>
      <div class="stat-card" style="--stat-accent:#ef4444;border-top:3.5px solid #ef4444">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div class="stat-label">Expirados / Cancelados</div>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
        </div>
        <div class="stat-value" id="stat-auth-expirados">0</div>
        <div class="stat-sub">Caducados o revocados</div>
      </div>
    </div>

    <!-- ── TABLA DE CÓDIGOS ── -->
    <div class="card">
      <div class="card-header" style="display:flex;justify-content:space-between;align-items:center">
        <h3>Historial de Códigos Generados</h3>
        <span class="badge badge-info" id="auth-total-count">0 códigos</span>
      </div>
      <div class="table-responsive">
        <table class="table" id="tabla-autorizaciones">
          <thead>
            <tr>
              <th>Código</th>
              <th>Operación</th>
              <th>Descuento</th>
              <th>Diferido</th>
              <th>Motivo (Obligatorio)</th>
              <th>Sucursal</th>
              <th>Estatus / Vigencia</th>
              <th>Autorizó</th>
              <th>Usó</th>
              <th style="text-align:right">Acción</th>
            </tr>
          </thead>
          <tbody id="auth-tbody">
            <tr><td colspan="10" style="text-align:center;padding:24px">Cargando códigos…</td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- ══ MODAL GENERAR CÓDIGO ══ -->
    <div id="modal-nuevo-codigo" class="hidden" style="position:fixed;inset:0;background:rgba(0,0,0,0.65);backdrop-filter:blur(3px);z-index:250;display:none;align-items:center;justify-content:center;padding:16px">
      <div class="card" style="width:100%;max-width:520px;max-height:92vh;overflow-y:auto;box-shadow:var(--shadow-xl);border:1px solid var(--cf-border);border-radius:14px">
        <div class="card-header" style="display:flex;justify-content:space-between;align-items:center">
          <h3>🎟️ Generar Código de Autorización</h3>
          <button class="btn btn-ghost btn-sm" id="modal-nuevo-codigo-close">✕</button>
        </div>
        <div class="card-body">
          <form id="form-nuevo-codigo">

            <!-- 1. Tipo de Operación -->
            <div class="form-group" style="margin-bottom:14px">
              <label style="font-weight:600;font-size:0.85rem">1. Tipo de Operación</label>
              <div class="toggle-group" id="auth-tipo-operacion" style="margin-top:6px">
                <button type="button" class="toggle-btn active" data-op="CONTADO">🛒 Venta de Contado</button>
                <button type="button" class="toggle-btn" data-op="ENGANCHE">📋 Enganche a Crédito</button>
              </div>
            </div>

            <!-- 2. Tipo de Descuento ($ o %) -->
            <div class="form-group" style="margin-bottom:14px">
              <label style="font-weight:600;font-size:0.85rem">2. Modalidad del Descuento</label>
              <div class="toggle-group" id="auth-tipo-descuento" style="margin-top:6px">
                <button type="button" class="toggle-btn active" data-desc="MONTO">💵 Monto Fijo ($)</button>
                <button type="button" class="toggle-btn" data-desc="PORCENTAJE">％ Porcentaje (%)</button>
              </div>
            </div>

            <!-- 3. Valor -->
            <div class="form-group" style="margin-bottom:14px">
              <label for="auth-valor" id="auth-valor-label" style="font-weight:600;font-size:0.85rem">Monto del Descuento ($)</label>
              <div style="display:flex;gap:8px;align-items:center">
                <input type="number" id="auth-valor" class="input-lg" min="0.01" step="any" placeholder="Ej. 300" required style="font-size:1.15rem;font-weight:700">
                <button type="button" class="btn btn-outline btn-sm" id="btn-auth-100pct" style="white-space:nowrap;font-size:0.75rem">
                  🎁 100% Regalo / Patrocinio
                </button>
              </div>
              <div id="auth-valor-ayuda" style="font-size:0.76rem;color:var(--cf-muted);margin-top:4px">
                Ingresa el monto directo en pesos que se restará al precio.
              </div>
            </div>

            <!-- 4. Si es Enganche: Opción Diferir -->
            <div id="auth-enganche-opciones" class="hidden" style="margin-bottom:14px;padding:12px;background:var(--cf-bg);border:1px solid var(--cf-border);border-radius:var(--radius-sm)">
              <div style="font-weight:600;font-size:0.82rem;color:var(--cf-accent);margin-bottom:6px">
                ⚙️ Opciones de Enganche
              </div>
              <label style="display:flex;align-items:flex-start;gap:8px;font-size:0.82rem;cursor:pointer;line-height:1.4">
                <input type="checkbox" id="auth-diferir-enganche" style="margin-top:3px">
                <span>
                  <strong>Diferir enganche restante a las semanas de pago</strong><br>
                  <span style="color:var(--cf-muted);font-size:0.75rem">
                    El cliente no pagará enganche hoy para llevarse el equipo ($0 al entregar); el saldo se suma en cuotas iguales a sus semanas.
                  </span>
                </span>
              </label>
            </div>

            <!-- 5. Motivo / Justificación (OBLIGATORIO) -->
            <div class="form-group" style="margin-bottom:14px">
              <label for="auth-motivo" style="font-weight:600;font-size:0.85rem">
                Motivo / Justificación <span style="color:var(--cf-danger)">* (Obligatorio)</span>
              </label>
              <input type="text" id="auth-motivo" class="input-lg" placeholder="Ej. Patrocinio evento Naolinco, Cliente frecuente, Negociación de mostrador..." required>
              <div style="font-size:0.75rem;color:var(--cf-muted);margin-top:3px">
                Quedará registrado permanentemente para auditorías y en el ticket de compra.
              </div>
            </div>

            <!-- 6. Sucursal -->
            <div class="form-group" style="margin-bottom:20px">
              <label for="auth-sucursal" style="font-weight:600;font-size:0.85rem">Sucursal Válida</label>
              <select id="auth-sucursal" class="input-lg">
                <option value="TODAS">🏢 Válido en Cualquier Sucursal</option>
              </select>
            </div>

            <div style="background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.3);border-radius:var(--radius-sm);padding:10px;margin-bottom:16px;font-size:0.8rem;color:#b45309">
              ⏱️ <strong>Vigencia:</strong> El código tendrá <strong>20 minutos</strong> para ser ingresado por el vendedor/cajero y se desactivará tras su primer uso.
            </div>

            <button type="submit" class="btn btn-success btn-full btn-lg" id="btn-auth-confirmar-generar">
              ✨ Generar Código de 6 Dígitos
            </button>
          </form>
        </div>
      </div>
    </div>

    <!-- ══ MODAL CÓDIGO GENERADO CON ÉXITO (CENTRAL, FIJO Y NO SE CIERRA SOLO) ══ -->
    <div id="modal-codigo-exito" class="hidden" style="position:fixed;inset:0;background:rgba(15,23,42,0.82);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);z-index:9999;display:none;align-items:center;justify-content:center;padding:16px">
      <div class="card" style="width:100%;max-width:480px;text-align:center;padding:26px 22px;box-shadow:0 25px 50px -12px rgba(0,0,0,0.6);border:2px solid #10b981;border-radius:18px;background:var(--cf-card-bg,#1e293b);position:relative">
        
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
          <span class="badge badge-success" style="font-size:0.75rem;padding:4px 10px;font-weight:700;letter-spacing:0.5px">✔ CÓDIGO GENERADO</span>
          <button type="button" class="btn btn-ghost btn-sm" id="btn-codigo-exito-x" title="Cerrar ventana" style="font-size:1.25rem;line-height:1;padding:4px 8px;border-radius:50%;color:var(--cf-muted)">✕</button>
        </div>

        <div style="font-size:3rem;line-height:1;margin-bottom:6px">🎟️</div>
        <h2 style="font-size:1.35rem;font-weight:800;color:var(--cf-text,#f8fafc);margin-bottom:4px">Código de Autorización Listo</h2>
        <p style="font-size:0.84rem;color:var(--cf-muted,#94a3b8);margin-bottom:18px">
          Proporciona este código de 6 dígitos al cajero o vendedor en mostrador:
        </p>

        <!-- Bloque Grande del Código -->
        <div style="background:rgba(16,185,129,0.08);border:2px dashed #10b981;border-radius:14px;padding:16px 10px;margin-bottom:14px">
          <div id="display-codigo-grande" style="font-size:3.2rem;font-weight:900;letter-spacing:10px;color:#10b981;font-family:'Courier New',Courier,monospace;user-select:all;line-height:1.1;text-shadow:0 0 16px rgba(16,185,129,0.25)">
            ------
          </div>
        </div>

        <!-- Botones de Acción: Copiar Código y Copiar WhatsApp -->
        <div style="display:flex;gap:8px;margin-bottom:16px">
          <button type="button" class="btn btn-primary btn-full btn-lg" id="btn-copiar-codigo" style="font-size:0.95rem;font-weight:700;display:flex;align-items:center;justify-content:center;gap:8px;padding:12px;background:#10b981;border-color:#10b981">
            <span id="btn-copiar-icon">📋</span> <span id="btn-copiar-text">Copiar Código</span>
          </button>
          <button type="button" class="btn btn-outline" id="btn-copiar-whatsapp" title="Copiar mensaje detallado para enviar por WhatsApp" style="padding:0 14px;font-size:1.15rem;white-space:nowrap;display:flex;align-items:center;gap:6px">
            <span>💬</span> <span style="font-size:0.8rem;font-weight:600">WhatsApp</span>
          </button>
        </div>

        <!-- Tarjeta con desglose de la autorización -->
        <div id="display-codigo-detalles" style="background:rgba(0,0,0,0.25);border:1px solid var(--cf-border,#334155);border-radius:10px;padding:12px 14px;font-size:0.82rem;text-align:left;line-height:1.6;margin-bottom:16px">
        </div>

        <div style="background:rgba(245,158,11,0.1);border:1px solid rgba(245,158,11,0.3);border-radius:8px;padding:9px 12px;font-size:0.79rem;color:#f59e0b;font-weight:600;margin-bottom:18px;display:flex;align-items:center;justify-content:center;gap:6px">
          <span>⏱️</span> <span>Vigencia: <strong>20 minutos</strong> (Uso único en mostrador)</span>
        </div>

        <!-- Botón de Cerrar Explícito (Solo se cierra al dar click aquí) -->
        <button type="button" class="btn btn-outline btn-full btn-lg" id="btn-codigo-exito-cerrar" style="font-size:0.92rem;font-weight:700;border-color:var(--cf-border,#475569);color:var(--cf-text,#f8fafc)">
          ✕ Cerrar Ventana
        </button>
      </div>
    </div>
    `;
  }

  function init() {
    _bindEvents();
    _loadSucursales();
    _loadCodigos();

    // Actualizar cuenta regresiva cada 5 segundos
    if (_timerInterval) clearInterval(_timerInterval);
    _timerInterval = setInterval(() => {
      _actualizarTiemposTabla();
    }, 5000);
  }

  function destroy() {
    if (_timerInterval) {
      clearInterval(_timerInterval);
      _timerInterval = null;
    }
  }

  function _bindEvents() {
    on('btn-auth-refresh', 'click', () => _loadCodigos());

    on('btn-auth-nuevo', 'click', () => {
      $('form-nuevo-codigo')?.reset();
      _setTipoOperacion('CONTADO');
      _setTipoDescuento('MONTO');
      const modal = $('modal-nuevo-codigo');
      if (modal) {
        modal.classList.remove('hidden');
        modal.style.display = 'flex';
      }
    });

    on('modal-nuevo-codigo-close', 'click', () => {
      const modal = $('modal-nuevo-codigo');
      if (modal) {
        modal.classList.add('hidden');
        modal.style.display = 'none';
      }
    });

    on('btn-codigo-exito-cerrar', 'click', _cerrarModalExito);
    on('btn-codigo-exito-x', 'click', _cerrarModalExito);
    on('btn-copiar-codigo', 'click', _copiarCodigoGrande);
    on('btn-copiar-whatsapp', 'click', _copiarWhatsApp);

    // Toggle tipo operacion
    document.querySelectorAll('#auth-tipo-operacion [data-op]').forEach(btn => {
      btn.addEventListener('click', () => _setTipoOperacion(btn.dataset.op));
    });

    // Toggle tipo descuento
    document.querySelectorAll('#auth-tipo-descuento [data-desc]').forEach(btn => {
      btn.addEventListener('click', () => _setTipoDescuento(btn.dataset.desc));
    });

    // Boton 100% patrocinio
    on('btn-auth-100pct', 'click', () => {
      _setTipoDescuento('PORCENTAJE');
      const valInput = $('auth-valor');
      if (valInput) {
        valInput.value = '100';
      }
      const motivo = $('auth-motivo');
      if (motivo && !motivo.value) {
        motivo.value = 'Patrocinio / Regalo de cortesía';
      }
    });

    // Submit form nuevo codigo
    on('form-nuevo-codigo', 'submit', async (e) => {
      e.preventDefault();
      await _submitNuevoCodigo();
    });
  }

  function _cerrarModalExito() {
    const modal = $('modal-codigo-exito');
    if (modal) {
      modal.classList.add('hidden');
      modal.style.display = 'none';
    }
    _loadCodigos();
  }

  function _setTipoOperacion(op) {
    document.querySelectorAll('#auth-tipo-operacion [data-op]').forEach(b => {
      b.classList.toggle('active', b.dataset.op === op);
    });
    const opcionesEnganche = $('auth-enganche-opciones');
    if (opcionesEnganche) {
      opcionesEnganche.classList.toggle('hidden', op !== 'ENGANCHE');
    }
    _actualizarAyudaValor();
  }

  function _setTipoDescuento(tipo) {
    document.querySelectorAll('#auth-tipo-descuento [data-desc]').forEach(b => {
      b.classList.toggle('active', b.dataset.desc === tipo);
    });
    const label = $('auth-valor-label');
    const input = $('auth-valor');
    if (label) {
      label.textContent = tipo === 'PORCENTAJE' ? 'Porcentaje de Descuento (%)' : 'Monto del Descuento ($)';
    }
    if (input) {
      input.placeholder = tipo === 'PORCENTAJE' ? 'Ej. 20 (máx 100)' : 'Ej. 300';
      input.max = tipo === 'PORCENTAJE' ? '100' : '';
    }
    _actualizarAyudaValor();
  }

  function _actualizarAyudaValor() {
    const op = document.querySelector('#auth-tipo-operacion .active')?.dataset.op || 'CONTADO';
    const tipo = document.querySelector('#auth-tipo-descuento .active')?.dataset.desc || 'MONTO';
    const ayuda = $('auth-valor-ayuda');
    if (!ayuda) return;

    if (op === 'ENGANCHE') {
      if (tipo === 'PORCENTAJE') {
        ayuda.textContent = 'Porcentaje sobre el enganche base del equipo (el enganche es el 100% de la base del descuento).';
      } else {
        ayuda.textContent = 'Monto en pesos que se descontará directamente del enganche.';
      }
    } else {
      if (tipo === 'PORCENTAJE') {
        ayuda.textContent = 'Porcentaje de descuento sobre el precio de contado (soporta hasta el 100% para patrocinios).';
      } else {
        ayuda.textContent = 'Monto directo en pesos que se restará al precio de contado.';
      }
    }
  }

  async function _loadSucursales() {
    try {
      const res = await API.sucursalListActivas();
      if (res && res.ok && Array.isArray(res.data)) {
        _sucursales = res.data;
        const sel = $('auth-sucursal');
        if (sel) {
          sel.innerHTML = '<option value="TODAS">🏢 Válido en Cualquier Sucursal</option>' +
            _sucursales.map(s => `<option value="${s.id}">${s.emoji || '🏢'} ${s.nombre}</option>`).join('');
          
          const sucActiva = (typeof State !== 'undefined' && State.get) ? State.get('sucursal') : null;
          if (sucActiva && sel.querySelector(`option[value="${sucActiva}"]`)) {
            sel.value = sucActiva;
          }
        }
      }
    } catch (_) {}
  }

  function _parseDateMs(val) {
    if (!val) return 0;
    if (val instanceof Date) return val.getTime();
    const str = String(val).trim().replace(' ', 'T');
    const t = new Date(str).getTime();
    if (!isNaN(t)) return t;
    const t2 = new Date(val).getTime();
    return !isNaN(t2) ? t2 : 0;
  }

  async function _loadCodigos() {
    const tbody = $('auth-tbody');
    if (tbody) tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;padding:24px">Cargando códigos…</td></tr>';

    try {
      const res = await API.authCodeList();
      if (res && res.ok && Array.isArray(res.data)) {
        _codigos = res.data;
        _renderTabla();
        _actualizarStats();
      } else {
        const msg = (res && res.message) ? res.message : 'Error al cargar códigos del servidor.';
        console.warn('API.authCodeList no exitoso:', res);
        if (tbody) tbody.innerHTML = `<tr><td colspan="10" style="text-align:center;color:var(--cf-danger);padding:20px">⚠ ${msg}</td></tr>`;
      }
    } catch (err) {
      console.error('Error al cargar códigos:', err);
      const msg = (err && err.message) ? err.message : 'Error de conexión al cargar códigos.';
      if (tbody) tbody.innerHTML = `<tr><td colspan="10" style="text-align:center;color:var(--cf-danger);padding:20px">⚠ ${msg}</td></tr>`;
    }
  }

  function _renderTabla() {
    const tbody = $('auth-tbody');
    if (!tbody) return;

    if (!Array.isArray(_codigos) || _codigos.length === 0) {
      tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;padding:30px;color:var(--cf-muted)">No hay códigos de autorización registrados aún. Haz clic en "Generar Nuevo Código".</td></tr>';
      return;
    }

    tbody.innerHTML = _codigos.map(c => {
      const esActivo = c.estatus === 'ACTIVO';
      const badgeCls = esActivo ? 'badge-success' : (c.estatus === 'USADO' ? 'badge-info' : 'badge-danger');
      const descStr = c.tipoDescuento === 'PORCENTAJE' ? `${c.valor}%` : fmt.currency(c.valor);
      const tiempoTexto = esActivo ? _formatearTiempoRestante(c.segundosRestantes) : c.estatus;

      return `
        <tr>
          <td>
            <div style="display:flex;align-items:center;gap:6px">
              <strong style="font-family:monospace;font-size:1.15rem;letter-spacing:1px;color:var(--cf-accent)">${c.codigo}</strong>
              <button class="btn btn-ghost btn-sm" title="Copiar código" onclick="AutorizacionesView.copiar('${c.codigo}')" style="padding:2px 6px;font-size:0.75rem">📋</button>
            </div>
          </td>
          <td>
            <span class="badge ${c.tipoOperacion === 'CONTADO' ? 'badge-warning' : 'badge-primary'}">
              ${c.tipoOperacion === 'CONTADO' ? '🛒 Contado' : '📋 Enganche'}
            </span>
          </td>
          <td style="font-weight:700">${descStr}</td>
          <td>
            ${c.diferirEnganche ? '<span style="color:#059669;font-weight:600">✔ Sí (Diferido)</span>' : '<span style="color:var(--cf-muted)">No</span>'}
          </td>
          <td style="max-width:200px;font-size:0.82rem;line-height:1.3" title="${c.motivo}">
            ${c.motivo || '<em style="color:var(--cf-muted)">Sin motivo</em>'}
          </td>
          <td>
            <span style="font-size:0.8rem">${c.sucursal === 'TODAS' ? '🌐 Todas' : c.sucursal}</span>
          </td>
          <td>
            <span class="badge ${badgeCls}" id="badge-vigencia-${c.id}">${tiempoTexto}</span>
          </td>
          <td style="font-size:0.8rem">${c.creadoPor}</td>
          <td style="font-size:0.8rem">
            ${c.usadoPor ? `<span style="color:var(--cf-accent)">${c.usadoPor}</span><br><small style="color:var(--cf-muted)">${c.referenciaUso || ''}</small>` : '—'}
          </td>
          <td style="text-align:right">
            ${esActivo ? `
              <button class="btn btn-outline btn-sm" style="color:var(--cf-danger);border-color:var(--cf-danger);font-size:0.75rem" onclick="AutorizacionesView.cancelar('${c.id}', '${c.codigo}')">
                ✕ Cancelar
              </button>
            ` : '—'}
          </td>
        </tr>
      `;
    }).join('');
  }

  function _actualizarTiemposTabla() {
    const now = Date.now();
    if (!Array.isArray(_codigos)) return;

    _codigos.forEach(c => {
      if (c.estatus === 'ACTIVO') {
        const expMs = _parseDateMs(c.fechaExpiracion);
        const seg = expMs > 0 ? Math.max(0, Math.floor((expMs - now) / 1000)) : 0;
        c.segundosRestantes = seg;

        const badge = $(`badge-vigencia-${c.id}`);
        if (badge) {
          if (seg <= 0) {
            c.estatus = 'EXPIRADO';
            badge.className = 'badge badge-danger';
            badge.textContent = 'EXPIRADO';
          } else {
            badge.textContent = _formatearTiempoRestante(seg);
          }
        }
      }
    });
    _actualizarStats();
  }

  function _formatearTiempoRestante(seg) {
    if (!seg || seg <= 0) return 'Expirado';
    const m = Math.floor(seg / 60);
    const s = seg % 60;
    return `⏳ ${m}m ${String(s).padStart(2, '0')}s`;
  }

  function _actualizarStats() {
    if (!Array.isArray(_codigos)) return;
    const activos = _codigos.filter(c => c.estatus === 'ACTIVO').length;
    const usados = _codigos.filter(c => c.estatus === 'USADO').length;
    const otros = _codigos.filter(c => c.estatus === 'EXPIRADO' || c.estatus === 'CANCELADO').length;

    if (typeof setText === 'function') {
      setText('stat-auth-activos', activos);
      setText('stat-auth-usados', usados);
      setText('stat-auth-expirados', otros);
      setText('auth-total-count', `${_codigos.length} códigos`);
    } else {
      const eA = $('stat-auth-activos'); if (eA) eA.textContent = activos;
      const eU = $('stat-auth-usados'); if (eU) eU.textContent = usados;
      const eO = $('stat-auth-expirados'); if (eO) eO.textContent = otros;
      const eT = $('auth-total-count'); if (eT) eT.textContent = `${_codigos.length} códigos`;
    }
  }

  async function _submitNuevoCodigo() {
    const op = document.querySelector('#auth-tipo-operacion .active')?.dataset.op || 'CONTADO';
    const tipoDesc = document.querySelector('#auth-tipo-descuento .active')?.dataset.desc || 'MONTO';
    const valor = parseFloat($('auth-valor')?.value) || 0;
    const motivo = $('auth-motivo')?.value.trim();
    const sucursal = $('auth-sucursal')?.value || 'TODAS';
    const diferirEnganche = $('auth-diferir-enganche')?.checked || false;

    if (valor <= 0) {
      toast('Ingresa un valor de descuento mayor a 0.', 'warning');
      return;
    }
    if (tipoDesc === 'PORCENTAJE' && valor > 100) {
      toast('El porcentaje no puede ser mayor al 100%.', 'warning');
      return;
    }
    if (!motivo) {
      toast('El motivo de la autorización es obligatorio.', 'warning');
      $('auth-motivo')?.focus();
      return;
    }

    showLoading(true);
    try {
      const res = await API.authCodeCreate({
        tipoOperacion: op,
        tipoDescuento: tipoDesc,
        valor,
        motivo,
        sucursal,
        diferirEnganche,
      });

      showLoading(false);
      if (res && res.ok) {
        // Cerrar modal de formulario
        const modalForm = $('modal-nuevo-codigo');
        if (modalForm) {
          modalForm.classList.add('hidden');
          modalForm.style.display = 'none';
        }

        // Guardar para copia de WhatsApp
        _ultimoCodigo = res;

        // Llenar datos en el modal de éxito central
        const dispGrande = $('display-codigo-grande');
        if (dispGrande) dispGrande.textContent = res.codigo;

        const descDetalle = res.tipoDescuento === 'PORCENTAJE' ? `${res.valor}%` : fmt.currency(res.valor);
        const opNombre = res.tipoOperacion === 'CONTADO' ? '🛒 Venta de Contado' : '📋 Enganche a Crédito';
        const sucNombre = (!res.sucursal || res.sucursal === 'TODAS') ? '🌐 Cualquier sucursal' : res.sucursal;

        setHTML('display-codigo-detalles', `
          <div style="display:flex;justify-content:space-between;margin-bottom:6px">
            <span style="color:var(--cf-muted)">Operación:</span>
            <strong>${opNombre}</strong>
          </div>
          <div style="display:flex;justify-content:space-between;margin-bottom:6px">
            <span style="color:var(--cf-muted)">Beneficio:</span>
            <strong style="color:#10b981;font-size:1.05rem">${descDetalle}</strong>
          </div>
          ${res.diferirEnganche ? `
            <div style="display:flex;justify-content:space-between;margin-bottom:6px;color:#059669">
              <span>Enganche:</span>
              <strong>✔ Diferido en Semanas ($0 hoy)</strong>
            </div>
          ` : ''}
          <div style="display:flex;justify-content:space-between;margin-bottom:6px">
            <span style="color:var(--cf-muted)">Motivo:</span>
            <strong style="text-align:right;max-width:240px">${res.motivo}</strong>
          </div>
          <div style="display:flex;justify-content:space-between">
            <span style="color:var(--cf-muted)">Sucursal:</span>
            <strong>${sucNombre}</strong>
          </div>
        `);

        // MOSTRAR MODAL CENTRAL Y DEJARLO ABIERTO
        const modalExito = $('modal-codigo-exito');
        if (modalExito) {
          modalExito.classList.remove('hidden');
          modalExito.style.display = 'flex';
        }

        // Cargar códigos en segundo plano para actualizar tabla
        _loadCodigos();
      } else {
        toast((res && res.message) || 'Error al generar código', 'error');
      }
    } catch (err) {
      showLoading(false);
      console.error('Error generando código:', err);
      toast('Error de red al generar código', 'error');
    }
  }

  function _copiarCodigoGrande() {
    const cod = $('display-codigo-grande')?.textContent.trim();
    if (!cod || cod === '------') return;
    _copiarTexto(cod, `Código ${cod} copiado`);
    const btnText = $('btn-copiar-text');
    const btnIcon = $('btn-copiar-icon');
    const btn = $('btn-copiar-codigo');
    if (btnText) btnText.textContent = '✔ ¡Código Copiado!';
    if (btnIcon) btnIcon.textContent = '✔';
    if (btn) btn.style.background = '#059669';
    setTimeout(() => {
      if (btnText) btnText.textContent = 'Copiar Código';
      if (btnIcon) btnIcon.textContent = '📋';
      if (btn) btn.style.background = '';
    }, 2500);
  }

  function _copiarWhatsApp() {
    const cod = $('display-codigo-grande')?.textContent.trim();
    if (!_ultimoCodigo) {
      if (cod && cod !== '------') _copiarTexto(cod, 'Código copiado');
      return;
    }
    const c = _ultimoCodigo;
    const descStr = c.tipoDescuento === 'PORCENTAJE' ? `${c.valor}%` : fmt.currency(c.valor);
    const opStr = c.tipoOperacion === 'CONTADO' ? 'Venta de Contado' : 'Enganche a Crédito';
    const sucStr = (!c.sucursal || c.sucursal === 'TODAS') ? 'Cualquier sucursal' : c.sucursal;
    const diferidoStr = c.diferirEnganche ? '\n📌 *Enganche:* Diferido a pagos semanales ($0 hoy)' : '';

    const msg = [
      `🎟️ *CREDYFAST — CÓDIGO DE AUTORIZACIÓN: ${c.codigo}*`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `🛒 *Operación:* ${opStr}`,
      `💵 *Beneficio:* Descuento de ${descStr}${diferidoStr}`,
      `📝 *Motivo:* ${c.motivo}`,
      `🏢 *Sucursal:* ${sucStr}`,
      `⏱️ *Vigencia:* 20 minutos (Uso único)`,
    ].join('\n');

    _copiarTexto(msg, 'Mensaje para WhatsApp copiado al portapapeles');
  }

  function _copiarTexto(texto, exitoMensaje = 'Copiado al portapapeles') {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(texto).then(() => {
        toast(`✔ ${exitoMensaje}`, 'success');
      }).catch(() => {
        _copiarTextoFallback(texto, exitoMensaje);
      });
    } else {
      _copiarTextoFallback(texto, exitoMensaje);
    }
  }

  function _copiarTextoFallback(texto, exitoMensaje) {
    try {
      const input = document.createElement('textarea');
      input.value = texto;
      input.style.position = 'fixed';
      input.style.opacity = '0';
      document.body.appendChild(input);
      input.focus();
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      toast(`✔ ${exitoMensaje}`, 'success');
    } catch (_) {
      prompt('Copia este código manualmente:', texto);
    }
  }

  async function cancelar(id, codigo) {
    if (!confirm(`¿Estás seguro de cancelar el código ${codigo}? Ya no podrá ser utilizado.`)) {
      return;
    }
    showLoading(true);
    try {
      const res = await API.authCodeCancel({ id });
      showLoading(false);
      if (res && res.ok) {
        toast(`✔ Código ${codigo} cancelado exitosamente`, 'success');
        _loadCodigos();
      } else {
        toast((res && res.message) || 'Error al cancelar código', 'error');
      }
    } catch (_) {
      showLoading(false);
      toast('Error de red al cancelar', 'error');
    }
  }

  function copiar(cod) {
    _copiarTexto(cod, `Código ${cod} copiado`);
  }

  return {
    render,
    init,
    destroy,
    cancelar,
    copiar,
  };

})();
