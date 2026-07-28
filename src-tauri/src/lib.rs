#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::Serialize;
use serde_json::Value;
use std::collections::HashSet;
use std::fs;
use std::path::PathBuf;
use std::process::Command;
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

#[derive(Debug, Serialize)]
struct GameInstallation {
    folder: String,
    has_regulation: bool,
    has_data: bool,
    valid: bool,
}

#[derive(Debug, Serialize)]
struct RegulationInspection {
    path: String,
    size_bytes: u64,
    modified_unix_seconds: Option<u64>,
    readable: bool,
}

#[tauri::command]
fn inspect_regulation(path: String) -> Result<RegulationInspection, String> {
    let file = PathBuf::from(path.trim());
    let metadata = fs::metadata(&file).map_err(|error| format!("Nao foi possivel ler regulation.bin: {error}"))?;
    if !metadata.is_file() {
        return Err("O caminho informado nao e um arquivo.".to_string());
    }
    let modified_unix_seconds = metadata.modified().ok().and_then(|time| time.duration_since(std::time::UNIX_EPOCH).ok()).map(|duration| duration.as_secs());
    Ok(RegulationInspection { path: file.to_string_lossy().into_owned(), size_bytes: metadata.len(), modified_unix_seconds, readable: fs::File::open(file).is_ok() })
}

#[derive(Debug, Serialize)]
struct ErdbImportResult {
    output_dir: String,
    message: String,
}

#[derive(Debug, Serialize)]
struct CatalogEntry {
    name: String,
    category: String,
    icon: String,
    description: String,
    location: String,
    acquisition: String,
    vendor: String,
    sellable: String,
}

fn json_text(value: &Value, keys: &[&str]) -> String {
    keys.iter().find_map(|key| value.get(*key)).and_then(|value| match value {
        Value::String(text) if !text.trim().is_empty() => Some(text.trim().to_string()),
        Value::Number(number) => Some(number.to_string()),
        _ => None,
    }).unwrap_or_default()
}

fn collect_catalog_entries(value: &Value, category: &str, entries: &mut Vec<CatalogEntry>, known: &mut HashSet<String>) {
    if entries.len() >= 5000 { return; }
    match value {
        Value::Array(values) => values.iter().for_each(|value| collect_catalog_entries(value, category, entries, known)),
        Value::Object(object) => {
            let name = json_text(value, &["name", "text", "title"]);
            if !name.is_empty() && name.len() < 120 && !name.starts_with("<") {
                let key = format!("{category}:{name}");
                if known.insert(key) {
                    entries.push(CatalogEntry {
                        name,
                        category: category.to_string(),
                        icon: json_text(value, &["icon", "icon_id"]),
                        description: json_text(value, &["description", "desc"]),
                        location: "Não informado pelo jogo".to_string(),
                        acquisition: "Consulte os detalhes da fonte local".to_string(),
                        vendor: "Não informado pelo jogo".to_string(),
                        sellable: "Não informado".to_string(),
                    });
                }
            }
            object.values().for_each(|value| collect_catalog_entries(value, category, entries, known));
        }
        _ => {}
    }
}

#[tauri::command]
fn load_erdb_catalog() -> Result<Vec<CatalogEntry>, String> {
    let local_app_data = std::env::var_os("LOCALAPPDATA").ok_or("LOCALAPPDATA nao disponivel.")?;
    let catalog_dir = PathBuf::from(local_app_data).join("Imposer").join("catalog");
    if !catalog_dir.is_dir() { return Ok(Vec::new()); }

    let mut entries = Vec::new();
    let mut known = HashSet::new();
    for file in fs::read_dir(catalog_dir).map_err(|error| error.to_string())? {
        let path = file.map_err(|error| error.to_string())?.path();
        if path.extension().and_then(|value| value.to_str()) != Some("json") { continue; }
        let contents = fs::read_to_string(&path).map_err(|error| error.to_string())?;
        let value: Value = serde_json::from_str(&contents).map_err(|error| format!("JSON invalido em {}: {error}", path.display()))?;
        let category = path.file_stem().and_then(|value| value.to_str()).unwrap_or("Itens");
        collect_catalog_entries(&value, category, &mut entries, &mut known);
    }
    Ok(entries)
}

#[tauri::command]
fn run_erdb_import(game_dir: String) -> Result<ErdbImportResult, String> {
    let game_path = PathBuf::from(game_dir.trim());
    if !game_path.is_dir() || !game_path.join("regulation.bin").is_file() {
        return Err("A pasta Game valida nao foi encontrada.".to_string());
    }
    let item_message = game_path.join("msg").join("engus").join("item.msgbnd.txt");
    let item_archive = game_path.join("msg").join("engus").join("item.msgbnd.dcx");
    if !item_message.is_file() && !item_archive.is_file() {
        return Err("regulation.bin foi encontrado, mas os arquivos UXM ainda nao foram desempacotados. No UXM, use View Files, selecione msg\\engus\\item.msgbnd.txt, marque Use Selected Files e clique em Unpack. Nao use Patch.".to_string());
    }

    let local_app_data = std::env::var_os("LOCALAPPDATA").ok_or("LOCALAPPDATA nao disponivel.")?;
    let output_dir = PathBuf::from(local_app_data).join("Imposer").join("catalog");
    fs::create_dir_all(&output_dir).map_err(|error| format!("Nao foi possivel criar a pasta do catalogo: {error}"))?;

    let python = std::env::var_os("IMPOSER_PYTHON").map(PathBuf::from).unwrap_or_else(|| {
        PathBuf::from(std::env::var_os("LOCALAPPDATA").unwrap_or_default()).join("Programs").join("Python").join("Python312").join("python.exe")
    });
    let python = if python.is_file() { python } else { PathBuf::from("python") };

    let source = Command::new(&python).args(["-m", "erdb", "source", "--game-dir"]).arg(&game_path).arg("--keep-cache").output().map_err(|error| format!("Nao foi possivel executar o ERDB: {error}"))?;
    if !source.status.success() {
        let details = String::from_utf8_lossy(&source.stderr);
        return Err(format!("O ERDB nao conseguiu extrair os dados. A pasta precisa estar desempacotada pelo UXM. {details}"));
    }

    let generated = Command::new(&python).args(["-m", "erdb", "generate", "all", "--out"]).arg(&output_dir).output().map_err(|error| format!("Nao foi possivel gerar o catalogo ERDB: {error}"))?;
    if !generated.status.success() {
        return Err(format!("O ERDB extraiu os arquivos, mas falhou ao gerar o catalogo: {}", String::from_utf8_lossy(&generated.stderr)));
    }

    Ok(ErdbImportResult { output_dir: output_dir.to_string_lossy().into_owned(), message: "Catalogo local gerado pelo ERDB.".to_string() })
}

#[tauri::command]
fn validate_game_folder(path: String) -> Result<GameInstallation, String> {
    let selected = PathBuf::from(path.trim());
    if !selected.is_dir() {
        return Err("A pasta selecionada nao existe.".to_string());
    }

    let game_dir = if selected.join("regulation.bin").is_file() {
        selected
    } else if selected.join("Game").is_dir() {
        selected.join("Game")
    } else {
        selected
    };

    let has_regulation = game_dir.join("regulation.bin").is_file();
    let has_data = game_dir.join("Data0.bdt").is_file() || game_dir.join("data0.bdt").is_file();

    Ok(GameInstallation {
        folder: game_dir.to_string_lossy().into_owned(),
        has_regulation,
        has_data,
        valid: has_regulation && has_data,
    })
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
        .invoke_handler(tauri::generate_handler![open_overlay, close_overlay, validate_game_folder, inspect_regulation, run_erdb_import, load_erdb_catalog])
        .run(tauri::generate_context!())
        .expect("erro ao executar o Imposer");
}
