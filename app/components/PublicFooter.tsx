export default function PublicFooter() {
  return (
    <footer className="publicFooter">
      <div>
        <a className="brand" href="/">
          <i>P</i> plated
        </a>
        <p>Made for the people behind the food.</p>
      </div>
      <nav aria-label="Footer">
        <a href="/how-it-works">How it works</a>
        <a href="/features">Features</a>
        <a href="/start">Get started</a>
      </nav>
      <small>© {new Date().getFullYear()} Plated</small>
    </footer>
  );
}
