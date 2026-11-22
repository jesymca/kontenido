export default function AgenciaLoading() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl space-y-6 animate-pulse">
      <div className="h-32 bg-slate-900 border border-slate-800 rounded-3xl" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-48 bg-slate-900 border border-slate-800 rounded-3xl" />
        ))}
      </div>
    </div>
  );
}
