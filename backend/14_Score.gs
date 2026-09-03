// ============================================================
// CredyFast — 14_Score.gs
// Módulo de Score de Cliente.
// ============================================================

const Score = (() => {

  /**
   * Inicializar registro de score si el cliente no tiene uno.
   * Llamado al aprobar un crédito.
   */
  function initIfNotExists(idCliente) {
    const found = SheetHelper.findOne(CONFIG.SHEETS.SCORE_CLIENTE, r => r['ID_Cliente'] === idCliente);
    if (!found) {
      SheetHelper.insertRow(CONFIG.SHEETS.SCORE_CLIENTE, {
        'ID_Cliente':              idCliente,
        'Total_Creditos':          0,
        'Creditos_Completados':    0,
        'Creditos_Inconclusos':    0,
        'Creditos_Activos':        1,
        'Total_Pagos':             0,
        'Pagos_Puntuales':         0,
        'Pagos_Normales':          0,
        'Pagos_Morosos':           0,
        'Pagos_Parciales':         0,
        'Semanas_Atraso_Acumuladas': 0,
        'Score_Raw':               50,
        'Clasificacion':           'REGULAR',
        'Ultima_Actualizacion':    _now(),
      });
    }
  }

  /**
   * Recalcula el score de un cliente basándose en su historial completo.
   * Llamado por el Motor de Pagos después de cada abono.
   */
  function actualizar(idCliente) {
    try {
      const found = SheetHelper.findOne(CONFIG.SHEETS.SCORE_CLIENTE, r => r['ID_Cliente'] === idCliente);
      if (!found) { initIfNotExists(idCliente); return; }

      // Leer todos los pagos del cliente
      const todosLosPagos = SheetHelper.findRows(CONFIG.SHEETS.PAGOS,
        p => p['ID_Cliente'] === idCliente && parseFloat(p['Monto_Pagado'] || 0) > 0
      ).map(p => p.data);

      // Leer todos los créditos del cliente
      const todosLosCreditos = SheetHelper.findRows(CONFIG.SHEETS.CREDITOS,
        c => c['ID_Cliente'] === idCliente
      ).map(c => c.data);

      const totalCreditos       = todosLosCreditos.length;
      const creditosCompletados = todosLosCreditos.filter(c => c['Estado'] === 'FINALIZADO').length;
      const creditosInconclusos = todosLosCreditos.filter(c => c['Estado'] === 'INCONCLUSO').length;
      const creditosActivos     = todosLosCreditos.filter(c => c['Estado'] === 'ACTIVO').length;

      const totalPagos    = todosLosPagos.length;
      const puntuales     = todosLosPagos.filter(p => p['Estado_Pago'] === 'PUNTUAL').length;
      const normales      = todosLosPagos.filter(p => p['Estado_Pago'] === 'NORMAL').length;
      const morosos       = todosLosPagos.filter(p => p['Estado_Pago'] === 'MOROSO').length;
      const parciales     = todosLosPagos.filter(p => p['Es_Parcial'] === 'TRUE' || p['Es_Parcial'] === true).length;

      // Semanas de atraso acumuladas (cuotas ATRASADO = no pagadas y vencidas)
      const atrasadas = SheetHelper.findRows(CONFIG.SHEETS.PAGOS,
        p => p['ID_Cliente'] === idCliente && p['Estado_Pago'] === 'ATRASADO'
      ).map(p => p.data);
      const hoy = _today();
      let semanasAtraso = 0;
      atrasadas.forEach(p => {
        const dias = _diasEntre(p['Fecha_Vencimiento'], hoy);
        semanasAtraso += Math.floor(Math.max(dias, 0) / 7);
      });

      // Fórmula de score
      let score = 50;
      if (totalPagos > 0) {
        score += (puntuales / totalPagos) * 30;
        score -= (morosos / totalPagos) * 25;
      }
      if (totalCreditos > 0) {
        score += (creditosCompletados / totalCreditos) * 15;
        score -= (creditosInconclusos / totalCreditos) * 20;
      }
      score -= Math.min(semanasAtraso * 0.5, 10);
      score = Math.max(0, Math.min(100, Math.round(score * 100) / 100));

      let clasificacion;
      if (score >= 80)      clasificacion = 'EXCELENTE';
      else if (score >= 60) clasificacion = 'BUENO';
      else if (score >= 40) clasificacion = 'REGULAR';
      else                  clasificacion = 'RIESGOSO';

      SheetHelper.updateRow(CONFIG.SHEETS.SCORE_CLIENTE, found.rowIndex, {
        'Total_Creditos':           totalCreditos,
        'Creditos_Completados':     creditosCompletados,
        'Creditos_Inconclusos':     creditosInconclusos,
        'Creditos_Activos':         creditosActivos,
        'Total_Pagos':              totalPagos,
        'Pagos_Puntuales':          puntuales,
        'Pagos_Normales':           normales,
        'Pagos_Morosos':            morosos,
        'Pagos_Parciales':          parciales,
        'Semanas_Atraso_Acumuladas': semanasAtraso,
        'Score_Raw':                score,
        'Clasificacion':            clasificacion,
        'Ultima_Actualizacion':     _now(),
      });

    } catch (err) {
      Logger.log('Score.actualizar error: ' + err);
    }
  }

  function get(payload, ctx) {
    try {
      requireRole_(ctx.user.rol, CONFIG.ROLES.SUPERVISOR);
      const { idCliente } = payload;
      const found = SheetHelper.findOne(CONFIG.SHEETS.SCORE_CLIENTE, r => r['ID_Cliente'] === idCliente);
      if (!found) return { ok: true, data: null, message: 'Sin historial de crédito.' };
      return { ok: true, data: found.data };
    } catch (err) { return handleError_(err); }
  }

  function _diasEntre(fechaStr, hoy) {
    const f1 = new Date(fechaStr + 'T00:00:00');
    const f2 = new Date(hoy + 'T00:00:00');
    return Math.floor((f2 - f1) / (1000 * 60 * 60 * 24));
  }
  function _today() { return Utilities.formatDate(new Date(), CONFIG.TIMEZONE, 'yyyy-MM-dd'); }
  function _now() { return Utilities.formatDate(new Date(), CONFIG.TIMEZONE, 'yyyy-MM-dd HH:mm:ss'); }

  return { initIfNotExists, actualizar, get };
})();
