
export function Header() {
  return (
    <section>
      <h1>Limitless VGC Usage Stats</h1>
      <div className="header-blurb">
        <p>
          Usage stats gathered using the <a href="https://play.limitlesstcg.com/">Limitless API</a>. Data is scraped from all tournament results and stored in a Supabase database, structured for metagame queries and insights.
        </p>
      </div>
    </section>
  );
}
