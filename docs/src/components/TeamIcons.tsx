import { Link } from "react-router-dom";
import { PokemonIcon } from "./PokemonIcon";

interface TeamIconsProps {
  team: string[];
  pasteUrl: string;
}

export function TeamIcons({ team, pasteUrl }: TeamIconsProps) {
  return (
    <span style={{ display: "inline-flex", gap: 2, alignItems: "center" }}>
      {team.map((species) => (
        <Link
          key={species}
          to={`/pokemon/${encodeURIComponent(species)}`}
          onClick={(e) => e.stopPropagation()}
        >
          <PokemonIcon species={species} size="small" />
        </Link>
      ))}
      <a
        href={pasteUrl}
        target="_blank"
        rel="noreferrer"
        onClick={(e) => e.stopPropagation()}
        style={{ marginLeft: 4, color: "var(--text-4)", lineHeight: 1 }}
        title="View Pokepaste"
      >
        <i className="bi bi-box-arrow-up-right" style={{ fontSize: 11 }} />
      </a>
    </span>
  );
}
