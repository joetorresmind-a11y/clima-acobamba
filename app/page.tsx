export default function Home() {
  return (
    <main className="site-shell">
      <iframe
        className="app-frame"
        src="/app.html"
        title="AgroClima Local: cuaderno de campo"
        allow="geolocation"
      />
    </main>
  );
}
