// Estado en memoria para el procesamiento de modo jurado
export interface EstadoProcesamiento {
  tarjeta: string;
  pasoActual: number;
  pasos: string[];
  inicioTimestamp: number;
  completado: boolean;
  error: boolean;
}

let estadoProcesamiento: EstadoProcesamiento = {
  tarjeta: '',
  pasoActual: 0,
  pasos: ['Eligiendo cuadros', 'Leyendo etiquetas', 'Comparando con el sistema'],
  inicioTimestamp: 0,
  completado: false,
  error: false,
};

export function getEstadoLocal(): EstadoProcesamiento {
  return estadoProcesamiento;
}

export function setEstadoLocal(nuevoEstado: Partial<EstadoProcesamiento>): void {
  estadoProcesamiento = {
    ...estadoProcesamiento,
    ...nuevoEstado,
  };
}
