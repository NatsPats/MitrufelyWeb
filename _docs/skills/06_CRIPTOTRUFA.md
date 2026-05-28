# SKILL 06 — CriptoTrufa (Sistema de Fidelización)

> **CUÁNDO USAR:** Antes de implementar el módulo `criptotrufa`, cupones, consulta de puntos, o canjes.

---

## 1. Modelo de Negocio

**CriptoTrufa** es el programa de puntos de fidelización de Mytrufely:

- Los clientes acumulan puntos por cada compra pagada.
- Los puntos pueden canjearse para obtener cupones de descuento.
- Los cupones tienen fecha de expiración y son de uso único por venta.

---

## 2. Tablas Involucradas

| Tabla                       | Rol                                                                  |
| --------------------------- | -------------------------------------------------------------------- |
| `configuracion_recompensas` | Singleton activo. Define `tasa_conversion` y `dias_expiracion`.      |
| `movimientos_puntos`        | Ledger append-only de puntos (positivos y negativos).                |
| `cupones_maestro`           | Plantilla del cupón (porcentaje, costo en puntos, días de vigencia). |
| `cupones_cliente`           | Instancia única por cliente. `codigo_unico VARCHAR(20)`.             |
| `vw_saldo_puntos_cliente`   | Vista para saldo actual.                                             |

---

## 3. Acumulación de Puntos (Automática)

**El backend NO inserta en `movimientos_puntos` directamente para acumulación.**

La acumulación ocurre por el trigger `tg_ventas_otorgar_puntos` al ejecutar:

```python
await order_repo.update(venta_id, {"estado_pago": "PAGADO"})
```

**Fórmula del trigger:**

```python
puntos = FLOOR(venta.total * config.tasa_conversion)
# Ejemplo: total=S/.50, tasa=0.10 → 5 CriptoTrufas
```

El trigger también:

1. Inserta en `movimientos_puntos` con tipo `ACUMULACION_VENTA`
2. Actualiza `ventas.puntos_ganados`
3. Marca `cupones_cliente.estado = 'USADO'` si la venta usó cupón

---

## 4. Consulta de Saldo

### Vía Vista (recomendado para mostrar saldo al cliente)

```python
result = await session.execute(
    text("SELECT puntos_actuales FROM vw_saldo_puntos_cliente WHERE id_cliente = :id"),
    {"id": cliente_id}
)
saldo = result.scalar() or 0
```

### Vía función PL/pgSQL (para validaciones internas)

```python
result = await session.execute(
    text("SELECT fn_saldo_puntos_cliente(:id)"),
    {"id": cliente_id}
)
saldo = result.scalar()
```

---

## 5. Canje de Cupón (Backend sí ejecuta esto)

```http
POST /api/v1/cripto-trufa/redeem
{ id_cupon: <id_cupon_maestro> }
```

### Flujo del Service

```python
async def canjear_cupon(self, cliente_id: int, id_cupon: int) -> CuponClienteResponse:
    # 1. Obtener configuración activa
    config = await self._config_repo.get_active()
    # (llama internamente: SELECT fn_config_recompensas_activa())

    # 2. Obtener cupón maestro
    cupon = await self._cupon_maestro_repo.get_by_id(id_cupon)
    if not cupon or not cupon.estado:
        raise NotFoundError("Cupón no disponible")
    if not cupon.costo_puntos:
        raise BusinessRuleError("Este cupón no es canjeable con puntos")

    # 3. Verificar saldo
    saldo = await self.get_saldo(cliente_id)
    if saldo < cupon.costo_puntos:
        raise InsufficientCriptoTrufaError(
            f"Saldo insuficiente: {saldo} / {cupon.costo_puntos} requeridos"
        )

    # 4. Generar código único para el cupón del cliente
    codigo = _generate_coupon_code()  # e.g., uuid4()[:8].upper()

    async with self._session.begin():
        # 5. Debitar puntos (el trigger tg_movimientos_puntos_validar valida saldo negativo)
        await self._puntos_repo.create({
            "id_cliente": cliente_id,
            "id_cupon_cliente": None,   # se actualizará después
            "id_config": config.id_config,
            "tipo_movimiento": "COMPRA_CUPON",
            "cantidad": -cupon.costo_puntos,
            # saldo_puntos_resultante lo calcula el trigger
        })

        # 6. Crear cupón del cliente
        fecha_expiracion = datetime.now(UTC) + timedelta(days=cupon.dias_vigencia)
        cupon_cliente = await self._cupon_cliente_repo.create({
            "id_cliente": cliente_id,
            "id_cupon": id_cupon,
            "codigo_unico": codigo,
            "estado": "DISPONIBLE",
            "origen": "COMPRA_PUNTOS",
            "fecha_expiracion": fecha_expiracion,
        })

    return CuponClienteResponse.model_validate(cupon_cliente)
```

---

## 6. Tipos de Movimiento de Puntos (`tipo_movimiento_puntos_enum`)

| Tipo                | Efecto      | Generado por                                  |
| ------------------- | ----------- | --------------------------------------------- |
| `ACUMULACION_VENTA` | `+puntos`   | `tg_ventas_otorgar_puntos` (auto)             |
| `COMPRA_CUPON`      | `-puntos`   | Service `canjear_cupon`                       |
| `AJUSTE_ADMIN`      | `+/-puntos` | Service admin (reversa de anulación o ajuste) |
| `EXPIRACION`        | `-puntos`   | Celery `sp_expirar_cupones_vencidos`          |
| `PAGO_JUEGO`        | `-puntos`   | Módulo de juegos (futuro)                     |
| `PREMIO_JUEGO`      | `+puntos`   | Módulo de juegos (futuro)                     |

---

## 7. Expiración de Cupones (Celery)

```python
@celery_app.task(name="criptotrufa.expire_coupons")
async def expire_coupons_task():
    async with get_async_session() as session:
        result = await session.execute(text("SELECT sp_expirar_cupones_vencidos()"))
        count = result.scalar()
        logger.info("criptotrufa.coupons_expired", count=count)
    return count
```

**Trigger `tg_cupones_cliente_normalizar`** también normaliza el estado automáticamente en cada INSERT/UPDATE de `cupones_cliente`.

---

## 8. Configuración de Recompensas

### Solo debe existir UNA configuración activa

```sql
SELECT * FROM configuracion_recompensas WHERE estado = true ORDER BY id_config DESC LIMIT 1;
-- Función equivalente: SELECT fn_config_recompensas_activa()
```

### Campos relevantes

```python
class ConfigRecompensasResponse(BaseModel):
    id_config: int
    tasa_conversion: Decimal    # Puntos por cada S/. gastado (ej: 0.10 → 1 punto cada S/.10)
    limite_puntos_billetera: int # Máximo acumulable (futuro uso)
    dias_expiracion: int         # Días de validez de los puntos acumulados
    estado: bool
```

---

## 9. Schemas Pydantic de Referencia

```python
class CuponMaestroResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id_cupon: int
    nombre: str
    descripcion: str | None
    porcentaje_descuento: Decimal
    costo_puntos: int | None       # None si no es canjeable con puntos
    dias_vigencia: int
    estado: bool

class CuponClienteResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id_cupon_cliente: int
    codigo_unico: str
    estado: EstadoCuponEnum
    origen: OrigenCuponEnum
    fecha_adquisicion: datetime
    fecha_expiracion: datetime
    fecha_uso: datetime | None
    cupon: CuponMaestroResponse    # Nested

class MovimientoPuntosResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id_movimiento_punto: int
    tipo_movimiento: TipoMovimientoPuntosEnum
    cantidad: int                   # Positivo o negativo
    saldo_puntos_resultante: int
    fecha_movimiento: datetime
    justificacion: str | None
```

---

## 10. Endpoints del Módulo CriptoTrufa

| Método | Ruta                              | Rol     | Descripción                              |
| ------ | --------------------------------- | ------- | ---------------------------------------- |
| `GET`  | `/cripto-trufa/balance`           | CLIENTE | Saldo actual del cliente                 |
| `GET`  | `/cripto-trufa/history`           | CLIENTE | Historial de movimientos                 |
| `GET`  | `/cripto-trufa/coupons/available` | CLIENTE | Cupones maestro disponibles para canjear |
| `POST` | `/cripto-trufa/coupons/redeem`    | CLIENTE | Canjear cupón con puntos                 |
| `GET`  | `/cripto-trufa/coupons/mine`      | CLIENTE | Cupones propios del cliente              |
| `POST` | `/cripto-trufa/adjust`            | ADMIN   | Ajuste manual de puntos                  |
| `GET`  | `/cripto-trufa/config`            | ADMIN   | Ver configuración activa                 |
| `PUT`  | `/cripto-trufa/config`            | ADMIN   | Actualizar configuración                 |
