# GitHub Actions Release Design

## Goal

Publish an install-ready `kiel-univis-courses.zip` asset to GitHub Releases automatically when a version tag like `v0.1.0` is pushed.

## Recommended Approach

Use a tag-triggered GitHub Actions workflow in the standalone plugin repository. The workflow should run the existing local verification commands, build the existing release zip, create a GitHub Release if one does not exist for the tag, and upload the zip as the release asset.

## Alternatives Considered

### 1. Tag-triggered release publishing

This is the selected approach. It matches the plugin’s existing release model, keeps the manual steps minimal, and ensures every published release asset is reproducible from CI.

### 2. Manual workflow dispatch

This would work, but it adds extra operator steps and allows tags and release assets to drift.

### 3. Workflow artifacts only

This is not sufficient for Athena’s install/update flow because Athena expects a GitHub Release asset URL, not a short-lived workflow artifact.

## Workflow Design

### Trigger

- `push.tags: ['v*']`

### Steps

1. Check out the repository.
2. Set up Node.
3. Run `npm test`.
4. Run `npm run build`.
5. Run `npm run package:release`.
6. Create the GitHub Release for the pushed tag if it does not already exist.
7. Upload `release/kiel-univis-courses.zip` as a release asset, replacing an existing asset with the same name.

## Permissions

The workflow needs `contents: write` so it can create releases and upload assets using `GITHUB_TOKEN`.

## Repo Hygiene

Ignore the local `release/` directory so package builds do not leave the repo dirty.

## Verification

- Local: `npm test`, `npm run build`, `npm run package:release`
- CI: push a `v*` tag and confirm the GitHub Release contains `kiel-univis-courses.zip`
