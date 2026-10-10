'use client';

import React, { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Play,
  Pause,
  RotateCcw,
  SkipBack,
  SkipForward,
  Clock,
  AlertTriangle,
  Tag,
  CheckCircle2,
  ExternalLink,
  ChevronRight,
  ChevronLeft,
} from 'lucide-react';
import { SalidaHallazgos, Hallazgo } from '@/types/hallazgos';
import {
  formatearMonedaUSD,
  formatearPrecioEtiqueta,
  traducirTipoHallazgo,
  cuadroASegundos,
  formatearTiempoVideo,
} from '@/lib/formatters/contract';

interface RecorridoViewProps {
  data: SalidaHallazgos;
}

export function RecorridoView({ data }: RecorridoViewProps) {
  const { hallazgos } = data;
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(30);
  const [selectedHallazgo, setSelectedHallazgo] = useState<Hallazgo>(hallazgos[0] || null);

  // Alternar reproducción
  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  // Actualización de tiempo
  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  // Salto a un hallazgo específico
  const jumpToHallazgo = (h: Hallazgo) => {
    const targetSecond = h.segundo || cuadroASegundos(h.cuadro);
    if (videoRef.current) {
      videoRef.current.currentTime = Math.min(targetSecond, duration);
      if (!isPlaying) {
        videoRef.current.play().catch(() => {});
        setIsPlaying(true);
      }
    }
    setSelectedHallazgo(h);
  };

  // Navegación anterior / siguiente
  const currentIndex = hallazgos.findIndex((h) => h.id === selectedHallazgo?.id);
  const handlePrev = () => {
    if (currentIndex > 0) {
      jumpToHallazgo(hallazgos[currentIndex - 1]);
    }
  };
  const handleNext = () => {
    if (currentIndex < hallazgos.length - 1) {
      jumpToHallazgo(hallazgos[currentIndex + 1]);
    }
  };

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div>
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
          2. Recorrido Anotado del Anaquel
        </h2>
        <p className="text-slate-500 text-sm mt-1">
          Video sincronizado con detección temporal por visión computacional (cuadro &divide; 30).
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Columna Principal: Reproductor y Línea de Tiempo */}
        <div className="lg:col-span-8 space-y-4">
          {/* Contenedor del Video */}
          <div className="bg-slate-950 rounded-2xl overflow-hidden shadow-lg border border-slate-800 relative aspect-video flex items-center justify-center">
            <video
              ref={videoRef}
              src="/recorrido_anotado.mp4"
              className="w-full h-full object-contain"
              onTimeUpdate={handleTimeUpdate}
              onLoadedMetadata={() => {
                if (videoRef.current) {
                  setDuration(videoRef.current.duration || 30);
                }
              }}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
            >
              Tu navegador no soporta el elemento de video.
            </video>

            {/* Overlay de datos en tiempo real */}
            <div className="absolute top-3 left-3 bg-slate-900/80 backdrop-blur-xs text-white text-xs px-3 py-1.5 rounded-lg border border-slate-700/60 font-mono flex items-center gap-3">
              <span className="flex items-center gap-1.5 text-teal-400">
                <Clock className="w-3.5 h-3.5" />
                {formatearTiempoVideo(currentTime)} / {formatearTiempoVideo(duration)}
              </span>
              <span className="text-slate-400">|</span>
              <span className="text-slate-300">
                Cuadro: {Math.floor(currentTime * 30)}
              </span>
            </div>

            {/* Badge de hallazgo activo sobre el video si coincide el tiempo */}
            {selectedHallazgo && (
              <div className="absolute bottom-4 left-4 right-4 bg-slate-900/90 backdrop-blur-md p-3 rounded-xl border border-slate-700 text-white flex items-center justify-between shadow-xl">
                <div className="flex items-center gap-3">
                  <span className="w-7 h-7 rounded-lg bg-rose-600 text-white flex items-center justify-center font-bold text-xs">
                    R{selectedHallazgo.repisa}-P{selectedHallazgo.posicion}
                  </span>
                  <div>
                    <div className="text-xs font-bold text-slate-100 flex items-center gap-2">
                      {selectedHallazgo.producto}
                      <span className="text-rose-400 text-[11px] font-semibold">
                        ({traducirTipoHallazgo(selectedHallazgo.tipo)})
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-300 line-clamp-1 mt-0.5">
                      {selectedHallazgo.descripcion}
                    </div>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-xs font-bold text-rose-400 font-tabular">
                    {formatearMonedaUSD(selectedHallazgo.impacto_diario)}/día
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Controles y Línea de Tiempo Interactiva */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
            {/* Barra de progreso con marcadores temporales de hallazgos */}
            <div className="relative w-full h-8 flex items-center select-none">
              {/* Pista de tiempo base */}
              <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden relative cursor-pointer"
                   onClick={(e) => {
                     const rect = e.currentTarget.getBoundingClientRect();
                     const clickX = e.clientX - rect.left;
                     const newTime = (clickX / rect.width) * duration;
                     if (videoRef.current) {
                       videoRef.current.currentTime = newTime;
                     }
                   }}
              >
                <div
                  className="h-full bg-teal-600 rounded-full transition-all duration-75"
                  style={{ width: `${(currentTime / duration) * 100}%` }}
                />
              </div>

              {/* Marcadores de hallazgos en la línea de tiempo */}
              {hallazgos.map((h) => {
                const markerTime = h.segundo || cuadroASegundos(h.cuadro);
                const percent = Math.min((markerTime / duration) * 100, 100);
                const isSelected = selectedHallazgo?.id === h.id;

                return (
                  <button
                    key={h.id}
                    onClick={() => jumpToHallazgo(h)}
                    title={`Saltar a ${h.producto} (${markerTime}s)`}
                    className={`absolute -translate-x-1/2 top-1.5 w-4 h-4 rounded-full border-2 transition-transform hover:scale-125 focus:outline-hidden ${
                      isSelected
                        ? 'bg-rose-500 border-white ring-2 ring-rose-500 z-20 scale-110'
                        : 'bg-amber-400 border-white z-10'
                    }`}
                    style={{ left: `${percent}%` }}
                  />
                );
              })}
            </div>

            {/* Controles de reproducción */}
            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center gap-2">
                <button
                  onClick={togglePlay}
                  className="p-2.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white transition-colors"
                  aria-label={isPlaying ? 'Pausar' : 'Reproducir'}
                >
                  {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-white" />}
                </button>
                <button
                  onClick={() => {
                    if (videoRef.current) videoRef.current.currentTime = 0;
                  }}
                  className="p-2.5 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors"
                  title="Reiniciar"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
                <span className="text-xs font-mono font-medium text-slate-600 ml-2">
                  {formatearTiempoVideo(currentTime)} / {formatearTiempoVideo(duration)}
                </span>
              </div>

              {/* Navegación entre hallazgos */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 mr-1 hidden sm:inline">
                  Hallazgo {currentIndex + 1} de {hallazgos.length}
                </span>
                <button
                  onClick={handlePrev}
                  disabled={currentIndex <= 0}
                  className="p-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  title="Hallazgo anterior"
                >
                  <SkipBack className="w-4 h-4" />
                </button>
                <button
                  onClick={handleNext}
                  disabled={currentIndex >= hallazgos.length - 1}
                  className="p-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  title="Siguiente hallazgo"
                >
                  <SkipForward className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Columna Lateral: Lista de "Saltar a" y Detalle del Hallazgo */}
        <div className="lg:col-span-4 space-y-4">
          {/* Tarjeta del Hallazgo Seleccionado */}
          {selectedHallazgo && (
            <motion.div
              key={selectedHallazgo.id}
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 font-mono">
                  Evidencia en Cuadro {selectedHallazgo.cuadro}
                </span>
                <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-rose-50 text-rose-700 border border-rose-200">
                  {traducirTipoHallazgo(selectedHallazgo.tipo)}
                </span>
              </div>

              <div>
                <h3 className="font-bold text-slate-900 text-base">
                  {selectedHallazgo.producto}
                </h3>
                <div className="text-xs text-slate-500 font-mono mt-0.5">
                  SKU: {selectedHallazgo.sku} · Repisa {selectedHallazgo.repisa}, Posición {selectedHallazgo.posicion}
                </div>
              </div>

              {/* Imagen/Recorte de evidencia */}
              <div className="rounded-lg overflow-hidden border border-slate-200 bg-slate-900 aspect-video flex items-center justify-center relative">
                <img
                  src={selectedHallazgo.evidencia_crop}
                  alt={`Recorte de ${selectedHallazgo.producto}`}
                  className="w-full h-full object-cover"
                />
                <span className="absolute bottom-2 right-2 text-[10px] bg-slate-900/80 text-white px-2 py-0.5 rounded font-mono">
                  Recorte óptico
                </span>
              </div>

              {/* Comparativa de Precios */}
              <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-lg border border-slate-100 text-center font-mono">
                <div>
                  <div className="text-[11px] text-slate-500">Etiqueta</div>
                  <div className="text-sm font-bold text-rose-600">
                    {formatearPrecioEtiqueta(selectedHallazgo.precio_etiqueta)}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-slate-500">Sistema</div>
                  <div className="text-sm font-bold text-slate-900">
                    {formatearMonedaUSD(selectedHallazgo.precio_sistema)}
                  </div>
                </div>
              </div>

              <div className="text-xs text-slate-600 leading-relaxed bg-amber-50/60 p-3 rounded-lg border border-amber-200/60">
                <strong className="text-slate-800">Acción sugerida:</strong> {selectedHallazgo.accion_sugerida}
              </div>

              <div className="flex items-center justify-between text-xs pt-1">
                <span className="text-slate-500">Impacto diario estimado:</span>
                <span className="text-sm font-bold text-rose-600 font-tabular">
                  {formatearMonedaUSD(selectedHallazgo.impacto_diario)} / día
                </span>
              </div>
            </motion.div>
          )}

          {/* Lista de enlaces accesibles "Saltar a" */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3">
              Índice Temporal de Hallazgos
            </h4>
            <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
              {hallazgos.map((h, idx) => {
                const isSelected = selectedHallazgo?.id === h.id;
                const seg = h.segundo || cuadroASegundos(h.cuadro);
                return (
                  <button
                    key={h.id}
                    onClick={() => jumpToHallazgo(h)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs flex items-center justify-between transition-colors ${
                      isSelected
                        ? 'bg-teal-50 text-teal-800 font-semibold border border-teal-200'
                        : 'hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-600 font-mono text-[10px] flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>
                      <span className="truncate">{h.producto}</span>
                    </div>
                    <span className="font-mono text-[11px] text-slate-500 shrink-0 ml-2">
                      {formatearTiempoVideo(seg)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
