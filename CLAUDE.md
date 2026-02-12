# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Pushit is an AI-powered CLI tool that generates conventional commit messages from git changes using the OpenRouter API. It uses @clack/prompts for the terminal UI.

## Commands

```bash
bun run dev        # Run in development mode (--dry-run)
bun run lint       # Lint with ESLint
bun run typecheck  # Type check with tsc
bun run format     # Format with Prettier
bun run build      # Build native executable
bun run setup    # Build and install to ~/.local/bin
```

## Architecture

```
src/
├── index.ts          # Main CLI entry point using @clack/prompts
├── config.ts         # Environment config loader and constants
├── api.ts            # OpenRouter streaming API client
├── updater.ts        # Auto-update checker with version caching
├── prompt.md         # LLM prompt template (imported as text)
├── types/
│   ├── index.ts      # TypeScript interfaces
│   └── text.d.ts     # Module declaration for .md imports
└── git/
    ├── commands.ts   # Async git command wrappers via Bun.spawn
    └── context.ts    # Git context building for LLM prompt
```

## Key Patterns

- Uses Bun runtime and Bun-specific APIs (`Bun.spawn`, `Bun.file`)
- Async operations with parallel execution via `Promise.all()`
- Prompt template uses `{{placeholder}}` syntax, replaced in `buildPrompt()`
- Binary files are skipped based on extension (BINARY_EXTENSIONS set in config.ts)
- File contents limited to 50KB and 500 lines per file
- Supports `--dry-run` flag for testing without committing
- File status display parses `git status --short` via `parseStatus()` in commands.ts
- Diff stats use `git diff --numstat` via `getDiffStats()` for per-file insertions/deletions

## Configuration

Config is loaded from `~/.config/pushit/.env` (copied during `bun run setup`).

Environment variables:

- `OPENROUTER_API_KEY` - Required API key
