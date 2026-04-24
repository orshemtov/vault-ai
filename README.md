# OpenVault AI

OpenVault AI is an Obsidian assistant for talking to your notes, organizing context, and building repeatable workflows with markdown-defined agents, skills, and commands.

<p align="center">
  <a href="https://github.com/orshemtov/openvault-ai/releases">
    <img src="https://img.shields.io/github/v/release/orshemtov/openvault-ai?label=release" alt="Release" />
  </a>
  <a href="https://github.com/orshemtov/openvault-ai/actions/workflows/ci.yml">
    <img src="https://img.shields.io/github/actions/workflow/status/orshemtov/openvault-ai/ci.yml?label=ci" alt="CI" />
  </a>
  <a href="./LICENSE">
    <img src="https://img.shields.io/github/license/orshemtov/openvault-ai" alt="License" />
  </a>
  <a href="https://github.com/orshemtov/openvault-ai/stargazers">
    <img src="https://img.shields.io/github/stars/orshemtov/openvault-ai?style=social" alt="GitHub stars" />
  </a>
</p>

<p align="center">
  <a href="https://github.com/orshemtov/openvault-ai/issues">
    <img src="https://img.shields.io/github/issues/orshemtov/openvault-ai" alt="Issues" />
  </a>
  <img src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg" alt="PRs welcome" />
  <img src="https://img.shields.io/badge/Obsidian-plugin-7C3AED" alt="Obsidian plugin" />
</p>

<!-- Add logo here once the asset is committed, for example:
![OpenVault AI logo](./assets/openvault-ai-logo.png)
-->

<!-- Add product screenshot here once the asset is committed, for example:
![OpenVault AI screenshot](./assets/openvault-ai-screenshot.png)
-->

## Features

- Chat with a single note, a folder, selected notes, or the whole vault
- Reference notes and folders directly with `@mentions`
- Run slash commands from markdown-defined command files
- Switch between built-in agents like `ask` and `edit`
- Add your own agents in `Agents/<agent-name>/AGENT.md`
- Add reusable skills in `Skills/<skill-name>/SKILL.md`
- Persist conversations in the vault as markdown files
- Store long-term memory entries in the vault for preferences, facts, and lessons
- Switch between local and cloud model backends from the plugin UI
- Review tool usage and assistant context directly in the UI

## How It Works

OpenVault AI keeps the assistant close to your vault instead of hiding behavior behind a remote service.

- Notes stay addressable as files and folders
- Agents, skills, and commands are editable markdown files in the vault
- Conversations are saved as markdown notes
- Long-term memory is stored as markdown entries in the vault
- Model and backend settings live in the plugin settings for the current vault

## Memory

OpenVault AI supports two kinds of memory:

- Conversation memory: active chats and previous conversations stored in the vault
- Long-term memory: saved preferences, facts, and lessons that the assistant can reuse later

This makes it possible to keep context across sessions while still keeping the data visible and editable.

## Agents, Skills, And Commands

The plugin supports built-in behavior plus vault-defined extensions.

### Agents

Built-in agents:

- `ask`
- `edit`

Custom agents live in:

```text
Agents/<agent-name>/AGENT.md
```

### Skills

Custom skills live in:

```text
Skills/<skill-name>/SKILL.md
```

### Commands

Custom slash commands live in:

```text
Commands/<command-name>.md
```

## Installation

### Community plugins

Once approved in the Obsidian marketplace:

1. Open Obsidian
2. Go to `Settings -> Community plugins`
3. Search for `OpenVault AI`
4. Install the plugin
5. Enable it

### Manual installation

1. Download `main.js`, `manifest.json`, and `styles.css` from a GitHub release
2. Create this folder inside your vault:

```text
<vault>/.obsidian/plugins/openvault-ai/
```

3. Copy the release files into that folder
4. Reload Obsidian and enable the plugin

## Usage

### Open the assistant

Use one of these commands from the command palette:

- `Open assistant`
- `Toggle assistant`

### Configure a backend

The settings tab lets you configure:

- Local and cloud model backends
- API keys and endpoint configuration
- Default agent and model behavior

### Ask about notes

Inside the assistant you can reference vault content directly in the prompt.

Examples:

- `@Daily/2026-04-24.md summarize this note`
- `@Projects/Roadmap/ what are the open decisions here?`
- `@all compare the main themes across my recent planning notes`

## Privacy And Data Handling

- Local backends keep requests on your machine unless the backend itself is remote
- Cloud backends send request data to the external services you configure
- Prompts may include note content that you explicitly reference or that the plugin retrieves for the active request
- API keys are stored in the plugin's local Obsidian data file for the current vault
- This plugin does not include telemetry or analytics collection

You are responsible for choosing which backend to use for a given vault and what content you send to external APIs.

## License

MIT
