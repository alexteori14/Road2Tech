// Screen awareness: turns "what is on my screen right now" into plain text
// the assistant can read.
//
// Pipeline:  screenshot (first tool that works)  →  tesseract OCR  →  text.
// The PNG lives in the temp dir for the duration of the OCR run only and is
// deleted straight after; nothing here ever leaves the machine.
//
// Everything is done through external CLI tools so the app needs no extra
// native libraries and works on both Wayland and X11:
//   screenshot : grim | gnome-screenshot | spectacle | scrot | import
//   OCR        : tesseract (+ language packs, e.g. tesseract-ocr-spa)
//   title      : xdotool | xprop (X11 / XWayland only, best effort)

use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};

use serde::Serialize;

/// Hard cap on the text handed to the model.
const MAX_CHARS: usize = 7_000;

#[derive(Debug, Clone, Serialize)]
pub struct ScreenContext {
    pub window_title: Option<String>,
    pub text: String,
    pub truncated: bool,
}

impl ScreenContext {
    /// The block prepended to the user's question.
    pub fn as_prompt(&self) -> String {
        let mut out = String::from("[SCREEN CONTEXT — text read from the user's screen via OCR]\n");
        if let Some(title) = &self.window_title {
            out.push_str(&format!("Active window: {title}\n"));
        }
        out.push_str("---\n");
        out.push_str(&self.text);
        if self.truncated {
            out.push_str("\n[…text truncated…]");
        }
        out.push_str("\n---\n[END OF SCREEN CONTEXT]\n");
        out
    }
}

/// Capture the screen and read it. The error text is meant for the island's
/// note view, so it says what to install.
pub async fn read_screen() -> Result<ScreenContext, String> {
    let png = capture().await?;
    let result = ocr(&png).await;
    let _ = std::fs::remove_file(&png);
    let raw = result?;

    let cleaned = clean(&raw);
    if cleaned.is_empty() {
        return Err("I could not read any text on the screen.".into());
    }
    let (text, truncated) = truncate(&cleaned, MAX_CHARS);
    Ok(ScreenContext { window_title: active_window_title().await, text, truncated })
}

// ── Screenshot ────────────────────────────────────────────────────────────────

fn temp_png() -> PathBuf {
    let nanos = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    std::env::temp_dir().join(format!("coucou-screen-{}-{nanos}.png", std::process::id()))
}

async fn capture() -> Result<PathBuf, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let path = temp_png();
        let p = path.to_string_lossy().to_string();

        // Order matters: grim is wlroots-only but fast; gnome-screenshot and
        // spectacle go through the desktop's own portal/shell; scrot and import are
        // X11 (they also work on XWayland content only).
        let candidates: Vec<(&str, Vec<String>)> = vec![
            ("grim", vec![p.clone()]),
            ("gnome-screenshot", vec!["-f".into(), p.clone()]),
            ("spectacle", vec!["-b".into(), "-n".into(), "-f".into(), "-o".into(), p.clone()]),
            ("scrot", vec!["-o".into(), p.clone()]),
            ("import", vec!["-window".into(), "root".into(), p.clone()]),
        ];

        for (tool, args) in candidates {
            if which(tool).is_none() {
                continue;
            }
            if run_quiet(tool, &args)
                && std::fs::metadata(&path).map(|m| m.len() > 0).unwrap_or(false)
            {
                return Ok(path);
            }
            let _ = std::fs::remove_file(&path);
        }

        Err("No screenshot tool worked. Install one: grim (Sway/Hyprland), gnome-screenshot (GNOME), \
             spectacle (KDE) or scrot (X11)."
            .into())
    })
    .await
    .map_err(|e| e.to_string())?
}

// ── OCR ───────────────────────────────────────────────────────────────────────

/// OCR of an existing image file (dropped screenshots, photos of documents).
pub async fn read_image(path: &Path) -> Result<String, String> {
    let cleaned = clean(&ocr(path).await?);
    if cleaned.is_empty() {
        return Err("I could not read any text in that image.".into());
    }
    Ok(truncate(&cleaned, MAX_CHARS).0)
}

async fn ocr(png: &Path) -> Result<String, String> {
    if which("tesseract").is_none() {
        return Err("tesseract is not installed. Run: sudo apt install tesseract-ocr tesseract-ocr-spa".into());
    }
    let png_path = png.to_path_buf();
    tauri::async_runtime::spawn_blocking(move || {
        let img = png_path.to_string_lossy().to_string();

        // psm 6 = "a single uniform block of text": the best default for tables and
        // spreadsheets, where it keeps cells of a row on the same line.
        let langs = installed_languages();
        let lang = ["spa", "eng"]
            .iter()
            .filter(|l| langs.iter().any(|x| x == *l))
            .copied()
            .collect::<Vec<_>>()
            .join("+");

        let mut cmd = Command::new("tesseract");
        cmd.args([&img, "stdout", "--psm", "6"]);
        if !lang.is_empty() {
            cmd.args(["-l", &lang]);
        }

        let out = cmd
            .stdin(Stdio::null())
            .stderr(Stdio::null())
            .output()
            .map_err(|e| format!("tesseract failed: {e}"))?;

        if !out.status.success() {
            return Err("tesseract failed to read image.".to_string());
        }

        Ok(String::from_utf8_lossy(&out.stdout).into_owned())
    })
    .await
    .map_err(|e| e.to_string())?
}

fn installed_languages() -> Vec<String> {
    let Ok(out) = Command::new("tesseract")
        .arg("--list-langs")
        .stdin(Stdio::null())
        .output()
    else {
        return vec![];
    };
    String::from_utf8_lossy(&out.stdout)
        .lines()
        .skip(1) // "List of available languages (n):"
        .map(|l| l.trim().to_string())
        .collect()
}

// ── Active window title (best effort) ─────────────────────────────────────────

async fn active_window_title() -> Option<String> {
    tauri::async_runtime::spawn_blocking(move || {
        if which("xdotool").is_some() {
            if let Some(t) = capture_stdout("xdotool", &["getactivewindow", "getwindowname"]) {
                return Some(t);
            }
        }
        if which("xprop").is_some() {
            let id = capture_stdout("xprop", &["-root", "_NET_ACTIVE_WINDOW"])?;
            let id = id.split_whitespace().last()?.to_string();
            let name = capture_stdout("xprop", &["-id", &id, "_NET_WM_NAME"])?;
            return name.split_once('=').map(|(_, v)| v.trim().trim_matches('"').to_string());
        }
        None
    })
    .await
    .unwrap_or(None)
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/// Collapse OCR noise: trailing spaces, runs of blank lines.
fn clean(raw: &str) -> String {
    let mut out = String::new();
    let mut blank = 0;
    for line in raw.lines() {
        let line = line.trim_end();
        if line.trim().is_empty() {
            blank += 1;
            if blank > 1 {
                continue;
            }
        } else {
            blank = 0;
        }
        out.push_str(line);
        out.push('\n');
    }
    out.trim().to_string()
}

fn truncate(text: &str, max_chars: usize) -> (String, bool) {
    if text.chars().count() <= max_chars {
        return (text.to_string(), false);
    }
    (text.chars().take(max_chars).collect(), true)
}

fn which(tool: &str) -> Option<PathBuf> {
    let path = std::env::var_os("PATH")?;
    std::env::split_paths(&path).map(|d| d.join(tool)).find(|p| p.is_file())
}

fn run_quiet(tool: &str, args: &[String]) -> bool {
    let mut child = match Command::new(tool)
        .args(args)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
    {
        Ok(c) => c,
        Err(_) => return false,
    };

    let start = std::time::Instant::now();
    let timeout = std::time::Duration::from_millis(2000);

    loop {
        match child.try_wait() {
            Ok(Some(status)) => return status.success(),
            Ok(None) => {
                if start.elapsed() >= timeout {
                    let _ = child.kill();
                    let _ = child.wait();
                    return false;
                }
                std::thread::sleep(std::time::Duration::from_millis(50));
            }
            Err(_) => return false,
        }
    }
}

fn capture_stdout(tool: &str, args: &[&str]) -> Option<String> {
    let mut child = Command::new(tool)
        .args(args)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .spawn()
        .ok()?;

    let start = std::time::Instant::now();
    let timeout = std::time::Duration::from_millis(1500);

    loop {
        match child.try_wait() {
            Ok(Some(status)) => {
                if !status.success() {
                    return None;
                }
                let mut out = String::new();
                use std::io::Read;
                if let Some(mut stdout) = child.stdout.take() {
                    let _ = stdout.read_to_string(&mut out);
                }
                let s = out.trim().to_string();
                return (!s.is_empty()).then_some(s);
            }
            Ok(None) => {
                if start.elapsed() >= timeout {
                    let _ = child.kill();
                    let _ = child.wait();
                    return None;
                }
                std::thread::sleep(std::time::Duration::from_millis(50));
            }
            Err(_) => return None,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn clean_collapses_blank_runs_and_trailing_spaces() {
        assert_eq!(clean("a  \n\n\n\nb\n"), "a\n\nb");
    }

    #[test]
    fn truncate_respects_char_boundaries() {
        let (t, cut) = truncate("ñandú", 3);
        assert_eq!(t, "ñan");
        assert!(cut);
        assert!(!truncate("ab", 3).1);
    }
}
