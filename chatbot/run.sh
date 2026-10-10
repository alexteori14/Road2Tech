#!/usr/bin/env bash
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Asegurar que cargo (Rust) esté en el PATH, requerido por Tauri
if [ -f "$HOME/.cargo/env" ]; then
    . "$HOME/.cargo/env"
fi
export PATH="$HOME/.cargo/bin:$PATH"

echo "----------------------------------------"
echo "✨ Iniciando Coucou (Asistente Gemini)"
echo "----------------------------------------"

# 1. Comprobar dependencias de Node
if [ ! -d "$DIR/windows/node_modules" ]; then
    echo "📦 Instalando dependencias de Node..."
    npm --prefix "$DIR/windows" install
fi

# 2. Iniciar Coucou
echo "🚀 Lanzando Coucou..."
npm --prefix "$DIR/windows" run tauri dev
