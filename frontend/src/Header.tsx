
export function Header() {
  return (<section>
        <h1>Limitless VGC Usage Stats</h1>
        <div className="header-blurb">
          <p>
	    Usage stats gathered using the <a href="https://play.limitlesstcg.com/">Limitless API</a>. Data is scraped from all tournament results and put into an SQLite database.
The database is structured in such a way that it's easier to query and gain insights on the current metagame.
          </p>
        </div>
      </section>)
}
