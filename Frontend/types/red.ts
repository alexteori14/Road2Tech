export interface RedResumen {
  tiendas_total: number;
  tiendas_con_incidencias: number;
  skus_afectados: number;
  exposicion_7_dias: number;
  exposicion_14_dias: number;
  exposicion_30_dias: number;
  venta_perdida_anual: number;
  conflictos_maestro_precios: number;
  supuestos_calculo: string;
  dataset_label: string;
  fecha_corte: string;
}

export interface ProyeccionTemporal {
  dia: string;
  exposicion_acumulada: number;
  limite_inferior: number;
  limite_superior: number;
}

export interface TopTienda {
  tienda: string;
  exposicion_mensual: number;
  incidencias: number;
  ciudad: string;
}

export interface DistribucionError {
  tipo: string;
  cantidad: number;
  porcentaje: number;
}

export interface RedData {
  red: RedResumen;
  proyeccion_temporal: ProyeccionTemporal[];
  top_tiendas_impacto: TopTienda[];
  distribucion_tipos_error: DistribucionError[];
}
