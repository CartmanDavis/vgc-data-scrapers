# TypeScript Migration

This document outlines the planned migration from Python to TypeScript to leverage the rich ecosystem of Pokemon-related TypeScript libraries and tools.

> **Status**: Not yet started. The Python codebase was recently reorganized into `cli/` subdirectories.

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
| `lxml` | `lxml` (or `fast-xml-parser`) |

### Project Structure
```
Current Python                          TypeScript (planned)
───────────────────────────────────────────────────────────────────────
common/config.py                    →   src/common/config.ts
common/api.py                       →   src/common/api.ts
common/logging.py                   →   src/common/logging.ts
cli/database/db.py                 →   src/database/db.ts
cli/scrapers/base.py               →   src/scrapers/base.ts
cli/scrapers/limitless.py          →   src/scrapers/limitless.ts
cli/scrapers/rk9.py                →   src/scrapers/rk9.ts
cli/scrapers/cli.py                →   src/cli/scrapers.ts
cli/processors/processor.py        →   src/processors/processor.ts
cli/processors/cli.py               →   src/cli/process.ts
cli/database/cli.py                →   src/cli/query.ts
cli/analyze_teams.py               →   src/cli/analyze-teams.ts
cli/combined_paste.py              →   src/cli/combined-paste.ts
cli/create_and_upload.py           →   src/cli/create-upload.ts
cli/find_best_duo.py                →   src/cli/find-best-duo.ts
cli/player_tournament_report.py    →   src/cli/player-tournament-report.ts
cli/upload.py                       →   src/cli/upload.ts
cli/visualization/visualizations.py →  src/cli/visualizations.ts
```

## Migration Steps (Not Yet Executed)

1. Create `package.json` with TypeScript and tooling dependencies
2. Create `tsconfig.json` with strict TypeScript configuration
3. Migrate all Python modules to TypeScript
4. Create CLI entry points using `commander`
5. Maintain database schema compatibility
6. Update `README.md` with TypeScript commands

## Getting Started (Current Python)

```bash
# Install dependencies
pip install -r requirements.txt

# Run commands
python -m cli.scrapers.limitless --format gen9vgc2026regf --limit 50
python -m cli.scrapers.rk9 --url "https://rk9.gg/tournament/example/"
python -m cli.processors.cli --source limitless
python -m cli.database.cli --tournaments --limit 10
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
