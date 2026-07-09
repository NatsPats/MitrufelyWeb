"""
Mitrufely Web — Comprobante Electrónico PDF (Fase 7)
Genera el PDF del comprobante de venta (BOLETA/FACTURA) con `reportlab`.

Reporte de Comprobantes Electrónicos (reporte 6): cada compra genera un
comprobante digital en PDF con datos del cliente, productos, cantidades y total.
"""

from __future__ import annotations

import io
from decimal import Decimal

from reportlab.lib import colors
from reportlab.lib.enums import TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import (
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

VINO = colors.HexColor("#5c0f1b")
NARANJA = colors.HexColor("#ff7a45")
TEXTO = colors.HexColor("#2a1115")
GRIS_CLARO = colors.HexColor("#faf8f5")
GRIS_BORDE = colors.HexColor("#e7e5e4")


def _styles() -> dict[str, ParagraphStyle]:
    base = getSampleStyleSheet()["Normal"]
    return {
        "marca": ParagraphStyle(
            "Marca", parent=base, fontName="Helvetica-Bold",
            fontSize=22, textColor=VINO, leading=26,
        ),
        "rubro": ParagraphStyle(
            "Rubro", parent=base, fontName="Helvetica",
            fontSize=8, textColor=colors.HexColor("#888"), leading=10,
        ),
        "h2": ParagraphStyle(
            "H2", parent=base, fontName="Helvetica-Bold",
            fontSize=10, textColor=VINO, leading=12, spaceBefore=6, spaceAfter=4,
        ),
        "label": ParagraphStyle(
            "Label", parent=base, fontName="Helvetica",
            fontSize=8, textColor=colors.HexColor("#666"), leading=10,
        ),
        "valor": ParagraphStyle(
            "Valor", parent=base, fontName="Helvetica-Bold",
            fontSize=9, textColor=TEXTO, leading=11,
        ),
        "cell": ParagraphStyle(
            "Cell", parent=base, fontName="Helvetica",
            fontSize=9, textColor=TEXTO, leading=11,
        ),
        "cell_right": ParagraphStyle(
            "CellRight", parent=base, fontName="Helvetica",
            fontSize=9, textColor=TEXTO, leading=11, alignment=TA_RIGHT,
        ),
        "doc_titulo": ParagraphStyle(
            "DocTitulo", parent=base, fontName="Helvetica-Bold",
            fontSize=14, textColor=VINO, leading=16, alignment=TA_RIGHT,
        ),
        "total": ParagraphStyle(
            "Total", parent=base, fontName="Helvetica-Bold",
            fontSize=13, textColor=colors.white, leading=15,
        ),
        "footer": ParagraphStyle(
            "Footer", parent=base, fontName="Helvetica",
            fontSize=7, textColor=colors.HexColor("#999"),
            alignment=1, leading=9,
        ),
    }


def generar_comprobante_pdf(data: dict) -> bytes:
    """
    Construye el PDF del comprobante de venta a partir de `data` (dict plano).
    `data` debe ser el retorno de `ReportsService.obtener_venta_para_comprobante`.
    """
    venta = data["venta"]
    cliente = data["cliente"]
    documento = data.get("documento")
    detalles: list[dict] = data["detalles"]

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=1.8 * cm,
        rightMargin=1.8 * cm,
        topMargin=1.6 * cm,
        bottomMargin=1.6 * cm,
        title=f"Comprobante Venta #{venta.id_venta}",
        author="MitrufelyWeb",
    )
    s = _styles()
    story: list = []

    # ── Encabezado: marca + tipo de documento ─────────────────────────────────
    tipo_doc = (documento.tipo_documento.value if documento and documento.tipo_documento else "BOLETA")
    if tipo_doc == "REPORTE":
        tipo_doc_label = "Reporte"
    else:
        tipo_doc_label = "Boleta" if tipo_doc == "BOLETA" else "Factura"

    serie = (documento.numero_serie if documento else None) or ""
    correlativo = (documento.numero_correlativo if documento else None) or str(venta.id_venta)
    numero_doc = f"{serie}-{correlativo}".lstrip("-")

    header = Table(
        [[
            [
                Paragraph("Mitrufely", s["marca"]),
                Paragraph("Pastelería artesanal · Trufas gourmet", s["rubro"]),
            ],
            [
                Paragraph(tipo_doc_label.upper() + " ELECTRÓNICA", s["doc_titulo"]),
                Paragraph(f"N° {numero_doc}", s["valor"]),
            ],
        ]],
        colWidths=[10 * cm, 7 * cm],
    )
    header.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP")]))
    story.append(header)
    story.append(Spacer(1, 0.4 * cm))

    # Línea separadora naranja
    linea = Table([[""]], colWidths=[17 * cm], rowHeights=[3])
    linea.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), NARANJA)]))
    story.append(linea)
    story.append(Spacer(1, 0.4 * cm))

    # ── Datos del cliente + de la venta ───────────────────────────────────────
    nombre_cliente = f"{cliente['nombres']} {cliente['apellidos']}".strip()
    if not nombre_cliente:
        nombre_cliente = cliente.get("email") or "Cliente"

    import datetime as _dt
    fecha = (
        venta.fecha_venta.strftime("%d/%m/%Y %H:%M")
        if hasattr(venta, "fecha_venta") and venta.fecha_venta
        else _dt.datetime.now().strftime("%d/%m/%Y %H:%M")
    )

    cliente_box = Table(
        [
            [Paragraph("CLIENTE", s["h2"]), ""],
            [Paragraph("Nombre:", s["label"]), Paragraph(nombre_cliente, s["valor"])],
            [Paragraph("Email:", s["label"]), Paragraph(cliente.get("email") or "—", s["valor"])],
            [Paragraph("Teléfono:", s["label"]), Paragraph(cliente.get("telefono") or "—", s["valor"])],
        ],
        colWidths=[2.5 * cm, 14.5 * cm],
    )
    cliente_box.setStyle(
        TableStyle([
            ("SPAN", (0, 0), (-1, 0)),
            ("BOX", (0, 0), (-1, -1), 0.4, GRIS_BORDE),
            ("BACKGROUND", (0, 0), (-1, 0), GRIS_CLARO),
            ("LEFTPADDING", (0, 0), (-1, -1), 6),
            ("RIGHTPADDING", (0, 0), (-1, -1), 6),
            ("TOPPADDING", (0, 0), (-1, -1), 3),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ])
    )
    story.append(cliente_box)
    story.append(Spacer(1, 0.3 * cm))

    info_box = Table(
        [
            [Paragraph("Fecha emisión:", s["label"]), Paragraph(fecha, s["valor"])],
        ],
        colWidths=[2.5 * cm, 14.5 * cm],
    )
    info_box.setStyle(
        TableStyle([
            ("LEFTPADDING", (0, 0), (-1, -1), 6),
            ("RIGHTPADDING", (0, 0), (-1, -1), 6),
            ("TOPPADDING", (0, 0), (-1, -1), 2),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
        ])
    )
    story.append(info_box)
    story.append(Spacer(1, 0.4 * cm))

    # ── Detalle de productos ──────────────────────────────────────────────────
    story.append(Paragraph("DETALLE", s["h2"]))

    headers = ["Cant.", "Descripción", "P. Unit.", "Subtotal"]
    filas = [
        [
            Paragraph(str(d["cantidad"]), s["cell"]),
            Paragraph(d["nombre"], s["cell"]),
            Paragraph(_money(d["precio_unitario"]), s["cell_right"]),
            Paragraph(_money(d["subtotal"]), s["cell_right"]),
        ]
        for d in detalles
    ]
    data_tabla = [[Paragraph(h, s["valor"]) for h in headers]] + filas

    tabla = Table(data_tabla, colWidths=[1.8 * cm, 9.7 * cm, 2.7 * cm, 2.8 * cm], repeatRows=1)
    tabla.setStyle(
        TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), VINO),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, GRIS_CLARO]),
            ("GRID", (0, 0), (-1, -1), 0.25, GRIS_BORDE),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("LEFTPADDING", (0, 0), (-1, -1), 6),
            ("RIGHTPADDING", (0, 0), (-1, -1), 6),
            ("TOPPADDING", (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ])
    )
    story.append(tabla)
    story.append(Spacer(1, 0.4 * cm))

    # ── Totales ───────────────────────────────────────────────────────────────
    subtotal = _get_decimal(venta, "subtotal_productos")
    envio = _get_decimal(venta, "costo_envio")
    descuento = _get_decimal(venta, "monto_descuento_cupon")
    base = _get_decimal(venta, "base_imponible")
    igv = _get_decimal(venta, "igv")
    total = _get_decimal(venta, "total") + _get_decimal(venta, "igv")

    totales = Table(
        [
            [Paragraph("Subtotal productos:", s["label"]), Paragraph(_money(subtotal), s["cell_right"])],
            [Paragraph("Costo de envío:", s["label"]), Paragraph(_money(envio), s["cell_right"])],
            [Paragraph("Descuento cupón:", s["label"]), Paragraph("- " + _money(descuento), s["cell_right"])],
            [Paragraph("Base imponible:", s["label"]), Paragraph(_money(base), s["cell_right"])],
            [Paragraph("IGV (18%):", s["label"]), Paragraph(_money(igv), s["cell_right"])],
        ],
        colWidths=[13 * cm, 4 * cm],
    )
    totales.setStyle(
        TableStyle([
            ("LINEABOVE", (0, 0), (-1, 0), 0.5, GRIS_BORDE),
            ("LEFTPADDING", (0, 0), (-1, -1), 6),
            ("RIGHTPADDING", (0, 0), (-1, -1), 6),
            ("TOPPADDING", (0, 0), (-1, -1), 3),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ])
    )
    story.append(totales)
    story.append(Spacer(1, 0.2 * cm))

    total_box = Table(
        [[Paragraph("TOTAL PAGADO", s["total"]), Paragraph(_money(total), s["total"])]],
        colWidths=[13 * cm, 4 * cm],
    )
    total_box.setStyle(
        TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), VINO),
            ("ALIGN", (1, 0), (1, 0), "RIGHT"),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("LEFTPADDING", (0, 0), (-1, -1), 10),
            ("RIGHTPADDING", (0, 0), (-1, -1), 10),
            ("TOPPADDING", (0, 0), (-1, -1), 8),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ])
    )
    story.append(total_box)
    story.append(Spacer(1, 0.8 * cm))

    # ── Pie ───────────────────────────────────────────────────────────────────
    story.append(Paragraph(
        "Gracias por su compra · MitrufelyWeb · Pastelería artesanal<br/>"
        "Este comprobante electrónico es un respaldo formal de su transacción.",
        s["footer"],
    ))

    doc.build(story)
    return buffer.getvalue()


# ── Helpers ───────────────────────────────────────────────────────────────────


def _money(value) -> str:
    try:
        return f"S/ {Decimal(str(value)).quantize(Decimal('0.01'))}"
    except Exception:
        return str(value)


def _get_decimal(obj, attr: str) -> Decimal:
    val = getattr(obj, attr, None)
    if val is None:
        return Decimal("0")
    try:
        return Decimal(str(val))
    except Exception:
        return Decimal("0")
