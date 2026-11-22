export default function CuentaLoading() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl space-y-6 animate-pulse">
      <div className="h-40 bg-slate-900 border border-slate-800 rounded-3xl" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="h-24 bg-slate-900 border border-slate-800 rounded-2xl" />
        <div className="h-24 bg-slate-900 border border-slate-800 rounded-2xl" />
      </div>
      <div className="h-64 bg-slate-900 border border-slate-800 rounded-3xl" />
    </div>
  );
}
