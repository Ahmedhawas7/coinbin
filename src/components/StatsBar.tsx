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
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
      {/* Total Portfolio */}
      <div className="col-span-2 sm:col-span-1 bg-[#0E1015] border border-[#1E2028] rounded-2xl p-4 flex flex-col gap-1">
        <div className="text-[10px] text-gray-600 uppercase tracking-widest">إجمالي المحفظة</div>
        {loading ? <Skeleton /> : (
          <div className="text-xl font-bold text-white">
            ${totalValue >= 1 ? totalValue.toLocaleString(undefined, { maximumFractionDigits: 2 }) : totalValue.toFixed(4)}
          </div>
        )}
      </div>

      {/* Token count */}
      <div className="bg-[#0E1015] border border-[#1E2028] rounded-2xl p-4 flex flex-col gap-1">
        <div className="text-[10px] text-gray-600 uppercase tracking-widest">الرموز</div>
        {loading ? <Skeleton /> : (
          <div className="text-xl font-bold text-white">{tokenCount}</div>
        )}
        {dustCount > 0 && !loading && (
          <div className="text-[10px] text-amber-500/70">{dustCount} غبار</div>
        )}
      </div>

      {/* Dead tokens */}
      <div className="bg-[#0E1015] border border-[#1E2028] rounded-2xl p-4 flex flex-col gap-1">
        <div className="text-[10px] text-gray-600 uppercase tracking-widest">بلا سيولة</div>
        {loading ? <Skeleton /> : (
          <div className={`text-xl font-bold ${deadCount > 0 ? "text-orange-400" : "text-emerald-500"}`}>
            {deadCount}
          </div>
        )}
        {deadCount > 0 && !loading && (
          <div className="text-[10px] text-orange-500/60">قابلة للحرق 🔥</div>
        )}
      </div>

      {/* Selected */}
      <div className={`bg-[#0E1015] border rounded-2xl p-4 flex flex-col gap-1 transition-colors ${
        selectedCount > 0 ? "border-[#0052FF]/30 bg-[#0052FF]/3" : "border-[#1E2028]"
      }`}>
        <div className="text-[10px] text-gray-600 uppercase tracking-widest">محدد</div>
        {loading ? <Skeleton /> : (
          <div className={`text-xl font-bold ${selectedCount > 0 ? "text-[#0052FF]" : "text-white"}`}>
            {selectedCount}
          </div>
        )}
        {selectedValue > 0 && !loading && (
          <div className="text-[10px] text-[#0052FF]/70">
            ~${selectedValue.toFixed(2)}
          </div>
        )}
      </div>
    </div>
  );
}
