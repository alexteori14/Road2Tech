'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  Maximize2,
  Minimize2,
  Tag,
  AlertTriangle,
  Layers,
  CheckCircle2,
  Clock,
  RotateCcw,
  DollarSign,
  ArrowRight,
  ShieldCheck,
  Eye,
  Loader2,
} from 'lucide-react';
import { Hallazgo } from '@/types/hallazgos';
import { formatearMonedaUSD, traducirTipoHallazgo } from '@/lib/formatters/contract';

interface TarjetaOpcion {
  id: string;
  titulo: string;
  subtitulo: string;
  descripcion: string;
  icono: React.ElementType;
  colorBorder: string;
  colorBg: string;
  colorText: string;
}

const OPCIONES_JURADO: TarjetaOpcion[] = [
  {
    id: 'precio_viejo',
    titulo: 'Etiqueta con precio viejo',
    subtitulo: 'Desactualización tras cambio de lista',
    descripcion: 'Simula el escaneo de un anaquel con una etiqueta física impresa anterior a la actualización de precios del catálogo.',
    icono: Tag,
    colorBorder: 'border-rose-400',
    colorBg: 'hover:bg-rose-50/50',
    colorText: 'text-rose-600',
  },
  {
    id: 'etiqueta_faltante',
    titulo: 'Falta la etiqueta',
    subtitulo: 'Exhibición sin cenefa en riel',
    descripcion: 'Detecta productos con frentes físicos en anaquel que carecen de etiqueta de precio en la cenefa metálica.',
    icono: AlertTriangle,
    colorBorder: 'border-amber-400',
    colorBg: 'hover:bg-amber-50/50',
    colorText: 'text-amber-600',
  },
  {
    id: 'hueco_con_inventario',
    titulo: 'Hueco con inventario en sistema',
    subtitulo: 'Rotura de anaquel con stock en tienda',
    descripcion: 'Identifica una posición vacía en la repisa donde el sistema registra existencia física disponible en trastienda.',
    icono: Layers,
    colorBorder: 'border-blue-400',
    colorBg: 'hover:bg-blue-50/50',
    colorText: 'text-blue-600',
  },
  {
    id: 'precio_distinto',
    titulo: 'Precio distinto al sistema',
    subtitulo: 'Discrepancia no concordante con catálogo',
    descripcion: 'Caso crítico donde el precio visible no coincide ni con el vigente ni con el precio histórico anterior.',
    icono: DollarSign,
    colorBorder: 'border-purple-400',
    colorBg: 'hover:bg-purple-50/50',
    colorText: 'text-purple-600',
  },
];

const PASOS_PROCESAMIENTO = [
  { id: 1, nombre: 'Eligiendo cuadros', desc: 'Selección de fotogramas óptimos con estabilización' },
  { id: 2, nombre: 'Leyendo etiquetas', desc: 'Extracción OCR y lectura de códigos de barras' },
  { id: 3, nombre: 'Comparando con el sistema', desc: 'Cruce con el catálogo maestro de precios y stock' },
];

export function ModoJuradoView() {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [tarjetaSeleccionada, setTarjetaSeleccionada] = useState<string | null>(null);
  const [procesando, setProcesando] = useState(false);
  const [pasoActual, setPasoActual] = useState<number>(0);
  const [progreso, setProgreso] = useState<number>(0);
  const [resultado, setResultado] = useState<{
    hallazgo: Hallazgo | null;
    origen: 'api' | 'ensayo';
    mensaje?: string;
  } | null>(null);
  const [highlightActive, setHighlightActive] = useState(false);

  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Toggle de Pantalla Completa
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  // Limpieza de polling al desmontar
  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  // Iniciar procesamiento de tarjeta
  const iniciarProcesamiento = async (tarjetaId: string) => {
    if (procesando) return; // Evitar llamadas duplicadas

    setTarjetaSeleccionada(tarjetaId);
    setProcesando(true);
    setPasoActual(1);
    setProgreso(15);
    setResultado(null);
    setHighlightActive(false);

    try {
      // 1. POST /api/procesar
      await fetch('/api/procesar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tarjeta: tarjetaId }),
      });

      // 2. Iniciar Polling a /api/estado cada 1 segundo
      let intentos = 0;
      pollingRef.current = setInterval(async () => {
        intentos += 1;
        try {
          const res = await fetch('/api/estado');
          if (res.ok) {
            const data = await res.json();
            if (data.pasoNumero) {
              setPasoActual(data.pasoNumero);
            }
            if (data.progreso) {
              setProgreso(data.progreso);
            }

            // Si finalizó
            if (data.completado || data.status === 'completado') {
              if (pollingRef.current) clearInterval(pollingRef.current);
              setProcesando(false);
              setPasoActual(4);
              setProgreso(100);
              setResultado({
                hallazgo: data.hallazgo_nuevo,
                origen: data.origen || 'ensayo',
                mensaje: data.mensaje || 'Resultado de ensayo',
              });

              // Animación de 1.5s de resaltado
              setHighlightActive(true);
              setTimeout(() => {
                setHighlightActive(false);
              }, 1500);
            }
          }
        } catch {
          // Si falla repetidamente o transcurren 60s, recurrir a fallback de ensayo
          if (intentos >= 60) {
            if (pollingRef.current) clearInterval(pollingRef.current);
            cargarEnsayoFallback(tarjetaId);
          }
        }
      }, 1000);
    } catch {
      cargarEnsayoFallback(tarjetaId);
    }
  };

  const cargarEnsayoFallback = async (tarjetaId: string) => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    try {
      const res = await fetch(`/ensayos/${tarjetaId}/hallazgos.json`);
      if (res.ok) {
        const data = await res.json();
        setProcesando(false);
        setPasoActual(4);
        setProgreso(100);
        setResultado({
          hallazgo: data.hallazgo_nuevo,
          origen: 'ensayo',
          mensaje: 'Resultado de ensayo',
        });
        setHighlightActive(true);
        setTimeout(() => setHighlightActive(false), 1500);
      }
    } catch (e) {
      setProcesando(false);
    }
  };

  const reiniciarDemo = () => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    setTarjetaSeleccionada(null);
    setProcesando(false);
    setPasoActual(0);
    setProgreso(0);
    setResultado(null);
    setHighlightActive(false);
  };

  return (
    <div
      ref={containerRef}
      className={`space-y-6 ${
        isFullscreen
          ? 'fixed inset-0 z-50 bg-slate-950 text-white p-8 overflow-y-auto'
          : ''
      }`}
    >
      {/* Barra Superior del Modo Jurado */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-bold bg-teal-50 text-teal-700 border border-teal-200 mb-1">
            <Sparkles className="w-3.5 h-3.5 text-teal-600" />
            <span>Demostración Interactiva en Vivo</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            6. Modo Jurado: Detección en Tiempo Real
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Elige cualquiera de las 4 situaciones operativas para procesar el hallazgo y verificar su evidencia.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {tarjetaSeleccionada && (
            <button
              onClick={reiniciarDemo}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Probar otra tarjeta</span>
            </button>
          )}

          <button
            onClick={toggleFullscreen}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white transition-colors"
          >
            {isFullscreen ? (
              <>
                <Minimize2 className="w-4 h-4" />
                <span>Salir de Pantalla Completa</span>
              </>
            ) : (
              <>
                <Maximize2 className="w-4 h-4" />
                <span>Modo Pantalla Completa</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* ESTADO 1: SELECCIÓN DE LAS 4 TARJETAS GRANDES */}
      {!procesando && !resultado && (
        <div className="space-y-4">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500 font-mono">
            Paso 1: Selecciona una incidencia para ejecutar la inspección
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {OPCIONES_JURADO.map((opcion) => {
              const Icon = opcion.icono;
              return (
                <motion.button
                  key={opcion.id}
                  whileHover={{ scale: 1.015 }}
                  whileTap={{ scale: 0.985 }}
                  onClick={() => iniciarProcesamiento(opcion.id)}
                  className={`text-left p-6 sm:p-7 rounded-2xl border-2 transition-all bg-white shadow-sm hover:shadow-md flex flex-col justify-between h-56 group ${opcion.colorBorder} ${opcion.colorBg}`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className={`w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center ${opcion.colorText} group-hover:scale-110 transition-transform`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <span className="text-[11px] font-mono font-bold text-slate-400 uppercase tracking-wider">
                        CASO DEMO
                      </span>
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 group-hover:text-teal-700 transition-colors">
                      {opcion.titulo}
                    </h3>
                    <p className="text-xs font-semibold text-slate-500 mt-0.5">
                      {opcion.subtitulo}
                    </p>
                    <p className="text-xs text-slate-600 mt-2 line-clamp-2 leading-relaxed">
                      {opcion.descripcion}
                    </p>
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-teal-600">
                    <span>Iniciar procesamiento</span>
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </div>
                </motion.button>
              );
            })}
          </div>
        </div>
      )}

      {/* ESTADO 2: PROCESAMIENTO ACTIVO CON PASOS ANIMADOS */}
      {procesando && (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white p-8 sm:p-12 rounded-2xl border border-slate-200 shadow-md text-center max-w-2xl mx-auto space-y-8"
        >
          <div className="space-y-2">
            <div className="w-14 h-14 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center mx-auto shadow-inner animate-spin">
              <Loader2 className="w-7 h-7" />
            </div>
            <h3 className="text-xl font-bold text-slate-900">
              Procesando Escaneo de Anaquel
            </h3>
            <p className="text-xs text-slate-500">
              Ejecutando pipeline de detección óptica y cruce de datos en tiempo real
            </p>
          </div>

          {/* Barra de progreso visual */}
          <div className="space-y-2">
            <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-teal-600 rounded-full"
                animate={{ width: `${progreso}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
            <div className="flex justify-between text-[11px] font-mono text-slate-400">
              <span>POST /procesar</span>
              <span>GET /estado (polling 1s)</span>
            </div>
          </div>

          {/* Los 3 Pasos del Documento */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-left">
            {PASOS_PROCESAMIENTO.map((paso) => {
              const isDone = pasoActual > paso.id;
              const isCurrent = pasoActual === paso.id;

              return (
                <div
                  key={paso.id}
                  className={`p-3.5 rounded-xl border transition-all ${
                    isDone
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      : isCurrent
                      ? 'bg-teal-50 border-teal-300 text-teal-900 ring-2 ring-teal-500/30'
                      : 'bg-slate-50 border-slate-100 text-slate-400'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-mono font-bold">PASO {paso.id}</span>
                    {isDone && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
                    {isCurrent && <Loader2 className="w-3.5 h-3.5 animate-spin text-teal-600" />}
                  </div>
                  <div className="text-xs font-bold">{paso.nombre}</div>
                  <p className="text-[10px] text-slate-500 mt-1 line-clamp-2">{paso.desc}</p>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* ESTADO 3: HALLAZGO NUEVO RESALTADO CON ANIMACIÓN DE 1.5s */}
      {resultado && resultado.hallazgo && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className={`bg-white rounded-2xl border p-6 sm:p-8 shadow-xl space-y-6 transition-all duration-500 ${
            highlightActive
              ? 'ring-4 ring-teal-400 ring-offset-4 bg-teal-50/20 shadow-2xl scale-[1.01]'
              : 'border-slate-200'
          }`}
        >
          {/* Badge discreto si proviene de ensayo */}
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-emerald-500 animate-ping" />
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider font-mono">
                ¡Nuevo Hallazgo Detectado e Incorporado!
              </span>
            </div>

            {resultado.origen === 'ensayo' && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200">
                <ShieldCheck className="w-3.5 h-3.5 text-slate-500" />
                <span>Resultado de ensayo</span>
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
            {/* Evidencia Fotográfica */}
            <div className="md:col-span-4">
              <div className="rounded-xl overflow-hidden border border-slate-200 bg-slate-900 aspect-video flex items-center justify-center relative shadow-md">
                <img
                  src={resultado.hallazgo.evidencia_crop || '/evidencias/r1_p2.svg'}
                  alt={`Evidencia de ${resultado.hallazgo.producto}`}
                  className="w-full h-full object-cover"
                />
                <span className="absolute bottom-2 left-2 text-[10px] bg-slate-900/80 text-white px-2 py-0.5 rounded font-mono">
                  Cuadro {resultado.hallazgo.cuadro} · {(resultado.hallazgo.cuadro / 30).toFixed(1)}s
                </span>
              </div>
            </div>

            {/* Datos Clave del Nuevo Hallazgo */}
            <div className="md:col-span-5 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-rose-50 text-rose-700 border border-rose-200">
                  {traducirTipoHallazgo(resultado.hallazgo.tipo)}
                </span>
                <span className="text-xs font-mono text-slate-500">
                  SKU: {resultado.hallazgo.sku}
                </span>
              </div>

              <h3 className="text-xl font-extrabold text-slate-900">
                {resultado.hallazgo.producto}
              </h3>

              <div className="text-xs font-mono text-slate-700 bg-slate-50 p-2.5 rounded-lg border border-slate-100 flex gap-4">
                {resultado.hallazgo.precio_etiqueta !== null && (
                  <span>
                    Etiqueta: <strong className="text-rose-600 font-bold">{formatearMonedaUSD(resultado.hallazgo.precio_etiqueta)}</strong>
                  </span>
                )}
                <span>
                  Sistema: <strong className="text-slate-900 font-bold">{formatearMonedaUSD(resultado.hallazgo.precio_sistema)}</strong>
                </span>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">
                {resultado.hallazgo.descripcion}
              </p>

              <div className="text-xs text-slate-700 bg-amber-50/70 p-3 rounded-lg border border-amber-200">
                <strong>Acción sugerida:</strong> {resultado.hallazgo.accion_sugerida}
              </div>
            </div>

            {/* Impacto Económico */}
            <div className="md:col-span-3 text-left md:text-right space-y-4">
              <div>
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block font-mono">
                  Impacto diario nuevo
                </span>
                <span className="text-3xl font-extrabold text-rose-600 font-tabular block">
                  {formatearMonedaUSD(resultado.hallazgo.impacto_diario)}
                </span>
                <span className="text-xs text-slate-500">fuga estimada diaria</span>
              </div>

              <button
                onClick={reiniciarDemo}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-md shadow-teal-700/20 transition-all hover:scale-105"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Probar otro caso de jurado</span>
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
