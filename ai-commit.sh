#!/bin/bash

# AI Commit - Generate commit messages using OpenRouter API
# Usage: ./ai-commit.sh

set -e

# Load .env file if it exists
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -f "$SCRIPT_DIR/.env" ]; then
    export $(grep -v '^#' "$SCRIPT_DIR/.env" | xargs)
fi

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color
BOLD='\033[1m'
DIM='\033[2m'

# Function to display arrow key selector
select_option() {
    local options=("$@")
    local selected=0
    local num_options=${#options[@]}

    # Hide cursor
    tput civis

    while true; do
        # Display options
        for i in "${!options[@]}"; do
            if [ $i -eq $selected ]; then
                echo -e "${GREEN}${BOLD}❯ ${options[$i]}${NC}"
            else
                echo -e "${DIM}  ${options[$i]}${NC}"
            fi
        done

        # Read arrow keys
        read -rsn3 key

        case "$key" in
            $'\x1b[A') # Up arrow
                ((selected--))
                if [ $selected -lt 0 ]; then
                    selected=$((num_options - 1))
                fi
                ;;
            $'\x1b[B') # Down arrow
                ((selected++))
                if [ $selected -ge $num_options ]; then
                    selected=0
                fi
                ;;
            '') # Enter key
                tput cnorm # Show cursor
                echo
                return $selected
                ;;
        esac

        # Move cursor up to redraw
        tput cuu $num_options
    done
}

# Configuration
OPENROUTER_API_KEY="${OPENROUTER_API_KEY:-}"
OPENROUTER_MODEL="${OPENROUTER_MODEL:-}"
OPENROUTER_API_URL="https://openrouter.ai/api/v1/chat/completions"

# Check if API key is set
if [ -z "$OPENROUTER_API_KEY" ]; then
    echo -e "${RED}Error: OPENROUTER_API_KEY environment variable is not set${NC}"
    echo "Please set it with: export OPENROUTER_API_KEY='your-api-key'"
    exit 1
fi

# Check if we're in a git repository
if ! git rev-parse --is-inside-work-tree > /dev/null 2>&1; then
    echo -e "${RED}Error: Not a git repository${NC}"
    exit 1
fi

# Check if there are changes to commit
if git diff --cached --quiet && git diff --quiet && [ -z "$(git ls-files --others --exclude-standard)" ]; then
    echo -e "${YELLOW}No changes to commit${NC}"
    exit 0
fi

# Stage all changes and untracked files
echo -e "${BLUE}Staging all changes...${NC}"
git add -A

echo -e "${BLUE}Analyzing changes...${NC}"

# Get git diff (staged only, since we've now staged everything)
STAGED_DIFF=$(git diff --cached)
UNSTAGED_DIFF=""

# Combine diffs
if [ -n "$STAGED_DIFF" ]; then
    GIT_DIFF="Staged changes:\n$STAGED_DIFF"
else
    GIT_DIFF=""
fi

if [ -n "$UNSTAGED_DIFF" ]; then
    if [ -n "$GIT_DIFF" ]; then
        GIT_DIFF="$GIT_DIFF\n\nUnstaged changes:\n$UNSTAGED_DIFF"
    else
        GIT_DIFF="Unstaged changes:\n$UNSTAGED_DIFF"
    fi
fi

# Get git status for untracked files
GIT_STATUS=$(git status --short)

# Create prompt for AI
PROMPT="You are an expert Git commit message generator. Your sole task is to produce a single, concise, and conventionally formatted commit message subject line.

**Output Rules:**

1.  **Conventional Commits:** The output must strictly adhere to the Conventional Commits specification.
2.  **Format:** The entire output must be a single line in the format: \`<type>(<optional-scope>): <description>\`
3.  **Type:** The \`<type>\` must be one of the following:
    * \`feat\`: A new feature for the user.
    * \`fix\`: A bug fix for the user.
    * \`docs\`: Documentation-only changes.
    * \`style\`: Changes that do not affect the meaning of the code (white-space, formatting, etc.).
    * \`refactor\`: A code change that neither fixes a bug nor adds a feature.
    * \`perf\`: A code change that improves performance.
    * \`test\`: Adding missing tests or correcting existing tests.
    * \`build\`: Changes that affect the build system or external dependencies.
    * \`ci\`: Changes to CI configuration files and scripts.
    * \`chore\`: Other changes that don't modify \`src\` or \`test\` files.
4.  **Scope:** The \`<optional-scope>\` should be a noun describing a section of the codebase (e.g., \`api\`, \`ui\`, \`auth\`).
5.  **Description:** The \`<description>\` must:
    * Be a short summary of the code changes.
    * Be written in the imperative mood (e.g., \"add feature\" not \"added feature\").
    * Not be capitalized.
    * Not end with a period.
6.  **Conciseness:** The entire message must be 50 characters or less.
7.  **Purity:** The output must ONLY be the generated commit message string. Do not include any explanations, introductory text, or markdown formatting.

**Example of a valid output:**
\`feat(auth): add user profile component and update api\`

Git status:
$GIT_STATUS

Git diff:
$GIT_DIFF"

# Escape the prompt for JSON
PROMPT_JSON=$(echo "$PROMPT" | jq -Rs .)

# Call OpenRouter API
echo -e "${BLUE}Generating commit message with AI...${NC}"

RESPONSE=$(curl -s "$OPENROUTER_API_URL" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $OPENROUTER_API_KEY" \
    -H "HTTP-Referer: https://github.com/ai-commit" \
    -H "X-Title: AI Commit" \
    -d "{
        \"model\": \"$OPENROUTER_MODEL\",
        \"messages\": [
            {
                \"role\": \"user\",
                \"content\": $PROMPT_JSON
            }
        ]
    }")

# Extract commit message from response
COMMIT_MESSAGE=$(echo "$RESPONSE" | jq -r '.choices[0].message.content // empty')

if [ -z "$COMMIT_MESSAGE" ]; then
    echo -e "${RED}Error: Failed to generate commit message${NC}"
    echo "API Response: $RESPONSE"
    exit 1
fi

# Display the generated commit message
echo -e "\n${GREEN}Generated commit message:${NC}"
echo -e "${YELLOW}─────────────────────────────────────${NC}"
echo "$COMMIT_MESSAGE"
echo -e "${YELLOW}─────────────────────────────────────${NC}\n"

# Ask for confirmation with arrow key selector
echo "What would you like to do?"
select_option "Commit and push" "Cancel"
choice=$?

if [ $choice -eq 0 ]; then
    # Create the commit
    git commit -m "$COMMIT_MESSAGE"
    echo -e "${GREEN}✓ Commit created successfully!${NC}"

    # Push to remote
    echo -e "${BLUE}Pushing to remote...${NC}"
    if git push; then
        echo -e "${GREEN}✓ Changes pushed successfully!${NC}"
    else
        echo -e "${RED}Error: Failed to push changes${NC}"
        exit 1
    fi
else
    echo -e "${YELLOW}Commit cancelled${NC}"
    # Unstage changes since user rejected the commit
    git reset
    exit 0
fi
