import { NavLink } from "react-router-dom";
import "./NavBar.css";

const PRIMARY_NAV = [
  { to: "/", end: true, icon: "bi-bar-chart-fill", label: "Metagame" },
  { to: "/pokemon", end: false, icon: "bi-circle-fill", label: "Pokemon" },
  { to: "/teams", end: false, icon: "bi-card-list", label: "Teams" },
  { to: "/tournaments", end: false, icon: "bi-trophy", label: "Tournaments" },
  { to: "/players", end: false, icon: "bi-people-fill", label: "Players" },
  { to: "/provenance", end: false, icon: "bi-signpost-split-fill", label: "Data Sources" },
];

export function NavBar() {
  return (
    <aside className="sidebar">
      <div className="sidebar__brand">
        <span className="sidebar__wordmark">VGC Stats</span>
        <span className="sidebar__sub">Mega Format · M-A</span>
      </div>

      <nav className="sidebar__nav" aria-label="Primary navigation">
        {PRIMARY_NAV.map(({ to, end, icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) => `nav-item${isActive ? " active" : ""}`}
          >
            <i className={`bi ${icon}`} aria-hidden="true" />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="sidebar__footer">
        <div className="sidebar__footer-heading">Connect</div>
        <a
          href="https://github.com/CartmanDavis/vgc-data-scrapers"
          target="_blank"
          rel="noopener noreferrer"
          className="sidebar__link"
        >
          <i className="bi bi-github" aria-hidden="true" />
          <span>GitHub</span>
        </a>
        <a
          href="https://x.com/CartmanCodes"
          target="_blank"
          rel="noopener noreferrer"
          className="sidebar__link"
        >
          <i className="bi bi-twitter-x" aria-hidden="true" />
          <span>X.com</span>
        </a>
        <a
          href="https://bsky.app/profile/carter.dev"
          target="_blank"
          rel="noopener noreferrer"
          className="sidebar__link"
        >
          <i className="bi bi-bluesky" aria-hidden="true" />
          <span>Bluesky</span>
        </a>
        <div className="sidebar__credit">
          Built by Carter Davis · 2026
          <br />
          Data via Limitless TCG
        </div>
      </div>
    </aside>
  );
}

export function MobileNav() {
  return (
    <nav className="mobile-nav" aria-label="Mobile navigation">
      {PRIMARY_NAV.map(({ to, end, icon, label }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            `mobile-nav__item${isActive ? " active" : ""}`
          }
        >
          <i className={`bi ${icon}`} aria-hidden="true" />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
