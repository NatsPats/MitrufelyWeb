from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.database.session import get_db_session
from app.modules.issues.service import IssueService
from app.modules.orders.dependencies import get_venta_service
from app.modules.orders.service import VentaService

def get_issue_service(
    session: AsyncSession = Depends(get_db_session),
    venta_service: VentaService = Depends(get_venta_service)
) -> IssueService:
    return IssueService(session=session, venta_service=venta_service)
