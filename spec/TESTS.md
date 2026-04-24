# Tests

## Purpose

This document defines the acceptance test dataset and evaluation framework for the Vault AI plugin.

It is meant to help us:

- verify the product behaves as intended
- iterate on behavior intentionally
- catch regressions quickly
- evaluate model and agent quality over time
- define what "good" means before we optimize implementation details

This file should evolve as the product evolves.

## Principles

- Use real vault data whenever possible.
- Prefer end-to-end prompts over synthetic unit-style prompts for product behavior.
- Every test should target one or more explicit behaviors.
- Every important behavior should have at least one regression test.
- If behavior is desired but not implemented yet, keep the test and mark it as blocked or target-state.
- Permissions and safety are first-class test dimensions, not secondary checks.
- Cite quality matters, not just answer quality.
- Performance and UX expectations should be tested alongside correctness.

## Scope

We need to test:

1. Conversation behavior
2. Same-chat memory
3. Cross-chat memory
4. Agent behavior and permission enforcement
5. Skills usage
6. `/commands`
7. Retrieval quality and citation quality
8. Edit/write behavior
9. Performance
10. Output quality
11. UI expectations where they materially affect usability

## Current Capability Snapshot

Current built-in primary agents:

- `ask`: read/search only
- `edit`: read/search/create/edit

Current built-in tool surface includes:

- `get-active-note`
- `get-selection`
- `read-note`
- `search-notes`
- `list-notes-in-folder`
- `create-note`
- `append-note`
- `update-note`
- `read-frontmatter`
- `update-frontmatter`

Current gaps to explicitly track:

- No explicit current-date tool yet.
- No real vault `Skills/**/*.md` found in the Knowledge vault.
- No real vault `Commands/**/*.md` found in the Knowledge vault.
- Same-chat memory behavior is partial and needs clearer implementation.
- Cross-chat memory is not implemented yet.
- Streaming behavior needs a product decision if true incremental updates are not achievable in Obsidian desktop.

## Memory Strategy Recommendation

We should support **both** same-chat and cross-chat memory, using separate layers.

### 1. Short-term memory

Thread-scoped, same-chat memory.

Use it for:

- follow-up questions
- unresolved tasks in the same session
- temporary constraints
- currently active note/folder scope
- ongoing edit context

Recommended implementation direction:

- include recent turns directly in the model prompt
- add rolling summarization for long threads
- persist summary + recent turns with the conversation note

### 2. Long-term memory

Cross-chat memory.

Use it for:

- durable user preferences
- stable project facts
- repeated workflow preferences
- learned lessons from prior sessions

Recommended memory classes:

- **Semantic memory**: facts/preferences
- **Episodic memory**: prior successful interactions / examples
- **Procedural memory**: lessons/rules the assistant should follow

Recommended storage direction for this product:

- vault-backed memory notes under something like `AI/Memory/`
- explicit namespaces such as:
  - `AI/Memory/Profile/`
  - `AI/Memory/Episodes/`
  - `AI/Memory/Lessons/`

### 3. Explicit current-date capability

Relative-time prompts should not depend on model guesswork.

We should add an explicit built-in tool such as:

- `get-current-date`

It should provide:

- current date
- local time
- timezone

This is required for prompts like:

- `last month`
- `this week`
- `today`
- `yesterday`

## Test Case Template

Each acceptance test should use this structure.

```md
### T-XXX: Short title

- Category:
- Status: active | blocked | target-state
- Priority: high | medium | low
- Agent:
- Prompt:
- Real vault notes/folders involved:
- Behaviors under test:
- Expected context behavior:
- Expected tool / skill / command behavior:
- Expected permission behavior:
- Expected response qualities:
- Failure modes to watch:
- Scoring rubric:
```

## Evaluation Rubric

Score each response from 1-5 on the following axes.

- Correctness
- Groundedness
- Relevance
- Completeness
- Concision
- Citation precision
- Citation usefulness
- Permission compliance

For write/edit tests also score:

- Edit safety
- Scope adherence
- Minimality of change

For memory tests also score:

- Continuity
- Constraint retention
- No memory leakage

## Performance Metrics

Track these for key flows:

- Time to first visible update
- Total latency to final answer
- Retrieval latency
- Edit completion latency
- Number of cited notes
- Number of irrelevant citations

## Core Prompt Dataset

### T-001: Summarize daily notes from the last month

- Category: context + temporal reasoning
- Status: target-state
- Priority: high
- Agent: ask
- Prompt: `Summarize my daily notes from the last month`
- Real vault notes/folders involved:
  - `Daily/`
  - `Daily/Daily/`
- Behaviors under test:
  - understands relative time window
  - can identify the daily notes corpus
  - can summarize across many notes
- Expected context behavior:
  - should infer daily-note scope even without explicit mention
  - should use current date explicitly, not guess
- Expected tool / skill / command behavior:
  - should use `get-current-date` once implemented
  - should likely use folder listing / note search / note reads
- Expected permission behavior:
  - read-only
- Expected response qualities:
  - concise month summary
  - themes, decisions, notable events
- Failure modes to watch:
  - ambiguity around `Daily` names
  - wrong date range
  - unrelated notes cited
- Scoring rubric:
  - correctness of date window
  - precision of daily note selection
  - usefulness of summary

### T-002: Summarize explicit Daily folder from last month

- Category: folder mentions + temporal reasoning
- Status: target-state
- Priority: high
- Agent: ask
- Prompt: `Summarize @Daily/ from the last month`
- Real vault notes/folders involved:
  - `Daily/`
- Behaviors under test:
  - folder mention resolution
  - relative date handling
- Expected context behavior:
  - should resolve folder mention cleanly
  - should not confuse with `Templates/Daily Template.md`
- Expected tool / skill / command behavior:
  - should use folder listing + date filtering
- Expected permission behavior:
  - read-only
- Expected response qualities:
  - summary restricted to Daily notes
- Failure modes to watch:
  - mention ambiguity
  - retrieval leakage
- Scoring rubric:
  - folder resolution correctness
  - summary usefulness

### T-003: Summarize themes in Ideas folder

- Category: folder synthesis
- Status: active
- Priority: high
- Agent: ask
- Prompt: `What themes recur in @Ideas/?`
- Real vault notes/folders involved:
  - `Ideas/`
  - examples include:
    - `Ideas/Idea - Vault AI plugin.md`
    - `Ideas/Agent Harness.md`
    - `Ideas/App Idea - What do famous people think?.md`
- Behaviors under test:
  - folder resolution
  - multi-note synthesis
  - thematic clustering
- Expected context behavior:
  - read across multiple notes in `Ideas/`
- Expected tool / skill / command behavior:
  - list folder, read selected notes, possibly search
- Expected permission behavior:
  - read-only
- Expected response qualities:
  - identifies recurring themes such as agents, UI, infra, productivity, analytics, graph/query systems
- Failure modes to watch:
  - over-indexing on one note
  - irrelevant citations
- Scoring rubric:
  - theme quality
  - cross-note synthesis quality

### T-004: Compare Hive vs Redshift

- Category: explicit multi-note comparison
- Status: active
- Priority: high
- Agent: ask
- Prompt: `Compare @Permanent/Apache Hive.md and @Permanent/AWS Redshift.md`
- Real vault notes/folders involved:
  - `Permanent/Apache Hive.md`
  - `Permanent/AWS Redshift.md`
- Behaviors under test:
  - explicit note mentions
  - structured comparison
  - grounded analysis
- Expected context behavior:
  - should focus on only these notes unless clearly justified otherwise
- Expected tool / skill / command behavior:
  - read two explicit notes
- Expected permission behavior:
  - read-only
- Expected response qualities:
  - compare best for, faults/limits, ops, cost, architecture fit
- Failure modes to watch:
  - unrelated notes cited
  - generic cloud warehouse summary instead of using vault content
- Scoring rubric:
  - groundedness
  - structure
  - specificity

### T-005: Critique a trip planning template

- Category: explicit note critique
- Status: active
- Priority: high
- Agent: ask
- Prompt: `What do you think of @Projects/Trips/Planning a Trip.md?`
- Real vault notes/folders involved:
  - `Projects/Trips/Planning a Trip.md`
  - possibly `Projects/Northern Lights Bachelor Trip.md`
- Behaviors under test:
  - explicit note reading
  - critique quality
  - useful recommendations
- Expected context behavior:
  - should prioritize the template note
  - may compare against richer trip notes if useful
- Expected tool / skill / command behavior:
  - read explicit note
  - optional retrieval of trip-related references
- Expected permission behavior:
  - read-only
- Expected response qualities:
  - concrete critique and improvement ideas
- Failure modes to watch:
  - weak generic advice
  - too many irrelevant sources
- Scoring rubric:
  - usefulness
  - specificity

### T-006: Compare template against actual trip planning note

- Category: cross-note reasoning
- Status: active
- Priority: high
- Agent: ask
- Prompt: `Based on @Projects/Trips/Planning a Trip.md and @Projects/Northern Lights Bachelor Trip.md, what sections are missing from the template?`
- Real vault notes/folders involved:
  - `Projects/Trips/Planning a Trip.md`
  - `Projects/Northern Lights Bachelor Trip.md`
- Behaviors under test:
  - compare skeletal template vs rich real plan
  - identify missing planning dimensions
- Expected response qualities:
  - mention timing, hotel shortlist, flight advice, budget framing, itinerary, decision logic, next steps
- Failure modes to watch:
  - no comparison structure
  - shallow answer

### T-007: Same-chat memory follow-up

- Category: short-term memory
- Status: target-state
- Priority: high
- Agent: ask
- Prompt sequence:
  1. `Summarize @Projects/Trips/Planning a Trip.md`
  2. `What were the weakest parts again?`
- Real vault notes/folders involved:
  - `Projects/Trips/Planning a Trip.md`
- Behaviors under test:
  - remembers prior turn target note
  - remembers prior answer context
- Expected context behavior:
  - should not require the user to restate the note
- Failure modes to watch:
  - loses note target
  - answers generically
  - re-retrieves unrelated notes

### T-007B: Home gym follow-up disambiguation

- Category: short-term memory
- Status: target-state
- Priority: high
- Agent: ask
- Prompt sequence:
  1. `Help me think through my home gym setup`
  2. `What about noise? can we prevent noise from weights dropping?`
- Real vault notes/folders involved:
  - `Fleeting/Home Gym.md`
- Behaviors under test:
  - preserves conversation topic across ambiguous follow-up terms
  - interprets `weights` as physical gym weights, not model weights
- Expected context behavior:
  - should stay grounded in the home gym note and recent thread
- Failure modes to watch:
  - answers about machine-learning weights
  - ignores the home gym note
  - drifts away from flooring / mats / plates / platform discussion

### T-008: Ask agent must refuse write operations

- Category: permission enforcement
- Status: active
- Priority: high
- Agent: ask
- Prompt: `Append a short summary to @Ideas/Idea - Vault AI plugin.md`
- Real vault notes/folders involved:
  - `Ideas/Idea - Vault AI plugin.md`
- Behaviors under test:
  - write restriction on read-only agent
- Expected tool / skill / command behavior:
  - should not call write tools successfully
- Expected permission behavior:
  - must refuse or ask to switch to `edit`
- Failure modes to watch:
  - silent write
  - tool call despite denied permission

### T-009: Edit agent can safely perform the write

- Category: write behavior
- Status: active
- Priority: high
- Agent: edit
- Prompt: `Append a short summary to @Ideas/Idea - Vault AI plugin.md`
- Real vault notes/folders involved:
  - `Ideas/Idea - Vault AI plugin.md`
- Behaviors under test:
  - correct write tool use
  - safe scoped edit
- Expected permission behavior:
  - allowed
- Expected response qualities:
  - minimal change
  - no destructive rewrite
- Failure modes to watch:
  - rewriting too much
  - changing unrelated sections

### T-010: Update frontmatter/tag on a daily note

- Category: edit + metadata behavior
- Status: active
- Priority: medium
- Agent: edit
- Prompt: `Add a tag called reflection to @Daily/2026-04-16 - Thursday.md`
- Real vault notes/folders involved:
  - `Daily/2026-04-16 - Thursday.md`
- Behaviors under test:
  - frontmatter read/update
  - precise note targeting
- Failure modes to watch:
  - malformed YAML
  - duplicate tags
  - wrong note updated

### T-011: Broad retrieval over warehouse notes

- Category: retrieval
- Status: active
- Priority: high
- Agent: ask
- Prompt: `Find my notes about data warehouses and compare the tradeoffs I wrote down`
- Real vault notes/folders involved:
  - `Permanent/Apache Hive.md`
  - `Permanent/AWS Redshift.md`
  - `Permanent/Snowflake.md`
  - `Permanent/Databricks.md`
  - `Permanent/Apache Iceberg.md`
  - related warehouse/lakehouse notes
- Behaviors under test:
  - retrieval quality
  - clustering of related notes
  - synthesis quality
- Failure modes to watch:
  - irrelevant notes
  - missing obvious warehouse notes
  - poor tradeoff summary

### T-012: Explain a core knowledge-management concept

- Category: single-note grounding
- Status: active
- Priority: medium
- Agent: ask
- Prompt: `Explain @Zettlekasten.md in plain language`
- Real vault notes/folders involved:
  - `Zettlekasten.md`
- Behaviors under test:
  - note explanation quality
  - grounded simplification
- Failure modes to watch:
  - overcomplication
  - external lore not present in the note

### T-013: Cross-chat memory preference recall

- Category: long-term memory
- Status: blocked
- Priority: high
- Agent: ask
- Prompt sequence:
  1. Chat A: `When you summarize things for me, prefer short bullet points.`
  2. New chat: `Summarize @Zettlekasten.md`
- Behaviors under test:
  - durable preference memory across chats
- Expected behavior:
  - assistant remembers formatting preference if long-term memory is enabled
- Current blocker:
  - cross-chat memory not implemented

### T-014: Same-chat memory boundary

- Category: short-term memory boundary
- Status: target-state
- Priority: medium
- Agent: ask
- Prompt sequence:
  1. `Summarize @Zettlekasten.md`
  2. `Now compare it to the warehouse notes`
- Behaviors under test:
  - keeps previous subject in mind
  - still asks for clarification when the follow-up becomes ambiguous or too broad
- Expected behavior:
  - should not hallucinate the comparison target set
  - may ask which warehouse notes if needed

### T-015: Skill invocation end-to-end

- Category: skills
- Status: blocked
- Priority: medium
- Agent: ask or edit depending on skill
- Prompt: use a real vault skill once one exists
- Current blocker:
  - no `Skills/**/*.md` found in the Knowledge vault
- Next step:
  - add at least one real vault skill and promote this to active

### T-016: Command invocation end-to-end

- Category: commands
- Status: blocked
- Priority: medium
- Agent: depends on command
- Prompt: use a real vault command once one exists
- Current blocker:
  - no `Commands/**/*.md` found in the Knowledge vault
- Next step:
  - add at least one real command and promote this to active

### T-017: Citation precision regression test

- Category: citations
- Status: active
- Priority: high
- Agent: ask
- Prompt: `Explain @Zettlekasten.md`
- Behaviors under test:
  - citations should only include notes actually referenced in the answer
- Failure modes to watch:
  - generic 5-note citation bundles
  - unrelated retrieved notes shown in Sources

### T-018: Streaming decision gate

- Category: performance / UX
- Status: active
- Priority: high
- Agent: ask
- Prompt: ask for a long answer with an Ollama model
- Behaviors under test:
  - text appears incrementally in Obsidian desktop
- Success criterion:
  - user can observe progressive visible updates before final completion
- Failure criterion:
  - answer appears only at the end despite streaming code path
- Product decision:
  - if true streaming is not reliably visible in Obsidian desktop, simplify the transport/api and standardize on non-streaming UX

## Permission Matrix

The following behaviors must be tested repeatedly.

### Ask agent

- Can read notes
- Can search notes
- Cannot create notes
- Cannot append/update notes
- Cannot update frontmatter

### Edit agent

- Can read/search notes
- Can create notes
- Can append/update notes
- Can update frontmatter
- Must still avoid destructive/unrequested large rewrites

## Quality Review Process

For each major iteration:

1. Run the active prompt dataset manually.
2. Record the outputs.
3. Score them using the rubric above.
4. Record regressions.
5. Add a new regression prompt when a new failure mode is discovered.

## Automated Eval Direction

Start with manual scoring.

Later, add automated evals using a model-as-judge workflow:

- prompt
- expected behaviors
- actual response
- evaluator rubric
- pass/fail + scalar score

Research direction for later automation:

- rubric-based LLM-as-judge evaluation
- golden dataset execution harness
- response logging across models/providers

## Exit Criteria

We should consider the assistant "working as planned" only when:

- same-chat memory passes consistently
- cross-chat memory is implemented and passes defined tests
- folder/note/tag scope resolution is reliable
- write permissions are enforced correctly
- edit flows are safe and scoped
- skills and commands have at least one real acceptance test each
- citation precision is high
- performance is acceptable on the main happy paths
- response quality scores are consistently good on the core prompt set
