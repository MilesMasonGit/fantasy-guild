use std::sync::atomic::{AtomicBool, Ordering};
use tauri::{Manager, WindowEvent};

/// Whether the page was last told the window is minimised.
static MINIMISED: AtomicBool = AtomicBool::new(false);

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    // ⚠️ WebView2 is never told its window is minimised: the page stays visible and keeps
    // drawing at full rate. Minimise and restore both arrive as a resize, so the page is told
    // here (`src/ui/drawingPause.js` listens) and pauses its own drawing.
    .on_window_event(|window, event| {
      if let WindowEvent::Resized(_) = event {
        let minimised = window.is_minimized().unwrap_or(false);
        if MINIMISED.swap(minimised, Ordering::SeqCst) != minimised {
          if let Some(webview) = window.get_webview_window(window.label()) {
            let _ = webview.eval(format!(
              "window.dispatchEvent(new CustomEvent('fg-window-minimised', {{ detail: {} }}))",
              minimised
            ));
          }
        }
      }
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
