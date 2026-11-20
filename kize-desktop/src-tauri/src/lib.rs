#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // A missing updater signing key/config must NEVER prevent the editor from starting.
    // Unsigned builds do not register the updater plugin at all.
    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_process::init());

    #[cfg(feature = "signed-updates")]
    let builder = builder.plugin(tauri_plugin_updater::Builder::new().build());

    builder
        .run(tauri::generate_context!())
        .expect("Failed to run KIZE DESIGN TOOL");
}
