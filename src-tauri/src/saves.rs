//! The desktop build's save files: one file per slot in the saves folder, read and written for
//! the page (`src/systems/core/SaveFiles.js`). The browser and dev builds keep their saves in
//! localStorage and never call these.

use std::fs::{self, File};
use std::io::{self, Write};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Mutex, MutexGuard};
use std::time::Duration;

use tauri::ipc::{InvokeBody, Request, Response};
use tauri::{AppHandle, Manager, Runtime, WebviewWindow, Window};

/// Slot numbers the page may name; the file name is built from the number, never from text.
const MAX_SLOTS: u32 = 16;

/// How long a closing window waits for the page to save before it closes anyway.
const CLOSE_GRACE: Duration = Duration::from_secs(5);

/// One read, write or delete at a time, so a read never sees a write half-way.
static LOCK: Mutex<()> = Mutex::new(());

/// The page has said it saves the game itself when the window closes (`claim_close_save`).
static PAGE_SAVES_ON_CLOSE: AtomicBool = AtomicBool::new(false);
static CLOSING: AtomicBool = AtomicBool::new(false);

fn lock() -> MutexGuard<'static, ()> {
  LOCK.lock().unwrap_or_else(|poisoned| poisoned.into_inner())
}

/// `slot1.json` for slot index 0: the files carry the slot number the player sees.
pub fn slot_path(dir: &Path, slot: u32, backup: bool) -> PathBuf {
  let n = slot + 1;
  dir.join(if backup {
    format!("slot{n}.backup.json")
  } else {
    format!("slot{n}.json")
  })
}

fn temp_path(path: &Path) -> PathBuf {
  let mut name = path.file_name().unwrap_or_default().to_os_string();
  name.push(".tmp");
  path.with_file_name(name)
}

/// ⚠️ Windows refuses a rename over a file another program holds open for a moment (a virus
/// scanner, the player's editor), so a refused rename is tried again briefly before giving up.
fn rename_with_retry(from: &Path, to: &Path) -> io::Result<()> {
  let mut tries = 0;
  loop {
    match fs::rename(from, to) {
      Ok(()) => return Ok(()),
      Err(e) if e.kind() == io::ErrorKind::PermissionDenied && tries < 20 => {
        tries += 1;
        std::thread::sleep(Duration::from_millis(50));
      }
      Err(e) => return Err(e),
    }
  }
}

/// `bytes` lands at `path` whole or not at all. ⚠️ Never write a save in place: it goes to a temp
/// file beside it, is flushed to the disk, and only then renamed over the old one, so a crash or a
/// power cut part-way leaves the old file as it was.
pub fn write_whole(path: &Path, bytes: &[u8]) -> io::Result<()> {
  let tmp = temp_path(path);
  {
    let mut file = File::create(&tmp)?;
    file.write_all(bytes)?;
    file.sync_all()?;
  }
  rename_with_retry(&tmp, path)
}

/// A slot's save or its backup; `None` when there is no such file.
pub fn read_slot(dir: &Path, slot: u32, backup: bool) -> io::Result<Option<Vec<u8>>> {
  match fs::read(slot_path(dir, slot, backup)) {
    Ok(bytes) => Ok(Some(bytes)),
    Err(e) if e.kind() == io::ErrorKind::NotFound => Ok(None),
    Err(e) => Err(e),
  }
}

/// Write a slot's save. With `roll_backup`, the save it replaces becomes the slot's backup first,
/// as in the browser build, unless that file is not even JSON: a broken file never replaces a
/// good backup.
pub fn write_slot(dir: &Path, slot: u32, bytes: &[u8], roll_backup: bool) -> io::Result<()> {
  fs::create_dir_all(dir)?;
  let main = slot_path(dir, slot, false);
  if roll_backup {
    if let Ok(previous) = fs::read(&main) {
      if serde_json::from_slice::<serde::de::IgnoredAny>(&previous).is_ok() {
        // Best effort, as in the browser build: a backup that cannot be written never blocks
        // the save itself.
        if let Err(e) = write_whole(&slot_path(dir, slot, true), &previous) {
          log::warn!("slot {slot}: the backup could not be written: {e}");
        }
      }
    }
  }
  write_whole(&main, bytes)
}

/// Remove a slot's save, its backup and any temp file a cut-off write left.
pub fn delete_slot(dir: &Path, slot: u32) -> io::Result<()> {
  let main = slot_path(dir, slot, false);
  let backup = slot_path(dir, slot, true);
  for path in [temp_path(&main), temp_path(&backup), main, backup] {
    match fs::remove_file(&path) {
      Ok(()) => {}
      Err(e) if e.kind() == io::ErrorKind::NotFound => {}
      Err(e) => return Err(e),
    }
  }
  Ok(())
}

fn saves_dir<R: Runtime>(app: &AppHandle<R>) -> Result<PathBuf, String> {
  app
    .path()
    .app_data_dir()
    .map(|dir| dir.join("saves"))
    .map_err(|e| e.to_string())
}

fn check_slot(slot: u32) -> Result<u32, String> {
  if slot < MAX_SLOTS {
    Ok(slot)
  } else {
    Err(format!("no slot {slot}"))
  }
}

fn header<'a>(request: &'a Request<'_>, name: &str) -> Option<&'a str> {
  request.headers().get(name).and_then(|v| v.to_str().ok())
}

/// The save's bytes (raw), or `null` when the slot has no such file.
#[tauri::command(async)]
pub fn save_read<R: Runtime>(app: AppHandle<R>, slot: u32, backup: bool) -> Result<Response, String> {
  let dir = saves_dir(&app)?;
  let slot = check_slot(slot)?;
  let _guard = lock();
  match read_slot(&dir, slot, backup).map_err(|e| e.to_string())? {
    Some(bytes) => Ok(Response::new(bytes)),
    None => Ok(Response::new(String::from("null"))),
  }
}

/// The save's bytes are the request's raw body; the slot and whether to roll the backup are
/// headers, so a large save is not escaped into JSON on the way.
#[tauri::command(async)]
pub fn save_write<R: Runtime>(app: AppHandle<R>, request: Request<'_>) -> Result<(), String> {
  let dir = saves_dir(&app)?;
  let slot = header(&request, "fg-slot")
    .and_then(|s| s.parse::<u32>().ok())
    .ok_or_else(|| String::from("no slot"))
    .and_then(check_slot)?;
  let roll_backup = header(&request, "fg-roll-backup") != Some("0");
  let InvokeBody::Raw(bytes) = request.body() else {
    return Err(String::from("the save must be sent as bytes"));
  };
  let _guard = lock();
  write_slot(&dir, slot, bytes, roll_backup).map_err(|e| e.to_string())
}

#[tauri::command(async)]
pub fn save_delete<R: Runtime>(app: AppHandle<R>, slot: u32) -> Result<(), String> {
  let dir = saves_dir(&app)?;
  let slot = check_slot(slot)?;
  let _guard = lock();
  delete_slot(&dir, slot).map_err(|e| e.to_string())
}

#[tauri::command(async)]
pub fn saves_folder<R: Runtime>(app: AppHandle<R>) -> Result<String, String> {
  Ok(saves_dir(&app)?.display().to_string())
}

/// Show the saves folder in the system's file browser.
#[tauri::command(async)]
pub fn open_saves_folder<R: Runtime>(app: AppHandle<R>) -> Result<(), String> {
  let dir = saves_dir(&app)?;
  fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
  #[cfg(target_os = "windows")]
  let program = "explorer";
  #[cfg(target_os = "macos")]
  let program = "open";
  #[cfg(all(not(target_os = "windows"), not(target_os = "macos")))]
  let program = "xdg-open";
  std::process::Command::new(program)
    .arg(&dir)
    .spawn()
    .map(|_| ())
    .map_err(|e| e.to_string())
}

/// From now on a closing window asks the page to save first (`on_close_requested`).
#[tauri::command]
pub fn claim_close_save() {
  PAGE_SAVES_ON_CLOSE.store(true, Ordering::SeqCst);
}

/// The page has saved: close the window. Waits for a write still going.
#[tauri::command(async)]
pub fn close_after_save<R: Runtime>(window: WebviewWindow<R>) -> Result<(), String> {
  let _guard = lock();
  window.destroy().map_err(|e| e.to_string())
}

/// A close request: when the page saves on closing, the window stays open until it has
/// (`close_after_save`), or until `CLOSE_GRACE` has passed. ⚠️ A file write may not finish once
/// the window is gone, so the window waits for the page rather than the page racing the window.
pub fn on_close_requested<R: Runtime>(window: &Window<R>, api: &tauri::CloseRequestApi) {
  if !PAGE_SAVES_ON_CLOSE.load(Ordering::SeqCst) {
    return;
  }
  api.prevent_close();
  if CLOSING.swap(true, Ordering::SeqCst) {
    return;
  }
  if let Some(webview) = window.get_webview_window(window.label()) {
    let _ = webview.eval("window.dispatchEvent(new CustomEvent('fg-close-requested'))");
  }
  // ⚠️ A page that never answers (hung, crashed) must not keep the window open for ever.
  let window = window.clone();
  std::thread::spawn(move || {
    std::thread::sleep(CLOSE_GRACE);
    let _guard = lock();
    let _ = window.destroy();
  });
}

#[cfg(test)]
mod tests {
  use super::*;
  use std::sync::atomic::AtomicUsize;

  static NEXT: AtomicUsize = AtomicUsize::new(0);

  /// A fresh, empty folder for one test.
  fn folder() -> PathBuf {
    let dir = std::env::temp_dir().join(format!(
      "fg_saves_test_{}_{}",
      std::process::id(),
      NEXT.fetch_add(1, Ordering::SeqCst)
    ));
    let _ = fs::remove_dir_all(&dir);
    fs::create_dir_all(&dir).unwrap();
    dir
  }

  fn read(dir: &Path, slot: u32, backup: bool) -> Option<String> {
    read_slot(dir, slot, backup)
      .unwrap()
      .map(|b| String::from_utf8(b).unwrap())
  }

  #[test]
  fn a_written_save_reads_back_and_leaves_no_temp_file() {
    let dir = folder();
    assert_eq!(read(&dir, 0, false), None);
    write_slot(&dir, 0, br#"{"a":1}"#, true).unwrap();
    assert_eq!(read(&dir, 0, false).as_deref(), Some(r#"{"a":1}"#));
    assert!(dir.join("slot1.json").exists());
    assert!(!dir.join("slot1.json.tmp").exists());
    assert_eq!(read(&dir, 0, true), None);
  }

  #[test]
  fn the_save_it_replaces_becomes_the_backup() {
    let dir = folder();
    write_slot(&dir, 1, br#"{"n":1}"#, true).unwrap();
    write_slot(&dir, 1, br#"{"n":2}"#, true).unwrap();
    assert_eq!(read(&dir, 1, false).as_deref(), Some(r#"{"n":2}"#));
    assert_eq!(read(&dir, 1, true).as_deref(), Some(r#"{"n":1}"#));
    assert!(dir.join("slot2.backup.json").exists());
  }

  #[test]
  fn without_roll_the_backup_is_kept() {
    let dir = folder();
    write_slot(&dir, 0, br#"{"n":1}"#, true).unwrap();
    write_slot(&dir, 0, br#"{"n":2}"#, true).unwrap();
    write_slot(&dir, 0, br#"{"n":3}"#, false).unwrap();
    assert_eq!(read(&dir, 0, false).as_deref(), Some(r#"{"n":3}"#));
    assert_eq!(read(&dir, 0, true).as_deref(), Some(r#"{"n":1}"#));
  }

  #[test]
  fn a_broken_file_never_replaces_a_good_backup() {
    let dir = folder();
    write_slot(&dir, 0, br#"{"n":1}"#, true).unwrap();
    write_slot(&dir, 0, br#"{"n":2}"#, true).unwrap();
    fs::write(dir.join("slot1.json"), b"{\"n\":2, trunc").unwrap();
    write_slot(&dir, 0, br#"{"n":3}"#, true).unwrap();
    assert_eq!(read(&dir, 0, false).as_deref(), Some(r#"{"n":3}"#));
    assert_eq!(read(&dir, 0, true).as_deref(), Some(r#"{"n":1}"#));
  }

  #[test]
  fn a_write_cut_off_part_way_leaves_the_last_good_save() {
    let dir = folder();
    write_slot(&dir, 0, br#"{"good":true}"#, true).unwrap();
    // The process died while writing: half a save in the temp file.
    fs::write(dir.join("slot1.json.tmp"), b"{\"good\":fa").unwrap();
    assert_eq!(read(&dir, 0, false).as_deref(), Some(r#"{"good":true}"#));
    // The next write goes through over the leftover.
    write_slot(&dir, 0, br#"{"next":1}"#, true).unwrap();
    assert_eq!(read(&dir, 0, false).as_deref(), Some(r#"{"next":1}"#));
    assert_eq!(read(&dir, 0, true).as_deref(), Some(r#"{"good":true}"#));
  }

  #[test]
  fn a_write_that_fails_leaves_the_last_good_save() {
    let dir = folder();
    write_slot(&dir, 0, br#"{"good":true}"#, true).unwrap();
    // The temp file cannot be made (a folder stands in its place): the write fails.
    fs::create_dir_all(dir.join("slot1.json.tmp")).unwrap();
    assert!(write_slot(&dir, 0, br#"{"next":1}"#, true).is_err());
    assert_eq!(read(&dir, 0, false).as_deref(), Some(r#"{"good":true}"#));
  }

  #[test]
  fn a_write_makes_the_folder() {
    let dir = folder().join("saves");
    write_slot(&dir, 2, br#"{}"#, true).unwrap();
    assert_eq!(read(&dir, 2, false).as_deref(), Some("{}"));
    assert!(dir.join("slot3.json").exists());
  }

  #[test]
  fn delete_removes_the_save_its_backup_and_leftovers() {
    let dir = folder();
    write_slot(&dir, 0, br#"{"n":1}"#, true).unwrap();
    write_slot(&dir, 0, br#"{"n":2}"#, true).unwrap();
    fs::write(dir.join("slot1.json.tmp"), b"half").unwrap();
    write_slot(&dir, 1, br#"{"other":1}"#, true).unwrap();
    delete_slot(&dir, 0).unwrap();
    assert_eq!(read(&dir, 0, false), None);
    assert_eq!(read(&dir, 0, true), None);
    assert!(!dir.join("slot1.json.tmp").exists());
    assert_eq!(read(&dir, 1, false).as_deref(), Some(r#"{"other":1}"#));
    delete_slot(&dir, 0).unwrap();
  }
}
