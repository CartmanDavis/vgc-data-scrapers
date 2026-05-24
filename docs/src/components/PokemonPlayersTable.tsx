import { Link } from "react-router-dom";
import type { PokemonPlayerRow } from "../mock-data";

function placingLabel(p: number): string {
  if (p === 1) return "1st";
  if (p === 2) return "2nd";
  if (p === 3) return "3rd";
  return `${p}th`;
}

function pct(v: number | undefined): string {
  if (v == null || isNaN(v)) return "—";
  return `${v.toFixed(1)}%`;
}

function wrColor(v: number): string {
  if (v >= 55) return "var(--green)";
  if (v >= 50) return "var(--text-h)";
  return "var(--red)";
}

export function PokemonPlayersTable({ players }: { players: PokemonPlayerRow[] }) {
  return (
    <table className="profile-table">
      <thead>
        <tr>
          <th>Player</th>
          <th className="right">Entries</th>
          <th className="right">Best</th>
          <th className="col-win-rate">Win Rate</th>
        </tr>
      </thead>
      <tbody>
        {players.length === 0 ? (
          <tr>
            <td colSpan={4} className="profile-no-data">
              No data available.
            </td>
          </tr>
        ) : (
          players.map((r, i) => (
            <tr key={i}>
              <td className="profile-table__name">
                <Link to={`/players/${r.player_id}`} className="cell-link">
                  <span style={{ marginRight: 6 }}>{r.flag}</span>
                  {r.player_name}
                </Link>
              </td>
              <td className="profile-table__num">{r.teams}</td>
              <td className="profile-table__num">
                <span
                  style={{
                    color: r.best_placing <= 3 ? "var(--accent-2)" : "var(--text-2)",
                  }}
                >
                  {placingLabel(r.best_placing)}
                </span>
              </td>
              <td className="col-win-rate" style={{ width: 180 }}>
                <span className="wr-text" style={{ color: wrColor(r.win_rate) }}>
                  {pct(r.win_rate)}
                </span>
              </td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}
