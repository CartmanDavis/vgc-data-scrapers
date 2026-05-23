import "./DataProvenancePage.css";

interface DataField {
  icon: string;
  label: string;
  detail: string;
}

interface Source {
  id: string;
  name: string;
  url: string;
  tagline: string;
  color: string;
  icon: string;
  fields: DataField[];
}

const SOURCES: Source[] = [
  {
    id: "limitless",
    name: "Limitless TCG",
    url: "https://play.limitlesstcg.com/",
    tagline: "Live tournament data via API",
    color: "cyan",
    icon: "bi-trophy-fill",
    fields: [
      {
        icon: "bi-calendar-event",
        label: "Tournament metadata",
        detail: "Name, date, format, attendance",
      },
      {
        icon: "bi-person-badge",
        label: "Player standings",
        detail: "Placements, win / loss / tie records",
      },
      {
        icon: "bi-grid-3x3-gap",
        label: "Team compositions",
        detail: "Open team sheet information: species, items, abilities, moves",
      },
      {
        icon: "bi-diagram-2",
        label: "Match pairings",
        detail: "Round-by-round head-to-head results",
      },
    ],
  },
  {
    id: "smogon",
    name: "Smogon",
    url: "https://www.smogon.com/",
    tagline: "Baseline Pokemon stats",
    color: "amber",
    icon: "bi-activity",
    fields: [
      {
        icon: "bi-bar-chart-steps",
        label: "Usage stats",
        detail:
          "Stat's usage data, how often each Pokemon runs various Natures and stat distributions",
      },
      {
        icon: "bi-lightning",
        label: "Base stats",
        detail:
          "Per-species stats (HP, Atk, Def, SpA, SpD, Spe) sourced from Showdown's codebase",
      },
    ],
  },
  {
    id: "pokemondb",
    name: "PokemonDB",
    url: "https://pokemondb.net/",
    tagline: "Sprites & assets",
    color: "purple",
    icon: "bi-image-fill",
    fields: [
      {
        icon: "bi-badge-cc",
        label: "Pokemon sprites",
        detail: "Species images used throughout the UI",
      },
      {
        icon: "bi-gem",
        label: "Item sprites",
        detail: "Mega stone and held-item images",
      },
    ],
  },
];

export function DataProvenancePage() {
  return (
    <div className="prov-page">
      <div className="prov-body">
        <div className="prov-hero">
          <div className="prov-hero__label">Data provenance</div>
          <h1 className="prov-hero__title">Where the data comes from</h1>
          <p className="prov-hero__sub">
            All tournament data is scraped programmatically from public APIs and
            stored in a database. Sprites and assets are served from Smogon's
            Pokémon Showdown CDN. Nothing is entered by hand.
          </p>
        </div>

        {/* ── Flow diagram ──────────────────────────────────────── */}
        <div className="prov-flow">
          {/* Column 1 — sources */}
          <div className="prov-col prov-col--sources">
            <div className="prov-col__label">Sources</div>
            {SOURCES.map((src) => (
              <a
                key={src.id}
                href={src.url}
                target="_blank"
                rel="noopener noreferrer"
                className={`prov-source prov-source--${src.color}`}
              >
                <div className="prov-source__top">
                  <i className={`bi ${src.icon} prov-source__icon`} />
                  <div>
                    <div className="prov-source__name">{src.name}</div>
                    <div className="prov-source__tag">{src.tagline}</div>
                  </div>
                  <i className="bi bi-arrow-up-right prov-source__ext" />
                </div>
              </a>
            ))}
          </div>

          {/* Column 2 — data fields */}
          <div className="prov-col prov-col--fields">
            <div className="prov-col__label">Data fields</div>
            {SOURCES.map((src) => (
              <div
                key={src.id}
                className={`prov-fields-group prov-fields-group--${src.color}`}
              >
                <div className="prov-fields-group__name">{src.name}</div>
                <div className="prov-fields-list">
                  {src.fields.map((f) => (
                    <div key={f.label} className="prov-field">
                      <i className={`bi ${f.icon} prov-field__icon`} />
                      <div>
                        <div className="prov-field__label">{f.label}</div>
                        <div className="prov-field__detail">{f.detail}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Pipeline steps ────────────────────────────────────── */}
        <div className="prov-section">
          <div className="prov-section__header">
            <div className="prov-section__title">Pipeline</div>
            <div className="prov-section__sub">How raw data becomes stats</div>
          </div>
          <div className="prov-pipeline">
            {[
              {
                icon: "bi-cloud-download",
                step: "01",
                title: "Scrape",
                desc: "Tournament details, standings, and pairings are fetched from the Limitless API and stored verbatim as raw JSON.",
              },
              {
                icon: "bi-gear-wide-connected",
                step: "02",
                title: "Process",
                desc: "Raw data is parsed and structured — resolving players, team compositions, and match outcomes into clean records.",
              },
              {
                icon: "bi-table",
                step: "03",
                title: "Store",
                desc: "Processed records land in the database. Each tournament, player, team, and match is linked and queryable.",
              },
              {
                icon: "bi-lightning-charge",
                step: "04",
                title: "Query",
                desc: "The site queries the database live to compute usage rates, win rates, and head-to-head stats on demand.",
              },
            ].map(({ icon, step, title, desc }) => (
              <div key={step} className="prov-pipeline__step">
                <div className="prov-pipeline__number">{step}</div>
                <div className="prov-pipeline__icon-wrap">
                  <i className={`bi ${icon}`} />
                </div>
                <div className="prov-pipeline__title">{title}</div>
                <div className="prov-pipeline__desc">{desc}</div>
              </div>
            ))}
          </div>
        </div>
        {/* ── Data quality note ─────────────────────────────────── */}
        <div className="prov-quality">
          <i className="bi bi-exclamation-circle prov-quality__icon" />
          <div>
            <div className="prov-quality__title">A note on data accuracy</div>
            <p className="prov-quality__body">
              Tournament data from Limitless is community-provided — players submit their own team
              sheets, and errors do occur. We validate incoming data and flag suspicious or
              inconsistent entries, but some inaccuracies may still make it through. If you spot
              something that looks wrong, it probably is.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
