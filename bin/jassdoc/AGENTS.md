# Jassdoc tool

Use `./jassdoc.sh <symbol>` to retrieve Warcraft III API documentation.

When adding Warcraft III API declarations:

- Use `war3-types-strict` as the source of TypeScript signatures.
- Use this tool as the source of JSDoc.
- Preserve all Jassdoc information
- The tool may download `jass.db` automatically if it is missing. Ignore it.
