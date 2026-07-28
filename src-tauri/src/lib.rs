#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

#[tauri::command]
fn open_overlay(app: AppHandle) -> Result<(), String> {
    let overlay = app.get_webview_window("overlay").ok_or("janela overlay nao encontrada")?;
    overlay.show().map_err(|error| error.to_string())?;
    overlay.set_always_on_top(true).map_err(|error| error.to_string())?;
    if let Some(main) = app.get_webview_window("main") {
        main.hide().map_err(|error| error.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn close_overlay(app: AppHandle) -> Result<(), String> {
    if let Some(overlay) = app.get_webview_window("overlay") {
        overlay.hide().map_err(|error| error.to_string())?;
    }
    if let Some(main) = app.get_webview_window("main") {
        main.show().map_err(|error| error.to_string())?;
        main.set_focus().map_err(|error| error.to_string())?;
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            #[cfg(desktop)]
            {
                if let Some(overlay) = app.get_webview_window("overlay") {
                    overlay.hide()?;
                }
                let toggle_shortcut = Shortcut::new(Some(Modifiers::CONTROL), Code::F8);
                let protection_shortcut = Shortcut::new(Some(Modifiers::CONTROL), Code::KeyL);
                let app_handle = app.handle().clone();

                app.handle().plugin(
                    tauri_plugin_global_shortcut::Builder::new()
                        .with_handler(move |_app, shortcut, event| {
                            if event.state() == ShortcutState::Pressed {
                                if shortcut == &toggle_shortcut {
                                    if let Some(main_window) = app_handle.get_webview_window("main") {
                                        if main_window.is_focused().unwrap_or(false) {
                                            return;
                                        }
                                    }
                                    if let Some(window) = app_handle.get_webview_window("overlay") {
                                        if window.is_visible().unwrap_or(true) {
                                            let _ = window.hide();
                                        } else {
                                            let _ = window.show();
                                        }
                                    }
                                } else if shortcut == &protection_shortcut {
                                    let _ = app_handle.emit_to("overlay", "toggle-protected", ());
                                }
                            }
                        })
                        .build(),
                )?;

                app.global_shortcut().register(toggle_shortcut)?;
                app.global_shortcut().register(protection_shortcut)?;
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![open_overlay, close_overlay])
        .run(tauri::generate_context!())
        .expect("erro ao executar o Imposer");
}
