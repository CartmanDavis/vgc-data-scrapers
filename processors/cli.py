import click
import sys
import os

sys.path.insert(0, os.path.abspath(os.path.dirname(__file__) + '/..'))

from processors.processor import DataProcessor
from common.config import Config
from common.logging import setup_logging
from database.db import Database

logger = setup_logging()


@click.group()
@click.option('--config', type=click.Path(exists=True), help='Path to config file')
@click.pass_context
def cli(ctx, config):
    ctx.ensure_object(dict)
    config_path_str = str(config) if config else None
    ctx.obj['config'] = Config(config_path=config_path_str)


@cli.command()
@click.option('--source', type=click.Choice(['limitless', 'rk9']), default='limitless', help='Data source to process')
@click.option('--tournaments', help='Comma-separated list of tournament IDs to process')
@click.option('--force', is_flag=True, help='Re-process tournaments even if already processed')
@click.pass_context
def process(ctx, source, tournaments, force):
    config = ctx.obj['config']
    db = Database(config.db_path)
    processor = DataProcessor(db)

    tournament_ids = None
    if tournaments:
        tournament_ids = [t.strip() for t in tournaments.split(',')]

    logger.info("Starting data processor", source=source, tournament_count=len(tournament_ids) if tournament_ids else 'all', force=force)

    results = processor.process_tournaments(source=source, tournament_ids=tournament_ids, force=force)

    if results.get("success"):
        logger.info(
            "Processing complete",
            tournaments_processed=results.get("tournaments_processed"),
            players_added=results.get("players_added"),
            teams_added=results.get("teams_added"),
            pokemon_sets_added=results.get("pokemon_sets_added"),
            matches_added=results.get("matches_added"),
            tournament_standings_added=results.get("tournament_standings_added")
        )
        
        if results.get("errors"):
            logger.warning("Encountered errors", error_count=len(results["errors"]))
            for error in results["errors"][:5]:
                logger.error(error)
            if len(results["errors"]) > 5:
                logger.error(f"... and {len(results['errors']) - 5} more errors")
    else:
        logger.error("Processing failed", errors=results.get("errors"))
        sys.exit(1)

    db.close()


if __name__ == '__main__':
    cli()
