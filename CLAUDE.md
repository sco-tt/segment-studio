# Segment Studio - Desktop App

## Project Overview
A Tauri-based desktop music practice tool similar to looper.tube that embeds YouTube videos and provides precise loop controls for musicians. The app enables distraction-free practice with speed adjustment, frame-level loop accuracy, and automated practice routines.

## Core Purpose
- Embed YouTube videos without browser distractions and ads
- Adjust playback speed (especially slow down for practice)
- Set precise loop segments (e.g., 1:15 to 1:35) with frame-level accuracy
- Practice difficult passages by looping at custom speeds continuously
- Organize practice sessions with automated routines and setlists

## Technology Stack

### Primary Choice: Tauri
- **Frontend**: React + TypeScript
- **Backend**: Rust (minimal knowledge required)
- **WebView**: Native OS WebView (Edge WebView2/WebKit/WebKitGTK)
- **Database**: SQLite with tauri-plugin-sql
- **Build Tool**: Tauri CLI
- **Package Manager**: npm/pnpm/bun

### Fallback: Electron
- **Frontend**: React + TypeScript
- **Runtime**: Node.js + Chromium
- **Build Tool**: electron-builder

## Performance Requirements
- **Install Size**: Target <15MB (Tauri) or <100MB (Electron)
- **Memory Usage**: Target <50MB RAM at idle, max <100MB
- **Load Time**: <2 seconds to show UI
- **Platform Support**: macOS, Windows 10/11 (primary), Linux (secondary)

## Data Model

### Song Routine (Primary Entity)
Everything is a Song Routine - even temporary video slowdowns become saveable routines.

```typescript
interface SongRoutine {
  id: string;
  url: string;
  urlSource: 'youtube' | 'vimeo' | 'local';
  title: string;
  artist: string;
  duration: number;
  name: string;
  tags: string[];
  loops: LoopSegment[];
  steps: PracticeStep[];
  notes: string;
  freeformNotes: string;
  links: ResourceLink[];
  createdAt: string;
  lastPracticed?: string;
}

interface LoopSegment {
  name: string;
  startTime: number;
  endTime: number;
  defaultSpeed: number;
}

interface PracticeStep {
  speed: number;
  repetitions?: number;
  loopSegment?: string; // null = full song
}
```

### Set List Entity
Collections of routines for organized practice sessions.

```typescript
interface SetList {
  id: string;
  name: string;
  description: string;
  items: SetListItem[];
  createdAt: string;
  estimatedDuration: number;
}

interface SetListItem {
  routineId: string;
  playMode: 'routine' | 'single'; // execute practice steps or play normally
  order: number;
}
```

## Key Features

### Core Video Looper Features
- YouTube Video Embedding with reliable iframe support
- Speed Controls (0.25x to 2.0x, focus on slower speeds)
- Precise Loop Segments with frame-level accuracy
- Continuous Looping without gaps or stutters
- Keyboard Shortcuts (space, arrow keys, custom hotkeys)
- Time Display with loop indicators
- URL Input and video ID extraction
- Loop Presets (save/load common practice segments)

### Practice Structure Features
- Song Routines (define practice sequences at different speeds)
- Set Lists (playlists of multiple videos/songs)
- Routine Execution (auto-progress through speed changes)
- Set List Modes (execute routines or play songs normally)
- Progress Tracking and completion indicators
- Auto-Advance through practice sequences
- Practice Session Management (start/pause/resume)
- Practice Notes (ongoing observations and technique notes)
- Resource Links (tabs, tutorials, backing tracks)

### Music Practice Workflow
- Global Hotkeys (control when app not focused)
- Quick Loop Setting (click-and-drag or hotkey-based)
- Speed Memory (remember settings per video/loop)
- Practice Session Tracking
- Multiple Loops per video
- Audio Focus (minimize conflicts with DAW software)

### Data Storage & Management
- SQLite Database with tauri-plugin-sql
- Cross-platform storage locations
- Import/Export (backup and share routines)
- Search & Filter capabilities
- Schema Migrations for future features

## Database Schema

```sql
CREATE TABLE song_routines (
  id TEXT PRIMARY KEY,
  url TEXT NOT NULL,
  url_source TEXT NOT NULL DEFAULT 'youtube',
  title TEXT,
  artist TEXT,
  duration INTEGER,
  name TEXT,
  tags_json TEXT,
  loops_json TEXT,
  steps_json TEXT,
  notes TEXT,
  freeform_notes TEXT,
  links_json TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_practiced TIMESTAMP
);

CREATE TABLE set_lists (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  items_json TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  estimated_duration INTEGER
);
```

## Project Structure

```
src/
├── components/
│   ├── VideoPlayer/           # YouTube iframe wrapper with controls
│   ├── RoutineBuilder/        # Practice routine creation/editing
│   ├── SetListManager/        # Setlist creation and playback
│   └── Layout/                # App shell and navigation
├── hooks/
│   ├── useVideoPlayer.ts      # YouTube player control logic
│   ├── useRoutines.ts         # Database operations for routines
│   ├── useSetLists.ts         # Database operations for setlists
│   ├── usePracticeSession.ts  # Active practice session state
│   └── useGlobalHotkeys.ts    # Keyboard shortcut handling
├── services/
│   ├── databaseService.ts     # SQLite operations wrapper
│   ├── youtubeService.ts      # YouTube URL parsing and metadata
│   └── exportService.ts       # Import/export functionality
└── types/
    ├── routine.types.ts       # Song routine interfaces
    ├── setlist.types.ts       # Set list interfaces
    └── player.types.ts        # Video player interfaces
```

## Implementation Plan

### Phase 1: Core Video Embedding (1-2 weeks)
- Set up Tauri project with React/TypeScript
- Implement YouTube iframe embedding and basic controls
- Test YouTube Player API integration across platforms
- Verify video playback performance and timing accuracy

### Phase 2: Loop Controls (2-3 weeks)
- Implement precise time selection UI
- Build continuous loop functionality with seamless transitions
- Add speed control with smooth adjustment
- Create keyboard shortcuts
- Test timing precision and performance

### Phase 3: Data Storage & Structure (1-2 weeks)
- Design and implement SQLite schema
- Build song management UI
- Create routine builder
- Implement setlist management
- Add import/export functionality

### Phase 4: Practice Workflow Automation (1-2 weeks)
- Build routine execution engine
- Implement setlist player
- Add global hotkeys for background practice
- Create practice session management
- Add progress tracking

### Phase 5: Polish & Distribution (1-2 weeks)
- Performance optimization
- Cross-platform testing
- Build automation with code signing
- Auto-update mechanism
- User testing with musicians

## Success Metrics

### Performance
- Install size under target (<15MB Tauri, <100MB Electron)
- Memory usage under 100MB while playing video
- App startup time under 2 seconds
- Loop transition gaps under 100ms

### Music Practice
- Frame-level accuracy for loop points (±33ms at 30fps)
- Speed adjustment range 0.25x - 2.0x with smooth audio
- Global hotkeys respond within 50ms
- 30+ minute continuous practice sessions
- Works alongside DAW software

### Platform Consistency
- Identical loop timing across macOS/Windows/Linux
- Consistent YouTube iframe behavior across WebViews
- Same keyboard shortcuts on all platforms

## Critical Evaluation Points

### Tauri Evaluation Blockers
- YouTube iframe compatibility across WebView implementations
- Video timing precision for frame-level loop accuracy
- Global hotkeys support for background practice
- SQLite plugin stability and performance
- YouTube Player API full JavaScript access

### Fallback Decision
Switch to Electron if critical blockers discovered in Phase 1 or performance targets not achievable.

## Development Approach

### Key Principles
- Type-first development with strict TypeScript
- Single responsibility hooks for each domain concern
- Error boundaries around video and database operations
- Optimistic updates for responsive UI
- Service layer abstraction over Tauri commands

### Communication Style
- Keep responses concise and focused by default
- User will ask for greater detail when needed
- Avoid excessive explanations or verbose progress updates
- Get to the point quickly and provide actionable information

### Testing Approach
- **Test only in the Tauri desktop app** - not the browser/web version
- Features like MP3 download require the actual Tauri runtime to function
- Use `npm run tauri dev` to launch the desktop app for testing
- Browser version at localhost:1420 uses mocks and limited functionality


### Planning
- Always write plans to a markdown file using checkbox task lists (`- [ ]` / `- [x]`)
- Include dates: a created date at the top, and a completion date on each finished task (e.g. `- [x] Add loop UI (2026-10-28)`)
- The markdown file is the source of truth for task state: update checkboxes as work starts and finishes, and track progress against the file rather than in chat

### Workflow Pattern
1. Load YouTube URL → Creates temporary routine with default settings
2. Adjust speed, set loops, add notes → Still temporary
3. Save → Creates persistent Song Routine
4. Add to setlist → References the saved routine

This architecture ensures musicians can quickly slow down videos for practice while providing a path to organize and structure their practice sessions over time.