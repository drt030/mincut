import Link from "next/link";

export default function NotFound() {
  return (
    <main className="page">
      <section className="panel">
        <p className="eyebrow">Not found</p>
        <h1>Map not available</h1>
        <p>This map is not part of the public portfolio.</p>
        <Link href="/" className="button">
          Back to maps
        </Link>
      </section>
    </main>
  );
}
