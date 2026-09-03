/* ============================================================
   CredyFast — productos.js  |  Catálogo de Productos
   Columnas: IDProd, Marca_temporal, MARCA, MODELO, MOD_COMERCIAL,
             NS, RAM, ALMACENAMIENTO, COLOR, COSTO_REAL, COSTO_MOSTRADO, PROVEEDOR
   ============================================================ */

const Productos = (() => {

  let _lista = [];

  function render() {
    return `
    <div>
      <div class="section-header">
        <h2>Catálogo de Productos</h2>
        <button class="btn btn-primary btn-sm" id="btn-nuevo-producto">+ Nuevo Producto</button>
      </div>

      <!-- Filtro rápido -->
      <div style="display:flex;gap:10px;margin-bottom:14px;flex-wrap:wrap">
        <input type="text" id="prod-filter" placeholder="Filtrar por marca, modelo, color…"
          style="flex:1;min-width:180px;padding:7px 12px;border:1.5px solid var(--cf-border);border-radius:var(--radius-sm)">
        <button class="btn btn-ghost btn-sm" id="prod-clear-filter">✕ Limpiar</button>
      </div>

      <!-- Tabla de productos -->
      <div class="card">
        <div id="prod-table"><div class="table-empty">Cargando…</div></div>
      </div>

      <!-- Modal crear / editar -->
      <div id="modal-producto" class="hidden" style="
        position:fixed;inset:0;background:rgba(0,0,0,0.45);z-index:200;
        display:flex;align-items:center;justify-content:center;padding:16px;overflow-y:auto">
        <div class="card" style="width:100%;max-width:560px;max-height:92vh;overflow-y:auto">
          <div class="card-header">
            <h3 id="modal-prod-title">Nuevo Producto</h3>
            <button class="btn btn-ghost btn-sm" id="modal-prod-close">✕</button>
          </div>
          <div class="card-body">

            <!-- MARCA y MODELO -->
            <div class="form-row">
              <div class="form-group">
                <label>MARCA *</label>
                <input type="text" id="prod-marca" placeholder="Samsung, LG, Apple…">
              </div>
              <div class="form-group">
                <label>MODELO (interno)</label>
                <input type="text" id="prod-modelo" placeholder="Ej: SM-A256">
              </div>
            </div>

            <!-- MOD_COMERCIAL y COLOR -->
            <div class="form-row">
              <div class="form-group">
                <label>MOD. COMERCIAL</label>
                <input type="text" id="prod-mod-comercial" placeholder="Nombre comercial del producto">
              </div>
              <div class="form-group">
                <label>COLOR</label>
                <input type="text" id="prod-color" placeholder="Negro, Blanco, Azul…">
              </div>
            </div>

            <!-- NS -->
            <div class="form-group">
              <label>N° de Serie (NS)</label>
              <input type="text" id="prod-ns" placeholder="Número de serie del artículo">
            </div>

            <!-- RAM y ALMACENAMIENTO -->
            <div class="form-row">
              <div class="form-group">
                <label>RAM (GB) <span class="text-muted text-sm">— 0 si no aplica</span></label>
                <input type="number" id="prod-ram" min="0" step="1" value="0" placeholder="0">
              </div>
              <div class="form-group">
                <label>ALMACENAMIENTO (GB) <span class="text-muted text-sm">— 0 si no aplica</span></label>
                <input type="number" id="prod-almacenamiento" min="0" step="1" value="0" placeholder="0">
              </div>
            </div>

            <hr class="divider">
            <div style="font-size:.82rem;font-weight:700;color:var(--cf-text-secondary);margin-bottom:10px;text-transform:uppercase;letter-spacing:.05em">Costos</div>

            <div class="form-row">
              <div class="form-group">
                <label>COSTO REAL ($)</label>
                <input type="number" id="prod-costo-real" min="0" step="0.01" placeholder="0.00">
              </div>
              <div class="form-group">
                <label>COSTO MOSTRADO ($) * <span class="text-muted text-sm">— base de cálculos</span></label>
                <input type="number" id="prod-costo-mostrado" min="0" step="0.01" placeholder="0.00">
              </div>
            </div>

            <hr class="divider">

            <!-- PROVEEDOR -->
            <div class="form-group">
              <label>PROVEEDOR</label>
              <input type="text" id="prod-proveedor" placeholder="Nombre del vendedor o proveedor">
            </div>

            <div id="prod-error" class="alert alert-danger hidden" style="margin-bottom:12px"></div>

            <button class="btn btn-primary btn-full" id="prod-submit-btn">
              Guardar Producto
            </button>
          </div>
        </div>
      </div>
    </div>`;
  }

  function init() {
    _cargar();
    on('btn-nuevo-producto',  'click', () => _abrirModal(null));
    on('modal-prod-close',    'click', _cerrarModal);
    on('prod-submit-btn',     'click', _guardar);
    on('prod-filter',         'input', _filtrar);
    on('prod-clear-filter',   'click', () => {
      $('prod-filter').value = '';
      _renderTabla(_lista);
    });
  }

  // ── Cargar ────────────────────────────────────────────────
  async function _cargar() {
    showLoading(true);
    try {
      const res = await API.productList();
      if (!res.ok) { toast(res.message, 'error'); return; }
      _lista = res.data || [];
      _renderTabla(_lista);
    } catch(_) { toast('Error de conexión.', 'error'); }
    finally { showLoading(false); }
  }

  function _filtrar() {
    const q = ($('prod-filter')?.value || '').toLowerCase();
    if (!q) { _renderTabla(_lista); return; }
    const filtrado = _lista.filter(p =>
      ['MARCA','MODELO','MOD_COMERCIAL','COLOR','PROVEEDOR','NS'].some(col =>
        String(p[col] || '').toLowerCase().includes(q)
      )
    );
    _renderTabla(filtrado);
  }

  // ── Tabla ─────────────────────────────────────────────────
  function _renderTabla(productos) {
    const user = State.get('user');
    const puedeEditar = ['SuperUsuario','Supervisor'].includes(user?.rol);

    setHTML('prod-table', renderTable([
      { key: 'IDProd',         label: 'ID',            class: 'td-mono' },
      { key: 'MARCA',          label: 'Marca',         render: r => `<strong>${r['MARCA'] || '—'}</strong>` },
      { key: 'MODELO',         label: 'Modelo',        render: r => r['MODELO'] || '—' },
      { key: 'MOD_COMERCIAL',  label: 'Mod. Comercial',render: r => r['MOD_COMERCIAL'] || '—' },
      { key: 'COLOR',          label: 'Color',         render: r => r['COLOR'] || '—' },
      { key: 'RAM',            label: 'RAM',           class: 'td-right',
        render: r => parseInt(r['RAM']) > 0 ? `${r['RAM']} GB` : '—' },
      { key: 'ALMACENAMIENTO', label: 'Almac.',        class: 'td-right',
        render: r => parseInt(r['ALMACENAMIENTO']) > 0 ? `${r['ALMACENAMIENTO']} GB` : '—' },
      { key: 'COSTO_REAL',     label: 'Costo Real',    class: 'td-right td-amount',
        render: r => fmt.currency(r['COSTO_REAL']) },
      { key: 'COSTO_MOSTRADO', label: 'Costo Mostrado',class: 'td-right td-amount',
        render: r => `<strong>${fmt.currency(r['COSTO_MOSTRADO'])}</strong>` },
      { key: 'PROVEEDOR',      label: 'Proveedor',     render: r => r['PROVEEDOR'] || '—' },
      { key: 'Marca_temporal', label: 'Registrado',    render: r => fmt.dateTime(r['Marca_temporal']) },
      { key: '_acc',           label: '',
        render: r => puedeEditar
          ? `<button class="btn btn-outline btn-sm"
               onclick='Productos._abrirModal(${JSON.stringify(r).replace(/'/g,"&#39;")})'>
               ✏ Editar</button>`
          : ''
      },
    ], productos, 'No hay productos. Agrega el primero con "+ Nuevo Producto".'));
  }

  // ── Modal ─────────────────────────────────────────────────
  function _abrirModal(producto) {
    const modal = $('modal-producto');
    modal.classList.remove('hidden');
    modal.style.display = 'flex';
    setHTML('modal-prod-title', producto ? 'Editar Producto' : 'Nuevo Producto');
    $('prod-error').classList.add('hidden');

    // Mapeo campo-ID ↔ clave del objeto
    const campos = {
      'prod-marca':          'MARCA',
      'prod-modelo':         'MODELO',
      'prod-mod-comercial':  'MOD_COMERCIAL',
      'prod-color':          'COLOR',
      'prod-ns':             'NS',
      'prod-ram':            'RAM',
      'prod-almacenamiento': 'ALMACENAMIENTO',
      'prod-costo-real':     'COSTO_REAL',
      'prod-costo-mostrado': 'COSTO_MOSTRADO',
      'prod-proveedor':      'PROVEEDOR',
    };

    Object.entries(campos).forEach(([elId, key]) => {
      const el = $(elId);
      if (!el) return;
      el.value = producto ? (producto[key] ?? (key === 'RAM' || key === 'ALMACENAMIENTO' ? 0 : '')) : (key === 'RAM' || key === 'ALMACENAMIENTO' ? 0 : '');
    });

    // Guardar referencia al producto que se edita
    modal._producto = producto || null;
    setTimeout(() => $('prod-marca')?.focus(), 50);
  }

  function _cerrarModal() {
    const modal = $('modal-producto');
    modal.classList.add('hidden');
    modal._producto = null;
  }

  // ── Guardar ───────────────────────────────────────────────
  async function _guardar() {
    const errBox = $('prod-error');
    errBox.classList.add('hidden');

    const marca  = $('prod-marca')?.value.trim();
    const modelo = $('prod-modelo')?.value.trim();
    const costoMostrado = parseFloat($('prod-costo-mostrado')?.value) || 0;

    if (!marca && !modelo) {
      _error('Al menos MARCA o MODELO son requeridos.'); return;
    }

    const payload = {
      'MARCA':          marca,
      'MODELO':         modelo,
      'MOD_COMERCIAL':  $('prod-mod-comercial')?.value.trim() || '',
      'COLOR':          $('prod-color')?.value.trim()         || '',
      'NS':             $('prod-ns')?.value.trim()            || '',
      'RAM':            parseInt($('prod-ram')?.value)        || 0,
      'ALMACENAMIENTO': parseInt($('prod-almacenamiento')?.value) || 0,
      'COSTO_REAL':     parseFloat($('prod-costo-real')?.value)   || 0,
      'COSTO_MOSTRADO': costoMostrado,
      'PROVEEDOR':      $('prod-proveedor')?.value.trim()     || '',
    };

    const modal    = $('modal-producto');
    const editando = modal._producto;
    if (editando) payload['IDProd'] = editando['IDProd'];

    const btn = $('prod-submit-btn');
    btn.disabled = true;
    btn.textContent = 'Guardando…';
    showLoading(true);

    try {
      const res = editando
        ? await API.productUpdate(payload)
        : await API.productCreate(payload);

      if (res.ok) {
        toast(editando ? 'Producto actualizado.' : `Producto creado: ${res.id}`, 'success');
        _cerrarModal();
        _cargar();
      } else {
        _error(res.message || 'Error al guardar.');
      }
    } catch(_) { _error('Error de conexión.'); }
    finally {
      btn.disabled = false;
      btn.textContent = 'Guardar Producto';
      showLoading(false);
    }
  }

  function _error(msg) {
    const el = $('prod-error');
    if (el) { el.textContent = msg; el.classList.remove('hidden'); }
    showLoading(false);
  }

  return { render, init, _abrirModal };
})();
