/* ============================================================
   CredyFast — api.js  |  Capa de comunicación con el backend
   ============================================================ */

// ── URL del Web App de Apps Script ────────────────────────
// Implementar → Nueva implementación → Aplicación web → Cualquier usuario
const API_URL = 'https://script.google.com/macros/s/AKfycbw3meCFOPdMndCJePzlWNs55IO4w7kvVDUhYjXbzpWpQDchEzwqvGg7O19t-SsO13bnEA/exec';

const API = (() => {

  let _loggingOut = false; // guard: evita múltiples logouts simultáneos

  async function _post(body) {
    const res = await fetch(API_URL, {
      method:   'POST',
      redirect: 'follow',
      headers:  { 'Content-Type': 'text/plain;charset=utf-8' },
      body:     JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  async function callPublic(action, payload = {}) {
    return _post({ action, payload });
  }

  async function call(action, payload = {}) {
    const token = State.get('token');
    if (!token) { window.location.hash = '#/login'; throw new Error('Sin sesión'); }
    let data;
    try {
      data = await _post({ action, token, payload });
    } catch (err) {
      toast('Error de conexión con el servidor.', 'error');
      throw err;
    }
    if (!data.ok && (data.error === 'SESION_INVALIDA' || data.error === 'TOKEN_INVALIDO')) {
      if (!_loggingOut) {
        _loggingOut = true;
        toast('Sesión expirada. Inicia sesión nuevamente.', 'warning');
        // Limpiar localStorage y disparar evento para que App muestre el login correcto
        localStorage.removeItem('credyfast_session');
        State.clearSession();
        setTimeout(() => {
          _loggingOut = false;
          window.dispatchEvent(new CustomEvent('credyfast:sessionExpired'));
        }, 500);
      }
      return data;
    }
    return data;
  }

  return {
    callPublic, call,

    // ── Auth ──────────────────────────────────────────────────
    login:  (p) => callPublic('auth_login', p),
    logout: ()  => call('auth_logout'),

    // ── Usuarios ──────────────────────────────────────────────
    userList:   ()  => call('user_list'),
    userCreate: (p) => call('user_create', p),
    userToggle: (p) => call('user_toggle', p),

    // ── Productos ─────────────────────────────────────────────
    productList:   ()  => call('product_list'),
    productCreate: (p) => call('product_create', p),
    productUpdate: (p) => call('product_update', p),
    productToggle: (p) => call('product_toggle', p),

    // ── Clientes ──────────────────────────────────────────────
    clientSearch:      (p) => call('client_search',      p),
    clientGet:         (p) => call('client_get',         p),
    clientCreate:      (p) => call('client_create',      p),
    clientUpdateFotos: (p) => call('client_update_fotos',p),

    // ── Créditos ──────────────────────────────────────────────
    creditRequest:          (p) => call('credit_request',           p),
    creditApprove:          (p) => call('credit_approve',           p),
    creditReject:           (p) => call('credit_reject',            p),
    creditConfirmarEntrega: (p) => call('credit_confirmar_entrega', p),
    creditList:             (p) => call('credit_list',              p),
    creditPendientes:       ()  => call('credit_pendientes'),

    // ── Pagos ─────────────────────────────────────────────────
    pagoRegistrar:    (p) => call('pago_registrar',     p),
    pagoSchedule:     (p) => call('pago_schedule',      p),
    pagoBuscarCliente:(p) => call('pago_buscar_cliente',p),

    // ── Caja ──────────────────────────────────────────────────
    cajaSaldo:         ()  => call('caja_saldo'),
    cajaMovimientos:   (p) => call('caja_movimientos',   p),
    cajaRetiro:        (p) => call('caja_retiro',        p),
    cajaVentaContado:  (p) => call('caja_venta_contado', p),
    cajaVaciarCartera: (p) => call('caja_vaciar_cartera',p),
    cajaSaldoCobrador: ()  => call('caja_saldo_cobrador'),
    cajaCorte:         (p) => call('caja_corte',         p),

    // ── Dashboard ─────────────────────────────────────────────
    dashboardData: () => call('dashboard_data'),

    // ── Cobranza ─────────────────────────────────────────────
    cobranzaRuta:   ()  => call('cobranza_ruta'),
    cobranzaVisita: (p) => call('cobranza_visita', p),

    // ── Archivos ──────────────────────────────────────────────
    fileUpload: (p) => call('file_upload', p),
  };
})();
