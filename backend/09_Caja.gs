// ============================================================
// CredyFast — 09_Caja.gs
// Caja: saldo, retiros, venta de contado, corte, cartera cobrador
// ============================================================

const Caja = (() => {

  // ── Obtener saldo actual ──────────────────────────────────
  function saldo(ctx) {
    try {
      requireRole_(ctx.user.rol, CONFIG.ROLES.CAJERO);
      const movs = SheetHelper.getAll(CONFIG.SHEETS.CAJA);

      let totalCaja     = 0; // Solo Canal=CAJA
      let totalDomicilio = 0; // Canal=DOMICILIO sin vaciar

      movs.forEach(m => {
        const monto   = parseFloat(m['Monto']) || 0;
        const esIngreso = m['Registro'] === 'INGRESO';
        const valor   = esIngreso ? monto : -monto;

        if (m['Canal'] === CONFIG.CANAL.DOMICILIO) {
          totalDomicilio += valor;
        } else {
          totalCaja += valor;
        }
      });

      return {
        ok: true,
        saldoCaja:      _round2(totalCaja),
        saldoDomicilio: _round2(totalDomicilio), // Lo que traen los cobradores
        saldoTotal:     _round2(totalCaja + totalDomicilio),
      };
    } catch (err) { return handleError_(err); }
  }

  // ── Listar movimientos ────────────────────────────────────
  function movimientos(payload, ctx) {
    try {
      requireRole_(ctx.user.rol, CONFIG.ROLES.CAJERO);
      let movs = SheetHelper.getAll(CONFIG.SHEETS.CAJA);

      // Filtros opcionales
      if (payload.fecha) {
        movs = movs.filter(m => (m['Marca_temporal'] || '').startsWith(payload.fecha));
      }
      if (payload.canal) {
        movs = movs.filter(m => m['Canal'] === payload.canal);
      }
      if (payload.registro) {
        movs = movs.filter(m => m['Registro'] === payload.registro);
      }

      return { ok: true, data: movs };
    } catch (err) { return handleError_(err); }
  }

  // ── Retiro ────────────────────────────────────────────────
  // Solo Cajero puede ejecutar, pero siempre en nombre de un Supervisor
  function retiro(payload, ctx) {
    try {
      requireRole_(ctx.user.rol, CONFIG.ROLES.CAJERO);
      const { monto, tipo, comentarios } = payload;
      // tipo: "Retiro de respaldo" | "Retiro de supervisor"

      if (!monto || parseFloat(monto) <= 0) {
        throw { code: 'DATOS_INVALIDOS', message: 'Monto inválido.' };
      }
      if (!['Retiro de respaldo', 'Retiro de supervisor'].includes(tipo)) {
        throw { code: 'DATOS_INVALIDOS', message: 'Tipo de retiro inválido.' };
      }

      // Verificar saldo suficiente
      const saldoRes = saldo(ctx);
      if (!saldoRes.ok) throw { code: 'ERROR_SALDO', message: 'No se pudo verificar el saldo.' };
      if (saldoRes.saldoCaja < parseFloat(monto)) {
        throw { code: 'SALDO_INSUFICIENTE', message: `Saldo en caja insuficiente. Disponible: $${saldoRes.saldoCaja}` };
      }

      SheetHelper.insertRow(CONFIG.SHEETS.CAJA, {
        'Marca_temporal': _now(),
        'Registro':       'EGRESO',
        'Monto':          _round2(parseFloat(monto)),
        'Cliente':        tipo,
        'Tipo':           'Efectivo',
        'Canal':          CONFIG.CANAL.CAJA,
        'Comentarios':    comentarios || '',
        'Registrado_por': ctx.user.id || ctx.user.username,
        'IDPago':         '',
      });

      _log(ctx, 'CAJA_RETIRO', tipo, { monto }, 'EXITO');
      return { ok: true, message: `Retiro de $${monto} registrado.` };

    } catch (err) { return handleError_(err); }
  }

  // ── Venta de contado ──────────────────────────────────────
  function ventaContado(payload, ctx) {
    try {
      requireRole_(ctx.user.rol, CONFIG.ROLES.CAJERO);
      const { IDProd, tipo } = payload;

      if (!IDProd) throw { code: 'DATOS_INVALIDOS', message: 'IDProd requerido.' };

      const prodFound = SheetHelper.findOne(CONFIG.SHEETS.PRODUCTOS,
        r => r['IDProd'] === IDProd);
      if (!prodFound) throw { code: 'NO_ENCONTRADO', message: 'Producto no encontrado.' };
      if (prodFound.data['Estatus'] !== 'DISPONIBLE') {
        throw { code: 'PRODUCTO_NO_DISPONIBLE', message: 'El producto no está disponible para venta.' };
      }

      const precio = parseFloat(prodFound.data['Precio_de_contado']) || 0;
      if (precio <= 0) {
        throw { code: 'PRECIO_INVALIDO', message: 'El producto no tiene precio de contado configurado.' };
      }

      const tipoPago = tipo === 'Transferencia_o_deposito'
        ? 'Transferencia_o_deposito'
        : 'Efectivo';

      // Registrar ingreso en caja
      SheetHelper.insertRow(CONFIG.SHEETS.CAJA, {
        'Marca_temporal': _now(),
        'Registro':       'INGRESO',
        'Monto':          precio,
        'Cliente':        'CONTADO',
        'Tipo':           tipoPago,
        'Canal':          CONFIG.CANAL.CAJA,
        'Comentarios':    `Venta contado ${IDProd} - ${prodFound.data['MARCA']} ${prodFound.data['MODELO']}`,
        'Registrado_por': ctx.user.id || ctx.user.username,
        'IDPago':         '',
      });

      // Marcar producto como VENDIDO
      SheetHelper.updateRow(CONFIG.SHEETS.PRODUCTOS, prodFound.rowIndex, { 'Estatus': 'VENDIDO' });

      _log(ctx, 'VENTA_CONTADO', IDProd, { precio, tipoPago }, 'EXITO');
      return {
        ok: true,
        IDProd,
        monto:   precio,
        tipoPago,
        message: `Venta de contado registrada. Producto marcado como VENDIDO.`,
      };

    } catch (err) { return handleError_(err); }
  }

  // ── Vaciar cartera del cobrador ───────────────────────────
  // El cajero confirma que el cobrador entregó el dinero físicamente
  function vaciarCartera(payload, ctx) {
    try {
      requireRole_(ctx.user.rol, CONFIG.ROLES.CAJERO);
      const { cobradorId, monto, comentarios } = payload;

      if (!cobradorId) throw { code: 'DATOS_INVALIDOS', message: 'ID del cobrador requerido.' };
      if (!monto || parseFloat(monto) <= 0) {
        throw { code: 'DATOS_INVALIDOS', message: 'Monto inválido.' };
      }

      const now = _now();

      // 1. EGRESO de DOMICILIO (vaciar cartera virtual del cobrador)
      SheetHelper.insertRow(CONFIG.SHEETS.CAJA, {
        'Marca_temporal': now,
        'Registro':       'EGRESO',
        'Monto':          _round2(parseFloat(monto)),
        'Cliente':        cobradorId,
        'Tipo':           'Efectivo',
        'Canal':          CONFIG.CANAL.DOMICILIO,
        'Comentarios':    'Vaciado cartera cobrador' + (comentarios ? ' - ' + comentarios : ''),
        'Registrado_por': ctx.user.id || ctx.user.username,
        'IDPago':         '',
      });

      // 2. INGRESO a CAJA (dinero físicamente en caja)
      SheetHelper.insertRow(CONFIG.SHEETS.CAJA, {
        'Marca_temporal': now,
        'Registro':       'INGRESO',
        'Monto':          _round2(parseFloat(monto)),
        'Cliente':        cobradorId,
        'Tipo':           'Efectivo',
        'Canal':          CONFIG.CANAL.CAJA,
        'Comentarios':    'Depósito cartera cobrador' + (comentarios ? ' - ' + comentarios : ''),
        'Registrado_por': ctx.user.id || ctx.user.username,
        'IDPago':         '',
      });

      _log(ctx, 'CAJA_VACIAR_CARTERA', cobradorId, { monto }, 'EXITO');
      return { ok: true, message: `Cartera vaciada. $${monto} ingresado a caja.` };

    } catch (err) { return handleError_(err); }
  }

  // ── Saldo por cobrador (cuánto trae cada cobrador) ────────
  function saldoCobrador(payload, ctx) {
    try {
      requireRole_(ctx.user.rol, CONFIG.ROLES.COBRANZA);
      const movs = SheetHelper.getAll(CONFIG.SHEETS.CAJA)
        .filter(m => m['Canal'] === CONFIG.CANAL.DOMICILIO);

      // Agrupar por cobradorId (Registrado_por en DOMICILIO)
      const porCobrador = {};
      movs.forEach(m => {
        const uid   = m['Registrado_por'] || 'desconocido';
        const monto = parseFloat(m['Monto']) || 0;
        if (!porCobrador[uid]) porCobrador[uid] = 0;
        porCobrador[uid] += m['Registro'] === 'INGRESO' ? monto : -monto;
      });

      const resultado = Object.entries(porCobrador)
        .map(([id, saldo]) => ({ cobradorId: id, saldo: _round2(saldo) }))
        .filter(c => c.saldo > 0);

      return { ok: true, data: resultado };
    } catch (err) { return handleError_(err); }
  }

  // ── Corte de caja ─────────────────────────────────────────
  // Genera un resumen del día y lo registra como EGRESO especial para auditoría
  function corte(payload, ctx) {
    try {
      requireRole_(ctx.user.rol, CONFIG.ROLES.SUPERVISOR);
      const fecha = payload.fecha || _now().substring(0, 10); // yyyy-MM-dd

      const movs = SheetHelper.getAll(CONFIG.SHEETS.CAJA)
        .filter(m => (m['Marca_temporal'] || '').startsWith(fecha));

      const ingresos = movs.filter(m => m['Registro'] === 'INGRESO')
        .reduce((acc, m) => acc + (parseFloat(m['Monto']) || 0), 0);
      const egresos = movs.filter(m => m['Registro'] === 'EGRESO')
        .reduce((acc, m) => acc + (parseFloat(m['Monto']) || 0), 0);
      const neto = _round2(ingresos - egresos);

      // Guardar el corte como un registro especial
      SheetHelper.insertRow(CONFIG.SHEETS.LOGS, {
        'ID_Log':               'CORTE' + Date.now(),
        'Timestamp':            _now(),
        'Usuario_ID':           ctx.user.id || '',
        'Username':             ctx.user.username || '',
        'Accion':               'CORTE_CAJA',
        'Modulo':               'CAJA',
        'ID_Registro_Afectado': fecha,
        'Estado_Anterior':      '',
        'Estado_Nuevo':         JSON.stringify({ ingresos, egresos, neto, movimientos: movs.length }),
        'Resultado':            'EXITO',
        'Detalle_Error':        '',
      });

      return {
        ok: true,
        fecha,
        ingresos: _round2(ingresos),
        egresos:  _round2(egresos),
        neto,
        totalMovimientos: movs.length,
        message: `Corte del ${fecha}: Ingresos $${ingresos}, Egresos $${egresos}, Neto $${neto}`,
      };
    } catch (err) { return handleError_(err); }
  }

  // ── Helpers ───────────────────────────────────────────────
  function _round2(n) { return Math.round(n * 100) / 100; }
  function _now() {
    return Utilities.formatDate(new Date(), CONFIG.TIMEZONE, 'yyyy-MM-dd HH:mm:ss');
  }
  function _log(ctx, accion, id, detalle, resultado) {
    try {
      SheetHelper.insertRow(CONFIG.SHEETS.LOGS, {
        'ID_Log': 'LOG' + Date.now(), 'Timestamp': _now(),
        'Usuario_ID': ctx.user.id || '', 'Username': ctx.user.username || '',
        'Accion': accion, 'Modulo': 'CAJA', 'ID_Registro_Afectado': id,
        'Estado_Anterior': '', 'Estado_Nuevo': JSON.stringify(detalle),
        'Resultado': resultado, 'Detalle_Error': '',
      });
    } catch(_) {}
  }

  return { saldo, movimientos, retiro, ventaContado, vaciarCartera, saldoCobrador, corte };
})();
