<div align="center">

# 🚀 pushit

**AI-powered git commits with a beautiful terminal UI**

Generate perfect [Conventional Commits](https://www.conventionalcommits.org/) from your changes in seconds.

[![Bun](https://img.shields.io/badge/Bun-000000?style=for-the-badge&logo=bun&logoColor=white)](https://bun.sh)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/License-MIT-22c55e?style=for-the-badge)](LICENSE)
[![AI Powered](https://img.shields.io/badge/AI-Powered-a855f7?style=for-the-badge&logo=openai&logoColor=white)](https://openrouter.ai)
[![Conventional Commits](https://img.shields.io/badge/Conventional-Commits-fe5196?style=for-the-badge&logo=conventionalcommits&logoColor=white)](https://conventionalcommits.org)

</div>

---

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
│  feat(auth): add OAuth2 login flow  │
│                                     │
├─────────────────────────────────────╯
│
◆  What would you like to do?
│  ● Commit and push
│  ○ Regenerate
│  ○ Cancel
```

---

## ✨ Features

<table>
<tr>
<td width="50%">

### 🎯 Conventional Commits

Automatically generates properly formatted commit messages following the [Conventional Commits](https://conventionalcommits.org) specification.

</td>
<td width="50%">

### 🔍 Smart Context Analysis

Analyzes git diffs, file contents, branch names, and recent commit history to understand the _purpose_ of your changes.

</td>
</tr>
<tr>
<td width="50%">

### 🎨 Beautiful Terminal UI

Powered by [@clack/prompts](https://github.com/bombshell-dev/clack) with spinners, styled prompts, and interactive menus.

</td>
<td width="50%">

### 🌐 Multi-Project Support

Detects Node.js, Bun, Rust, Python, and Go projects to provide better context-aware commit messages.

</td>
</tr>
<tr>
<td width="50%">

### 🔗 Issue Detection

Automatically extracts issue numbers from branch names (`feature/123-add-login`, `JIRA-456`, `#789`).

</td>
<td width="50%">

### ⚡ One Command Workflow

Stage, analyze, generate, commit, and push — all with a single `pushit` command.

</td>
</tr>
</table>

---

## 📊 How It Works

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│                 │     │                 │     │                 │     │                 │
│   📁 Stage      │────▶│   🔍 Analyze    │────▶│   🤖 Generate   │────▶│   🚀 Commit     │
│   Changes       │     │   Context       │     │   Message       │     │   & Push        │
│                 │     │                 │     │                 │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘     └─────────────────┘
        │                       │                       │                       │
        ▼                       ▼                       ▼                       ▼
   git add -A             Gathers:                AI analyzes              Interactive
                      • Git diff                 context and              menu lets you
                      • File contents            generates a              commit, push,
                      • Branch name              conventional             or regenerate
                      • Recent commits           commit message
```

---

## ⚡ Quick Start

### Prerequisites

- [Bun](https://bun.sh) runtime
- Git
- [OpenRouter](https://openrouter.ai) API key

### Installation

```bash
# Clone the repository
git clone https://github.com/matyas-cimbulka/pushit
cd pushit

# Install dependencies
bun install

# Build and install to ~/.local/bin
bun run install
```

> **Note:** Make sure `~/.local/bin` is in your `PATH`

### Setup

1. Get an API key from [openrouter.ai](https://openrouter.ai)

2. Create your environment file:

   ```bash
   cp .env.example .env
   ```

3. Add your API key to `.env`:
   ```env
   OPENROUTER_API_KEY=your-api-key-here
   ```

---

## 🔧 Configuration

| Variable             | Required | Default                                   | Description             |
| -------------------- | :------: | ----------------------------------------- | ----------------------- |
| `OPENROUTER_API_KEY` |    ✅    | —                                         | Your OpenRouter API key |
| `OPENROUTER_MODEL`   |    ❌    | `google/gemini-2.5-flash-preview-09-2025` | AI model to use         |

---

## 📋 Why pushit?

| Feature             | Manual Commits |    **pushit**    |
| ------------------- | :------------: | :--------------: |
| Context awareness   |       ❌       |        ✅        |
| Consistent style    |       ❌       |        ✅        |
| Conventional format | Manual effort  |     ✅ Auto      |
| Issue linking       |   Copy/paste   | ✅ Auto-detected |
| Time per commit     |    ~30-60s     |       ~5s        |
| Typos               |       🤷       |     ✅ None      |

---

## 🌍 Supported Projects

<div align="center">

|                                                                                                            |                                                                                              |                                                                                                 |                                                                                                       |                                                                                           |
| :--------------------------------------------------------------------------------------------------------: | :------------------------------------------------------------------------------------------: | :---------------------------------------------------------------------------------------------: | :---------------------------------------------------------------------------------------------------: | :---------------------------------------------------------------------------------------: |
| ![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white) | ![Bun](https://img.shields.io/badge/Bun-000000?style=for-the-badge&logo=bun&logoColor=white) | ![Rust](https://img.shields.io/badge/Rust-000000?style=for-the-badge&logo=rust&logoColor=white) | ![Python](https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white) | ![Go](https://img.shields.io/badge/Go-00ADD8?style=for-the-badge&logo=go&logoColor=white) |

</div>

pushit automatically detects your project type and includes relevant context (name, version) in the AI prompt for better commit messages.

---

## 🛠️ Development

```bash
bun run dev        # Run in development mode
bun run lint       # Lint with ESLint
bun run typecheck  # Type check with TypeScript
bun run build      # Build native executable
bun run install    # Build and install to ~/.local/bin
```

---

## 🤝 Contributing

Contributions are welcome! Here's how you can help:

1. **Fork** the repository
2. **Create** your feature branch
   ```bash
   git checkout -b feature/amazing-feature
   ```
3. **Make** your changes
4. **Test** your changes with `bun run dev`
5. **Commit** your changes (use `pushit` of course! 😉)
6. **Push** to your branch
7. **Open** a Pull Request

### Code Style

- TypeScript with strict mode
- ESLint for linting
- Bun-native APIs preferred

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

---

<div align="center">

Made with ❤️ by [Maty MILLIEN](https://github.com/maty-millien)

**⭐ Star this repo if you find it useful!**

</div>
