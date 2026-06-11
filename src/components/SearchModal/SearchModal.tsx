import { useState, useEffect, useCallback, useRef } from 'react';
import { Modal } from '../Modal/Modal';
import { useSavedSongs } from '../../hooks/useSavedSongs';
import { SongRoutine } from '../../repositories/songRoutineRepository';
import './SearchModal.css';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSongSelect: (songId: string, url: string) => void;
}

export function SearchModal({ isOpen, onClose, onSongSelect }: SearchModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const { songs: savedSongs } = useSavedSongs();

  // Helper function to parse tags from tags_json
  const getSongTags = (song: SongRoutine): string[] => {
    try {
      return JSON.parse(song.tags_json || '[]');
    } catch (error) {
      return [];
    }
  };

  // Filter songs based on search query
  const filteredSongs = savedSongs.filter(song => {
    if (!searchQuery.trim()) return false;

    const query = searchQuery.toLowerCase();
    return (
      song.title?.toLowerCase().includes(query) ||
      song.artist?.toLowerCase().includes(query) ||
      song.name?.toLowerCase().includes(query) ||
      getSongTags(song).some(tag => tag.toLowerCase().includes(query))
    );
  }).slice(0, 10); // Limit to 10 results

  // Handle keyboard navigation
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!isOpen) return;

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, filteredSongs.length - 1));
        break;
      case 'ArrowUp':
        event.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, 0));
        break;
      case 'Enter':
        event.preventDefault();
        if (filteredSongs[selectedIndex]) {
          const song = filteredSongs[selectedIndex];
          onSongSelect(song.id, song.url);
          onClose();
        }
        break;
      case 'Escape':
        event.preventDefault();
        onClose();
        break;
    }
  }, [isOpen, filteredSongs, selectedIndex, onSongSelect, onClose]);

  // Reset search when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setSearchQuery('');
      setSelectedIndex(0);
      // Focus input after modal is rendered
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  // Reset selected index when search changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [searchQuery]);

  // Add keyboard event listener
  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSongClick = (song: SongRoutine, index: number) => {
    setSelectedIndex(index);
    onSongSelect(song.id, song.url);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="md" title="">
      <div className="search-modal">
        <div className="search-header">
          <div className="search-input-container">
            <span className="search-icon">🔍</span>
            <input
              ref={inputRef}
              type="text"
              placeholder="Search songs, artists, or tags..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />
            <div className="search-shortcut">⌘K</div>
          </div>
        </div>

        <div className="search-results">
          {!searchQuery.trim() ? (
            <div className="search-empty-state">
              <div className="empty-icon">🎵</div>
              <p className="empty-title">Search your music library</p>
              <p className="empty-subtitle">Type to find songs, artists, or tags</p>
              <div className="search-tips">
                <div className="tip-row">
                  <span className="tip-key">↑↓</span>
                  <span className="tip-description">Navigate</span>
                </div>
                <div className="tip-row">
                  <span className="tip-key">↵</span>
                  <span className="tip-description">Select</span>
                </div>
                <div className="tip-row">
                  <span className="tip-key">Esc</span>
                  <span className="tip-description">Close</span>
                </div>
              </div>
            </div>
          ) : filteredSongs.length === 0 ? (
            <div className="search-no-results">
              <div className="no-results-icon">🔎</div>
              <p className="no-results-title">No songs found</p>
              <p className="no-results-subtitle">Try a different search term</p>
            </div>
          ) : (
            <div className="search-results-list">
              {filteredSongs.map((song, index) => (
                <div
                  key={song.id}
                  className={`search-result-item ${index === selectedIndex ? 'selected' : ''}`}
                  onClick={() => handleSongClick(song, index)}
                  onMouseEnter={() => setSelectedIndex(index)}
                >
                  <div className="result-main">
                    <div className="result-title">{song.title}</div>
                    <div className="result-artist">{song.artist}</div>
                  </div>
                  <div className="result-meta">
                    <div className={`source-badge ${song.url_source}`}>
                      {song.url_source === 'mp3' ? 'MP3' : song.url_source === 'youtube' ? 'YT' : 'VIM'}
                    </div>
                    <div className="result-duration">{formatDuration(song.duration || 0)}</div>
                    {getSongTags(song).length > 0 && (
                      <div className="result-tags">
                        {getSongTags(song).slice(0, 2).map(tag => (
                          <span key={tag} className="result-tag">🏷️ {tag}</span>
                        ))}
                        {getSongTags(song).length > 2 && (
                          <span className="result-tag-more">+{getSongTags(song).length - 2}</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {searchQuery.trim() && (
          <div className="search-footer">
            <span className="results-count">
              {filteredSongs.length} result{filteredSongs.length !== 1 ? 's' : ''}
              {filteredSongs.length === 10 ? ' (showing first 10)' : ''}
            </span>
          </div>
        )}
      </div>
    </Modal>
  );
}