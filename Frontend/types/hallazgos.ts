export type TipoHallazgo =
  | 'precio_anterior'
  | 'etiqueta_faltante'
  | 'etiqueta_otro_sku'
  | 'hueco_con_inventario'
  | 'hueco_agotado'
  | 'frentes_bajos'
  | 'revisar'
  | 'precio_distinto';

export type EstadoPosicion = 'ok' | 'error' | 'revisar';

export interface ResumenAnaquel {
  total_problemas: number;
  dinero_en_riesgo_diario: number;
  frase: string;
  etiquetas_con_error: number;
  huecos_inventario: number;
  lecturas_dudosas: number;
  precision_anaquel_pct: number;
  tienda_id?: string;
  tienda_nombre?: string;
  fecha_escaneo?: string;
  disclaimer: string;
}

export interface PosicionAnaquel {
  id: string;
  repisa: number; // 1, 2, 3
  posicion: number; // 1, 2, 3, 4
  estado: EstadoPosicion;
  sku: string;
  producto: string;
  precio_etiqueta: number | null;
  precio_sistema: number;
  frentes: number;
  inventario_sistema: number;
  hallazgo_id: string | null;
  tipo?: TipoHallazgo;
  impacto_diario?: number;
  accion?: string;
  evidencia?: string;
}

export interface Hallazgo {
  id: string;
  tipo: TipoHallazgo;
  producto: string;
  sku: string;
  repisa: number;
  posicion: number;
  precio_etiqueta: number | null;
  precio_sistema: number;
  impacto_diario: number;
  cuadro: number;
  segundo: number;
  descripcion: string;
  accion_sugerida: string;
  evidencia_crop: string;
  corregido: boolean;
}

export interface SalidaHallazgos {
  resumen: ResumenAnaquel;
  posiciones: PosicionAnaquel[];
  hallazgos: Hallazgo[];
}

export interface EnsayoRespuesta {
  origen: 'ensayo' | 'api';
  tarjeta: string;
  timestamp: string;
  pasos_completados: string[];
  hallazgo_nuevo: Hallazgo;
}
