# Funcionamiento del chatbot (Mochi)

Guía completa de cómo conversa Coucou: cómo habla y escucha, cómo usa la API de Gemini, qué contexto recibe cada pregunta y cómo se apoya en el RAG. Todo el código está en `windows/` (Tauri: Rust + TypeScript).

## 1. Vista general

```
 voz (micrófono) ─► transcripción (Gemini) ─┐
 texto escrito ─────────────────────────────┤
                                            ▼
                                   chat.ts · submit()
                                            │  Bridge.chatSend(query, context)
                                            ▼
                               lib.rs · chat_send  (Rust)
        ┌───────────────────────────────────┼───────────────────────────────┐
        ▼                                   ▼                               ▼
  RAG: buscar fragmentos          contexto: pantalla (OCR),         historial de la
  en tus documentos               archivo soltado o ventana         conversación
        └───────────────────────────────────┼───────────────────────────────┘
                                            ▼
                           gemini.rs · send  ─►  API de Gemini (generateContent)
                                            │
                                            ▼
                      respuesta ─► burbuja en pantalla + voz (espeak-ng)
```

| Pieza | Archivo |
|---|---|
| Interfaz del chat, micrófono, envío | [`windows/src/views/chat.ts`](../windows/src/views/chat.ts) |
| Puente front ↔ Rust | [`windows/src/core/bridge.ts`](../windows/src/core/bridge.ts) |
| Comandos Tauri (`chat_send`, `rag_*`, `voice_*`) | [`windows/src-tauri/src/lib.rs`](../windows/src-tauri/src/lib.rs) |
| Cliente de Gemini (chat y transcripción) | [`windows/src-tauri/src/gemini.rs`](../windows/src-tauri/src/gemini.rs) |
| Micrófono y voz | [`windows/src-tauri/src/voice.rs`](../windows/src-tauri/src/voice.rs) |
| Lectura de pantalla (OCR) | [`windows/src-tauri/src/screen.rs`](../windows/src-tauri/src/screen.rs) |
| RAG | [`windows/src-tauri/src/rag.rs`](../windows/src-tauri/src/rag.rs) |
| Ajustes | [`windows/src-tauri/src/settings.rs`](../windows/src-tauri/src/settings.rs) |

## 2. Cómo "habla" Mochi

### Personalidad y reglas de respuesta
Se definen en `SYSTEM_PROMPT` (`gemini.rs`) y se envían como `systemInstruction` en cada petición. Resumen:

- Es **Mochi**, un asistente de escritorio amigable que vive en la pantalla del usuario.
- Si hay un bloque `SCREEN CONTEXT` (texto leído de la pantalla por OCR, puede tener pequeños errores), lo usa para responder. Explica lo que ve paso a paso, como a una persona lista pero nueva en el tema, definiendo cada término técnico en una frase corta y señalando las cifras clave.
- Si el texto de pantalla no basta, **lo dice** en lugar de adivinar.
- Si hay un bloque `KNOWLEDGE BASE` (RAG), lo prefiere al conocimiento general, nombra el documento que usó y avisa si no contiene la respuesta.
- Responde **en el idioma del usuario**.
- **Sin formato markdown** (ni `**`, ni `##`, ni guiones de lista): texto plano con saltos de línea. Es así porque la respuesta también se lee en voz alta.

Para cambiar el carácter de Mochi, edita `SYSTEM_PROMPT`.

### Entrada por voz (micrófono → texto)
1. El botón del micrófono llama a `voice_start`, que graba audio WAV mono a 16 kHz con la primera herramienta disponible: `arecord`, `pw-record` o `parecord`. Se detiene solo a los 30 s.
2. Al pulsar de nuevo, `voice_stop` detiene la grabación y llama a `gemini::transcribe`.
3. El WAV se codifica en Base64 ([`b64.rs`](../windows/src-tauri/src/b64.rs)) y se envía a Gemini como `inline_data` (`audio/wav`) junto a una instrucción de transcribir con precisión y devolver **solo** las palabras habladas (en español si el idioma de voz es `es`, en inglés en otro caso). `temperature` 0.1.
4. El texto transcrito se pone en el campo de entrada y se envía como una pregunta normal.

La transcripción puede tardar entre 30 y 40 s con audio largo; por eso el límite de espera es de 120 s.

### Salida por voz (texto → habla)
Si *Voz en respuestas* está activada (`speakReplies`), tras cada respuesta el front llama a `speak`. En Rust (`voice.rs`) se usa el primer sintetizador disponible: `espeak-ng`, `espeak` o `spd-say`, en el idioma de voz configurado. Si no hay ninguno, se muestra el aviso de instalar `espeak`. Al enviar una nueva pregunta se interrumpe la voz anterior. Mientras habla, la cara de Mochi pasa al estado *speaking*.

## 3. Cómo usa la API de Gemini

### Configuración
- **Clave API** — se resuelve en este orden (`resolve_api_key`, `lib.rs`): ajuste `geminiApiKey` → llavero del sistema (`gemini-api-key`, `google-api-key`) → variable de entorno `GEMINI_API_KEY` → clave por defecto del código.
- **Modelo** — ajuste `model` (por defecto `gemini-3.5-flash`). Admite el prefijo `models/`. Los valores antiguos (`claude…`, `qwen…`) se migran al modelo por defecto al cargar.
- Los ajustes se guardan en `settings.json`; las claves del llavero nunca llegan al front.

### Petición de chat
`gemini::send` hace un `POST` a:

```
https://generativelanguage.googleapis.com/v1beta/models/{modelo}:generateContent
```

con este cuerpo:

```json
{
  "systemInstruction": { "parts": [{ "text": "<SYSTEM_PROMPT>" }] },
  "contents": [
    { "role": "user",  "parts": [{ "text": "pregunta anterior" }] },
    { "role": "model", "parts": [{ "text": "respuesta anterior" }] },
    { "role": "user",  "parts": [{ "text": "<bloques de contexto>\nQuestion: <pregunta>" }] }
  ],
  "generationConfig": { "temperature": 0.4 }
}
```

- La respuesta se toma de `candidates[0].content.parts[*].text`, concatenado y recortado. Una respuesta vacía se trata como error.
- Tiempo máximo de espera: 90 s (120 s para transcripción).
- Errores controlados con mensaje legible: sin conexión, timeout, y los errores HTTP de la API (por ejemplo `503` por alta demanda, o `404` si el modelo no existe).

### Historial (memoria de la conversación)
`Chat` guarda los últimos **16 mensajes** (`MAX_HISTORY`) con roles `user` y `model`. Importante: en el historial se guarda **solo la pregunta limpia y la respuesta**, no los bloques de contexto (pantalla, archivo, RAG). Así el historial no crece con texto repetido y cada turno recibe su contexto fresco. El historial se borra con `chat_reset` (por ejemplo, al soltar un archivo nuevo).

### Contexto que se antepone a la pregunta
Antes de la pregunta se pueden colocar, en este orden, hasta tres bloques (solo para ese turno):

| Bloque | Cuándo | Origen |
|---|---|---|
| `KNOWLEDGE BASE` | RAG activo y hay fragmentos relevantes | tus documentos guardados |
| `SCREEN CONTEXT` | *Leer pantalla* activo y no hay archivo | captura + OCR (hasta 7 000 caracteres) |
| `[File: …]` o `[Context — App: …]` | primer turno tras soltar un archivo o ventana | el archivo (texto hasta 200 000 bytes; imágenes por OCR) |

**Lectura de pantalla** (`screen.rs`): captura con la primera herramienta que funcione (`grim`, `gnome-screenshot`, `spectacle`, `scrot`, `import`) y extrae el texto con `tesseract`. Si falla, el chat continúa sin ese contexto (el error se registra, no se muestra).

## 4. Cómo usa el RAG

El RAG permite a Mochi responder con **tus documentos**. Detalle completo en [`RAG.md`](RAG.md); resumen del flujo dentro del chat:

**Al guardar un documento** (`rag_add`):
1. Se lee el texto (texto/código directamente; imágenes por OCR). Límite 2 MB y 400 fragmentos.
2. Se trocea en fragmentos de ~1000 caracteres con 150 de solape, cortando en frase o párrafo.
3. Cada fragmento se convierte en un vector con el modelo `gemini-embedding-001` (768 dimensiones, `taskType: RETRIEVAL_DOCUMENT`), en lotes de hasta 100.
4. Se guarda en el índice local `<local_dir>/rag/index.json` (escritura atómica). Un documento con el mismo nombre se reemplaza.

**En cada pregunta** (`chat_send`), si *Usar documentos* está activo y el índice no está vacío:
1. Se calcula el embedding de la pregunta (`taskType: RETRIEVAL_QUERY`).
2. Se compara con todos los fragmentos por **similitud coseno**.
3. Se conservan los **4** mejores con puntuación **≥ 0.5**.
4. Se arma el bloque que se antepone a la pregunta:

```
[KNOWLEDGE BASE — passages retrieved from the user's saved documents. Use them when they help,
and mention the document name. If they do not answer the question, say so instead of inventing.]
(1) notas.txt:
<texto del fragmento>
(2) contrato.md:
<texto del fragmento>
[END KNOWLEDGE BASE]
```

5. Si ningún fragmento supera el umbral, no se añade nada y Mochi responde con normalidad. Si la búsqueda falla (sin red, error de API), el chat **no se bloquea**: responde sin fragmentos.

**Cómo añadir documentos:** soltar un archivo sobre Coucou → *Save to knowledge base*, o *Ajustes → Base de conocimiento* (pegar la ruta; ahí también se quitan documentos y se apaga el RAG).

## 5. Ajustes que afectan al chatbot

| Ajuste (`settings.json`) | Efecto | Por defecto |
|---|---|---|
| `model` | Modelo de Gemini para el chat y la transcripción | `gemini-3.5-flash` |
| `geminiApiKey` | Clave de la API de Gemini | (ver sección 3) |
| `screenAware` | Adjunta texto de la pantalla a cada pregunta | `true` |
| `ragEnabled` | Busca en tus documentos antes de responder | `true` |
| `speakReplies` | Lee las respuestas en voz alta | `true` |
| `voiceLang` | Idioma del micrófono y de la voz (`es`, `en`…) | `es` |

## 6. Privacidad: qué sale de tu equipo

Hacia la API de Gemini viajan: la pregunta, el historial reciente (16 mensajes), el texto de pantalla/archivo/fragmentos del turno, el audio al transcribir, y el texto a convertir en embeddings. **No** viaja el índice del RAG, ni los documentos completos (solo los fragmentos recuperados de cada turno). Sin telemetría.

## 7. Dependencias del sistema (Linux)

| Función | Paquetes |
|---|---|
| Voz de salida | `espeak-ng` (o `espeak`, `spd-say`) |
| Micrófono | `arecord` (alsa-utils), `pw-record` o `parecord` |
| Leer pantalla | una de `grim`, `gnome-screenshot`, `spectacle`, `scrot`, `import` + `tesseract-ocr` (y `tesseract-ocr-spa` para español) |

## 8. Pruebas

```bash
cargo test --manifest-path windows/src-tauri/Cargo.toml -- --test-threads=1
cargo test --manifest-path windows/src-tauri/Cargo.toml --lib rag::tests::live -- --ignored   # RAG contra la API real
```

Las pruebas de `gemini::tests` llaman a la API real; si Google responde `503` (alta demanda), repítelas. Ejecutarlas en paralelo puede provocar fallos de red, por eso se recomienda `--test-threads=1`.

## 9. Problemas frecuentes

| Síntoma | Causa probable |
|---|---|
| "No voice found" | Falta `espeak-ng`: `sudo apt install espeak-ng` |
| "tesseract is not installed" | `sudo apt install tesseract-ocr tesseract-ocr-spa` |
| "No screenshot tool worked" | Instala la herramienta de captura de tu escritorio (ver sección 7) |
| `Gemini API error (503)` | Alta demanda del modelo; reintenta o cambia `model` en Ajustes |
| `Gemini API error (404)` | El modelo configurado no existe o está retirado |
| Mochi ignora tus documentos | `ragEnabled` apagado, documento sin texto, o la pregunta no se parece a ningún fragmento (< 0.5) |
