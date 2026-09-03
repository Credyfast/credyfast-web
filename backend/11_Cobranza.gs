// ============================================================
// CredyFast — 11_Cobranza.gs
// Módulo de Cobranza en Campo.
// - Ruta del día: créditos APROVADO con cuotas pendientes
// - Registrar visita sin pago (persiste en hoja Visitas)
// - Control de alerta de cobros sin depositar
// ============================================================

const Cobranza = (() => {

  /**
   * Ruta del día: créditos APROVADO con pagos ATRASADO o POR COBRAR.
   * Enriquecidos con datos del cliente y coordenadas Leaflet.
   */
  function getRuta(ctx) {
    try {
      requireRole_(ctx.user.rol, CONFIG.ROLES.COBRANZA);

      const creditos = SheetHelper.getAll(CONFIG.SHEETS.CREDITOS)
        .filter(cr => cr['ESTATUS'] === 'APROVADO');

      const hoy = _now().substring(0, 10);

      const ruta = creditos.map(cr => {
        // Obtener datos del cliente
        const clienteFound = SheetHelper.findOne(CONFIG.SHEETS.CLIENTES,
          c => c['IDCliente'] === cr['IDCliente']);
        const cliente = clienteFound ? clienteFound.data : {};

        // Obtener pagos pendientes (ATRASADO o POR COBRAR)
        const pagos = SheetHelper.getAll(CONFIG.SHEETS.PAGOS)
          .filter(p => p['IDCredito'] === cr['IDCredito'])
          .sort((a, b) => parseInt(a['Semana_num']) - parseInt(b['Semana_num']));

        const pendientes = pagos.filter(p =>
          ['ATRASADO', 'POR COBRAR', 'PARCIAL'].includes(p['Estatus_de_pago']));
        const atrasadas  = pagos.filter(p => p['Estatus_de_pago'] === 'ATRASADO').length;
        const parciales  = pagos.filter(p => p['Estatus_de_pago'] === 'PARCIAL').length;

        // Solo entra a la ruta si tiene atrasos o pagos parciales
        // Los clientes al corriente (solo POR COBRAR) NO aparecen
        if (atrasadas === 0 && parciales === 0) return null;

        const proximaPago = pendientes[0];

        return {
          IDCredito:        cr['IDCredito'],
          IDCliente:        cr['IDCliente'],
          Nombre_completo:  cliente['Nombre_completo'] || cr['Nombre_cliente'] || '—',
          Celular:          cr['Celular'] || '',
          Direccion:        cliente['Direccion'] || '—',
          Ubicacion:        cliente['Ubicacion'] || '',   // "lat,lng"
          Pago_puntual:     parseFloat(cr['Pago_puntual']) || 0,
          Pago_normal:      parseFloat(cr['Pago_normal'])  || 0,
          Pago_moroso:      parseFloat(cr['Pago_moroso'])  || 0,
          Semanas_atrasadas: atrasadas,
          Semana_proxima:   parseInt(proximaPago['Semana_num']),
          Fecha_programada: proximaPago['Fecha_programada'],
          Monto_esperado:   parseFloat(proximaPago['Monto_esperado']) || 0,
          Monto_pagado:     parseFloat(proximaPago['Monto_pagado'])   || 0,
          Estatus_pago:     proximaPago['Estatus_de_pago'],
        };
      }).filter(Boolean);

      // Primero los más atrasados
      ruta.sort((a, b) => (b.Semanas_atrasadas - a.Semanas_atrasadas));

      return { ok: true, data: ruta, total: ruta.length };
    } catch (err) { return handleError_(err); }
  }

  /**
   * Registrar una visita sin pago (cliente no estaba o no pagó).
   * Persiste en hoja "Visitas" para auditoría.
   */
  function registrarVisita(payload, ctx) {
    try {
      requireRole_(ctx.user.rol, CONFIG.ROLES.COBRANZA);
      const { IDCredito, motivo, comentarios } = payload;

      if (!IDCredito) throw { code: 'DATOS_INVALIDOS', message: 'IDCredito requerido.' };
      if (!motivo)   throw { code: 'DATOS_INVALIDOS', message: 'Motivo de la visita requerido.' };

      // Verificar que el crédito existe y está activo
      const credFound = SheetHelper.findOne(CONFIG.SHEETS.CREDITOS,
        r => r['IDCredito'] === IDCredito);
      if (!credFound) throw { code: 'NO_ENCONTRADO', message: 'Crédito no encontrado.' };
      if (credFound.data['ESTATUS'] !== 'APROVADO') {
        throw { code: 'ESTADO_INVALIDO', message: 'El crédito no está activo.' };
      }

      const id  = SheetHelper.nextId(CONFIG.SHEETS.VISITAS, 'VIS', 5);
      const now = _now();

      SheetHelper.insertRow(CONFIG.SHEETS.VISITAS, {
        'IDVisita':       id,
        'Marca_temporal': now,
        'IDCredito':      IDCredito,
        'IDCliente':      credFound.data['IDCliente'] || '',
        'Cobrador_ID':    ctx.user.id || ctx.user.username,
        'Motivo':         motivo,
        'Comentarios':    comentarios || '',
        'Fecha':          now.substring(0, 10),
      });

      _log(ctx, 'VISITA_REGISTRAR', IDCredito, { motivo, comentarios }, 'EXITO');
      return { ok: true, id, message: 'Visita registrada correctamente.' };
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
        'Accion': accion, 'Modulo': 'COBRANZA', 'ID_Registro_Afectado': id,
        'Estado_Anterior': '', 'Estado_Nuevo': JSON.stringify(detalle),
        'Resultado': resultado, 'Detalle_Error': '',
      });
    } catch(_) {}
  }

  return { getRuta, registrarVisita };
})();
