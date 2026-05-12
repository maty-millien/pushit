# Project Overview

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

## Configuration

Config is loaded from `~/.config/pushit/.env` (copied during `bun run setup`).

Environment variables:

- `OPENROUTER_API_KEY` - Required API key
