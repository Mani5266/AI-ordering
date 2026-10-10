import Customer from "@/components/Customer";

// Per-table page (e.g. /table/7). Session comes from the scan cookie,
// or auto-provisioned by the Customer component in demo mode.
export default function TablePage({ params }: { params: { n: string } }) {
  const table = Number(params.n);
  if (!Number.isInteger(table) || table < 1 || table > 10)
    return (
      <main className="p-8 text-center">
        <h1 className="text-xl font-bold">TapOrder AI</h1>
        <p className="mt-4">Unknown table — please scan your table&apos;s QR.</p>
      </main>
    );
  return <Customer table={table} />;
}
