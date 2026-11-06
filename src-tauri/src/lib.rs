use std::sync::atomic::{AtomicBool, Ordering};
use tauri::{Manager, WindowEvent};

mod saves;

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
    .invoke_handler(tauri::generate_handler![
      saves::save_read,
      saves::save_write,
      saves::save_delete,
      saves::saves_folder,
      saves::open_saves_folder,
      saves::claim_close_save,
      saves::close_after_save
    ])
    // ⚠️ WebView2 is never told its window is minimised: the page stays visible and keeps
    // drawing at full rate. Minimise and restore both arrive as a resize, so the page is told
    // here (`src/ui/drawingPause.js` listens) and pauses its own drawing.
    .on_window_event(|window, event| {
      if let WindowEvent::CloseRequested { api, .. } = event {
        saves::on_close_requested(window, api);
      }
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
