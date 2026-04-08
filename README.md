# Kiel UnivIS Athena Plugin

Standalone Athena plugin for importing courses, schedules, and exam dates from Kiel UnivIS.

To use this plugin with Athena, copy the repository into Athena's plugin directory as
`plugins/kiel-univis-courses`.

## Development

- `npm test`
- `npm run build`

## Notes

This repo is intentionally Athena-first. It vendors only the plugin-side code needed to run and test the UnivIS import flow outside the Athena app repository.
