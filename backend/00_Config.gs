// ============================================================
// CredyFast — 00_Config.gs
// Configuración central. Editar con cuidado.
// ============================================================

const CONFIG = {
  // ── IDs de Google Sheets ─────────────────────────────────
  SPREADSHEET_ID: '1USTswX61DEXgyihzNHLFEQXFjg-Naqn5CJyyYvudtr4',

  // ── IDs de Google Drive ──────────────────────────────────
  DRIVE_ROOT_FOLDER_ID:      '1chITQgPiGJ-ufm4SAM4qdnEqqNbSK_Qa',
  DRIVE_CLIENTES_FOLDER_ID:  '19VpBJDyfogi8YpAwIzycJMgKB06csJdL',
  DRIVE_CREDITOS_FOLDER_ID:  '1O2ODXgqVazQbYnPE-UjllX5EtEG2ZloJ',
  DRIVE_PLANTILLAS_FOLDER_ID:'18-Pd815LzrfBMlY4oQsmDRlwfIFsLZQs',
  CONTRATO_TEMPLATE_ID:      '1rN7_ELfFvc7E0TLY3nl_iJL7QZVRfR_gkCCBAZD9emI',

  // ── Sesiones ─────────────────────────────────────────────
  SESSION_DURATION_HOURS: 8,
  SESSION_CACHE_PREFIX:   'sess_',

  // ── SuperUsuarios hardcoded ───────────────────────────────
  // NUNCA se pueden crear/editar/eliminar desde la UI
  SUPER_USERS: [
    { username: 'MauricioMC', passwordHash: 'f9b94a164f862eb097fe19095c3aa2e0026395db1fb8706e3dd92f02b83a87a3' }, // Credyfast2026
    { username: 'JesusDC',    passwordHash: 'f9b94a164f862eb097fe19095c3aa2e0026395db1fb8706e3dd92f02b83a87a3' }, // Credyfast2026
    { username: 'MartinMC',   passwordHash: 'f9b94a164f862eb097fe19095c3aa2e0026395db1fb8706e3dd92f02b83a87a3' }, // Credyfast2026
  ],

  // ── Roles ─────────────────────────────────────────────────
  ROLES: {
    SUPER_USUARIO: 'SuperUsuario',
    SUPERVISOR:    'Supervisor',
    VENDEDOR:      'Vendedor',
    CAJERO:        'Cajero',
    COBRANZA:      'Cobranza',
  },

  // ── Jerarquía de roles ────────────────────────────────────
  ROLE_LEVEL: {
    'SuperUsuario': 5,
    'Supervisor':   4,
    'Vendedor':     3,
    'Cajero':       2,
    'Cobranza':     1,
  },

  // ── Nombres de hojas ─────────────────────────────────────
  SHEETS: {
    USUARIOS:  'Usuarios',
    PRODUCTOS: 'Productos',
    CLIENTES:  'Clientes',
    CREDITOS:  'Creditos',
    PAGOS:     'Pagos',
    CAJA:      'Caja',
    VISITAS:   'Visitas',
    LOGS:      'Logs',
  },

  // ── Reglas de negocio — Créditos ─────────────────────────

  // ⚠ LÍMITE DE PRECIO para habilitar periodos extendidos (39 y 52 semanas).
  // Si COSTO_MOSTRADO <= este valor: solo 13 y 26 semanas disponibles.
  // Si COSTO_MOSTRADO >  este valor: 13, 26, 39 y 52 semanas disponibles.
  // CAMBIAR AQUÍ si el límite cambia en el futuro:
  LIMITE_PRECIO_PERIODOS: 8000,

  // Enganche = COSTO_MOSTRADO × este factor (redondeado)
  FACTOR_ENGANCHE: 0.20,

  // Porcentaje de Precio_de_contado por periodo (del Pago_puntual)
  PORCENTAJE_PAGO_PUNTUAL: {
    13: 0.07,
    26: 0.06,
    39: 0.05,
    52: 0.04,
  },

  // Precio_de_contado = COSTO_MOSTRADO × este factor
  FACTOR_PRECIO_CONTADO: 1.5,

  // Pago_normal  = Pago_puntual  × este factor (redondeado)
  FACTOR_PAGO_NORMAL: 1.10,

  // Pago_moroso  = Pago_normal   × este factor (redondeado)
  FACTOR_PAGO_MOROSO: 1.10,

  // ── Reglas de negocio — Pagos ─────────────────────────────

  // Días de gracia antes de considerar un pago como NORMAL
  // (0 = mismo día o antes es PUNTUAL; 1-7 = NORMAL; >7 = MOROSO)
  DIAS_GRACIA_NORMAL: 7,

  // ── Canal de pago ─────────────────────────────────────────
  CANAL: {
    CAJA:      'CAJA',
    DOMICILIO: 'DOMICILIO',
  },

  // ── Zona horaria ─────────────────────────────────────────
  TIMEZONE: 'America/Mexico_City',
};
