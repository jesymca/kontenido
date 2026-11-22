export default function PanelLoading() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl space-y-6 animate-pulse">
      <div className="space-y-2">
        <div className="h-8 w-64 bg-slate-900 border border-slate-800 rounded-xl" />
        <div className="h-4 w-80 max-w-full bg-slate-900/70 rounded-lg" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="h-28 bg-slate-900 border border-slate-800 rounded-3xl"
          />
        ))}
      </div>
      <div className="h-80 bg-slate-900 border border-slate-800 rounded-3xl" />
    </div>
  );
}
