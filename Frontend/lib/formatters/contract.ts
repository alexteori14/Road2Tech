import { TipoHallazgo, EstadoPosicion } from '@/types/hallazgos';

/**
 * Diccionario de textos obligatorios según frontend.pdf
 */
export const DICCIONARIO_HALLAZGOS: Record<TipoHallazgo, string> = {
  precio_anterior: 'Etiqueta con precio viejo',
  etiqueta_faltante: 'Falta la etiqueta',
  etiqueta_otro_sku: 'Etiqueta de otro producto',
  hueco_con_inventario: 'Hueco, pero el sistema dice que hay',
  hueco_agotado: 'Agotado: pedir resurtido',
  frentes_bajos: 'Pocos frentes',
  revisar: 'Lectura dudosa: revisar',
  precio_distinto: 'Precio distinto al sistema',
};

/**
 * Traduce un valor interno a su texto amigable visible.
 */
export function traducirTipoHallazgo(tipo?: string | null): string {
  if (!tipo) return 'Sin incidencia';
  if (tipo in DICCIONARIO_HALLAZGOS) {
    return DICCIONARIO_HALLAZGOS[tipo as TipoHallazgo];
  }
  // En caso de un valor inesperado, mostrar etiqueta alternativa comprensible
  return `Incidencia no clasificada (${tipo})`;
}

/**
 * Traduce el estado de una posición del anaquel.
 */
export function traducirEstadoPosicion(estado: EstadoPosicion): string {
  switch (estado) {
    case 'ok':
      return 'Correcto';
    case 'error':
      return 'Error detectado';
    case 'revisar':
      return 'Lectura dudosa: revisar';
    default:
      return 'Desconocido';
  }
}

/**
 * Formateador de dinero en formato US$25.80 y números en español de México (es-MX).
 */
export function formatearMonedaUSD(monto: number | null | undefined): string {
  if (monto === null || monto === undefined || isNaN(monto)) {
    return '$0.00';
  }
  const valorFormateado = new Intl.NumberFormat('es-MX', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(monto);

  return `$${valorFormateado}`;
}

/**
 * Formatea el precio de etiqueta considerando etiquetas ausentes o no detectadas.
 */
export function formatearPrecioEtiqueta(precio: number | null | undefined): string {
  if (precio === null || precio === undefined || precio <= 0) {
    return 'Sin etiqueta';
  }
  return formatearMonedaUSD(precio);
}

/**
 * Formateador de números enteros o decimales en español de México.
 */
export function formatearNumero(numero: number | null | undefined): string {
  if (numero === null || numero === undefined || isNaN(numero)) {
    return '0';
  }
  return new Intl.NumberFormat('es-MX').format(numero);
}

/**
 * Convierte un número de cuadro de video a segundos (segundo = cuadro / 30).
 */
export function cuadroASegundos(cuadro: number): number {
  return Number((cuadro / 30).toFixed(2));
}

/**
 * Formatea segundos a formato de video mm:ss.
 */
export function formatearTiempoVideo(segundos: number): string {
  const mins = Math.floor(segundos / 60);
  const secs = Math.floor(segundos % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}
