"""
prueba.py  ·  Persona 4  ·  Entregable H1

Escribe a partir de escena/escena.json:
  salida/observaciones.json   lo que DEBERÍA entregar el motor de visión de P2
  salida/hallazgos.json       lo que DEBERÍA entregar cruce.py (lo usa P3 en el tablero)

Son datos de PRUEBA (dato_de_prueba: true): sirven para que P2 y P3 trabajen
desde ya sin esperar a que exista el sistema real.

Uso:  python datos/escena.py && python datos/prueba.py
"""
import json
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent

# Unidades vendidas por día (prueba). 43 del muffin sale del plan (Paso 6).
UNIDADES_DIA = {
    "SKU-100664": 43, "SKU-101809": 31, "SKU-100601": 12, "SKU-101664": 18,
    "SKU-100075": 9, "SKU-100599": 22, "SKU-102560": 7, "SKU-100506": 5,
    "SKU-100104": 3, "SKU-100292": 11, "SKU-100131": 16, "SKU-100936": 8,
}
INVENTARIO_SISTEMA = {"SKU-100075": 6, "SKU-100599": 0}  # el resto: 10

TEXTOS = {
    "precio_anterior": "Etiqueta con precio anterior",
    "precio_distinto": "Precio distinto al sistema",
    "etiqueta_faltante": "Etiqueta faltante",
    "etiqueta_otro_sku": "Etiqueta de otro producto",
    "hueco_con_inventario": "Hueco con inventario en sistema",
    "hueco_agotado": "Hueco: producto agotado",
    "frentes_bajos": "Pocos frentes",
    "producto_equivocado": "Producto en lugar equivocado",
}
ACCIONES = {
    "precio_anterior": "Reimprimir la etiqueta con el precio vigente.",
    "precio_distinto": "Revisar el precio en sistema y reimprimir la etiqueta.",
    "etiqueta_faltante": "Imprimir y colocar la etiqueta.",
    "etiqueta_otro_sku": "Cambiar la etiqueta por la del producto correcto.",
    "hueco_con_inventario": "Buscar el producto en bodega y surtir el anaquel; si no aparece, ajustar inventario.",
    "hueco_agotado": "Pedir reabasto del producto.",
    "frentes_bajos": "Acomodar más piezas al frente.",
    "producto_equivocado": "Regresar el producto a su lugar.",
}
RIESGO_PROFECO = "Riesgo PROFECO: la etiqueta debe mostrar el precio que se cobra (arts. 7 y 7 Bis LFPC)."


def observaciones(escena):
    obs = []
    for p in escena["posiciones"]:
        e = p["etiqueta"]
        obs.append({
            "posicion": p["posicion"],
            "etiqueta": {
                "detectada": e["presente"],
                "sku_leido": e["sku"],
                "precio_leido": e["precio"],
                "confianza": 0.97 if e["presente"] else None,
                "cuadros_que_coinciden": 3 if e["presente"] else 0,
                "recorte": f"recortes/{p['posicion']}.jpg" if e["presente"] else None,
            },
            "hueco": p["sku_fisico"] is None,
            "frentes_vistos": p["frentes_fisicos"],
            "sku_producto_visto": None,   # identificación por imagen: fuera de alcance
        })
    return {"dato_de_prueba": True, "tienda": escena["tienda"], "fecha": escena["fecha"],
            "clip": "video/principal.mp4", "posiciones": obs}


def hallazgo(p, tipo, n):
    sku = p["sku_planograma"]
    u = UNIDADES_DIA[sku]
    h = {
        "id": f"H{n:02d}", "posicion": p["posicion"], "tipo": tipo, "texto": TEXTOS[tipo],
        "estado": "error", "sku": sku, "nombre": p["etiqueta"]["nombre"] or sku,
        "precio_etiqueta": None, "precio_sistema": None, "diferencia": None,
        "inventario_sistema": None, "unidades_dia": u,
        "dinero_dia": 0.0, "nota_dinero": "", "accion": ACCIONES[tipo],
        "recorte": f"recortes/{p['posicion']}.jpg",
    }
    return h


def hallazgos(escena):
    vigentes = {p["sku_planograma"]: p for p in escena["posiciones"]}
    from escena import NOMBRES, cargar_precios  # mismo origen de precios que escena.json
    precios, _ = cargar_precios()
    lista, n = [], 1
    for p in escena["posiciones"]:
        err = p["error"]
        if not err or not err["en_alcance"]:
            continue
        tipo, sku = err["tipo"], p["sku_planograma"]
        h = hallazgo(p, tipo, n)
        h["nombre"] = NOMBRES[sku]
        vig = precios[sku][0]
        h["precio_sistema"] = vig
        if tipo in ("precio_anterior", "precio_distinto"):
            dif = round(p["etiqueta"]["precio"] - vig, 2)
            h.update(precio_etiqueta=p["etiqueta"]["precio"], diferencia=dif,
                     dinero_dia=round(abs(dif) * h["unidades_dia"], 2),
                     nota_dinero="Diferencia de precio × unidades por día. " + RIESGO_PROFECO)
        elif tipo.startswith("hueco"):
            h["inventario_sistema"] = INVENTARIO_SISTEMA.get(sku)
            h.update(dinero_dia=round(h["unidades_dia"] * vig, 2),
                     nota_dinero="Venta perdida si sigue vacío todo el día.")
        else:
            if tipo == "etiqueta_otro_sku":
                h["precio_etiqueta"] = p["etiqueta"]["precio"]
            h["nota_dinero"] = "Sin dinero directo. " + RIESGO_PROFECO
        lista.append(h)
        n += 1
    lista.sort(key=lambda x: -x["dinero_dia"])  # priorizado por dinero
    return {"dato_de_prueba": True, "precios_de_prueba": escena["precios_de_prueba"],
            "tienda": escena["tienda"], "fecha": escena["fecha"],
            "moneda": escena["moneda"], "hallazgos": lista,
            "resumen": {"total": len(lista),
                        "dinero_total_dia": round(sum(h["dinero_dia"] for h in lista), 2)}}


def cargar_inventario():
    """Si existe inventario_dia.csv (de limpiar.py), usa unidades e inventario reales."""
    import csv
    ruta = RAIZ / "datos/sistema/inventario_dia.csv"
    if not ruta.exists():
        return
    with open(ruta, newline="", encoding="utf-8") as f:
        for r in csv.DictReader(f):
            if r["tienda"] == "S012" and r["sku"] in UNIDADES_DIA:
                UNIDADES_DIA[r["sku"]] = float(r["unidades_dia_28"])
                INVENTARIO_SISTEMA[r["sku"]] = int(float(r["inventario_cierre"]))


def main():
    cargar_inventario()
    import sys
    sys.path.insert(0, str(Path(__file__).parent))
    escena = json.loads((RAIZ / "escena/escena.json").read_text(encoding="utf-8"))
    salida = RAIZ / "salida"
    salida.mkdir(exist_ok=True)
    for nombre, doc in (("observaciones.json", observaciones(escena)),
                        ("hallazgos.json", hallazgos(escena))):
        (salida / nombre).write_text(json.dumps(doc, ensure_ascii=False, indent=2), encoding="utf-8")
    print("salida/observaciones.json y salida/hallazgos.json escritos")


if __name__ == "__main__":
    main()
