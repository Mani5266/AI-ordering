import Link from "next/link";

// TapOrder AI home — two doors: customer and staff.
export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#0A2463] px-6 py-10 text-center text-white">
      <div className="text-5xl">☕</div>
      <h1 className="mt-2 text-3xl font-bold tracking-wide">TapOrder AI</h1>
      <p className="mt-1 max-w-md text-blue-100">One QR. One kitchen. Speak or tap — same order.</p>

      <div className="mt-8 grid w-full max-w-2xl gap-4 md:grid-cols-2">
        <Link href="/table/7" className="rounded-3xl bg-white p-6 text-left text-gray-900 shadow-lg">
          <div className="text-3xl">🧑‍🍳</div>
          <div className="mt-2 text-xl font-bold text-[#0A2463]">I&apos;m a Customer</div>
          <p className="mt-1 text-sm text-gray-600">See the menu, call to order by voice, and watch your food live. (At the cafe, scan your table&apos;s QR instead.)</p>
          <div className="mt-3 inline-block rounded-full bg-[#0A2463] px-6 py-2 font-bold text-white">Start ordering →</div>
        </Link>
        <Link href="/kds" className="rounded-3xl border-2 border-white/40 bg-white/10 p-6 text-left text-white shadow-lg">
          <div className="text-3xl">👨‍🍳</div>
          <div className="mt-2 text-xl font-bold">I&apos;m Staff</div>
          <p className="mt-1 text-sm text-blue-100">Kitchen display: accept orders, update status, track the day. PIN required.</p>
          <div className="mt-3 inline-block rounded-full bg-white px-6 py-2 font-bold text-[#0A2463]">Open KDS →</div>
        </Link>
      </div>
    </main>
  );
}
