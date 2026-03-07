# TypeScript Migration

This repository has been migrated from Python to TypeScript to leverage the rich ecosystem of Pokemon-related TypeScript libraries and tools.

## What Changed

### Language & Core
- Python 3.9+ → TypeScript 5.3+
- Type hints → Native TypeScript types

### Dependencies
| Python | TypeScript |
|--------|------------|
| `requests` | `axios` |
| `click` | `commander` |
| `structlog` | `pino` + `pino-pretty` |
| `beautifulsoup4` | `cheerio` |
| `sqlite3` | `better-sqlite3` |

### Project Structure
```
Python                          TypeScript
────────────────────────────────────────────────
common/config.py           →   src/common/config.ts
common/api.py               →   src/common/api.ts
common/logging.py           →   src/common/logging.ts
database/db.py             →   src/database/db.ts
scrapers/base.py           →   src/scrapers/base.ts
scrapers/limitless.py      →   src/scrapers/limitless.ts
scrapers/rk9.py            →   src/scrapers/rk9.ts
processors/processor.py    →   src/processors/processor.ts
scrapers/cli.py            →   src/cli/limitless.ts
scrapers/rk9_cli.py        →   src/cli/rk9.ts
processors/cli.py          →   src/cli/process.ts
database/cli.py            →   src/cli/query.ts
```

## Migration Process

1. Created `package.json` with TypeScript and tooling dependencies
2. Created `tsconfig.json` with strict TypeScript configuration
3. Migrated all Python modules to TypeScript
4. Created CLI entry points using `commander`
5. Updated `README.md` with TypeScript commands
6. Maintained database schema compatibility

## Getting Started with TypeScript

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Run commands
npm run limitless -- --format gen9vgc2026regf --limit 50
npm run rk9 -- --url "https://rk9.gg/tournament/example/"
npm run process -- --source limitless
npm run query -- --tournaments --limit 10
```

## Benefits of TypeScript Migration

1. **Type Safety**: Catch errors at compile-time rather than runtime
2. **Better IDE Support**: Enhanced autocomplete and refactoring tools
3. **Ecosystem Access**: Leverage existing Pokemon TypeScript libraries (e.g., Showdown data, Pokemon sets)
4. **Modern JavaScript**: Access to latest JavaScript features
5. **Community**: Larger TypeScript community for web-related tools

## Database Compatibility

The database schema remains unchanged, so existing `db/vgc.db` files will continue to work with the TypeScript version.

## Future Enhancements

With TypeScript, we can now:
- Integrate Pokemon Showdown TypeScript libraries for battle data
- Use TypeScript-based Pokemon set generation tools
- Build web dashboards with Next.js/React
- Create type-safe APIs for data sharing
