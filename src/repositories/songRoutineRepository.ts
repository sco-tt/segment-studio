import { databaseService } from '../services/databaseService';

export interface SongRoutine {
  id: string;
  url: string;
  url_source: string;
  title: string;
  name: string;
  artist: string;
  duration: number;
  notes: string;
  freeform_notes: string;
  volume: number;
  mp3_content_id?: string;
  tags_json?: string;
  loops_json?: string;
  steps_json?: string;
  links_json?: string;
  created_at: string;
  last_practiced?: string;
  updated_at?: string;
}

export interface CreateSongRoutine {
  url: string;
  url_source?: string;
  title?: string;
  name?: string;
  artist?: string;
  duration?: number;
  notes?: string;
  freeform_notes?: string;
  volume?: number;
  mp3_content_id?: string;
  tags_json?: string;
  loops_json?: string;
  steps_json?: string;
  links_json?: string;
}

export interface Tag {
  id: number;
  name: string;
  color: string;
}

export class SongRoutineRepository {
  async create(routine: CreateSongRoutine): Promise<string> {
    console.log('SongRoutineRepository: Starting create with routine:', routine);

    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    console.log('SongRoutineRepository: Generated ID:', id);
    console.log('SongRoutineRepository: Current timestamp:', now);

    const params = [
      id,
      routine.url,
      routine.url_source || 'youtube',
      routine.title || '',
      routine.artist || '',
      routine.duration || 0,
      routine.notes || '',
      routine.freeform_notes || '',
      routine.volume || 100,
      routine.mp3_content_id || null,
      routine.tags_json || '[]',
      now,
      now,
    ];

    console.log('SongRoutineRepository: SQL parameters:', params);

    try {
      console.log('SongRoutineRepository: Executing SQL query...');
      await databaseService.executeNonQuery(
        `INSERT INTO song_routines
         (id, url, url_source, title, artist, duration, notes, freeform_notes, volume, mp3_content_id, tags_json, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        params
      );

      console.log('SongRoutineRepository: SQL execution successful, returning ID:', id);
      return id;
    } catch (error) {
      console.error('SongRoutineRepository: SQL execution failed:', error);
      console.error('SongRoutineRepository: Query was:', `INSERT INTO song_routines...`);
      console.error('SongRoutineRepository: Parameters were:', params);
      throw error;
    }
  }

  async findAll(): Promise<SongRoutine[]> {
    return await databaseService.executeQuery<SongRoutine>(
      `SELECT * FROM song_routines ORDER BY created_at DESC`
    );
  }

  async findById(id: string): Promise<SongRoutine | null> {
    const results = await databaseService.executeQuery<SongRoutine>(
      `SELECT * FROM song_routines WHERE id = ?`,
      [id]
    );
    return results[0] || null;
  }

  async findByUrl(url: string): Promise<SongRoutine | null> {
    console.log('SongRoutineRepository.findByUrl: Starting search for URL:', url);
    try {
      console.log('SongRoutineRepository.findByUrl: Executing SQL query...');
      const results = await databaseService.executeQuery<SongRoutine>(
        `SELECT * FROM song_routines WHERE url = ? LIMIT 1`,
        [url]
      );
      console.log('SongRoutineRepository.findByUrl: Query completed, results:', results);
      return results[0] || null;
    } catch (error) {
      console.error('SongRoutineRepository.findByUrl: Error during query:', error);
      throw error;
    }
  }

  async update(id: string, updates: Partial<SongRoutine>): Promise<void> {
    const updateFields: string[] = [];
    const values: any[] = [];

    // Build dynamic update query
    Object.entries(updates).forEach(([key, value]) => {
      if (key !== 'id' && key !== 'created_at') {
        updateFields.push(`${key} = ?`);
        values.push(value);
      }
    });

    if (updateFields.length === 0) return;

    updateFields.push('updated_at = ?');
    values.push(new Date().toISOString());
    values.push(id);

    await databaseService.executeNonQuery(
      `UPDATE song_routines SET ${updateFields.join(', ')} WHERE id = ?`,
      values
    );
  }

  async delete(id: string): Promise<void> {
    console.log('SongRoutineRepository.delete: Starting delete for ID:', id);
    try {
      const result = await databaseService.executeNonQuery(
        `DELETE FROM song_routines WHERE id = ?`,
        [id]
      );
      console.log('SongRoutineRepository.delete: Delete completed, rows affected:', result);
    } catch (error) {
      console.error('SongRoutineRepository.delete: Error during delete:', error);
      throw error;
    }
  }

  async updateLastPracticed(id: string): Promise<void> {
    const now = new Date().toISOString();
    await databaseService.executeNonQuery(
      `UPDATE song_routines SET last_practiced = ?, updated_at = ? WHERE id = ?`,
      [now, now, id]
    );
  }

  // Tags
  async getTags(): Promise<Tag[]> {
    return await databaseService.executeQuery<Tag>(
      `SELECT * FROM tags ORDER BY name`
    );
  }

  async createTag(name: string, color: string = '#007bff'): Promise<number> {
    await databaseService.executeNonQuery(
      `INSERT INTO tags (name, color) VALUES (?, ?)`,
      [name, color]
    );
    const result = await databaseService.executeQuery<{ 'last_insert_rowid()': number }>(
      `SELECT last_insert_rowid()`
    );
    return result[0]['last_insert_rowid()'];
  }

  async getRoutineTags(routineId: string): Promise<Tag[]> {
    return await databaseService.executeQuery<Tag>(
      `SELECT t.* FROM tags t
       JOIN song_routine_tags srt ON t.id = srt.tag_id
       WHERE srt.song_routine_id = ?
       ORDER BY t.name`,
      [routineId]
    );
  }

  async addTagToRoutine(routineId: string, tagId: number): Promise<void> {
    await databaseService.executeNonQuery(
      `INSERT OR IGNORE INTO song_routine_tags (song_routine_id, tag_id) VALUES (?, ?)`,
      [routineId, tagId]
    );
  }

  async removeTagFromRoutine(routineId: string, tagId: number): Promise<void> {
    await databaseService.executeNonQuery(
      `DELETE FROM song_routine_tags WHERE song_routine_id = ? AND tag_id = ?`,
      [routineId, tagId]
    );
  }

  async searchRoutines(query: string): Promise<SongRoutine[]> {
    const searchTerm = `%${query}%`;
    return await databaseService.executeQuery<SongRoutine>(
      `SELECT sr.* FROM song_routines sr
       WHERE sr.name LIKE ? OR sr.title LIKE ? OR sr.artist LIKE ?
       ORDER BY sr.updated_at DESC`,
      [searchTerm, searchTerm, searchTerm]
    );
  }
}