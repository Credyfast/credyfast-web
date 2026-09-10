/* ============================================================
   CredyFast — simulador.js  |  Módulo de Simulación / Cotizador
   ============================================================ */

const Simulador = (() => {

  let _productos = [];
  let _periodoSel = null;
  let _prodSel = null;

  function render() {
    return `
    <div>
      <div class="section-header">
        <h2>Simulador de Crédito</h2>
      </div>

      <div class="card" style="max-width: 600px; margin: 0 auto;">
        <div class="card-body">
          <div class="form-group">
            <label>Producto *</label>
            <select id="sim-producto"><option value="">-- Selecciona producto --</option></select>
          </div>
          <div id="sim-periodo-area" class="hidden">
            <label style="font-size:.82rem;font-weight:600;color:var(--cf-text-secondary);margin-bottom:6px;display:block">Periodo *</label>
            <div class="periodo-selector" id="sim-periodos"></div>
          </div>
          <div id="sim-cotizador" class="hidden" style="margin-top: 16px;"></div>
        </div>
      </div>
    </div>
    `;
  }

  function init() {
    _productos = [];
    _periodoSel = null;
    _prodSel = null;

    on('sim-producto', 'change', _onProductoChange);
    _loadProductos();
  }

  async function _loadProductos() {
    try {
      const res = await API.productList();
      if (res.ok) {
        _productos = (res.data || []).filter(p => p['Estatus'] === 'DISPONIBLE');
        _fillProductSelect();
      }
    } catch (_) { }
  }

  function _fillProductSelect() {
    const sel = $('sim-producto'); 
    if (!sel) return;
    sel.innerHTML = '<option value="">-- Selecciona producto --</option>' +
      _productos.map(p => `<option value="${p['IDProd']}">${p['MARCA']} ${p['MODELO']} ${p['COLOR'] || ''} — $${p['COSTO_MOSTRADO']}</option>`).join('');
  }

  function _onProductoChange() {
    const IDProd = $('sim-producto')?.value;
    _prodSel = _productos.find(p => p['IDProd'] === IDProd) || null;
    _periodoSel = null;
    
    const periodoArea = $('sim-periodo-area');
    const cotiz = $('sim-cotizador');
    
    if (!_prodSel) { 
      periodoArea?.classList.add('hidden'); 
      cotiz?.classList.add('hidden'); 
      return; 
    }
    
    periodoArea?.classList.remove('hidden');
    const costo = parseFloat(_prodSel['COSTO_MOSTRADO']) || 0;
    const LIMITE = 8000;
    const periodos = costo <= LIMITE ? [13, 26] : [13, 26, 39, 52];
    
    setHTML('sim-periodos', periodos.map(p =>
      `<button class="periodo-btn" data-p="${p}" type="button">${p} sem.</button>`
    ).join(''));
    
    document.querySelectorAll('#sim-periodos .periodo-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#sim-periodos .periodo-btn').forEach(b => b.classList.remove('active'));
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
    const contado = parseFloat(_prodSel['Precio_de_contado']) || Math.round(costo * 1.5);
    const pctMap = { 13: 0.07, 26: 0.06, 39: 0.05, 52: 0.04 };
    
    const enganche = Math.round(costo * 0.20);
    const puntual = Math.round(contado * (pctMap[_periodoSel] || 0.06));
    const normal = Math.round(puntual * 1.10);
    const moroso = Math.round(normal * 1.10);
    
    const cotiz = $('sim-cotizador'); 
    if (!cotiz) return;
    
    cotiz.classList.remove('hidden');
    cotiz.innerHTML = `
      <div class="cotizador-result">
        <div class="cotiz-titulo">💰 Simulación — ${_periodoSel} semanas</div>
        <div class="cotizador-grid">
          <div class="cotizador-item"><div class="ci-label">Enganche</div><div class="ci-val">${fmt.currency(enganche)}</div></div>
          <div class="cotizador-item"><div class="ci-label">Pago puntual</div><div class="ci-val">${fmt.currency(puntual)}</div></div>
          <div class="cotizador-item"><div class="ci-label">Pago normal (+7d)</div><div class="ci-val">${fmt.currency(normal)}</div></div>
          <div class="cotizador-item"><div class="ci-label">Pago moroso</div><div class="ci-val">${fmt.currency(moroso)}</div></div>
          <div class="cotizador-item"><div class="ci-label">Precio contado</div><div class="ci-val">${fmt.currency(contado)}</div></div>
        </div>
      </div>`;
  }

  return { render, init };
})();
