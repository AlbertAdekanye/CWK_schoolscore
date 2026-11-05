import Link from "next/link";

export default function Home() {
  return (
    <main className="landing">
      <nav className="topbar">
        <div className="brand"><span className="brand-mark">S</span> SchoolScore</div>
        <Link className="button button-light" href="/login">Sign in</Link>
      </nav>

      <section className="hero">
        <div className="eyebrow">STUDENT ASSESSMENT MANAGEMENT</div>
        <h1>Spend less time calculating.<br /><span>More time teaching.</span></h1>
        <p>Manage classes, students, assessments and results from one simple workspace.</p>
        <Link className="button button-primary" href="/login">Get started <span aria-hidden>→</span></Link>
      </section>

      <section className="feature-grid">
        <article className="feature-card"><div className="feature-icon">01</div><h3>Organise your classes</h3><p>Keep JSS1, JSS2 and JSS3 sections and student lists in order.</p></article>
        <article className="feature-card"><div className="feature-icon">02</div><h3>Record scores quickly</h3><p>Enter test, assignment, classwork and examination marks.</p></article>
        <article className="feature-card"><div className="feature-icon">03</div><h3>Get results automatically</h3><p>Calculate totals, grades and class performance without manual arithmetic.</p></article>
      </section>
      <footer>SchoolScore · Built for simpler school record keeping</footer>
    </main>
  );
}
