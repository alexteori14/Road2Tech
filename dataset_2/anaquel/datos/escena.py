"""
escena.py  ·  Persona 4 (Datos, cruce y pitch)  ·  Entregable H1

Genera:
  datos/sistema/planograma.csv          12 posiciones (3 repisas x 4 posiciones de 30 cm)
  escena/escena.json                    escena de la demo con los 8 errores sembrados
  escena/variantes/<tarjeta>.json       4 variantes para las tarjetas del juez

Precios: si existe datos/sistema/maestro_vigente.csv (sale de limpiar.py en H3),
se usan esos. Si no, se usan los precios de PRUEBA de abajo y escena.json
queda marcado con "precios_de_prueba": true.

Uso:  python datos/escena.py
"""
import copy
import csv
import json
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
TIENDA, FECHA = "S012", "2026-03-03"
ANCHO_CM, FRENTES = 30, 3
MONEDA = "MXN"
TIPO_CAMBIO = 17.50  # USD -> MXN, tipo de cambio de referencia (el dataset viene en USD)

NOMBRES = {
    "SKU-100664": "Original Coffee Cake Muffin",
    "SKU-101809": "Caramel Iced Coffee",
    "SKU-100601": "Pretzel Bites",
    "SKU-101664": "Chocolate Chunk Cookie",
    "SKU-100075": "Tuna Salad Wrap",
    "SKU-100599": "8 Donut Holes",
    "SKU-102560": "Bacon Roll Up",
    "SKU-100506": "12 Bagels",
    "SKU-100104": "2 Lbs. Coffee",
    "SKU-100292": "Oatmeal",
    "SKU-100131": "Bagel W Butter",
    "SKU-100936": "French Toast Bagel",
    "SKU-102199": "Chicken Croissant",
}

# Planograma: (repisa, posicion) -> SKU.  Las 8 posiciones con error vienen
# de la tabla del Paso 7; las 4 de control se reparten en los huecos libres.
PLANOGRAMA = {
    (1, 1): "SKU-100664", (1, 2): "SKU-100104", (1, 3): "SKU-101809", (1, 4): "SKU-100506",
    (2, 1): "SKU-100292", (2, 2): "SKU-100601", (2, 3): "SKU-100131", (2, 4): "SKU-101664",
    (3, 1): "SKU-100075", (3, 2): "SKU-100599", (3, 3): "SKU-102560", (3, 4): "SKU-100936",
}

# Precios: vigente / anterior. Los dos primeros salen del plan (Paso 6/7);
# el resto son de PRUEBA hasta que exista maestro_vigente.csv.
PRECIOS_PRUEBA = {
    "SKU-100664": (7.69, 7.09), "SKU-101809": (4.99, 4.59),
    "SKU-100601": (5.49, 5.19), "SKU-101664": (3.29, 3.09),
    "SKU-100075": (8.99, 8.49), "SKU-100599": (4.49, 4.29),
    "SKU-102560": (6.79, 6.39), "SKU-100506": (15.99, 14.99),
    "SKU-100104": (24.99, 23.99), "SKU-100292": (4.79, 4.49),
    "SKU-100131": (3.49, 3.29), "SKU-100936": (3.79, 3.59),
    "SKU-102199": (7.49, 6.99),
}


def a_mxn(precios_usd):
    """Convierte un dict sku -> (vigente, anterior|None) de USD a MXN."""
    return {sku: (round(v * TIPO_CAMBIO, 2), round(a * TIPO_CAMBIO, 2) if a is not None else None)
            for sku, (v, a) in precios_usd.items()}


def cargar_precios():
    """Devuelve (precios_en_MXN, precios_de_prueba). Los precios del dataset
    (PRECIOS_PRUEBA o maestro_vigente.csv) están en USD; se convierten aquí."""
    maestro = RAIZ / "datos/sistema/maestro_vigente.csv"
    if not maestro.exists():
        return a_mxn(PRECIOS_PRUEBA), True
    precios = dict(PRECIOS_PRUEBA)
    with open(maestro, newline="", encoding="utf-8") as f:
        for r in csv.DictReader(f):
            if r["tienda"] == TIENDA and r["sku"] in precios and r["precio_vigente"]:
                ant = float(r["precio_anterior"]) if r.get("precio_anterior") else None
                precios[r["sku"]] = (float(r["precio_vigente"]), ant)
    return a_mxn(precios), False


def pos_id(rep, pos):
    return f"R{rep}-P{pos}"


def posicion_correcta(rep, pos, precios):
    sku = PLANOGRAMA[(rep, pos)]
    return {
        "posicion": pos_id(rep, pos),
        "repisa": rep,
        "pos": pos,
        "x_inicio_cm": (pos - 1) * ANCHO_CM,
        "ancho_cm": ANCHO_CM,
        "sku_planograma": sku,
        "sku_fisico": sku,                 # producto que realmente está ahí
        "frentes_fisicos": FRENTES,
        "etiqueta": {                       # lo que va IMPRESO en la etiqueta
            "presente": True,
            "sku": sku,
            "nombre": NOMBRES[sku],
            "precio": precios[sku][0],
        },
        "error": None,
    }


def aplicar(p, tipo, precios, n=None, **kw):
    """Modifica una posición para sembrar un error."""
    sku = p["sku_planograma"]
    if tipo == "precio_anterior":
        p["etiqueta"]["precio"] = precios[sku][1]
    elif tipo == "precio_distinto":
        p["etiqueta"]["precio"] = kw["precio"]
    elif tipo == "etiqueta_faltante":
        p["etiqueta"] = {"presente": False, "sku": None, "nombre": None, "precio": None}
    elif tipo == "etiqueta_otro_sku":
        otro = kw["otro"]
        p["etiqueta"].update(sku=otro, nombre=NOMBRES[otro], precio=precios[otro][0])
    elif tipo in ("hueco_con_inventario", "hueco_agotado"):
        p["sku_fisico"], p["frentes_fisicos"] = None, 0
    elif tipo == "producto_equivocado":
        p["sku_fisico"] = kw["fisico"]
    elif tipo == "frentes_bajos":
        p["frentes_fisicos"] = kw["frentes"]
    p["error"] = {"n": n, "tipo": tipo, "en_alcance": tipo != "producto_equivocado",
                  "descripcion": kw.get("desc", "")}
    return p


def construir_escena(precios):
    pos = {pos_id(r, c): posicion_correcta(r, c, precios) for (r, c) in PLANOGRAMA}
    errores = [
        (1, "R1-P1", "precio_anterior", {"desc": "Etiqueta con precio anterior"}),
        (2, "R1-P3", "precio_anterior", {"desc": "Etiqueta con precio anterior"}),
        (3, "R2-P2", "etiqueta_faltante", {"desc": "Sin etiqueta"}),
        (4, "R2-P4", "etiqueta_otro_sku", {"otro": "SKU-100506", "desc": "Etiqueta de 12 Bagels"}),
        (5, "R3-P1", "hueco_con_inventario", {"desc": "Hueco; el sistema dice que hay inventario"}),
        (6, "R3-P2", "hueco_agotado", {"desc": "Hueco; el sistema dice 0 (agotado real)"}),
        (7, "R3-P3", "producto_equivocado", {"fisico": "SKU-102199",
                                             "desc": "Chicken Croissant sobre etiqueta de Bacon Roll Up"}),
        (8, "R1-P4", "frentes_bajos", {"frentes": 1, "desc": "1 frente de 3 esperados"}),
    ]
    for n, pid, tipo, kw in errores:
        aplicar(pos[pid], tipo, precios, n=n, **kw)
    return list(pos.values())


def guardar(ruta, escena, precios_prueba, nombre, tarjeta=None):
    ruta.parent.mkdir(parents=True, exist_ok=True)
    doc = {
        "tienda": TIENDA,
        "fecha": FECHA,
        "nombre": nombre,
        "tarjeta": tarjeta,
        "moneda": MONEDA,
        "tipo_cambio_usd_mxn": TIPO_CAMBIO,
        "precios_de_prueba": precios_prueba,
        "repisas": 3, "posiciones_por_repisa": 4,
        "ancho_posicion_cm": ANCHO_CM, "frentes_esperados": FRENTES,
        "posiciones": escena,
    }
    ruta.write_text(json.dumps(doc, ensure_ascii=False, indent=2), encoding="utf-8")


def main():
    precios, de_prueba = cargar_precios()

    # 1) planograma.csv
    plano = RAIZ / "datos/sistema/planograma.csv"
    plano.parent.mkdir(parents=True, exist_ok=True)
    with open(plano, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["tienda", "posicion", "repisa", "pos", "x_inicio_cm", "ancho_cm",
                    "sku", "nombre", "frentes_esperados"])
        for (r, c), sku in sorted(PLANOGRAMA.items()):
            w.writerow([TIENDA, pos_id(r, c), r, c, (c - 1) * ANCHO_CM, ANCHO_CM,
                        sku, NOMBRES[sku], FRENTES])

    # 2) escena principal con los 8 errores
    escena = construir_escena(precios)
    guardar(RAIZ / "escena/escena.json", escena, de_prueba, "demo_8_errores")

    # 3) variantes para las tarjetas del juez (cada una = escena + 1 error nuevo)
    # Oatmeal (R2-P1) no cambió de precio el 1-mar: no tiene precio anterior real.
    # La tarjeta imprime un precio que no está en el sistema (unos pesos menos) -> precio_distinto.
    precio_falso_oatmeal = round(precios["SKU-100292"][0] - 7, 2)
    tarjetas = [
        ("precio_viejo", "R2-P1", "precio_distinto",
         {"precio": precio_falso_oatmeal,
          "desc": "Juez: etiqueta con un precio que no está en el sistema"}),
        ("etiqueta_cambiada", "R2-P3", "etiqueta_otro_sku",
         {"otro": "SKU-100936", "desc": "Juez: etiqueta de otro SKU"}),
        ("quitar_etiqueta", "R1-P2", "etiqueta_faltante", {"desc": "Juez: etiqueta quitada"}),
        ("quitar_producto", "R3-P4", "hueco_con_inventario", {"desc": "Juez: producto retirado"}),
    ]
    for nombre, pid, tipo, kw in tarjetas:
        var = copy.deepcopy(escena)
        p = next(x for x in var if x["posicion"] == pid)
        aplicar(p, tipo, precios, n=f"J-{nombre}", **kw)
        guardar(RAIZ / f"escena/variantes/{nombre}.json", var, de_prueba,
                f"tarjeta_{nombre}", tarjeta=nombre)

    print(f"planograma.csv: {len(PLANOGRAMA)} posiciones")
    print(f"escena.json: {sum(1 for p in escena if p['error'])} errores sembrados")
    print(f"variantes: {', '.join(t[0] for t in tarjetas)}")
    if de_prueba:
        print("AVISO: precios de PRUEBA (falta datos/sistema/maestro_vigente.csv)")


if __name__ == "__main__":
    main()
