export default function KoincidenLoading() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl space-y-6 animate-pulse">
      <div className="h-24 bg-slate-900 border border-slate-800 rounded-3xl" />
      <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
        <div className="md:col-span-4 h-[460px] bg-slate-900 border border-slate-800 rounded-3xl" />
        <div className="md:col-span-8 h-[460px] bg-slate-900 border border-slate-800 rounded-3xl" />
      </div>
    </div>
  );
}
