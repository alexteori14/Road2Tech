// Preferences, stored as plain JSON in settings.json under platform::config_dir().
// No secret ever lands here — API keys live in the OS keychain (see secrets.rs).

use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Settings {
    pub sound_enabled: bool,
    pub sound_volume: f64,
    pub auto_close_interval: f64,
    pub absence_interval: f64,
    pub active_integrations: Vec<String>,
    /// "primary" = the main display, "cursor" = whichever display the mouse is on.
    pub screen: String,
    pub autostart: bool,
    pub hooks_installed: bool,
    /// Model used by the chat (e.g. gemini-3.5-flash).
    /// Defaulted explicitly so a settings.json written by an older build still loads.
    #[serde(default = "default_model")]
    pub model: String,
    /// Gemini API key.
    #[serde(default = "default_gemini_api_key")]
    pub gemini_api_key: String,
    /// Read the screen (screenshot + OCR) and send it as context with every question.
    #[serde(default = "default_true")]
    pub screen_aware: bool,
    /// Answer from the user's saved documents (RAG) when any are relevant.
    #[serde(default = "default_true")]
    pub rag_enabled: bool,
    /// Language of the microphone and of the voice (ISO 639-1: "es", "en"…).
    #[serde(default = "default_voice_lang")]
    pub voice_lang: String,
    /// Read the replies aloud.
    #[serde(default = "default_true")]
    pub speak_replies: bool,
}

fn default_voice_lang() -> String {
    "es".to_string()
}

fn default_gemini_api_key() -> String {
    crate::gemini::DEFAULT_API_KEY.to_string()
}

fn default_true() -> bool {
    true
}

fn default_model() -> String {
    crate::gemini::DEFAULT_MODEL.to_string()
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            sound_enabled: true,
            sound_volume: 0.12,
            auto_close_interval: 5.0,
            absence_interval: 180.0,
            active_integrations: Vec::new(),
            screen: "primary".into(),
            autostart: false,
            hooks_installed: false,
            model: default_model(),
            gemini_api_key: default_gemini_api_key(),
            screen_aware: true,
            rag_enabled: true,
            voice_lang: default_voice_lang(),
            speak_replies: true,
        }
    }
}

pub use crate::platform::{config_dir, local_dir};

pub fn hook_exe_path() -> PathBuf {
    local_dir().join("bin").join(crate::platform::HOOK_EXE)
}

fn settings_path() -> PathBuf {
    config_dir().join("settings.json")
}

pub fn load() -> Settings {
    match std::fs::read(settings_path()) {
        Ok(bytes) => {
            let mut s: Settings = serde_json::from_slice(&bytes).unwrap_or_default();
            // Migrate models from older setups (Claude or Ollama)
            if s.model.starts_with("claude") || s.model.contains("qwen") || s.model.is_empty() {
                s.model = default_model();
            }
            if s.gemini_api_key.trim().is_empty() {
                s.gemini_api_key = default_gemini_api_key();
            }
            // Strip out removed integrations
            s.active_integrations.retain(|id| {
                !matches!(
                    id.as_str(),
                    "integration_resend" | "integration_n8n" | "integration_vercel" | "integration_github"
                )
            });
            s
        }
        Err(_) => Settings::default(),
    }
}

pub fn save(settings: &Settings) -> std::io::Result<()> {
    let dir = config_dir();
    crate::platform::ensure_private_dir(&dir)?;
    let json = serde_json::to_vec_pretty(settings)
        .map_err(|e| std::io::Error::new(std::io::ErrorKind::InvalidData, e))?;
    std::fs::write(settings_path(), json)
}
