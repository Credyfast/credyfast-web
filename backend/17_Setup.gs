// ============================================================
// CredyFast — 17_Setup.gs
// Script de inicialización única del sistema.
// EJECUTAR UNA SOLA VEZ después de crear el Spreadsheet.
// ============================================================

/**
 * PASO 0 (opcional): Crea el Spreadsheet automáticamente.
 * Ejecutar si aún no tienes el ID del Spreadsheet.
 */
function crearSpreadsheet() {
  const ss = SpreadsheetApp.create('CredyFast_DB');
  const id = ss.getId();
  Logger.log('✅ Spreadsheet creado.');
  Logger.log('📋 ID: ' + id);
  Logger.log('🔗 URL: https://docs.google.com/spreadsheets/d/' + id + '/edit');
  Logger.log('👉 Copia el ID a CONFIG.SPREADSHEET_ID en 00_Config.gs');
}

/**
 * UTILIDAD: Genera el SHA-256 de una contraseña.
 * Cambia PASSWORD_A_HASHEAR y ejecuta esta función.
 * Pega el resultado en CONFIG.SUPER_USERS → passwordHash en 00_Config.gs.
 */
function getHash() {
  const PASSWORD_A_HASHEAR = 'Credyfast2026'; // ← cambia aquí

  const bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    PASSWORD_A_HASHEAR,
    Utilities.Charset.UTF_8
  );
  const hash = bytes.map(b => ('0' + (b & 0xFF).toString(16)).slice(-2)).join('');
  Logger.log('🔑 Contraseña: ' + PASSWORD_A_HASHEAR);
  Logger.log('🔐 SHA-256:    ' + hash);
}

/**
 * PASO 1: Crea todas las hojas con sus encabezados.
 * Ejecutar UNA SOLA VEZ. Si la hoja ya existe la respeta.
 */
function setupSistema() {
  if (!CONFIG.SPREADSHEET_ID || CONFIG.SPREADSHEET_ID === 'REEMPLAZAR_CON_ID_DE_TU_SPREADSHEET') {
    throw new Error('SPREADSHEET_ID no configurado. Ejecuta crearSpreadsheet() primero.');
  }

  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  Logger.log('=== CredyFast Setup iniciado ===');

  // ── Usuarios ──────────────────────────────────────────────
  _crearHoja(ss, CONFIG.SHEETS.USUARIOS, [
    'ID_Usuario', 'Username', 'Password_Hash', 'Nombre_Completo', 'Rol',
    'Activo', 'Fecha_Creacion', 'Creado_Por', 'Ultimo_Acceso', 'Notas',
  ]);

  // ── Productos ─────────────────────────────────────────────
  _crearHoja(ss, CONFIG.SHEETS.PRODUCTOS, [
    'IDProd',
    'Marca_temporal',
    'MARCA',
    'MODELO',
    'MOD_COMERCIAL',
    'NS',
    'RAM',
    'ALMACENAMIENTO',
    'COLOR',
    'COSTO_REAL',
    'COSTO_MOSTRADO',
    'PROVEEDOR',
    'Precio_de_contado',  // Auto: COSTO_MOSTRADO × 1.5
    'Estatus',            // DISPONIBLE / OCUPADO / VENDIDO
  ]);

  // ── Clientes ──────────────────────────────────────────────
  _crearHoja(ss, CONFIG.SHEETS.CLIENTES, [
    'IDCliente',
    'Marca_temporal',
    'Nombre_s',            // Nombre(s)
    'Apellido_paterno',
    'Apellido_materno',
    'IDMEX',               // Número de INE
    'Direccion',
    'Ubicacion',           // "lat,lng" capturado con Leaflet
    'CURP',
    'A_que_se_dedica',
    'Ingreso_semanal',
    'Gastos_semanales',
    'Nombre_completo',     // Auto: Nombre_s + Ap_pat + Ap_mat
    'Fecha_de_nacimiento', // Auto extraída de CURP
    'Edad',                // Auto calculada
    'Sexo',                // Auto de CURP (H→HOMBRE, M→MUJER)
    'INE_Frente_ID',       // Google Drive file ID — OBLIGATORIO
    'INE_Reverso_ID',      // Google Drive file ID — OBLIGATORIO
    'Comprobante_ID',      // Google Drive file ID — OBLIGATORIO
  ]);

  // ── Créditos ──────────────────────────────────────────────
  _crearHoja(ss, CONFIG.SHEETS.CREDITOS, [
    'IDCredito',
    'Marca_temporal',
    'IDCliente',           // FK → Clientes
    'IDProd',              // FK → Productos
    'Celular',             // Número actual del cliente
    'Nombre_referencia_1',
    'Numero_referencia_1',
    'Nombre_referencia_2',
    'Numero_referencia_2',
    'Nombre_cliente',      // Auto de Clientes.Nombre_completo
    'Periodo',             // 13 / 26 / 39 / 52
    'Enganche',            // Auto: round(COSTO_MOSTRADO × 0.20)
    'Pago_puntual',        // Auto: round(Precio_contado × % por periodo)
    'Pago_normal',         // Auto: round(Pago_puntual × 1.10)
    'Pago_moroso',         // Auto: round(Pago_normal × 1.10)
    'Semana_Recuperacion', // Auto: ceil((COSTO_REAL − Enganche) / Pago_puntual)
    'ESTATUS',             // PENDIENTE / APROBADO_EN_ESPERA / APROVADO / RECHAZADO / FINALIZADO
    'Fecha_de_inicio',     // Auto de Marca_temporal
    'NOTAS',
    'Aprobado_por',        // ID del Supervisor/SuperUsuario que aprobó
    'Foto_Entrega_ID',     // Drive file ID — foto cliente recibiendo producto
  ]);

  // ── Pagos ─────────────────────────────────────────────────
  _crearHoja(ss, CONFIG.SHEETS.PAGOS, [
    'IDPago',
    'IDCredito',           // FK → Creditos
    'Semana_num',          // 0 = Enganche, 1-N = pagos normales
    'Fecha_programada',
    'Fecha_pagada',
    'Monto_esperado',      // Monto que debería pagar (puntual/normal/moroso según fecha)
    'Monto_pagado',        // Acumula abonos parciales
    'Estatus_de_pago',     // POR COBRAR / PARCIAL / PUNTUAL / NORMAL / MOROSO / ATRASADO
    'Canal',               // CAJA / DOMICILIO
    'Registrado_por',      // ID del usuario que registró el último abono
  ]);

  // ── Caja ──────────────────────────────────────────────────
  _crearHoja(ss, CONFIG.SHEETS.CAJA, [
    'Marca_temporal',
    'Registro',            // INGRESO / EGRESO
    'Monto',               // Siempre positivo
    'Cliente',             // IDCliente, "Retiro de respaldo" o "Retiro de supervisor"
    'Tipo',                // Efectivo / Transferencia_o_deposito (INGRESO); Efectivo (EGRESO)
    'Canal',               // CAJA / DOMICILIO
    'Comentarios',
    'Registrado_por',      // ID del usuario
    'IDPago',              // FK opcional → Pagos
  ]);

  // ── Visitas de Cobranza ──────────────────────────────────
  _crearHoja(ss, CONFIG.SHEETS.VISITAS, [
    'IDVisita',
    'Marca_temporal',
    'IDCredito',
    'IDCliente',
    'Cobrador_ID',
    'Motivo',
    'Comentarios',
    'Fecha',
  ]);

  // ── Logs ──────────────────────────────────────────────────
  _crearHoja(ss, CONFIG.SHEETS.LOGS, [
    'ID_Log', 'Timestamp', 'Usuario_ID', 'Username',
    'Accion', 'Modulo', 'ID_Registro_Afectado',
    'Estado_Anterior', 'Estado_Nuevo', 'Resultado', 'Detalle_Error',
  ]);

  Logger.log('✅ Setup completado. Hojas creadas:');
  Object.values(CONFIG.SHEETS).forEach(s => Logger.log('   • ' + s));
}

// ── Helpers internos ──────────────────────────────────────────

function _crearHoja(ss, nombre, columnas) {
  let hoja = ss.getSheetByName(nombre);
  if (!hoja) {
    hoja = ss.insertSheet(nombre);
    Logger.log('📄 Hoja creada: ' + nombre);
  } else {
    Logger.log('⚠ Hoja ya existe (respetada): ' + nombre);
    return; // No sobreescribir si ya existe
  }
  // Escribir encabezados en fila 1
  hoja.getRange(1, 1, 1, columnas.length).setValues([columnas]);
  hoja.getRange(1, 1, 1, columnas.length).setFontWeight('bold');
  hoja.setFrozenRows(1);
}
