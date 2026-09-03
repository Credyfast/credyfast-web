// ============================================================
// CredyFast — 03_Auth.gs
// Módulo de Autenticación y Gestión de Sesiones.
// Sesiones con expiración de 8 horas via CacheService.
// ============================================================

const Auth = (() => {

  const CACHE = CacheService.getScriptCache();

  // ── Login ─────────────────────────────────────────────────
  function login(payload, ip) {
    try {
      const { username, passwordHash } = payload;
      if (!username || !passwordHash) {
        return { ok: false, error: 'DATOS_INVALIDOS', message: 'Username y contraseña requeridos.' };
      }

      // 1. Buscar en SuperUsuarios hardcoded
      const superUser = CONFIG.SUPER_USERS.find(
        u => u.username === username && u.passwordHash === passwordHash
      );
      if (superUser) {
        const token = _createSession({ username, rol: CONFIG.ROLES.SUPER_USUARIO, nombre: username });
        _log_(null, username, 'LOGIN', 'AUTH', username, { superUser: true }, ip, 'EXITO');
        return { ok: true, token, user: { username, rol: CONFIG.ROLES.SUPER_USUARIO, nombre: username } };
      }

      // 2. Buscar en hoja Usuarios
      const found = SheetHelper.findOne(CONFIG.SHEETS.USUARIOS, r =>
        r['Username'] === username &&
        r['Password_Hash'] === passwordHash &&
        (r['Activo'] === true || r['Activo'] === 'TRUE')
      );

      if (!found) {
        _log_(null, username || 'DESCONOCIDO', 'LOGIN', 'AUTH', username, { intento: 'fallido' }, ip, 'ERROR');
        return { ok: false, error: 'CREDENCIALES_INVALIDAS', message: 'Usuario o contraseña incorrectos.' };
      }

      const u = found.data;
      const token = _createSession({
        id:       u['ID_Usuario'],
        username: u['Username'],
        nombre:   u['Nombre_Completo'],
        rol:      u['Rol'],
      });

      // Actualizar Ultimo_Acceso
      SheetHelper.updateRow(CONFIG.SHEETS.USUARIOS, found.rowIndex, {
        'Ultimo_Acceso': _now(),
      });

      _log_(u['ID_Usuario'], u['Username'], 'LOGIN', 'AUTH', u['ID_Usuario'], {}, ip, 'EXITO');

      return {
        ok:    true,
        token,
        user:  { id: u['ID_Usuario'], username: u['Username'], nombre: u['Nombre_Completo'], rol: u['Rol'] },
      };

    } catch (err) {
      Logger.log('Auth.login error: ' + err);
      return handleError_(err);
    }
  }

  // ── Logout ────────────────────────────────────────────────
  function logout(token, ctx) {
    try {
      CACHE.remove(CONFIG.SESSION_CACHE_PREFIX + token);
      _log_(ctx.user.id, ctx.user.username, 'LOGOUT', 'AUTH', ctx.user.id, {}, ctx.ip, 'EXITO');
      return { ok: true, message: 'Sesión cerrada correctamente.' };
    } catch (err) {
      return handleError_(err);
    }
  }

  // ── Validar sesión ────────────────────────────────────────
  function validateSession(token) {
    if (!token) return { ok: false };
    try {
      const raw = CACHE.get(CONFIG.SESSION_CACHE_PREFIX + token);
      if (!raw) return { ok: false };
      const session = JSON.parse(raw);
      // Renovar TTL con cada petición válida (sliding window)
      CACHE.put(
        CONFIG.SESSION_CACHE_PREFIX + token,
        raw,
        CONFIG.SESSION_DURATION_HOURS * 3600
      );
      return { ok: true, user: session };
    } catch (_) {
      return { ok: false };
    }
  }

  // ── Internos ──────────────────────────────────────────────

  function _createSession(userData) {
    const token = Utilities.getUuid();
    CACHE.put(
      CONFIG.SESSION_CACHE_PREFIX + token,
      JSON.stringify(userData),
      CONFIG.SESSION_DURATION_HOURS * 3600
    );
    return token;
  }

  function _now() {
    return Utilities.formatDate(new Date(), CONFIG.TIMEZONE, 'yyyy-MM-dd HH:mm:ss');
  }

  function _log_(userId, username, accion, modulo, idAfectado, detalle, ip, resultado) {
    try {
      SheetHelper.insertRow(CONFIG.SHEETS.LOGS, {
        'ID_Log':               'LOG' + Date.now(),
        'Timestamp':            _now(),
        'Usuario_ID':           userId || '',
        'Username':             username || '',
        'Accion':               accion,
        'Modulo':               modulo,
        'ID_Registro_Afectado': idAfectado || '',
        'Estado_Anterior':      '',
        'Estado_Nuevo':         JSON.stringify(detalle),
        'IP_Origen':            ip || '',
        'Resultado':            resultado,
        'Detalle_Error':        '',
      });
    } catch (_) { /* No bloquear flujo por error de log */ }
  }

  return { login, logout, validateSession };

})();
