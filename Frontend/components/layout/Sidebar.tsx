'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Video,
  Grid3X3,
  AlertTriangle,
  TrendingUp,
  Sparkles,
  Camera,
  Store,
  WifiOff,
} from 'lucide-react';

interface NavItem {
  nombre: string;
  ruta: string;
  icono: React.ElementType;
  badge?: string;
  badgeColor?: string;
}

const NAVEGACION: NavItem[] = [
  { nombre: '1. Resumen', ruta: '/resumen', icono: LayoutDashboard },
  { nombre: '2. Recorrido', ruta: '/recorrido', icono: Video },
  { nombre: '3. Anaquel', ruta: '/anaquel', icono: Grid3X3 },
  { nombre: '4. Hallazgos', ruta: '/hallazgos', icono: AlertTriangle },
  { nombre: '5. Impacto en red', ruta: '/impacto', icono: TrendingUp },
  { nombre: '6. Modo jurado', ruta: '/modo-jurado', icono: Sparkles, badge: 'Demo', badgeColor: 'bg-teal-500' },
  { nombre: '7. Prueba real', ruta: '/prueba-real', icono: Camera, badge: 'Condicionada', badgeColor: 'bg-amber-500' },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-slate-900 text-slate-100 flex flex-col h-screen fixed left-0 top-0 z-30 border-r border-slate-800 shadow-xl select-none">
      {/* Brand & Store Info */}
      <div className="p-5 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-teal-600 flex items-center justify-center text-white shadow-md">
            <Store className="w-6 h-6" />
          </div>
          <div>
            <h1 className="font-bold text-base tracking-tight text-white flex items-center gap-2">
              Road2Tech
              <span className="text-[10px] font-semibold tracking-wider uppercase px-1.5 py-0.5 rounded bg-slate-800 text-teal-300 border border-teal-800/60">
                Auditoría
              </span>
            </h1>
            <p className="text-xs text-slate-400 font-mono">Sucursal S012 · Dataset 2</p>
          </div>
        </div>
      </div>

      {/* Navigation List */}
      <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
        <div className="px-3 pb-2 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
          Flujo de Evaluación
        </div>
        {NAVEGACION.map((item) => {
          const Icon = item.icono;
          const isActive =
            pathname === item.ruta || (item.ruta === '/resumen' && pathname === '/');

          return (
            <Link
              key={item.ruta}
              href={item.ruta}
              className={`flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all group ${
                isActive
                  ? 'bg-teal-600/20 text-teal-300 border border-teal-500/30 font-semibold'
                  : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon
                  className={`w-4 h-4 transition-transform group-hover:scale-110 ${
                    isActive ? 'text-teal-400' : 'text-slate-400'
                  }`}
                />
                <span>{item.nombre}</span>
              </div>
              {item.badge && (
                <span
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded-full text-white ${
                    item.badgeColor || 'bg-slate-700'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Offline Status Badge */}
      <div className="p-4 border-t border-slate-800 bg-slate-950/60">
        <div className="flex items-center gap-2 text-xs text-emerald-400 mb-1.5 font-medium">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          <span>100% Autónomo Offline</span>
        </div>
        <p className="text-[11px] text-slate-400 flex items-center gap-1.5 font-mono">
          <WifiOff className="w-3.5 h-3.5 text-slate-400" />
          Sin dependencias de red
        </p>
      </div>
    </aside>
  );
}
