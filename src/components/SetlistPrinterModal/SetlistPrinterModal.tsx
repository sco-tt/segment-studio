import { useState, useMemo, useEffect, useCallback } from 'react';
import { Modal } from '../Modal/Modal';
import { useSavedSongs } from '../../hooks/useSavedSongs';
import { useCustomFields } from '../../hooks/useCustomFields';
import { useSetlists } from '../../hooks/useSetlists';
import { parseUserSongData } from '../../utils/userSongData';
import './SetlistPrinterModal.css';

interface SetlistPrinterModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SetlistPrinterModal({ isOpen, onClose }: SetlistPrinterModalProps) {
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'tag'>('all');
  const [selectedTag, setSelectedTag] = useState<string>('');
  const [orderedSongIds, setOrderedSongIds] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null);

  const [saveName, setSaveName] = useState('');
  const [activeSetlistId, setActiveSetlistId] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  const { songs } = useSavedSongs();
  const { fields: customFields } = useCustomFields();
  const {
    setlists,
    saveSetlist,
    updateSetlistItems,
    renameSetlist,
    deleteSetlist,
    getSetlistItems,
    findByName,
  } = useSetlists();

  // Reset transient state on close
  useEffect(() => {
    if (!isOpen) {
      setDragIndex(null);
      setDropTargetIndex(null);
      setSaveStatus(null);
    }
  }, [isOpen]);

  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    songs.forEach(song => {
      try {
        const tags = JSON.parse(song.tags_json || '[]');
        tags.forEach((tag: string) => tagSet.add(tag));
      } catch {
        // skip
      }
    });
    return Array.from(tagSet).sort();
  }, [songs]);

  const filteredSongs = useMemo(() => {
    if (selectedFilter === 'all') return songs;
    return songs.filter(song => {
      try {
        const tags = JSON.parse(song.tags_json || '[]');
        return tags.includes(selectedTag);
      } catch {
        return false;
      }
    });
  }, [songs, selectedFilter, selectedTag]);

  const songsById = useMemo(() => {
    const map = new Map<string, typeof songs[number]>();
    songs.forEach(s => map.set(s.id, s));
    return map;
  }, [songs]);

  const orderedSongs = useMemo(
    () => orderedSongIds.map(id => songsById.get(id)).filter(Boolean) as typeof songs,
    [orderedSongIds, songsById]
  );

  const selectedSet = useMemo(() => new Set(orderedSongIds), [orderedSongIds]);

  const toggleSong = useCallback((songId: string) => {
    setOrderedSongIds(prev =>
      prev.includes(songId) ? prev.filter(id => id !== songId) : [...prev, songId]
    );
  }, []);

  const selectAll = useCallback(() => {
    setOrderedSongIds(prev => {
      const existing = new Set(prev);
      const additions = filteredSongs
        .map(s => s.id)
        .filter(id => !existing.has(id));
      return [...prev, ...additions];
    });
  }, [filteredSongs]);

  const clearSelection = useCallback(() => {
    setOrderedSongIds([]);
    setActiveSetlistId(null);
    setSaveName('');
  }, []);

  const removeFromOrder = useCallback((songId: string) => {
    setOrderedSongIds(prev => prev.filter(id => id !== songId));
  }, []);

  const moveToPosition = useCallback((fromIndex: number, toPositionOneBased: number) => {
    setOrderedSongIds(prev => {
      const clamped = Math.max(1, Math.min(prev.length, toPositionOneBased));
      const toIndex = clamped - 1;
      if (toIndex === fromIndex) return prev;
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  }, []);

  // Drag and drop handlers
  const handleDragStart = useCallback((index: number) => (e: React.DragEvent) => {
    setDragIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    // Firefox requires setData to fire drag events
    e.dataTransfer.setData('text/plain', String(index));
  }, []);

  const handleDragOver = useCallback((index: number) => (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dropTargetIndex !== index) setDropTargetIndex(index);
  }, [dropTargetIndex]);

  const handleDragLeave = useCallback(() => {
    setDropTargetIndex(null);
  }, []);

  const handleDrop = useCallback((index: number) => (e: React.DragEvent) => {
    e.preventDefault();
    setDropTargetIndex(null);
    if (dragIndex === null || dragIndex === index) {
      setDragIndex(null);
      return;
    }
    setOrderedSongIds(prev => {
      const next = [...prev];
      const [moved] = next.splice(dragIndex, 1);
      const insertAt = dragIndex < index ? index - 1 : index;
      next.splice(insertAt, 0, moved);
      return next;
    });
    setDragIndex(null);
  }, [dragIndex]);

  const handleDragEnd = useCallback(() => {
    setDragIndex(null);
    setDropTargetIndex(null);
  }, []);

  // Saved setlists
  const handleLoadSetlist = useCallback(async (setlistId: string) => {
    const items = await getSetlistItems(setlistId);
    setOrderedSongIds(items);
    setActiveSetlistId(setlistId);
    const meta = setlists.find(s => s.id === setlistId);
    setSaveName(meta?.name || '');
    setSaveStatus(`Loaded "${meta?.name || 'setlist'}"`);
  }, [getSetlistItems, setlists]);

  const handleSaveSetlist = useCallback(async () => {
    const name = saveName.trim();
    if (!name) {
      setSaveStatus('Enter a name for the setlist.');
      return;
    }
    if (orderedSongIds.length === 0) {
      setSaveStatus('Add at least one song to save.');
      return;
    }

    try {
      // If the loaded setlist has the same name, update it in place; otherwise
      // create new (or overwrite by name after confirm).
      if (activeSetlistId) {
        const current = setlists.find(s => s.id === activeSetlistId);
        if (current && current.name !== name) {
          await renameSetlist(activeSetlistId, name);
        }
        await updateSetlistItems(activeSetlistId, orderedSongIds);
        setSaveStatus(`Saved "${name}".`);
        return;
      }

      const existing = await findByName(name);
      if (existing) {
        const ok = window.confirm(`Setlist "${name}" already exists. Overwrite?`);
        if (!ok) {
          setSaveStatus('Save cancelled.');
          return;
        }
        await updateSetlistItems(existing.id, orderedSongIds);
        setActiveSetlistId(existing.id);
        setSaveStatus(`Overwrote "${name}".`);
        return;
      }

      const newId = await saveSetlist({ name }, orderedSongIds);
      setActiveSetlistId(newId);
      setSaveStatus(`Saved "${name}".`);
    } catch (err) {
      console.error('Failed to save setlist:', err);
      setSaveStatus(`❌ Failed to save: ${(err as Error).message || String(err)}`);
    }
  }, [saveName, orderedSongIds, activeSetlistId, setlists, renameSetlist, updateSetlistItems, findByName, saveSetlist]);

  const handleDeleteSetlist = useCallback(async (id: string, name: string) => {
    const ok = window.confirm(`Delete setlist "${name}"? This cannot be undone.`);
    if (!ok) return;
    try {
      await deleteSetlist(id);
      if (activeSetlistId === id) {
        setActiveSetlistId(null);
        setSaveName('');
      }
      setSaveStatus(`Deleted "${name}".`);
    } catch (err) {
      console.error('Failed to delete setlist:', err);
      setSaveStatus(`❌ Failed to delete: ${(err as Error).message || String(err)}`);
    }
  }, [deleteSetlist, activeSetlistId]);

  const handleNewSetlist = useCallback(() => {
    setActiveSetlistId(null);
    setOrderedSongIds([]);
    setSaveName('');
    setSaveStatus(null);
  }, []);

  const generatePrintableContent = () => {
    const selectedSongList = orderedSongs;

    const printContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Setlist</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
              font-size: 12pt;
              line-height: 1.4;
              margin: 0;
              padding: 20px;
              color: #000;
            }
            .setlist-header {
              text-align: center;
              border-bottom: 2px solid #000;
              padding-bottom: 10px;
              margin-bottom: 20px;
            }
            .setlist-title {
              font-size: 18pt;
              font-weight: bold;
              margin: 0;
            }
            .setlist-date {
              font-size: 10pt;
              color: #666;
              margin: 5px 0 0 0;
            }
            .song-item {
              margin-bottom: 15px;
              page-break-inside: avoid;
              border-bottom: 1px solid #eee;
              padding-bottom: 8px;
            }
            .song-title {
              font-size: 14pt;
              font-weight: bold;
              margin: 0 0 2px 0;
            }
            .song-artist {
              font-size: 12pt;
              color: #666;
              margin: 0 0 4px 0;
            }
            .song-field {
              font-size: 10pt;
              margin: 3px 0;
              line-height: 1.4;
            }
            .song-field strong {
              color: #333;
              margin-right: 6px;
            }
            .tags {
              font-size: 9pt;
              color: #888;
              margin-top: 4px;
            }
            @media print {
              body { margin: 0; }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="setlist-header">
            <h1 class="setlist-title">${saveName.trim() || 'Setlist'}</h1>
            <p class="setlist-date">${new Date().toLocaleDateString()}</p>
          </div>

          ${selectedSongList.map((song, index) => {
            const customData = parseUserSongData(song.freeform_notes || '');
            const tags = JSON.parse(song.tags_json || '[]');

            let additionalFields = '';

            if (song.url) {
              additionalFields += `<div class="song-field"><strong>URL:</strong> ${song.url}</div>`;
            }
            if (song.url_source && song.url_source !== 'youtube') {
              additionalFields += `<div class="song-field"><strong>Source:</strong> ${song.url_source}</div>`;
            }
            if (song.duration) {
              additionalFields += `<div class="song-field"><strong>Duration:</strong> ${Math.floor(song.duration / 60)}:${(song.duration % 60).toString().padStart(2, '0')}</div>`;
            }
            if (song.volume && song.volume !== 100) {
              additionalFields += `<div class="song-field"><strong>Volume:</strong> ${song.volume}%</div>`;
            }
            if (song.notes) {
              additionalFields += `<div class="song-field"><strong>Notes:</strong> ${song.notes}</div>`;
            }
            if (song.freeform_notes && song.freeform_notes.trim()) {
              additionalFields += `<div class="song-field"><strong>Additional Notes:</strong> ${song.freeform_notes.replace(/\n/g, '<br>')}</div>`;
            }

            customFields.forEach(field => {
              const value = customData[field.name];
              if (value) {
                additionalFields += `<div class="song-field"><strong>${field.display_name}:</strong> ${value}</div>`;
              }
            });

            if (song.created_at) {
              additionalFields += `<div class="song-field"><strong>Created:</strong> ${new Date(song.created_at).toLocaleDateString()}</div>`;
            }
            if (song.last_practiced) {
              additionalFields += `<div class="song-field"><strong>Last Practiced:</strong> ${new Date(song.last_practiced).toLocaleDateString()}</div>`;
            }

            try {
              const loops = JSON.parse(song.loops_json || '[]');
              if (loops.length > 0) {
                additionalFields += `<div class="song-field"><strong>Segments:</strong> ${loops.map((loop: any) => loop.name || 'Unnamed').join(', ')}</div>`;
              }
            } catch {}

            try {
              const steps = JSON.parse(song.steps_json || '[]');
              if (steps.length > 0) {
                additionalFields += `<div class="song-field"><strong>Practice Steps:</strong> ${steps.length} step(s)</div>`;
              }
            } catch {}

            try {
              const links = JSON.parse(song.links_json || '[]');
              if (links.length > 0) {
                additionalFields += `<div class="song-field"><strong>Resource Links:</strong> ${links.length} link(s)</div>`;
              }
            } catch {}

            return `
              <div class="song-item">
                <h2 class="song-title">${index + 1}. ${song.title || song.name || 'Untitled'}</h2>
                <p class="song-artist">by ${song.artist || 'Unknown Artist'}</p>
                ${additionalFields}
                ${tags.length > 0 ? `<div class="tags">Tags: ${tags.join(', ')}</div>` : ''}
              </div>
            `;
          }).join('')}

          <div style="margin-top: 30px; text-align: center; font-size: 10pt; color: #999;">
            Generated by Segment Studio • ${selectedSongList.length} songs
          </div>
        </body>
      </html>
    `;

    return printContent;
  };

  const handlePrint = async () => {
    if (orderedSongIds.length === 0) {
      alert('Please select at least one song to print.');
      return;
    }

    setIsGenerating(true);

    try {
      await new Promise(resolve => setTimeout(resolve, 100));
      const printContent = generatePrintableContent();
      const dataUrl = `data:text/html;charset=utf-8,${encodeURIComponent(printContent)}`;
      const printWindow = window.open(dataUrl, '_blank');

      if (!printWindow) {
        const blob = new Blob([printContent], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `setlist-${new Date().toISOString().split('T')[0]}.html`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        alert('✅ Setlist downloaded! Check your Downloads folder for the HTML file. Open it and press Ctrl+P (Cmd+P) to print.');
      } else {
        alert('✅ Setlist opened in new tab! Press Ctrl+P (Cmd+P) to print it.');
      }
    } catch (error) {
      console.error('Error generating setlist:', error);
      alert(`❌ Error generating setlist: ${(error as Error).message || String(error)}`);
    } finally {
      setTimeout(() => setIsGenerating(false), 500);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg" title="Setlists">
      <div className="setlist-printer-modal">
        <div className="printer-header">
          <h2>🎼 Setlists</h2>
          <p>Pick songs, drag to reorder, save for later, and print.</p>
        </div>

        {/* Saved Setlists */}
        <div className="filter-section saved-setlists-section">
          <div className="saved-setlists-header">
            <h3>Saved Setlists</h3>
            <button
              type="button"
              onClick={handleNewSetlist}
              className="select-all-btn"
              title="Start a new empty setlist"
            >
              + New
            </button>
          </div>
          {setlists.length === 0 ? (
            <p className="empty-hint">No saved setlists yet. Build one below and save it.</p>
          ) : (
            <ul className="saved-setlists-list">
              {setlists.map(sl => (
                <li
                  key={sl.id}
                  className={`saved-setlist-item ${activeSetlistId === sl.id ? 'active' : ''}`}
                >
                  <button
                    type="button"
                    className="saved-setlist-load"
                    onClick={() => handleLoadSetlist(sl.id)}
                    title="Load this setlist"
                  >
                    <span className="saved-setlist-name">{sl.name}</span>
                    <span className="saved-setlist-meta">
                      updated {new Date(sl.updated_at).toLocaleDateString()}
                    </span>
                  </button>
                  <button
                    type="button"
                    className="saved-setlist-delete"
                    onClick={() => handleDeleteSetlist(sl.id, sl.name)}
                    title="Delete this setlist"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Filter Options */}
        <div className="filter-section">
          <h3>Add Songs</h3>

          <div className="filter-options">
            <label className="filter-option">
              <input
                type="radio"
                value="all"
                checked={selectedFilter === 'all'}
                onChange={(e) => setSelectedFilter(e.target.value as 'all')}
              />
              <span>All Songs ({songs.length})</span>
            </label>

            <label className="filter-option">
              <input
                type="radio"
                value="tag"
                checked={selectedFilter === 'tag'}
                onChange={(e) => setSelectedFilter(e.target.value as 'tag')}
              />
              <span>Songs by Tag</span>
            </label>
          </div>

          {selectedFilter === 'tag' && (
            <div className="tag-selector">
              <select
                value={selectedTag}
                onChange={(e) => setSelectedTag(e.target.value)}
                className="tag-select"
              >
                <option value="">Select a tag...</option>
                {allTags.map(tag => (
                  <option key={tag} value={tag}>{tag}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Two panes: available songs + ordered setlist */}
        {(selectedFilter === 'all' || selectedTag) && (
          <div className="setlist-panes">
            <div className="pane">
              <div className="selection-controls">
                <span className="selection-count">
                  {filteredSongs.length} available
                </span>
                <div className="selection-actions">
                  <button onClick={selectAll} className="select-all-btn">
                    Add All
                  </button>
                </div>
              </div>

              <div className="song-list">
                {filteredSongs.length === 0 ? (
                  <div className="empty-hint" style={{ padding: '1rem' }}>
                    No songs match this filter.
                  </div>
                ) : filteredSongs.map(song => (
                  <label key={song.id} className="song-checkbox">
                    <input
                      type="checkbox"
                      checked={selectedSet.has(song.id)}
                      onChange={() => toggleSong(song.id)}
                    />
                    <div className="song-info">
                      <div className="song-title">{song.title || song.name || 'Untitled'}</div>
                      <div className="song-artist">{song.artist || 'Unknown Artist'}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className="pane">
              <div className="selection-controls">
                <span className="selection-count">
                  Setlist order — {orderedSongIds.length} song{orderedSongIds.length === 1 ? '' : 's'}
                </span>
                <div className="selection-actions">
                  <button onClick={clearSelection} className="clear-selection-btn">
                    Clear
                  </button>
                </div>
              </div>

              <ol className="ordered-song-list" onDragLeave={handleDragLeave}>
                {orderedSongs.length === 0 ? (
                  <li className="empty-hint" style={{ padding: '1rem' }}>
                    Check songs on the left to add them here. Drag to reorder.
                  </li>
                ) : orderedSongs.map((song, index) => (
                  <li
                    key={song.id}
                    className={
                      'ordered-song-item' +
                      (dragIndex === index ? ' dragging' : '') +
                      (dropTargetIndex === index && dragIndex !== index ? ' drop-target' : '')
                    }
                    draggable
                    onDragStart={handleDragStart(index)}
                    onDragOver={handleDragOver(index)}
                    onDrop={handleDrop(index)}
                    onDragEnd={handleDragEnd}
                  >
                    <span className="drag-handle" aria-hidden="true">⋮⋮</span>
                    <input
                      type="number"
                      min={1}
                      max={orderedSongs.length}
                      className="order-number-input"
                      value={index + 1}
                      onChange={(e) => {
                        const n = parseInt(e.target.value, 10);
                        if (!isNaN(n)) moveToPosition(index, n);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                      }}
                      onFocus={(e) => e.target.select()}
                      onDragStart={(e) => e.stopPropagation()}
                      draggable={false}
                      title="Type a new position to move this song"
                    />
                    <div className="song-info">
                      <div className="song-title">{song.title || song.name || 'Untitled'}</div>
                      <div className="song-artist">{song.artist || 'Unknown Artist'}</div>
                    </div>
                    <button
                      type="button"
                      className="remove-from-order"
                      onClick={() => removeFromOrder(song.id)}
                      title="Remove from setlist"
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        )}

        {/* Save controls */}
        <div className="save-setlist-section">
          <input
            type="text"
            className="setlist-name-input"
            placeholder="Setlist name..."
            value={saveName}
            onChange={(e) => setSaveName(e.target.value)}
          />
          <button
            type="button"
            onClick={handleSaveSetlist}
            className="save-setlist-btn"
            disabled={orderedSongIds.length === 0 || !saveName.trim()}
          >
            💾 {activeSetlistId ? 'Update Setlist' : 'Save Setlist'}
          </button>
          {saveStatus && <span className="save-status">{saveStatus}</span>}
        </div>

        {/* Actions */}
        <div className="printer-actions">
          <button
            onClick={handlePrint}
            disabled={orderedSongIds.length === 0 || isGenerating}
            className="print-btn"
          >
            {isGenerating ? '⏳ Generating...' : '📄 Print Setlist'}
          </button>
          <button onClick={onClose} className="cancel-btn">
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
}
