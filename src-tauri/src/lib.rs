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
                let protection_shortcut = Shortcut::new(Some(Modifiers::CONTROL), Code::KeyL);
                let app_handle = app.handle().clone();

                app.handle().plugin(
                    tauri_plugin_global_shortcut::Builder::new()
                        .with_handler(move |_app, shortcut, event| {
                            if event.state() == ShortcutState::Pressed {
                                if shortcut == &toggle_shortcut {
                                    if let Some(window) = app_handle.get_webview_window("main") {
                                        let _ = window.show();
                                    }
                                    let _ = app_handle.emit("toggle-overlay", ());
                                } else if shortcut == &protection_shortcut {
                                    let _ = app_handle.emit("toggle-protected", ());
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
        .run(tauri::generate_context!())
        .expect("erro ao executar o Imposer");
}
