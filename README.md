# OpenVault AI

OpenVault AI is a desktop-first Obsidian plugin that adds an assistant sidebar for working with notes using local or cloud language models.

## Features

- Sidebar assistant with persistent conversations
- Note-aware chat with `@note` and `@folder/` mentions
- Built-in `ask` and `edit` agents
- Vault-defined agents, skills, and prompt commands
- Provider support for `Ollama`, `OpenRouter`, `OpenAI`, and `Anthropic`
- Provider/model switching from the assistant UI and settings
- Tool execution visibility in assistant replies
- Obsidian command palette actions for opening and toggling the assistant

## What The Plugin Does Today

The current release focuses on the core assistant workflow:

- open the AI assistant in a sidebar view
- choose an agent, provider, and model
- ask questions about your notes
- reference notes and folders directly from the prompt
- save and reopen conversations
- load custom agents, skills, and commands from your vault

The long-term design and product docs live under `spec/`, but the marketplace release is centered on the working assistant experience that ships in this repository today.

## Installation

### Community Plugins

Once approved in the Obsidian marketplace:

1. Open Obsidian
2. Go to `Settings -> Community plugins`
3. Search for `OpenVault AI`
4. Install the plugin
5. Enable it

### Manual Installation

1. Download `main.js`, `manifest.json`, and `styles.css` from a GitHub release
2. Create this folder inside your vault:

```text
<vault>/.obsidian/plugins/openvault-ai/
```

3. Copy the release files into that folder
4. Reload Obsidian and enable the plugin

## Usage

### Open The Assistant

Use one of these commands from the command palette:

- `Open OpenVault`
- `Toggle OpenVault AI`

### Configure A Provider

The settings tab lets you configure:

- `Ollama` base URL
- `OpenRouter` base URL and API key
- `OpenAI` base URL and API key
- `Anthropic` base URL and API key

### Work With Notes

Inside the assistant you can reference vault content directly in the prompt.

Examples:

- `@Daily/2026-04-24.md summarize this note`
- `@Projects/Roadmap/ what are the open decisions here?`

### Customize Agents, Skills, And Commands

Vault-defined content is loaded from these folders by default:

```text
Agents/
Skills/
Commands/
```

Examples:

- `Agents/<agent-name>/AGENT.md`
- `Skills/<skill-name>/SKILL.md`
- `Commands/<command-name>.md`

## Privacy And Data Handling

- `Ollama` requests stay on your local machine unless your Ollama server is remote
- `OpenRouter`, `OpenAI`, and `Anthropic` send request data to external services you configure
- Prompts may include note content that you explicitly reference or that the plugin retrieves for the active request
- API keys are stored in the plugin's local Obsidian data file for the current vault
- This plugin does not include telemetry or analytics collection

You are responsible for choosing which provider to use for a given vault and what content you send to external APIs.

## Development

### Prerequisites

- Node.js 20+ or 22+
- npm
- Obsidian desktop

### Install Dependencies

```bash
npm install
```

### Start Development Build

```bash
npm run dev
```

### Production Build

```bash
npm run build
```

### Automated Checks

```bash
npm test
npm run typecheck
```

## Releasing

Each release must keep these files in sync:

- `manifest.json`
- `package.json`
- `versions.json`

GitHub releases for this repository include:

- `main.js`
- `manifest.json`
- `styles.css`
- `versions.json`

The repository includes a GitHub Actions workflow that builds and uploads those assets when a release is published.

## Project Docs

Design and planning documents live in `spec/`:

- `spec/ARCHITECTURE.md`
- `spec/SPEC.md`
- `spec/TECH_STACK.md`
- `spec/OVERVIEW.md`
- `spec/TASKS.md`
- `spec/TESTING.md`

## License

MIT
