# Base de conocimiento (RAG)

Coucou puede responder usando **tus propios documentos**. Es RAG (Retrieval-Augmented Generation): en vez de pedirle al modelo que "recuerde", se buscan los fragmentos más relacionados con tu pregunta y se le entregan junto a ella.

## Cómo se usa

- **Soltando un archivo** sobre Coucou y pulsando **Save to knowledge base**.
- **Desde Ajustes → Base de conocimiento**: pega la ruta del archivo y pulsa *Añadir*. Ahí mismo puedes quitar documentos o apagar el RAG con *Usar documentos*.

Después, pregunta con normalidad. Si algún fragmento es relevante, Mochi lo usa y nombra el documento; si no lo es, responde como siempre.

Formatos: texto plano, código, Markdown, CSV… e imágenes con texto (OCR). **PDF todavía no.** Límite: 2 MB y 400 fragmentos por documento. Volver a añadir un archivo con el mismo nombre lo reemplaza.

## Cómo funciona

```
archivo ──► trozos de ~1000 caracteres (solapados 150, cortados en frase/párrafo)
        ──► embeddings (Gemini gemini-embedding-001, 768 dimensiones)
        ──► índice local  <local_dir>/rag/index.json

pregunta ──► embedding ──► similitud coseno ──► top 4 con score ≥ 0.5
         ──► bloque KNOWLEDGE BASE delante de la pregunta ──► Gemini
```

Código: [`windows/src-tauri/src/rag.rs`](../windows/src-tauri/src/rag.rs). El bloque se añade solo al turno actual (como el texto de pantalla) y no engorda el historial.

## Privacidad

- El índice vive en tu disco y nunca se sube.
- A la API de Gemini solo viaja el **texto** que se va a convertir en embedding (al añadir un documento y, en cada pregunta, la propia pregunta). La clave API va en una cabecera, no en la URL.
- Si la búsqueda falla (sin red, error de la API), el chat responde igualmente, sin fragmentos.

## Ajustes técnicos

Constantes al inicio de `rag.rs`: `CHUNK_CHARS`, `CHUNK_OVERLAP`, `TOP_K`, `MIN_SCORE`, `EMBED_DIMS`. Si cambias `EMBED_MODEL` o `EMBED_DIMS`, los documentos ya indexados dejan de ser comparables: quítalos y vuelve a añadirlos.

## Pruebas

```bash
cargo test --manifest-path windows/src-tauri/Cargo.toml --lib rag::                       # unitarias, sin red
cargo test --manifest-path windows/src-tauri/Cargo.toml --lib rag::tests::live -- --ignored  # contra la API real
```
