// ============================================================
// CredyFast — 18_Archivos.gs
// Subida de archivos (fotos) a Google Drive.
// El frontend envía la imagen comprimida en base64.
// Retorna el fileId de Drive para guardar en la hoja.
// ============================================================

const Archivos = (() => {

  /**
   * Sube un archivo base64 a Google Drive.
   * Payload esperado: { base64: string, filename: string, folder: 'clientes'|'creditos' }
   * Respuesta:        { ok: true, fileId: string, fileUrl: string }
   */
  function upload(payload, ctx) {
    try {
      const { base64, filename, folder } = payload;

      if (!base64 || !filename) {
        throw { code: 'DATOS_INVALIDOS', message: 'base64 y filename son requeridos.' };
      }

      // Seleccionar carpeta de destino según el parámetro
      let folderId;
      if (folder === 'creditos') {
        folderId = CONFIG.DRIVE_CREDITOS_FOLDER_ID;
      } else {
        // Default: carpeta de clientes
        folderId = CONFIG.DRIVE_CLIENTES_FOLDER_ID;
      }

      const driveFolder = DriveApp.getFolderById(folderId);

      // Decodificar base64 → blob
      const decoded  = Utilities.base64Decode(base64);
      const blob     = Utilities.newBlob(decoded, 'image/jpeg', filename);

      // Subir a Drive
      const file     = driveFolder.createFile(blob);

      // Hacer el archivo accesible con enlace (para preview futuro)
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

      const fileId  = file.getId();
      const fileUrl = `https://drive.google.com/uc?id=${fileId}`;

      Logger.log(`Archivos.upload: subido ${filename} → ${fileId}`);

      return { ok: true, fileId, fileUrl };

    } catch (err) {
      Logger.log('Archivos.upload ERROR: ' + JSON.stringify(err));
      return handleError_(err);
    }
  }

  return { upload };

})();
