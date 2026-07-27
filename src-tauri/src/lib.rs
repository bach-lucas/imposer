#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::{Emitter, Manager};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            #[cfg(desktop)]
            {
                let toggle_shortcut = Shortcut::new(Some(Modifiers::CONTROL), Code::F8);
                let app_handle = app.handle().clone();

                app.handle().plugin(
                    tauri_plugin_global_shortcut::Builder::new()
                        .with_handler(move |_app, shortcut, event| {
                            if shortcut == &toggle_shortcut && event.state() == ShortcutState::Pressed {
                                if let Some(window) = app_handle.get_webview_window("main") {
                                    let _ = window.show();
                                    let _ = window.set_focus();
                                }
                                let _ = app_handle.emit("toggle-overlay", ());
                            }
                        })
                        .build(),
                )?;

                app.global_shortcut().register(toggle_shortcut)?;
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("erro ao executar o Imposer");
}
