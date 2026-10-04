/* ============================================================
   CredyFast — autorizaciones.js
   Gestión y Generación de Códigos de Autorización / Descuentos
   Válido para Venta de Contado y Enganche a Crédito (6 dígitos, máx 20 min).
   ============================================================ */

const AutorizacionesView = (() => {

  let _codigos = [];
  let _timerInterval = null;
  let _sucursales = [];

  function render() {
    return `
    <div class="view-header">
      <div>
        <h2>🎟️ Códigos de Autorización y Descuentos</h2>
        <p class="text-secondary" style="font-size:0.85rem;margin-top:2px">
          Genera códigos numéricos de 6 dígitos de uso único con vigencia máxima de 20 minutos.
        </p>
      </div>
      <div style="display:flex;gap:10px">
        <button class="btn btn-outline" id="btn-auth-refresh">🔄 Actualizar</button>
        <button class="btn btn-primary" id="btn-auth-nuevo">➕ Generar Nuevo Código</button>
      </div>
    </div>

    <!-- ── STATS CARDS ── -->
    <div class="dash-grid" style="grid-template-columns:repeat(auto-fit,minmax(200px,1fr));margin-bottom:20px">
      <div class="stat-card">
        <div class="stat-icon" style="background:rgba(16,185,129,0.1);color:#10b981">⚡</div>
        <div>
          <div class="stat-label">Códigos Activos</div>
          <div class="stat-val" id="stat-auth-activos">0</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon" style="background:rgba(59,130,246,0.1);color:#3b82f6">✔</div>
        <div>
          <div class="stat-label">Usados</div>
          <div class="stat-val" id="stat-auth-usados">0</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon" style="background:rgba(239,68,68,0.1);color:#ef4444">⏳</div>
        <div>
          <div class="stat-label">Expirados / Cancelados</div>
          <div class="stat-val" id="stat-auth-expirados">0</div>
        </div>
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
    <div id="modal-nuevo-codigo" class="hidden" style="position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:250;display:flex;align-items:center;justify-content:center;padding:16px">
      <div class="card" style="width:100%;max-width:520px;max-height:92vh;overflow-y:auto;box-shadow:var(--shadow-xl);border:1px solid var(--cf-border)">
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

    <!-- ══ MODAL CÓDIGO GENERADO CON ÉXITO ══ -->
    <div id="modal-codigo-exito" class="hidden" style="position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:300;display:flex;align-items:center;justify-content:center;padding:16px">
      <div class="card" style="width:100%;max-width:440px;text-align:center;padding:24px;box-shadow:var(--shadow-xl);border:2px solid #10b981">
        <div style="font-size:2.5rem;margin-bottom:8px">🎉</div>
        <h3 style="margin-bottom:4px;color:#10b981">¡Código de Autorización Listo!</h3>
        <p style="font-size:0.85rem;color:var(--cf-muted);margin-bottom:16px">
          Proporciona este código de 6 dígitos al cajero o vendedor:
        </p>

        <!-- Bloque Grande del Código -->
        <div id="display-codigo-grande" style="font-size:2.8rem;font-weight:900;letter-spacing:6px;background:var(--cf-bg);padding:14px;border-radius:var(--radius-md);border:2px dashed #10b981;color:var(--cf-accent);margin-bottom:14px;font-family:monospace">
          ------
        </div>

        <button class="btn btn-primary btn-full btn-lg" id="btn-copiar-codigo" style="margin-bottom:14px;font-size:1rem">
          📋 Copiar Código para WhatsApp
        </button>

        <div id="display-codigo-detalles" style="background:var(--cf-bg);border-radius:var(--radius-sm);padding:12px;font-size:0.82rem;text-align:left;line-height:1.6;margin-bottom:16px;border:1px solid var(--cf-border)">
        </div>

        <div style="font-size:0.82rem;color:var(--cf-warning);font-weight:600;margin-bottom:14px">
          ⏳ Expira en 20 minutos (Uso único)
        </div>

        <button class="btn btn-ghost btn-full" id="btn-codigo-exito-cerrar">
          Entendido, cerrar ventana
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
      $('modal-nuevo-codigo')?.classList.remove('hidden');
    });

    on('modal-nuevo-codigo-close', 'click', () => {
      $('modal-nuevo-codigo')?.classList.add('hidden');
    });

    on('btn-codigo-exito-cerrar', 'click', () => {
      $('modal-codigo-exito')?.classList.add('hidden');
      _loadCodigos();
    });

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

    // Copiar codigo grande
    on('btn-copiar-codigo', 'click', () => {
      const cod = $('display-codigo-grande')?.textContent.trim();
      if (!cod) return;
      navigator.clipboard.writeText(cod).then(() => {
        toast(`✔ Código ${cod} copiado al portapapeles`, 'success');
      }).catch(() => {
        toast(`Código: ${cod}`, 'info');
      });
    });
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
      if (res.ok && Array.isArray(res.data)) {
        _sucursales = res.data;
        const sel = $('auth-sucursal');
        if (sel) {
          sel.innerHTML = '<option value="TODAS">🏢 Válido en Cualquier Sucursal</option>' +
            _sucursales.map(s => `<option value="${s.id}">${s.emoji || '🏢'} ${s.nombre}</option>`).join('');
          
          // Preseleccionar la sucursal activa del usuario si la tiene
          const sucActiva = State.get('sucursal');
          if (sucActiva && sel.querySelector(`option[value="${sucActiva}"]`)) {
            sel.value = sucActiva;
          }
        }
      }
    } catch (_) {}
  }

  async function _loadCodigos() {
    const tbody = $('auth-tbody');
    if (tbody) tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;padding:24px">Cargando códigos…</td></tr>';

    try {
      const res = await API.authCodeList();
      if (res.ok && Array.isArray(res.data)) {
        _codigos = res.data;
        _renderTabla();
        _actualizarStats();
      } else {
        if (tbody) tbody.innerHTML = `<tr><td colspan="10" style="text-align:center;color:var(--cf-danger);padding:20px">${res.message || 'Error al cargar códigos'}</td></tr>`;
      }
    } catch (err) {
      if (tbody) tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;color:var(--cf-danger);padding:20px">Error de conexión al cargar códigos.</td></tr>';
    }
  }

  function _renderTabla() {
    const tbody = $('auth-tbody');
    if (!tbody) return;

    if (_codigos.length === 0) {
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
              <strong style="font-family:monospace;font-size:1.1rem;letter-spacing:1px;color:var(--cf-accent)">${c.codigo}</strong>
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
    _codigos.forEach(c => {
      if (c.estatus === 'ACTIVO') {
        const exp = new Date(c.fechaExpiracion).getTime();
        const seg = Math.max(0, Math.floor((exp - now) / 1000));
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
    if (seg <= 0) return 'Expirado';
    const m = Math.floor(seg / 60);
    const s = seg % 60;
    return `⏳ ${m}m ${String(s).padStart(2, '0')}s`;
  }

  function _actualizarStats() {
    const activos = _codigos.filter(c => c.estatus === 'ACTIVO').length;
    const usados = _codigos.filter(c => c.estatus === 'USADO').length;
    const otros = _codigos.filter(c => c.estatus === 'EXPIRADO' || c.estatus === 'CANCELADO').length;

    setText('stat-auth-activos', activos);
    setText('stat-auth-usados', usados);
    setText('stat-auth-expirados', otros);
    setText('auth-total-count', `${_codigos.length} códigos`);
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
      if (res.ok) {
        $('modal-nuevo-codigo')?.classList.add('hidden');
        toast(`✔ Código ${res.codigo} generado exitosamente`, 'success');

        // Mostrar modal de éxito con el código grande
        setText('display-codigo-grande', res.codigo);

        const descDetalle = res.tipoDescuento === 'PORCENTAJE' ? `${res.valor}%` : fmt.currency(res.valor);
        setHTML('display-codigo-detalles', `
          <strong>Operación:</strong> ${res.tipoOperacion === 'CONTADO' ? 'Venta de Contado' : 'Enganche de Crédito'}<br>
          <strong>Beneficio:</strong> Descuento de ${descDetalle}${res.diferirEnganche ? ' + Enganche Diferido en Semanas' : ''}<br>
          <strong>Motivo:</strong> ${res.motivo}<br>
          <strong>Sucursal:</strong> ${res.sucursal === 'TODAS' ? 'Cualquier sucursal' : res.sucursal}<br>
          <strong>Vigencia:</strong> 20 minutos a partir de ahora.
        `);

        $('modal-codigo-exito')?.classList.remove('hidden');
        _loadCodigos();
      } else {
        toast(res.message || 'Error al generar código', 'error');
      }
    } catch (err) {
      showLoading(false);
      toast('Error de red al generar código', 'error');
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
      if (res.ok) {
        toast(`✔ Código ${codigo} cancelado exitosamente`, 'success');
        _loadCodigos();
      } else {
        toast(res.message || 'Error al cancelar código', 'error');
      }
    } catch (_) {
      showLoading(false);
      toast('Error de red al cancelar', 'error');
    }
  }

  function copiar(cod) {
    navigator.clipboard.writeText(cod).then(() => {
      toast(`✔ Código ${cod} copiado`, 'success');
    }).catch(() => {
      toast(`Código: ${cod}`, 'info');
    });
  }

  return {
    render,
    init,
    destroy,
    cancelar,
    copiar,
  };

})();
