# CredyFast — Fase 2: Diseño de la Capa de Datos

---

## 1. Convenciones Generales

| Convención | Detalle |
|---|---|
| Zona horaria | America/Mexico_City (UTC-6) |
| Formato fecha | ISO 8601: `YYYY-MM-DD HH:mm:ss` |
| Booleanos | `TRUE` / `FALSE` (texto, no 0/1) |
| Decimales | 2 lugares. Ej: `1250.00` |
| Nulos | Celda vacía (no "null", no "N/A") |
| Encabezados | Fila 1 congelada, sin espacios, sin acentos en nombre de columna |

---

## 2. Lógica de Generación de IDs

Todos los IDs se generan en GAS (Apps Script), nunca en el frontend.

```
Productos  → IDP + padding 5 dígitos  → IDP00001
Clientes   → IDC + padding 5 dígitos  → IDC00042
Créditos   → IDCR + padding 4 dígitos → IDCR0017
Pagos      → IDPG + padding 6 dígitos → IDPG000391
Movimientos Caja → MOV + timestamp ms → MOV1715123456789
Arqueos    → ARQ + timestamp ms       → ARQ1715123456789
Logs       → LOG + timestamp ms       → LOG1715123456789
```

**Algoritmo de secuencia (GAS):**
1. Leer última fila de la hoja correspondiente
2. Extraer parte numérica del último ID
3. Sumar 1, aplicar padding con `padStart()`
4. Prefijo + número = nuevo ID
5. Dentro de `LockService` para evitar duplicados en concurrencia

---

## 3. Modelo Financiero

### 3.1 Estructura de Precio

```
Precio_Contado    = Costo real del producto al cliente si paga de contado
Precio_Credito    = Precio_Contado × (1 + Tasa_Interes_Total)
Pago_Semanal      = Precio_Credito / Total_Semanas
Interes_Total_MXN = Precio_Credito - Precio_Contado
Utilidad_Bruta    = Precio_Credito - Costo_Producto
```

### 3.2 Base de Abono a Capital

```
Cuota_Capital_Base = Precio_Contado / Total_Semanas
```
- Aplicada desde la última semana hacia atrás
- Condición: primeras 10 semanas pagadas completamente
- El abono a capital reduce el saldo pendiente del principal

### 3.3 Cálculo de Utilidad por Crédito

Guardado como snapshot en `Creditos` al momento de aprobación:

```
Costo_Producto_Snapshot  (del producto en ese momento)
Precio_Contado_Snapshot
Precio_Credito_Snapshot
Margen_Bruto = Precio_Credito_Snapshot - Costo_Producto_Snapshot
```

---

## 4. Esquemas de Hojas

---

### 4.1 Hoja: `Usuarios`

| # | Columna | Tipo | Restricciones |
|---|---------|------|---------------|
| A | ID_Usuario | String | PK, formato UUID v4, único, no nulo |
| B | Username | String | Único, sin espacios, max 30 chars |
| C | Password_Hash | String | SHA-256 hex, 64 chars |
| D | Nombre_Completo | String | max 100 chars |
| E | Rol | Enum | SuperUsuario/Supervisor/Vendedor/Cajero/Cobranza |
| F | Activo | Boolean | Default TRUE |
| G | Fecha_Creacion | DateTime | Auto, no editable |
| H | Creado_Por | String | FK ID_Usuario, o "SYSTEM" para hardcoded |
| I | Ultimo_Acceso | DateTime | Actualizado en cada login |
| J | Notas | String | Opcional, max 200 chars |

**Validaciones GAS:**
- Username: solo alfanumérico + guión bajo
- Rol: valor exacto del enum
- No duplicar Username activo
- SuperUsuarios hardcoded no pueden ser editados desde UI

---

### 4.2 Hoja: `Productos`

| # | Columna | Tipo | Restricciones |
|---|---------|------|---------------|
| A | ID_Producto | String | PK, IDP##### |
| B | Nombre | String | max 100 chars, no nulo |
| C | Descripcion | String | max 300 chars, opcional |
| D | Categoria | String | Electrodoméstico/Electrónico/Mueble/Otro |
| E | Marca | String | max 50 chars |
| F | Modelo | String | max 50 chars |
| G | Costo_Producto | Number | Precio de compra/costo real, ≥ 0 |
| H | Precio_Contado | Number | Precio venta contado, > Costo_Producto |
| I | Precio_Credito | Number | Precio venta crédito, > Precio_Contado |
| J | Total_Semanas | Number | Entero, 4–104 |
| K | Pago_Semanal | Number | Calculado: Precio_Credito / Total_Semanas |
| L | Tasa_Interes_Implicita | Number | (Precio_Credito-Precio_Contado)/Precio_Contado |
| M | Stock_Disponible | Number | Entero ≥ 0 |
| N | Stock_Minimo | Number | Entero ≥ 0, alerta si Stock ≤ Stock_Minimo |
| O | Numero_Serie | String | Opcional, para electrónicos |
| P | Proveedor | String | max 100 chars |
| Q | Activo | Boolean | Default TRUE |
| R | Fecha_Creacion | DateTime | Auto |
| S | Creado_Por | String | FK ID_Usuario |
| T | Fecha_Modificacion | DateTime | Auto-update |
| U | Modificado_Por | String | FK ID_Usuario |
| V | Imagen_Drive_ID | String | ID archivo Drive, opcional |

**Validaciones GAS:**
- `Precio_Credito` > `Precio_Contado` > `Costo_Producto` — orden estricto
- `Total_Semanas` entre 4 y 104
- `Pago_Semanal` recalculado automáticamente en GAS, no editable directo
- No desactivar producto si tiene créditos en estado ACTIVO

---

### 4.3 Hoja: `Clientes`

| # | Columna | Tipo | Restricciones |
|---|---------|------|---------------|
| A | ID_Cliente | String | PK, IDC##### |
| B | Nombre | String | max 60 chars, no nulo |
| C | Apellido_Paterno | String | max 40 chars, no nulo |
| D | Apellido_Materno | String | max 40 chars, opcional |
| E | CURP | String | 18 chars, único, formato validado |
| F | Fecha_Nacimiento | Date | YYYY-MM-DD, edad 18–80 |
| G | Sexo | Enum | M/F |
| H | Telefono_Principal | String | 10 dígitos |
| I | Telefono_Secundario | String | 10 dígitos, opcional |
| J | Calle_Numero | String | max 100 chars |
| K | Colonia | String | max 80 chars |
| L | Ciudad | String | max 60 chars |
| M | Estado | String | max 40 chars |
| N | CP | String | 5 dígitos |
| O | Coordenadas_Lat | Number | -90 a 90, opcional |
| P | Coordenadas_Lng | Number | -180 a 180, opcional |
| Q | Ref1_Nombre | String | max 100 chars |
| R | Ref1_Telefono | String | 10 dígitos |
| S | Ref1_Relacion | String | Familiar/Amigo/Vecino/Otro |
| T | Ref2_Nombre | String | max 100 chars |
| U | Ref2_Telefono | String | 10 dígitos |
| V | Ref2_Relacion | String | Familiar/Amigo/Vecino/Otro |
| W | Drive_Folder_ID | String | ID carpeta Drive del cliente |
| X | INE_Frente_ID | String | ID archivo Drive |
| Y | INE_Reverso_ID | String | ID archivo Drive |
| Z | Comprobante_ID | String | ID archivo Drive |
| AA | Documentos_Completos | Boolean | TRUE si los 3 docs están cargados |
| AB | Vendedor_ID | String | FK ID_Usuario |
| AC | Fecha_Registro | DateTime | Auto |
| AD | Activo | Boolean | Default TRUE |
| AE | Notas | String | max 300 chars, opcional |

**Validaciones GAS:**
- CURP: regex `/^[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]\d$/`
- Teléfono: regex `/^\d{10}$/`
- Edad calculada en GAS desde Fecha_Nacimiento
- `Documentos_Completos` actualizado automáticamente al subir cada doc

---

### 4.4 Hoja: `Creditos`

| # | Columna | Tipo | Restricciones |
|---|---------|------|---------------|
| A | ID_Credito | String | PK, IDCR#### |
| B | ID_Cliente | String | FK IDC#####, no nulo |
| C | ID_Producto | String | FK IDP#####, no nulo |
| D | Estado | Enum | PENDIENTE/APROBADO/RECHAZADO/ACTIVO/FINALIZADO/INCONCLUSO |
| E | Estado_Operativo | Enum | AL_CORRIENTE/ATRASO_LEVE/ATRASO_CRITICO (derivado, actualizado por GAS) |
| F | Fecha_Solicitud | DateTime | Auto al crear |
| G | Fecha_Aprobacion | DateTime | Al aprobar |
| H | Fecha_Inicio | Date | Primer vencimiento (regla calendario) |
| I | Fecha_Fin_Estimada | Date | Fecha_Inicio + (Total_Semanas × 7 días) |
| J | Precio_Contado_Snap | Number | Snapshot de Productos.Precio_Contado |
| K | Precio_Credito_Snap | Number | Snapshot de Productos.Precio_Credito |
| L | Costo_Producto_Snap | Number | Snapshot de Productos.Costo_Producto |
| M | Total_Semanas | Number | Snapshot |
| N | Pago_Semanal | Number | Snapshot |
| O | Cuota_Capital_Base | Number | Precio_Contado_Snap / Total_Semanas |
| P | Semanas_Pagadas | Number | Cuotas con Monto_Pagado >= Monto_Esperado |
| Q | Semanas_Con_Interes | Number | Cuotas REGULAR completadas (para validar 10 min) |
| R | Monto_Total_Pagado | Number | Suma de todos los Monto_Pagado |
| S | Saldo_Pendiente | Number | Precio_Credito_Snap - Monto_Total_Pagado |
| T | Vendedor_ID | String | FK ID_Usuario |
| U | Aprobado_Por | String | FK ID_Usuario |
| V | Rechazado_Por | String | FK ID_Usuario |
| W | Motivo_Rechazo | String | max 200 chars |
| X | Drive_Folder_ID | String | ID carpeta Drive del crédito |
| Y | Contrato_PDF_ID | String | ID archivo Drive |
| Z | Entrega_Foto_ID | String | ID archivo Drive |
| AA | Notas | String | max 300 chars |

**Validaciones GAS:**
- Solo un crédito ACTIVO por cliente a la vez (validar antes de aprobar)
- Transiciones de estado permitidas:
  - `PENDIENTE` → `APROBADO` | `RECHAZADO`
  - `APROBADO` → `ACTIVO` (al generar el calendario de pagos)
  - `ACTIVO` → `FINALIZADO` | `INCONCLUSO`
  - Ninguna otra transición válida
- `Semanas_Con_Interes` y `Semanas_Pagadas` actualizados por Motor de Pagos

---

### 4.5 Hoja: `Pagos`

| # | Columna | Tipo | Restricciones |
|---|---------|------|---------------|
| A | ID_Pago | String | PK, IDPG###### |
| B | ID_Credito | String | FK IDCR####, no nulo |
| C | ID_Cliente | String | FK IDC##### (desnormalizado para queries rápidas) |
| D | Num_Semana | Number | Entero 1..N, único por ID_Credito |
| E | Fecha_Vencimiento | Date | Calculada al aprobar crédito |
| F | Monto_Esperado | Number | Pago_Semanal del crédito. **INMUTABLE** |
| G | Monto_Pagado | Number | Acumulado. Default 0.00 |
| H | Estado_Pago | Enum | POR COBRAR/PUNTUAL/NORMAL/MOROSO/ATRASADO |
| I | Es_Parcial | Boolean | Monto_Pagado>0 AND Monto_Pagado<Monto_Esperado |
| J | Tipo_Pago | Enum | REGULAR/CAPITAL. Default REGULAR |
| K | Fecha_Primer_Abono | DateTime | Primera vez que se registró dinero |
| L | Fecha_Ultimo_Abono | DateTime | Última vez que se registró dinero |
| M | Canal_Cobro | Enum | CAJA/CAMPO |
| N | Registrado_Por | String | FK ID_Usuario |
| O | Confirmado_Por | String | FK ID_Usuario (si CAMPO, quién confirmó en caja) |
| P | Notas | String | max 200 chars |

**Validaciones GAS:**
- `Monto_Esperado` nunca se modifica después de creado
- `Estado_Pago` solo cambia via Motor de Pagos, nunca edición directa
- `Num_Semana` es único dentro del mismo `ID_Credito`
- Al crear el calendario: N filas, `Monto_Pagado=0`, `Estado_Pago=POR COBRAR`

---

### 4.6 Hoja: `Caja`

| # | Columna | Tipo | Restricciones |
|---|---------|------|---------------|
| A | ID_Movimiento | String | PK, MOV+timestamp |
| B | Tipo | Enum | INGRESO_PAGO/INGRESO_CONTADO/RETIRO/APERTURA_CAJA |
| C | Monto | Number | > 0 siempre. Retiros también positivos (tipo define dirección) |
| D | ID_Referencia | String | FK ID_Credito o ID_Pago según Tipo |
| E | Concepto | String | max 200 chars |
| F | Saldo_Anterior | Number | Calculado por GAS antes de insertar |
| G | Saldo_Posterior | Number | Saldo_Anterior +/- Monto según Tipo |
| H | Registrado_Por | String | FK ID_Usuario |
| I | Autorizado_Por | String | FK ID_Usuario (solo RETIRO) |
| J | Fecha | DateTime | Auto |
| K | Estado | Enum | PENDIENTE_DEPOSITO/CONFIRMADO (para pagos CAMPO) |

**Regla de saldo:** `Saldo_Posterior` del último registro = saldo actual de caja. El saldo nunca se almacena en una celda separada, siempre se calcula desde el último movimiento.

---

### 4.7 Hoja: `Arqueos_Caja`

| # | Columna | Tipo | Restricciones |
|---|---------|------|---------------|
| A | ID_Arqueo | String | PK, ARQ+timestamp |
| B | Fecha | DateTime | Auto |
| C | Realizado_Por | String | FK ID_Usuario |
| D | Supervisado_Por | String | FK ID_Usuario, opcional |
| E | Saldo_Sistema | Number | Último Saldo_Posterior de Caja al momento |
| F | Billetes_1000 | Number | Entero ≥ 0 |
| G | Billetes_500 | Number | Entero ≥ 0 |
| H | Billetes_200 | Number | Entero ≥ 0 |
| I | Billetes_100 | Number | Entero ≥ 0 |
| J | Billetes_50 | Number | Entero ≥ 0 |
| K | Monedas_20 | Number | Entero ≥ 0 |
| L | Monedas_10 | Number | Entero ≥ 0 |
| M | Monedas_5 | Number | Entero ≥ 0 |
| N | Monedas_2 | Number | Entero ≥ 0 |
| O | Monedas_1 | Number | Entero ≥ 0 |
| P | Monedas_050 | Number | Entero ≥ 0 |
| Q | Total_Fisico | Number | Calculado en GAS (suma ponderada) |
| R | Diferencia | Number | Total_Fisico - Saldo_Sistema |
| S | Resultado | Enum | CORRECTO/SOBRANTE/FALTANTE |

**Regla de negocio:** La UI nunca muestra `Diferencia` en pesos, solo el `Resultado` enum.

---

### 4.8 Hoja: `Logs`

| # | Columna | Tipo | Restricciones |
|---|---------|------|---------------|
| A | ID_Log | String | PK, LOG+timestamp |
| B | Timestamp | DateTime | Auto, microsegundos si posible |
| C | Usuario_ID | String | FK ID_Usuario |
| D | Username | String | Desnormalizado para lectura rápida |
| E | Accion | String | Enum de acciones definidas (ver tabla abajo) |
| F | Modulo | String | AUTH/CLIENTES/CREDITOS/PAGOS/CAJA/PRODUCTOS/USUARIOS |
| G | ID_Registro_Afectado | String | ID del objeto modificado |
| H | Estado_Anterior | String | JSON serializado del estado previo |
| I | Estado_Nuevo | String | JSON serializado del estado nuevo |
| J | IP_Origen | String | IP del cliente (header de GAS) |
| K | Resultado | Enum | EXITO/ERROR |
| L | Detalle_Error | String | Solo si Resultado=ERROR |

**Acciones auditables:**
`LOGIN`, `LOGOUT`, `SESSION_EXPIRE`, `CLIENTE_CREAR`, `CLIENTE_EDITAR`, `CREDITO_SOLICITAR`, `CREDITO_APROBAR`, `CREDITO_RECHAZAR`, `PAGO_REGISTRAR`, `PAGO_CAMPO`, `PAGO_CONFIRMAR`, `CAJA_RETIRO`, `CAJA_APERTURA`, `ARQUEO_REALIZAR`, `PRODUCTO_CREAR`, `PRODUCTO_EDITAR`, `USUARIO_CREAR`, `USUARIO_DESACTIVAR`, `CONTRATO_GENERAR`

---

### 4.9 Hoja: `Score_Cliente`

| # | Columna | Tipo | Restricciones |
|---|---------|------|---------------|
| A | ID_Cliente | String | PK+FK IDC#####, una fila por cliente |
| B | Total_Creditos | Number | Entero ≥ 0 |
| C | Creditos_Completados | Number | Estado FINALIZADO |
| D | Creditos_Inconclusos | Number | Estado INCONCLUSO |
| E | Creditos_Activos | Number | Estado ACTIVO |
| F | Total_Pagos | Number | Filas en Pagos con Monto_Pagado > 0 |
| G | Pagos_Puntuales | Number | Estado_Pago = PUNTUAL |
| H | Pagos_Normales | Number | Estado_Pago = NORMAL |
| I | Pagos_Morosos | Number | Estado_Pago = MOROSO |
| J | Pagos_Parciales | Number | Es_Parcial = TRUE al cierre |
| K | Semanas_Atraso_Acumuladas | Number | Total días de atraso / 7 |
| L | Score_Raw | Number | 0.00–100.00 calculado por GAS |
| M | Clasificacion | Enum | EXCELENTE/BUENO/REGULAR/RIESGOSO |
| N | Ultima_Actualizacion | DateTime | |

**Fórmula de Score (en GAS):**
```
base = 50
+ (Pagos_Puntuales / Total_Pagos) × 30       → máx +30
+ (Creditos_Completados / Total_Creditos) × 15 → máx +15
- (Pagos_Morosos / Total_Pagos) × 25          → máx -25
- (Creditos_Inconclusos / Total_Creditos) × 20 → máx -20
- min(Semanas_Atraso_Acumuladas × 0.5, 10)    → máx -10
= Score_Raw (clampeado a 0–100)

Clasificacion:
  80–100 → EXCELENTE
  60–79  → BUENO
  40–59  → REGULAR
  0–39   → RIESGOSO
```

---

## 5. Relaciones entre Tablas

```
Usuarios ──┬──< Clientes.Vendedor_ID
           ├──< Creditos.Vendedor_ID
           ├──< Creditos.Aprobado_Por
           ├──< Pagos.Registrado_Por
           ├──< Caja.Registrado_Por
           └──< Logs.Usuario_ID

Clientes ──┬──< Creditos.ID_Cliente
           ├──< Pagos.ID_Cliente (desnorm)
           └──1 Score_Cliente.ID_Cliente

Productos ─── < Creditos.ID_Producto

Creditos ──┬──< Pagos.ID_Credito
           └──< Caja.ID_Referencia (INGRESO_PAGO)
```

---

## 6. Algoritmo de Generación del Calendario de Pagos

Se ejecuta en GAS al aprobar un crédito. Genera N filas en `Pagos`.

### 6.1 Cálculo de Fecha_Inicio

```
dia_semana = getDayOfWeek(Fecha_Aprobacion)
// 0=Domingo, 1=Lunes, 2=Martes, 3=Miércoles, 4=Jueves, 5=Viernes, 6=Sábado

si dia_semana ∈ {1, 2, 3}:  // Lun-Mié
    Fecha_Inicio = próximo [mismo día de semana] en 7 días

si dia_semana ∈ {4, 5}:     // Jue-Vie
    Fecha_Inicio = próximo Lunes + 7 días (siguiente-siguiente Lunes)

si dia_semana ∈ {0, 6}:     // Sáb-Dom
    Fecha_Inicio = próximo Martes + 7 días (siguiente-siguiente Martes)
```

### 6.2 Generación de Filas

```
Para i = 1 hasta Total_Semanas:
    ID_Pago      = generarID('PAGOS')
    ID_Credito   = ID del crédito aprobado
    ID_Cliente   = ID del cliente
    Num_Semana   = i
    Fecha_Vencimiento = Fecha_Inicio + (i - 1) × 7 días
    Monto_Esperado    = Pago_Semanal (snapshot del crédito)
    Monto_Pagado      = 0.00
    Estado_Pago       = 'POR COBRAR'
    Es_Parcial        = FALSE
    Tipo_Pago         = 'REGULAR'
    [demás campos vacíos]
    
    insertarFila(PAGOS, fila)
```

### 6.3 Actualización del Crédito post-generación

```
Creditos[ID_Credito]:
  Estado            = 'ACTIVO'
  Fecha_Inicio      = Fecha_Inicio calculada
  Fecha_Fin_Estimada = Fecha_Inicio + (Total_Semanas - 1) × 7 días
  Saldo_Pendiente   = Precio_Credito_Snap
  Semanas_Pagadas   = 0
  Semanas_Con_Interes = 0
```

---

## 7. Reglas de Validación Transversales

| Regla | Implementación |
|-------|----------------|
| Un cliente solo puede tener 1 crédito ACTIVO | Verificar en GAS antes de `credit_approve` |
| No aprobar si `Documentos_Completos = FALSE` | Verificar antes de `credit_approve` |
| No editar `Monto_Esperado` en Pagos | Hoja protegida + validación en GAS |
| No crear SuperUsuario desde UI | Verificar rol del creador en `user_create` |
| `Precio_Credito > Precio_Contado > Costo_Producto` | Validar en `product_create` y `product_edit` |
| Concurrencia en pagos | `LockService.getScriptLock()` por operación |
| Logs son inmutables | Hoja solo-append, sin endpoints de edición/borrado |
| Contraseñas hasheadas | SHA-256 en frontend antes de enviar, verificar en GAS |

---

## 8. Configuración de Protección en Sheets

| Hoja | Tipo de Protección |
|------|--------------------|
| `Usuarios` | Solo editable por GAS (Service Account) |
| `Pagos` | Columnas A–F protegidas (solo GAS puede escribir) |
| `Logs` | Solo append via GAS, sin edición permitida |
| `Arqueos_Caja` | Solo append via GAS |
| `Score_Cliente` | Solo GAS |
| `Creditos` | Columnas de estado protegidas, solo GAS |

---

> [!IMPORTANT]
> **Listo para Fase 3.** Con este diseño de datos, el siguiente paso es implementar:
> 1. La estructura exacta de Google Sheets (crear las hojas con sus columnas)
> 2. El backend GAS: `doPost`, autenticación, y el Motor de Pagos
>
> ¿Confirmado para avanzar a Fase 3 (Backend — Google Apps Script)?
