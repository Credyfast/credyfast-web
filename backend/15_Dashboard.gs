// ============================================================
// CredyFast — 15_Dashboard.gs
// Dashboard en tiempo real (calculado en backend).
// ============================================================

const Dashboard = (() => {

  function getData(ctx) {
    try {
      requireRole_(ctx.user.rol, CONFIG.ROLES.SUPERVISOR);
      const hoy = _today();

      // ── Saldo de caja ──────────────────────────────────────
      const movsCaja = SheetHelper.getAll(CONFIG.SHEETS.CAJA);
      const saldoCaja = movsCaja.reduce((acc, m) => {
        const monto = parseFloat(m['Monto']) || 0;
        return acc + (m['Registro'] === 'INGRESO' ? monto : -monto);
      }, 0);

      // Ingresos del día
      const ingresosDia = movsCaja
        .filter(m => m['Registro'] === 'INGRESO' && (m['Marca_temporal'] || '').startsWith(hoy))
        .reduce((sum, m) => sum + (parseFloat(m['Monto']) || 0), 0);

      // ── Créditos ──────────────────────────────────────────
      const todosLosCreditos = SheetHelper.getAll(CONFIG.SHEETS.CREDITOS);
      const activos = todosLosCreditos.filter(c => c['ESTATUS'] === 'APROVADO');
      const pendientesAprob = todosLosCreditos.filter(c => c['ESTATUS'] === 'PENDIENTE');
      const creditosMorosos = activos.filter(c => (parseFloat(c['Semanas_atrasadas']) || 0) > 0).length;

      // Últimos créditos para la tabla
      const creditosRecientes = todosLosCreditos
        .slice(-5)
        .reverse()
        .map(c => ({
          ID_Credito: c['IDCredito'],
          ID_Cliente: c['IDCliente'],
          Estado: c['ESTATUS'],
          Estado_Operativo: (parseFloat(c['Semanas_atrasadas']) || 0) > 0 ? 'ATRASO' : 'AL CORRIENTE',
          Fecha_Aprobacion: c['Marca_temporal'] || ''
        }));

      // ── Pagos recientes ──────────────────────────────────
      const pagosTodos = SheetHelper.getAll(CONFIG.SHEETS.PAGOS);
      const pagosRecientes = pagosTodos
        .filter(p => p['Fecha_pagada'])
        .sort((a, b) => (b['Fecha_pagada'] > a['Fecha_pagada'] ? 1 : -1))
        .slice(0, 5)
        .map(p => ({
          ID_Credito: p['IDCredito'],
          Num_Semana: p['Semana_num'],
          Monto_Pagado: p['Monto_pagado'],
          Estado_Pago: p['Estatus_de_pago'],
          Fecha_Ultimo_Abono: p['Fecha_pagada']
        }));

      return {
        ok: true,
        saldoCaja: _round2(saldoCaja),
        ingresosDia: _round2(ingresosDia),
        creditosActivos: activos.length,
        creditosMorosos: creditosMorosos,
        pendientesAprobacion: pendientesAprob.length,
        pagos: pagosRecientes,
        creditos: creditosRecientes
      };

    } catch (err) { return handleError_(err); }
  }

  // ── Helpers ───────────────────────────────────────────────

  function _round2(n) { return Math.round(n * 100) / 100; }
  function _today() { return Utilities.formatDate(new Date(), CONFIG.TIMEZONE, 'yyyy-MM-dd'); }

  return { getData };
})();
