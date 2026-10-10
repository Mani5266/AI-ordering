import Link from "next/link";

// TapOrder AI home — diners arrive via their table QR (/t/:token -> /table/N);
// this page is the brand front door + staff entry.
export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#0A2463] px-6 text-center text-white">
      <div className="text-5xl">☕</div>
      <h1 className="mt-2 text-3xl font-bold tracking-wide">TapOrder AI</h1>
      <p className="mt-1 max-w-md text-blue-100">One QR. One kitchen. Speak or tap — same order. Everything else happens while you wait.</p>
      <div className="mt-6 max-w-md rounded-2xl bg-white p-4 text-sm font-medium text-gray-700">
        Dining with us? <b>Scan the QR on your table</b> — your menu and ordering open automatically. No app, no login.
      </div>
      <Link href="/kds" className="mt-6 rounded-full bg-white px-8 py-3 font-bold text-[#0A2463]">
        Staff — open kitchen display
      </Link>
    </main>
  );
}
