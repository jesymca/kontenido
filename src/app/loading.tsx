export default function RootLoading() {
  return (
    <div className="container mx-auto px-4 py-10 max-w-6xl space-y-6 animate-pulse">
      <div className="h-10 w-64 bg-slate-900 border border-slate-800 rounded-2xl" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="h-64 bg-slate-900/90 border border-slate-800 rounded-3xl"
          />
        ))}
      </div>
    </div>
  );
}
