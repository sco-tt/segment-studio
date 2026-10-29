import { useState, useEffect, useCallback } from 'react';
import { SetlistRepository, SetList, CreateSetList } from '../repositories/setlistRepository';
import { databaseService } from '../services/databaseService';

const setlistRepo = new SetlistRepository();

export function useSetlists() {
  const [setlists, setSetlists] = useState<SetList[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSetlists = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      await databaseService.initialize();
      const rows = await setlistRepo.findAll();
      setSetlists(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load setlists');
      console.error('Error loading setlists:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const saveSetlist = useCallback(async (
    data: CreateSetList,
    songRoutineIds: string[]
  ): Promise<string> => {
    try {
      setError(null);
      const id = await setlistRepo.create(data, songRoutineIds);
      await loadSetlists();
      return id;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save setlist';
      setError(msg);
      throw err;
    }
  }, [loadSetlists]);

  const updateSetlistItems = useCallback(async (
    id: string,
    songRoutineIds: string[]
  ): Promise<void> => {
    try {
      setError(null);
      await setlistRepo.replaceItems(id, songRoutineIds);
      await loadSetlists();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to update setlist';
      setError(msg);
      throw err;
    }
  }, [loadSetlists]);

  const renameSetlist = useCallback(async (
    id: string,
    name: string
  ): Promise<void> => {
    try {
      setError(null);
      await setlistRepo.update(id, { name });
      await loadSetlists();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to rename setlist';
      setError(msg);
      throw err;
    }
  }, [loadSetlists]);

  const deleteSetlist = useCallback(async (id: string): Promise<void> => {
    try {
      setError(null);
      await setlistRepo.delete(id);
      await loadSetlists();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to delete setlist';
      setError(msg);
      throw err;
    }
  }, [loadSetlists]);

  const getSetlistItems = useCallback(async (id: string): Promise<string[]> => {
    try {
      const items = await setlistRepo.getItems(id);
      return items.map(i => i.song_routine_id);
    } catch (err) {
      console.error('Error loading setlist items:', err);
      return [];
    }
  }, []);

  const findByName = useCallback(async (name: string): Promise<SetList | null> => {
    try {
      return await setlistRepo.findByName(name);
    } catch (err) {
      console.error('Error finding setlist by name:', err);
      return null;
    }
  }, []);

  useEffect(() => {
    loadSetlists();
  }, [loadSetlists]);

  return {
    setlists,
    loading,
    error,
    saveSetlist,
    updateSetlistItems,
    renameSetlist,
    deleteSetlist,
    getSetlistItems,
    findByName,
    refreshSetlists: loadSetlists,
  };
}
