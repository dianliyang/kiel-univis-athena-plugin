# Kiel UnivIS Courses MCP Server

MCP server for retrieving course, schedule, and exam information from Kiel UnivIS.
It is read-only: tools return course information for review and do not import or mutate Athena data.

## Tools

- `list_kiel_univis_courses`: retrieve the Kiel UnivIS course list for a semester.
- `search_kiel_univis_courses`: retrieve the course list and filter it by title, code, instructor, topic, language, or category.

Both tools accept optional `language`, `semester`, and `requestPath` arguments. The UnivIS host stays fixed to `univis.uni-kiel.de`.

## Development

- `npm test`
- `npm run build`
- `npm run package:release`

## Local MCP Usage

Build the server, then point an MCP client at `dist/mcp.mjs`:

```json
{
  "command": "node",
  "args": ["/absolute/path/to/kiel-univis-athena-plugin/dist/mcp.mjs"]
}
```

Athena can also override its local Kiel MCP path with `ATHENA_KIEL_UNIVIS_MCP_PATH`.

## Release Packaging

Run `npm run package:release` to build two GitHub Release assets:

- `release/kiel-univis-courses.zip`: installable Athena plugin package with `manifest.json` and `index.mjs`.
- `release/kiel-univis-mcp.zip`: standalone MCP server package with `mcp.mjs`, `package.json`, and this README.
