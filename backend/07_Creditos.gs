// ============================================================
// CredyFast — 07_Creditos.gs
// Gestión de créditos: solicitud, aprobación y calendario.
// Estados: PENDIENTE → APROBADO_EN_ESPERA → APROVADO → FINALIZADO / RECHAZADO
// ============================================================

const Creditos = (() => {

  // ── Crear solicitud de crédito ────────────────────────────
  function request(payload, ctx) {
    try {
      requireRole_(ctx.user.rol, CONFIG.ROLES.VENDEDOR);
      _validateRequest(payload);

      // Obtener datos del producto y cliente
      const prod = SheetHelper.findOne(CONFIG.SHEETS.PRODUCTOS,
        r => r['IDProd'] === payload.IDProd);
      if (!prod) throw { code: 'NO_ENCONTRADO', message: 'Producto no encontrado.' };
      if (prod.data['Estatus'] !== 'DISPONIBLE') {
        throw { code: 'PRODUCTO_NO_DISPONIBLE', message: 'El producto no está disponible.' };
      }

      const cliente = SheetHelper.findOne(CONFIG.SHEETS.CLIENTES,
        r => r['IDCliente'] === payload.IDCliente);
      if (!cliente) throw { code: 'NO_ENCONTRADO', message: 'Cliente no encontrado.' };

      // Validar fotos del cliente
      if (!cliente.data['INE_Frente_ID'] || !cliente.data['INE_Reverso_ID'] || !cliente.data['Comprobante_ID']) {
        throw { code: 'FOTOS_OBLIGATORIAS', message: 'El cliente no tiene todos los documentos registrados.' };
      }

      // ── Cálculos ──────────────────────────────────────────
      const costoMostrado   = parseFloat(prod.data['COSTO_MOSTRADO']) || 0;
      const costoReal       = parseFloat(prod.data['COSTO_REAL'])     || 0;
      const precioContado   = parseFloat(prod.data['Precio_de_contado'])
                              || _round2(costoMostrado * CONFIG.FACTOR_PRECIO_CONTADO);

      const periodo         = parseInt(payload.Periodo);
      _validatePeriodo(periodo, costoMostrado);

      const pctPuntual      = CONFIG.PORCENTAJE_PAGO_PUNTUAL[periodo];
      const enganche        = Math.round(costoMostrado * CONFIG.FACTOR_ENGANCHE);
      const pagoPuntual     = Math.round(precioContado * pctPuntual);
      const pagoNormal      = Math.round(pagoPuntual * CONFIG.FACTOR_PAGO_NORMAL);
      const pagoMoroso      = Math.round(pagoNormal  * CONFIG.FACTOR_PAGO_MOROSO);
      const semRecuperacion = Math.ceil((costoReal - enganche) / pagoPuntual);

      const now = _now();
      const id  = SheetHelper.nextId(CONFIG.SHEETS.CREDITOS, 'CR', 5);

      SheetHelper.insertRow(CONFIG.SHEETS.CREDITOS, {
        'IDCredito':           id,
        'Marca_temporal':      now,
        'IDCliente':           payload.IDCliente,
        'IDProd':              payload.IDProd,
        'Celular':             payload.Celular             || '',
        'Nombre_referencia_1': payload.Nombre_referencia_1 || '',
        'Numero_referencia_1': payload.Numero_referencia_1 || '',
        'Nombre_referencia_2': payload.Nombre_referencia_2 || '',
        'Numero_referencia_2': payload.Numero_referencia_2 || '',
        'Nombre_cliente':      cliente.data['Nombre_completo'] || '',
        'Periodo':             periodo,
        'Enganche':            enganche,
        'Pago_puntual':        pagoPuntual,
        'Pago_normal':         pagoNormal,
        'Pago_moroso':         pagoMoroso,
        'Semana_Recuperacion': semRecuperacion,
        'ESTATUS':             'PENDIENTE',
        'Fecha_de_inicio':     now.substring(0, 10),
        'NOTAS':               payload.NOTAS || '',
        'Aprobado_por':        '',
        'Foto_Entrega_ID':     '',
      });

      _log(ctx, 'CREDITO_SOLICITUD', id, { IDCliente: payload.IDCliente, IDProd: payload.IDProd }, 'EXITO');
      return {
        ok: true, id,
        enganche, pagoPuntual, pagoNormal, pagoMoroso, semRecuperacion,
        message: 'Solicitud enviada. Pendiente de aprobación.',
      };

    } catch (err) { return handleError_(err); }
  }

  // ── Aprobar crédito ───────────────────────────────────────
  function approve(payload, ctx) {
    try {
      requireRole_(ctx.user.rol, CONFIG.ROLES.SUPERVISOR);
      const { IDCredito } = payload;

      const found = SheetHelper.findOne(CONFIG.SHEETS.CREDITOS,
        r => r['IDCredito'] === IDCredito);
      if (!found) throw { code: 'NO_ENCONTRADO', message: 'Crédito no encontrado.' };
      if (found.data['ESTATUS'] !== 'PENDIENTE') {
        throw { code: 'ESTADO_INVALIDO', message: 'La solicitud ya fue procesada.' };
      }

      // Pasar a APROBADO_EN_ESPERA
      // El calendario se genera cuando el cajero cobra el enganche
      SheetHelper.updateRow(CONFIG.SHEETS.CREDITOS, found.rowIndex, {
        'ESTATUS':      'APROBADO_EN_ESPERA',
        'Aprobado_por': ctx.user.id || ctx.user.username,
      });

      _log(ctx, 'CREDITO_APROBAR', IDCredito, {}, 'EXITO');
      return { ok: true, message: 'Crédito aprobado. Pendiente de enganche y foto de entrega.' };

    } catch (err) { return handleError_(err); }
  }

  // ── Rechazar crédito ──────────────────────────────────────
  function reject(payload, ctx) {
    try {
      requireRole_(ctx.user.rol, CONFIG.ROLES.SUPERVISOR);
      const { IDCredito, motivo } = payload;

      const found = SheetHelper.findOne(CONFIG.SHEETS.CREDITOS,
        r => r['IDCredito'] === IDCredito);
      if (!found) throw { code: 'NO_ENCONTRADO', message: 'Crédito no encontrado.' };
      if (found.data['ESTATUS'] !== 'PENDIENTE') {
        throw { code: 'ESTADO_INVALIDO', message: 'La solicitud ya fue procesada.' };
      }

      SheetHelper.updateRow(CONFIG.SHEETS.CREDITOS, found.rowIndex, {
        'ESTATUS':      'RECHAZADO',
        'Aprobado_por': ctx.user.id || ctx.user.username,
        'NOTAS':        (found.data['NOTAS'] ? found.data['NOTAS'] + ' | ' : '') +
                        'RECHAZADO: ' + (motivo || 'Sin motivo'),
      });

      _log(ctx, 'CREDITO_RECHAZAR', IDCredito, { motivo }, 'EXITO');
      return { ok: true, message: 'Crédito rechazado.' };

    } catch (err) { return handleError_(err); }
  }

  // ── Confirmar entrega (foto) y generar calendario ─────────
  // Llamado por el Cajero cuando cobra el enganche y el Vendedor sube la foto
  function confirmarEntrega(payload, ctx) {
    try {
      requireRole_(ctx.user.rol, CONFIG.ROLES.CAJERO);
      const { IDCredito, Foto_Entrega_ID } = payload;

      const found = SheetHelper.findOne(CONFIG.SHEETS.CREDITOS,
        r => r['IDCredito'] === IDCredito);
      if (!found) throw { code: 'NO_ENCONTRADO', message: 'Crédito no encontrado.' };
      if (found.data['ESTATUS'] !== 'APROBADO_EN_ESPERA') {
        throw { code: 'ESTADO_INVALIDO', message: 'El crédito no está en espera de entrega.' };
      }
      if (!Foto_Entrega_ID) {
        throw { code: 'FOTO_OBLIGATORIA', message: 'La foto de entrega del producto es obligatoria.' };
      }

      const cr = found.data;

      // Actualizar crédito a APROVADO
      SheetHelper.updateRow(CONFIG.SHEETS.CREDITOS, found.rowIndex, {
        'ESTATUS':        'APROVADO',
        'Foto_Entrega_ID': Foto_Entrega_ID,
      });

      // Marcar producto como OCUPADO
      const prodFound = SheetHelper.findOne(CONFIG.SHEETS.PRODUCTOS,
        r => r['IDProd'] === cr['IDProd']);
      if (prodFound) {
        SheetHelper.updateRow(CONFIG.SHEETS.PRODUCTOS, prodFound.rowIndex, { 'Estatus': 'OCUPADO' });
      }

      // Generar calendario de pagos
      const filas = _generarCalendario(IDCredito, cr);

      _log(ctx, 'CREDITO_CONFIRMAR_ENTREGA', IDCredito, { filas }, 'EXITO');
      return { ok: true, message: 'Entrega confirmada. Calendario generado.', filasGeneradas: filas };

    } catch (err) { return handleError_(err); }
  }

  // ── Listar créditos ────────────────────────────────────────
  function list(payload, ctx) {
    try {
      requireRole_(ctx.user.rol, CONFIG.ROLES.CAJERO);
      const todos = SheetHelper.getAll(CONFIG.SHEETS.CREDITOS);

      let resultado = todos;
      if (payload.estatus) {
        resultado = todos.filter(c => c['ESTATUS'] === payload.estatus);
      }
      if (payload.IDCliente) {
        resultado = resultado.filter(c => c['IDCliente'] === payload.IDCliente);
      }

      return { ok: true, data: resultado };
    } catch (err) { return handleError_(err); }
  }

  // ── Pendientes de autorización (para badge de notificaciones) ──
  function pendientes(ctx) {
    try {
      requireRole_(ctx.user.rol, CONFIG.ROLES.SUPERVISOR);
      const todos = SheetHelper.getAll(CONFIG.SHEETS.CREDITOS);
      const pend  = todos.filter(c => c['ESTATUS'] === 'PENDIENTE');
      return { ok: true, count: pend.length, data: pend };
    } catch (err) { return handleError_(err); }
  }

  // ── Generar calendario de pagos ───────────────────────────
  function _generarCalendario(IDCredito, cr) {
    const periodo      = parseInt(cr['Periodo']);
    const enganche     = parseFloat(cr['Enganche']);
    const pagoPuntual  = parseFloat(cr['Pago_puntual']);
    const hoy          = new Date();

    // ── Calcular el ID inicial UNA SOLA VEZ ──────────────────
    // nextId lee la última fila de la hoja; si se llama N veces antes
    // del batchInsert siempre devuelve el mismo número.
    // Solución: obtener el número base al inicio e incrementar localmente.
    const sheet   = SheetHelper.getSheet(CONFIG.SHEETS.PAGOS);
    const lastRow = sheet.getLastRow();
    let   nextNum = 1;
    if (lastRow > 1) {
      const lastId = sheet.getRange(lastRow, 1).getValue().toString();
      nextNum = (parseInt(lastId.replace('PAG', ''), 10) || 0) + 1;
    }

    const _nextPagId = () => 'PAG' + String(nextNum++).padStart(5, '0');

    const filas = [];

    // Semana 0 = Enganche
    filas.push({
      'IDPago':           _nextPagId(),
      'IDCredito':        IDCredito,
      'Semana_num':       0,
      'Fecha_programada': _formatFecha(hoy),
      'Fecha_pagada':     '',
      'Monto_esperado':   enganche,
      'Monto_pagado':     0,
      'Estatus_de_pago':  'POR COBRAR',
      'Canal':            '',
      'Registrado_por':   '',
    });

    // Semanas 1..N
    for (let i = 1; i <= periodo; i++) {
      const fechaProg = new Date(hoy);
      fechaProg.setDate(hoy.getDate() + (i * 7));
      filas.push({
        'IDPago':           _nextPagId(),
        'IDCredito':        IDCredito,
        'Semana_num':       i,
        'Fecha_programada': _formatFecha(fechaProg),
        'Fecha_pagada':     '',
        'Monto_esperado':   pagoPuntual,
        'Monto_pagado':     0,
        'Estatus_de_pago':  'POR COBRAR',
        'Canal':            '',
        'Registrado_por':   '',
      });
    }

    // Insertar todas las filas de una vez (batchInsert)
    SheetHelper.batchInsert(CONFIG.SHEETS.PAGOS, filas);
    return filas.length;
  }

  // ── Validaciones ──────────────────────────────────────────
  function _validateRequest(p) {
    if (!p.IDCliente) throw { code: 'DATOS_INVALIDOS', message: 'IDCliente requerido.' };
    if (!p.IDProd)    throw { code: 'DATOS_INVALIDOS', message: 'IDProd requerido.' };
    if (!p.Periodo)   throw { code: 'DATOS_INVALIDOS', message: 'Periodo requerido.' };
    if (!p.Celular)   throw { code: 'DATOS_INVALIDOS', message: 'Celular del cliente requerido.' };
  }

  function _validatePeriodo(periodo, costoMostrado) {
    const validos = [13, 26, 39, 52];
    if (!validos.includes(periodo)) {
      throw { code: 'PERIODO_INVALIDO', message: 'Periodo inválido. Use 13, 26, 39 o 52.' };
    }
    // ⚠ LÍMITE DE PRECIO: ver CONFIG.LIMITE_PRECIO_PERIODOS para cambiar este valor
    if (costoMostrado <= CONFIG.LIMITE_PRECIO_PERIODOS && periodo > 26) {
      throw {
        code: 'PERIODO_NO_DISPONIBLE',
        message: `Producto con precio ≤ $${CONFIG.LIMITE_PRECIO_PERIODOS} solo permite 13 o 26 semanas.`,
      };
    }
  }

  function _round2(n) { return Math.round(n * 100) / 100; }

  function _now() {
    return Utilities.formatDate(new Date(), CONFIG.TIMEZONE, 'yyyy-MM-dd HH:mm:ss');
  }

  function _formatFecha(date) {
    return Utilities.formatDate(date, CONFIG.TIMEZONE, 'yyyy-MM-dd');
  }

  function _log(ctx, accion, id, detalle, resultado) {
    try {
      SheetHelper.insertRow(CONFIG.SHEETS.LOGS, {
        'ID_Log': 'LOG' + Date.now(), 'Timestamp': _now(),
        'Usuario_ID': ctx.user.id || '', 'Username': ctx.user.username || '',
        'Accion': accion, 'Modulo': 'CREDITOS', 'ID_Registro_Afectado': id,
        'Estado_Anterior': '', 'Estado_Nuevo': JSON.stringify(detalle),
        'Resultado': resultado, 'Detalle_Error': '',
      });
    } catch(_) {}
  }

  return { request, approve, reject, confirmarEntrega, list, pendientes };
})();
