#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri_plugin_global_shortcut::GlobalShortcutExt;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .setup(|app| {
            app.global_shortcut().register("CTRL+F8")?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("erro ao executar o Imposer");
}
