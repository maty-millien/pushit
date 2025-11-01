# AI Commit

A shell script that uses OpenRouter API to generate meaningful commit messages and asks for confirmation before committing.

## Features

- Analyzes both staged and unstaged changes
- Generates conventional commit messages using AI (via OpenRouter)
- Shows generated message for review
- Asks for confirmation before committing
- Automatically stages all changes before committing

## Setup

1. Get an OpenRouter API key from [openrouter.ai](https://openrouter.ai)

2. Set your API key as an environment variable:
   ```bash
   export OPENROUTER_API_KEY='your-api-key-here'
   ```

3. (Optional) Set your preferred model:
   ```bash
   export OPENROUTER_MODEL='anthropic/claude-3.5-sonnet'
   ```
   Default model: `anthropic/claude-3.5-sonnet`

## Usage

From any git repository:

```bash
./ai-commit.sh
```

Or add it to your PATH for global access:

```bash
# Add to your ~/.bashrc or ~/.zshrc
export PATH="$PATH:/Users/maty/Projects/ai-commit"

# Then use it anywhere:
ai-commit.sh
```

## How It Works

1. Checks if you're in a git repository
2. Analyzes your git changes (staged and unstaged)
3. Sends changes to OpenRouter API for analysis
4. Displays the generated commit message
5. Asks for your confirmation (y/n)
6. If confirmed, stages all changes and creates the commit

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
$ ./ai-commit.sh
Analyzing changes...
Generating commit message with AI...

Generated commit message:
─────────────────────────────────────
feat: add AI-powered commit message generator

Implement shell script that uses OpenRouter API to analyze
git changes and generate conventional commit messages with
user confirmation before committing.
─────────────────────────────────────

Do you want to commit with this message? (y/n):
```
