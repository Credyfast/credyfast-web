// ============================================================
// CredyFast — 06_Clientes.gs
// Gestión de clientes.
// Columnas: IDCliente, Marca_temporal, Nombre_s, Apellido_paterno,
//   Apellido_materno, IDMEX, Direccion, Ubicacion, CURP,
//   A_que_se_dedica, Ingreso_semanal, Gastos_semanales,
//   Nombre_completo, Fecha_de_nacimiento, Edad, Sexo,
//   INE_Frente_ID, INE_Reverso_ID, Comprobante_ID
// ============================================================

const Clientes = (() => {

  // ── Crear cliente ─────────────────────────────────────────
  function create(payload, ctx) {
    try {
      requireRole_(ctx.user.rol, CONFIG.ROLES.VENDEDOR);
      _validate(payload);

      const lock = LockService.getScriptLock();
      lock.waitLock(10000);
      try {
        const id  = SheetHelper.nextId(CONFIG.SHEETS.CLIENTES, 'CL', 5);
        const now = _now();

        // ── Campos auto calculados ────────────────────────────
        const nombreCompleto    = _buildNombre(payload);
        const fechaNacimiento   = _fechaFromCURP(payload.CURP);
        const edad              = _calcEdad(fechaNacimiento);
        const sexo              = _sexoFromCURP(payload.CURP);

        SheetHelper.insertRow(CONFIG.SHEETS.CLIENTES, {
          'IDCliente':           id,
          'Marca_temporal':      now,
          'Nombre_s':            payload.Nombre_s           || '',
          'Apellido_paterno':    payload.Apellido_paterno   || '',
          'Apellido_materno':    payload.Apellido_materno   || '',
          'IDMEX':               payload.IDMEX              || '',
          'Direccion':           payload.Direccion          || '',
          'Ubicacion':           payload.Ubicacion          || '', // "lat,lng"
          'CURP':                (payload.CURP || '').toUpperCase().trim(),
          'A_que_se_dedica':     payload.A_que_se_dedica    || '',
          'Ingreso_semanal':     parseFloat(payload.Ingreso_semanal)   || 0,
          'Gastos_semanales':    parseFloat(payload.Gastos_semanales)  || 0,
          'Nombre_completo':     nombreCompleto,
          'Fecha_de_nacimiento': fechaNacimiento,
          'Edad':                edad,
          'Sexo':                sexo,
          'INE_Frente_ID':       payload.INE_Frente_ID      || '',
          'INE_Reverso_ID':      payload.INE_Reverso_ID     || '',
          'Comprobante_ID':      payload.Comprobante_ID     || '',
        });

        _log(ctx, 'CLIENTE_CREAR', id, {}, 'EXITO');
        return { ok: true, id, nombreCompleto, message: 'Cliente registrado.' };

      } finally { lock.releaseLock(); }
    } catch (err) { return handleError_(err); }
  }

  // ── Buscar clientes ───────────────────────────────────────
  function search(payload, ctx) {
    try {
      requireRole_(ctx.user.rol, CONFIG.ROLES.VENDEDOR);
      const q = (payload.query || '').toLowerCase().trim();
      if (!q) return { ok: true, data: [] };

      const todos = SheetHelper.getAll(CONFIG.SHEETS.CLIENTES);
      const resultados = todos.filter(c => {
        return (
          (c['Nombre_completo'] || '').toLowerCase().includes(q) ||
          (c['CURP']            || '').toLowerCase().includes(q) ||
          (c['IDCliente']       || '').toLowerCase().includes(q) ||
          (c['IDMEX']           || '').toLowerCase().includes(q)
        );
      });
      return { ok: true, data: resultados.slice(0, 20) };
    } catch (err) { return handleError_(err); }
  }

  // ── Obtener cliente por ID ────────────────────────────────
  function get(payload, ctx) {
    try {
      requireRole_(ctx.user.rol, CONFIG.ROLES.CAJERO);
      const found = SheetHelper.findOne(CONFIG.SHEETS.CLIENTES,
        r => r['IDCliente'] === payload.id || r['CURP'] === payload.id);
      if (!found) throw { code: 'NO_ENCONTRADO', message: 'Cliente no encontrado.' };
      return { ok: true, data: found.data };
    } catch (err) { return handleError_(err); }
  }

  // ── Actualizar fotos de un cliente ────────────────────────
  function updateFotos(payload, ctx) {
    try {
      requireRole_(ctx.user.rol, CONFIG.ROLES.VENDEDOR);
      const found = SheetHelper.findOne(CONFIG.SHEETS.CLIENTES,
        r => r['IDCliente'] === payload.IDCliente);
      if (!found) throw { code: 'NO_ENCONTRADO', message: 'Cliente no encontrado.' };

      const updates = {};
      if (payload.INE_Frente_ID)  updates['INE_Frente_ID']  = payload.INE_Frente_ID;
      if (payload.INE_Reverso_ID) updates['INE_Reverso_ID'] = payload.INE_Reverso_ID;
      if (payload.Comprobante_ID) updates['Comprobante_ID'] = payload.Comprobante_ID;

      SheetHelper.updateRow(CONFIG.SHEETS.CLIENTES, found.rowIndex, updates);
      return { ok: true, message: 'Fotos actualizadas.' };
    } catch (err) { return handleError_(err); }
  }

  // ── Validación ────────────────────────────────────────────
  function _validate(p) {
    if (!p.Nombre_s || !p.Apellido_paterno) {
      throw { code: 'DATOS_INVALIDOS', message: 'Nombre y Apellido paterno son obligatorios.' };
    }
    if (!p.CURP || p.CURP.length !== 18) {
      throw { code: 'DATOS_INVALIDOS', message: 'CURP inválido (debe tener 18 caracteres).' };
    }
    // Fotos obligatorias
    if (!p.INE_Frente_ID || !p.INE_Reverso_ID || !p.Comprobante_ID) {
      throw { code: 'FOTOS_OBLIGATORIAS', message: 'INE (frente y reverso) y Comprobante de domicilio son obligatorios.' };
    }
  }

  // ── Helpers auto-cálculo ──────────────────────────────────

  function _buildNombre(p) {
    return [p.Nombre_s, p.Apellido_paterno, p.Apellido_materno]
      .filter(Boolean).join(' ').trim();
  }

  function _fechaFromCURP(curp) {
    if (!curp || curp.length < 10) return '';
    try {
      // CURP: posiciones 5-10 (1-indexed) = AAMMDD
      const yy  = parseInt(curp.substring(4, 6), 10);
      const mm  = parseInt(curp.substring(6, 8), 10);
      const dd  = parseInt(curp.substring(8, 10), 10);

      // Regla de siglo: si yy <= año actual (2 dígitos) → 2000s, si no → 1900s
      const currentYY = new Date().getFullYear() % 100;
      const yyyy = yy <= currentYY ? 2000 + yy : 1900 + yy;

      if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return '';
      // Formato dd/mm/yyyy
      return String(dd).padStart(2,'0') + '/' + String(mm).padStart(2,'0') + '/' + yyyy;
    } catch(_) { return ''; }
  }

  function _calcEdad(fechaStr) {
    if (!fechaStr) return '';
    try {
      // Espera formato dd/mm/yyyy
      const partes = fechaStr.split('/');
      if (partes.length !== 3) return '';
      const nac  = new Date(parseInt(partes[2]), parseInt(partes[1]) - 1, parseInt(partes[0]));
      const hoy  = new Date();
      let edad   = hoy.getFullYear() - nac.getFullYear();
      const m    = hoy.getMonth() - nac.getMonth();
      if (m < 0 || (m === 0 && hoy.getDate() < nac.getDate())) edad--;
      return edad;
    } catch(_) { return ''; }
  }

  function _sexoFromCURP(curp) {
    if (!curp || curp.length < 11) return '';
    const c = curp.charAt(10).toUpperCase();
    if (c === 'H') return 'HOMBRE';
    if (c === 'M') return 'MUJER';
    return '';
  }

  function _now() {
    return Utilities.formatDate(new Date(), CONFIG.TIMEZONE, 'yyyy-MM-dd HH:mm:ss');
  }

  function _log(ctx, accion, id, detalle, resultado) {
    try {
      SheetHelper.insertRow(CONFIG.SHEETS.LOGS, {
        'ID_Log': 'LOG' + Date.now(), 'Timestamp': _now(),
        'Usuario_ID': ctx.user.id || '', 'Username': ctx.user.username || '',
        'Accion': accion, 'Modulo': 'CLIENTES', 'ID_Registro_Afectado': id,
        'Estado_Anterior': '', 'Estado_Nuevo': JSON.stringify(detalle),
        'Resultado': resultado, 'Detalle_Error': '',
      });
    } catch(_) {}
  }

  return { create, search, get, updateFotos };
})();
