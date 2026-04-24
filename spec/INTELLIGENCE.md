# INTELLIGENCE

## Goal

Learn from successful adjacent vault AI projects so we can copy what works, avoid common mistakes, and design a plugin that feels native, safe, and genuinely useful.

## Projects Reviewed

### VS Code Copilot Chat

What it does well:

- Separates main chat, inline work, context adding, and debug/inspection
- Keeps session configuration compact
- Treats permissions and approvals as first-class UX
- Makes context additive and intentional instead of constantly expanded
- Strong session and agent mental model

Weaknesses:

- Many interaction patterns assume an IDE and codebase workflow
- Tooling and context types are richer than most Obsidian writing workflows need
- Some complexity is acceptable in VS Code but would feel heavy in an Obsidian sidebar

What we should learn:

- Main chat must stay simple
- Context, activity, and debug should be secondary surfaces
- Permission levels should be explicit and understandable
- The user should not need to parse raw internal state to use the assistant

### OpenChamber / OpenCode Desktop GUI

What it does well:

- Rich desktop AI workflow with strong separation of surfaces
- Exposes tool activity, diffs, sessions, and context without letting one view carry everything
- Strong session model and action visibility
- Keeps the main chat usable even when the product is feature-rich

Weaknesses:

- Strongly oriented toward coding workflows, diffs, terminals, and Git
- Richness can become overwhelming if copied directly into a note assistant
- Some desktop concepts are broader than what Obsidian users need in the default flow

What we should learn:

- Capability richness is fine if distributed across dedicated surfaces
- Activity and inspection should exist, but not dominate the main thread
- Tool use should feel chronological and explainable

### Smart Connections

What it does well:

- Strong Obsidian-native retrieval experience
- Local-first and private-by-default positioning
- Retrieval feels like note discovery, not generic LLM chat
- Good note/snippet-based explanation model

Weaknesses:

- Retrieval and indexing complexity grows with vault scale
- Semantic systems require strong inspection to remain trustworthy
- Retrieval alone is not a full assistant product

What we should learn:

- Retrieval should feel like note work, not model debugging
- Users need to inspect which notes were used and why
- Local-first defaults are a meaningful differentiator

### Claudian

Repo: `YishenTu/claudian`

What it does well:

- Strong "agent inside your vault" mental model
- Right-sidebar assistant UX feels natural in Obsidian
- Supports planning before action
- Good multi-provider direction
- Clear tool and workflow framing
- Good inline edit ergonomics

Weaknesses:

- Very broad scope
- Can feel more like a coding agent than a knowledge-work assistant
- Powerful systems need very clear permission boundaries
- Desktop-only limitations are acceptable, but should be explicit

What we should learn:

- The assistant should live in the right sidebar
- The vault should be treated as a workspace with explicit boundaries
- Planning and execution should be separate concepts
- Edits should be previewed before apply

### Text Generator

Repo: `nhaouari/obsidian-textgenerator-plugin`

What it does well:

- Large adoption and clear product-market fit
- Useful templates and reusable prompt workflows
- Strong flexibility
- Good fit for writing and note transformation

Weaknesses:

- Flexibility can become overwhelming
- Too many prompt-centric options can reduce clarity
- Less emphasis on agent safety and action boundaries

What we should learn:

- Reusable skills/templates are valuable
- Context injection matters a lot
- Good defaults are more important than maximum configurability

### Continue / Cursor / Cline / Windsurf

What they do well:

- Keep the composer and thread as the dominant interaction model
- Make actions and tool activity visible without drowning the main UX
- Strong permission and execution-state mental models
- Good use of compact controls and progressive disclosure

Weaknesses:

- Many assumptions come from software engineering workflows rather than note-taking
- Some products depend on very large editors or multi-pane coding layouts
- Action-rich coding assistants can feel too operational for reflective note workflows

What we should learn:

- The composer should be a strong primary surface
- Actions should be visible, chronological, and compact
- The default UI should stay calm even if the backend is complex

### Smart Second Brain

Repo: `your-papa/obsidian-Smart2Brain`

What it does well:

- Strong "chat with your notes" proposition
- Privacy-conscious positioning
- Local model support
- RAG and note citation mindset
- Better-than-average UX emphasis

Weaknesses:

- Retrieval quality depends heavily on vault quality
- Embeddings/indexing add complexity
- Semantic systems can become opaque if users cannot inspect context

What we should learn:

- Semantic retrieval should be core
- Local models matter
- Answers should cite notes
- Retrieval must remain inspectable and understandable

### Obsidian GitHub Copilot

Repo: `Pierrad/obsidian-github-copilot`

What it does well:

- Familiar assistant paradigm
- Sidebar UX is strong
- Inline note interactions are natural
- Note references and Mermaid support improve usefulness

Weaknesses:

- Service-specific integrations can limit long-term flexibility
- Inline interactions can be fragile
- Capability assumptions can leak from the provider into the product

What we should learn:

- Sidebar plus inline actions is a strong combo
- Provider abstraction is important
- Note references should be first-class

### Obsidian MCP Plugin

Repo: `aaronsb/obsidian-mcp-plugin`

What it does well:

- Strong tool boundary thinking
- Good security framing
- Clear capability grouping
- Treats the vault as a structured system, not just files

Weaknesses:

- More infrastructure-focused than assistant-focused
- Requires users to understand tool configuration
- Slightly lower-level than what our target user wants

What we should learn:

- Tool access needs explicit permissions
- MCP support is valuable, but should not dominate the product
- The product should expose tools in a user-friendly way

## Market Conclusions

The strongest open-source vault AI projects usually do one or two of these well:

- chat with notes
- text generation/editing
- retrieval
- provider integration
- tool connectivity
- agent workflows

Very few combine all of these cleanly:

- note-aware assistant UX
- semantic retrieval
- safe editing
- scheduled automation
- provider/model switching
- local model support
- vault-native skills
- tool/MCP extensibility
- explicit security boundaries

That is our opportunity.

Successful copilots also consistently separate these concerns:

- main conversation
- context attachment
- action or review flow
- diagnostics and inspection

That separation is currently missing in our implementation and should become a design priority.

## Product Direction

We should build an Obsidian-native AI assistant that is:

- assistant-first, not prompt-first
- semantic, not just keyword-based
- safe by default
- explicit about context and permissions
- provider-agnostic
- local-model friendly
- extensible through vault-managed skills and tools
- simple in the main flow, inspectable in secondary flows

## Product Risks

The biggest risks are:

- retrieval complexity
- permission ambiguity
- too much UI complexity
- scheduled automation becoming surprising
- provider capability differences leaking into UX
- exposing internal state too early in the product surface

## Design Responses

To reduce those risks:

- require clear context selection
- show citations and previews
- make edits approval-based by default
- keep scheduled tasks policy-driven
- expose provider/model capabilities explicitly
- keep skills human-readable and vault-native
- keep the main chat surface compact and move debug-heavy information into secondary panels
- make context, sources, and activity inspectable without making them always visible

## Anti-Goals

We are not trying to build:

- a generic chatbot pasted into Obsidian
- an unrestricted autonomous agent
- a cloud backend product
- a coding-agent clone with notes bolted on
- a mandatory complex backend service architecture
- a debug console disguised as a sidebar assistant
