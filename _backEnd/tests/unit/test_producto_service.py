import pytest
from datetime import datetime
from unittest.mock import AsyncMock

from fastapi import UploadFile

from app.modules.products.service import ProductoService
from app.modules.products.schemas import ProductoCreate, ProductoUpdate
from app.infrastructure.database.models.catalogo import Producto


@pytest.fixture
def mock_repo():
    repo = AsyncMock()
    repo.is_nombre_duplicado = AsyncMock(return_value=False)
    repo.generate_unique_slug = AsyncMock(return_value="test-producto")
    
    # Mock create
    async def mock_create(entity):
        entity.id_producto = 1
        entity.stock_actual = 10
        if not hasattr(entity, 'stock_minimo') or entity.stock_minimo is None:
            entity.stock_minimo = 5
        entity.estado = True
        entity.fecha_creacion = datetime.now()
        entity.fecha_actualizacion = datetime.now()
        return entity
    repo.create = AsyncMock(side_effect=mock_create)
    
    # Mock update
    async def mock_update(entity):
        entity.fecha_actualizacion = datetime.now()
        return entity
    repo.update = AsyncMock(side_effect=mock_update)
    
    # Mock delete
    repo.exists = AsyncMock(return_value=True)
    repo.delete = AsyncMock(return_value=None)
    
    # Mock get_by_id
    async def mock_get_by_id(pk):
        return Producto(
            id_producto=pk,
            nombre="Torta de Chocolate",
            slug="test-producto",
            descripcion="Descripción test",
            ingredientes="Ingredientes test",
            alergenos="Ninguno",
            peso_gramos=500.0,
            precio=45.0,
            stock_minimo=5,
            stock_actual=10,
            imagen_url="https://res.cloudinary.com/demo/image/upload/v1/test.jpg",
            cloudinary_public_id="mitrufely/products/test-id",
            estado=True,
            fecha_creacion=datetime.now(),
            fecha_actualizacion=datetime.now()
        )
    repo.get_by_id = AsyncMock(side_effect=mock_get_by_id)
    
    # Mock get_paginated
    repo.get_paginated = AsyncMock(return_value=(1, []))
    
    return repo

@pytest.fixture
def mock_storage():
    storage = AsyncMock()
    storage.upload_image = AsyncMock(return_value={
        "secure_url": "https://res.cloudinary.com/demo/image/upload/v1/test.jpg",
        "public_id": "mitrufely/products/test-id"
    })
    storage.delete_image = AsyncMock(return_value=None)
    return storage

@pytest.fixture
def producto_service(mock_repo):
    return ProductoService(repo=mock_repo)

class TestProductoService:
    @pytest.mark.asyncio
    async def test_create_without_image_raises_error(self, producto_service):
        dto = ProductoCreate(
            nombre="Torta",
            precio=50.0,
        )
        with pytest.raises(NotImplementedError):
            await producto_service.create(dto)

    @pytest.mark.asyncio
    async def test_create_with_image_success(self, producto_service, mock_storage):
        dto = ProductoCreate(
            nombre="Torta de Chocolate",
            precio=45.0,
        )
        mock_file = AsyncMock(spec=UploadFile)
        mock_file.read = AsyncMock(return_value=b"fake-image-bytes")
        mock_file.filename = "torta.jpg"
        mock_file.content_type = "image/jpeg"

        res = await producto_service.create_with_image(dto, mock_file, mock_storage)

        assert res.nombre == "Torta de Chocolate"
        assert res.slug == "test-producto"
        assert res.imagen_url == "https://res.cloudinary.com/demo/image/upload/v1/test.jpg"
        assert res.cloudinary_public_id == "mitrufely/products/test-id"
        mock_storage.upload_image.assert_called_once()
        producto_service.repo.create.assert_called_once()

    @pytest.mark.asyncio
    async def test_create_with_image_db_fails_performs_cloudinary_rollback(self, producto_service, mock_storage):
        dto = ProductoCreate(nombre="Torta Fallo", precio=20.0)
        mock_file = AsyncMock(spec=UploadFile)
        mock_file.read = AsyncMock(return_value=b"fake-image-bytes")
        mock_file.filename = "fallo.jpg"
        mock_file.content_type = "image/jpeg"

        # Simulamos que la DB falla al crear
        producto_service.repo.create.side_effect = Exception("DB Error")

        with pytest.raises(Exception, match="DB Error"):
            await producto_service.create_with_image(dto, mock_file, mock_storage)

        # Verificamos que se haya intentado borrar de Cloudinary el public_id recién subido
        mock_storage.delete_image.assert_called_once_with("mitrufely/products/test-id")

    @pytest.mark.asyncio
    async def test_create_nombre_duplicado_raises_error(self, producto_service, mock_storage):
        dto = ProductoCreate(nombre="Duplicado", precio=10.0)
        producto_service.repo.is_nombre_duplicado.return_value = True

        with pytest.raises(ValueError, match="Ya existe un producto activo con ese nombre"):
            await producto_service.create_with_image(dto, None, mock_storage)

    @pytest.mark.asyncio
    async def test_update_with_image_success_deletes_old_image(self, producto_service, mock_storage):
        dto = ProductoUpdate(precio=50.0)
        
        mock_existing = Producto(
            id_producto=1,
            nombre="Original",
            slug="original",
            descripcion=None,
            ingredientes=None,
            alergenos=None,
            peso_gramos=None,
            precio=40.0,
            stock_minimo=0,
            stock_actual=5,
            imagen_url="http://old",
            cloudinary_public_id="old-public-id",
            estado=True,
            fecha_creacion=datetime.now(),
            fecha_actualizacion=datetime.now(),
        )
        producto_service.repo.get_by_id = AsyncMock(return_value=mock_existing)
        
        mock_file = AsyncMock(spec=UploadFile)
        mock_file.read = AsyncMock(return_value=b"new-image-bytes")
        mock_file.filename = "new.jpg"
        mock_file.content_type = "image/jpeg"

        res = await producto_service.update_with_image(1, dto, mock_file, mock_storage)

        assert res is not None
        mock_storage.upload_image.assert_called_once()
        # Se elimina la antigua si se sube una nueva
        mock_storage.delete_image.assert_called_once_with("old-public-id")
        
    @pytest.mark.asyncio
    async def test_disponibilidad_dinamica(self, producto_service):
        mock_existing = Producto(
            id_producto=1,
            nombre="Stock 0",
            slug="stock-0",
            descripcion=None,
            ingredientes=None,
            alergenos=None,
            peso_gramos=None,
            precio=10.0,
            stock_minimo=0,
            stock_actual=0,
            imagen_url=None,
            cloudinary_public_id=None,
            estado=True,
            fecha_creacion=datetime.now(),
            fecha_actualizacion=datetime.now(),
        )
        
        producto_service.repo.get_by_id = AsyncMock(return_value=mock_existing)
        
        res = await producto_service.get_by_id(1)
        assert res.disponible is False
        
        # Test activo pero estado False
        mock_existing.stock_actual = 10
        mock_existing.estado = False
        res = await producto_service.get_by_id(1)
        assert res.disponible is False
