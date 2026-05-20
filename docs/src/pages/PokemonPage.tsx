import { useParams, Link } from 'react-router-dom';
import './ProfilePage.css';

export function PokemonPage() {
  const { species } = useParams<{ species: string }>();

  if (!species) {
    return (
      <div className="profile-page">
        <div className="profile-empty">No Pokemon selected.</div>
      </div>
    );
  }

  return (
    <div className="profile-page">
      <Link to="/" className="back-link">
        <i className="bi bi-arrow-left" /> Back to Metagame
      </Link>
      <h2 className="profile-title">{species}</h2>
      <p className="profile-placeholder">
        Pokemon profile coming in the next update — use the Metagame tab and search &ldquo;{species}&rdquo; in the Pokemon Detail view for now.
      </p>
    </div>
  );
}
