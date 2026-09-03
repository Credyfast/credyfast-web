// ============================================================
// CredyFast — 13_Tickets.gs
// Generación de Tickets de Pago en PDF.
// Compatible con impresión térmica (80mm, contenido angosto).
// ============================================================

const Tickets = (() => {

  /**
   * Genera el ticket de pago como PDF y lo retorna como URL de descarga.
   * payload: { idCredito, afectados, montoAplicado, montoSobrante }
   * Llamado automáticamente por el Motor de Pagos, también disponible
   * como acción independiente: ticket_generate
   */
  function generate(payload, ctx) {
    try {
      const { idCredito, afectados, montoAplicado, montoSobrante } = payload;
      if (!idCredito) throw { code: 'DATOS_INVALIDOS', message: 'idCredito requerido.' };

      // Cargar crédito y cliente
      const crFound = SheetHelper.findOne(CONFIG.SHEETS.CREDITOS, r => r['ID_Credito'] === idCredito);
      if (!crFound) throw { code: 'NO_ENCONTRADO', message: 'Crédito no encontrado.' };
      const cr = crFound.data;

      const clFound = SheetHelper.findOne(CONFIG.SHEETS.CLIENTES, r => r['ID_Cliente'] === cr['ID_Cliente']);
      const cl = clFound ? clFound.data : {};

      // Generar HTML del ticket (formato térmico 80mm)
      const html = _buildTicketHtml(cr, cl, afectados || [], montoAplicado, montoSobrante);

      // Crear archivo HTML temporal en Drive y convertir a PDF
      const folder    = cr['Drive_Folder_ID']
        ? DriveApp.getFolderById(cr['Drive_Folder_ID'])
        : DriveApp.getFolderById(CONFIG.DRIVE_ROOT_FOLDER_ID);

      const htmlBlob  = Utilities.newBlob(html, 'text/html', 'ticket_tmp.html');
      const htmlFile  = folder.createFile(htmlBlob);

      // Convertir a PDF usando la API de Drive
      const pdfBlob   = htmlFile.getAs('application/pdf');
      const timestamp = Utilities.formatDate(new Date(), CONFIG.TIMEZONE, 'yyyyMMdd_HHmmss');
      pdfBlob.setName(`ticket_${idCredito}_${timestamp}.pdf`);
      const pdfFile   = folder.createFile(pdfBlob);

      // Eliminar HTML temporal
      htmlFile.setTrashed(true);

      const pdfId      = pdfFile.getId();
      const downloadUrl = `https://drive.google.com/uc?export=download&id=${pdfId}`;

      return { ok: true, pdfId, downloadUrl, data: { pdfId, downloadUrl } };

    } catch (err) {
      Logger.log('Tickets.generate error: ' + err);
      return { ok: false, data: null };
    }
  }

  // ── HTML del ticket (optimizado para impresión térmica 80mm) ──

  function _buildTicketHtml(cr, cl, afectados, montoAplicado, montoSobrante) {
    const fecha    = Utilities.formatDate(new Date(), CONFIG.TIMEZONE, 'dd/MM/yyyy HH:mm');
    const nombre   = (cl['Nombre'] || '') + ' ' + (cl['Apellido_Paterno'] || '');
    const folio    = 'TKT-' + cr['ID_Credito'] + '-' + Date.now().toString().slice(-6);
    const pagadas  = parseInt(cr['Semanas_Pagadas'] || 0);
    const total    = parseInt(cr['Total_Semanas'] || 0);
    const restantes = total - pagadas;

    const filasAfectadas = (afectados || []).map(a =>
      `<tr>
        <td>Semana ${a.semana}</td>
        <td style="text-align:right">$${_fmt(a.abono)}</td>
        <td style="text-align:center">${a.estadoPago}</td>
        <td style="text-align:center">${a.liquidada ? '✓' : '~'}</td>
      </tr>`
    ).join('');

    return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  @page { size: 80mm auto; margin: 4mm; }
  * { font-family: 'Courier New', monospace; font-size: 9pt; }
  body { width: 72mm; margin: 0 auto; }
  h1 { font-size: 12pt; text-align: center; margin: 4px 0; }
  h2 { font-size: 10pt; text-align: center; margin: 2px 0; }
  .sep { border-top: 1px dashed #000; margin: 4px 0; }
  .row { display: flex; justify-content: space-between; }
  table { width: 100%; border-collapse: collapse; }
  td { padding: 1px 2px; font-size: 8pt; }
  .center { text-align: center; }
  .bold { font-weight: bold; }
  .total { font-size: 11pt; font-weight: bold; }
</style>
</head>
<body>

<h1>★ CREDYFAST ★</h1>
<h2>Comprobante de Pago</h2>
<div class="sep"></div>

<div class="row"><span>Folio:</span><span>${folio}</span></div>
<div class="row"><span>Fecha:</span><span>${fecha}</span></div>
<div class="row"><span>Crédito:</span><span>${cr['ID_Credito']}</span></div>
<div class="row"><span>Cliente:</span><span>${nombre}</span></div>

<div class="sep"></div>

<table>
  <tr>
    <th style="text-align:left">Cuota</th>
    <th style="text-align:right">Monto</th>
    <th style="text-align:center">Estado</th>
    <th style="text-align:center">Ok</th>
  </tr>
  ${filasAfectadas}
</table>

<div class="sep"></div>

<div class="row total">
  <span>TOTAL PAGADO:</span>
  <span>$${_fmt(montoAplicado)}</span>
</div>
${parseFloat(montoSobrante || 0) > 0 ? `<div class="row"><span>Cambio/Sobrante:</span><span>$${_fmt(montoSobrante)}</span></div>` : ''}

<div class="sep"></div>

<div class="row"><span>Semanas pagadas:</span><span>${pagadas} / ${total}</span></div>
<div class="row"><span>Semanas restantes:</span><span>${restantes}</span></div>
<div class="row"><span>Saldo pendiente:</span><span>$${_fmt(cr['Saldo_Pendiente'])}</span></div>
<div class="row"><span>Estado:</span><span>${cr['Estado_Operativo'] || cr['Estado']}</span></div>

<div class="sep"></div>

<div class="center" style="font-size:7pt; margin-top:4px;">
  Gracias por su pago puntual.<br>
  Conserve este comprobante.<br>
  CredyFast — ${Utilities.formatDate(new Date(), CONFIG.TIMEZONE, 'yyyy')}
</div>

</body>
</html>`;
  }

  function _fmt(n) { return parseFloat(n || 0).toFixed(2); }

  return { generate };
})();
