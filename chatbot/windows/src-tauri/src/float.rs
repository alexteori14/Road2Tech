// Where the floating mascot lives on the desktop, and remembering it.
//
// The window is a fixed transparent panel (see island.rs); the island is drawn
// at its top centre. Moving the window moves Mochi. The position is saved to
// position.json next to settings.json — kept apart from Settings because the
// settings window rewrites that whole struct on every save.

use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Mutex;
use std::time::Duration;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Monitor, WebviewWindow};

/// True once the window was put somewhere this run.
static PLACED: AtomicBool = AtomicBool::new(false);
/// Bumped on every move; only the last one of a burst gets written.
static GENERATION: AtomicU64 = AtomicU64::new(0);
static LAST: Mutex<(i32, i32)> = Mutex::new((0, 0));

#[derive(Serialize, Deserialize)]
struct Saved {
    x: i32,
    y: i32,
}

fn path() -> PathBuf {
    crate::settings::config_dir().join("position.json")
}

fn load() -> Option<(i32, i32)> {
    let bytes = std::fs::read(path()).ok()?;
    let s: Saved = serde_json::from_slice(&bytes).ok()?;
    Some((s.x, s.y))
}

/// Called for every `Moved` event of the island window. Writes the position
/// once the window has stopped moving for half a second.
pub fn moved(x: i32, y: i32) {
    if !PLACED.load(Ordering::Relaxed) {
        return;
    }
    *LAST.lock().unwrap() = (x, y);
    let generation = GENERATION.fetch_add(1, Ordering::Relaxed) + 1;
    std::thread::spawn(move || {
        std::thread::sleep(Duration::from_millis(500));
        if GENERATION.load(Ordering::Relaxed) != generation {
            return;
        }
        let (x, y) = *LAST.lock().unwrap();
        let dir = crate::settings::config_dir();
        if crate::platform::ensure_private_dir(&dir).is_ok() {
            if let Ok(json) = serde_json::to_vec(&Saved { x, y }) {
                let _ = std::fs::write(path(), json);
            }
        }
    });
}

/// Physical top-left for the window. Keeps the current spot when it is still on
/// a display, else the saved one, else the bottom-right corner of `primary`.
pub fn place(
    app: &AppHandle,
    win: &WebviewWindow,
    primary: &Monitor,
    width: u32,
    _height: u32,
) -> (i32, i32) {
    let monitors = app.available_monitors().unwrap_or_default();
    // Mochi is drawn at the top centre of the panel: that point must be on screen.
    let on_screen = |x: i32, y: i32| {
        let (px, py) = (x + width as i32 / 2, y + 24);
        monitors.iter().any(|m| {
            let p = m.position();
            let s = m.size();
            px >= p.x && px < p.x + s.width as i32 && py >= p.y && py < p.y + s.height as i32
        })
    };

    let candidate = if PLACED.load(Ordering::Relaxed) {
        win.outer_position().ok().map(|p| (p.x, p.y))
    } else {
        load()
    };
    if let Some((x, y)) = candidate {
        if on_screen(x, y) {
            PLACED.store(true, Ordering::Relaxed);
            return (x, y);
        }
    }

    let scale = primary.scale_factor();
    let p = primary.position();
    let s = primary.size();
    let x = p.x + s.width as i32 - width as i32 - (24.0 * scale) as i32;
    let y = p.y + (s.height as f64 * 0.62) as i32;
    PLACED.store(true, Ordering::Relaxed);
    (x, y)
}
