'use client';

import React from 'react';
import Link from 'next/link';
import { Sparkles, ShieldAlert, Clock } from 'lucide-react';

export function Header() {
  return (
    <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between sticky top-0 z-20 shadow-xs">
      {/* Aviso de simulación y dataset */}
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-900 border border-amber-200/80">
          <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
          <span>Video simulado · Datos de dataset_2 (Tienda S012)</span>
        </span>
        <span className="hidden md:inline-flex items-center gap-1 text-xs text-slate-500 font-mono">
          <Clock className="w-3.5 h-3.5 text-slate-400" />
          Escaneo: 03/03/2026 08:30 hrs
        </span>
      </div>

      {/* Quick Action: Modo Jurado button */}
      <div className="flex items-center gap-3">
        <Link
          href="/modo-jurado"
          className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-teal-600 hover:bg-teal-700 text-white shadow-xs transition-colors"
        >
          <Sparkles className="w-3.5 h-3.5 text-teal-100" />
          <span>Iniciar Modo Jurado</span>
        </Link>
      </div>
    </header>
  );
}
