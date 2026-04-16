# GitHub Actions Release Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a tag-triggered GitHub Actions release workflow that publishes the standalone plugin zip to GitHub Releases.

**Architecture:** Keep the existing local `package:release` command as the single source of packaging truth. Add one workflow that runs tests, build, packaging, then creates or updates the matching GitHub Release asset for the pushed tag.

**Tech Stack:** GitHub Actions, Node.js, npm scripts

---

### Task 1: Add repo hygiene for local release builds

**Files:**
- Create: `.gitignore`

**Step 1: Add `release/` to `.gitignore`**

**Step 2: Verify local status no longer shows `release/`**

Run: `git status --short`

Expected: no untracked `release/` directory.

### Task 2: Add release publishing workflow

**Files:**
- Create: `.github/workflows/release.yml`

**Step 1: Add a workflow triggered by `v*` tags**

Include:
- checkout
- setup-node
- `npm test`
- `npm run build`
- `npm run package:release`
- create release if missing
- upload `release/kiel-univis-courses.zip`

**Step 2: Verify workflow syntax by inspection**

Check that:
- `permissions.contents` is `write`
- tag trigger is `v*`
- uploaded asset path is `release/kiel-univis-courses.zip`

### Task 3: Re-run local verification

**Files:**
- None

**Step 1: Run tests**

Run: `npm test`

Expected: PASS

**Step 2: Run build**

Run: `npm run build`

Expected: PASS

**Step 3: Run release packaging**

Run: `npm run package:release`

Expected: PASS and generate `release/kiel-univis-courses.zip`

### Task 4: Commit and push workflow changes

**Files:**
- Commit the workflow, docs, and `.gitignore`

**Step 1: Commit**

**Step 2: Push `main`**

**Step 3: Push a new `v*` tag later to validate the workflow end-to-end**
