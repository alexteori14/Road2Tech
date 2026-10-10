'use client';

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Video,
  AlertTriangle,
  DollarSign,
  CheckCircle2,
  ArrowRight,
  TrendingUp,
  Tag,
  Grid3X3,
} from 'lucide-react';
import { SalidaHallazgos } from '@/types/hallazgos';
import {
  formatearMonedaUSD,
  traducirTipoHallazgo,
} from '@/lib/formatters/contract';

interface ResumenViewProps {
  data: SalidaHallazgos;
}

export function ResumenView({ data }: ResumenViewProps) {
  const { resumen, posiciones, hallazgos } = data;
  const topHallazgos = [...hallazgos].sort((a, b) => b.impacto_diario - a.impacto_diario).slice(0, 3);

  return (
    <div className="space-y-5 lg:space-y-6 animate-fadeIn">
      {/* 1. FRASE GIGANTE PRINCIPAL */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="bg-white rounded-2xl p-5 lg:p-6 border border-slate-200/90 shadow-xs relative overflow-hidden"
      >
        <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-teal-500/10 to-transparent pointer-events-none" />
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200 mb-2.5">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
            <span>Auditoría de Anaquel Activa</span>
          </div>
          <h2 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-slate-900 tracking-tight leading-tight">
            <span className="text-rose-600 font-tabular">{resumen.total_problemas} problemas</span> en este anaquel ·{' '}
            <span className="text-teal-700 font-tabular">{formatearMonedaUSD(resumen.dinero_en_riesgo_diario)}</span> al día en juego
          </h2>
          <p className="mt-2 text-slate-600 text-xs sm:text-sm leading-relaxed">
            Detección automática en tiempo real mediante visión computacional: discrepancias de precios, etiquetas desactualizadas y faltantes con inventario en sistema.
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Link
              href="/recorrido"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs shadow-md shadow-teal-700/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <Video className="w-4 h-4" />
              <span>Ver recorrido</span>
              <ArrowRight className="w-4 h-4 ml-0.5" />
            </Link>
            <Link
              href="/anaquel"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-medium text-xs transition-colors border border-slate-200"
            >
              <Grid3X3 className="w-4 h-4 text-slate-600" />
              <span>Inspeccionar gemelo digital</span>
            </Link>
          </div>
        </div>
      </motion.div>

      {/* 2. TRES TARJETAS DE INDICADORES PRINCIPALES */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* KPI 1: Dinero en Riesgo */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.05 }}
          className="bg-white p-6 rounded-xl border border-slate-200/90 shadow-sm relative"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Exposición Diaria
            </span>
            <div className="w-9 h-9 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-extrabold text-slate-900 font-tabular">
              {formatearMonedaUSD(resumen.dinero_en_riesgo_diario)}
            </div>
            <p className="mt-1 text-xs text-slate-500 font-medium">
              Impacto económico directo acumulable cada 24 horas
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-rose-600 font-medium">
            <span>Proyección a 30 días:</span>
            <span className="font-tabular font-bold">{formatearMonedaUSD(resumen.dinero_en_riesgo_diario * 30)}</span>
          </div>
        </motion.div>

        {/* KPI 2: Incidencias de Precios y Cenefas */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="bg-white p-6 rounded-xl border border-slate-200/90 shadow-sm"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Errores en Etiquetas
            </span>
            <div className="w-9 h-9 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <Tag className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-extrabold text-slate-900 font-tabular">
              {resumen.etiquetas_con_error} <span className="text-lg font-normal text-slate-400">/ 12 pos</span>
            </div>
            <p className="mt-1 text-xs text-slate-500 font-medium">
              Precios viejos, discrepancias de catálogo y etiquetas faltantes
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600 font-medium">
            <span>Huecos con inventario:</span>
            <span className="font-tabular font-bold text-slate-800">{resumen.huecos_inventario} productos</span>
          </div>
        </motion.div>

        {/* KPI 3: Precisión de Anaquel */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.15 }}
          className="bg-white p-6 rounded-xl border border-slate-200/90 shadow-sm"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Salud del Anaquel
            </span>
            <div className="w-9 h-9 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-extrabold text-slate-900 font-tabular">
              {resumen.precision_anaquel_pct}%
            </div>
            <p className="mt-1 text-xs text-slate-500 font-medium">
              Posiciones que cumplen 100% planograma y precio vigente
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600 font-medium">
            <span>Lecturas a verificar:</span>
            <span className="font-tabular font-bold text-amber-600">{resumen.lecturas_dudosas} posición</span>
          </div>
        </motion.div>
      </div>

      {/* 3. VISTA PREVIA RÁPIDA: MINIATURA DE ANAQUEL + TOP HALLAZGOS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Miniatura visual del anaquel (3 repisas x 4 posiciones) */}
        <div className="lg:col-span-6 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-slate-900 text-base">Estado Visual del Anaquel</h3>
              <p className="text-xs text-slate-500">Representación compacta de las 12 posiciones (3 repisas)</p>
            </div>
            <Link
              href="/anaquel"
              className="text-xs font-semibold text-teal-700 hover:text-teal-800 flex items-center gap-1"
            >
              <span>Ver detalle</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="space-y-3 bg-slate-900/90 p-4 rounded-xl border border-slate-800">
            {[1, 2, 3].map((repisaNum) => {
              const repisaItems = posiciones.filter((p) => p.repisa === repisaNum);
              return (
                <div key={repisaNum} className="space-y-1">
                  <div className="flex justify-between items-center text-[10px] text-slate-400 font-mono">
                    <span>REPISA {repisaNum}</span>
                    <span>4 POSICIONES</span>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {repisaItems.map((pos) => {
                      const bg =
                        pos.estado === 'ok'
                          ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                          : pos.estado === 'error'
                          ? 'bg-rose-500/20 border-rose-500/60 text-rose-300'
                          : 'bg-amber-500/20 border-amber-500/50 text-amber-300';
                      return (
                        <div
                          key={pos.id}
                          className={`p-2 rounded border text-center text-xs font-mono transition-transform hover:scale-105 ${bg}`}
                        >
                          <div className="text-[10px] opacity-75">P{pos.posicion}</div>
                          <div className="font-bold truncate mt-0.5">{pos.sku}</div>
                          <div className="text-[9px] uppercase mt-1 tracking-wider">
                            {pos.estado === 'ok' ? 'OK' : pos.estado === 'error' ? 'ERROR' : 'REV'}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {/* Barra metálica de la repisa */}
                  <div className="h-1.5 bg-slate-700 rounded w-full shadow-xs mt-1" />
                </div>
              );
            })}
          </div>

          <div className="mt-4 flex items-center justify-center gap-6 text-xs text-slate-600 font-medium">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-emerald-500" />
              <span>Correcto (4)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-rose-500" />
              <span>Error (7)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-amber-500" />
              <span>Revisar (1)</span>
            </div>
          </div>
        </div>

        {/* Acceso claro a hallazgos prioritarios */}
        <div className="lg:col-span-6 bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold text-slate-900 text-base">Hallazgos Prioritarios por Impacto</h3>
                <p className="text-xs text-slate-500">Principales fugas económicas detectadas</p>
              </div>
              <Link
                href="/hallazgos"
                className="text-xs font-semibold text-teal-700 hover:text-teal-800 flex items-center gap-1"
              >
                <span>Ver todos ({resumen.total_problemas})</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="space-y-3">
              {topHallazgos.map((hallazgo, idx) => (
                <div
                  key={hallazgo.id}
                  className="p-3.5 rounded-lg border border-slate-100 bg-slate-50/70 hover:bg-slate-100/80 transition-colors flex items-start justify-between gap-3"
                >
                  <div className="flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full bg-rose-100 text-rose-700 text-xs font-bold flex items-center justify-center mt-0.5">
                      {idx + 1}
                    </span>
                    <div>
                      <div className="font-semibold text-sm text-slate-900">{hallazgo.producto}</div>
                      <div className="text-xs text-rose-700 font-medium mt-0.5">
                        {traducirTipoHallazgo(hallazgo.tipo)}
                      </div>
                      <div className="text-xs text-slate-500 mt-1 line-clamp-1">
                        {hallazgo.descripcion}
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-bold text-rose-700 font-tabular">
                      {formatearMonedaUSD(hallazgo.impacto_diario)}
                    </div>
                    <div className="text-[10px] text-slate-400">diario</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
            <span className="text-xs text-slate-500">¿Deseas corregir las incidencias en piso?</span>
            <Link
              href="/hallazgos"
              className="text-xs font-semibold text-teal-700 hover:underline"
            >
              Ir a corrección de hallazgos &rarr;
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
