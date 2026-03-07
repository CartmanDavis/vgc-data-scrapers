import click
import sys
import os

sys.path.insert(0, os.path.abspath(os.path.dirname(__file__) + '/..'))

from scrapers.rk9 import RK9Scraper
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
@click.option('--url', required=True, help='RK9 tournament URL')
@click.option('--delay', type=float, help='Request delay in seconds')
@click.option('--since', type=str, help='Only scrape tournaments after this date (YYYY-MM-DD)')
@click.pass_context
def rk9(ctx, url, delay, since):
    config = ctx.obj['config']
    delay = delay or config.rk9_request_delay

    db = Database(config.db_path)
    scraper = RK9Scraper(db, request_delay=delay)

    logger.info("Starting RK9 scraper", url=url, since=since)

    results = scraper.scrape(url=url, since=since)

    if results.get("success"):
        if results.get("skipped"):
            logger.info("Tournament already exists", tournament_id=results.get("tournament_id"))
        else:
            logger.info("Scraping complete", tournament_id=results.get("tournament_id"))
    else:
        logger.error("Scraping failed", error=results.get("error"))
        sys.exit(1)

    db.close()


if __name__ == '__main__':
    cli()
