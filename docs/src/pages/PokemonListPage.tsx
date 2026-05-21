import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../supabase";
import { PokemonIcon } from "../components/PokemonIcon";
import "./ProfilePage.css";

interface PokemonRow {
  species: string;
  teams: number;
  usage_pct: number;
  win_rate: number;
}

function pct(v: number) {
  return `${v.toFixed(1)}%`;
}

function wrColor(v: number) {
  if (v >= 55) return "var(--green)";
  if (v >= 50) return "var(--text-h)";
  return "var(--red)";
}

const SKEL_WIDTHS = [
  62, 48, 71, 55, 80, 44, 66, 53, 75, 49, 68, 57, 73, 46, 60,
];

export function PokemonListPage() {
  const [rows, setRows] = useState<PokemonRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    setLoading(true);
    setError(null);
    supabase
      .rpc("get_pokemon_usage", {})
      .then(({ data, error: err }) => {
        if (err) throw new Error(err.message);
        setRows((data ?? []) as PokemonRow[]);
      })
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(
    () =>
      search
        ? rows.filter((r) =>
            r.species.toLowerCase().includes(search.toLowerCase()),
          )
        : rows,
    [rows, search],
  );

  return (
    <div className="list-page">
      <div className="list-page__header">
        <div>
          <h1 className="list-page__title">Pokemon</h1>
          <p className="list-page__subtitle">
            Usage statistics across all M-A tournaments
          </p>
        </div>
        {!loading && !error && (
          <input
            className="list-page__search"
            placeholder="Search Pokémon…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        )}
      </div>

      {error && <p className="list-page__error">{error}</p>}

      <table className="profile-table">
        <thead>
          <tr>
            <th style={{ width: 36 }}>#</th>
            <th>Pokémon</th>
            <th className="right">Usage %</th>
            <th className="right">Win Rate</th>
          </tr>
        </thead>
        <tbody>
          {loading
            ? SKEL_WIDTHS.map((w, i) => (
                <tr key={i} className="profile-skel-row" aria-hidden>
                  <td>
                    <div className="skel" style={{ width: 20, height: 13 }} />
                  </td>
                  <td>
                    <div
                      className="skel"
                      style={{ width: `${w}%`, height: 15 }}
                    />
                  </td>
                  <td>
                    <div
                      className="skel"
                      style={{ width: 46, height: 13, marginLeft: "auto" }}
                    />
                  </td>
                  <td>
                    <div
                      className="skel"
                      style={{ width: 46, height: 13, marginLeft: "auto" }}
                    />
                  </td>
                </tr>
              ))
            : filtered.map((r, i) => (
                <tr key={r.species}>
                  <td className="profile-table__num">{i + 1}</td>
                  <td className="profile-table__name">
                    <Link
                      to={`/pokemon/${encodeURIComponent(r.species)}`}
                      className="cell-link"
                      style={{ display: "flex", alignItems: "center", gap: 8 }}
                    >
                      <PokemonIcon species={r.species} size="medium" />
                      {r.species}
                    </Link>
                  </td>
                  <td className="profile-table__num">{pct(r.usage_pct)}</td>
                  <td
                    className="profile-table__num"
                    style={{ color: wrColor(r.win_rate) }}
                  >
                    {pct(r.win_rate)}
                  </td>
                </tr>
              ))}
        </tbody>
      </table>
    </div>
  );
}
