# pushit

A shell script that uses OpenRouter API to generate meaningful commit messages, asks for confirmation, and pushes to remote.

## Features

- Analyzes both staged and unstaged changes
- Generates conventional commit messages using AI (via OpenRouter)
- Shows generated message for review
- Interactive menu to commit & push, regenerate, or cancel
- Automatically stages all changes before committing
- Pushes to remote repository (if configured)

## Setup

1. Get an OpenRouter API key from [openrouter.ai](https://openrouter.ai)

2. Set your API key as an environment variable:

   ```bash
   OPENROUTER_API_KEY='your-api-key-here'
   ```

3. (Optional) Set your preferred model:
   ```bash
   OPENROUTER_MODEL='your-preferred-model-here'
   ```
   Default model: `google/gemini-2.5-flash-lite-preview-09-2025`

## Usage

From any git repository:

```bash
./pushit.sh
```

Or add it to your PATH for global access:

```bash
# Add to your ~/.bashrc or ~/.zshrc
export PATH="$PATH:/Users/maty/Projects/pushit"

# Then use it anywhere:
pushit.sh
```

## How It Works

1. Checks if you're in a git repository
2. Analyzes your git changes (staged and unstaged)
3. Sends changes to OpenRouter API for analysis
4. Displays the generated commit message
5. Presents interactive menu (commit & push / regenerate / cancel)
6. If confirmed, stages all changes, creates the commit, and pushes to remote

## Requirements

- `git`
- `curl`
- `jq` (JSON processor)

Install jq if needed:

```bash
# macOS
brew install jq

# Ubuntu/Debian
sudo apt-get install jq
```

## Example

```bash
$ ./pushit.sh
Staging all changes...
Analyzing changes...
Generating commit message with AI...

Generated commit message:
─────────────────────────────────────
feat: add AI-powered commit message generator
─────────────────────────────────────

What would you like to do?
❯ Commit and push
  Regenerate
  Cancel
```
