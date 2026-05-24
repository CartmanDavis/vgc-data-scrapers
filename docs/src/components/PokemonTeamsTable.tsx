import { Link } from "react-router-dom";
import { TeamIcons } from "./TeamIcons";

interface TeamRow {
  player_id: string;
  player_name: string;
  tournament_id: string;
  tournament_name: string;
  date: string;
  placing: number;
  wins: number;
  losses: number;
  teammates: string[];
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function placingLabel(p: number): string {
  if (p === 1) return "1st";
  if (p === 2) return "2nd";
  if (p === 3) return "3rd";
  return `${p}th`;
}

export function PokemonTeamsTable({ rows }: { rows: TeamRow[] }) {
  return (
    <table className="profile-table profile-table--pokemon-teams">
      <thead>
        <tr>
          <th>Date</th>
          <th>Tournament</th>
          <th>Player</th>
          <th className="right">Place</th>
          <th className="right">Record</th>
          <th>Team</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>
            <td style={{ whiteSpace: "nowrap" }}>
              <span
                style={{
                  fontFamily: "var(--font-data)",
                  fontSize: 12,
                  color: "var(--text-4)",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {formatDate(r.date)}
              </span>
            </td>
            <td className="profile-table__name">
              <Link to={`/tournaments/${r.tournament_id}`} className="cell-link">
                {r.tournament_name}
              </Link>
            </td>
            <td className="profile-table__name">
              <Link to={`/players/${r.player_id}`} className="cell-link">
                {r.player_name}
              </Link>
            </td>
            <td className="profile-table__num">
              <span style={{ color: r.placing <= 3 ? "var(--accent-2)" : "var(--text-2)" }}>
                {placingLabel(r.placing)}
              </span>
            </td>
            <td className="profile-table__num">
              <span style={{ color: "var(--green)" }}>{r.wins}</span>
              <span style={{ color: "var(--text-4)", margin: "0 2px" }}>–</span>
              <span style={{ color: "var(--red)" }}>{r.losses}</span>
            </td>
            <td>
              <TeamIcons team={r.teammates} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
