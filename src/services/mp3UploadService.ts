import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { databaseService } from './databaseService';

export interface AudioFileInfo {
  id: string;
  filename: string;
  original_filename: string;
  file_path: string;
  duration: number;
  file_size: number;
  file_format: string;
}

export interface StemGroupInfo {
  id: string;
  name: string;
  tracks: AudioTrackInfo[];
  master_volume: number;
}

export interface AudioTrackInfo {
  id: string;
  audio_file_id: string;
  stem_group_id?: string;
  track_name: string;
  track_type: 'full' | 'stem';
  display_order: number;
  is_muted: boolean;
  volume: number;
  pan_balance: number;
}

export class Mp3UploadService {
  private static instance: Mp3UploadService;

  private constructor() {}

  static getInstance(): Mp3UploadService {
    if (!Mp3UploadService.instance) {
      Mp3UploadService.instance = new Mp3UploadService();
    }
    return Mp3UploadService.instance;
  }

  async selectAudioFiles(multiple: boolean = false): Promise<string[]> {
    try {
      // Directly try to use Tauri file dialog - if we're not in Tauri, it will throw
      const selected = await open({
        multiple,
        filters: [
          {
            name: 'Audio Files',
            extensions: ['mp3', 'm4a', 'wav', 'ogg', 'flac']
          }
        ]
      });

      if (selected) {
        return Array.isArray(selected) ? selected : [selected];
      }
      return [];
    } catch (error) {
      console.error('Failed to select audio files:', error);
      // Check if it's a Tauri-specific error or environment issue
      if (error instanceof Error && error.message.includes('not available')) {
        throw new Error('File selection requires Tauri desktop app');
      }
      throw new Error(`Failed to open file dialog: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async uploadSingleFile(filePath: string, trackName?: string): Promise<string> {
    try {
      // Upload file via Tauri command
      const trackInfo: AudioTrackInfo = await invoke('upload_single_audio_file', {
        filePath,
        trackName
      });

      // Store file info in database
      await databaseService.executeNonQuery(
        `INSERT INTO audio_files (id, filename, original_filename, file_path, duration, file_size, file_format)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          trackInfo.audio_file_id,
          trackInfo.track_name,
          trackInfo.track_name, // Using track_name as filename for now
          '', // file_path handled by Tauri
          0, // duration will be set properly later
          0, // file_size will be set properly later
          'mp3' // default format
        ]
      );

      // Store track info in database
      await databaseService.executeNonQuery(
        `INSERT INTO audio_tracks (id, audio_file_id, stem_group_id, track_name, track_type, display_order, is_muted, volume, pan_balance)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          trackInfo.id,
          trackInfo.audio_file_id,
          null, // stem_group_id is null for single files
          trackInfo.track_name,
          trackInfo.track_type,
          trackInfo.display_order,
          trackInfo.is_muted ? 1 : 0,
          trackInfo.volume,
          trackInfo.pan_balance
        ]
      );

      // Create song routine for this single file
      const routineId = crypto.randomUUID();
      await databaseService.executeNonQuery(
        `INSERT INTO song_routines (id, url, url_source, title, artist, duration, notes, freeform_notes, volume, tags_json, mp3_content_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          routineId,
          null, // url is null for MP3 files
          'mp3', // url_source is 'mp3'
          trackInfo.track_name,
          'Unknown Artist',
          0, // duration will be updated later
          '',
          '',
          trackInfo.volume,
          '[]', // empty tags
          trackInfo.id // mp3_content_id points to the audio track
        ]
      );

      return routineId;
    } catch (error) {
      console.error('Failed to upload single file:', error);
      throw new Error(`Failed to upload file: ${error}`);
    }
  }

  async uploadStemGroup(
    groupName: string,
    filePaths: string[],
    trackNames: string[]
  ): Promise<string> {
    try {
      // Upload stem group via Tauri command
      const stemGroupInfo: StemGroupInfo = await invoke('upload_stem_group', {
        groupName,
        filePaths,
        trackNames
      });

      // Store stem group in database
      await databaseService.executeNonQuery(
        `INSERT INTO stem_groups (id, name, master_volume)
         VALUES (?, ?, ?)`,
        [
          stemGroupInfo.id,
          stemGroupInfo.name,
          stemGroupInfo.master_volume
        ]
      );

      // Store each file and track
      for (const track of stemGroupInfo.tracks) {
        // Store audio file
        await databaseService.executeNonQuery(
          `INSERT INTO audio_files (id, filename, original_filename, file_path, duration, file_size, file_format)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            track.audio_file_id,
            track.track_name,
            track.track_name,
            '', // file_path handled by Tauri
            0, // duration
            0, // file_size
            'mp3' // format
          ]
        );

        // Store audio track
        await databaseService.executeNonQuery(
          `INSERT INTO audio_tracks (id, audio_file_id, stem_group_id, track_name, track_type, display_order, is_muted, volume, pan_balance)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            track.id,
            track.audio_file_id,
            track.stem_group_id,
            track.track_name,
            track.track_type,
            track.display_order,
            track.is_muted ? 1 : 0,
            track.volume,
            track.pan_balance
          ]
        );
      }

      // Create song routine for this stem group
      const routineId = crypto.randomUUID();
      await databaseService.executeNonQuery(
        `INSERT INTO song_routines (id, url, url_source, title, artist, duration, notes, freeform_notes, volume, tags_json, mp3_content_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          routineId,
          null, // url is null for MP3 files
          'mp3', // url_source is 'mp3'
          stemGroupInfo.name,
          'Unknown Artist',
          0, // duration
          '',
          '',
          stemGroupInfo.master_volume,
          '[]', // empty tags
          stemGroupInfo.id // mp3_content_id points to the stem group
        ]
      );

      return routineId;
    } catch (error) {
      console.error('Failed to upload stem group:', error);
      throw new Error(`Failed to upload stem group: ${error}`);
    }
  }

  async getAudioUrl(fileId: string, stemGroupId?: string): Promise<string> {
    try {
      const params = {
        file_id: fileId,
        is_stem_group: !!stemGroupId,
        stem_group_id: stemGroupId || null
      };
      console.log('getAudioUrl: Calling Tauri command with params:', params);
      const audioUrl = await invoke<string>('get_audio_file_url', params);
      console.log('getAudioUrl: Got audio URL from Rust:', audioUrl);

      return audioUrl;
    } catch (error) {
      console.error('Failed to get audio URL:', error);
      throw new Error('Failed to get audio file URL');
    }
  }

  async deleteAudioFile(fileId: string, stemGroupId?: string): Promise<void> {
    try {
      await invoke('delete_audio_file', {
        file_id: fileId,
        is_stem_group: !!stemGroupId,
        stem_group_id: stemGroupId || null
      });
    } catch (error) {
      console.error('Failed to delete audio file:', error);
      throw new Error('Failed to delete audio file');
    }
  }

  async getUploadedSongs(): Promise<any[]> {
    try {
      return await databaseService.executeQuery(
        `SELECT sr.*,
          CASE
            WHEN sr.url_source = 'mp3' AND EXISTS(SELECT 1 FROM stem_groups sg WHERE sg.id = sr.mp3_content_id) THEN 'stem_group'
            WHEN sr.url_source = 'mp3' THEN 'single_track'
            ELSE 'youtube'
          END as content_type
         FROM song_routines sr
         WHERE sr.url_source = 'mp3'
         ORDER BY sr.created_at DESC`
      );
    } catch (error) {
      console.error('Failed to get uploaded songs:', error);
      throw new Error('Failed to get uploaded songs');
    }
  }

  async getStemGroupTracks(stemGroupId: string): Promise<AudioTrackInfo[]> {
    try {
      const tracks = await databaseService.executeQuery(
        `SELECT * FROM audio_tracks WHERE stem_group_id = ? ORDER BY display_order`,
        [stemGroupId]
      );

      return tracks.map((track: any) => ({
        id: track.id,
        audio_file_id: track.audio_file_id,
        stem_group_id: track.stem_group_id,
        track_name: track.track_name,
        track_type: track.track_type as 'full' | 'stem',
        display_order: track.display_order,
        is_muted: track.is_muted === 1,
        volume: track.volume,
        pan_balance: track.pan_balance
      }));
    } catch (error) {
      console.error('Failed to get stem group tracks:', error);
      throw new Error('Failed to get stem group tracks');
    }
  }

  async getAudioFileIdForTrack(trackId: string): Promise<string> {
    try {
      const result = await databaseService.executeQuery(
        `SELECT audio_file_id FROM audio_tracks WHERE id = ?`,
        [trackId]
      );

      if (result.length === 0) {
        throw new Error(`No track found with ID: ${trackId}`);
      }

      return result[0].audio_file_id;
    } catch (error) {
      console.error('Failed to get audio file ID for track:', error);
      throw new Error('Failed to get audio file ID for track');
    }
  }

  async updateTrackSettings(
    trackId: string,
    settings: {
      volume?: number;
      is_muted?: boolean;
      pan_balance?: number;
    }
  ): Promise<void> {
    try {
      const updates: string[] = [];
      const params: any[] = [];

      if (settings.volume !== undefined) {
        updates.push('volume = ?');
        params.push(settings.volume);
      }
      if (settings.is_muted !== undefined) {
        updates.push('is_muted = ?');
        params.push(settings.is_muted ? 1 : 0);
      }
      if (settings.pan_balance !== undefined) {
        updates.push('pan_balance = ?');
        params.push(settings.pan_balance);
      }

      if (updates.length > 0) {
        params.push(trackId);
        await databaseService.executeNonQuery(
          `UPDATE audio_tracks SET ${updates.join(', ')} WHERE id = ?`,
          params
        );
      }
    } catch (error) {
      console.error('Failed to update track settings:', error);
      throw new Error('Failed to update track settings');
    }
  }
}