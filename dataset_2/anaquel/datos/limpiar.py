"""
limpiar.py  ·  Persona 4  ·  Entregable H3

Construye, para una fecha dada:
  datos/sistema/maestro_vigente.csv   tienda,sku,nombre,precio_vigente,precio_anterior,conflicto
  datos/sistema/inventario_dia.csv    tienda,sku,fecha,inventario_apertura,inventario_cierre,
                                      horas_agotado,unidades_dia_28
                                      (unidades_dia_28 = promedio de los 28 días previos en sales_daily)

Uso:  python datos/limpiar.py --fecha 2026-03-03
"""
import argparse
from collections import Counter
from pathlib import Path

import pandas as pd

RAIZ = Path(__file__).resolve().parent.parent
GLAZED = RAIZ / "datos/glazed"
SISTEMA = RAIZ / "datos/sistema"
FIN_ANTERIOR = pd.Timestamp("2026-02-28")


def leer_fecha(s):
    """Acepta AAAA-MM-DD y MM/DD/AAAA. Devuelve NaT si está vacía o no se entiende."""
    if pd.isna(s) or str(s).strip() == "":
        return pd.NaT
    s = str(s).strip()
    for fmt in ("%Y-%m-%d", "%m/%d/%Y"):
        try:
            return pd.to_datetime(s, format=fmt)
        except ValueError:
            pass
    return pd.NaT


def limpiar_precios(df):
    descartes = Counter()
    df = df.copy()
    texto = df["unit_price"].astype(str).str.strip()
    invalidos = texto.str.upper().isin(["TBD", "UNKNOWN", "?", "NAN", ""])
    descartes['texto ("TBD", "UNKNOWN", "?", vacío)'] = int(invalidos.sum())
    df = df[~invalidos]
    df["precio"] = pd.to_numeric(df["unit_price"].astype(str).str.replace("$", "", regex=False)
                                 .str.replace(",", "", regex=False).str.strip(), errors="coerce")
    no_num = df["precio"].isna()
    descartes["no numérico (otro texto)"] = int(no_num.sum())
    df = df[~no_num]
    le0 = df["precio"] <= 0
    descartes["precio <= 0"] = int(le0.sum())
    df = df[~le0]
    gt100 = df["precio"] > 100
    descartes["precio > 100"] = int(gt100.sum())
    df = df[~gt100]

    df["moneda"] = df["currency"].astype(str).str.strip().str.upper().replace({"US$": "USD"})
    otra = df["moneda"] != "USD"
    descartes["moneda distinta de USD"] = int(otra.sum())
    df = df[~otra]

    df["desde"] = df["effective_from"].map(leer_fecha)
    df["hasta"] = df["effective_to"].map(leer_fecha)
    sin_desde = df["desde"].isna()
    descartes["sin fecha de inicio legible"] = int(sin_desde.sum())
    df = df[~sin_desde]
    return df, descartes


def maestro(precios, productos, fecha):
    vig = precios[(precios["desde"] <= fecha) & (precios["hasta"].isna() | (precios["hasta"] >= fecha))]
    ant = precios[precios["hasta"] == FIN_ANTERIOR]

    filas = []
    for (tienda, sku), g in vig.groupby(["store_id", "sku"]):
        distintos = sorted(g["precio"].round(2).unique())
        a = ant[(ant["store_id"] == tienda) & (ant["sku"] == sku)]["precio"].round(2).unique()
        filas.append({
            "tienda": tienda, "sku": sku,
            "precio_vigente": distintos[0] if len(distintos) == 1 else "|".join(f"{x:.2f}" for x in distintos),
            "precio_anterior": f"{a[0]:.2f}" if len(a) == 1 else ("|".join(f"{x:.2f}" for x in a) if len(a) else ""),
            "conflicto": len(distintos) > 1,
        })
    m = pd.DataFrame(filas)
    nombres = productos.drop_duplicates("sku", keep="first").set_index("sku")["product_name"]
    m.insert(2, "nombre", m["sku"].map(nombres))
    m["precio_vigente"] = m["precio_vigente"].map(lambda x: f"{x:.2f}" if isinstance(x, float) else x)
    return m


def inventario(fecha):
    inv = pd.read_csv(GLAZED / "inventory_daily.csv")
    inv["date"] = pd.to_datetime(inv["date"], format="mixed", errors="coerce")
    dia = inv[inv["date"] == fecha][["store_id", "sku", "date", "opening_qty", "closing_qty", "stockout_hours"]]
    ventas = pd.read_csv(GLAZED / "sales_daily.csv", usecols=["date", "store_id", "sku", "units_sold"])
    ventas["date"] = pd.to_datetime(ventas["date"], format="mixed", errors="coerce")
    ventas["units_sold"] = pd.to_numeric(ventas["units_sold"], errors="coerce").fillna(0)
    ventana = ventas[(ventas["date"] < fecha) & (ventas["date"] >= fecha - pd.Timedelta(days=28))]
    # Promedio sobre 28 días (días sin venta cuentan como 0)
    prom = (ventana.groupby(["store_id", "sku"])["units_sold"].sum() / 28).round(2).rename("unidades_dia_28")
    dia = dia.merge(prom, left_on=["store_id", "sku"], right_index=True, how="left").fillna({"unidades_dia_28": 0})
    dia.columns = ["tienda", "sku", "fecha", "inventario_apertura", "inventario_cierre",
                   "horas_agotado", "unidades_dia_28"]
    dia["fecha"] = dia["fecha"].dt.strftime("%Y-%m-%d")
    return dia


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--fecha", default="2026-03-03")
    fecha = pd.Timestamp(ap.parse_args().fecha)
    SISTEMA.mkdir(parents=True, exist_ok=True)

    crudo = pd.read_csv(GLAZED / "prices.csv", dtype=str)
    productos = pd.read_csv(GLAZED / "products.csv", dtype=str)
    dup = productos["sku"].duplicated().sum()

    precios, descartes = limpiar_precios(crudo)
    m = maestro(precios, productos, fecha)
    m.to_csv(SISTEMA / "maestro_vigente.csv", index=False)

    print(f"prices.csv: {len(crudo)} filas")
    for regla, n in descartes.items():
        print(f"  descartadas por {regla}: {n}")
    print(f"  total descartadas: {sum(descartes.values())}")
    print(f"products.csv: {dup} SKU duplicados (se queda el primero)")
    print(f"maestro_vigente.csv ({fecha.date()}): {len(m)} tienda-SKU, "
          f"{int(m['conflicto'].sum())} con conflicto (dos precios vigentes)")

    inv = inventario(fecha)
    inv.to_csv(SISTEMA / "inventario_dia.csv", index=False)
    print(f"inventario_dia.csv: {len(inv)} filas")


if __name__ == "__main__":
    main()
