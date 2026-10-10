import { NextRequest, NextResponse } from 'next/server';
import { getEstadoLocal } from '@/lib/api/session';
import { getEnsayoData } from '@/lib/data/loader';

export async function GET(req: NextRequest) {
  // 1. Intentar consultar primero la API real de P4 si estuviera disponible
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1000);

    const p4Response = await fetch('http://localhost:8000/estado', {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (p4Response.ok) {
      const data = await p4Response.json();
      return NextResponse.json({ ...data, origen: 'api' });
    }
  } catch {
    // Si falla o no responde, continuar con el estado local
  }

  // 2. Control del estado local
  const estado = getEstadoLocal();
  if (!estado.tarjeta || estado.inicioTimestamp === 0) {
    return NextResponse.json({
      status: 'inactivo',
      paso: null,
      completado: false,
    });
  }

  const elapsedSeconds = (Date.now() - estado.inicioTimestamp) / 1000;

  // Transición de pasos según tiempo transcurrido (2s por paso = 6s total)
  let pasoActualNombre = 'Eligiendo cuadros';
  let pasoNumero = 1;
  let finalizado = false;

  if (elapsedSeconds < 2.0) {
    pasoActualNombre = 'Eligiendo cuadros';
    pasoNumero = 1;
  } else if (elapsedSeconds < 4.0) {
    pasoActualNombre = 'Leyendo etiquetas';
    pasoNumero = 2;
  } else if (elapsedSeconds < 6.0) {
    pasoActualNombre = 'Comparando con el sistema';
    pasoNumero = 3;
  } else {
    pasoActualNombre = 'Completado';
    pasoNumero = 4;
    finalizado = true;
  }

  if (finalizado) {
    const ensayo = getEnsayoData(estado.tarjeta);
    return NextResponse.json({
      status: 'completado',
      completado: true,
      paso: 'Completado',
      pasoNumero: 4,
      tarjeta: estado.tarjeta,
      origen: 'ensayo',
      hallazgo_nuevo: ensayo?.hallazgo_nuevo || null,
      mensaje: 'Resultado de ensayo',
    });
  }

  return NextResponse.json({
    status: 'procesando',
    completado: false,
    paso: pasoActualNombre,
    pasoNumero,
    tarjeta: estado.tarjeta,
    progreso: Math.min(Math.round((elapsedSeconds / 6.0) * 100), 95),
    origen: 'ensayo',
  });
}
