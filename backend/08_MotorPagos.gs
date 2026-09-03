// ============================================================
// CredyFast — 08_MotorPagos.gs
// Registro de pagos: parciales, adelantados, Canal CAJA/DOMICILIO
// ============================================================

const MotorPagos = (() => {

  // ── Registrar pago (caja o domicilio) ────────────────────
  function registrar(payload, ctx) {
    try {
      requireRole_(ctx.user.rol, CONFIG.ROLES.COBRANZA);

      const { IDCredito, montoRecibido, canal } = payload;
      if (!IDCredito)    throw { code: 'DATOS_INVALIDOS', message: 'IDCredito requerido.' };
      if (!montoRecibido || parseFloat(montoRecibido) <= 0) {
        throw { code: 'DATOS_INVALIDOS', message: 'Monto inválido.' };
      }

      const canalPago = canal === CONFIG.CANAL.DOMICILIO
        ? CONFIG.CANAL.DOMICILIO
        : CONFIG.CANAL.CAJA;

      const lock = LockService.getScriptLock();
      lock.waitLock(15000);

      try {
        // Verificar que el crédito esté APROVADO
        const credFound = SheetHelper.findOne(CONFIG.SHEETS.CREDITOS,
          r => r['IDCredito'] === IDCredito);
        if (!credFound) throw { code: 'NO_ENCONTRADO', message: 'Crédito no encontrado.' };
        if (credFound.data['ESTATUS'] !== 'APROVADO') {
          throw { code: 'ESTADO_INVALIDO', message: 'El crédito no está activo.' };
        }

        const cr           = credFound.data;
        const pagoPuntual  = parseFloat(cr['Pago_puntual']) || 0;
        const pagoNormal   = parseFloat(cr['Pago_normal'])  || 0;
        const pagoMoroso   = parseFloat(cr['Pago_moroso'])  || 0;
        const enganche     = parseFloat(cr['Enganche'])     || 0;

        // Obtener todas las semanas POR COBRAR / PARCIAL / ATRASADO de este crédito
        const todasLasFilas = SheetHelper.getAllRows(CONFIG.SHEETS.PAGOS);
        const pendientes = todasLasFilas.filter(row =>
          row.data['IDCredito'] === IDCredito &&
          ['POR COBRAR', 'PARCIAL', 'ATRASADO'].includes(row.data['Estatus_de_pago'])
        ).sort((a, b) => parseInt(a.data['Semana_num']) - parseInt(b.data['Semana_num']));

        if (pendientes.length === 0) {
          throw { code: 'SIN_PAGOS_PENDIENTES', message: 'Este crédito no tiene pagos pendientes.' };
        }

        const hoy        = new Date();
        const now        = _now();
        let   restante   = _round2(parseFloat(montoRecibido));
        const resultados = [];
        let   ultimaSemana = null;

        // Aplicar el monto a las semanas pendientes en orden
        for (const fila of pendientes) {
          if (restante <= 0) break;

          const semNum      = parseInt(fila.data['Semana_num']);
          const montoPagado = _round2(parseFloat(fila.data['Monto_pagado']) || 0);

          // Determinar monto esperado según fecha
          let montoEsperado;
          if (semNum === 0) {
            montoEsperado = enganche;
          } else {
            montoEsperado = _montoEsperadoPorFecha(
              fila.data['Fecha_programada'], hoy, pagoPuntual, pagoNormal, pagoMoroso
            );
          }

          const faltante = _round2(montoEsperado - montoPagado);
          if (faltante <= 0) continue; // Ya estaba cubierta (raro pero seguro)

          const aAplicar  = Math.min(restante, faltante);
          const nuevoMonto = _round2(montoPagado + aAplicar);
          restante = _round2(restante - aAplicar);

          const completo = nuevoMonto >= montoEsperado;
          const estatus  = completo
            ? _estatusFinal(fila.data['Fecha_programada'], hoy)
            : (nuevoMonto > 0 ? 'PARCIAL' : fila.data['Estatus_de_pago']);

          SheetHelper.updateRow(CONFIG.SHEETS.PAGOS, fila.rowIndex, {
            'Monto_pagado':    nuevoMonto,
            'Fecha_pagada':    completo ? now.substring(0, 10) : (fila.data['Fecha_pagada'] || ''),
            'Estatus_de_pago': estatus,
            'Canal':           canalPago,
            'Registrado_por':  ctx.user.id || ctx.user.username,
          });

          ultimaSemana = { semNum, estatus, montoEsperado, nuevoMonto, completo };
          resultados.push(ultimaSemana);
        }

        // Registrar en Caja
        const idPagoRef = pendientes[0]?.data['IDPago'] || '';
        _registrarEnCaja(ctx, IDCredito, cr['IDCliente'] || '', montoRecibido, canalPago, idPagoRef);

        // Verificar si el crédito quedó finalizado
        const todasPagadas = todasLasFilas
          .filter(r => r.data['IDCredito'] === IDCredito)
          .every(r => ['PUNTUAL','NORMAL','MOROSO'].includes(r.data['Estatus_de_pago']));

        if (todasPagadas) {
          SheetHelper.updateRow(CONFIG.SHEETS.CREDITOS, credFound.rowIndex, { 'ESTATUS': 'FINALIZADO' });
          // Producto → VENDIDO
          const prodFound = SheetHelper.findOne(CONFIG.SHEETS.PRODUCTOS,
            r => r['IDProd'] === cr['IDProd']);
          if (prodFound) {
            SheetHelper.updateRow(CONFIG.SHEETS.PRODUCTOS, prodFound.rowIndex, { 'Estatus': 'VENDIDO' });
          }
        }

        // Construir respuesta para el ticket
        const semanaActual = ultimaSemana ? ultimaSemana.semNum : null;
        const semanasRestantes = todasLasFilas.filter(r =>
          r.data['IDCredito'] === IDCredito &&
          !['PUNTUAL','NORMAL','MOROSO'].includes(r.data['Estatus_de_pago'])
        ).length - (ultimaSemana?.completo ? 1 : 0);

        _log(ctx, 'PAGO_REGISTRAR', IDCredito, { montoRecibido, canalPago, resultados }, 'EXITO');

        return {
          ok: true,
          montoRecibido:   parseFloat(montoRecibido),
          montoRestante:   Math.max(0, restante),
          semanaActual,
          semanasMostradas: ultimaSemana ? ultimaSemana.semNum : null,
          totalSemanas:     parseInt(cr['Periodo']),
          semanasRestantes: Math.max(0, semanasRestantes),
          pagoCompleto:     ultimaSemana?.completo || false,
          creditoFinalizado: todasPagadas,
          resultados,
          message: todasPagadas ? '¡Crédito completado!' : 'Pago registrado.',
        };

      } finally { lock.releaseLock(); }
    } catch (err) { return handleError_(err); }
  }

  // ── Consultar estado de pagos de un crédito ───────────────
  function schedule(payload, ctx) {
    try {
      requireRole_(ctx.user.rol, CONFIG.ROLES.CAJERO);
      const { IDCredito } = payload;

      const credFound = SheetHelper.findOne(CONFIG.SHEETS.CREDITOS,
        r => r['IDCredito'] === IDCredito);
      if (!credFound) throw { code: 'NO_ENCONTRADO', message: 'Crédito no encontrado.' };

      const pagos = SheetHelper.getAll(CONFIG.SHEETS.PAGOS)
        .filter(p => p['IDCredito'] === IDCredito)
        .sort((a, b) => parseInt(a['Semana_num']) - parseInt(b['Semana_num']));

      // Actualizar estatus Y monto de pagos vencidos según días de atraso
      _actualizarAtrasados(IDCredito, pagos, credFound.data);

      // Re-leer con estatus actualizados
      const pagosActualizados = SheetHelper.getAll(CONFIG.SHEETS.PAGOS)
        .filter(p => p['IDCredito'] === IDCredito)
        .sort((a, b) => parseInt(a['Semana_num']) - parseInt(b['Semana_num']));

      return { ok: true, credito: credFound.data, pagos: pagosActualizados };
    } catch (err) { return handleError_(err); }
  }

  // ── Actualizar estatus Y monto de pagos vencidos ─────────
  // Régimen de cobro:
  //   días <= 0  → PUNTUAL  → monto = Pago_puntual
  //   1-7 días  → NORMAL   → monto = Pago_normal  (+10% sobre puntual)
  //   8+ días   → MOROSO   → monto = Pago_moroso  (+10% sobre normal)
  function _actualizarAtrasados(IDCredito, pagos, credito) {
    const hoy         = new Date();
    hoy.setHours(0, 0, 0, 0); // Comparar solo por fecha, sin hora
    const todasFilas  = SheetHelper.getAllRows(CONFIG.SHEETS.PAGOS);

    const pagoPuntual = parseFloat(credito['Pago_puntual']) || 0;
    const pagoNormal  = parseFloat(credito['Pago_normal'])  || Math.round(pagoPuntual * 1.10);
    const pagoMoroso  = parseFloat(credito['Pago_moroso'])  || Math.round(pagoNormal  * 1.10);

    pagos.forEach(pago => {
      // Solo actualizar pagos que aún no están completados
      if (!['POR COBRAR', 'ATRASADO'].includes(pago['Estatus_de_pago'])) return;

      // Semana 0 = Enganche: el monto nunca cambia por tiempo
      const semana = parseInt(pago['Semana_num']);
      if (semana === 0) return;

      const fechaProg = new Date(pago['Fecha_programada']);
      fechaProg.setHours(0, 0, 0, 0);
      const diffDias = Math.floor((hoy - fechaProg) / (1000 * 60 * 60 * 24));

      let nuevoEstatus, nuevoMonto;

      if (diffDias <= 0) {
        // Aún en fecha → PUNTUAL
        nuevoEstatus = 'POR COBRAR';
        nuevoMonto   = pagoPuntual;
      } else if (diffDias <= CONFIG.DIAS_GRACIA_NORMAL) {
        // 1-7 días de atraso → NORMAL
        nuevoEstatus = 'ATRASADO';
        nuevoMonto   = pagoNormal;
      } else {
        // 8+ días de atraso → MOROSO
        nuevoEstatus = 'ATRASADO';
        nuevoMonto   = pagoMoroso;
      }

      // Solo escribir en Sheets si algo cambió (ahorra cuotas de escritura)
      const estatusActual = pago['Estatus_de_pago'];
      const montoActual   = parseFloat(pago['Monto_esperado']) || 0;
      const cambia = nuevoEstatus !== estatusActual || Math.abs(nuevoMonto - montoActual) > 0.01;

      if (cambia) {
        const fila = todasFilas.find(r => r.data['IDPago'] === pago['IDPago']);
        if (fila) {
          SheetHelper.updateRow(CONFIG.SHEETS.PAGOS, fila.rowIndex, {
            'Estatus_de_pago': nuevoEstatus,
            'Monto_esperado':  nuevoMonto,
          });
        }
      }
    });
  }

  // ── Buscar cliente para caja (por nombre o IDCliente) ─────
  function buscarParaCaja(payload, ctx) {
    try {
      requireRole_(ctx.user.rol, CONFIG.ROLES.CAJERO);
      const q = (payload.query || '').trim();
      if (!q) return { ok: false, message: 'Ingresa un nombre o ID de cliente.' };

      const qLower = q.toLowerCase();
      const todos  = SheetHelper.getAll(CONFIG.SHEETS.CLIENTES);

      // Buscar por IDCliente exacto (empieza con CL) o por nombre parcial
      const esId = q.toUpperCase().startsWith('CL');
      const encontrados = esId
        ? todos.filter(c => (c['IDCliente'] || '').toUpperCase() === q.toUpperCase())
        : todos.filter(c => (c['Nombre_completo'] || '').toLowerCase().includes(qLower));

      if (!encontrados.length) {
        return { ok: false, message: 'No se encontraron clientes con ese nombre o ID.' };
      }

      // Para cada cliente, incluir sus créditos APROVADO con detalle
      const creditosTodos = SheetHelper.getAll(CONFIG.SHEETS.CREDITOS);
      const pagosTodos    = SheetHelper.getAll(CONFIG.SHEETS.PAGOS);

      const resultado = encontrados.map(cliente => {
        const creditos = creditosTodos
          .filter(c => c['IDCliente'] === cliente['IDCliente'] && c['ESTATUS'] === 'APROVADO')
          .map(cr => {
            const pagos = pagosTodos
              .filter(p => p['IDCredito'] === cr['IDCredito'])
              .sort((a, b) => parseInt(a['Semana_num']) - parseInt(b['Semana_num']));

            const pendiente  = pagos.find(p =>
              ['POR COBRAR', 'PARCIAL', 'ATRASADO'].includes(p['Estatus_de_pago'])
            );
            const atrasadas  = pagos.filter(p => p['Estatus_de_pago'] === 'ATRASADO').length;

            return {
              ...cr,
              proximoPago:      pendiente || null,
              semanasAtrasadas: atrasadas,
              totalPagos:       pagos.length,
              pagosCompletos:   pagos.filter(p =>
                ['PUNTUAL','NORMAL','MOROSO'].includes(p['Estatus_de_pago'])
              ).length,
            };
          });

        return { cliente, creditos };
      });

      return { ok: true, resultados: resultado, total: resultado.length };
    } catch (err) { return handleError_(err); }
  }

  // ── Registrar en Caja ─────────────────────────────────────
  function _registrarEnCaja(ctx, IDCredito, IDCliente, monto, canal, idPago) {
    try {
      SheetHelper.insertRow(CONFIG.SHEETS.CAJA, {
        'Marca_temporal':  _now(),
        'Registro':        'INGRESO',
        'Monto':           _round2(parseFloat(monto)),
        'Cliente':         IDCliente,
        'Tipo':            'Efectivo',
        'Canal':           canal,
        'Comentarios':     'Pago crédito ' + IDCredito,
        'Registrado_por':  ctx.user.id || ctx.user.username,
        'IDPago':          idPago,
      });
    } catch(_) {}
  }

  // ── Helpers ───────────────────────────────────────────────
  function _montoEsperadoPorFecha(fechaProgramadaStr, hoy, pagoPuntual, pagoNormal, pagoMoroso) {
    if (!fechaProgramadaStr) return pagoPuntual;
    const fechaProg = new Date(fechaProgramadaStr);
    const diffDias  = Math.floor((hoy - fechaProg) / (1000 * 60 * 60 * 24));
    if (diffDias <= 0) return pagoPuntual;
    if (diffDias <= CONFIG.DIAS_GRACIA_NORMAL) return pagoNormal;
    return pagoMoroso;
  }

  function _estatusFinal(fechaProgramadaStr, hoy) {
    if (!fechaProgramadaStr) return 'PUNTUAL';
    const fechaProg = new Date(fechaProgramadaStr);
    const diffDias  = Math.floor((hoy - fechaProg) / (1000 * 60 * 60 * 24));
    if (diffDias <= 0) return 'PUNTUAL';
    if (diffDias <= CONFIG.DIAS_GRACIA_NORMAL) return 'NORMAL';
    return 'MOROSO';
  }

  function _round2(n) { return Math.round(n * 100) / 100; }
  function _now() {
    return Utilities.formatDate(new Date(), CONFIG.TIMEZONE, 'yyyy-MM-dd HH:mm:ss');
  }

  function _log(ctx, accion, id, detalle, resultado) {
    try {
      SheetHelper.insertRow(CONFIG.SHEETS.LOGS, {
        'ID_Log': 'LOG' + Date.now(), 'Timestamp': _now(),
        'Usuario_ID': ctx.user.id || '', 'Username': ctx.user.username || '',
        'Accion': accion, 'Modulo': 'PAGOS', 'ID_Registro_Afectado': id,
        'Estado_Anterior': '', 'Estado_Nuevo': JSON.stringify(detalle),
        'Resultado': resultado, 'Detalle_Error': '',
      });
    } catch(_) {}
  }

  return { registrar, schedule, buscarParaCaja };
})();
