"""
etiquetas.py  ·  Persona 4  ·  Entregable H3

Dibuja una etiqueta PNG de 600 x 350 px (100 px por cm = 6 x 3.5 cm) por posición:
borde naranja #FF6A00 de 30 px, nombre, precio con dígitos de 120 px de alto,
código SKU (letra de 60 px), código UPC de product_barcodes.csv y "Vigente desde".

Usa el precio que dice escena.json (NO el del maestro), para que los errores
sembrados salgan impresos.

Salida:
  escena/etiquetas/R1-P1.png ...           12 etiquetas (posiciones sin etiqueta se omiten)
  escena/etiquetas/tarjetas/*.png          etiquetas extra para las tarjetas del juez
  escena/etiquetas/imprimir.pdf            hoja tamaño carta a escala real (6 x 3.5 cm)

Uso:  python datos/etiquetas.py
"""
import json
import sys
from pathlib import Path

import barcode
import pandas as pd
from barcode.writer import ImageWriter
from PIL import Image, ImageDraw, ImageFont

RAIZ = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(Path(__file__).parent))
from limpiar import limpiar_precios  # noqa: E402

W, H = 600, 350
GROSOR = 10        # grosor del trazo naranja (antes 30 px)
MARGEN = 30        # margen del contenido respecto al borde (sin cambios)
NARANJA = "#FF6A00"
FUENTES = "/usr/share/fonts/truetype/dejavu/"
F_PRECIO = FUENTES + "DejaVuSansCondensed-Bold.ttf"
F_BOLD, F_REG, F_MONO = (FUENTES + "DejaVuSans-Bold.ttf", FUENTES + "DejaVuSans.ttf",
                         FUENTES + "DejaVuSansMono-Bold.ttf")
DPI = 254  # 100 px por cm


def fuente_por_altura(ruta, texto, alto_px):
    """Busca el tamaño de letra cuyos dígitos midan alto_px de alto."""
    size = alto_px
    while True:
        f = ImageFont.truetype(ruta, size)
        top, bottom = f.getbbox(texto)[1], f.getbbox(texto)[3]
        if bottom - top >= alto_px:
            return f
        size += 2


def ajustar_ancho(ruta, texto, size, ancho_max):
    while size > 10:
        f = ImageFont.truetype(ruta, size)
        if f.getlength(texto) <= ancho_max:
            return f
        size -= 1
    return ImageFont.truetype(ruta, size)


def imagen_upc(codigo):
    """Código de barras sin texto. UPC-A de 12 dígitos; si el dígito verificador
    no cuadra, python-barcode lo recalcula a partir de los primeros 11."""
    try:
        clase = barcode.get_barcode_class("ean13" if len(codigo) == 13 else "upca")
        bc = clase(codigo[:12] if len(codigo) == 13 else codigo[:11], writer=ImageWriter())
        img = bc.render({"module_height": 6, "module_width": 0.2, "quiet_zone": 1,
                         "write_text": False, "dpi": 254})
        return img.convert("RGB")
    except Exception as e:  # noqa: BLE001
        print(f"  aviso: no se pudo dibujar el código {codigo}: {e}")
        return None


def dibujar(nombre, sku, precio, upc, vigente_desde):
    img = Image.new("RGB", (W, H), "white")
    d = ImageDraw.Draw(img)
    d.rectangle([0, 0, W - 1, H - 1], outline=NARANJA, width=GROSOR)
    x0, ancho = MARGEN + 12, W - 2 * MARGEN - 24

    # Nombre
    f_nom = ajustar_ancho(F_BOLD, nombre, 26, ancho)
    d.text((x0, MARGEN + 6), nombre, font=f_nom, fill="black")

    # Precio: los dígitos miden hasta 120 px de alto (menos si el número no cabe,
    # p. ej. montos en pesos de 3 dígitos). El "$" va más chico, alineado arriba.
    texto = f"{precio:.2f}"
    alto = 120
    while True:
        f_pre = fuente_por_altura(F_PRECIO, "0123456789", alto)
        f_sig = ImageFont.truetype(F_PRECIO, int(f_pre.size * 0.5))
        w_sig, w_pre = f_sig.getlength("$") + 4, f_pre.getlength(texto)
        if w_sig + w_pre <= ancho or alto <= 60:
            break
        alto -= 5
    top = f_pre.getbbox("0123456789")[1]
    if w_sig + w_pre > ancho:
        print(f"  aviso: el precio {texto} no cabe ({w_sig + w_pre:.0f}px > {ancho}px)")
    x = W / 2 - (w_sig + w_pre) / 2
    y = MARGEN + 40
    d.text((x, y - f_sig.getbbox("$")[1]), "$", font=f_sig, fill="black")
    d.text((x + w_sig, y - top), texto, font=f_pre, fill="black")

    # Código SKU, letra de 60 px
    f_sku = ajustar_ancho(F_BOLD, sku, 60, ancho)  # sin cero punteado (el OCR lo confunde con 8)
    d.text((x0, MARGEN + 170), sku, font=f_sku, fill="black")

    # Código de barras + fecha
    y = MARGEN + 236
    bc = imagen_upc(upc) if upc else None
    if bc:
        bc = bc.resize((260, 38))
        img.paste(bc, (x0, y))
    f_peq = ImageFont.truetype(F_REG, 16)
    d.text((x0, y + 40), upc or "", font=f_peq, fill="black")
    d.text((x0 + 290, y + 4), "Vigente desde", font=f_peq, fill="black")
    d.text((x0 + 290, y + 24), vigente_desde, font=ImageFont.truetype(F_BOLD, 22), fill="black")
    return img


def main():
    escena = json.loads((RAIZ / "escena/escena.json").read_text(encoding="utf-8"))
    tienda = escena["tienda"]
    barras = pd.read_csv(RAIZ / "datos/glazed/product_barcodes.csv", dtype=str)
    upc = barras.drop_duplicates("sku", keep="first").set_index("sku")["barcode"].to_dict()
    precios, _ = limpiar_precios(pd.read_csv(RAIZ / "datos/glazed/prices.csv", dtype=str))
    precios = precios[precios["store_id"] == tienda]

    def desde(sku, precio):
        g = precios[(precios["sku"] == sku) & (precios["precio"].round(2) == round(precio, 2))]
        return g["desde"].max().strftime("%d/%m/%Y") if len(g) else escena["fecha"][8:10] + "/" + \
            escena["fecha"][5:7] + "/" + escena["fecha"][:4]

    def etiqueta_de(pos):
        e = pos["etiqueta"]
        if not e["presente"]:
            return None
        return dibujar(e["nombre"], e["sku"], e["precio"], upc.get(e["sku"]), desde(e["sku"], e["precio"]))

    salida = RAIZ / "escena/etiquetas"
    (salida / "tarjetas").mkdir(parents=True, exist_ok=True)
    hechas = []
    for pos in escena["posiciones"]:
        img = etiqueta_de(pos)
        if img is None:
            print(f"  {pos['posicion']}: sin etiqueta (error sembrado)")
            continue
        ruta = salida / f"{pos['posicion']}.png"
        img.save(ruta, dpi=(DPI, DPI))
        hechas.append((pos["posicion"], img))

    # Etiquetas extra que el juez pega en el anaquel
    extra = []
    for tarjeta in ("precio_viejo", "etiqueta_cambiada"):
        var = json.loads((RAIZ / f"escena/variantes/{tarjeta}.json").read_text(encoding="utf-8"))
        pos = next(p for p in var["posiciones"] if str(p["error"] and p["error"]["n"]).startswith("J-"))
        img = etiqueta_de(pos)
        img.save(salida / "tarjetas" / f"{tarjeta}_{pos['posicion']}.png", dpi=(DPI, DPI))
        extra.append((f"Tarjeta {tarjeta} ({pos['posicion']})", img))

    # PDF para imprimir a escala real: carta a 254 dpi = 2159 x 2794 px
    hoja = Image.new("RGB", (2159, 2794), "white")
    dh = ImageDraw.Draw(hoja)
    f_rot = ImageFont.truetype(F_REG, 28)
    todas = hechas + extra
    for i, (rotulo, img) in enumerate(todas):
        col, fila = i % 3, i // 3
        x, y = 80 + col * 680, 80 + fila * 430
        hoja.paste(img, (x, y + 36))
        dh.text((x, y), rotulo, font=f_rot, fill="gray")
    hoja.save(salida / "imprimir.pdf", resolution=DPI)
    print(f"{len(hechas)} etiquetas + {len(extra)} de tarjetas -> escena/etiquetas/ (y imprimir.pdf)")


if __name__ == "__main__":
    main()
