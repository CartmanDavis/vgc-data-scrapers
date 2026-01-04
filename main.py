import click
import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from utils.db import Database
from utils.config import Config
from utils.logging import setup_logging
from scrapers.limitless import LimitlessScraper
from scrapers.rk9 import RK9Scraper
from scrapers.processor import DataProcessor

logger = setup_logging()


@click.group()
@click.option('--config', type=click.Path(exists=True), help='Path to config file')
@click.pass_context
def cli(ctx, config):
    ctx.ensure_object(dict)
    # Convert Path object to string if needed
    config_path_str = str(config) if config else None
    ctx.obj['config'] = Config(config_path=config_path_str)


@cli.command()
@click.option('--format', 'format_filter', help='Format filter (e.g., gen9vgc2026regf)')
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
            tournaments=results.get("tournaments_scraped"),
            players=results.get("players_scraped"),
            teams=results.get("teams_scraped"),
            matches=results.get("matches_scraped")
        )
    else:
        logger.error("Scraping failed", error=results.get("error"))
        sys.exit(1)

    db.close()


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


@cli.command()
@click.option('--sql', help='Custom SQL query')
@click.option('--tournaments', is_flag=True, help='List tournaments')
@click.option('--players', is_flag=True, help='List players')
@click.option('--limit', type=int, default=10, help='Limit results')
@click.pass_context
def query(ctx, sql, tournaments, players, limit):
    config = ctx.obj['config']
    db = Database(config.db_path)

    if sql:
        cursor = db.conn.cursor()
        cursor.execute(sql)
        columns = [desc[0] for desc in cursor.description]
        rows = cursor.fetchall()

        if rows:
            print("\t".join(columns))
            for row in rows:
                print("\t".join(str(v) for v in row))
        else:
            print("No results")
    elif tournaments:
        cursor = db.conn.cursor()
        cursor.execute("SELECT id, name, date, location, generation, format, official FROM tournaments LIMIT ?", (limit,))
        columns = [desc[0] for desc in cursor.description]
        rows = cursor.fetchall()

        if rows:
            print("\t".join(columns))
            for row in rows:
                print("\t".join(str(v) for v in row))
        else:
            print("No tournaments found")
    elif players:
        cursor = db.conn.cursor()
        cursor.execute("SELECT id, name, country FROM players LIMIT ?", (limit,))
        columns = [desc[0] for desc in cursor.description]
        rows = cursor.fetchall()

        if rows:
            print("\t".join(columns))
            for row in rows:
                print("\t".join(str(v) for v in row))
        else:
            print("No players found")
    else:
        logger.error("Please specify --sql, --tournaments, or --players")
        sys.exit(1)

    db.close()


@cli.command()
@click.option('--format', type=click.Choice(['csv', 'json']), default='csv', help='Export format')
@click.option('--output', type=click.Path(), help='Output file path')
@click.argument('table')
@click.pass_context
def export(ctx, format, output, table):
    config = ctx.obj['config']
    db = Database(config.db_path)

    cursor = db.conn.cursor()
    cursor.execute(f"SELECT * FROM {table}")
    rows = cursor.fetchall()
    columns = [desc[0] for desc in cursor.description]

    if format == 'json':
        import json
        data = [dict(zip(columns, row)) for row in rows]

        if output:
            with open(output, 'w') as f:
                json.dump(data, f, indent=2)
            logger.info("Exported data", format=format, output=output, count=len(data))
        else:
            print(json.dumps(data, indent=2))
    else:
        import csv
        if output:
            with open(output, 'w', newline='') as f:
                writer = csv.writer(f)
                writer.writerow(columns)
                writer.writerows(rows)
            logger.info("Exported data", format=format, output=output, count=len(rows))
        else:
            print("\t".join(columns))
            for row in rows:
                print("\t".join(str(v) for v in row))

    db.close()


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
