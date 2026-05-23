"""
Report generation tasks — PDF / Excel
Placeholder bodies ready for business logic implementation.
"""

import structlog

from app.infrastructure.workers.celery_app import celery_app

logger = structlog.get_logger(__name__)


@celery_app.task(bind=True, name="tasks.reports.generate_sales_pdf", max_retries=3)
def generate_sales_pdf(self, report_params: dict) -> str:
    """Generate sales report PDF and return the file path."""
    logger.info("task.generate_sales_pdf.started", params=report_params)
    # TODO: Implement PDF generation with reportlab/weasyprint
    raise NotImplementedError


@celery_app.task(bind=True, name="tasks.reports.export_inventory_excel", max_retries=3)
def export_inventory_excel(self, filters: dict) -> str:
    """Export inventory to Excel and return the file path."""
    logger.info("task.export_inventory_excel.started", filters=filters)
    # TODO: Implement Excel export with openpyxl
    raise NotImplementedError
