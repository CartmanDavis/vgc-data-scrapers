import { useParams, Link } from 'react-router-dom';
import './ProfilePage.css';

export function MegaPage() {
  const { item } = useParams<{ item: string }>();

  if (!item) {
    return (
      <div className="profile-page">
        <div className="profile-empty">No mega item selected.</div>
      </div>
    );
  }

  return (
    <div className="profile-page">
      <Link to="/" className="back-link">
        <i className="bi bi-arrow-left" /> Back to Metagame
      </Link>
      <h2 className="profile-title">{item}</h2>
      <p className="profile-placeholder">
        Mega item profile coming in the next update — use the Metagame tab and select &ldquo;{item}&rdquo; in the Teammates view for now.
      </p>
    </div>
  );
}
