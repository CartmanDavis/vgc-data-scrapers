# Limitless Scraper

## API Format Codes

When scraping VGC tournaments from Limitless, use these format codes:

| Format Code | Name                            | Notes |
| ----------- | ------------------------------- | ----- |
| `SVI`       | Scarlet & Violet - Regulation I |       |
| `SVH`       | Scarlet & Violet - Regulation H |       |
| `SVG`       | Scarlet & Violet - Regulation G |       |
| `SVF`       | Scarlet & Violet - Regulation F |       |
| `SVE`       | Scarlet & Violet - Regulation E |       |
| `VGC23`     | Scarlet & Violet - Regulation D |       |
| `23S3`      | Scarlet & Violet - Regulation C |       |
| `23S2`      | Scarlet & Violet - Regulation B |       |
| `23S1`      | Scarlet & Violet - Regulation A |       |
| `VGC22`     | VGC 2022 (Series 12)            |       |

## Usage

```bash
# Scrape all tournaments for a specific format
python -m scrapers.cli limitless --format SVH --all-pages

# Scrape since a specific date
python -m scrapers.cli limitless --since 2025-01-01 --all-pages

# Limit number of tournaments
python -m scrapers.cli limitless --limit 10

# Combine options
python -m scrapers.cli limitless --format SVH --since 2025-01-01 --all-pages
```

## Getting Format Codes

The format codes are available from the Limitless API:

```bash
curl -H "X-Access-Key: YOUR_API_KEY" https://play.limitlesstcg.com/api/games
```

Look for the `VGC` game entry to see all available formats.
