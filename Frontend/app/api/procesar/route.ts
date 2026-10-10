import { NextRequest, NextResponse } from 'next/server';
import { setEstadoLocal } from '@/lib/api/session';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const tarjeta = body.tarjeta || 'precio_viejo';

    // 1. Intentar comunicarse primero con la API local de P4 en localhost:8000
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1200);

      const p4Response = await fetch('http://localhost:8000/procesar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tarjeta }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (p4Response.ok) {
        const p4Data = await p4Response.json();
        return NextResponse.json({ ...p4Data, origen: 'api' });
      }
    } catch {
      // P4 inactivo en localhost:8000; continuar con procesamiento local
    }

    // 2. Inicializar ciclo de procesamiento local
    setEstadoLocal({
      tarjeta,
      pasoActual: 1,
      pasos: ['Eligiendo cuadros', 'Leyendo etiquetas', 'Comparando con el sistema'],
      inicioTimestamp: Date.now(),
      completado: false,
      error: false,
    });

    return NextResponse.json({
      status: 'procesando',
      tarjeta,
      paso: 'Eligiendo cuadros',
      origen: 'local_proxy',
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error en /procesar' }, { status: 400 });
  }
}
