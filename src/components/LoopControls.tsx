import { useState, useCallback, useEffect } from 'react';
import { LoopSegment } from '../types/loops';
import { EditableTime } from './EditableTime';
import './LoopControls.css';

interface LoopControlsProps {
  currentTime: number;
  activeLoop: LoopSegment | null;
  loops: LoopSegment[];
  isLooping: boolean;
  tempStart: number | null;
  tempEnd: number | null;
  currentSongId?: string;
  onSetLoopStart: (time: number) => void;
  onSetLoopEnd: (time: number) => void;
  onToggleLoop: () => void;
  onSelectLoop: (loop: LoopSegment | null) => void;
  onSaveLoop: (name: string, startTime: number, endTime: number, routineId?: string) => void;
  onDeleteLoop: (loopId: string) => void;
  onUpdateLoop?: (loopId: string, name: string, startTime: number, endTime: number) => void;
  onClearTempPoints: () => void;
  onChangeTempStart?: (time: number) => void;
  onChangeTempEnd?: (time: number) => void;
}

export function LoopControls({
  currentTime,
  activeLoop,
  loops,
  isLooping,
  tempStart,
  tempEnd,
  currentSongId,
  onSetLoopStart,
  onSetLoopEnd,
  onToggleLoop,
  onSelectLoop,
  onSaveLoop,
  onDeleteLoop,
  onUpdateLoop,
  onClearTempPoints,
  onChangeTempStart,
  onChangeTempEnd
}: LoopControlsProps) {
  const [newLoopName, setNewLoopName] = useState('');
  const [showSaveDialog, setShowSaveDialog] = useState(false);

  // Edit state management
  const [editingLoopId, setEditingLoopId] = useState<string | null>(null);
  const [editLoopName, setEditLoopName] = useState('');
  const [editStartTime, setEditStartTime] = useState(0);
  const [editEndTime, setEditEndTime] = useState(0);

  // Current loop edit state
  const [isEditingCurrentLoop, setIsEditingCurrentLoop] = useState(false);
  const [currentLoopName, setCurrentLoopName] = useState('');
  const [currentLoopStartTime, setCurrentLoopStartTime] = useState(0);
  const [currentLoopEndTime, setCurrentLoopEndTime] = useState(0);

  // Collapsible sections state
  const [isLoopSettingExpanded, setIsLoopSettingExpanded] = useState(true);
  const [, setIsSavedLoopsExpanded] = useState(false);
  const [isInstructionsExpanded, setIsInstructionsExpanded] = useState(false);

  // Auto-expand loops section when temp points are set or loops are saved
  useEffect(() => {
    if (tempStart !== null || tempEnd !== null) {
      setIsLoopSettingExpanded(true);
    }
  }, [tempStart, tempEnd]);

  // Auto-expand saved loops section when loops are added
  useEffect(() => {
    if (loops.length > 0) {
      setIsSavedLoopsExpanded(true);
    }
  }, [loops.length]);

  // Update active temp loop when temp times change
  useEffect(() => {
    if (activeLoop?.id === 'temp' && tempStart !== null && tempEnd !== null) {
      const updatedTempLoop = {
        ...activeLoop,
        startTime: tempStart,
        endTime: tempEnd,
        name: `Temp Loop ${tempStart.toFixed(0)}s-${tempEnd.toFixed(0)}s`
      };
      onSelectLoop(updatedTempLoop);
    }
  }, [tempStart, tempEnd]); // Removed activeLoop and onSelectLoop to prevent infinite loop

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    return `${mins}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  };

  const handleSetStart = useCallback(() => {
    const time = Math.floor(currentTime * 100) / 100; // Round to centiseconds
    onSetLoopStart(time);
  }, [currentTime, onSetLoopStart]);

  const handleSetEnd = useCallback(() => {
    const time = Math.floor(currentTime * 100) / 100;
    onSetLoopEnd(time);
  }, [currentTime, onSetLoopEnd]);

  const handleSaveLoop = useCallback(() => {
    if (!currentSongId) {
      alert('Please save the video as a song first before creating segments. Click "💾 Save Song" in the sidebar.');
      return;
    }

    if (tempStart !== null && tempEnd !== null) {
      if (tempEnd > tempStart) {
        // Auto-generate name if none provided
        const name = newLoopName.trim() || `Segment ${tempStart.toFixed(0)}s-${tempEnd.toFixed(0)}s`;
        onSaveLoop(name, tempStart, tempEnd, currentSongId);
        setNewLoopName('');
        setShowSaveDialog(false);
      } else {
        alert('End time must be after start time');
      }
    }
  }, [tempStart, tempEnd, newLoopName, onSaveLoop, currentSongId]);

  const handleQuickSave = useCallback(() => {
    if (!currentSongId) {
      alert('Please save the video as a song first before creating segments. Click "💾 Save Song" in the sidebar.');
      return;
    }

    if (tempStart !== null && tempEnd !== null) {
      if (tempEnd > tempStart) {
        // Auto-save with generated name
        const name = `Segment ${tempStart.toFixed(0)}s-${tempEnd.toFixed(0)}s`;
        onSaveLoop(name, tempStart, tempEnd, currentSongId);
        setNewLoopName('');
      } else {
        alert('End time must be after start time');
      }
    }
  }, [tempStart, tempEnd, onSaveLoop, currentSongId]);

  const handleClearTemp = useCallback(() => {
    // If currently looping a temp loop, stop it
    if (activeLoop?.id === 'temp' && isLooping) {
      onToggleLoop(); // Stop looping
      onSelectLoop(null); // Clear active loop
    }
    onClearTempPoints();
    setShowSaveDialog(false);
  }, [onClearTempPoints, activeLoop, isLooping, onToggleLoop, onSelectLoop]);

  const handlePlayLoop = useCallback((loop: LoopSegment) => {
    // Select the new loop (this will seek to its start time)
    onSelectLoop(loop);

    // If not currently looping, start looping
    // If already looping, the loop will automatically switch to the newly selected segment
    if (!isLooping) {
      onToggleLoop();
    }
    // Note: If already looping, just selecting the new loop is enough -
    // the loop checking logic will automatically use the new active loop
  }, [onSelectLoop, onToggleLoop, isLooping]);

  const handleStopLoop = useCallback(() => {
    // Stop looping if currently active
    if (isLooping) {
      onToggleLoop();
    }
    // Clear the active loop to return to full video playback
    onSelectLoop(null);
  }, [isLooping, onToggleLoop, onSelectLoop]);

  // Edit handlers
  const handleStartEdit = useCallback((loop: LoopSegment) => {
    setEditingLoopId(loop.id);
    setEditLoopName(loop.name);
    setEditStartTime(loop.start_time);
    setEditEndTime(loop.end_time);
  }, []);

  const handleSaveEdit = useCallback(() => {
    if (editingLoopId && onUpdateLoop) {
      if (editEndTime > editStartTime) {
        onUpdateLoop(editingLoopId, editLoopName, editStartTime, editEndTime);
        setEditingLoopId(null);
        setEditLoopName('');
        setEditStartTime(0);
        setEditEndTime(0);
      } else {
        alert('End time must be after start time');
      }
    }
  }, [editingLoopId, editLoopName, editStartTime, editEndTime, onUpdateLoop]);

  const handleCancelEdit = useCallback(() => {
    setEditingLoopId(null);
    setEditLoopName('');
    setEditStartTime(0);
    setEditEndTime(0);
  }, []);

  // Current loop edit handlers
  const handleStartEditCurrentLoop = useCallback(() => {
    if (activeLoop && activeLoop.id !== 'temp') {
      setIsEditingCurrentLoop(true);
      setCurrentLoopName(activeLoop.name);
      setCurrentLoopStartTime(activeLoop.start_time);
      setCurrentLoopEndTime(activeLoop.end_time);
    }
  }, [activeLoop]);

  const handleSaveCurrentLoopEdit = useCallback(() => {
    if (activeLoop && activeLoop.id !== 'temp' && onUpdateLoop) {
      if (currentLoopEndTime > currentLoopStartTime) {
        onUpdateLoop(activeLoop.id, currentLoopName, currentLoopStartTime, currentLoopEndTime);
        setIsEditingCurrentLoop(false);
      } else {
        alert('End time must be after start time');
      }
    }
  }, [activeLoop, currentLoopName, currentLoopStartTime, currentLoopEndTime, onUpdateLoop]);

  const handleCancelCurrentLoopEdit = useCallback(() => {
    setIsEditingCurrentLoop(false);
    setCurrentLoopName('');
    setCurrentLoopStartTime(0);
    setCurrentLoopEndTime(0);
  }, []);

  const handleRemoveCurrentLoop = useCallback(() => {
    if (activeLoop && activeLoop.id !== 'temp') {
      // Stop the loop first
      if (isLooping) {
        onToggleLoop();
      }
      // Clear active loop
      onSelectLoop(null);
      // Delete the loop
      onDeleteLoop(activeLoop.id);
    }
  }, [activeLoop, isLooping, onToggleLoop, onSelectLoop, onDeleteLoop]);

  const hasValidTempLoop = tempStart !== null && tempEnd !== null && tempEnd > tempStart;

  return (
    <div className="loop-controls">
      <div className="loop-header">
        <h3>🎯 Segments</h3>
        <button
          onClick={() => {
            if (isLooping) {
              handleStopLoop(); // Stop and clear segment, return to full video
            } else {
              onToggleLoop(); // Start looping (if temp points are set)
            }
          }}
          className={`loop-toggle ${isLooping ? 'active' : ''}`}
        >
          {isLooping ? '⏹️ Stop Loop' : '🔄 Start Loop'}
        </button>
      </div>

      {/* Current Loop Info */}
      <div className={`current-loop ${activeLoop ? 'active' : 'inactive'}`}>
        {activeLoop ? (
          isEditingCurrentLoop ? (
            <div className="current-loop-edit">
              <div className="current-edit-badge">EDITING CURRENT</div>
              <div className="edit-loop-info">
                <div className="edit-name-section">
                  <input
                    type="text"
                    placeholder="Loop name"
                    value={currentLoopName}
                    onChange={(e) => setCurrentLoopName(e.target.value)}
                    className="edit-name-input"
                  />
                </div>
                <div className="edit-loop-times">
                  <div className="temp-time-row">
                    <span className="time-label">Start:</span>
                    <EditableTime
                      timeInSeconds={currentLoopStartTime}
                      onTimeChange={setCurrentLoopStartTime}
                      className="time-value"
                    />
                  </div>
                  <div className="temp-time-row">
                    <span className="time-label">End:</span>
                    <EditableTime
                      timeInSeconds={currentLoopEndTime}
                      onTimeChange={setCurrentLoopEndTime}
                      className="time-value"
                    />
                    <span className="temp-duration-inline">
                      <span className="duration-label">Duration:</span>
                      <span className="duration-value">{formatTime(currentLoopEndTime - currentLoopStartTime)}</span>
                    </span>
                  </div>
                </div>
              </div>
              <div className="current-loop-actions">
                <button onClick={handleSaveCurrentLoopEdit} className="temp-save">
                  💾 Save
                </button>
                <button onClick={handleCancelCurrentLoopEdit} className="temp-delete">
                  ✕ Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="loop-info">
              <div className="current-loop-display">
                <strong>{activeLoop.name}</strong>
                <span>{formatTime(activeLoop.start_time)} → {formatTime(activeLoop.end_time)}</span>
              </div>
              <div className="current-loop-controls">
                {activeLoop.id !== 'temp' && (
                  <>
                    <button onClick={handleStartEditCurrentLoop} className="edit-current" title="Edit current loop">
                      ✏️
                    </button>
                    <button onClick={handleRemoveCurrentLoop} className="remove-current" title="Remove current loop">
                      🗑️
                    </button>
                  </>
                )}
              </div>
            </div>
          )
        ) : (
          <div className="loop-info placeholder">
            <span>&nbsp;</span>
          </div>
        )}
      </div>

      {/* Loop Point Setting */}
      <div className="collapsible-section">
        <button
          className="section-header"
          onClick={() => setIsLoopSettingExpanded(!isLoopSettingExpanded)}
        >
          <span>⚙️ Loops</span>
          <span className={`expand-icon ${isLoopSettingExpanded ? 'expanded' : ''}`}>▼</span>
        </button>

        {isLoopSettingExpanded && (
          <div className="loop-setting">
            <div className="loop-buttons">
              <button onClick={handleSetStart} className="set-start">
                📍 Set Start
              </button>
              <button onClick={handleSetEnd} className="set-end">
                🏁 Set End
              </button>
            </div>

            {tempStart !== null && (
              <div className="temp-loop">
                <div className="temp-loop-badge">TEMPORARY</div>
                <div className="temp-loop-info">
                  <div className="temp-loop-times">
                    <div className="temp-time-row">
                      <span className="time-label">Start:</span>
                      <EditableTime
                        timeInSeconds={tempStart}
                        onTimeChange={onChangeTempStart || (() => {})}
                        className="time-value"
                      />
                    </div>
                    <div className="temp-time-row">
                      <span className="time-label">End:</span>
                      {tempEnd !== null ? (
                        <EditableTime
                          timeInSeconds={tempEnd}
                          onTimeChange={onChangeTempEnd || (() => {})}
                          className="time-value"
                        />
                      ) : (
                        <span className="time-value">--:--</span>
                      )}
                      {tempEnd !== null && (
                        <span className="temp-duration-inline">
                          <span className="duration-label">Duration:</span>
                          <span className="duration-value">{formatTime(tempEnd - tempStart)}</span>
                        </span>
                      )}
                    </div>
                  </div>
                  {tempEnd === null && (
                    <div className="temp-duration incomplete">
                      Set end point to complete
                    </div>
                  )}
                </div>
                {!currentSongId && (
                  <div className="save-song-reminder">
                    <p>💡 Save the video as a song first to create segments</p>
                  </div>
                )}
                <div className="temp-loop-actions">
                  {hasValidTempLoop ? (
                    <>
                      <div className="temp-action-row">
                        <button onClick={() => {
                          const tempLoop: LoopSegment = {
                            id: 'temp',
                            name: 'Temp',
                            start_time: tempStart!,
                            end_time: tempEnd!,
                            default_speed: 1.0,
                            created_at: new Date().toISOString(),
                            order_index: 0,
                            startTime: tempStart!,
                            endTime: tempEnd!,
                            isActive: false
                          };
                          handlePlayLoop(tempLoop);
                        }} className="temp-play">
                          ▶️
                        </button>
                        <button onClick={handleClearTemp} className="temp-delete">
                          🗑️
                        </button>
                      </div>
                      <div className="temp-action-row">
                        <button
                          onClick={handleQuickSave}
                          className="temp-save"
                          disabled={!currentSongId}
                          title={!currentSongId ? "Save the video as a song first" : "Save segment"}
                          style={{
                            opacity: !currentSongId ? 0.5 : 1,
                            cursor: !currentSongId ? 'not-allowed' : 'pointer'
                          }}
                        >
                          💾 Save
                        </button>
                        <button
                          onClick={() => setShowSaveDialog(true)}
                          className="temp-save-custom"
                          disabled={!currentSongId}
                          title={!currentSongId ? "Save the video as a song first" : "Save segment with custom name"}
                          style={{
                            opacity: !currentSongId ? 0.5 : 1,
                            cursor: !currentSongId ? 'not-allowed' : 'pointer'
                          }}
                        >
                          ✏️ Custom
                        </button>
                      </div>
                    </>
                  ) : (
                    <button onClick={handleClearTemp} className="clear-temp-single">
                      ✕ Clear Start
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Save Loop Dialog */}
      {showSaveDialog && (
        <div className="save-dialog">
          <input
            type="text"
            placeholder="Loop name (e.g., 'Verse 1', 'Solo')"
            value={newLoopName}
            onChange={(e) => setNewLoopName(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSaveLoop()}
          />
          <div className="dialog-buttons">
            <button onClick={handleSaveLoop}>Save</button>
            <button onClick={() => setShowSaveDialog(false)}>Cancel</button>
          </div>
        </div>
      )}

      {/* All Loops List */}
      {loops.length > 0 && (
        <div className="all-loops-section">
          <h4>💾 All Loops ({loops.length})</h4>
          <div className="all-loops-list">
            {loops.map((loop) => (
              <div key={loop.id} className={`loop-item ${loop.id === activeLoop?.id ? 'currently-playing' : ''}`}>
                {editingLoopId === loop.id ? (
                  // Edit Mode
                  <>
                    <div className="edit-loop-badge">EDITING</div>
                    <div className="edit-loop-info">
                      <div className="edit-name-section">
                        <input
                          type="text"
                          placeholder="Loop name"
                          value={editLoopName}
                          onChange={(e) => setEditLoopName(e.target.value)}
                          className="edit-name-input"
                        />
                      </div>
                      <div className="edit-loop-times">
                        <div className="temp-time-row">
                          <span className="time-label">Start:</span>
                          <EditableTime
                            timeInSeconds={editStartTime}
                            onTimeChange={setEditStartTime}
                            className="time-value"
                          />
                        </div>
                        <div className="temp-time-row">
                          <span className="time-label">End:</span>
                          <EditableTime
                            timeInSeconds={editEndTime}
                            onTimeChange={setEditEndTime}
                            className="time-value"
                          />
                          <span className="temp-duration-inline">
                            <span className="duration-label">Duration:</span>
                            <span className="duration-value">{formatTime(editEndTime - editStartTime)}</span>
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="edit-loop-actions">
                      <button onClick={handleSaveEdit} className="temp-save">
                        💾 Save
                      </button>
                      <button onClick={handleCancelEdit} className="temp-delete">
                        ✕ Cancel
                      </button>
                    </div>
                  </>
                ) : (
                  // Normal Display Mode
                  <>
                    <div className={`loop-badge ${loop.id === activeLoop?.id ? 'playing' : 'saved'}`}>
                      {loop.id === activeLoop?.id ? 'PLAYING' : 'SAVED'}
                    </div>
                    <div className="loop-details">
                      <span className="loop-name">{loop.name}</span>
                      <span className="loop-time">
                        {formatTime(loop.start_time)} → {formatTime(loop.end_time)}
                      </span>
                    </div>
                    <div className="loop-actions">
                      <button
                        onClick={() => onSelectLoop(loop)}
                        className="select-loop"
                        title="Select this segment"
                      >
                        ▶️
                      </button>
                      <button
                        onClick={() => {
                          if (activeLoop?.id === loop.id && isLooping) {
                            handleStopLoop();
                          } else {
                            handlePlayLoop(loop);
                          }
                        }}
                        className={`loop-toggle-btn ${activeLoop?.id === loop.id && isLooping ? 'active' : ''}`}
                        title={activeLoop?.id === loop.id && isLooping ? "Stop loop" : "Start looping"}
                      >
                        {activeLoop?.id === loop.id && isLooping ? '⏹️' : '🔁'}
                      </button>
                      <button
                        onClick={() => handleStartEdit(loop)}
                        className="edit-loop"
                        title="Edit this segment"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => onDeleteLoop(loop.id)}
                        className="delete-loop"
                        title="Delete this segment"
                      >
                        🗑️
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Instructions */}
      <div className="collapsible-section">
        <button
          className="section-header"
          onClick={() => setIsInstructionsExpanded(!isInstructionsExpanded)}
        >
          <span>❓ How to Create Loops</span>
          <span className={`expand-icon ${isInstructionsExpanded ? 'expanded' : ''}`}>▼</span>
        </button>

        {isInstructionsExpanded && (
          <div className="loop-instructions">
            <ol>
              <li>Play video and pause at desired start point</li>
              <li>Click "📍 Set Start" to mark loop beginning</li>
              <li>Continue playing to desired end point</li>
              <li>Click "🏁 Set End" to mark loop end</li>
              <li>Save with a name for future use</li>
            </ol>
          </div>
        )}
      </div>
    </div>
  );
}