import { useState, useCallback, useRef, useEffect } from 'react';
import { LoopSegmentRepository, LoopSegment, CreateLoopSegment } from '../repositories/loopSegmentRepository';
import { databaseService } from '../services/databaseService';

const loopSegmentRepo = new LoopSegmentRepository();

export function useLoopControlsSQLite({ playerRef, isPlaying }: { playerRef: any; isPlaying: boolean }) {
  const [loops, setLoops] = useState<LoopSegment[]>([]);
  const [activeLoop, setActiveLoop] = useState<LoopSegment | null>(null);
  const [isLooping, setIsLooping] = useState(false);
  const [tempStart, setTempStart] = useState<number | null>(null);
  const [tempEnd, setTempEnd] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loopCheckIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastSeekTimeRef = useRef<number>(0);
  const seekCooldownRef = useRef<boolean>(false);

  // Initialize database but don't load any segments by default
  useEffect(() => {
    const initialize = async () => {
      try {
        setLoading(true);
        await databaseService.initialize();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to initialize');
      } finally {
        setLoading(false);
      }
    };

    initialize();
  }, []);

  const loadStandaloneSegments = useCallback(async () => {
    try {
      const segments = await loopSegmentRepo.findStandalone();
      setLoops(segments);
    } catch (err) {
      console.error('Error loading segments:', err);
      setError('Failed to load segments');
    }
  }, []);

  const loadSegmentsForRoutine = useCallback(async (routineId: string) => {
    try {
      const segments = await loopSegmentRepo.findByRoutineId(routineId);
      setLoops(segments);
    } catch (err) {
      console.error('Error loading routine segments:', err);
      setError('Failed to load routine segments');
    }
  }, []);

  // Clear loop checking when loop is disabled or player stops
  useEffect(() => {
    if (!isLooping || !isPlaying || !activeLoop) {
      if (loopCheckIntervalRef.current) {
        clearInterval(loopCheckIntervalRef.current);
        loopCheckIntervalRef.current = null;
      }
      return;
    }

    // Set up loop checking interval
    loopCheckIntervalRef.current = setInterval(() => {
      if (playerRef.current && activeLoop && isLooping && isPlaying && !seekCooldownRef.current) {
        try {
          const current = playerRef.current.getCurrentTime();

          // Check if we've passed the end time (with smaller buffer for tighter loops)
          if (current >= activeLoop.end_time - 0.05) {
            console.log(`Loop reached end at ${current.toFixed(2)}s, seeking back to ${activeLoop.start_time.toFixed(2)}s`);

            // Set cooldown to prevent rapid seeking
            seekCooldownRef.current = true;

            playerRef.current.seekTo(activeLoop.start_time);
            lastSeekTimeRef.current = Date.now();

            // Clear cooldown after a short delay
            setTimeout(() => {
              seekCooldownRef.current = false;
            }, 50); // Reduced from 300ms to 50ms for faster loops
          }

          // Also check if we've somehow gone outside the loop bounds
          if (current < activeLoop.start_time - 1 || current > activeLoop.end_time + 1) {
            console.log(`Player outside loop bounds (${current.toFixed(2)}s), seeking to start`);
            playerRef.current.seekTo(activeLoop.start_time);
          }
        } catch (error) {
          console.warn('Error in loop checking:', error);
        }
      }
    }, 100); // Check every 100ms - balances precision with performance

    return () => {
      if (loopCheckIntervalRef.current) {
        clearInterval(loopCheckIntervalRef.current);
      }
    };
  }, [isLooping, isPlaying, activeLoop, playerRef]);

  const setLoopStart = useCallback((time: number) => {
    setTempStart(time);
  }, []);

  const setLoopEnd = useCallback((time: number) => {
    setTempEnd(time);
  }, []);

  const saveLoop = useCallback(async (name: string, startTime: number, endTime: number, routineId?: string) => {
    try {
      setError(null);

      if (!routineId) {
        throw new Error('Cannot save segment: Video must be saved as a song first');
      }

      const segmentData: CreateLoopSegment = {
        song_routine_id: routineId,
        name,
        start_time: startTime,
        end_time: endTime,
        default_speed: 1.0,
        order_index: await loopSegmentRepo.getNextOrderIndex(routineId),
      };

      await loopSegmentRepo.create(segmentData);

      // Reload segments for this routine
      await loadSegmentsForRoutine(routineId);

      // Clear temp points
      setTempStart(null);
      setTempEnd(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save segment');
      throw err;
    }
  }, [loadSegmentsForRoutine]);

  const deleteLoop = useCallback(async (loopId: string) => {
    try {
      setError(null);

      // Find the loop to get its routine ID for reloading
      const loopToDelete = loops.find(loop => loop.id === loopId);
      const routineId = loopToDelete?.song_routine_id;

      await loopSegmentRepo.delete(loopId);

      // If we're deleting the active loop, clear it
      if (activeLoop?.id === loopId) {
        setActiveLoop(null);
        setIsLooping(false);
      }

      // Reload segments for this routine
      if (routineId) {
        await loadSegmentsForRoutine(routineId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete segment');
      throw err;
    }
  }, [activeLoop, loops, loadSegmentsForRoutine]);

  const selectLoop = useCallback((loop: LoopSegment | null) => {
    setActiveLoop(loop);

    // If selecting a loop, seek to its start
    if (loop && playerRef.current) {
      playerRef.current.seekTo(loop.start_time);
    }
  }, [playerRef]);

  const toggleLooping = useCallback(() => {
    console.log('🛑 toggleLooping - Current state: isLooping=', isLooping, 'activeLoop=', !!activeLoop);

    // Check if we have either an active loop OR temp start/end points
    if (!activeLoop && (tempStart === null || tempEnd === null)) {
      console.log('🛑 No active loop or temp points available');
      alert('Please set loop start (S) and end (E) points first');
      return;
    }

    // If we have temp points but no active loop, create a temporary active loop
    if (!activeLoop && tempStart !== null && tempEnd !== null) {
      const tempLoop: LoopSegment = {
        id: 'temp',
        name: `Temp Loop ${tempStart.toFixed(0)}s-${tempEnd.toFixed(0)}s`,
        start_time: tempStart,
        end_time: tempEnd,
        default_speed: 1.0,
        created_at: new Date().toISOString(),
        order_index: 0,
      };
      setActiveLoop(tempLoop);
    }

    setIsLooping(prev => {
      const newLooping = !prev;
      console.log('🛑 Toggling loop:', prev, '→', newLooping);

      // If starting to loop, seek to loop start
      if (newLooping && playerRef.current) {
        const loopToUse = activeLoop || { start_time: tempStart!, end_time: tempEnd! };
        console.log('🛑 Starting loop, seeking to:', loopToUse.start_time);
        playerRef.current.seekTo(loopToUse.start_time);
        lastSeekTimeRef.current = Date.now();
      } else if (!newLooping) {
        console.log('🛑 Stopping loop');
      }

      return newLooping;
    });
  }, [activeLoop, tempStart, tempEnd, playerRef]);

  const clearLoops = useCallback(async () => {
    try {
      setError(null);
      // This clears all standalone loops - use with caution!
      const standaloneSegments = await loopSegmentRepo.findStandalone();
      for (const segment of standaloneSegments) {
        await loopSegmentRepo.delete(segment.id);
      }

      setLoops([]);
      setActiveLoop(null);
      setIsLooping(false);
      setTempStart(null);
      setTempEnd(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to clear loops');
    }
  }, []);

  const clearLoopsDisplay = useCallback(() => {
    setLoops([]);
    setActiveLoop(null);
    setIsLooping(false);
    setTempStart(null);
    setTempEnd(null);
  }, []);

  const clearTempPoints = useCallback(() => {
    setTempStart(null);
    setTempEnd(null);
  }, []);

  const changeTempStart = useCallback((time: number) => {
    setTempStart(time);
  }, []);

  const changeTempEnd = useCallback((time: number) => {
    setTempEnd(time);
  }, []);

  const updateLoop = useCallback(async (loopId: string, updates: Partial<LoopSegment>) => {
    try {
      setError(null);

      // Find the loop to get its routine ID for reloading
      const loopToUpdate = loops.find(loop => loop.id === loopId);
      const routineId = loopToUpdate?.song_routine_id;

      await loopSegmentRepo.update(loopId, updates);

      // If updating the active loop, update it locally too
      if (activeLoop?.id === loopId) {
        setActiveLoop({ ...activeLoop, ...updates });
      }

      // Reload segments for this routine
      if (routineId) {
        await loadSegmentsForRoutine(routineId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update segment');
      throw err;
    }
  }, [activeLoop, loops, loadSegmentsForRoutine]);

  return {
    loops,
    activeLoop,
    isLooping,
    tempStart,
    tempEnd,
    loading,
    error,
    setLoopStart,
    setLoopEnd,
    saveLoop,
    deleteLoop,
    selectLoop,
    toggleLooping,
    clearLoops,
    clearLoopsDisplay,
    clearTempPoints,
    changeTempStart,
    changeTempEnd,
    updateLoop,
    loadSegmentsForRoutine,
    loadStandaloneSegments,
  };
}