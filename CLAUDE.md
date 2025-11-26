# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Pushit is an AI-powered CLI tool that generates conventional commit messages from git changes using the OpenRouter API. It uses @clack/prompts for the terminal UI.

## Commands

```bash
bun run dev        # Run in development mode
bun run lint       # Lint with ESLint
bun run typecheck  # Type check with tsc
bun run build      # Build native executable
bun run install    # Build and install to ~/.local/bin
```

## Architecture

The codebase follows a simple modular structure:

- **index.ts** - Main CLI flow using @clack/prompts (spinners, selects, notes)
- **git.ts** - Git operations via `Bun.spawnSync` wrapper
- **context.ts** - Builds context for LLM: project detection, file reading, prompt construction
- **api.ts** - OpenRouter streaming API client
- **config.ts** - Environment config loader and constants
- **types.ts** - TypeScript interfaces
- **PROMPT.md** - LLM prompt template (imported as text via Bun)

## Key Patterns

- Uses Bun runtime and Bun-specific APIs (`Bun.spawnSync`, `Bun.file`)
- Prompt template uses `{{placeholder}}` syntax, replaced in `buildPrompt()`
- Project type detection checks for bun.lockb, package.json, Cargo.toml, pyproject.toml, go.mod
- Binary files are skipped based on extension (BINARY_EXTENSIONS set in config.ts)
- File contents limited to 50KB and 500 lines per file

## Environment Variables

- `OPENROUTER_API_KEY` - Required API key
- `OPENROUTER_MODEL` - Optional, defaults to `google/gemini-2.5-flash-preview-09-2025`
