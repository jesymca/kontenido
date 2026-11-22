export default function AdminLoading() {
  return (
    <div className="space-y-6 max-w-6xl animate-pulse">
      <div className="space-y-2">
        <div className="h-8 w-72 bg-slate-900 border border-slate-800 rounded-xl" />
        <div className="h-4 w-96 max-w-full bg-slate-900/70 rounded-lg" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-28 bg-slate-900 border border-slate-800 rounded-3xl"
          />
        ))}
      </div>
      <div className="h-72 bg-slate-900 border border-slate-800 rounded-3xl" />
    </div>
  );
}
