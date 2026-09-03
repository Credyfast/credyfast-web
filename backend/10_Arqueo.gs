// ============================================================
// CredyFast — 10_Arqueo.gs
// Módulo de Arqueo de Caja.
// La UI nunca muestra el monto de diferencia, solo el resultado.
// ============================================================

const Arqueo = (() => {

  function realizar(payload, ctx) {
    try {
      requireRole_(ctx.user.rol, CONFIG.ROLES.CAJERO);
      const {
        billetes1000 = 0, billetes500 = 0, billetes200 = 0,
        billetes100  = 0, billetes50  = 0,
        monedas20    = 0, monedas10   = 0, monedas5    = 0,
        monedas2     = 0, monedas1    = 0, monedas050  = 0,
        supervisadoPor,
      } = payload;

      // Calcular total físico
      const totalFisico = _round2(
        parseInt(billetes1000) * 1000 +
        parseInt(billetes500)  * 500  +
        parseInt(billetes200)  * 200  +
        parseInt(billetes100)  * 100  +
        parseInt(billetes50)   * 50   +
        parseInt(monedas20)    * 20   +
        parseInt(monedas10)    * 10   +
        parseInt(monedas5)     * 5    +
        parseInt(monedas2)     * 2    +
        parseInt(monedas1)     * 1    +
        parseInt(monedas050)   * 0.5
      );

      // Saldo del sistema = último Saldo_Posterior de Caja
      const saldoSistema = _getSaldoSistema();
      const diferencia   = _round2(totalFisico - saldoSistema);

      let resultado;
      if (Math.abs(diferencia) < 0.01) resultado = 'CORRECTO';
      else if (diferencia > 0)          resultado = 'SOBRANTE';
      else                              resultado = 'FALTANTE';

      const id  = 'ARQ' + Date.now();
      const now = _now();

      SheetHelper.insertRow(CONFIG.SHEETS.ARQUEOS_CAJA, {
        'ID_Arqueo':      id,
        'Fecha':          now,
        'Realizado_Por':  ctx.user.id || ctx.user.username,
        'Supervisado_Por':supervisadoPor || '',
        'Saldo_Sistema':  saldoSistema,
        'Billetes_1000':  parseInt(billetes1000),
        'Billetes_500':   parseInt(billetes500),
        'Billetes_200':   parseInt(billetes200),
        'Billetes_100':   parseInt(billetes100),
        'Billetes_50':    parseInt(billetes50),
        'Monedas_20':     parseInt(monedas20),
        'Monedas_10':     parseInt(monedas10),
        'Monedas_5':      parseInt(monedas5),
        'Monedas_2':      parseInt(monedas2),
        'Monedas_1':      parseInt(monedas1),
        'Monedas_050':    parseInt(monedas050),
        'Total_Fisico':   totalFisico,
        'Diferencia':     diferencia,   // guardado en Sheets para auditoría
        'Resultado':      resultado,
      });

      _log(ctx, 'ARQUEO_REALIZAR', id, { resultado, saldoSistema }, 'EXITO');

      // Al frontend NUNCA se envía la diferencia en pesos
      return {
        ok: true,
        id,
        resultado,               // 'CORRECTO' | 'SOBRANTE' | 'FALTANTE'
        totalFisico,             // Para que el cajero confirme su conteo
        message: `Arqueo realizado: ${resultado}`,
      };

    } catch (err) { return handleError_(err); }
  }

  function history(ctx) {
    try {
      requireRole_(ctx.user.rol, CONFIG.ROLES.SUPERVISOR);
      const all = SheetHelper.getAll(CONFIG.SHEETS.ARQUEOS_CAJA);
      all.sort((a, b) => new Date(b['Fecha']) - new Date(a['Fecha']));
      // Ocultar Diferencia en el historial del frontend
      return {
        ok: true,
        data: all.map(a => ({
          id:           a['ID_Arqueo'],
          fecha:        a['Fecha'],
          realizadoPor: a['Realizado_Por'],
          resultado:    a['Resultado'],
          totalFisico:  a['Total_Fisico'],
        })),
      };
    } catch (err) { return handleError_(err); }
  }

  function _getSaldoSistema() {
    const ultimoSaldo = SheetHelper.getLastColumnValue(CONFIG.SHEETS.CAJA, 7);
    return parseFloat(ultimoSaldo || 0);
  }

  function _round2(n) { return Math.round(n * 100) / 100; }
  function _now() { return Utilities.formatDate(new Date(), CONFIG.TIMEZONE, 'yyyy-MM-dd HH:mm:ss'); }

  function _log(ctx, accion, id, detalle, resultado) {
    try {
      SheetHelper.insertRow(CONFIG.SHEETS.LOGS, {
        'ID_Log': 'LOG' + Date.now(), 'Timestamp': _now(),
        'Usuario_ID': ctx.user.id || '', 'Username': ctx.user.username || '',
        'Accion': accion, 'Modulo': 'CAJA', 'ID_Registro_Afectado': id,
        'Estado_Anterior': '', 'Estado_Nuevo': JSON.stringify(detalle),
        'IP_Origen': ctx.ip || '', 'Resultado': resultado, 'Detalle_Error': '',
      });
    } catch(_) {}
  }

  return { realizar, history };
})();
