import { useState, useEffect, useRef } from 'react';
import { Modal } from '../Modal/Modal';
import { SongRoutine } from '../../repositories/songRoutineRepository';
import { useCustomFields } from '../../hooks/useCustomFields';
import { TagAutocomplete } from '../TagAutocomplete/TagAutocomplete';
import { TagsService } from '../../services/tagsService';
import { parseUserSongData, stringifyUserSongData, UserSongData } from '../../utils/userSongData';
import './EditSongModal.css';

interface EditSongModalProps {
  isOpen: boolean;
  onClose: () => void;
  song: SongRoutine | null;
  onSave: (updatedSong: SongRoutine) => Promise<void>;
}

export function EditSongModal({ isOpen, onClose, song, onSave }: EditSongModalProps) {
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [notes, setNotes] = useState('');
  const [freeformNotes, setFreeformNotes] = useState('');
  const [volume, setVolume] = useState(100);
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');
  const [customFieldValues, setCustomFieldValues] = useState<UserSongData>({});
  const tagInputRef = useRef<HTMLInputElement>(null);

  const { fields: customFields, loading: customFieldsLoading } = useCustomFields();

  useEffect(() => {
    if (song) {
      setTitle(song.title || '');
      setArtist(song.artist || '');
      setNotes(song.notes || '');
      setVolume(song.volume || 100);
      // Load tags from database
      try {
        const songTags = JSON.parse(song.tags_json || '[]');
        if (Array.isArray(songTags)) {
          setTags(songTags);
        }
      } catch (error) {
        console.warn('Failed to parse song tags:', error);
        setTags([]);
      }

      // Parse custom field values from freeform_notes
      const parsedCustomFields = parseUserSongData(song.freeform_notes || '');
      setCustomFieldValues(parsedCustomFields);

      // Keep any non-JSON content in freeform_notes as fallback
      try {
        JSON.parse(song.freeform_notes || '{}');
        setFreeformNotes(''); // Clear if it's valid JSON (will be shown as custom fields)
      } catch {
        setFreeformNotes(song.freeform_notes || ''); // Keep if it's not JSON
      }
    }
  }, [song]);

  const handleSave = async () => {
    if (!song) return;

    let finalFreeformNotes = freeformNotes.trim();
    if (Object.keys(customFieldValues).length > 0) {
      const nonEmptyCustomFields = Object.fromEntries(
        Object.entries(customFieldValues).filter(([_, value]) => value !== '' && value !== null && value !== undefined)
      );
      if (Object.keys(nonEmptyCustomFields).length > 0) {
        finalFreeformNotes = stringifyUserSongData(nonEmptyCustomFields);
      }
    }

    const updatedSong: SongRoutine = {
      ...song,
      title: title.trim(),
      artist: artist.trim(),
      notes: notes.trim(),
      freeform_notes: finalFreeformNotes,
      volume: volume,
      tags_json: JSON.stringify(tags)
    };

    TagsService.getInstance().clearCache();

    try {
      await onSave(updatedSong);
      onClose();
    } catch {
      alert('Error saving changes');
    }
  };

  const addTag = (tag: string) => {
    const trimmedTag = tag.trim();
    if (trimmedTag && !tags.includes(trimmedTag)) {
      const newTags = [...tags, trimmedTag];
      setTags(newTags);
      TagsService.getInstance().addToCache([trimmedTag]);
    }
  };

  const addTagFromInput = (e?: React.KeyboardEvent | React.MouseEvent) => {
    e?.preventDefault();
    const tag = newTag.trim();
    if (tag && !tags.includes(tag)) {
      addTag(tag);
      setNewTag('');
      setTimeout(() => tagInputRef.current?.focus(), 10);
    }
  };

  const removeTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  const updateCustomField = (fieldName: string, value: string | number) => {
    setCustomFieldValues(prev => ({
      ...prev,
      [fieldName]: value
    }));
  };

  const handleClose = () => {
    onClose();
    // Reset form when closing
    if (song) {
      setTitle(song.title || '');
      setArtist(song.artist || '');
      setNotes(song.notes || '');
      setVolume(song.volume || 100);
      setTags([]);

      // Reset custom field values
      const parsedCustomFields = parseUserSongData(song.freeform_notes || '');
      setCustomFieldValues(parsedCustomFields);

      try {
        JSON.parse(song.freeform_notes || '{}');
        setFreeformNotes('');
      } catch {
        setFreeformNotes(song.freeform_notes || '');
      }
    }
    setNewTag('');
  };

  if (!song) return null;

  return (
    <Modal isOpen={isOpen} onClose={handleClose} size="md" title="Edit Song">
      <div className="edit-song-modal">
        <div className="edit-song-header">
          <h2>✏️ Edit Song</h2>
        </div>

        <div className="edit-song-content">
          <div className="form-group">
            <label htmlFor="song-title">YouTube Title</label>
            <input
              id="song-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="form-input"
              placeholder="Enter video title"
            />
          </div>

          <div className="form-group">
            <label htmlFor="song-artist">Artist</label>
            <input
              id="song-artist"
              type="text"
              value={artist}
              onChange={(e) => setArtist(e.target.value)}
              className="form-input"
              placeholder="Enter artist name"
            />
          </div>

          <div className="form-group">
            <label htmlFor="song-notes">Practice Notes</label>
            <textarea
              id="song-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="form-textarea"
              placeholder="Add practice notes, tips, etc."
              rows={3}
            />
          </div>

          {/* Dynamic Custom Fields */}
          {!customFieldsLoading && customFields.length > 0 && (
            <div className="custom-fields-section">
              <h3 className="custom-fields-title">Custom Fields</h3>
              {customFields
                .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
                .map((field) => {
                  const fieldValue = customFieldValues[field.name] || field.default_value || '';

                  return (
                    <div key={field.id} className="form-group">
                      <label htmlFor={`custom-field-${field.id}`}>
                        {field.display_name}
                        {field.is_required && <span className="required">*</span>}
                      </label>

                      {field.field_type === 'text' && (
                        <input
                          id={`custom-field-${field.id}`}
                          type="text"
                          value={String(fieldValue)}
                          onChange={(e) => updateCustomField(field.name, e.target.value)}
                          className="form-input"
                          placeholder={`Enter ${field.display_name.toLowerCase()}`}
                          required={field.is_required}
                        />
                      )}

                      {field.field_type === 'number' && (
                        <input
                          id={`custom-field-${field.id}`}
                          type="number"
                          value={String(fieldValue)}
                          onChange={(e) => updateCustomField(field.name, e.target.value ? Number(e.target.value) : '')}
                          className="form-input"
                          placeholder={`Enter ${field.display_name.toLowerCase()}`}
                          required={field.is_required}
                        />
                      )}

                      {field.field_type === 'select' && field.field_options && (
                        <select
                          id={`custom-field-${field.id}`}
                          value={String(fieldValue)}
                          onChange={(e) => updateCustomField(field.name, e.target.value)}
                          className="form-input"
                          required={field.is_required}
                        >
                          <option value="">Choose {field.display_name.toLowerCase()}</option>
                          {field.field_options.map((option: string) => (
                            <option key={option.trim()} value={option.trim()}>
                              {option.trim()}
                            </option>
                          ))}
                        </select>
                      )}

                      {field.field_type === 'textarea' && (
                        <textarea
                          id={`custom-field-${field.id}`}
                          value={String(fieldValue)}
                          onChange={(e) => updateCustomField(field.name, e.target.value)}
                          className="form-textarea"
                          placeholder={`Enter ${field.display_name.toLowerCase()}`}
                          rows={3}
                          required={field.is_required}
                        />
                      )}
                    </div>
                  );
                })}
            </div>
          )}

          {/* Fallback for non-JSON freeform notes */}
          {freeformNotes && (
            <div className="form-group">
              <label htmlFor="song-freeform-notes">Additional Notes</label>
              <textarea
                id="song-freeform-notes"
                value={freeformNotes}
                onChange={(e) => setFreeformNotes(e.target.value)}
                className="form-textarea"
                placeholder="Any other notes or observations"
                rows={2}
              />
            </div>
          )}

          <div className="form-group">
            <label htmlFor="song-volume">Volume ({volume}%)</label>
            <input
              id="song-volume"
              type="range"
              min="0"
              max="100"
              value={volume}
              onChange={(e) => setVolume(parseInt(e.target.value))}
              className="form-range"
            />
          </div>

          <div className="form-group">
            <label>Tags</label>
            {tags.length > 0 && (
              <div className="tags-container">
                {tags.map((tag) => (
                  <span key={tag} className="tag-item">
                    {tag}
                    <button
                      onClick={() => removeTag(tag)}
                      className="tag-remove"
                      type="button"
                      title="Remove tag"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="add-tag">
              <TagAutocomplete
                value={newTag}
                placeholder="Add tag..."
                currentTags={tags}
                onValueChange={setNewTag}
                onTagAdd={(tag) => {
                  addTag(tag);
                  setNewTag('');
                }}
                className="tag-input-wrapper"
              />
              <button
                onClick={(e) => addTagFromInput(e)}
                disabled={!newTag.trim()}
                className="add-tag-btn"
                type="button"
              >
                Add
              </button>
            </div>
          </div>

          <div className="song-info">
            <div className="info-item">
              <span className="info-label">Duration:</span>
              <span className="info-value">{Math.floor(song.duration / 60)}:{Math.floor(song.duration % 60).toString().padStart(2, '0')}</span>
            </div>
            <div className="info-item">
              <span className="info-label">Created:</span>
              <span className="info-value">{new Date(song.created_at).toLocaleDateString()}</span>
            </div>
            {song.last_practiced && (
              <div className="info-item">
                <span className="info-label">Last Practiced:</span>
                <span className="info-value">{new Date(song.last_practiced).toLocaleDateString()}</span>
              </div>
            )}
          </div>
        </div>

        <div className="edit-song-footer">
          <button onClick={handleClose} className="btn btn-secondary">
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="btn btn-primary"
          >
            Save Changes
          </button>
        </div>
      </div>
    </Modal>
  );
}