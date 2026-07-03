use std::fs;
use std::path::Path;
use serde::{Deserialize, Serialize};
use tauri::{command, Manager};
use uuid::Uuid;

#[allow(dead_code)]
#[derive(Debug, Serialize, Deserialize)]
pub struct AudioFileInfo {
    pub id: String,
    pub filename: String,
    pub original_filename: String,
    pub file_path: String,
    pub duration: f64,
    pub file_size: u64,
    pub file_format: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct StemGroupInfo {
    pub id: String,
    pub name: String,
    pub tracks: Vec<AudioTrackInfo>,
    pub master_volume: i32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AudioTrackInfo {
    pub id: String,
    pub audio_file_id: String,
    pub stem_group_id: Option<String>,
    pub track_name: String,
    pub track_type: String,
    pub display_order: i32,
    pub is_muted: bool,
    pub volume: i32,
    pub pan_balance: i32,
}

#[command]
pub async fn upload_single_audio_file(
    app: tauri::AppHandle,
    file_path: String,
    track_name: Option<String>,
) -> Result<AudioTrackInfo, String> {
    // Validate file exists and is audio
    let source_path = Path::new(&file_path);
    if !source_path.exists() {
        return Err("File does not exist".to_string());
    }

    // Get file info
    let metadata = fs::metadata(&file_path).map_err(|e| e.to_string())?;
    let _file_size = metadata.len();
    let original_filename = source_path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("unknown")
        .to_string();

    // Validate file format
    let _file_format = get_audio_format(&original_filename)?;

    // Generate unique IDs
    let file_id = Uuid::new_v4().to_string();
    let track_id = Uuid::new_v4().to_string();

    // Create app data directory
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e: tauri::Error| e.to_string())?;
    let audio_dir = app_data_dir.join("audio_files").join("single");
    fs::create_dir_all(&audio_dir).map_err(|e| e.to_string())?;

    // Generate unique filename
    let file_extension = source_path
        .extension()
        .and_then(|ext| ext.to_str())
        .unwrap_or("mp3");
    let stored_filename = format!("{}_{}.{}", file_id, "single", file_extension);
    let dest_path = audio_dir.join(&stored_filename);

    // Copy file to app directory
    fs::copy(&file_path, &dest_path).map_err(|e| format!("Failed to copy file: {}", e))?;

    // Get audio duration (simplified - could use proper audio library later)
    let _duration = estimate_audio_duration(&dest_path)?;

    // Database operations will be handled by frontend service

    Ok(AudioTrackInfo {
        id: track_id,
        audio_file_id: file_id,
        stem_group_id: None,
        track_name: track_name.unwrap_or_else(|| {
            Path::new(&original_filename)
                .file_stem()
                .and_then(|s| s.to_str())
                .unwrap_or("Audio Track")
                .to_string()
        }),
        track_type: "full".to_string(),
        display_order: 0,
        is_muted: false,
        volume: 100,
        pan_balance: 0,
    })
}

#[command]
pub async fn upload_stem_group(
    app: tauri::AppHandle,
    group_name: String,
    file_paths: Vec<String>,
    track_names: Vec<String>,
) -> Result<StemGroupInfo, String> {
    if file_paths.len() != track_names.len() {
        return Err("File paths and track names must have the same length".to_string());
    }

    if file_paths.is_empty() {
        return Err("At least one file must be provided".to_string());
    }

    // Generate group ID
    let group_id = Uuid::new_v4().to_string();

    // Create app data directory for this stem group
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e: tauri::Error| e.to_string())?;
    let stems_dir = app_data_dir.join("audio_files").join("stems").join(&group_id);
    fs::create_dir_all(&stems_dir).map_err(|e| e.to_string())?;

    let mut tracks = Vec::new();
    let mut durations = Vec::new();

    // Process each file
    for (i, file_path) in file_paths.iter().enumerate() {
        let source_path = Path::new(file_path);
        if !source_path.exists() {
            return Err(format!("File does not exist: {}", file_path));
        }

        let metadata = fs::metadata(file_path).map_err(|e| e.to_string())?;
        let _file_size = metadata.len();
        let original_filename = source_path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("unknown")
            .to_string();

        // Validate file format
        let _file_format = get_audio_format(&original_filename)?;

        // Generate unique IDs
        let file_id = Uuid::new_v4().to_string();
        let track_id = Uuid::new_v4().to_string();

        // Generate unique filename for this track
        let file_extension = source_path
            .extension()
            .and_then(|ext| ext.to_str())
            .unwrap_or("mp3");
        let stored_filename = format!("{}_{}.{}", track_names[i].to_lowercase().replace(" ", "_"), file_id, file_extension);
        let dest_path = stems_dir.join(&stored_filename);

        // Copy file
        fs::copy(file_path, &dest_path).map_err(|e| format!("Failed to copy file {}: {}", file_path, e))?;

        // Get duration
        let duration = estimate_audio_duration(&dest_path)?;
        durations.push(duration);

        tracks.push(AudioTrackInfo {
            id: track_id,
            audio_file_id: file_id,
            stem_group_id: Some(group_id.clone()),
            track_name: track_names[i].clone(),
            track_type: "stem".to_string(),
            display_order: i as i32,
            is_muted: false,
            volume: 100,
            pan_balance: 0,
        });
    }

    // Validate that all tracks have similar durations (±2 seconds)
    let avg_duration: f64 = durations.iter().sum::<f64>() / durations.len() as f64;
    for (i, &duration) in durations.iter().enumerate() {
        if (duration - avg_duration).abs() > 2.0 {
            return Err(format!(
                "Track '{}' duration ({:.1}s) differs too much from average ({:.1}s). All tracks should be the same length.",
                track_names[i], duration, avg_duration
            ));
        }
    }

    Ok(StemGroupInfo {
        id: group_id,
        name: group_name,
        tracks,
        master_volume: 100,
    })
}

#[command]
pub async fn get_audio_file_url(
    app: tauri::AppHandle,
    file_id: String,
    is_stem_group: bool,
    stem_group_id: Option<String>,
) -> Result<String, String> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e: tauri::Error| e.to_string())?;

    let search_dir = if is_stem_group {
        if let Some(group_id) = stem_group_id {
            app_data_dir.join("audio_files").join("stems").join(group_id)
        } else {
            return Err("Stem group ID required for stem files".to_string());
        }
    } else {
        app_data_dir.join("audio_files").join("single")
    };

    // Debug: Print search directory and file_id
    println!("Searching for file_id '{}' in directory: {:?}", file_id, search_dir);

    // Check if search directory exists
    if !search_dir.exists() {
        println!("Search directory does not exist: {:?}", search_dir);
        return Err(format!("Audio directory not found: {:?}", search_dir));
    }

    // Find file that contains the file_id
    if let Ok(entries) = fs::read_dir(&search_dir) {
        println!("Reading directory entries...");
        let mut found_files = Vec::new();

        for entry in entries {
            if let Ok(entry) = entry {
                let filename = entry.file_name().to_string_lossy().to_string();
                found_files.push(filename.clone());

                if filename.contains(&file_id) {
                    let file_path = entry.path();
                    println!("Found matching file: {} -> {:?}", filename, file_path);
                    // Return a custom audio:// protocol URL
                    let path_string = file_path.to_string_lossy().to_string();
                    let encoded_path = urlencoding::encode(&path_string);
                    let audio_url = format!("audio://localhost/{}", encoded_path);
                    println!("Generated audio URL: {}", audio_url);
                    return Ok(audio_url);
                }
            }
        }

        println!("No matching file found. Available files: {:?}", found_files);
    } else {
        println!("Failed to read directory: {:?}", search_dir);
        return Err(format!("Failed to read audio directory: {:?}", search_dir));
    }

    Err(format!("Audio file not found. Searched for '{}' in {:?}", file_id, search_dir))
}

#[command]
pub async fn delete_audio_file(
    app: tauri::AppHandle,
    file_id: String,
    is_stem_group: bool,
    stem_group_id: Option<String>,
) -> Result<(), String> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e: tauri::Error| e.to_string())?;

    let search_dir = if is_stem_group {
        if let Some(group_id) = stem_group_id {
            app_data_dir.join("audio_files").join("stems").join(group_id)
        } else {
            return Err("Stem group ID required for stem files".to_string());
        }
    } else {
        app_data_dir.join("audio_files").join("single")
    };

    // Find and delete file
    if let Ok(entries) = fs::read_dir(&search_dir) {
        for entry in entries {
            if let Ok(entry) = entry {
                let filename = entry.file_name().to_string_lossy().to_string();
                if filename.contains(&file_id) {
                    fs::remove_file(entry.path()).map_err(|e| e.to_string())?;
                    return Ok(());
                }
            }
        }
    }

    Err("Audio file not found".to_string())
}

// Helper functions
fn get_audio_format(filename: &str) -> Result<String, String> {
    let path = Path::new(filename);
    let extension = path
        .extension()
        .and_then(|ext| ext.to_str())
        .unwrap_or("")
        .to_lowercase();

    match extension.as_str() {
        "mp3" => Ok("mp3".to_string()),
        "m4a" => Ok("m4a".to_string()),
        "wav" => Ok("wav".to_string()),
        "ogg" => Ok("ogg".to_string()),
        "flac" => Ok("flac".to_string()),
        _ => Err(format!("Unsupported audio format: {}", extension)),
    }
}

fn estimate_audio_duration(file_path: &Path) -> Result<f64, String> {
    // Simplified duration estimation based on file size and format
    // In a real implementation, you'd use an audio library like symphonia
    let metadata = fs::metadata(file_path).map_err(|e| e.to_string())?;
    let file_size = metadata.len() as f64;

    // Rough estimation for MP3: ~1MB per minute at 128kbps
    let estimated_duration = file_size / (128.0 * 1024.0 / 8.0) / 60.0;

    // Clamp to reasonable range
    Ok(estimated_duration.max(1.0).min(3600.0)) // 1 second to 1 hour
}