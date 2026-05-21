import { useState, useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "../supabase";
import { MOCK_TOURNAMENTS } from "../mock-data";
import "./ProfilePage.css";
import { TeamIcons } from "../components/TeamIcons";

interface StandingRow {
  placing: number;
  player_id: string;
  player_name: string;
  country: string;
  flag: string;
  wins: number;
  losses: number;
  team: string[];
}

function medal(placing: number): string {
  if (placing === 1) return "🥇";
  if (placing === 2) return "🥈";
  if (placing === 3) return "🥉";
  return String(placing);
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

const SKEL_WIDTHS = [72, 58, 65, 80, 50, 68, 75, 55];

export function TournamentDetailPage() {
  const { id = "" } = useParams<{ id: string }>();
  const [rows, setRows] = useState<StandingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const meta = MOCK_TOURNAMENTS.find((t) => t.id === id);

  useEffect(() => {
    setLoading(true);
    setError(null);
    supabase
      .rpc("get_tournament_standings", { p_tournament_id: id })
      .then(({ data, error: err }) => {
        if (err) throw new Error(err.message);
        setRows((data ?? []) as StandingRow[]);
      })
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, [id]);

  return (
    <div className="list-page">
      <Link to="/tournaments" className="back-link">
        <i className="bi bi-chevron-left" /> Tournaments
      </Link>

      <div className="list-page__header">
        <div>
          <h1 className="list-page__title">
            {meta?.name ?? `Tournament ${id}`}
          </h1>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              marginTop: 8,
            }}
          >
            {meta && (
              <span
                style={{
                  fontFamily: "var(--font-data)",
                  fontSize: 12,
                  color: "var(--text-4)",
                }}
              >
                {formatDate(meta.date)}
              </span>
            )}
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                fontFamily: "var(--font-ui)",
                color: "var(--accent-2)",
                background: "var(--accent-bg)",
                border: "1px solid var(--accent-border)",
                borderRadius: 4,
                padding: "2px 7px",
                letterSpacing: "0.06em",
                textTransform: "uppercase",
              }}
            >
              M-A
            </span>
            {meta && (
              <span
                style={{
                  fontFamily: "var(--font-data)",
                  fontSize: 12,
                  color: "var(--text-3)",
                }}
              >
                {meta.attendees.toLocaleString()} players
              </span>
            )}
          </div>
        </div>
      </div>

      {error && <p className="list-page__error">{error}</p>}

      <table className="profile-table">
        <thead>
          <tr>
            <th style={{ width: 44 }}>Place</th>
            <th>Player</th>
            <th className="col-country">Country</th>
            <th className="right">Record</th>
            <th>Team</th>
          </tr>
        </thead>
        <tbody>
          {loading
            ? SKEL_WIDTHS.map((w, i) => (
                <tr key={i} className="profile-skel-row" aria-hidden>
                  <td>
                    <div className="skel" style={{ width: 24, height: 20 }} />
                  </td>
                  <td>
                    <div
                      className="skel"
                      style={{ width: `${w}%`, height: 15 }}
                    />
                  </td>
                  <td>
                    <div className="skel" style={{ width: 80, height: 13 }} />
                  </td>
                  <td>
                    <div
                      className="skel"
                      style={{ width: 40, height: 13, marginLeft: "auto" }}
                    />
                  </td>
                  <td>
                    <div
                      className="skel"
                      style={{ width: "85%", height: 13 }}
                    />
                  </td>
                </tr>
              ))
            : rows.map((r) => (
                <tr key={r.placing}>
                  <td
                    style={{
                      fontFamily: "var(--font-data)",
                      fontSize: 18,
                      textAlign: "center",
                      lineHeight: 1,
                    }}
                  >
                    {r.placing <= 3 ? (
                      medal(r.placing)
                    ) : (
                      <span
                        style={{
                          fontFamily: "var(--font-data)",
                          fontSize: 13,
                          color: "var(--text-3)",
                        }}
                      >
                        {r.placing}
                      </span>
                    )}
                  </td>
                  <td className="profile-table__name">
                    <Link to={`/players/${r.player_id}`} className="cell-link">
                      {r.player_name}
                    </Link>
                  </td>
                  <td className="col-country">
                    <span
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        fontSize: 13,
                        color: "var(--text-2)",
                      }}
                    >
                      <span style={{ fontSize: 16 }}>{r.flag}</span>
                      {r.country}
                    </span>
                  </td>
                  <td className="profile-table__num">
                    <span style={{ color: "var(--green)" }}>{r.wins}</span>
                    <span style={{ color: "var(--text-4)", margin: "0 2px" }}>
                      –
                    </span>
                    <span style={{ color: "var(--red)" }}>{r.losses}</span>
                  </td>
                  <td>
                    <TeamIcons team={r.team} pasteUrl="https://pokepast.es/6dbe083ec3d8afa2" />
                  </td>
                </tr>
              ))}
        </tbody>
      </table>
    </div>
  );
}
