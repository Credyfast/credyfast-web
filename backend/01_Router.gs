// ============================================================
// CredyFast — 01_Router.gs
// Punto de entrada único: doPost(e)
// Enruta cada acción al handler correspondiente.
// ============================================================

function doPost(e) {
  try {
    const body    = JSON.parse(e.postData.contents);
    const action  = body.action  || '';
    const token   = body.token   || '';
    const payload = body.payload || {};
    const ip      = _getClientIP(e);

    // Acciones públicas (sin autenticación)
    if (action === 'auth_login') {
      return _json(Auth.login(payload, ip));
    }

    // Todas las demás requieren sesión válida
    const session = Auth.validateSession(token);
    if (!session.ok) {
      return _json({ ok: false, error: 'SESION_INVALIDA', message: 'Sesión expirada. Inicia sesión nuevamente.' });
    }

    const ctx = { user: session.user, ip };

    // ── Router principal ─────────────────────────────────────
    switch (action) {

      // ── Auth ────────────────────────────────────────────────
      case 'auth_logout':               return _json(Auth.logout(token, ctx));

      // ── Usuarios ────────────────────────────────────────────
      case 'user_create':               return _json(Usuarios.create(payload, ctx));
      case 'user_list':                 return _json(Usuarios.list(ctx));
      case 'user_toggle':               return _json(Usuarios.toggle(payload, ctx));

      // ── Productos ───────────────────────────────────────────
      case 'product_create':            return _json(Productos.create(payload, ctx));
      case 'product_update':            return _json(Productos.update(payload, ctx));
      case 'product_list':              return _json(Productos.list(ctx));
      case 'product_toggle':            return _json(Productos.toggle(payload, ctx));

      // ── Clientes ────────────────────────────────────────────
      case 'client_create':             return _json(Clientes.create(payload, ctx));
      case 'client_search':             return _json(Clientes.search(payload, ctx));
      case 'client_get':                return _json(Clientes.get(payload, ctx));
      case 'client_update_fotos':       return _json(Clientes.updateFotos(payload, ctx));

      // ── Créditos ────────────────────────────────────────────
      case 'credit_request':            return _json(Creditos.request(payload, ctx));
      case 'credit_approve':            return _json(Creditos.approve(payload, ctx));
      case 'credit_reject':             return _json(Creditos.reject(payload, ctx));
      case 'credit_confirmar_entrega':  return _json(Creditos.confirmarEntrega(payload, ctx));
      case 'credit_list':               return _json(Creditos.list(payload, ctx));
      case 'credit_pendientes':         return _json(Creditos.pendientes(ctx));

      // ── Pagos ────────────────────────────────────────────────
      case 'pago_registrar':            return _json(MotorPagos.registrar(payload, ctx));
      case 'pago_schedule':             return _json(MotorPagos.schedule(payload, ctx));
      case 'pago_buscar_cliente':       return _json(MotorPagos.buscarParaCaja(payload, ctx));

      // ── Caja ─────────────────────────────────────────────────
      case 'caja_saldo':                return _json(Caja.saldo(ctx));
      case 'caja_movimientos':          return _json(Caja.movimientos(payload, ctx));
      case 'caja_retiro':               return _json(Caja.retiro(payload, ctx));
      case 'caja_venta_contado':        return _json(Caja.ventaContado(payload, ctx));
      case 'caja_vaciar_cartera':       return _json(Caja.vaciarCartera(payload, ctx));
      case 'caja_saldo_cobrador':       return _json(Caja.saldoCobrador(payload, ctx));
      case 'caja_corte':                return _json(Caja.corte(payload, ctx));

      // ── Archivos (fotos) ─────────────────────────────────────
      case 'file_upload':               return _json(Archivos.upload(payload, ctx));

      // ── Contrato ─────────────────────────────────────────────
      case 'contrato_generar':          return _json(Contratos.generar(payload, ctx));

      // ── Dashboard ────────────────────────────────────────────
      case 'dashboard_data':            return _json(Dashboard.getData(ctx));

      // ── Cobranza ────────────────────────────────────────────
      case 'cobranza_ruta':             return _json(Cobranza.getRuta(ctx));
      case 'cobranza_visita':           return _json(Cobranza.registrarVisita(payload, ctx));

      default:
        return _json({ ok: false, error: 'ACCION_DESCONOCIDA', message: `Acción no reconocida: ${action}` });
    }

  } catch (err) {
    Logger.log('ROUTER_ERROR: ' + err.message + '\n' + (err.stack || ''));
    return _json({ ok: false, error: 'SERVER_ERROR', message: 'Error interno del servidor.' });
  }
}

// ── Helpers globales ──────────────────────────────────────────

function _json(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function _getClientIP(e) {
  try { return e.parameter['X-Forwarded-For'] || ''; } catch(_) { return ''; }
}

/**
 * Verifica que el rol del usuario tenga nivel >= al mínimo requerido.
 * @param {string} userRole  - Rol actual del usuario
 * @param {string} minRole   - Rol mínimo requerido
 */
function requireRole_(userRole, minRole) {
  const levels = CONFIG.ROLE_LEVEL;
  if ((levels[userRole] || 0) < (levels[minRole] || 999)) {
    throw { code: 'SIN_PERMISO', message: `Se requiere rol ${minRole} o superior.` };
  }
}

/**
 * Convierte error de throw a respuesta estándar.
 */
function handleError_(err) {
  if (err && err.code) {
    return { ok: false, error: err.code, message: err.message };
  }
  Logger.log('UNHANDLED_ERROR: ' + JSON.stringify(err));
  return { ok: false, error: 'ERROR_INTERNO', message: 'Operación fallida.' };
}
