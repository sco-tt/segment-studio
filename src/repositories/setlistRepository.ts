import { databaseService } from '../services/databaseService';

export interface SetList {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
  estimated_duration: number | null;
}

export interface SetListItem {
  id: string;
  set_list_id: string;
  song_routine_id: string;
  play_mode: 'routine' | 'single';
  order_index: number;
}

export interface CreateSetList {
  name: string;
  description?: string;
  estimated_duration?: number;
}

export class SetlistRepository {
  async findAll(): Promise<SetList[]> {
    return await databaseService.executeQuery<SetList>(
      `SELECT * FROM set_lists ORDER BY updated_at DESC`
    );
  }

  async findById(id: string): Promise<SetList | null> {
    const rows = await databaseService.executeQuery<SetList>(
      `SELECT * FROM set_lists WHERE id = ?`,
      [id]
    );
    return rows[0] || null;
  }

  async findByName(name: string): Promise<SetList | null> {
    const rows = await databaseService.executeQuery<SetList>(
      `SELECT * FROM set_lists WHERE name = ? LIMIT 1`,
      [name]
    );
    return rows[0] || null;
  }

  async getItems(setListId: string): Promise<SetListItem[]> {
    return await databaseService.executeQuery<SetListItem>(
      `SELECT * FROM set_list_items WHERE set_list_id = ? ORDER BY order_index ASC`,
      [setListId]
    );
  }

  async create(data: CreateSetList, songRoutineIds: string[]): Promise<string> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    await databaseService.executeNonQuery(
      `INSERT INTO set_lists (id, name, description, created_at, updated_at, estimated_duration)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, data.name, data.description || null, now, now, data.estimated_duration ?? null]
    );

    await this.replaceItems(id, songRoutineIds);
    return id;
  }

  async update(id: string, updates: Partial<CreateSetList>): Promise<void> {
    const fields: string[] = [];
    const values: any[] = [];

    Object.entries(updates).forEach(([key, value]) => {
      fields.push(`${key} = ?`);
      values.push(value);
    });

    if (fields.length === 0) return;

    fields.push('updated_at = ?');
    values.push(new Date().toISOString());
    values.push(id);

    await databaseService.executeNonQuery(
      `UPDATE set_lists SET ${fields.join(', ')} WHERE id = ?`,
      values
    );
  }

  async replaceItems(setListId: string, songRoutineIds: string[]): Promise<void> {
    await databaseService.executeNonQuery(
      `DELETE FROM set_list_items WHERE set_list_id = ?`,
      [setListId]
    );

    for (let i = 0; i < songRoutineIds.length; i++) {
      await databaseService.executeNonQuery(
        `INSERT INTO set_list_items (id, set_list_id, song_routine_id, play_mode, order_index)
         VALUES (?, ?, ?, ?, ?)`,
        [crypto.randomUUID(), setListId, songRoutineIds[i], 'single', i]
      );
    }

    await databaseService.executeNonQuery(
      `UPDATE set_lists SET updated_at = ? WHERE id = ?`,
      [new Date().toISOString(), setListId]
    );
  }

  async delete(id: string): Promise<void> {
    await databaseService.executeNonQuery(
      `DELETE FROM set_lists WHERE id = ?`,
      [id]
    );
  }
}
