# Memoria del Proyecto (Coucou)

## Registro de Estado y Conexión

- **Fecha de actualización:** 2026-10-09
- **Asistente / Agente:** Antigravity AI conectado y operativo.
- **Entorno de ejecución:** Linux (`/home/alexteori/Documentos/repositorios/coucou (Copiar)`).
- **Herramientas del entorno:** Rust (`cargo 1.95.0`), Node.js, Vite, Tauri v2.

---

## Contexto del Repositorio
- **Proyecto:** Coucou (NotchBuddy)
- **Plataformas:** 
  - macOS (`NotchBuddy/` en Swift/SwiftUI + AppKit)
  - Windows/Linux (`windows/` en Tauri con Rust y TypeScript)
- **Propósito:** Mostrar sesiones de agentes de codificación (Claude Code, Gemini CLI, Antigravity, etc.) y permitir interacción, notificaciones, audio y control desde la interfaz flotante/muesca.

---

## Balance General: Lo Bueno y Lo Malo

### 1. Eliminación del Modelo Local (Ollama)
- **Lo Bueno:**
  - Se eliminó con éxito el archivo `windows/src-tauri/src/ollama.rs` y todas las dependencias locales de Ollama.
  - Se limpió el script de inicio [`run.sh`](run.sh), ahorrando tiempo de arranque y evitando descargas de modelos pesados en disco (`qwen2.5:3b`).
  - La interfaz gráfica en [`windows/src/settings/main.ts`](windows/src/settings/main.ts) quedó limpia, sin campos obsoletos de servidor local (`ollamaUrl`).
- **Lo Malo / Desafíos superados:**
  - Existía un archivo de configuración preexistente en `~/.config/coucou/settings.json` con valores obsoletos (`qwen2.5:3b` y `ollamaUrl`), lo que podía generar comportamientos inesperados.
  - *Solución:* Se programó una rutina de migración transparente en `settings.rs:load()` para sustituir automáticamente modelos antiguos por `gemini-3.5-flash` y se saneó directamente el archivo JSON en disco.

---

### 2. Integración con Google Gemini API (Chat & Contexto)
- **Lo Bueno:**
  - Se creó un cliente nativo en Rust ([`windows/src-tauri/src/gemini.rs`](windows/src-tauri/src/gemini.rs)) que se comunica de forma directa con la API de Google Gemini (`https://generativelanguage.googleapis.com/v1beta/`).
  - Se configuró la API key del usuario (``).
  - Se conservó la capacidad de lectura de pantalla OCR (`screenAware`) y carga de archivos, ahora alimentando el contexto de Gemini.
  - Se implementó un historial conversacional multi-turno respetando las especificaciones de Google (`user` y `model`).
- **Lo Malo / Desafíos superados:**
  - **Incompatibilidad de modelo antiguo:** El intento inicial con `gemini-2.5-flash` retornó error HTTP 404 indicando que dicho modelo está deprecado para nuevos usuarios.
  - **Demanda y tiempos de respuesta:** `gemini-3.8-flash` presentó alta demanda y respuestas lentas durante pruebas puntuales de estrés.
  - *Solución:* Se probó `gemini-3.5-flash`, resultando extremadamente veloz, fiable y con soporte nativo de `systemInstruction`. Se fijó como modelo predeterminado, manteniendo compatibilidad para cambiar a cualquier otro modelo desde Ajustes.

---

### 3. Audio y Reconocimiento de Voz: De whisper.cpp a Gemini API
- **Lo Malo (El problema original):**
  - Al pulsar el botón del micrófono, la aplicación fallaba con el error `"whisper.cpp is not installed (whisper-cli). See docs/LOCAL_ASSISTANT.md, section Voice."`.
  - La arquitectura anterior requería compilar `whisper.cpp` en C++, ubicar binarios en el sistema y descargar modelos locales de cientos de megabytes (`ggml-base.bin`).
- **Lo Bueno (La solución implementada):**
  - Se migró el reconocimiento de voz por completo a la **API de Google Gemini**.
  - La grabación de audio generada por `arecord`/`pw-record` se lee, se codifica en Base64 con [`b64.rs`](windows/src-tauri/src/b64.rs) y se envía como `inline_data` (`audio/wav`) a la API de Gemini mediante `gemini::transcribe`.
  - Gemini transcribe las palabras en español o inglés con altísima fidelidad y sin requerir ninguna herramienta pesada local.
- **Dificultad técnica durante la prueba de audio:**
  - La inferencia multimodal de audio en la API cloud demora aproximadamente entre 30 y 40 segundos. El timeout inicial de 45 segundos en `reqwest` era demasiado ajustado y fallaba si había latencia.
  - *Solución:* Se amplió el timeout a 120 segundos para transcripción y a 90 segundos para peticiones estándar, logrando que el test (`test_gemini_audio_transcribe`) pasara exitosamente transcribiendo "Hola Mochi".

---

### 4. Limpieza del Repositorio y Calidad de Código
- **Lo Bueno:**
  - **Eliminación de paquetes muertos:** Se descubrió que la raíz del proyecto tenía una dependencia no utilizada (`framer-motion`) y un directorio `node_modules` de 13 MB. Ambos fueron eliminados junto con `package-lock.json` de la raíz.
  - **Corrección de TypeScript:** En `windows/src/core/layout.ts` se retiraron constantes huérfanas (`PROJECT_COLORS`, `FALLBACK_COLORS`) que bloqueaban la compilación estricta de `tsc`.
  - **Limpieza de UI:** Se removió el parámetro `_hasKey` y la consulta muerta a `anthropic-api-key` en `windows/src/settings/main.ts`.
  - **Clippy en Rust:** Se corrigieron advertencias de bucles, referencias redundantes a `PathBuf` y métodos obsoletos en `island.rs`, `screen.rs`, `voice.rs` y `hooks.rs`.
  - **Git Ignore:** Se configuró `.gitignore` para no volver a versionar binarios, artefactos de build ni dependencias de Node.
- **Lo Malo / Precauciones a futuro:**
  - Al ejecutar `cargo test` sin límites de concurrencia, las pruebas que golpean la API de Gemini compiten por la conexión a Google y pueden generar errores de red si se lanzan en paralelo. Se recomienda correrlas con `-- --test-threads=1` cuando se verifique la red.

---

## Estado Actual de Verificación

- **Compilación Frontend:** `npm --prefix windows run build` genera todos los bundles (`island`, `settings`, `dom`) sin errores (`0 errors`).
- **Lints de Rust:** `cargo clippy --manifest-path windows/src-tauri/Cargo.toml` termina con `0 warnings` y `0 errors`.
- **Pruebas de Chat:** Aprobadas (`gemini::tests::test_gemini_api_call ... ok`).
- **Pruebas de Audio:** Aprobadas (`gemini::tests::test_gemini_audio_transcribe ... ok`).
- **Síntesis de voz (TTS):** Confirmada con `espeak` y `spd-say` instalados en `/usr/bin`.
- **Grabación de audio:** Confirmada con `arecord` y `pw-record` instalados en `/usr/bin`.
