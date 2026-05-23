import { Link } from "react-router-dom";
import { PokemonIcon } from "./PokemonIcon";
import "./TeamIcons.css";

export interface PokemonSlot {
  species:  string;
  item:     string;
  moves:    string[];
  invalid?: boolean;
}

interface TeamIconsProps {
  team:    string[];
  roster?: PokemonSlot[];
}

function buildPasteText(roster: PokemonSlot[]): string {
  return roster.map((p) => {
    const header = p.item ? `${p.species} @ ${p.item}` : p.species;
    const moves = p.moves.map((m) => `- ${m}`).join("\n");
    return moves ? `${header}\n${moves}` : header;
  }).join("\n\n");
}

function openPaste(roster: PokemonSlot[]) {
  const paste = buildPasteText(roster).replace(/\n/g, "\r\n");
  const form = document.createElement("form");
  form.method = "POST";
  form.action = "https://pokepast.es/create";
  form.target = "_blank";
  form.style.display = "none";
  form.enctype = "application/x-www-form-urlencoded";

  const field = document.createElement("input");
  field.type = "hidden";
  field.name = "paste";
  field.value = paste;
  form.appendChild(field);

  document.body.appendChild(form);
  form.submit();
  document.body.removeChild(form);
}

export function TeamIcons({ team, roster }: TeamIconsProps) {
  const hasInvalid = roster?.some((s) => s.invalid) || team.length < 6;

  return (
    <span className="team-icons">
      {team.map((species) => (
        <Link
          key={species}
          to={`/pokemon/${encodeURIComponent(species)}`}
          onClick={(e) => e.stopPropagation()}
        >
          <PokemonIcon species={species} size="small" />
        </Link>
      ))}
      {roster && roster.length > 0 && (
        <button
          onClick={(e) => { e.stopPropagation(); openPaste(roster); }}
          style={{
            marginLeft: 4, background: "none", border: "none",
            padding: 0, cursor: "pointer", color: "var(--text-4)", lineHeight: 1,
          }}
          title="View Pokepaste"
        >
          <i className="bi bi-box-arrow-up-right" style={{ fontSize: 11 }} />
        </button>
      )}
      {hasInvalid && (
        <span className="team-invalid-badge" onClick={(e) => e.stopPropagation()}>
          <i className="bi bi-exclamation-circle" />
          <span className="team-invalid-tooltip">
            This team could not be fully validated — some data may be inaccurate.
            <br />
            <Link to="/provenance" onClick={(e) => e.stopPropagation()}>
              Learn about our data sources
            </Link>
          </span>
        </span>
      )}
    </span>
  );
}
