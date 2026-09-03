// ============================================================
// CredyFast — 04_Usuarios.gs
// Gestión de usuarios del sistema.
// ============================================================

const Usuarios = (() => {

  function create(payload, ctx) {
    try {
      requireRole_(ctx.user.rol, CONFIG.ROLES.SUPER_USUARIO);

      const { username, passwordHash, nombre, rol, notas } = payload;

      // Validaciones
      if (!username || !passwordHash || !nombre || !rol) {
        throw { code: 'DATOS_INVALIDOS', message: 'username, passwordHash, nombre y rol son requeridos.' };
      }
      if (!Object.values(CONFIG.ROLES).includes(rol)) {
        throw { code: 'ROL_INVALIDO', message: `Rol no válido: ${rol}` };
      }
      if (rol === CONFIG.ROLES.SUPER_USUARIO) {
        throw { code: 'SIN_PERMISO', message: 'No se pueden crear SuperUsuarios desde la UI.' };
      }
      if (!/^[a-zA-Z0-9_]{3,30}$/.test(username)) {
        throw { code: 'USERNAME_INVALIDO', message: 'Username: solo alfanumérico y guión bajo, 3-30 chars.' };
      }

      const lock = LockService.getScriptLock();
      lock.waitLock(10000);
      try {
        // Verificar username único
        const existing = SheetHelper.findOne(CONFIG.SHEETS.USUARIOS, r => r['Username'] === username);
        if (existing) throw { code: 'USERNAME_DUPLICADO', message: `El username "${username}" ya existe.` };

        // Verificar que no esté en hardcoded
        if (CONFIG.SUPER_USERS.some(u => u.username === username)) {
          throw { code: 'USERNAME_RESERVADO', message: 'Ese username está reservado.' };
        }

        const id = Utilities.getUuid();
        const now = _now();

        SheetHelper.insertRow(CONFIG.SHEETS.USUARIOS, {
          'ID_Usuario':      id,
          'Username':        username,
          'Password_Hash':   passwordHash,
          'Nombre_Completo': nombre,
          'Rol':             rol,
          'Activo':          'TRUE',
          'Fecha_Creacion':  now,
          'Creado_Por':      ctx.user.id || ctx.user.username,
          'Ultimo_Acceso':   '',
          'Notas':           notas || '',
        });

        _log(ctx, 'USUARIO_CREAR', 'USUARIOS', id, { username, rol }, 'EXITO');
        return { ok: true, id, message: `Usuario "${username}" creado correctamente.` };

      } finally { lock.releaseLock(); }

    } catch (err) { return handleError_(err); }
  }

  function list(ctx) {
    try {
      requireRole_(ctx.user.rol, CONFIG.ROLES.SUPER_USUARIO);
      const all = SheetHelper.getAll(CONFIG.SHEETS.USUARIOS);
      // No retornar hashes de contraseña
      return {
        ok: true,
        data: all.map(u => ({
          id:       u['ID_Usuario'],
          username: u['Username'],
          nombre:   u['Nombre_Completo'],
          rol:      u['Rol'],
          activo:   u['Activo'] === true || u['Activo'] === 'TRUE',
          creado:   u['Fecha_Creacion'],
          acceso:   u['Ultimo_Acceso'],
        })),
      };
    } catch (err) { return handleError_(err); }
  }

  function toggle(payload, ctx) {
    try {
      requireRole_(ctx.user.rol, CONFIG.ROLES.SUPER_USUARIO);
      const { id } = payload;
      if (!id) throw { code: 'DATOS_INVALIDOS', message: 'ID de usuario requerido.' };

      const found = SheetHelper.findOne(CONFIG.SHEETS.USUARIOS, r => r['ID_Usuario'] === id);
      if (!found) throw { code: 'NO_ENCONTRADO', message: 'Usuario no encontrado.' };

      // No se puede desactivar a uno mismo
      if (id === ctx.user.id) throw { code: 'ACCION_INVALIDA', message: 'No puedes desactivarte a ti mismo.' };

      const nuevoEstado = (found.data['Activo'] === true || found.data['Activo'] === 'TRUE') ? 'FALSE' : 'TRUE';
      SheetHelper.updateRow(CONFIG.SHEETS.USUARIOS, found.rowIndex, { 'Activo': nuevoEstado });

      _log(ctx, 'USUARIO_DESACTIVAR', 'USUARIOS', id, { activo: nuevoEstado }, 'EXITO');
      return { ok: true, message: `Usuario ${nuevoEstado === 'TRUE' ? 'activado' : 'desactivado'}.` };

    } catch (err) { return handleError_(err); }
  }

  function _now() {
    return Utilities.formatDate(new Date(), CONFIG.TIMEZONE, 'yyyy-MM-dd HH:mm:ss');
  }

  function _log(ctx, accion, modulo, id, detalle, resultado) {
    try {
      SheetHelper.insertRow(CONFIG.SHEETS.LOGS, {
        'ID_Log':               'LOG' + Date.now(),
        'Timestamp':            _now(),
        'Usuario_ID':           ctx.user.id || '',
        'Username':             ctx.user.username || '',
        'Accion':               accion,
        'Modulo':               modulo,
        'ID_Registro_Afectado': id,
        'Estado_Anterior':      '',
        'Estado_Nuevo':         JSON.stringify(detalle),
        'IP_Origen':            ctx.ip || '',
        'Resultado':            resultado,
        'Detalle_Error':        '',
      });
    } catch(_) {}
  }

  return { create, list, toggle };
})();
