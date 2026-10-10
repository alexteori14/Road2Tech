'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  X,
  Tag,
  DollarSign,
  Package,
  Layers,
  ArrowRight,
} from 'lucide-react';
import { SalidaHallazgos, PosicionAnaquel } from '@/types/hallazgos';
import {
  formatearMonedaUSD,
  traducirTipoHallazgo,
  traducirEstadoPosicion,
} from '@/lib/formatters/contract';

interface AnaquelViewProps {
  data: SalidaHallazgos;
}

export function AnaquelView({ data }: AnaquelViewProps) {
  const { posiciones } = data;
  const [selectedPos, setSelectedPos] = useState<PosicionAnaquel | null>(
    posiciones.find((p) => p.estado === 'error') || posiciones[0] || null
  );

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
            3. Gemelo Digital del Anaquel
          </h2>
          <p className="text-slate-500 text-sm mt-1">
            Estructura física 3 &times; 4 (12 posiciones). Toca cualquier producto para abrir su tarjeta de inspección.
          </p>
        </div>

        {/* Leyenda Semántica Accesible */}
        <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-xs text-xs font-medium">
          <div className="flex items-center gap-1.5 text-emerald-700">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Correcto</span>
          </div>
          <div className="flex items-center gap-1.5 text-rose-700">
            <AlertTriangle className="w-4 h-4 text-rose-600" />
            <span>Error</span>
          </div>
          <div className="flex items-center gap-1.5 text-amber-700">
            <AlertCircle className="w-4 h-4 text-amber-600" />
            <span>Revisar</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Estructura Física del Anaquel (3 repisas) */}
        <div className="lg:col-span-8 bg-slate-900 p-4 sm:p-6 rounded-2xl border border-slate-800 shadow-xl space-y-4 sm:space-y-5 relative">
          <div className="absolute top-3.5 right-4 text-[11px] font-mono text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded">
            Vista Frontal · Módulo 01
          </div>

          {[1, 2, 3].map((repisaNum) => {
            const repisaItems = posiciones.filter((p) => p.repisa === repisaNum);
            const nombreRepisa =
              repisaNum === 1
                ? 'Repisa 1 · Nivel Superior (Panadería y Donas)'
                : repisaNum === 2
                ? 'Repisa 2 · Nivel Medio (Cafetería y Bebidas Frías)'
                : 'Repisa 3 · Nivel Inferior (Alimentos Preparados y Grab & Go)';

            return (
              <div key={repisaNum} className="space-y-2">
                <div className="flex items-center justify-between text-xs font-mono text-slate-400">
                  <span className="font-semibold text-slate-300">{nombreRepisa}</span>
                  <span className="text-[10px]">4 POSICIONES</span>
                </div>

                {/* Grid de 4 posiciones de la repisa */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {repisaItems.map((pos, idx) => {
                    const isSelected = selectedPos?.id === pos.id;
                    const isOk = pos.estado === 'ok';
                    const isError = pos.estado === 'error';
                    const isRevisar = pos.estado === 'revisar';

                    const borderClass = isSelected
                      ? 'ring-3 ring-teal-400 border-white scale-[1.02] shadow-lg shadow-teal-500/20'
                      : 'border-slate-700 hover:border-slate-500 hover:scale-[1.01]';

                    const bgCard = isOk
                      ? 'bg-emerald-950/40 border-emerald-800/60'
                      : isError
                      ? 'bg-rose-950/40 border-rose-800/70'
                      : 'bg-amber-950/40 border-amber-800/60';

                    return (
                      <motion.button
                        key={pos.id}
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.25, delay: idx * 0.04 }}
                        onClick={() => setSelectedPos(pos)}
                        className={`text-left p-3 rounded-xl border transition-all flex flex-col justify-between h-28 sm:h-32 relative select-none ${bgCard} ${borderClass}`}
                      >
                        {/* Header del bloque: Posición + Icono de estado */}
                        <div className="flex items-center justify-between w-full">
                          <span className="text-[10px] font-mono text-slate-400 bg-slate-800/80 px-1 py-0.2 rounded">
                            P{pos.posicion}
                          </span>
                          {isOk && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400">
                              <CheckCircle2 className="w-3 h-3" />
                              OK
                            </span>
                          )}
                          {isError && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-400">
                              <AlertTriangle className="w-3 h-3" />
                              ERROR
                            </span>
                          )}
                          {isRevisar && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-400">
                              <AlertCircle className="w-3 h-3" />
                              REVISAR
                            </span>
                          )}
                        </div>

                        {/* Nombre y SKU del producto */}
                        <div className="my-0.5">
                          <div className="text-[11px] sm:text-xs font-bold text-white line-clamp-1 leading-tight">
                            {pos.producto}
                          </div>
                          <div className="text-[9px] text-slate-400 font-mono">
                            {pos.sku}
                          </div>
                        </div>

                        {/* Pie del bloque: Frentes y Precio */}
                        <div className="w-full pt-1 border-t border-slate-700/60 flex items-center justify-between text-[10px] sm:text-[11px] font-mono">
                          <span className="text-slate-400">
                            {pos.frentes} frentes
                          </span>
                          <span className="font-bold text-slate-200">
                            {pos.precio_sistema ? formatearMonedaUSD(pos.precio_sistema) : '-'}
                          </span>
                        </div>
                      </motion.button>
                    );
                  })}
                </div>

                {/* Barra física de repisa con riel metálico porta-etiquetas */}
                <div className="w-full h-2.5 bg-gradient-to-r from-slate-600 via-slate-500 to-slate-600 rounded-xs shadow-md border-t border-slate-400/40 relative">
                  <div className="absolute inset-0 flex items-center justify-around opacity-40">
                    <div className="w-2 h-1 bg-slate-900 rounded-xs" />
                    <div className="w-2 h-1 bg-slate-900 rounded-xs" />
                    <div className="w-2 h-1 bg-slate-900 rounded-xs" />
                    <div className="w-2 h-1 bg-slate-900 rounded-xs" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Panel Lateral: Detalle e Inspección de la Posición */}
        <div className="lg:col-span-4">
          <AnimatePresence mode="wait">
            {selectedPos ? (
              <motion.div
                key={selectedPos.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.2 }}
                className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3.5 sticky top-20"
              >
                {/* Header del detalle */}
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">
                      Repisa {selectedPos.repisa} · Posición {selectedPos.posicion}
                    </span>
                    <h3 className="text-base font-bold text-slate-900 leading-tight">
                      {selectedPos.producto}
                    </h3>
                    <p className="text-[11px] text-slate-500 font-mono">SKU: {selectedPos.sku}</p>
                  </div>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-xs font-bold inline-flex items-center gap-1 ${
                      selectedPos.estado === 'ok'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : selectedPos.estado === 'error'
                        ? 'bg-rose-50 text-rose-700 border border-rose-200'
                        : 'bg-amber-50 text-amber-700 border border-amber-200'
                    }`}
                  >
                    {selectedPos.estado === 'ok' && <CheckCircle2 className="w-3 h-3" />}
                    {selectedPos.estado === 'error' && <AlertTriangle className="w-3 h-3" />}
                    {selectedPos.estado === 'revisar' && <AlertCircle className="w-3 h-3" />}
                    {traducirEstadoPosicion(selectedPos.estado)}
                  </span>
                </div>

                {/* Evidencia fotográfica / Recorte óptico */}
                <div>
                  <div className="rounded-lg overflow-hidden border border-slate-200 bg-slate-900 aspect-video flex items-center justify-center relative shadow-xs">
                    <img
                      src={selectedPos.evidencia || '/evidencias/r1_p1.svg'}
                      alt={`Evidencia de ${selectedPos.producto}`}
                      className="w-full h-full object-cover"
                    />
                    <span className="absolute bottom-1.5 right-1.5 text-[9px] bg-slate-900/80 text-white px-2 py-0.5 rounded font-mono">
                      Cámara HD · Anaquel
                    </span>
                  </div>
                </div>

                {/* Métricas clave de la posición */}
                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                  <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                    <span className="text-slate-500 block text-[10px]">Precio en Etiqueta</span>
                    <span className="text-xs font-bold text-rose-600 block mt-0.5">
                      {selectedPos.precio_etiqueta !== null && selectedPos.precio_etiqueta > 0
                        ? formatearMonedaUSD(selectedPos.precio_etiqueta)
                        : 'Sin etiqueta'}
                    </span>
                  </div>
                  <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                    <span className="text-slate-500 block text-[10px]">Precio en Sistema / POS</span>
                    <span className="text-xs font-bold text-slate-900 block mt-0.5">
                      {formatearMonedaUSD(selectedPos.precio_sistema)}
                    </span>
                  </div>
                  <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                    <span className="text-slate-500 block text-[10px]">Frentes Exhibidos</span>
                    <span className="text-xs font-bold text-slate-900 block mt-0.5">
                      {selectedPos.frentes} unidades
                    </span>
                  </div>
                  <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                    <span className="text-slate-500 block text-[10px]">Stock en Almacén</span>
                    <span className="text-xs font-bold text-slate-900 block mt-0.5">
                      {selectedPos.inventario_sistema} piezas
                    </span>
                  </div>
                </div>

                {/* Tipo de Incidencia e Impacto Económico */}
                {selectedPos.tipo && (
                  <div className="bg-rose-50/70 p-3 rounded-xl border border-rose-200/80 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-rose-800">
                        {traducirTipoHallazgo(selectedPos.tipo)}
                      </span>
                      {selectedPos.impacto_diario !== undefined && (
                        <span className="text-xs font-bold text-rose-700 font-tabular">
                          {formatearMonedaUSD(selectedPos.impacto_diario)} / día
                        </span>
                      )}
                    </div>
                    {selectedPos.accion && (
                      <p className="text-[11px] text-rose-900/90 leading-tight">
                        <strong>Acción recomendada:</strong> {selectedPos.accion}
                      </p>
                    )}
                  </div>
                )}
              </motion.div>
            ) : (
              <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center text-slate-500">
                Selecciona una posición del anaquel para ver su ficha técnica.
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
