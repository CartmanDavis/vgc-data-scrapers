import click
import sys
import os

sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from database.db import Database
from common.config import Config
from common.logging import setup_logging

logger = setup_logging()


@click.group()
@click.option('--config', type=click.Path(exists=True), help='Path to config file')
@click.pass_context
def cli(ctx, config):
    ctx.ensure_object(dict)
    config_path_str = str(config) if config else None
    ctx.obj['config'] = Config(config_path=config_path_str)


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


if __name__ == '__main__':
    cli()
