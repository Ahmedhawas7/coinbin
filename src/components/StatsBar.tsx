"use client";

interface StatsBarProps {
  totalValue: number;
  tokenCount: number;
  dustCount: number;
  deadCount: number;
  selectedCount: number;
  selectedValue: number;
  loading: boolean;
}

export function StatsBar({
  totalValue,
  tokenCount,
  dustCount,
  deadCount,
  selectedCount,
  selectedValue,
  loading,
}: StatsBarProps) {
  const Skeleton = () => (
    <div className="h-5 w-16 rounded-md shimmer" />
  );

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      {/* Total Portfolio */}
      <div className="col-span-2 lg:col-span-1 glass-card rounded-2xl p-6 flex flex-col gap-2 group relative overflow-hidden">
        <div className="absolute top-0 right-0 w-24 h-24 bg-base-blue/5 rounded-full -mr-8 -mt-8 blur-2xl group-hover:bg-base-blue/10 transition-colors" />
        <div className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">إجمالي المحفظة</div>
        {loading ? <Skeleton /> : (
          <div className="text-2xl font-black text-white tracking-tight">
            ${totalValue >= 1 ? totalValue.toLocaleString(undefined, { maximumFractionDigits: 2 }) : totalValue.toFixed(4)}
          </div>
        )}
      </div>

      {/* Token count */}
      <div className="glass-card rounded-2xl p-6 flex flex-col gap-2 group relative overflow-hidden">
        <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/5 rounded-full -mr-8 -mt-8 blur-2xl group-hover:bg-purple-500/10 transition-colors" />
        <div className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">الرموز بالرصيد</div>
        {loading ? <Skeleton /> : (
          <div className="text-2xl font-black text-white tracking-tight">{tokenCount}</div>
        )}
        {dustCount > 0 && !loading && (
          <div className="text-xs font-semibold text-amber-500/80 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            {dustCount} غبار مكتشف
          </div>
        )}
      </div>

      {/* Dead tokens */}
      <div className="glass-card rounded-2xl p-6 flex flex-col gap-2 group relative overflow-hidden">
        <div className="absolute top-0 right-0 w-24 h-24 bg-orange-500/5 rounded-full -mr-8 -mt-8 blur-2xl group-hover:bg-orange-500/10 transition-colors" />
        <div className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">بدون سيولة</div>
        {loading ? <Skeleton /> : (
          <div className={`text-2xl font-black tracking-tight ${deadCount > 0 ? "text-orange-500" : "text-emerald-500"}`}>
            {deadCount}
          </div>
        )}
        {deadCount > 0 && !loading && (
          <div className="text-xs font-semibold text-orange-500/80 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-500 status-pulse" />
            جاهزة للحرق 🔥
          </div>
        )}
      </div>

      {/* Selected */}
      <div className={`glass-card rounded-2xl p-6 flex flex-col gap-2 group relative overflow-hidden transition-all duration-500 ${
        selectedCount > 0 ? "border-base-blue/40 bg-base-blue/[0.03] glow-accent scale-[1.02]" : ""
      }`}>
        <div className="absolute top-0 right-0 w-24 h-24 bg-base-blue/10 rounded-full -mr-8 -mt-8 blur-2xl opacity-50" />
        <div className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">المحدد للبيع</div>
        {loading ? <Skeleton /> : (
          <div className={`text-2xl font-black tracking-tight ${selectedCount > 0 ? "text-base-blue" : "text-white"}`}>
            {selectedCount}
          </div>
        )}
        {selectedValue > 0 && !loading && (
          <div className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            قيمة البيع: ~${selectedValue.toFixed(2)}
          </div>
        )}
      </div>
    </div>
  );
}
