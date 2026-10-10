'use client';

import React from 'react';
import { motion } from 'framer-motion';
import {
  TrendingUp,
  AlertTriangle,
  Store,
  Calendar,
  DollarSign,
  FileText,
  BarChart2,
  PieChart as PieChartIcon,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { RedData } from '@/types/red';
import { formatearMonedaUSD, formatearNumero } from '@/lib/formatters/contract';

interface ImpactoViewProps {
  data: RedData;
}

export function ImpactoView({ data }: ImpactoViewProps) {
  const { red, proyeccion_temporal, top_tiendas_impacto, distribucion_tipos_error } = data;

  return (
    <div className="space-y-8">
      {/* Encabezado con Leyenda Obligatoria */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              {red.dataset_label || 'Dataset sintético'}
            </span>
          </div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
            5. Impacto Económico en la Red (38 Tiendas)
          </h2>
          <p className="text-slate-500 text-sm mt-1">
            Proyección agregada multitienda: exposición financiera por discrepancias no corregidas en anaqueles.
          </p>
        </div>

        <div className="text-xs font-mono text-slate-500 bg-white px-4 py-2 rounded-xl border border-slate-200">
          Fecha de corte de datos: <strong className="text-slate-800">{red.fecha_corte}</strong>
        </div>
      </div>

      {/* Tarjetas de Indicadores Agregados de la Red */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Exposición a 7 días */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs"
        >
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block font-mono">
            Exposición a 7 Días
          </span>
          <div className="text-2xl font-extrabold text-slate-900 font-tabular mt-2">
            {formatearMonedaUSD(red.exposicion_7_dias)}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Impacto a 1 semana sin corregir cenefas</p>
        </motion.div>

        {/* Exposición a 14 días */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: 0.05 }}
          className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs"
        >
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block font-mono">
            Exposición a 14 Días
          </span>
          <div className="text-2xl font-extrabold text-amber-700 font-tabular mt-2">
            {formatearMonedaUSD(red.exposicion_14_dias)}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Riesgo acumulado en ventana quincenal</p>
        </motion.div>

        {/* Exposición a 30 días */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: 0.1 }}
          className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs"
        >
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block font-mono">
            Exposición a 30 Días
          </span>
          <div className="text-2xl font-extrabold text-rose-600 font-tabular mt-2">
            {formatearMonedaUSD(red.exposicion_30_dias)}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Impacto mensual en margen bruto de la red</p>
        </motion.div>

        {/* Venta Perdida Anual Estimada */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: 0.15 }}
          className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs"
        >
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block font-mono">
            Venta Perdida Anual
          </span>
          <div className="text-2xl font-extrabold text-rose-700 font-tabular mt-2">
            {formatearMonedaUSD(red.venta_perdida_anual)}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Quiebres de stock en 38 tiendas (anualizado)</p>
        </motion.div>
      </div>

      {/* Métricas Operativas de Catálogo y Cobertura */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-900 text-white p-5 rounded-xl border border-slate-800 flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-teal-600 flex items-center justify-center shrink-0">
            <Store className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="text-xs text-slate-400 font-mono">COBERTURA DE RED</div>
            <div className="text-xl font-bold font-tabular mt-0.5">
              {red.tiendas_con_incidencias} de {red.tiendas_total} tiendas
            </div>
            <div className="text-[11px] text-teal-300">81.5% de sucursales con incidencias activas</div>
          </div>
        </div>

        <div className="bg-slate-900 text-white p-5 rounded-xl border border-slate-800 flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-rose-600 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="text-xs text-slate-400 font-mono">CONFLICTOS DE CATÁLOGO</div>
            <div className="text-xl font-bold font-tabular mt-0.5">
              {red.conflictos_maestro_precios} discrepancias
            </div>
            <div className="text-[11px] text-rose-300">Desfase maestro de precios central vs POS</div>
          </div>
        </div>

        <div className="bg-slate-900 text-white p-5 rounded-xl border border-slate-800 flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-amber-600 flex items-center justify-center shrink-0">
            <BarChart2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="text-xs text-slate-400 font-mono">SURTIDO AFECTADO</div>
            <div className="text-xl font-bold font-tabular mt-0.5">
              {red.skus_afectados} SKUs identificados
            </div>
            <div className="text-[11px] text-amber-300">Productos con error de cenefa o stockout</div>
          </div>
        </div>
      </div>

      {/* Gráficas con Recharts */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Gráfico 1: Curva de Proyección Temporal */}
        <div className="lg:col-span-7 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900 text-base">
                Curva de Exposición Financiera Proyectada
              </h3>
              <p className="text-xs text-slate-500">
                Evolución de pérdida acumulada a 30 días (con bandas de variabilidad operacional)
              </p>
            </div>
          </div>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={proyeccion_temporal} margin={{ top: 10, right: 20, left: 20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorExpo" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0d9488" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#0d9488" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="dia" stroke="#64748b" fontSize={11} />
                <YAxis
                  stroke="#64748b"
                  fontSize={11}
                  tickFormatter={(val) => `US$${val / 1000}k`}
                />
                <Tooltip
                  formatter={(value: any) => [formatearMonedaUSD(Number(value)), 'Exposición']}
                  labelStyle={{ fontWeight: 'bold', color: '#0f172a' }}
                />
                <Area
                  type="monotone"
                  dataKey="exposicion_acumulada"
                  stroke="#0d9488"
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#colorExpo)"
                  name="Exposición Acumulada"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Gráfico 2: Top Tiendas por Exposición */}
        <div className="lg:col-span-5 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div>
            <h3 className="font-bold text-slate-900 text-base">
              Sucursales con Mayor Exposición
            </h3>
            <p className="text-xs text-slate-500">Riesgo mensual estimado por tienda (US$ / mes)</p>
          </div>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={top_tiendas_impacto.slice(0, 5)}
                layout="vertical"
                margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis type="number" stroke="#64748b" fontSize={11} tickFormatter={(v) => `US$${v}`} />
                <YAxis
                  type="category"
                  dataKey="ciudad"
                  stroke="#64748b"
                  fontSize={11}
                  width={60}
                />
                <Tooltip
                  formatter={(value: any) => [formatearMonedaUSD(Number(value)), 'Exposición Mensual']}
                />
                <Bar dataKey="exposicion_mensual" fill="#e11d48" radius={[0, 6, 6, 0]} name="Exposición" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Supuestos de Cálculo y Desglose por Tipo de Error */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-6 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-3">
          <div className="flex items-center gap-2 text-slate-800 font-bold text-sm">
            <FileText className="w-4 h-4 text-teal-600" />
            <span>Explicación de Supuestos de Cálculo</span>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-4 rounded-xl border border-slate-100">
            {red.supuestos_calculo}
          </p>
          <div className="text-[11px] text-slate-500 space-y-1">
            <p>&bull; <strong>No duplicación:</strong> No se suman magnitudes incompatibles entre mermas operativas y ventas perdidas brutas.</p>
            <p>&bull; <strong>Exposición potencial vs pérdida comprobada:</strong> Las cifras proyectan el riesgo de no corregir las cenefas en los anaqueles.</p>
          </div>
        </div>

        <div className="lg:col-span-6 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-3">
          <h4 className="font-bold text-slate-900 text-sm">
            Distribución de Frecuencia de Incidencias en la Red
          </h4>
          <div className="space-y-2">
            {distribucion_tipos_error.map((item) => (
              <div key={item.tipo} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="font-medium text-slate-700">{item.tipo}</span>
                  <span className="font-bold text-slate-900 font-mono">
                    {item.cantidad} casos ({item.porcentaje}%)
                  </span>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-teal-600 rounded-full"
                    style={{ width: `${item.porcentaje}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
