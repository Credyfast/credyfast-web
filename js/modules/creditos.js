/* ============================================================
   CredyFast — creditos.js  |  Módulo de Créditos (Fase B)
   Flujo: PENDIENTE → APROBADO_EN_ESPERA → APROVADO → FINALIZADO
   Roles: Vendedor (solicitar) | Supervisor (aprobar/rechazar)
          Cajero (confirmar entrega)
   ============================================================ */

const Creditos = (() => {

  let _productos = [];
  let _clientePresel = null;
  let _periodoSel = null;
  let _prodSel = null;
  let _creditosActuales = [];

  function render() {
    const user = State.get('user');
    const esSup = ['SuperUsuario', 'Supervisor'].includes(user?.rol);
    const esCaj = ['Cajero', 'Vendedor'].includes(user?.rol) || esSup;

    return `
    <div>
      <div class="section-header">
        <h2>Créditos</h2>
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
          <select id="cr-filter-estatus" class="btn btn-outline btn-sm" style="font-weight:500">
            <option value="">Todos</option>
            <option value="PENDIENTE">Pendientes</option>
            <option value="APROBADO_EN_ESPERA">En Espera Entrega</option>
            <option value="APROBADO">Activos</option>
            <option value="FINALIZADO">Finalizados</option>
            <option value="RECHAZADO">Rechazados</option>
          </select>
          ${user?.rol !== 'Cajero' ? `<button class="btn btn-primary btn-sm" id="btn-nuevo-credito">+ Nueva Solicitud</button>` : ''}
        </div>
      </div>

      <!-- Cola de autorización (Supervisor+) -->
      ${esSup ? `
      <div id="cola-pendientes" class="hidden" style="margin-bottom:16px">
        <div class="alert alert-warning">
          ⏳ Créditos pendientes de aprobación:
          <strong id="cola-count">0</strong>
          <button class="btn btn-sm btn-warning" style="margin-left:8px" id="btn-ver-pendientes">Ver Cola</button>
        </div>
      </div>` : ''}

      <!-- Créditos APROBADO_EN_ESPERA (Cajero confirma entrega) -->
      ${esCaj ? `
      <div id="entregas-panel" style="margin-bottom:14px"></div>` : ''}

      <div class="card" style="margin-bottom:14px">
        <div id="cr-list"><div class="table-empty">Cargando…</div></div>
      </div>

      <!-- Modal: Nueva Solicitud -->
      <div id="modal-credito" class="hidden" style="
        position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:200;
        display:flex;align-items:center;justify-content:center;padding:16px">
        <div class="card" style="width:100%;max-width:560px;max-height:92vh;overflow-y:auto">
          <div class="card-header">
            <h3>Nueva Solicitud de Crédito</h3>
            <button class="btn btn-ghost btn-sm" id="modal-cr-close">✕</button>
          </div>
          <div class="card-body" id="modal-cr-body"></div>
        </div>
      </div>

      <!-- Modal: Revisar Info -->
      <div id="modal-cr-review" class="hidden" style="
        position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:200;
        display:flex;align-items:center;justify-content:center;padding:16px">
        <div class="card" style="width:100%;max-width:700px;max-height:92vh;overflow-y:auto">
          <div class="card-header">
            <h3>Revisar Información de Solicitud</h3>
            <button class="btn btn-ghost btn-sm" id="modal-cr-review-close">✕</button>
          </div>
          <div class="card-body" id="cr-review-body"></div>
        </div>
      </div>

      <!-- Modal: Aprobar/Rechazar -->
      <div id="modal-cr-action" class="hidden" style="
        position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:210;
        display:flex;align-items:center;justify-content:center;padding:16px">
        <div class="card" style="width:100%;max-width:420px">
          <div class="card-header">
            <h3 id="cr-action-title">Acción</h3>
            <button class="btn btn-ghost btn-sm" id="modal-cr-action-close">✕</button>
          </div>
          <div class="card-body" id="cr-action-body"></div>
        </div>
      </div>

      <!-- Modal: Confirmar Entrega (Cajero) -->
      <div id="modal-entrega" class="hidden" style="
        position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:200;
        display:flex;align-items:center;justify-content:center;padding:16px">
        <div class="card" style="width:100%;max-width:440px">
          <div class="card-header">
            <h3>Confirmar Entrega del Producto</h3>
            <button class="btn btn-ghost btn-sm" id="modal-entrega-close">✕</button>
          </div>
          <div class="card-body" id="entrega-body"></div>
        </div>
      </div>
    </div>`;
  }

  function init() {
    const user = State.get('user');
    const esSup = ['SuperUsuario', 'Supervisor'].includes(user?.rol);
    const esCaj = ['Cajero', 'Vendedor'].includes(user?.rol) || esSup;

    _loadList();
    on('cr-filter-estatus', 'change', _loadList);
    on('btn-nuevo-credito', 'click', _openModal);
    on('modal-cr-close', 'click', () => $('modal-credito').classList.add('hidden'));
    on('modal-cr-review-close', 'click', () => $('modal-cr-review').classList.add('hidden'));
    on('modal-cr-action-close', 'click', () => $('modal-cr-action').classList.add('hidden'));
    on('modal-entrega-close', 'click', () => $('modal-entrega').classList.add('hidden'));

    if (esSup) _loadPendientesCount();
    if (esCaj) _loadEntregasPendientes();

    if (_clientePresel) {
      setTimeout(() => { _openModal(_clientePresel); _clientePresel = null; }, 100);
    }
  }

  function initRequestFor(cliente) { _clientePresel = cliente; }

  // ── Lista de créditos ──────────────────────────────────────
  async function _loadList() {
    const estatus = $('cr-filter-estatus')?.value;
    showLoading(true);
    try {
      const res = await API.creditList(estatus ? { estatus } : {});
      if (!res.ok) { toast(res.message, 'error'); return; }
      _creditosActuales = res.data || [];
      _renderList(_creditosActuales);
    } catch (_) { toast('Error de conexión.', 'error'); }
    finally { showLoading(false); }
  }

  function _renderList(creditos) {
    const user = State.get('user');
    const esSup = ['SuperUsuario', 'Supervisor'].includes(user?.rol);
    const esCaj = ['Cajero', 'Vendedor'].includes(user?.rol) || esSup;

    setHTML('cr-list', renderTable([
      { key: 'IDCredito', label: 'ID', class: 'td-mono' },
      { key: 'Nombre_cliente', label: 'Cliente' },
      { key: 'ESTATUS', label: 'Estado', render: r => badgeEstado(r['ESTATUS']) },
      { key: 'Periodo', label: 'Periodo', render: r => `${r['Periodo']} sem.` },
      { key: 'Pago_puntual', label: 'Cuota', class: 'td-right td-amount', render: r => fmt.currency(r['Pago_puntual']) },
      { key: 'Enganche', label: 'Enganche', class: 'td-right td-amount', render: r => fmt.currency(r['Enganche']) },
      { key: 'Fecha_de_inicio', label: 'Inicio', render: r => fmt.date(r['Fecha_de_inicio']) },
      {
        key: '_acc', label: 'Acción', render: r => {
          const btns = [];
          if (r['ESTATUS'] === 'PENDIENTE' && esSup) {
            btns.push(`<button class="btn btn-info btn-sm" onclick="Creditos._revisarInfo('${r['IDCredito']}')">🔍 Revisar Info</button>`);
          } else if (r['ESTATUS'] === 'APROBADO_EN_ESPERA' && esCaj) {
            btns.push(`<button class="btn btn-warning btn-sm" onclick="Creditos._confirmarEntrega('${r['IDCredito']}','${r['Nombre_cliente'] || ''}')">📦 Confirmar Entrega</button>`);
          }
          return btns.join('') || '—';
        }
      },
    ], creditos, 'No hay créditos para mostrar.'));
  }

  // ── Badge / cola de pendientes ─────────────────────────────
  async function _loadPendientesCount() {
    try {
      const res = await API.creditPendientes();
      if (res.ok && res.count > 0) {
        const panel = $('cola-pendientes');
        if (panel) { panel.classList.remove('hidden'); setHTML('cola-count', res.count); }
        Router.updateBadge(res.count);
        on('btn-ver-pendientes', 'click', () => {
          const sel = $('cr-filter-estatus');
          if (sel) { sel.value = 'PENDIENTE'; _loadList(); }
        });
      }
    } catch (_) { }
  }

  // ── Entregas pendientes (APROBADO_EN_ESPERA) ───────────────
  async function _loadEntregasPendientes() {
    try {
      const res = await API.creditList({ estatus: 'APROBADO_EN_ESPERA' });
      if (!res.ok || !res.data?.length) return;
      const panel = $('entregas-panel');
      if (!panel) return;
      panel.innerHTML = res.data.map(cr => `
        <div class="entrega-card">
          <div class="entrega-title">⏳ Pendiente de entrega: ${cr['Nombre_cliente'] || cr['IDCredito']}</div>
          <div style="font-size:.82rem;color:var(--cf-text-secondary);margin-bottom:10px">
            Crédito ${cr['IDCredito']} · Enganche: <strong>${fmt.currency(cr['Enganche'])}</strong>
          </div>
          <button class="btn btn-warning btn-sm" onclick="Creditos._confirmarEntrega('${cr['IDCredito']}','${cr['Nombre_cliente'] || ''}')">
            📦 Confirmar Entrega y Generar Calendario
          </button>
        </div>
      `).join('');
    } catch (_) { }
  }

  // ── Revisar Info (Supervisor) ─────────────────────────────
  async function _revisarInfo(IDCredito) {
    const cr = _creditosActuales.find(c => c['IDCredito'] === IDCredito);
    if (!cr) return;

    const modal = $('modal-cr-review');
    modal.classList.remove('hidden');
    modal.style.display = 'flex';
    
    setHTML('cr-review-body', '<div class="table-empty">Cargando información del cliente…</div>');
    
    try {
      // Obtener detalles del cliente y su historial de créditos
      const [resClient, resCredits] = await Promise.all([
        API.clientGet({ id: cr['IDCliente'] }),
        API.creditList({ IDCliente: cr['IDCliente'] })
      ]);

      let clientHtml = '';
      if (resClient.ok && resClient.data) {
        const cl = resClient.data;
        const docBtn = (label, id) => id 
          ? `<a href="https://drive.google.com/uc?id=${id}" target="_blank" rel="noopener" class="btn btn-outline btn-sm">📄 ${label}</a>`
          : `<span class="btn btn-outline btn-sm" disabled style="opacity:.5">📄 ${label} (No subido)</span>`;

        let activos = 0, concluidos = 0;
        if (resCredits.ok && resCredits.data) {
          activos = resCredits.data.filter(c => ['APROVADO', 'APROBADO_EN_ESPERA'].includes(c['ESTATUS'])).length;
          concluidos = resCredits.data.filter(c => c['ESTATUS'] === 'FINALIZADO').length;
        }

        clientHtml = `
          <div style="background:var(--cf-bg);border:1px solid var(--cf-border);border-radius:var(--radius-sm);padding:14px;margin-bottom:14px">
            <h4 style="margin-bottom:8px">Información del Cliente</h4>
            <div class="grid-2" style="gap:10px;font-size:.85rem;margin-bottom:12px">
              <div><div class="text-muted text-sm">Cliente</div><div class="fw-600">${cl['Nombre_completo']}</div></div>
              <div><div class="text-muted text-sm">CURP</div><div>${cl['CURP'] || '—'}</div></div>
              <div><div class="text-muted text-sm">Dirección</div><div>${cl['Direccion'] || '—'}</div></div>
              <div><div class="text-muted text-sm">Ocupación</div><div>${cl['A_que_se_dedica'] || '—'}</div></div>
              <div><div class="text-muted text-sm">Ingreso semanal</div><div>${fmt.currency(cl['Ingreso_semanal'])}</div></div>
              <div><div class="text-muted text-sm">Gastos semanales</div><div>${fmt.currency(cl['Gastos_semanales'])}</div></div>
              
              <div style="grid-column:1/-1;height:1px;background:var(--cf-border);margin:4px 0"></div>
              
              <div>
                <div class="text-muted text-sm">Créditos activos</div>
                <div class="fw-600" style="color:var(--cf-success)">${activos}</div>
              </div>
              <div>
                <div class="text-muted text-sm">Créditos concluidos</div>
                <div class="fw-600" style="color:var(--cf-text-secondary)">${concluidos}</div>
              </div>
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap">
              ${docBtn('INE Frente', cl['INE_Frente_ID'])}
              ${docBtn('INE Reverso', cl['INE_Reverso_ID'])}
              ${docBtn('Comprobante', cl['Comprobante_ID'])}
            </div>
          </div>
        `;
      }

      setHTML('cr-review-body', `
        ${clientHtml}
        
        <div style="background:var(--cf-bg);border:1px solid var(--cf-border);border-radius:var(--radius-sm);padding:14px;margin-bottom:14px">
          <h4 style="margin-bottom:8px">Formulario de la Solicitud (${cr['IDCredito']})</h4>
          <div class="grid-2" style="gap:10px;font-size:.85rem">
            <div><div class="text-muted text-sm">Celular</div><div class="fw-600">${cr['Celular'] || '—'}</div></div>
            <div><div class="text-muted text-sm">Periodo solicitado</div><div class="fw-600">${cr['Periodo']} semanas</div></div>
            
            <div style="grid-column:1/-1;height:1px;background:var(--cf-border);margin:4px 0"></div>
            
            <div><div class="text-muted text-sm">Ref. 1 Nombre</div><div>${cr['Nombre_referencia_1'] || '—'}</div></div>
            <div><div class="text-muted text-sm">Ref. 1 Teléfono</div><div>${cr['Numero_referencia_1'] || '—'}</div></div>
            <div><div class="text-muted text-sm">Ref. 2 Nombre</div><div>${cr['Nombre_referencia_2'] || '—'}</div></div>
            <div><div class="text-muted text-sm">Ref. 2 Teléfono</div><div>${cr['Numero_referencia_2'] || '—'}</div></div>
            
            <div style="grid-column:1/-1;height:1px;background:var(--cf-border);margin:4px 0"></div>
            
            <div><div class="text-muted text-sm">Dependientes económicos</div><div>${cr['Dependientes_economicos'] || '—'}</div></div>
            <div><div class="text-muted text-sm">Estado civil</div><div>${cr['Estado_civil'] || '—'}</div></div>
            <div><div class="text-muted text-sm">Tipo vivienda</div><div>${cr['Tipo_vivienda'] || '—'}</div></div>
            <div><div class="text-muted text-sm">Antigüedad domicilio</div><div>${cr['Antiguedad_domicilio'] ? cr['Antiguedad_domicilio']+' años' : '—'}</div></div>
            <div style="grid-column:1/-1"><div class="text-muted text-sm">Referencias de domicilio</div><div>${cr['Referencias_domicilio'] || '—'}</div></div>
            
            <div style="grid-column:1/-1"><div class="text-muted text-sm">Notas del promotor</div><div>${cr['NOTAS'] || '—'}</div></div>
          </div>
        </div>

        <div style="display:flex;gap:12px">
          <button class="btn btn-danger" style="flex:1" onclick="Creditos._accion('${cr['IDCredito']}','rechazar'); document.getElementById('modal-cr-review').classList.add('hidden')">✖ Rechazar Solicitud</button>
          <button class="btn btn-success" style="flex:1" onclick="Creditos._accion('${cr['IDCredito']}','aprobar'); document.getElementById('modal-cr-review').classList.add('hidden')">✔ Aprobar Solicitud</button>
        </div>
      `);
      
    } catch(err) {
      setHTML('cr-review-body', '<div class="alert alert-danger">Error al cargar la información del cliente.</div>');
    }
  }

  // ── Aprobar / Rechazar ────────────────────────────────────
  function _accion(IDCredito, tipo) {
    const modal = $('modal-cr-action');
    modal.classList.remove('hidden');
    modal.style.display = 'flex';
    setHTML('cr-action-title', tipo === 'aprobar' ? '✔ Aprobar Crédito' : '✖ Rechazar Crédito');
    setHTML('cr-action-body', `
      <p style="margin-bottom:12px">Crédito: <strong>${IDCredito}</strong></p>
      ${tipo === 'rechazar' ? `<div class="form-group"><label>Motivo de rechazo</label><textarea id="cr-motivo" rows="2" placeholder="Describe el motivo…"></textarea></div>` : ''}
      <button class="btn ${tipo === 'aprobar' ? 'btn-success' : 'btn-danger'} btn-full" id="cr-action-confirm">
        ${tipo === 'aprobar' ? '✔ Confirmar Aprobación' : '✖ Confirmar Rechazo'}
      </button>
    `);
    on('cr-action-confirm', 'click', async () => {
      showLoading(true);
      try {
        let res;
        if (tipo === 'aprobar') {
          res = await API.creditApprove({ IDCredito });
        } else {
          const motivo = $('cr-motivo')?.value || '';
          res = await API.creditReject({ IDCredito, motivo });
        }
        if (res.ok) {
          toast(res.message, 'success');
          $('modal-cr-action').classList.add('hidden');
          _loadList(); _loadPendientesCount(); _loadEntregasPendientes();
        } else { toast(res.message, 'error'); }
      } catch (_) { toast('Error de conexión.', 'error'); }
      finally { showLoading(false); }
    });
  }

  // ── Confirmar Entrega (Cajero) ────────────────────────────
  function _confirmarEntrega(IDCredito, nombre) {
    const modal = $('modal-entrega');
    modal.classList.remove('hidden');
    modal.style.display = 'flex';
    setHTML('entrega-body', `
      <div class="alert alert-warning" style="margin-bottom:14px">
        Confirmar entrega del producto a <strong>${nombre || IDCredito}</strong>.<br>
        Se generará el calendario de pagos en este momento.
      </div>
      <div class="form-group">
        <label>Foto de entrega del producto * (cliente recibiendo)</label>
        <input type="file" id="foto-entrega-input" accept="image/*" capture="environment">
        <div id="foto-entrega-status" class="text-sm text-muted" style="margin-top:4px"></div>
      </div>
      <button class="btn btn-warning btn-full" id="btn-confirm-entrega" disabled>
        📦 Confirmar Entrega y Generar Calendario
      </button>
    `);
    let fotoEntregaId = '';
    const fileInput = $('foto-entrega-input');
    if (fileInput) {
      fileInput.addEventListener('change', async () => {
        const file = fileInput.files[0];
        if (!file) return;
        setHTML('foto-entrega-status', '⏳ Subiendo foto…');
        try {
          const canvas = document.createElement('canvas');
          const img = new Image();
          const url = URL.createObjectURL(file);
          img.onload = async () => {
            const MAX = 1600; let w = img.width, h = img.height;
            if (w > MAX) { h = Math.round(h * MAX / w); w = MAX; }
            canvas.width = w; canvas.height = h;
            canvas.getContext('2d').drawImage(img, 0, 0, w, h);
            URL.revokeObjectURL(url);
            const b64 = canvas.toDataURL('image/jpeg', 0.7).split(',')[1];
            const res = await API.fileUpload({ base64: b64, filename: `entrega_${IDCredito}.jpg`, folder: 'creditos' });
            if (res.ok) {
              fotoEntregaId = res.fileId;
              setHTML('foto-entrega-status', '✔ Foto subida correctamente');
              const btn = $('btn-confirm-entrega');
              if (btn) btn.disabled = false;
            } else { setHTML('foto-entrega-status', `✖ Error: ${res.message}`); }
          };
          img.src = url;
        } catch (_) { setHTML('foto-entrega-status', '✖ Error de conexión'); }
      });
    }
    on('btn-confirm-entrega', 'click', async () => {
      if (!fotoEntregaId) { toast('La foto de entrega es obligatoria.', 'warning'); return; }
      showLoading(true);
      try {
        const res = await API.creditConfirmarEntrega({ IDCredito, Foto_Entrega_ID: fotoEntregaId });
        if (res.ok) {
          toast(res.message, 'success', 5000);
          $('modal-entrega').classList.add('hidden');
          _loadList(); _loadEntregasPendientes();
        } else { toast(res.message, 'error'); }
      } catch (_) { toast('Error de conexión.', 'error'); }
      finally { showLoading(false); }
    });
  }

  // ── Modal: Nueva Solicitud ─────────────────────────────────
  function _openModal(clientePreloaded = null) {
    _periodoSel = null; _prodSel = null;
    const modal = $('modal-credito');
    modal.classList.remove('hidden');
    modal.style.display = 'flex';
    _renderFormSolicitud(clientePreloaded?.IDCliente || '');
    if (clientePreloaded) {
      const el = $('cr-id-cliente');
      if (el) { el.value = clientePreloaded['IDCliente']; _verificarCliente(); }
    }
  }

  function _renderFormSolicitud(idClienteDefault = '') {
    setHTML('modal-cr-body', `
      <div class="form-group">
        <label>Buscar cliente por nombre</label>
        <div style="position:relative">
          <input type="text" id="cr-buscar-nombre" placeholder="Escribe el nombre…" autocomplete="off">
          <div id="cr-nombre-dropdown" style="
            display:none;position:absolute;top:100%;left:0;right:0;z-index:300;
            background:var(--cf-surface);border:1px solid var(--cf-border);
            border-radius:var(--radius-sm);max-height:180px;overflow-y:auto;
            box-shadow:0 4px 12px rgba(0,0,0,.15)
          "></div>
        </div>
      </div>
      <div class="form-group">
        <label>ID Cliente *</label>
        <div style="display:flex;gap:8px">
          <input type="text" id="cr-id-cliente" placeholder="CL00001" value="${idClienteDefault}">
          <button class="btn btn-teal btn-sm" id="cr-buscar-cl">Verificar</button>
        </div>
        <div id="cr-cliente-info" class="text-sm" style="margin-top:4px"></div>
      </div>
      <div class="form-group">
        <label>Producto *</label>
        <select id="cr-producto"><option value="">-- Selecciona producto --</option></select>
      </div>
      <div id="cr-periodo-area" class="hidden">
        <label style="font-size:.82rem;font-weight:600;color:var(--cf-text-secondary);margin-bottom:6px;display:block">Periodo *</label>
        <div class="periodo-selector" id="cr-periodos"></div>
      </div>
      <div id="cr-cotizador" class="hidden"></div>
      <div class="form-row">
        <div class="form-group"><label>Celular del cliente *</label><input type="tel" id="cr-celular" placeholder="10 dígitos"></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Referencia 1 — Nombre *</label><input type="text" id="cr-ref1n"></div>
        <div class="form-group"><label>Teléfono *</label><input type="tel" id="cr-ref1t"></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Referencia 2 — Nombre</label><input type="text" id="cr-ref2n"></div>
        <div class="form-group"><label>Teléfono</label><input type="tel" id="cr-ref2t"></div>
      </div>

      <hr class="divider" style="margin:14px 0 10px">
      <div style="font-size:.8rem;font-weight:700;color:var(--cf-text-secondary);margin-bottom:10px">📋 Información socioeconómica</div>

      <div class="form-row">
        <div class="form-group">
          <label>Dependientes económicos</label>
          <select id="cr-dependientes">
            ${[0,1,2,3,4,5,6,7,8,9,10].map(n => `<option value="${n}">${n}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Estado civil</label>
          <select id="cr-estado-civil">
            <option value="">-- Seleccionar --</option>
            <option>Soltero/a</option>
            <option>Casado/a</option>
            <option>Unión libre</option>
            <option>Divorciado/a</option>
            <option>Viudo/a</option>
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Tipo de vivienda</label>
          <select id="cr-tipo-vivienda">
            <option value="">-- Seleccionar --</option>
            <option>Propia</option>
            <option>Rentada</option>
            <option>Familiar</option>
            <option>Otro</option>
          </select>
        </div>
        <div class="form-group">
          <label>Antigüedad de domicilio (años)</label>
          <select id="cr-antiguedad">
            ${[0,1,2,3,4,5,6,7,8,9,10].map(n => `<option value="${n}">${n}</option>`).join('')}
            <option value="+10">+10</option>
          </select>
        </div>
      </div>
      <div class="form-group">
        <label>Referencias de domicilio</label>
        <input type="text" id="cr-ref-domicilio" placeholder="Vecinos, referencias cercanas…">
      </div>

      <div class="form-group">
        <label>Notas</label>
        <textarea id="cr-notas" rows="2" placeholder="Opcional…" style="resize:vertical"></textarea>
      </div>
      <button class="btn btn-primary btn-full" id="cr-submit-btn">Enviar Solicitud</button>
    `);
    _loadProductos();
    on('cr-buscar-cl',  'click',   _verificarCliente);
    on('cr-id-cliente', 'keydown', e => { if (e.key === 'Enter') _verificarCliente(); });
    on('cr-producto',   'change',  _onProductoChange);
    on('cr-submit-btn', 'click',   _submitSolicitud);
    if (idClienteDefault) setTimeout(_verificarCliente, 100);

    // ── Búsqueda por nombre con autocomplete ─────────────────
    let _searchTimer = null;
    const nombreInput    = $('cr-buscar-nombre');
    const dropdown       = $('cr-nombre-dropdown');
    const idInput        = $('cr-id-cliente');

    if (nombreInput && dropdown) {
      nombreInput.addEventListener('input', () => {
        clearTimeout(_searchTimer);
        const q = nombreInput.value.trim();
        if (q.length < 2) { dropdown.style.display = 'none'; return; }
        _searchTimer = setTimeout(async () => {
          try {
            const res = await API.clientSearch({ query: q });
            if (!res.ok || !res.data?.length) {
              dropdown.innerHTML = '<div style="padding:8px 12px;font-size:.82rem;opacity:.6">Sin resultados</div>';
              dropdown.style.display = 'block';
              return;
            }
            dropdown.innerHTML = res.data.map(cl => `
              <div style="padding:8px 12px;cursor:pointer;font-size:.83rem;
                border-bottom:1px solid var(--cf-border)"
                onmousedown="event.preventDefault()"
                onclick="(function(){
                  document.getElementById('cr-id-cliente').value='${cl['IDCliente']}';
                  document.getElementById('cr-buscar-nombre').value='${(cl['Nombre_completo']||'').replace(/'/g,'\\&apos;')}';
                  document.getElementById('cr-nombre-dropdown').style.display='none';
                  Creditos._verificarClientePublic();
                })()">
                <strong>${cl['Nombre_completo'] || cl['IDCliente']}</strong>
                <span style="opacity:.55;margin-left:6px">${cl['IDCliente']}</span>
              </div>`).join('');
            dropdown.style.display = 'block';
          } catch(_) {}
        }, 300);
      });
      nombreInput.addEventListener('blur', () => {
        setTimeout(() => { dropdown.style.display = 'none'; }, 200);
      });
    }
  }


  async function _loadProductos() {
    if (_productos.length) { _fillProductSelect(); return; }
    try {
      const res = await API.productList();
      if (res.ok) _productos = (res.data || []).filter(p => p['Estatus'] === 'DISPONIBLE');
      _fillProductSelect();
    } catch (_) { }
  }

  function _fillProductSelect() {
    const sel = $('cr-producto'); if (!sel) return;
    sel.innerHTML = '<option value="">-- Selecciona producto --</option>' +
      _productos.map(p => `<option value="${p['IDProd']}">${p['IDProd']} - ${p['MOD_COMERCIAL']}</option>`).join('');
  }

  function _onProductoChange() {
    const IDProd = $('cr-producto')?.value;
    _prodSel = _productos.find(p => p['IDProd'] === IDProd) || null;
    _periodoSel = null;
    const periodoArea = $('cr-periodo-area');
    const cotiz = $('cr-cotizador');
    if (!_prodSel) { periodoArea?.classList.add('hidden'); cotiz?.classList.add('hidden'); return; }
    periodoArea?.classList.remove('hidden');
    const costo = parseFloat(_prodSel['COSTO_MOSTRADO']) || 0;
    const LIMITE = 8000;
    const periodos = costo <= LIMITE ? [13, 26] : [13, 26, 39, 52];
    setHTML('cr-periodos', periodos.map(p =>
      `<button class="periodo-btn" data-p="${p}" type="button">${p} sem.</button>`
    ).join(''));
    document.querySelectorAll('.periodo-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.periodo-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        _periodoSel = parseInt(btn.dataset.p);
        _mostrarCotizador();
      });
    });
    cotiz?.classList.add('hidden');
  }

  function _mostrarCotizador() {
    if (!_prodSel || !_periodoSel) return;
    const costo = parseFloat(_prodSel['COSTO_MOSTRADO']) || 0;
    const costoReal = parseFloat(_prodSel['COSTO_REAL']) || 0;
    const contado = parseFloat(_prodSel['Precio_de_contado']) || Math.round(costo * 1.5);
    const pctMap = { 13: 0.07, 26: 0.06, 39: 0.05, 52: 0.04 };
    const enganche = Math.round(costo * 0.20);
    const puntual = Math.round(contado * (pctMap[_periodoSel] || 0.06));
    const normal = Math.round(puntual * 1.10);
    const moroso = Math.round(normal * 1.10);
    const semRec = Math.ceil((costoReal - enganche) / puntual);
    const cotiz = $('cr-cotizador'); if (!cotiz) return;
    cotiz.classList.remove('hidden');
    cotiz.innerHTML = `
      <div class="cotizador-result">
        <div class="cotiz-titulo">💰 Simulación — ${_periodoSel} semanas</div>
        <div style="font-size:0.8rem;color:var(--cf-text-secondary);margin-bottom:12px;padding-bottom:12px;border-bottom:1px solid var(--cf-border)">
          <strong>${_prodSel['MARCA']} ${_prodSel['MODELO']}</strong> (${_prodSel['MOD_COMERCIAL'] || '—'})<br>
          <span style="opacity:0.8">NS: ${_prodSel['NS'] || '—'} | RAM: ${_prodSel['RAM'] || 0}GB | Alm: ${_prodSel['ALMACENAMIENTO'] || 0}GB | Color: ${_prodSel['COLOR'] || '—'}</span>
        </div>
        <div class="cotizador-grid">
          <div class="cotizador-item"><div class="ci-label">Enganche</div><div class="ci-val">${fmt.currency(enganche)}</div></div>
          <div class="cotizador-item"><div class="ci-label">Pago puntual</div><div class="ci-val">${fmt.currency(puntual)}</div></div>
          <div class="cotizador-item"><div class="ci-label">Pago normal (+7d)</div><div class="ci-val">${fmt.currency(normal)}</div></div>
          <div class="cotizador-item"><div class="ci-label">Pago moroso</div><div class="ci-val">${fmt.currency(moroso)}</div></div>
          <div class="cotizador-item"><div class="ci-label">Sem. recuperación</div><div class="ci-val">${semRec}</div></div>
          <div class="cotizador-item"><div class="ci-label">Precio contado</div><div class="ci-val">${fmt.currency(contado)}</div></div>
        </div>
      </div>`;
  }

  async function _verificarCliente() {
    const id = $('cr-id-cliente')?.value.trim(); if (!id) return;
    setHTML('cr-cliente-info', 'Buscando…');
    try {
      const res = await API.clientGet({ id });
      if (res.ok && res.data) {
        const cl = res.data;
        const fotosOk = cl['INE_Frente_ID'] && cl['INE_Reverso_ID'] && cl['Comprobante_ID'];
        setHTML('cr-cliente-info',
          `<span style="color:var(--cf-accent)">✔ ${cl['Nombre_completo']}</span>` +
          (fotosOk ? '' : ' &nbsp;<span style="color:var(--cf-danger)">⚠ Sin documentos completos</span>')
        );
      } else {
        setHTML('cr-cliente-info', '<span style="color:var(--cf-danger)">✖ Cliente no encontrado.</span>');
      }
    } catch (_) { setHTML('cr-cliente-info', 'Error de búsqueda.'); }
  }

  // Expuesto para llamarse desde el autocomplete inline
  function _verificarClientePublic() { _verificarCliente(); }

  async function _submitSolicitud() {
    const IDCliente = $('cr-id-cliente')?.value.trim();
    const IDProd    = $('cr-producto')?.value;
    const Celular   = $('cr-celular')?.value.trim();
    if (!IDCliente || !IDProd) { toast('Cliente y producto son obligatorios.', 'warning'); return; }
    if (!_periodoSel) { toast('Selecciona un periodo.', 'warning'); return; }
    if (!Celular) { toast('Celular del cliente es obligatorio.', 'warning'); return; }
    const ref1n = $('cr-ref1n')?.value.trim();
    const ref1t = $('cr-ref1t')?.value.trim();
    if (!ref1n || !ref1t) { toast('Referencia 1 (nombre y teléfono) es obligatoria.', 'warning'); return; }

    showLoading(true);
    try {
      const res = await API.creditRequest({
        IDCliente, IDProd, Periodo: _periodoSel, Celular,
        Nombre_referencia_1:   ref1n,
        Numero_referencia_1:   ref1t,
        Nombre_referencia_2:   $('cr-ref2n')?.value || '',
        Numero_referencia_2:   $('cr-ref2t')?.value || '',
        NOTAS:                 $('cr-notas')?.value || '',
        Dependientes_economicos: $('cr-dependientes')?.value || '0',
        Tipo_vivienda:           $('cr-tipo-vivienda')?.value || '',
        Antiguedad_domicilio:    $('cr-antiguedad')?.value || '0',
        Referencias_domicilio:   $('cr-ref-domicilio')?.value || '',
        Estado_civil:            $('cr-estado-civil')?.value || '',
      });
      if (res.ok) {
        toast(`✔ Solicitud ${res.id} enviada. Pendiente de aprobación.`, 'success', 5000);
        $('modal-credito').classList.add('hidden');
        _loadList();
      } else { toast(res.message, 'error'); }
    } catch (_) { toast('Error de conexión.', 'error'); }
    finally { showLoading(false); }
  }

  return { render, init, initRequestFor, _accion, _revisarInfo, _confirmarEntrega, _verificarClientePublic };
})();
