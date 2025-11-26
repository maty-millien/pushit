# pushit

AI-powered git commits with a beautiful terminal UI. Generates conventional commit messages from your changes and optionally pushes to remote.

## Features

- Interactive CLI with spinners and styled prompts (powered by [@clack/prompts](https://github.com/bombshell-dev/clack))
- Automatically stages all changes before analysis
- Gathers rich context for better commit messages:
  - Git diff and file contents (up to 500 lines per file)
  - Project type detection (Node, Bun, Rust, Python, Go)
  - Issue number extraction from branch names
  - Recent commit history for style matching
- Generates [Conventional Commits](https://www.conventionalcommits.org/) via OpenRouter API
- Smart remote detection: shows "Commit and push" only when a remote exists

## Installation

Requires [Bun](https://bun.sh).

```bash
git clone https://github.com/matyas-cimbulka/pushit
cd pushit
bun install
bun run install
```

This builds the binary and installs it to `~/.local/bin`. Make sure `~/.local/bin` is in your PATH.

## Setup

1. Get an API key from [openrouter.ai](https://openrouter.ai)

2. Copy the example environment file and add your key:

   ```bash
   cp .env.example .env
   ```

   Edit `.env` and replace `your-api-key-here` with your actual API key. You can also change the model if desired.

## Usage

```bash
pushit
```

## Example

```
┌  pushit - AI-powered git commits
│
◇  Changes staged
│
◇  Analysis complete
│
◇  Message generated

╭───────────────────────────────────────────╮
│                                           │
│   refactor: set default model in config   │
│                                           │
╰───────────────────────────────────────────╯

│
◇  What would you like to do?
│  Commit and push
│
◆  Commit created successfully!
│
◇  Changes pushed successfully!
│
└  Done!
```

## Development

```bash
bun run dev        # Run in development mode
bun run lint       # Lint with ESLint
bun run typecheck  # Type check
bun run build      # Build executable
bun run install    # Build and install to ~/.local/bin
```

## Requirements

- [Bun](https://bun.sh)
- Git
- OpenRouter API key
