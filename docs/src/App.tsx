import './App.css'
import { Header } from './Header.tsx'
import { DataTable } from './DataTable.tsx'
import 'bootstrap-icons/font/bootstrap-icons.css' 

function App() {
  return (
    <>
      <Header/>
      <section id="csv-tables">
        <DataTable/>
      </section>
      <footer>
        <div className="footer-content">
          <div className="footer-left">
            <h2>Downloads</h2>
            <p>Files available to download. All files are available in the <a href="https://github.com/CartmanDavis/vgc-data-scrapers">Github repository</a></p>
            <ul>
              <li>
                <a href="https://github.com/CartmanDavis/vgc-data-scrapers/raw/refs/heads/main/db/vgc.db?download=" target="_blank">
                  <i className="bi bi-cloud-arrow-down"></i>
                  SQLite Database
                </a>
              </li>
            </ul>
          </div>
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
  )
}

export default App
