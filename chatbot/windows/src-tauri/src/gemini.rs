// Google Gemini chat backend: communicates with the Google Generative Language API
// using the Gemini model configured in settings (gemini-3.5-flash by default).
//
// Context handling:
//   * Screen text (OCR) is attached to the current turn only.
//   * A dropped text file is inlined on the first turn.
//   * Passages retrieved from the user's saved documents (RAG) are attached to the current turn only.

use std::path::Path;
use std::sync::Mutex;
use std::time::Duration;

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

use crate::screen;

pub const DEFAULT_MODEL: &str = "gemini-3.5-flash";
pub const DEFAULT_API_KEY: &str = "";
const MAX_INLINE_TEXT: u64 = 200_000;
/// Chat history kept for the model (user + model messages).
const MAX_HISTORY: usize = 16;

const SYSTEM_PROMPT: &str = "You are Mochi, a friendly desktop assistant living on the user's screen. \
When a SCREEN CONTEXT block is provided, it is text read from the user's screen by OCR and may contain \
small recognition errors; use it to answer. If the user asks about what they are looking at (a spreadsheet, \
a web page, a document), explain it simply, step by step, as if to a smart person who is new to the topic, \
defining any technical term in one short sentence. \
Point out the key numbers and what they mean. If the screen text is not enough, say so honestly instead of guessing. \
When a KNOWLEDGE BASE block is provided, it holds passages from the user's own saved documents: prefer it over general \
knowledge, name the document you used, and say so if it does not contain the answer. \
Respond in the user's language. No markdown formatting (no **, no ##, no bullet dashes): plain text with line breaks.";

#[derive(Default)]
pub struct Chat {
    /// History of messages with role "user" or "model"
    messages: Mutex<Vec<Value>>,
}

impl Chat {
    pub fn reset(&self) {
        self.messages.lock().unwrap().clear();
    }

    fn is_empty(&self) -> bool {
        self.messages.lock().unwrap().is_empty()
    }

    fn push(&self, role: &str, content: &str) {
        let mut m = self.messages.lock().unwrap();
        m.push(json!({
            "role": role,
            "parts": [{ "text": content }]
        }));
        let len = m.len();
        if len > MAX_HISTORY {
            m.drain(0..len - MAX_HISTORY);
        }
    }

    fn snapshot(&self) -> Vec<Value> {
        self.messages.lock().unwrap().clone()
    }
}

#[derive(Debug, Clone, Deserialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum ChatContext {
    File { name: String, path: String },
    Window { app_name: String, title: String, url: Option<String> },
    /// Capture + OCR the screen right now.
    Screen,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatReply {
    pub text: String,
}

/// One chat turn against Google Gemini. `knowledge` is the retrieved KNOWLEDGE
/// BASE block (see rag.rs), empty when nothing relevant was found.
pub async fn send(
    chat: &Chat,
    api_key: &str,
    model: &str,
    query: String,
    context: Option<ChatContext>,
    knowledge: String,
) -> Result<ChatReply, String> {
    let key = if api_key.trim().is_empty() {
        DEFAULT_API_KEY
    } else {
        api_key.trim()
    };

    let model_name = if model.trim().is_empty() {
        DEFAULT_MODEL
    } else {
        model.trim().strip_prefix("models/").unwrap_or(model.trim())
    };

    let mut prefix = String::new();

    match &context {
        Some(ChatContext::Screen) => {
            match screen::read_screen().await {
                Ok(ctx) => prefix = ctx.as_prompt(),
                Err(e) => {
                    eprintln!("[Coucou ScreenContext] read_screen skipped: {e}");
                }
            }
        }
        Some(ChatContext::File { name, path }) if chat.is_empty() => {
            prefix = file_prompt(name, path).await?;
        }
        Some(ChatContext::Window { app_name, title, url }) if chat.is_empty() => {
            prefix = format!("[Context — App: {app_name}, Window: {title}");
            if let Some(url) = url {
                prefix.push_str(&format!(", URL: {url}"));
            }
            prefix.push_str("]\n");
        }
        _ => {}
    }

    let prefix = format!("{knowledge}{prefix}");
    let user_content = if prefix.is_empty() {
        query.clone()
    } else {
        format!("{prefix}\nQuestion: {query}")
    };

    let mut contents = chat.snapshot();
    contents.push(json!({
        "role": "user",
        "parts": [{ "text": user_content }]
    }));

    let body = json!({
        "systemInstruction": {
            "parts": [{ "text": SYSTEM_PROMPT }]
        },
        "contents": contents,
        "generationConfig": {
            "temperature": 0.4
        }
    });

    let text = call(key, model_name, &body).await?;

    chat.push("user", &query);
    chat.push("model", &text);
    Ok(ChatReply { text })
}

async fn file_prompt(name: &str, path: &str) -> Result<String, String> {
    let ext = std::path::Path::new(path)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();
    if matches!(ext.as_str(), "png" | "jpg" | "jpeg" | "gif" | "webp") {
        let text = screen::read_image(std::path::Path::new(path)).await?;
        return Ok(format!("[File: {name} — text read from the image via OCR]\n{text}\n[END OF FILE]\n"));
    }
    let len = std::fs::metadata(path).map_err(|e| e.to_string())?.len();
    if len > MAX_INLINE_TEXT {
        return Err("That file is too large.".into());
    }
    let text = std::fs::read_to_string(path)
        .map_err(|_| "I can only read text files, images and the screen for now.".to_string())?;
    Ok(format!("[File: {name}]\n{text}\n[END OF FILE]\n"))
}

async fn call(api_key: &str, model: &str, body: &Value) -> Result<String, String> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(90))
        .build()
        .map_err(|e| e.to_string())?;

    let url = format!(
        "https://generativelanguage.googleapis.com/v1beta/models/{}:generateContent?key={}",
        model, api_key
    );

    let response = client
        .post(&url)
        .header("Content-Type", "application/json")
        .json(body)
        .send()
        .await
        .map_err(|e| {
            if e.is_connect() {
                "Cannot connect to Google Gemini API. Please check your internet connection.".to_string()
            } else if e.is_timeout() {
                "Gemini API request timed out.".to_string()
            } else {
                format!("Gemini request failed: {e}")
            }
        })?;

    let status = response.status();
    let json: Value = response
        .json()
        .await
        .map_err(|e| format!("Unexpected response from Gemini API: {e}"))?;

    if !status.is_success() {
        let msg = json
            .get("error")
            .and_then(|e| e.get("message"))
            .and_then(Value::as_str)
            .unwrap_or("Unknown Gemini API error");
        return Err(format!("Gemini API error ({status}): {msg}"));
    }

    let candidates = json.get("candidates").and_then(Value::as_array);
    let first_cand = candidates.and_then(|c| c.first());
    let parts = first_cand
        .and_then(|c| c.get("content"))
        .and_then(|c| c.get("parts"))
        .and_then(Value::as_array);

    let text = if let Some(parts) = parts {
        let combined: String = parts
            .iter()
            .filter_map(|p| p.get("text").and_then(Value::as_str))
            .collect();
        combined.trim().to_string()
    } else {
        String::new()
    };

    if text.is_empty() {
        return Err("Gemini returned an empty response.".into());
    }

    Ok(text)
}

/// Transcribe an audio file using Google Gemini API.
pub async fn transcribe(api_key: &str, model: &str, audio_path: &Path, lang: &str) -> Result<String, String> {
    let bytes = std::fs::read(audio_path).map_err(|e| format!("Could not read audio file: {e}"))?;
    if bytes.is_empty() {
        return Ok(String::new());
    }
    let b64 = crate::b64::base64(&bytes);

    let key = if api_key.trim().is_empty() {
        DEFAULT_API_KEY
    } else {
        api_key.trim()
    };

    let model_name = if model.trim().is_empty() {
        DEFAULT_MODEL
    } else {
        model.trim().strip_prefix("models/").unwrap_or(model.trim())
    };

    let prompt = if lang.starts_with("es") {
        "Transcribe el audio con precisión en español. Devuelve ÚNICAMENTE las palabras habladas transcritas, sin explicaciones, sin comentarios, sin comillas y sin formato adicional."
    } else {
        "Transcribe the spoken audio accurately. Return ONLY the transcribed text, without explanations, comments, quotes, or formatting."
    };

    let body = json!({
        "contents": [
            {
                "parts": [
                    { "text": prompt },
                    {
                        "inline_data": {
                            "mime_type": "audio/wav",
                            "data": b64
                        }
                    }
                ]
            }
        ],
        "generationConfig": {
            "temperature": 0.1
        }
    });

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(120))
        .build()
        .map_err(|e| e.to_string())?;

    let url = format!(
        "https://generativelanguage.googleapis.com/v1beta/models/{}:generateContent?key={}",
        model_name, key
    );

    let response = client
        .post(&url)
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| {
            if e.is_connect() {
                "Cannot connect to Google Gemini API. Please check your internet connection.".to_string()
            } else if e.is_timeout() {
                "Gemini transcription timed out.".to_string()
            } else {
                format!("Gemini transcription request failed: {e}")
            }
        })?;

    let status = response.status();
    let json_resp: Value = response
        .json()
        .await
        .map_err(|e| format!("Unexpected response from Gemini API: {e}"))?;

    if !status.is_success() {
        let msg = json_resp
            .get("error")
            .and_then(|e| e.get("message"))
            .and_then(Value::as_str)
            .unwrap_or("Unknown Gemini API error");
        return Err(format!("Gemini transcription error ({status}): {msg}"));
    }

    let candidates = json_resp.get("candidates").and_then(Value::as_array);
    let first_cand = candidates.and_then(|c| c.first());
    let parts = first_cand
        .and_then(|c| c.get("content"))
        .and_then(|c| c.get("parts"))
        .and_then(Value::as_array);

    let text = if let Some(parts) = parts {
        let combined: String = parts
            .iter()
            .filter_map(|p| p.get("text").and_then(Value::as_str))
            .collect();
        combined.trim().to_string()
    } else {
        String::new()
    };

    Ok(text)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_gemini_api_call() {
        let rt = tokio::runtime::Runtime::new().unwrap();
        rt.block_on(async {
            let chat = Chat::default();
            let reply = send(
                &chat,
                DEFAULT_API_KEY,
                DEFAULT_MODEL,
                "Responde únicamente con la palabra OK si estás funcionando.".to_string(),
                None,
                String::new(),
            )
            .await;

            assert!(reply.is_ok(), "Gemini send failed: {:?}", reply.err());
            let text = reply.unwrap().text;
            println!("Gemini test reply 1: {}", text);
            assert!(!text.is_empty(), "Reply should not be empty");

            // Turn 2 to verify conversation history
            let reply2 = send(
                &chat,
                DEFAULT_API_KEY,
                DEFAULT_MODEL,
                "¿Qué fue lo último que te pregunté? Responde muy breve.".to_string(),
                None,
                String::new(),
            )
            .await;

            assert!(reply2.is_ok(), "Gemini turn 2 failed: {:?}", reply2.err());
            let text2 = reply2.unwrap().text;
            println!("Gemini test reply 2: {}", text2);
            assert!(!text2.is_empty(), "Turn 2 reply should not be empty");
        });
    }

    #[test]
    fn test_gemini_audio_transcribe() {
        let rt = tokio::runtime::Runtime::new().unwrap();
        rt.block_on(async {
            // Generate audio with espeak
            let tmp_wav = std::env::temp_dir().join("test_gemini_transcribe.wav");
            let _ = std::process::Command::new("espeak")
                .args(["-v", "es", "-w"])
                .arg(&tmp_wav)
                .arg("Hola Mochi")
                .status();

            if tmp_wav.exists() {
                let res = transcribe(DEFAULT_API_KEY, DEFAULT_MODEL, &tmp_wav, "es").await;
                let _ = std::fs::remove_file(&tmp_wav);
                assert!(res.is_ok(), "Transcription failed: {:?}", res.err());
                let text = res.unwrap();
                println!("Gemini transcribed: {}", text);
                assert!(!text.is_empty(), "Transcription must not be empty");
            }
        });
    }
}
