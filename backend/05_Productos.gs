// ============================================================
// CredyFast — 05_Productos.gs
// Gestión de catálogo de productos.
// Columnas: IDProd, Marca_temporal, MARCA, MODELO, MOD_COMERCIAL,
//           NS, RAM, ALMACENAMIENTO, COLOR, COSTO_REAL, COSTO_MOSTRADO,
//           Precio_de_contado (col M auto = COSTO_MOSTRADO×1.5),
//           Estatus (col N auto = DISPONIBLE al crear)
// ============================================================

const Productos = (() => {

  // ── Crear producto ────────────────────────────────────────
  function create(payload, ctx) {
    try {
      requireRole_(ctx.user.rol, CONFIG.ROLES.SUPERVISOR);
      _validate(payload);

      const lock = LockService.getScriptLock();
      lock.waitLock(10000);
      try {
        const id  = SheetHelper.nextId(CONFIG.SHEETS.PRODUCTOS, 'IDP', 5);
        const now = _now();

        const costoMostrado = parseFloat(payload.COSTO_MOSTRADO) || 0;
        const precioContado = Math.round(costoMostrado * CONFIG.FACTOR_PRECIO_CONTADO);

        SheetHelper.insertRow(CONFIG.SHEETS.PRODUCTOS, {
          'IDProd':             id,
          'Marca_temporal':     now,
          'MARCA':              payload.MARCA          || '',
          'MODELO':             payload.MODELO         || '',
          'MOD_COMERCIAL':      payload.MOD_COMERCIAL  || '',
          'NS':                 payload.NS             || '',
          'RAM':                payload.RAM            !== undefined ? payload.RAM : 0,
          'ALMACENAMIENTO':     payload.ALMACENAMIENTO !== undefined ? payload.ALMACENAMIENTO : 0,
          'COLOR':              payload.COLOR          || '',
          'COSTO_REAL':         parseFloat(payload.COSTO_REAL) || 0,
          'COSTO_MOSTRADO':     costoMostrado,
          'Precio_de_contado':  precioContado,
          'Estatus':            'DISPONIBLE',
          'PROVEEDOR':          payload.PROVEEDOR      || '',
        });

        _log(ctx, 'PRODUCTO_CREAR', id, { marca: payload.MARCA, modelo: payload.MODELO }, 'EXITO');
        return { ok: true, id, message: `Producto ${payload.MARCA} ${payload.MODELO} creado.` };

      } finally { lock.releaseLock(); }
    } catch (err) { return handleError_(err); }
  }

  // ── Actualizar producto ───────────────────────────────────
  function update(payload, ctx) {
    try {
      requireRole_(ctx.user.rol, CONFIG.ROLES.SUPERVISOR);
      const { IDProd } = payload;
      if (!IDProd) throw { code: 'DATOS_INVALIDOS', message: 'IDProd es requerido.' };

      const found = SheetHelper.findOne(CONFIG.SHEETS.PRODUCTOS, r => r['IDProd'] === IDProd);
      if (!found) throw { code: 'NO_ENCONTRADO', message: 'Producto no encontrado.' };

      _validate(payload);

      const updates = {};
      const campos = ['MARCA','MODELO','MOD_COMERCIAL','NS','RAM','ALMACENAMIENTO','COLOR','COSTO_REAL','COSTO_MOSTRADO','PROVEEDOR'];
      campos.forEach(c => {
        if (payload[c] !== undefined) updates[c] = payload[c];
      });
      // Recalcular Precio_de_contado si cambió COSTO_MOSTRADO
      if (payload.COSTO_MOSTRADO !== undefined) {
        updates['Precio_de_contado'] = Math.round(parseFloat(payload.COSTO_MOSTRADO) * CONFIG.FACTOR_PRECIO_CONTADO);
      }
      // Asegurar que Estatus no se pierda al editar
      if (!updates['Estatus']) updates['Estatus'] = found.data['Estatus'] || 'DISPONIBLE';

      SheetHelper.updateRow(CONFIG.SHEETS.PRODUCTOS, found.rowIndex, updates);

      _log(ctx, 'PRODUCTO_EDITAR', IDProd, {}, 'EXITO');
      return { ok: true, message: 'Producto actualizado.' };

    } catch (err) { return handleError_(err); }
  }

  // ── Listar productos ──────────────────────────────────────
  function list(ctx) {
    try {
      requireRole_(ctx.user.rol, CONFIG.ROLES.SUPERVISOR);
      const all = SheetHelper.getAll(CONFIG.SHEETS.PRODUCTOS);
      return { ok: true, data: all };
    } catch (err) { return handleError_(err); }
  }

  // ── Eliminar (soft delete — no existe en el esquema nuevo,
  //    usamos un campo lógico si se necesita en el futuro)
  function toggle(payload, ctx) {
    try {
      requireRole_(ctx.user.rol, CONFIG.ROLES.SUPERVISOR);
      const { idProducto, IDProd } = payload;
      const id = IDProd || idProducto;
      if (!id) throw { code: 'DATOS_INVALIDOS', message: 'IDProd requerido.' };

      const found = SheetHelper.findOne(CONFIG.SHEETS.PRODUCTOS, r => r['IDProd'] === id);
      if (!found) throw { code: 'NO_ENCONTRADO', message: 'Producto no encontrado.' };

      // El esquema actual no tiene campo Activo — se elimina la fila (hard delete)
      // Si en el futuro se agrega el campo Activo, cambiar aquí.
      // Por ahora: no hacer nada destructivo, solo responder ok.
      return { ok: true, message: 'Operación no disponible en el esquema actual.' };

    } catch (err) { return handleError_(err); }
  }

  // ── Validación ────────────────────────────────────────────
  function _validate(p) {
    if (!p.MARCA && !p.MODELO) {
      throw { code: 'DATOS_INVALIDOS', message: 'Al menos MARCA o MODELO son requeridos.' };
    }
    if (p.COSTO_MOSTRADO !== undefined && parseFloat(p.COSTO_MOSTRADO) <= 0) {
      throw { code: 'DATOS_INVALIDOS', message: 'COSTO_MOSTRADO debe ser mayor a 0.' };
    }
  }

  function _now() { return Utilities.formatDate(new Date(), CONFIG.TIMEZONE, 'yyyy-MM-dd HH:mm:ss'); }

  function _log(ctx, accion, id, detalle, resultado) {
    try {
      SheetHelper.insertRow(CONFIG.SHEETS.LOGS, {
        'ID_Log': 'LOG' + Date.now(), 'Timestamp': _now(),
        'Usuario_ID': ctx.user.id || '', 'Username': ctx.user.username || '',
        'Accion': accion, 'Modulo': 'PRODUCTOS', 'ID_Registro_Afectado': id,
        'Estado_Anterior': '', 'Estado_Nuevo': JSON.stringify(detalle),
        'IP_Origen': ctx.ip || '', 'Resultado': resultado, 'Detalle_Error': '',
      });
    } catch(_) {}
  }

  return { create, update, list, toggle };
})();
