import { useEffect } from 'react';

interface KeyboardShortcutsProps {
  onSetLoopStart: () => void;
  onSetLoopEnd: () => void;
  onToggleLoop: (loop?: any) => void;
  onTogglePlayPause: () => void;
  onSeekBackward: () => void;
  onSeekForward: () => void;
  onShowHelp?: () => void;
  onOpenSearch?: () => void;
}

export function useKeyboardShortcuts({
  onSetLoopStart,
  onSetLoopEnd,
  onToggleLoop,
  onTogglePlayPause,
  onSeekBackward,
  onSeekForward,
  onShowHelp,
  onOpenSearch
}: KeyboardShortcutsProps) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs or when any modal is open
      if (event.target instanceof HTMLInputElement ||
          event.target instanceof HTMLTextAreaElement ||
          event.target instanceof HTMLSelectElement ||
          document.querySelector('.modal-backdrop') ||
          (event.target as Element)?.closest('[role="dialog"]') ||
          (document.activeElement instanceof HTMLInputElement) ||
          (document.activeElement instanceof HTMLTextAreaElement)) {
        return;
      }

      const key = event.key.toLowerCase();

      // Handle shortcuts
      switch (key) {
        case ' ':
          event.preventDefault();
          event.stopPropagation();
          onTogglePlayPause();
          break;
        case 's':
          if (!event.ctrlKey && !event.metaKey && !event.altKey) {
            event.preventDefault();
            event.stopPropagation();
            onSetLoopStart();
          }
          break;
        case 'e':
          if (!event.ctrlKey && !event.metaKey && !event.altKey) {
            event.preventDefault();
            event.stopPropagation();
            onSetLoopEnd();
          }
          break;
        case 'r':
          if (!event.ctrlKey && !event.metaKey && !event.altKey) {
            event.preventDefault();
            event.stopPropagation();
            onToggleLoop();
          }
          break;
        case 'arrowleft':
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault();
            event.stopPropagation();
            onSeekBackward();
          }
          break;
        case 'arrowright':
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault();
            event.stopPropagation();
            onSeekForward();
          }
          break;
        case '?':
          if (onShowHelp) {
            event.preventDefault();
            event.stopPropagation();
            onShowHelp();
          }
          break;
        case 'k':
          if ((event.ctrlKey || event.metaKey) && onOpenSearch) {
            event.preventDefault();
            event.stopPropagation();
            onOpenSearch();
          }
          break;
      }
    };

    // Handle clicks to remove focus from YouTube iframe (but not from inputs/modals)
    const handleClick = (event: MouseEvent) => {
      const target = event.target as Element;

      // Don't interfere with clicks on modals or inputs
      if (target.closest('.modal-backdrop') ||
          target.closest('input, textarea, button, select') ||
          target.closest('[role="dialog"]')) {
        return;
      }

      // If clicking outside the video player, blur any focused iframes
      if (!target.closest('.youtube-player-container')) {
        const iframes = document.querySelectorAll('iframe');
        iframes.forEach(iframe => {
          if (iframe.contentWindow) {
            iframe.blur();
          }
        });

        // Only blur and refocus if not clicking on an interactive element
        const activeEl = document.activeElement as HTMLElement;
        if (activeEl && activeEl.tagName === 'IFRAME') {
          document.body.focus();
        }
      }
    };

    // Only refocus body if focus is on unwanted elements (like iframes), not on inputs
    const focusInterval = setInterval(() => {
      const activeEl = document.activeElement as HTMLElement;

      // Only refocus if current focus is on iframe or document, NOT on inputs/textareas
      if ((activeEl?.tagName === 'IFRAME' || activeEl === document.documentElement) &&
          !document.querySelector('.modal-backdrop') &&
          !document.querySelector('input:focus, textarea:focus')) {
        document.body.focus();
      }
    }, 2000); // Reduced frequency to be less aggressive

    document.addEventListener('keydown', handleKeyDown, true);
    document.addEventListener('click', handleClick, true);

    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
      document.removeEventListener('click', handleClick, true);
      clearInterval(focusInterval);
    };
  }, [onSetLoopStart, onSetLoopEnd, onToggleLoop, onTogglePlayPause, onSeekBackward, onSeekForward, onShowHelp, onOpenSearch]);
}

export const KEYBOARD_SHORTCUTS = {
  PLAY_PAUSE: 'Space',
  SET_LOOP_START: 'S',
  SET_LOOP_END: 'E',
  TOGGLE_LOOP: 'R',
  SEEK_BACKWARD: 'Ctrl/Cmd + ←',
  SEEK_FORWARD: 'Ctrl/Cmd + →',
  HELP: 'Shift + ?',
  SEARCH: 'Ctrl/Cmd + K'
} as const;