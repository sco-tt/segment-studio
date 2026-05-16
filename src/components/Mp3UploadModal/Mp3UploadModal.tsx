import { useState, useCallback } from 'react';
import { Modal } from '../Modal/Modal';
import { Mp3UploadService } from '../../services/mp3UploadService';
import './Mp3UploadModal.css';

interface Mp3UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadComplete: (routineId: string) => void;
}

interface FileInfo {
  path: string;
  name: string;
  trackName: string;
}

export function Mp3UploadModal({ isOpen, onClose, onUploadComplete }: Mp3UploadModalProps) {
  const [selectedFile, setSelectedFile] = useState<FileInfo | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);

  const uploadService = Mp3UploadService.getInstance();

  const handleClose = useCallback(() => {
    if (!isUploading) {
      setSelectedFile(null);
      setUploadStatus('');
      onClose();
    }
  }, [isUploading, onClose]);

  const handleFileSelect = useCallback(async () => {
    try {
      setUploadStatus('📁 Opening file dialog...');
      const filePaths = await uploadService.selectAudioFiles(false); // Always single file
      if (filePaths.length > 0) {
        const filePath = filePaths[0]; // Take only the first file
        const fileName = filePath.split(/[/\\]/).pop() || filePath;
        const trackName = fileName.replace(/\.[^/.]+$/, ''); // Remove extension

        const fileInfo: FileInfo = {
          path: filePath,
          name: fileName,
          trackName
        };

        setSelectedFile(fileInfo);
        setUploadStatus(`📄 Selected: ${fileName}`);
      } else {
        setUploadStatus('');
      }
    } catch (error) {
      console.error('Failed to select files:', error);
      setUploadStatus(`❌ Failed to select files: ${error instanceof Error ? error.message : String(error)}`);
    }
  }, [uploadService]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    const files = Array.from(e.dataTransfer.files);
    const audioFiles = files.filter(file => {
      const ext = file.name.split('.').pop()?.toLowerCase();
      return ['mp3', 'm4a', 'wav', 'ogg', 'flac'].includes(ext || '');
    });

    if (audioFiles.length === 0) {
      setUploadStatus('❌ No valid audio files found');
      return;
    }

    if (audioFiles.length > 1) {
      setUploadStatus('❌ Only one MP3 file can be uploaded at a time');
      return;
    }

    // In Tauri, we need to get the file path from the file object
    const fileInfos: FileInfo[] = audioFiles.map(file => {
      // Try to get the file path - in Tauri this should be available
      const filePath = (file as any).path || file.name;
      return {
        path: filePath,
        name: file.name,
        trackName: file.name.replace(/\.[^/.]+$/, '')
      };
    });

    setSelectedFile(fileInfos[0]);
    setUploadStatus('');
  }, []);


  const handleUpload = useCallback(async () => {
    if (!selectedFile) {
      setUploadStatus('❌ No file selected');
      return;
    }

    setIsUploading(true);
    setUploadStatus('📤 Uploading file...');

    try {
      let routineId: string;

      // Upload single file
      routineId = await uploadService.uploadSingleFile(selectedFile.path, selectedFile.trackName);
      setUploadStatus(`✅ Uploaded "${selectedFile.trackName}" successfully!`);

      // Wait a moment to show success message, then close and notify parent
      setTimeout(() => {
        onUploadComplete(routineId);
        handleClose();
      }, 1500);

    } catch (error) {
      console.error('Upload failed:', error);
      setUploadStatus(`❌ Upload failed: ${error}`);
      setIsUploading(false);
    }
  }, [selectedFile, uploadService, onUploadComplete, handleClose]);

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="📁 Upload MP3 File">
      <div className="mp3-upload-modal">
        {/* Upload info */}
        <div className="upload-info">
          <p>📄 Upload a single MP3 file for this song</p>
        </div>

        {/* File drop zone */}
        <div
          className={`file-drop-zone ${isDragOver ? 'drag-over' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={!isUploading ? handleFileSelect : undefined}
        >
          <div className="drop-zone-content">
            {!selectedFile ? (
              <>
                <div className="drop-zone-icon">🎵</div>
                <h3>Drop MP3 file here</h3>
                <p>or click to browse</p>
                <div className="supported-formats">
                  Supported: MP3, M4A, WAV, OGG, FLAC
                </div>
              </>
            ) : (
              <div className="selected-file">
                <h3>📂 Selected File</h3>
                <div className="file-item">
                  <div className="file-info">
                    <span className="file-icon">🎵</span>
                    <span className="file-name">{selectedFile.name}</span>
                  </div>
                  <input
                    type="text"
                    value={selectedFile.trackName}
                    onChange={(e) => setSelectedFile({ ...selectedFile, trackName: e.target.value })}
                    placeholder="Song name"
                    disabled={isUploading}
                    className="track-name-input"
                  />
                  {!isUploading && (
                    <button
                      onClick={() => setSelectedFile(null)}
                      className="remove-file-btn"
                      title="Remove file"
                    >
                      ×
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Upload status */}
        {uploadStatus && (
          <div className={`upload-status ${uploadStatus.includes('❌') ? 'error' : uploadStatus.includes('✅') ? 'success' : 'info'}`}>
            {uploadStatus}
          </div>
        )}

        {/* Action buttons */}
        <div className="upload-actions">
          <button
            onClick={handleClose}
            disabled={isUploading}
            className="cancel-btn"
          >
            Cancel
          </button>
          <button
            onClick={handleUpload}
            disabled={!selectedFile || isUploading}
            className="upload-btn"
          >
            {isUploading ? (
              <>⏳ Uploading...</>
            ) : (
              <>📤 Upload{selectedFile ? ` "${selectedFile.name}"` : ''}</>
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
}