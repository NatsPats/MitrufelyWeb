"""
coupon_code.py — Helper to generate unique coupon codes.
Desacoplado de la base de datos y de la lógica de negocio del servicio.
"""

import random
import string


def generate_coupon_code(prefix: str = "MTR", length: int = 4) -> str:
    """
    Genera un código de cupón único alfanumérico con un prefijo.
    Ejemplo: MTR-X4A9, WIN-8F2Q.
    """
    chars = string.ascii_uppercase + string.digits
    # Excluimos caracteres visualmente ambiguos (O, 0, I, 1) para mejorar UX
    ambiguous = {"O", "0", "I", "1"}
    filtered_chars = [c for c in chars if c not in ambiguous]
    
    random_part = "".join(random.choices(filtered_chars, k=length))
    return f"{prefix}-{random_part}"
