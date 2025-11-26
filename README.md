<div align="center">

# pushit

**AI-powered git commits with a beautiful terminal UI**

[![Bun](https://img.shields.io/badge/Bun-%23000000.svg?style=for-the-badge&logo=bun&logoColor=white)](https://bun.sh)
[![TypeScript](https://img.shields.io/badge/TypeScript-%23007ACC.svg?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![OpenRouter](https://img.shields.io/badge/OpenRouter-6366F1?style=for-the-badge&logo=openai&logoColor=white)](https://openrouter.ai)
[![Conventional Commits](https://img.shields.io/badge/Conventional%20Commits-FE5196?style=for-the-badge&logo=conventionalcommits&logoColor=white)](https://conventionalcommits.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)

Generate conventional commit messages from your changes and optionally push to remote.

</div>

---

## Features

| Feature                  | Description                                                                                     |
| ------------------------ | ----------------------------------------------------------------------------------------------- |
| **Interactive CLI**      | Spinners and styled prompts powered by [@clack/prompts](https://github.com/bombshell-dev/clack) |
| **Auto-staging**         | Automatically stages all changes before analysis                                                |
| **Rich Context**         | Git diff, file contents (up to 500 lines), project detection                                    |
| **Multi-language**       | Detects Node, Bun, Rust, Python, and Go projects                                                |
| **Smart Branch Parsing** | Extracts issue numbers from branch names                                                        |
| **Style Matching**       | Uses recent commit history to match your style                                                  |
| **Conventional Commits** | Generates standardized commit messages via OpenRouter API                                       |
| **Smart Push**           | Shows "Commit and push" only when a remote exists                                               |

## Installation

> **Prerequisites:** [Bun](https://bun.sh) runtime

```bash
git clone https://github.com/matyas-cimbulka/pushit
cd pushit
bun install
bun run install
```

This builds the binary and installs it to `~/.local/bin`. Make sure `~/.local/bin` is in your PATH.

## Setup

**1. Get an API key from [openrouter.ai](https://openrouter.ai)**

**2. Configure your environment:**

```bash
cp .env.example .env
```

Edit `.env` and replace `your-api-key-here` with your actual API key. You can also change the model if desired.

## Usage

```bash
pushit
```

### Example Output

```
┌  pushit - AI-powered git commits
│
◇  Changes staged
│
◇  Analysis complete
│
◇  Message generated
│
◇  Commit message ────────────────────╮
│                                     │
│  refactor(cli): simplify ui output  │
│                                     │
├─────────────────────────────────────╯
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

| Command             | Description                       |
| ------------------- | --------------------------------- |
| `bun run dev`       | Run in development mode           |
| `bun run lint`      | Lint with ESLint                  |
| `bun run typecheck` | Type check with TypeScript        |
| `bun run build`     | Build native executable           |
| `bun run install`   | Build and install to ~/.local/bin |

## Requirements

- [Bun](https://bun.sh) - Fast JavaScript runtime
- Git - Version control
- [OpenRouter API key](https://openrouter.ai) - For AI generation

---

<div align="center">

Made with :purple_heart: and AI

</div>
