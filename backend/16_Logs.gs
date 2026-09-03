// ============================================================
// CredyFast — 16_Logs.gs
// Módulo de Logs del Sistema — Solo lectura para SuperUsuario.
// ============================================================

const LogsSistema = (() => {

  function list(payload, ctx) {
    try {
      requireRole_(ctx.user.rol, CONFIG.ROLES.SUPER_USUARIO);
      const { modulo, accion, usuario, desde, hasta, limite } = payload || {};

      let logs = SheetHelper.getAll(CONFIG.SHEETS.LOGS);

      if (modulo)  logs = logs.filter(l => l['Modulo'] === modulo);
      if (accion)  logs = logs.filter(l => l['Accion'] === accion);
      if (usuario) logs = logs.filter(l => l['Username'] === usuario || l['Usuario_ID'] === usuario);
      if (desde)   logs = logs.filter(l => (l['Timestamp'] || '') >= desde);
      if (hasta)   logs = logs.filter(l => (l['Timestamp'] || '') <= hasta);

      logs.sort((a, b) => new Date(b['Timestamp']) - new Date(a['Timestamp']));

      return {
        ok: true,
        data: logs.slice(0, parseInt(limite) || 100),
        total: logs.length,
      };
    } catch (err) { return handleError_(err); }
  }

  return { list };
})();
