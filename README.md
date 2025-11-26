# pushit

AI-powered git commits with a beautiful terminal UI. Analyzes your changes, generates meaningful commit messages, and pushes to remote.

## Features

- Beautiful terminal UI with spinners and styled prompts
- Analyzes staged changes with full file context
- Detects project type (Node, Bun, Rust, Python, Go)
- Extracts issue numbers from branch names
- Uses commit history for style matching
- Generates conventional commit messages via OpenRouter
- Interactive menu: commit & push, regenerate, or cancel

## Installation

### Option 1: Download Binary

Download the pre-built binary for your platform and add it to your PATH.

### Option 2: Build from Source

Requires [Bun](https://bun.sh) to be installed.

```bash
# Clone the repo
git clone https://github.com/yourusername/pushit
cd pushit

# Install dependencies
bun install

# Build the executable
bun run build

# Move to your PATH
mv pushit /usr/local/bin/
```

## Setup

1. Get an OpenRouter API key from [openrouter.ai](https://openrouter.ai)

2. Create a `.env` file in the pushit directory or set environment variables:

   ```bash
   OPENROUTER_API_KEY='your-api-key-here'
   OPENROUTER_MODEL='google/gemini-2.5-flash-lite-preview-09-2025'  # Optional
   ```

## Usage

From any git repository:

```bash
pushit
```

Or run in development mode:

```bash
bun run dev
```

## How It Works

1. Validates git repository and checks for changes
2. Stages all changes automatically
3. Gathers enhanced context:
   - Git diff and status
   - Full file contents (up to 500 lines each)
   - Project metadata (from package.json, Cargo.toml, etc.)
   - Branch name and linked issue detection
   - Last 20 commits for style reference
4. Sends context to OpenRouter for analysis
5. Displays generated commit message
6. Interactive selection: commit & push / regenerate / cancel

## Example

```
$ pushit

  pushit - AI-powered git commits

  Staging changes...
  Analysis complete

  Generated commit message
  ─────────────────────────────────────────────────
  feat(auth): add user login endpoint
  ─────────────────────────────────────────────────

  What would you like to do?
  ● Commit and push
  ○ Regenerate
  ○ Cancel

  Commit created successfully!
  Pushing to remote...
  Changes pushed successfully!

  Done!
```

## Development

```bash
# Run in dev mode
bun run dev

# Type check
bun run typecheck

# Build executable
bun run build
```

## Requirements

- [Bun](https://bun.sh) runtime (for building/development)
- Git
- OpenRouter API key
