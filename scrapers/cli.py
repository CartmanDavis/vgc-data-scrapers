import click
import sys
import os

sys.path.insert(0, os.path.abspath(os.path.dirname(__file__) + '/..'))

from scrapers.limitless import LimitlessScraper
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
@click.option('--format', 'format_filter', help='Format filter (e.g., SVH, SVG, SVF, SVE, 23S3)')
@click.option('--limit', type=int, help='Maximum number of tournaments to scrape')
@click.option('--since', type=str, help='Only scrape tournaments after this date (YYYY-MM-DD)')
@click.option('--page', type=int, help='Page number for pagination (default: 1)')
@click.option('--all-pages', is_flag=True, help='Fetch all pages until no more results')
@click.option('--rate-limit', type=int, default=200, help='Rate limit in requests per minute (default: 200)')
@click.option('--api-key', help='Limitless API key (overrides config)')
@click.pass_context
def limitless(ctx, format_filter, limit, since, page, all_pages, rate_limit, api_key):
    config = ctx.obj['config']
    api_key = api_key or config.limitless_api_key

    if not api_key:
        logger.error("Limitless API key required. Set via --api-key, config file, or LIMITLESS_API_KEY env var")
        sys.exit(1)

    db = Database(config.db_path)
    scraper = LimitlessScraper(db, api_key, rate_limit)

    logger.info("Starting Limitless scraper", format=format_filter, limit=limit, since=since, page=page, all_pages=all_pages, rate_limit=rate_limit)

    kwargs = {}
    if format_filter:
        kwargs['format_filter'] = format_filter
    if limit:
        kwargs['limit'] = limit
    if since:
        kwargs['since'] = since
    if page:
        kwargs['page'] = page
    if all_pages:
        kwargs['all_pages'] = all_pages

    results = scraper.scrape(**kwargs)

    if results.get("success"):
        logger.info(
            "Scraping complete",
            tournaments_scraped=results.get("tournaments_scraped"),
            players=results.get("players_scraped"),
            teams=results.get("teams_scraped"),
            matches=results.get("matches_scraped")
        )
    else:
        logger.error("Scraping failed", error=results.get("error"))
        sys.exit(1)

    db.close()


if __name__ == '__main__':
    cli()
