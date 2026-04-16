# Kiel UnivIS Athena Plugin

Standalone Athena plugin for importing courses, schedules, and exam dates from Kiel UnivIS.

To use this plugin with Athena, copy the repository into Athena's plugin directory as
`plugins/kiel-univis-courses`.

## Development

- `npm test`
- `npm run build`
- `npm run package:release`

## Notes

This repo is intentionally Athena-first. It vendors only the plugin-side code needed to run and test the UnivIS import flow outside the Athena app repository.

## Release Packaging

Run `npm run package:release` to build an install-ready `release/kiel-univis-courses.zip`
archive for GitHub Releases. The archive contains a single `kiel-univis-courses/`
plugin root with `manifest.json` and the runtime `.mjs` files Athena expects.
