'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Camera,
  AlertCircle,
  Clock,
  ShieldAlert,
  CheckCircle2,
  FileCheck,
  Video,
  Layers,
  ChevronRight,
} from 'lucide-react';
import { SalidaHallazgos } from '@/types/hallazgos';
import { RecorridoView } from '@/components/recorrido/RecorridoView';

interface PruebaRealViewProps {
  data: SalidaHallazgos;
}

export function PruebaRealView({ data }: PruebaRealViewProps) {
  const [validacionAprobada, setValidacionAprobada] = useState(false);

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300">
            <Clock className="w-3.5 h-3.5 text-amber-600" />
            <span>Corte H18 · Característica Condicionada</span>
          </span>
        </div>
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
          7. Prueba en Anaquel Real (Clip de la Hora 18)
        </h2>
        <p className="text-slate-500 text-sm mt-1">
          Validación con material de video grabado en tienda física. Supeditada al cumplimiento de los criterios del hito H18.
        </p>
      </div>

      {/* ESTADO PENDIENTE DE VALIDACIÓN (POR DEFECTO) */}
      {!validacionAprobada ? (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl border border-slate-200 p-8 sm:p-10 shadow-xs space-y-6"
        >
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 border border-amber-200">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-slate-900">
                Función Condicionada · Pendiente de Validación Técnica
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed max-w-3xl">
                Conforme al protocolo de <strong>frontend.pdf</strong>, esta pantalla solo se habilita para demostración si el clip de video capturado en la hora 18 supera las pruebas de calidad óptica de P4. No se presenta como funcional ni se finge una validación no comprobada.
              </p>
            </div>
          </div>

          {/* Criterios Técnicos Exigidos */}
          <div className="bg-slate-50 p-6 rounded-xl border border-slate-200/80 space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 font-mono">
              Criterios de Aceptación del Clip Real (Hito H18)
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div className="bg-white p-4 rounded-lg border border-slate-200 space-y-1">
                <span className="font-bold text-slate-800 block">1. Iluminación y Reflejo</span>
                <p className="text-slate-500">
                  Sin sobreexposición ni deslumbramiento en micas plásticas de cenefa que impida la lectura de precios por OCR.
                </p>
              </div>
              <div className="bg-white p-4 rounded-lg border border-slate-200 space-y-1">
                <span className="font-bold text-slate-800 block">2. Estabilidad de Paneo</span>
                <p className="text-slate-500">
                  Velocidad de desplazamiento uniforme a 30 fps sin desenfoque de movimiento (motion blur) excesivo.
                </p>
              </div>
              <div className="bg-white p-4 rounded-lg border border-slate-200 space-y-1">
                <span className="font-bold text-slate-800 block">3. Bounding Boxes</span>
                <p className="text-slate-500">
                  Precisión de detección de al menos 90 % en las 12 posiciones del anaquel con el modelo de visión.
                </p>
              </div>
            </div>
          </div>

          {/* Selector de Simulación Controlada para el Jurado */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-slate-100">
            <div className="text-xs text-slate-500">
              ¿El equipo ha confirmado la validación satisfactoria del clip de la H18?
            </div>
            <button
              onClick={() => setValidacionAprobada(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition-colors shadow-xs"
            >
              <FileCheck className="w-4 h-4 text-emerald-400" />
              <span>Habilitar Vista de Validación (Si se aprobó H18)</span>
            </button>
          </div>
        </motion.div>
      ) : (
        /* VISTA HABILITADA CON REUTILIZACIÓN DE COMPONENTES */
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="space-y-6"
        >
          <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-200 text-emerald-900 flex items-center justify-between text-xs font-semibold">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Clip de la hora 18 validado satisfactoriamente por el equipo de visión.</span>
            </div>
            <button
              onClick={() => setValidacionAprobada(false)}
              className="text-emerald-700 hover:text-emerald-900 underline font-normal"
            >
              Restablecer a estado pendiente
            </button>
          </div>

          {/* Reutilización limpia del reproductor de recorrido con hallazgos */}
          <RecorridoView data={data} />
        </motion.div>
      )}
    </div>
  );
}
