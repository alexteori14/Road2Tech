'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Tag,
  DollarSign,
  Filter,
  Check,
  Info,
} from 'lucide-react';
import { SalidaHallazgos, Hallazgo, TipoHallazgo } from '@/types/hallazgos';
import {
  formatearMonedaUSD,
  traducirTipoHallazgo,
} from '@/lib/formatters/contract';

interface HallazgosViewProps {
  data: SalidaHallazgos;
}

export function HallazgosView({ data }: HallazgosViewProps) {
  // Estado local para correcciones
  const [hallazgosState, setHallazgosState] = useState<Hallazgo[]>(
    [...data.hallazgos].sort((a, b) => b.impacto_diario - a.impacto_diario)
  );
  const [filtroTipo, setFiltroTipo] = useState<string>('todos');
  const [filtroEstado, setFiltroEstado] = useState<'todos' | 'pendientes' | 'corregidos'>('todos');
  const [feedbackMensaje, setFeedbackMensaje] = useState<string | null>(null);

  // Toggle de corregido
  const toggleCorregido = (id: string) => {
    setHallazgosState((prev) =>
      prev.map((h) => {
        if (h.id === id) {
          const nuevoEstado = !h.corregido;
          return { ...h, corregido: nuevoEstado };
        }
        return h;
      })
    );
    setFeedbackMensaje('Estado actualizado localmente (sin persistencia en backend)');
    setTimeout(() => setFeedbackMensaje(null), 3500);
  };

  // Cálculo dinámico según correcciones locales
  const pendientes = hallazgosState.filter((h) => !h.corregido);
  const corregidos = hallazgosState.filter((h) => h.corregido);
  const totalRiesgoPendiente = pendientes.reduce((acc, h) => acc + h.impacto_diario, 0);

  // Filtrado de lista
  const hallazgosFiltrados = hallazgosState.filter((h) => {
    if (filtroEstado === 'pendientes' && h.corregido) return false;
    if (filtroEstado === 'corregidos' && !h.corregido) return false;
    if (filtroTipo !== 'todos' && h.tipo !== filtroTipo) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Encabezado con Métricas Rápidas */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
            4. Hallazgos Priorizados por Impacto Económico
          </h2>
          <p className="text-slate-500 text-sm mt-1">
            Incidencias ordenadas de mayor a menor fuga diaria en anaquel. Marca corregido conforme se resuelva en piso.
          </p>
        </div>

        {/* Resumen de Impacto Restante */}
        <div className="flex items-center gap-4 bg-white px-5 py-3 rounded-2xl border border-slate-200 shadow-xs">
          <div>
            <span className="text-[11px] font-semibold text-slate-500 uppercase block font-mono">
              Riesgo Activo Restante
            </span>
            <span className="text-xl font-extrabold text-rose-600 font-tabular">
              {formatearMonedaUSD(totalRiesgoPendiente)}
              <span className="text-xs font-normal text-slate-500"> / día</span>
            </span>
          </div>
          <div className="h-8 w-px bg-slate-200" />
          <div>
            <span className="text-[11px] font-semibold text-slate-500 uppercase block font-mono">
              Progreso
            </span>
            <span className="text-sm font-bold text-slate-800 font-tabular">
              {corregidos.length} de {hallazgosState.length} corregidos
            </span>
          </div>
        </div>
      </div>

      {/* Banner de Feedback Local */}
      <AnimatePresence>
        {feedbackMensaje && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-3 bg-teal-50 border border-teal-200 rounded-xl text-teal-800 text-xs flex items-center justify-between font-medium"
          >
            <div className="flex items-center gap-2">
              <Info className="w-4 h-4 text-teal-600" />
              <span>{feedbackMensaje}</span>
            </div>
            <button
              onClick={() => setFeedbackMensaje(null)}
              className="text-teal-600 hover:text-teal-800 font-bold text-xs"
            >
              Cerrar
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Barra de Filtros */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Filtros:</span>
          
          <div className="flex items-center bg-slate-100 p-0.5 rounded-lg text-xs font-medium">
            <button
              onClick={() => setFiltroEstado('todos')}
              className={`px-3 py-1.5 rounded-md transition-colors ${
                filtroEstado === 'todos' ? 'bg-white text-slate-900 shadow-xs font-semibold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Todos ({hallazgosState.length})
            </button>
            <button
              onClick={() => setFiltroEstado('pendientes')}
              className={`px-3 py-1.5 rounded-md transition-colors ${
                filtroEstado === 'pendientes' ? 'bg-white text-rose-700 shadow-xs font-semibold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Pendientes ({pendientes.length})
            </button>
            <button
              onClick={() => setFiltroEstado('corregidos')}
              className={`px-3 py-1.5 rounded-md transition-colors ${
                filtroEstado === 'corregidos' ? 'bg-white text-emerald-700 shadow-xs font-semibold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Corregidos ({corregidos.length})
            </button>
          </div>
        </div>

        {/* Filtro por tipo específico */}
        <select
          value={filtroTipo}
          onChange={(e) => setFiltroTipo(e.target.value)}
          aria-label="Filtrar por tipo de problema"
          className="text-xs border border-slate-200 rounded-lg px-3 py-1.5 bg-white text-slate-700 font-medium focus:outline-hidden focus:ring-2 focus:ring-teal-500"
        >
          <option value="todos">Todos los tipos de problema</option>
          <option value="precio_anterior">Etiqueta con precio viejo</option>
          <option value="precio_distinto">Precio distinto al sistema</option>
          <option value="hueco_con_inventario">Hueco, pero el sistema dice que hay</option>
          <option value="etiqueta_faltante">Falta la etiqueta</option>
          <option value="frentes_bajos">Pocos frentes</option>
          <option value="etiqueta_otro_sku">Etiqueta de otro producto</option>
          <option value="revisar">Lectura dudosa: revisar</option>
        </select>
      </div>

      {/* Lista de Tarjetas de Hallazgos */}
      <div className="space-y-4">
        {hallazgosFiltrados.length === 0 ? (
          <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center space-y-2">
            <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
            <h4 className="font-bold text-slate-800 text-base">Sin hallazgos en este filtro</h4>
            <p className="text-xs text-slate-500">Prueba cambiando los criterios de búsqueda.</p>
          </div>
        ) : (
          hallazgosFiltrados.map((hallazgo, idx) => {
            const isCorregido = hallazgo.corregido;

            return (
              <motion.div
                key={hallazgo.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: idx * 0.03 }}
                className={`bg-white rounded-2xl border p-5 sm:p-6 shadow-xs transition-all ${
                  isCorregido
                    ? 'border-emerald-200 bg-emerald-50/20 opacity-80'
                    : 'border-slate-200/90 hover:border-slate-300'
                }`}
              >
                <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-center">
                  {/* Miniatura / Recorte */}
                  <div className="md:col-span-3">
                    <div className="rounded-xl overflow-hidden border border-slate-200 bg-slate-900 aspect-video flex items-center justify-center relative shadow-xs">
                      <img
                        src={hallazgo.evidencia_crop}
                        alt={`Recorte de ${hallazgo.producto}`}
                        className="w-full h-full object-cover"
                      />
                      <span className="absolute bottom-2 left-2 text-[10px] bg-slate-900/80 text-white px-2 py-0.5 rounded font-mono">
                        Cuadro {hallazgo.cuadro}
                      </span>
                    </div>
                  </div>

                  {/* Información Central del Hallazgo */}
                  <div className="md:col-span-6 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-mono font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                        R{hallazgo.repisa}-P{hallazgo.posicion}
                      </span>
                      <span className="text-xs font-mono text-slate-400">
                        SKU: {hallazgo.sku}
                      </span>
                      <span
                        className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${
                          isCorregido
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}
                      >
                        {traducirTipoHallazgo(hallazgo.tipo)}
                      </span>
                    </div>

                    <h3 className={`text-base font-bold text-slate-900 ${isCorregido ? 'line-through text-slate-500' : ''}`}>
                      {hallazgo.producto}
                    </h3>

                    {/* Comparativa de Precios: "La etiqueta dice $X · El sistema dice $Y" */}
                    <div className="text-xs font-mono text-slate-700 bg-slate-50 p-2.5 rounded-lg border border-slate-100 flex flex-wrap items-center gap-x-4 gap-y-1">
                      {hallazgo.precio_etiqueta && hallazgo.precio_etiqueta > 0 ? (
                        <span>
                          La etiqueta dice <strong className="text-rose-600 font-bold">{formatearMonedaUSD(hallazgo.precio_etiqueta)}</strong>
                        </span>
                      ) : (
                        <span className="text-amber-700 font-medium">Sin etiqueta en riel</span>
                      )}
                      <span>&bull;</span>
                      <span>
                        El sistema dice <strong className="text-slate-900 font-bold">{formatearMonedaUSD(hallazgo.precio_sistema)}</strong>
                      </span>
                    </div>

                    <p className="text-xs text-slate-600 leading-relaxed">
                      {hallazgo.descripcion}
                    </p>

                    <div className="text-xs text-slate-700 bg-amber-50/60 px-3 py-1.5 rounded-lg border border-amber-200/50">
                      <strong>Acción sugerida:</strong> {hallazgo.accion_sugerida}
                    </div>
                  </div>

                  {/* Impacto Económico y Botón "Marcar corregido" */}
                  <div className="md:col-span-3 flex flex-col items-start md:items-end justify-between h-full pt-2 md:pt-0 space-y-4">
                    <div className="md:text-right">
                      <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block font-mono">
                        Impacto diario
                      </span>
                      <span className={`text-2xl font-extrabold font-tabular block ${isCorregido ? 'text-slate-400 line-through' : 'text-rose-600'}`}>
                        {formatearMonedaUSD(hallazgo.impacto_diario)}
                      </span>
                      <span className="text-[11px] text-slate-400">fuga estimada / día</span>
                    </div>

                    <button
                      onClick={() => toggleCorregido(hallazgo.id)}
                      className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-xs ${
                        isCorregido
                          ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300'
                          : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-700/20 hover:scale-[1.02]'
                      }`}
                    >
                      {isCorregido ? (
                        <>
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Deshacer corrección</span>
                        </>
                      ) : (
                        <>
                          <Check className="w-4 h-4" />
                          <span>Marcar corregido</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })
        )}
      </div>
    </div>
  );
}
