// ============================================================
// CredyFast — 12_Contratos.gs
// Generación de Contratos PDF desde plantilla Google Docs.
// Plantilla única por ahora (configurable en CONFIG).
// ============================================================

const Contratos = (() => {

  /**
   * Genera el contrato PDF para un crédito ACTIVO.
   * Copia la plantilla, reemplaza variables {{campo}} y exporta a PDF.
   * Guarda el PDF en la carpeta del crédito en Drive.
   */
  function generate(payload, ctx) {
    try {
      requireRole_(ctx.user.rol, CONFIG.ROLES.SUPERVISOR);
      const { idCredito } = payload;
      if (!idCredito) throw { code: 'DATOS_INVALIDOS', message: 'idCredito requerido.' };

      // Cargar crédito
      const crFound = SheetHelper.findOne(CONFIG.SHEETS.CREDITOS, r => r['ID_Credito'] === idCredito);
      if (!crFound) throw { code: 'NO_ENCONTRADO', message: 'Crédito no encontrado.' };
      const cr = crFound.data;

      if (cr['Estado'] !== 'ACTIVO') throw { code: 'ESTADO_INVALIDO', message: 'Solo se generan contratos de créditos ACTIVOS.' };
      if (!cr['Drive_Folder_ID']) throw { code: 'CARPETA_INVALIDA', message: 'El crédito no tiene carpeta en Drive.' };

      // Cargar cliente
      const clFound = SheetHelper.findOne(CONFIG.SHEETS.CLIENTES, r => r['ID_Cliente'] === cr['ID_Cliente']);
      if (!clFound) throw { code: 'CLIENTE_NO_ENCONTRADO', message: 'Cliente del crédito no encontrado.' };
      const cl = clFound.data;

      // Cargar producto
      const prodFound = SheetHelper.findOne(CONFIG.SHEETS.PRODUCTOS, r => r['ID_Producto'] === cr['ID_Producto']);
      const prod = prodFound ? prodFound.data : {};

      // Variables del contrato
      const variables = _buildVariables(cr, cl, prod);

      // Copiar plantilla y reemplazar variables
      const templateFile = DriveApp.getFileById(CONFIG.CONTRATO_TEMPLATE_ID);
      const carpeta      = DriveApp.getFolderById(cr['Drive_Folder_ID']);
      const copia        = templateFile.makeCopy('contrato_' + idCredito, carpeta);
      const doc          = DocumentApp.openById(copia.getId());
      const body         = doc.getBody();

      Object.entries(variables).forEach(([key, value]) => {
        body.replaceText(`{{${key}}}`, value || '');
      });

      doc.saveAndClose();

      // Exportar a PDF
      const pdfBlob   = DriveApp.getFileById(copia.getId()).getAs('application/pdf');
      pdfBlob.setName('contrato_' + idCredito + '.pdf');
      const pdfFile   = carpeta.createFile(pdfBlob);
      const pdfId     = pdfFile.getId();

      // Eliminar la copia del Docs (ya no necesaria)
      copia.setTrashed(true);

      // Guardar ID del PDF en el crédito
      SheetHelper.updateRow(CONFIG.SHEETS.CREDITOS, crFound.rowIndex, { 'Contrato_PDF_ID': pdfId });

      _log(ctx, 'CONTRATO_GENERAR', idCredito, { pdfId }, 'EXITO');

      // Devolver URL de descarga directa del PDF
      const downloadUrl = `https://drive.google.com/uc?export=download&id=${pdfId}`;
      return { ok: true, pdfId, downloadUrl, message: 'Contrato generado correctamente.' };

    } catch (err) { return handleError_(err); }
  }

  // ── Construcción de variables para la plantilla ───────────

  function _buildVariables(cr, cl, prod) {
    const fecha = Utilities.formatDate(new Date(), CONFIG.TIMEZONE, 'dd/MM/yyyy');
    return {
      // Cliente
      'NOMBRE_COMPLETO':  (cl['Nombre'] || '') + ' ' + (cl['Apellido_Paterno'] || '') + ' ' + (cl['Apellido_Materno'] || ''),
      'CURP':             cl['CURP'] || '',
      'TELEFONO':         cl['Telefono_Principal'] || '',
      'DIRECCION':        (cl['Calle_Numero'] || '') + ', ' + (cl['Colonia'] || '') + ', ' + (cl['Ciudad'] || ''),
      // Crédito
      'ID_CREDITO':       cr['ID_Credito'],
      'FECHA_CONTRATO':   fecha,
      'FECHA_INICIO':     cr['Fecha_Inicio'] || '',
      'FECHA_FIN':        cr['Fecha_Fin_Estimada'] || '',
      // Producto
      'NOMBRE_PRODUCTO':  prod['Nombre'] || '',
      'MARCA':            prod['Marca'] || '',
      'MODELO':           prod['Modelo'] || '',
      'NUMERO_SERIE':     prod['Numero_Serie'] || '',
      // Financiero
      'PRECIO_CONTADO':   _fmt(cr['Precio_Contado_Snap']),
      'PRECIO_CREDITO':   _fmt(cr['Precio_Credito_Snap']),
      'PAGO_SEMANAL':     _fmt(cr['Pago_Semanal']),
      'TOTAL_SEMANAS':    String(cr['Total_Semanas']),
      'INTERES_TOTAL':    _fmt(parseFloat(cr['Precio_Credito_Snap'] || 0) - parseFloat(cr['Precio_Contado_Snap'] || 0)),
      // Referencias
      'REF1_NOMBRE':      cl['Ref1_Nombre'] || '',
      'REF1_TELEFONO':    cl['Ref1_Telefono'] || '',
      'REF2_NOMBRE':      cl['Ref2_Nombre'] || '',
      'REF2_TELEFONO':    cl['Ref2_Telefono'] || '',
    };
  }

  function _fmt(n) { return '$' + parseFloat(n || 0).toFixed(2); }
  function _now() { return Utilities.formatDate(new Date(), CONFIG.TIMEZONE, 'yyyy-MM-dd HH:mm:ss'); }

  function _log(ctx, accion, id, detalle, resultado) {
    try {
      SheetHelper.insertRow(CONFIG.SHEETS.LOGS, {
        'ID_Log': 'LOG' + Date.now(), 'Timestamp': _now(),
        'Usuario_ID': ctx.user.id || '', 'Username': ctx.user.username || '',
        'Accion': accion, 'Modulo': 'CONTRATOS', 'ID_Registro_Afectado': id,
        'Estado_Anterior': '', 'Estado_Nuevo': JSON.stringify(detalle),
        'IP_Origen': ctx.ip || '', 'Resultado': resultado, 'Detalle_Error': '',
      });
    } catch(_) {}
  }

  return { generate };
})();
