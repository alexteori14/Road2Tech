// Voice: speech in (microphone → text) and speech out (text → speaker), all
// local, through CLI tools like the screen pipeline.
//
//   record     : arecord | pw-record | parecord        (16 kHz mono WAV)
//   transcribe : whisper-cli / whisper-cpp (whisper.cpp) with a ggml model
//   speak      : espeak-ng | espeak | spd-say
//
// The model is looked up at $COUCOU_WHISPER_MODEL, or
// ~/.local/share/coucou/models/ggml-base.bin (multilingual).

use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;

use tauri::{AppHandle, Emitter};

#[derive(Default)]
pub struct Voice {
    recording: Mutex<Option<(Child, PathBuf)>>,
    speech: Mutex<Option<u32>>, // pid of the running TTS process
}

fn which(tool: &str) -> Option<PathBuf> {
    let path = std::env::var_os("PATH")?;
    std::env::split_paths(&path).map(|d| d.join(tool)).find(|p| p.is_file())
}

fn temp_wav() -> PathBuf {
    let nanos = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    std::env::temp_dir().join(format!("coucou-voice-{}-{nanos}.wav", std::process::id()))
}

/// Ask a process to finish cleanly (so a recorder can close its WAV header).
fn interrupt(pid: u32) {
    #[cfg(target_os = "linux")]
    unsafe {
        libc::kill(pid as i32, libc::SIGINT);
    }
    #[cfg(not(target_os = "linux"))]
    let _ = pid;
}

fn terminate(pid: u32) {
    #[cfg(target_os = "linux")]
    unsafe {
        libc::kill(pid as i32, libc::SIGTERM);
    }
    #[cfg(not(target_os = "linux"))]
    let _ = pid;
}

impl Voice {
    // ── Listening ────────────────────────────────────────────────────────────

    pub fn start_listening(&self) -> Result<(), String> {
        let mut slot = self.recording.lock().unwrap();
        if let Some((mut old, path)) = slot.take() {
            let _ = old.kill();
            let _ = std::fs::remove_file(path);
        }

        let path = temp_wav();
        let p = path.to_string_lossy().to_string();
        let (tool, args): (&str, Vec<String>) = if which("arecord").is_some() {
            ("arecord", vec!["-q", "-f", "S16_LE", "-r", "16000", "-c", "1", "-t", "wav", &p].into_iter().map(String::from).collect())
        } else if which("pw-record").is_some() {
            ("pw-record", vec!["--rate".into(), "16000".into(), "--channels".into(), "1".into(), p.clone()])
        } else if which("parecord").is_some() {
            ("parecord", vec!["--rate=16000".into(), "--channels=1".into(), "--file-format=wav".into(), p.clone()])
        } else {
            return Err("No recorder found. Install alsa-utils: sudo apt install alsa-utils".into());
        };

        let child = Command::new(tool)
            .args(&args)
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()
            .map_err(|e| format!("Could not start the microphone: {e}"))?;
        *slot = Some((child, path));
        Ok(())
    }

    /// Stops recording and returns what was said, transcribed using Google Gemini API.
    pub async fn stop_listening(
        &self,
        lang: &str,
        api_key: &str,
        model: &str,
    ) -> Result<String, String> {
        let (mut child, path) = self
            .recording
            .lock()
            .unwrap()
            .take()
            .ok_or_else(|| "Not recording.".to_string())?;

        interrupt(child.id());
        let _ = tauri::async_runtime::spawn_blocking(move || {
            let _ = child.wait();
        })
        .await;

        let raw = crate::gemini::transcribe(api_key, model, &path, lang).await;
        let _ = std::fs::remove_file(&path);
        let raw = raw?;
        let text = clean_transcript(&raw);
        if text.is_empty() {
            return Err("No se detectó audio comprensible.".into());
        }
        Ok(text)
    }

    // ── Speaking ─────────────────────────────────────────────────────────────

    /// Reads `text` aloud and emits `speech-ended` when done (or stopped).
    pub fn speak(&self, app: &AppHandle, text: &str, lang: &str) -> Result<(), String> {
        self.stop_speaking();

        let text: String = text.chars().take(1500).collect();
        let mut cmd = if which("espeak-ng").is_some() {
            let mut c = Command::new("espeak-ng");
            c.args(["-v", lang, "-s", "165", "--", &text]);
            c
        } else if which("espeak").is_some() {
            let mut c = Command::new("espeak");
            c.args(["-v", lang, "-s", "165", "--", &text]);
            c
        } else if which("spd-say").is_some() {
            let mut c = Command::new("spd-say");
            c.args(["-w", "-l", lang, "--", &text]);
            c
        } else {
            return Err("No voice found. Install espeak-ng or espeak: sudo apt install espeak".into());
        };

        let mut child = cmd
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()
            .map_err(|e| format!("Could not speak: {e}"))?;
        *self.speech.lock().unwrap() = Some(child.id());

        let app = app.clone();
        tauri::async_runtime::spawn_blocking(move || {
            let _ = child.wait();
            let _ = app.emit("speech-ended", ());
        });
        Ok(())
    }

    pub fn stop_speaking(&self) {
        if let Some(pid) = self.speech.lock().unwrap().take() {
            terminate(pid);
        }
    }
}

/// whisper prints bracketed non-speech marks like [BLANK_AUDIO] or (music).
fn clean_transcript(raw: &str) -> String {
    let mut out = String::new();
    let mut depth = 0u32;
    for ch in raw.chars() {
        match ch {
            '[' | '(' => depth += 1,
            ']' | ')' => depth = depth.saturating_sub(1),
            _ if depth == 0 => out.push(if ch == '\n' { ' ' } else { ch }),
            _ => {}
        }
    }
    out.split_whitespace().collect::<Vec<_>>().join(" ")
}

#[cfg(test)]
mod tests {
    use super::clean_transcript;

    #[test]
    fn transcript_drops_non_speech_marks() {
        assert_eq!(clean_transcript(" [BLANK_AUDIO]\n"), "");
        assert_eq!(clean_transcript(" hola (música)\n qué tal\n"), "hola qué tal");
    }
}
