import { Modal } from '../Modal/Modal';
import './InstructionsModal.css';

interface InstructionsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function InstructionsModal({ isOpen, onClose }: InstructionsModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="How to Use Organize Tube"
      size="lg"
      className="instructions-modal"
    >
      <div className="instructions-content">
        <div className="instructions-section">
          <h3>Getting Started</h3>
          <ul>
            <li>Paste a YouTube URL in the input field above</li>
            <li>Use speed controls to slow down for practice</li>
            <li>Click Play/Pause or use spacebar in the video</li>
            <li>Lower speeds (0.25x - 0.75x) are perfect for learning difficult parts</li>
          </ul>
        </div>

        <div className="instructions-section">
          <h3>Loop Controls</h3>
          <ul>
            <li>Click at any point on the progress bar to set loop start/end times</li>
            <li>Use the loop controls below the video to fine-tune your practice segments</li>
            <li>Save loops with custom names for quick access</li>
            <li>Toggle looping on/off to practice specific sections repeatedly</li>
          </ul>
        </div>

        <div className="instructions-section">
          <h3>Keyboard Shortcuts</h3>
          <div className="keyboard-shortcuts">
            <div className="shortcut-group">
              <div className="shortcut-item">
                <kbd>Space</kbd>
                <span>Play/Pause</span>
              </div>
              <div className="shortcut-item">
                <kbd>S</kbd>
                <span>Set Loop Start</span>
              </div>
              <div className="shortcut-item">
                <kbd>E</kbd>
                <span>Set Loop End</span>
              </div>
              <div className="shortcut-item">
                <kbd>R</kbd>
                <span>Toggle Loop On/Off</span>
              </div>
            </div>
            <div className="shortcut-group">
              <div className="shortcut-item">
                <kbd>Ctrl/Cmd + ←</kbd>
                <span>Seek backward 5s</span>
              </div>
              <div className="shortcut-item">
                <kbd>Ctrl/Cmd + →</kbd>
                <span>Seek forward 5s</span>
              </div>
              <div className="shortcut-item">
                <kbd>Ctrl/Cmd + K</kbd>
                <span>Search songs</span>
              </div>
              <div className="shortcut-item">
                <kbd>?</kbd>
                <span>Show this help</span>
              </div>
              <div className="shortcut-item">
                <kbd>Esc</kbd>
                <span>Close modals</span>
              </div>
            </div>
          </div>
        </div>

        <div className="instructions-section">
          <h3>Practice Sets</h3>
          <ul>
            <li>Create practice sets in the sidebar to organize your videos</li>
            <li>Add videos to sets for structured practice sessions</li>
            <li>Click on videos in sets to quickly load them</li>
            <li>Use sets to group songs by difficulty, genre, or learning goals</li>
          </ul>
        </div>

        <div className="instructions-tip">
          <strong>💡 Pro Tip:</strong> Start with very slow speeds (0.25x-0.5x) when learning new material,
          then gradually increase speed as you become more comfortable with the passage.
        </div>
      </div>
    </Modal>
  );
}