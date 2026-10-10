import fs from 'fs';
import path from 'path';
import { SalidaHallazgos, EnsayoRespuesta } from '@/types/hallazgos';
import { RedData } from '@/types/red';

/**
 * Carga segura de hallazgos.json desde public/salida/
 */
export function getHallazgosData(): SalidaHallazgos {
  try {
    const filePath = path.join(process.cwd(), 'public', 'salida', 'hallazgos.json');
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(content) as SalidaHallazgos;
    }
  } catch (error) {
    console.error('Error al leer public/salida/hallazgos.json:', error);
  }

  // Estado seguro por defecto en caso de ausencia
  return {
    resumen: {
      total_problemas: 0,
      dinero_en_riesgo_diario: 0,
      frase: '0 problemas detectados · Anaquel sin incidencias reportadas',
      etiquetas_con_error: 0,
      huecos_inventario: 0,
      lecturas_dudosas: 0,
      precision_anaquel_pct: 100,
      disclaimer: 'Video simulado · Datos de dataset_2 (Tienda S012)',
    },
    posiciones: [],
    hallazgos: [],
  };
}

/**
 * Carga segura de red.json desde public/
 */
export function getRedData(): RedData {
  try {
    const filePath = path.join(process.cwd(), 'public', 'red.json');
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(content) as RedData;
    }
  } catch (error) {
    console.error('Error al leer public/red.json:', error);
  }

  // Estado seguro por defecto
  return {
    red: {
      tiendas_total: 35,
      tiendas_con_incidencias: 0,
      skus_afectados: 0,
      exposicion_7_dias: 0,
      exposicion_14_dias: 0,
      exposicion_30_dias: 0,
      venta_perdida_anual: 0,
      conflictos_maestro_precios: 0,
      supuestos_calculo: 'Sin datos disponibles de red',
      dataset_label: 'Dataset 2 · Cadena de Tiendas',
      fecha_corte: new Date().toISOString().split('T')[0],
    },
    proyeccion_temporal: [],
    top_tiendas_impacto: [],
    distribucion_tipos_error: [],
  };
}

/**
 * Carga de datos de ensayo para modo jurado
 */
export function getEnsayoData(tarjeta: string): EnsayoRespuesta | null {
  try {
    const filePath = path.join(process.cwd(), 'public', 'ensayos', tarjeta, 'hallazgos.json');
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(content) as EnsayoRespuesta;
    }
  } catch (error) {
    console.error(`Error al cargar ensayo para tarjeta ${tarjeta}:`, error);
  }
  return null;
}
