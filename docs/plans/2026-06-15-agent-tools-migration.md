# Kiel UnivIS Agent Tools Migration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Migrate the Kiel UnivIS Athena plugin from the retired pull/push sync protocol to Athena's agent-tool plugin contract.

**Architecture:** The plugin exposes one tool, `import_kiel_univis_courses`, that fetches UnivIS data and returns a tool result with human-readable `content` plus structured `data`. The manifest advertises `agentTools`; Athena no longer calls direct content read/write sync methods.

**Tech Stack:** TypeScript, esbuild, Node test runner, Athena plugin manifest.

---

### Task 1: Runtime Contract

**Files:**
- Modify: `src/types/athena.ts`
- Modify: `src/index.ts`
- Modify: `src/fetcher.ts`
- Modify: `src/mapping/athena-map.ts`

**Steps:**
1. Replace pull/push result types with `PluginToolResult`, `PluginToolDefinition`, and `KielUnivisImportData`.
2. Change `src/index.ts` to export `tools: [{ name: 'import_kiel_univis_courses', ... }]`.
3. Keep saved config as defaults and allow tool input overrides for `language`, `semester`, and `requestPath`.
4. Return `{ content, data, warnings }` from the tool.

### Task 2: Manifest And Docs

**Files:**
- Modify: `manifest.json`
- Modify: `README.md`

**Steps:**
1. Change `capabilities` to `["agentTools"]`.
2. Remove retired `readContent` permission.
3. Update description copy to describe an agent-tool plugin.

### Task 3: Tests And Verification

**Files:**
- Modify: `tests/unit/compatibility.test.ts`
- Modify: `tests/unit/smoke.test.ts`
- Modify: `tests/unit/parser-regressions.test.ts`

**Steps:**
1. Replace `plugin.pull` and `plugin.push` assertions with `plugin.tools[0].execute`.
2. Assert tool `content`, structured `data`, manifest fields, request-path behavior, and input override behavior.
3. Run `npm test`.
4. Run `npm run build`.
5. Commit and push.
