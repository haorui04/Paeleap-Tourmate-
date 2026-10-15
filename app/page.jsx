export default function Home() {
  return (
    <main className="container">
      <p className="eyebrow">PAELEAP · TOURISM AI</p>
      <h1>Backend starter ready</h1>
      <p>This page is reserved for your teammate's chat interface.</p>
      <p>API health: <a href="/api/status">/api/status</a></p>
      <p>Chat API: <code>POST /api/chat</code></p>
      <p className="note">The frontend should send the Supabase access token in the Authorization header when connected.</p>
    </main>
  );
}
