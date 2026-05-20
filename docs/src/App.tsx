import { Routes, Route } from 'react-router-dom';
import './App.css';
import { Header } from './Header';
import { NavBar } from './components/NavBar';
import { MetagamePage } from './pages/MetagamePage';
import { PokemonPage } from './pages/PokemonPage';
import { MegaPage } from './pages/MegaPage';
import 'bootstrap-icons/font/bootstrap-icons.css';

function App() {
  return (
    <>
      <Header />
      <NavBar />
      <main>
        <Routes>
          <Route path="/" element={<MetagamePage />} />
          <Route path="/pokemon/:species" element={<PokemonPage />} />
          <Route path="/mega/:item" element={<MegaPage />} />
        </Routes>
      </main>
      <footer>
        <div className="footer-content">
          <div className="footer-right">
            <h2>Contribute</h2>
            <p>Want to contribute to the project, request a feature, or file a bug report?</p>
            <ul className="social-links">
              <li>
                <a href="https://github.com/CartmanDavis/vgc-data-scrapers" target="_blank">
                  <i className="bi bi-github"></i>
                  GitHub
                </a>
              </li>
              <li>
                <a href="https://x.com/CartmanCodes" target="_blank">
                  <i className="bi bi-twitter-x"></i>
                  X.com
                </a>
              </li>
              <li>
                <a href="https://bsky.app/profile/carter.dev" target="_blank">
                  <i className="bi bi-bluesky"></i>
                  Bluesky
                </a>
              </li>
            </ul>
          </div>
        </div>
        <div className="footer-bottom">
          <p>Developed by Carter Davis, 2026</p>
        </div>
      </footer>
    </>
  );
}

export default App;
