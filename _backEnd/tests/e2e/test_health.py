"""
Mifrufely Web — Health Check E2E Test
"""

import pytest
from httpx import AsyncClient


@pytest.mark.e2e
async def test_health_check(client: AsyncClient) -> None:
    response = await client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["service"] == "mifrufely-backend"
