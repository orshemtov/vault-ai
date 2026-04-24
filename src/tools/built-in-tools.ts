import type { ToolDefinition } from "./tool-types";

export const BUILT_IN_TOOLS: ToolDefinition[] = [
  {
    id: "get-current-date",
    name: "Get Current Date",
    description: "Read the current local date, time, and timezone.",
    family: "time",
    noteAction: null,
    requiresApproval: false,
    source: "built-in"
  },
  {
    id: "list-memories",
    name: "List Memories",
    description: "List saved long-term memory entries.",
    family: "memory",
    noteAction: null,
    requiresApproval: false,
    source: "built-in"
  },
  {
    id: "save-memory",
    name: "Save Memory",
    description: "Save a long-term memory entry.",
    family: "memory",
    noteAction: null,
    requiresApproval: false,
    source: "built-in"
  },
  {
    id: "update-memory",
    name: "Update Memory",
    description: "Update an existing long-term memory entry.",
    family: "memory",
    noteAction: null,
    requiresApproval: false,
    source: "built-in"
  },
  {
    id: "delete-memory",
    name: "Delete Memory",
    description: "Delete an existing long-term memory entry.",
    family: "memory",
    noteAction: null,
    requiresApproval: true,
    source: "built-in"
  },
  {
    id: "get-active-note",
    name: "Get Active Note",
    description: "Read the active note in the current workspace.",
    family: "active-note",
    noteAction: "read",
    requiresApproval: false,
    source: "built-in"
  },
  {
    id: "get-selection",
    name: "Get Selection",
    description: "Read the current editor selection.",
    family: "selection",
    noteAction: "read",
    requiresApproval: false,
    source: "built-in"
  },
  {
    id: "read-note",
    name: "Read Note",
    description: "Read a note by path.",
    family: "note-read",
    noteAction: "read",
    requiresApproval: false,
    source: "built-in"
  },
  {
    id: "search-notes",
    name: "Search Notes",
    description: "Search notes in the vault.",
    family: "note-read",
    noteAction: "search",
    requiresApproval: false,
    source: "built-in"
  },
  {
    id: "list-notes-in-folder",
    name: "List Notes In Folder",
    description: "List notes inside a folder.",
    family: "note-read",
    noteAction: "search",
    requiresApproval: false,
    source: "built-in"
  },
  {
    id: "create-note",
    name: "Create Note",
    description: "Create a new note.",
    family: "note-write",
    noteAction: "create",
    requiresApproval: false,
    source: "built-in"
  },
  {
    id: "append-note",
    name: "Append Note",
    description: "Append content to an existing note.",
    family: "note-write",
    noteAction: "edit",
    requiresApproval: false,
    source: "built-in"
  },
  {
    id: "update-note",
    name: "Update Note",
    description: "Replace or rewrite note content.",
    family: "note-write",
    noteAction: "edit",
    requiresApproval: false,
    source: "built-in"
  },
  {
    id: "read-frontmatter",
    name: "Read Frontmatter",
    description: "Inspect note frontmatter.",
    family: "frontmatter",
    noteAction: "read",
    requiresApproval: false,
    source: "built-in"
  },
  {
    id: "update-frontmatter",
    name: "Update Frontmatter",
    description: "Update note frontmatter fields.",
    family: "frontmatter",
    noteAction: "edit",
    requiresApproval: false,
    source: "built-in"
  }
];
