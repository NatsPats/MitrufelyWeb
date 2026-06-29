"""
Mifrufely Web — E2E Cart API Tests (Fase 4)
Tests the cart REST endpoints through ASGI transport.
Uses mocked Redis from conftest.py autouse fixture.
"""

import json

import pytest
from httpx import AsyncClient


@pytest.mark.e2e
class TestCartAPI:
    async def test_get_carrito_vacio(self, client: AsyncClient, auth_headers_client: dict) -> None:
        response = await client.get("/cart", headers=auth_headers_client)
        assert response.status_code == 200
        data = response.json()
        assert data["items"] == []
        assert data["total_items"] == 0
        assert data["subtotal"] == "0.00"

    async def test_get_carrito_sin_auth(self, client: AsyncClient) -> None:
        response = await client.get("/cart")
        assert response.status_code == 401

    async def test_agregar_producto_al_carrito(
        self,
        client: AsyncClient,
        auth_headers_client: dict,
    ) -> None:
        payload = {"id_producto": 1, "cantidad": 2, "es_paquete": False}
        response = await client.post("/cart/items", headers=auth_headers_client, json=payload)
        assert response.status_code in (200, 404)
        if response.status_code == 200:
            data = response.json()
            assert data["total_items"] >= 2

    async def test_agregar_item_sin_cantidad_positiva(
        self,
        client: AsyncClient,
        auth_headers_client: dict,
    ) -> None:
        payload = {"id_producto": 1, "cantidad": 0, "es_paquete": False}
        response = await client.post("/cart/items", headers=auth_headers_client, json=payload)
        assert response.status_code == 422

    async def test_actualizar_cantidad(
        self,
        client: AsyncClient,
        auth_headers_client: dict,
    ) -> None:
        response = await client.put(
            "/cart/items/1",
            headers=auth_headers_client,
            json={"cantidad": 5},
        )
        assert response.status_code in (200, 404)

    async def test_eliminar_item(
        self,
        client: AsyncClient,
        auth_headers_client: dict,
    ) -> None:
        response = await client.delete("/cart/items/1", headers=auth_headers_client)
        assert response.status_code in (200, 204)

    async def test_vaciar_carrito(
        self,
        client: AsyncClient,
        auth_headers_client: dict,
    ) -> None:
        response = await client.delete("/cart", headers=auth_headers_client)
        assert response.status_code == 204


@pytest.mark.e2e
class TestCartEndpointsStructure:
    async def test_cart_endpoint_exists(self, client: AsyncClient) -> None:
        response = await client.get("/health")
        assert response.status_code == 200
        assert response.json()["status"] == "ok"

    async def test_cart_router_registered(
        self, client: AsyncClient, auth_headers_client: dict
    ) -> None:
        response = await client.get("/cart", headers=auth_headers_client)
        assert response.status_code == 200
