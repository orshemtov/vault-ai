# Manual Verification

Run this checklist inside Obsidian against a real vault before calling the plugin release-ready.

## Chat Interface

- [ ] Open assistant view successfully
- [ ] Send a prompt with `Enter`
- [ ] Stop a running request with the Stop button
- [ ] Stop a running request with `Escape`
- [ ] Start a new chat while sending and confirm the request cancels
- [ ] Switch chats while sending and confirm the request cancels
- [ ] Use `Tab` to accept an `@` suggestion
- [ ] Use `Tab` to accept a `/` suggestion
- [ ] Use `/clear`

## Mentions And Commands

- [ ] `@note` inserts and resolves correctly
- [ ] `@"path with spaces.md"` inserts and resolves correctly
- [ ] `#note` suggestions appear and insert correctly
- [ ] `@all` switches to whole-vault context
- [ ] Folder mention resolves to folder scope when exact match exists
- [ ] Slash command expands correctly

## Providers

- [ ] OpenRouter generate works
- [ ] OpenAI generate works
- [ ] Anthropic generate works
- [ ] Ollama generate works
- [ ] Streaming visibly updates in the UI for at least one supported provider

## Memory

- [ ] State a durable preference and confirm a note is created under `AI/Memory/Profile/`
- [ ] Start a new chat and confirm the preference is recalled
- [ ] Save a fact memory through internal tool flow and confirm a note is created under `AI/Memory/Facts/`
- [ ] Save a lesson memory through internal tool flow and confirm a note is created under `AI/Memory/Lessons/`
- [ ] Confirm unrelated memories are not surfaced for a mismatched prompt

## Dynamic Discovery

- [ ] Add a new `Agents/<id>/AGENT.md` and confirm it becomes selectable without restart
- [ ] Add a new `Skills/<id>/SKILL.md` and confirm it influences the next eligible request without restart
- [ ] Add a new `Commands/<id>.md` and confirm it becomes invokable without restart

## Permissions

- [ ] Ask agent cannot write notes
- [ ] Ask agent cannot update frontmatter
- [ ] Edit agent can create/update notes
- [ ] Approval-required tools do not run silently

## Citations

- [ ] Sources only show notes actually used for the answer
- [ ] Tool-read note citations appear when a tool reads a note
- [ ] No generic unrelated citation bundles appear
