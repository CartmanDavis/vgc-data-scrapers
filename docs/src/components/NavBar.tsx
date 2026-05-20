import { NavLink } from 'react-router-dom';
import './NavBar.css';

export function NavBar() {
  return (
    <nav className="navbar" aria-label="Primary navigation">
      <NavLink to="/" end className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
        <i className="bi bi-bar-chart-fill" />
        <span>Metagame</span>
      </NavLink>
      <NavLink to="/pokemon" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
        <i className="bi bi-circle-fill" />
        <span>Pokemon</span>
      </NavLink>
      <NavLink to="/mega" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
        <i className="bi bi-gem" />
        <span>Mega</span>
      </NavLink>
    </nav>
  );
}
