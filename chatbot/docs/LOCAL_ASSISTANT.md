# Coucou → Asistente Gemini con conciencia de pantalla (Linux)

## Estado

| Fase | Contenido | Estado |
|---|---|---|
| 1 | Backend Google Gemini (`gemini-3.5-flash`) en lugar de Ollama/Claude | completado y probado |
| 2 | Pipeline de pantalla: captura → OCR → contexto | completado |
| 3 | Mascota flotante libre (arrastrable, posición recordada) | completado |
| 4 | Voz local y estados escuchando / pensando / hablando | completado |
| 5 | Limpieza de integraciones de Claude Code / hooks que ya no aplican | pendiente |

## Dependencias del sistema

```bash
sudo apt install tesseract-ocr tesseract-ocr-spa tesseract-ocr-eng
sudo apt install gnome-screenshot          # GNOME (Wayland o X11)
# Alternativas: grim (Sway/Hyprland), spectacle (KDE), scrot (X11)
sudo apt install xdotool                   # opcional: título de la ventana activa (X11)
sudo apt install libgtk-layer-shell0       # requerido por el proyecto
```

## Arquitectura

```
UI (chat.ts) --chat_send--> lib.rs --> gemini::send
                                          |-- screen::read_screen  (captura + tesseract)
                                          `-- POST https://generativelanguage.googleapis.com/... (gemini-3.5-flash)
```

- `screen.rs`: cadena de herramientas de captura, OCR con `tesseract --psm 6`
  (mantiene las celdas de una fila en la misma línea), PNG temporal borrado
  justo después, texto limitado a 7000 caracteres.
- `gemini.rs`: el contexto de pantalla solo se adjunta al turno actual; el
  historial guarda la pregunta limpia y mantiene los turnos `user` y `model`.
- Ajustes: `model` (`gemini-3.5-flash`), `geminiApiKey`, `screenAware`.

## Mascota flotante

- En Linux la ventana no usa layer-shell ni el borde superior. En sesiones
  Wayland se fuerza `GDK_BACKEND=x11` (XWayland) porque GNOME no deja a las apps
  posicionarse ni mantenerse encima; así funcionan `always-on-top` y el arrastre.
- Se arrastra pulsando sobre el cuerpo de Mochi y moviendo; un clic sin mover
  abre el chat. La posición se guarda en `~/.config/coucou/position.json`.
- Nunca se oculta: reposa como Mochi compacto.
- Desactivar: `COUCOU_FLOATING=0`.

## Voz

- **Reconocimiento de voz (Speech-to-Text):** La grabación del micrófono se realiza en formato WAV (`arecord`, `pw-record` o `parecord`) y se envía directamente a la **API de Google Gemini**, transcribiendo el audio con precisión multilingüe sin requerir whisper local.
- **Síntesis de voz (Text-to-Speech):** Utiliza herramientas del sistema como `espeak-ng`, `espeak` o `spd-say`:
```bash
sudo apt install alsa-utils espeak
```

El botón del micrófono en el chat alterna escuchar / enviar. Mochi pasa por los
estados `listening` (ojos abiertos, cabeza inclinada), `thinking` y `speaking`
(rebote suave). Idioma y lectura en voz alta se configuran en Ajustes.
