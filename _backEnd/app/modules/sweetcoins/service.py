"""
Mifrufely Web — Domain Service: CriptoTrufa / SweetCoins (Módulo M06)
Orchestrates business logic for customer loyalty and coupons.
"""

from datetime import datetime, timedelta, timezone
import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import (
    BusinessRuleError,
    CouponDisabledError,
    InsufficientSweetCoinsError,
    NotFoundError,
)
from app.infrastructure.database.models.cupones import CuponCliente, CuponMaestro
from app.infrastructure.database.models.enums import (
    EstadoCuponEnum,
    OrigenCuponEnum,
    TipoMovimientoPuntosEnum,
)
from app.infrastructure.database.models.recompensas import ConfiguracionRecompensas, MovimientoPuntos
from app.infrastructure.database.models.usuarios import Cliente
from app.modules.sweetcoins.repository import (
    IConfiguracionRecompensasRepository,
    ICuponClienteRepository,
    ICuponMaestroRepository,
    IMovimientoPuntosRepository,
)
from app.modules.sweetcoins.utils.coupon_code import generate_coupon_code

logger = structlog.get_logger(__name__)


class SweetCoinsService:
    """Servicio de dominio para la gestión del saldo de CriptoTrufas y cupones."""

    def __init__(
        self,
        session: AsyncSession,
        cupon_maestro_repo: ICuponMaestroRepository,
        cupon_cliente_repo: ICuponClienteRepository,
        puntos_repo: IMovimientoPuntosRepository,
        config_repo: IConfiguracionRecompensasRepository,
    ) -> None:
        self._session = session
        self._cupon_maestro_repo = cupon_maestro_repo
        self._cupon_cliente_repo = cupon_cliente_repo
        self._puntos_repo = puntos_repo
        self._config_repo = config_repo

    async def _resolve_cliente_id(self, id_usuario: int) -> int:
        """
        Resuelve el id_cliente de la tabla 'clientes' a partir de un id_usuario del JWT.
        Si el registro de cliente no existe (p. ej. un usuario recién registrado), lo crea.
        """
        stmt = select(Cliente).where(Cliente.id_usuario == id_usuario)
        result = await self._session.execute(stmt)
        cliente = result.scalars().first()
        if not cliente:
            cliente = Cliente(id_usuario=id_usuario)
            self._session.add(cliente)
            await self._session.flush()
            logger.info("sweetcoins.cliente_profile_auto_created", id_usuario=id_usuario, id_cliente=cliente.id_cliente)
        return cliente.id_cliente

    async def get_balance(self, id_usuario: int) -> int:
        """Obtiene el saldo actual de CriptoTrufas del cliente a partir de su id_usuario."""
        id_cliente = await self._resolve_cliente_id(id_usuario)
        return await self._puntos_repo.get_saldo(id_cliente)

    async def get_history(self, id_usuario: int, *, limit: int = 50) -> list[MovimientoPuntos]:
        """Obtiene el historial de movimientos de puntos del cliente a partir de su id_usuario."""
        id_cliente = await self._resolve_cliente_id(id_usuario)
        return await self._puntos_repo.get_history(id_cliente, limit=limit)

    async def get_available_coupons(self) -> list:
        """Obtiene la lista de cupones maestros habilitados y canjeables por puntos."""
        return await self._cupon_maestro_repo.get_available()

    async def get_my_coupons(self, id_usuario: int) -> list[CuponCliente]:
        """Obtiene todos los cupones adquiridos por el cliente a partir de su id_usuario."""
        id_cliente = await self._resolve_cliente_id(id_usuario)
        return await self._cupon_cliente_repo.get_all_by_cliente(id_cliente)

    async def get_dashboard(self, id_usuario: int) -> dict:
        """
        Consolida la información de fidelización en una sola llamada:
        saldo actual, cupones activos (DISPONIBLES) y los últimos 5 movimientos.
        """
        id_cliente = await self._resolve_cliente_id(id_usuario)
        saldo = await self._puntos_repo.get_saldo(id_cliente)
        cupones = await self._cupon_cliente_repo.get_active_by_cliente(id_cliente)
        historial = await self._puntos_repo.get_history(id_cliente, limit=5)
        
        return {
            "balance": saldo,
            "cupones_activos": cupones,
            "historial_reciente": historial
        }

    async def canjear_cupon(self, id_usuario: int, id_cupon: int, idempotency_key: str | None = None) -> CuponCliente:
        """
        Ejecuta el canje de un cupón maestro por puntos del cliente.
        Operación atómica controlada por lock pesimista de concurrencia.
        """
        # Resolver el ID del cliente
        id_cliente = await self._resolve_cliente_id(id_usuario)

        # 1. Obtener la configuración activa del sistema
        config = await self._config_repo.get_active()
        if not config:
            raise BusinessRuleError("El programa de recompensas no está activo en este momento.")

        # 2. Obtener y validar el cupón maestro (plantilla)
        cupon_maestro = await self._cupon_maestro_repo.get_by_id(id_cupon)
        if not cupon_maestro or not cupon_maestro.estado:
            raise CouponDisabledError("El cupón solicitado no está activo o no existe.")
        
        if cupon_maestro.costo_puntos is None or cupon_maestro.costo_puntos <= 0:
            raise BusinessRuleError("Este cupón no está configurado para ser canjeado por puntos.")

        # 3. Transacción atómica
        async with self._session.begin_nested():
            # Lock pesimista (SELECT FOR UPDATE) para obtener el saldo actual de forma segura
            saldo_actual = await self._puntos_repo.get_saldo_for_update(id_cliente)
            
            if saldo_actual < cupon_maestro.costo_puntos:
                raise InsufficientSweetCoinsError(
                    f"Saldo de CriptoTrufas insuficiente. Requiere {cupon_maestro.costo_puntos} pero tiene {saldo_actual}."
                )

            # Generar código único para el cupón
            codigo_unico = generate_coupon_code("MTR")
            
            # Registrar el movimiento de débito en movimientos_puntos
            movimiento = MovimientoPuntos(
                id_cliente=id_cliente,
                id_venta=None,
                id_cupon_cliente=None,  # Se asocia implícitamente o tras la inserción
                id_config=config.id_config,
                tipo_movimiento=TipoMovimientoPuntosEnum.COMPRA_CUPON,
                cantidad=-cupon_maestro.costo_puntos,
                saldo_puntos_resultante=saldo_actual - cupon_maestro.costo_puntos,
                justificacion=f"Canje de cupón: {cupon_maestro.nombre}"
            )
            await self._puntos_repo.create(movimiento)

            # Calcular la fecha de expiración
            fecha_expiracion = datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(days=cupon_maestro.dias_vigencia)

            # Crear el cupón del cliente
            cupon_cliente = CuponCliente(
                id_cliente=id_cliente,
                id_cupon=cupon_maestro.id_cupon,
                codigo_unico=codigo_unico,
                estado=EstadoCuponEnum.DISPONIBLE,
                origen=OrigenCuponEnum.COMPRA_PUNTOS,
                fecha_adquisicion=datetime.now(timezone.utc).replace(tzinfo=None),
                fecha_expiracion=fecha_expiracion
            )
            cupon_cliente = await self._cupon_cliente_repo.create(cupon_cliente)

        # 4. Registrar logs estructurados para auditoría
        logger.info(
            "coupon.redeemed",
            cliente_id=id_cliente,
            id_cupon=cupon_maestro.id_cupon,
            codigo_unico=codigo_unico,
            costo_puntos=cupon_maestro.costo_puntos,
            saldo_antes=saldo_actual,
            saldo_despues=saldo_actual - cupon_maestro.costo_puntos,
            idempotency_key=idempotency_key
        )

        # Refrescar relación para devolver la respuesta completa
        cupon_cliente.cupon_maestro = cupon_maestro
        return cupon_cliente

    async def adjust_points(
        self,
        id_cliente: int,
        cantidad: int,
        justificacion: str,
        admin_id: int,
        request_ip: str
    ) -> MovimientoPuntos:
        """
        Ajusta de manera manual el saldo de puntos de un cliente (acción exclusiva de administrador).
        Requiere justificación obligatoria y registra auditoría en los logs del sistema.
        """
        if cantidad == 0:
            raise BusinessRuleError("La cantidad del ajuste no puede ser cero.")

        # Validar si el cliente existe en la tabla de clientes
        stmt_cl = select(Cliente).where(Cliente.id_cliente == id_cliente)
        res_cl = await self._session.execute(stmt_cl)
        cliente_exists = res_cl.scalars().first() is not None
        if not cliente_exists:
            raise NotFoundError(f"Cliente con ID {id_cliente} no existe en el sistema.")

        config = await self._config_repo.get_active()
        if not config:
            raise BusinessRuleError("El programa de recompensas no está activo en este momento.")

        async with self._session.begin_nested():
            # Bloquear la fila para prevenir condiciones de carrera
            saldo_actual = await self._puntos_repo.get_saldo_for_update(id_cliente)
            
            saldo_resultante = saldo_actual + cantidad
            if saldo_resultante < 0:
                raise BusinessRuleError(
                    f"El ajuste causaría un saldo de puntos negativo ({saldo_resultante}). Operación cancelada."
                )

            movimiento = MovimientoPuntos(
                id_cliente=id_cliente,
                id_venta=None,
                id_cupon_cliente=None,
                id_config=config.id_config,
                tipo_movimiento=TipoMovimientoPuntosEnum.AJUSTE_ADMIN,
                cantidad=cantidad,
                saldo_puntos_resultante=saldo_resultante,
                justificacion=f"Ajuste Admin: {justificacion}"
            )
            movimiento = await self._puntos_repo.create(movimiento)

        # Registrar log estructurado auditado
        logger.info(
            "points.adjusted",
            cliente_id=id_cliente,
            admin_id=admin_id,
            ip=request_ip,
            cantidad=cantidad,
            saldo_antes=saldo_actual,
            saldo_despues=saldo_resultante,
            justificacion=justificacion
        )

        return movimiento

    # ── METODOS DE GESTION DE ADMINISTRACIÓN ─────────────────────────────────────

    async def get_clientes_con_saldo(self) -> list[dict]:
        """Obtiene la lista de todos los clientes con su saldo acumulado."""
        return await self._puntos_repo.get_todos_clientes_con_saldo()

    async def get_cliente_history_admin(self, id_cliente: int) -> list[MovimientoPuntos]:
        """Obtiene el historial de puntos de un cliente por su ID (uso admin)."""
        # Validar existencia del cliente
        stmt = select(Cliente).where(Cliente.id_cliente == id_cliente)
        res = await self._session.execute(stmt)
        if not res.scalars().first():
            raise NotFoundError(f"Cliente con ID {id_cliente} no encontrado.")
        return await self._puntos_repo.get_history(id_cliente)

    async def get_all_coupons_admin(self) -> list[CuponMaestro]:
        """Obtiene la lista de todos los cupones maestros sin filtros (activos e inactivos)."""
        return await self._cupon_maestro_repo.get_all(limit=100)

    async def create_cupon_maestro(self, dto) -> CuponMaestro:
        """Crea un nuevo cupón maestro en el catálogo."""
        from app.infrastructure.database.models.cupones import CuponMaestro as CuponMaestroModel
        
        # Validar si ya existe un cupón con el mismo nombre
        stmt = select(CuponMaestroModel).where(CuponMaestroModel.nombre == dto.nombre)
        res = await self._session.execute(stmt)
        if res.scalars().first():
            raise BusinessRuleError(f"Ya existe un cupón registrado con el nombre '{dto.nombre}'.")

        cupon = CuponMaestroModel(
            nombre=dto.nombre,
            descripcion=dto.descripcion,
            porcentaje_descuento=dto.porcentaje_descuento,
            costo_puntos=dto.costo_puntos,
            dias_vigencia=dto.dias_vigencia,
            estado=dto.estado,
            id_categoria=dto.id_categoria
        )
        return await self._cupon_maestro_repo.create(cupon)

    async def update_cupon_maestro(self, id_cupon: int, dto) -> CuponMaestro:
        """Actualiza un cupón maestro existente en el catálogo."""
        cupon = await self._cupon_maestro_repo.get_by_id(id_cupon)
        if not cupon:
            raise NotFoundError(f"Cupón maestro con ID {id_cupon} no encontrado.")

        cupon.nombre = dto.nombre
        cupon.descripcion = dto.descripcion
        cupon.porcentaje_descuento = dto.porcentaje_descuento
        cupon.costo_puntos = dto.costo_puntos
        cupon.dias_vigencia = dto.dias_vigencia
        cupon.estado = dto.estado
        cupon.id_categoria = dto.id_categoria

        return await self._cupon_maestro_repo.update(cupon)

    async def delete_cupon_maestro(self, id_cupon: int) -> None:
        """Desactiva un cupón maestro (borrado lógico)."""
        cupon = await self._cupon_maestro_repo.get_by_id(id_cupon)
        if not cupon:
            raise NotFoundError(f"Cupón maestro con ID {id_cupon} no encontrado.")
        
        await self._cupon_maestro_repo.delete(id_cupon)

    async def update_config_recompensas(self, dto) -> ConfiguracionRecompensas:
        """
        Actualiza la configuración de recompensas global y activa del sistema.
        Si no hay ninguna configuración activa, crea una. Si la hay, modifica la existente.
        """
        from app.infrastructure.database.models.recompensas import ConfiguracionRecompensas as ConfiguracionRecompensasModel
        config = await self._config_repo.get_active()
        if not config:
            config = ConfiguracionRecompensasModel(
                tasa_conversion=dto.tasa_conversion,
                limite_puntos_billetera=dto.limite_puntos_billetera,
                dias_expiracion=dto.dias_expiracion,
                estado=dto.estado
            )
            return await self._config_repo.create(config)
        else:
            config.tasa_conversion = dto.tasa_conversion
            config.limite_puntos_billetera = dto.limite_puntos_billetera
            config.dias_expiracion = dto.dias_expiracion
            config.estado = dto.estado
            return await self._config_repo.update(config)

    async def jugar_ruleta(self, id_usuario: int) -> dict:
        """
        Ejecuta la jugada en la ruleta del cliente.
        Costo: 50 CriptoTrufas.
        Lógica:
          - 50% probabilidad: mala_suerte (puntos = 0, cupon = None)
          - 30% probabilidad: puntos_extra (puntos = 100, cupon = None)
          - 20% probabilidad: cupon_sorpresa (puntos = 0, cupon = cupón maestro al azar de los disponibles)
        """
        import random
        
        id_cliente = await self._resolve_cliente_id(id_usuario)
        
        # 1. Obtener la configuración activa del sistema
        config = await self._config_repo.get_active()
        if not config:
            raise BusinessRuleError("El programa de recompensas no está activo en este momento.")

        COSTO_JUEGO = 50

        async with self._session.begin_nested():
            # Lock pesimista (SELECT FOR UPDATE) para obtener el saldo actual de forma segura
            saldo_actual = await self._puntos_repo.get_saldo_for_update(id_cliente)
            
            if saldo_actual < COSTO_JUEGO:
                raise BusinessRuleError(
                    f"Saldo de CriptoTrufas insuficiente. Requiere {COSTO_JUEGO} pero tiene {saldo_actual}."
                )

            # Registrar el movimiento de débito en movimientos_puntos
            mov_debito = MovimientoPuntos(
                id_cliente=id_cliente,
                id_venta=None,
                id_cupon_cliente=None,
                id_config=config.id_config,
                tipo_movimiento=TipoMovimientoPuntosEnum.PAGO_JUEGO,
                cantidad=-COSTO_JUEGO,
                saldo_puntos_resultante=saldo_actual - COSTO_JUEGO,
                justificacion="Jugada en Ruleta Dulce (Débito)"
            )
            await self._puntos_repo.create(mov_debito)
            
            saldo_actual = saldo_actual - COSTO_JUEGO
            
            # Generar resultado aleatorio
            rand = random.random()
            
            if rand < 0.50:
                # 50% - Mala suerte
                return {
                    "resultado": "mala_suerte",
                    "mensaje": "¡Mala suerte! Sigue intentando. 🍀",
                    "puntos_ganados": 0,
                    "cupon_ganado": None
                }
            elif rand < 0.80:
                # 30% - 100 puntos extra
                PREMIO_PTS = 100
                mov_premio = MovimientoPuntos(
                    id_cliente=id_cliente,
                    id_venta=None,
                    id_cupon_cliente=None,
                    id_config=config.id_config,
                    tipo_movimiento=TipoMovimientoPuntosEnum.PREMIO_JUEGO,
                    cantidad=PREMIO_PTS,
                    saldo_puntos_resultante=saldo_actual + PREMIO_PTS,
                    justificacion="Premio Ruleta: 100 CriptoTrufas"
                )
                await self._puntos_repo.create(mov_premio)
                
                return {
                    "resultado": "puntos_extra",
                    "mensaje": "¡Ganaste 100 CriptoTrufas extra! 🎉",
                    "puntos_ganados": PREMIO_PTS,
                    "cupon_ganado": None
                }
            else:
                # 20% - Cupón sorpresa al azar de los disponibles
                available_maestros = await self._cupon_maestro_repo.get_available()
                if not available_maestros:
                    # Si no hay cupones, otorgar premio de consolación de 100 puntos
                    PREMIO_PTS = 100
                    mov_premio = MovimientoPuntos(
                        id_cliente=id_cliente,
                        id_venta=None,
                        id_cupon_cliente=None,
                        id_config=config.id_config,
                        tipo_movimiento=TipoMovimientoPuntosEnum.PREMIO_JUEGO,
                        cantidad=PREMIO_PTS,
                        saldo_puntos_resultante=saldo_actual + PREMIO_PTS,
                        justificacion="Premio Ruleta: 100 CriptoTrufas (Consolación)"
                    )
                    await self._puntos_repo.create(mov_premio)
                    return {
                        "resultado": "puntos_extra",
                        "mensaje": "¡Ganaste 100 CriptoTrufas extra! 🎉",
                        "puntos_ganados": PREMIO_PTS,
                        "cupon_ganado": None
                    }
                
                # Escoger uno al azar
                chosen_maestro = random.choice(available_maestros)
                codigo_unico = generate_coupon_code("WIN")
                
                fecha_expiracion = datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(days=chosen_maestro.dias_vigencia)
                
                cupon_cliente = CuponCliente(
                    id_cliente=id_cliente,
                    id_cupon=chosen_maestro.id_cupon,
                    codigo_unico=codigo_unico,
                    estado=EstadoCuponEnum.DISPONIBLE,
                    origen=OrigenCuponEnum.PREMIO_JUEGO,
                    fecha_adquisicion=datetime.now(timezone.utc).replace(tzinfo=None),
                    fecha_expiracion=fecha_expiracion
                )
                await self._cupon_cliente_repo.create(cupon_cliente)
                cupon_cliente.cupon_maestro = chosen_maestro
                
                return {
                    "resultado": "cupon_sorpresa",
                    "mensaje": f"¡Premio Mayor! Ganaste un cupón para '{chosen_maestro.nombre}' — {chosen_maestro.porcentaje_descuento}% OFF 🏆",
                    "puntos_ganados": 0,
                    "cupon_ganado": cupon_cliente
                }
