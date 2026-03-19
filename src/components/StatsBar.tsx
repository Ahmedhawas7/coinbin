import { motion } from "framer-motion";
import { useUI } from "@/context/UIContext";

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
  const { t, isArabic, isLight } = useUI();

  const Skeleton = () => (
    <div className="h-8 w-24 rounded-lg loading-shimmer bg-white/5" />
  );

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-8">
      {/* Total Portfolio */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="col-span-2 lg:col-span-1 glass-card rounded-3xl p-5 md:p-6 flex flex-col gap-2 group relative overflow-hidden"
      >
        <div className="absolute top-0 right-0 w-32 h-32 bg-accent/5 rounded-full -mr-12 -mt-12 blur-3xl group-hover:bg-accent/10 transition-colors" />
        <div className="text-[10px] md:text-[11px] font-black text-text-muted uppercase tracking-[0.2em]">{isArabic ? "إجمالي المحفظة" : "Wallet Total"}</div>
        {loading ? <Skeleton /> : (
          <div className="text-2xl md:text-3xl font-black text-text-primary tracking-tighter">
            ${totalValue >= 1 ? totalValue.toLocaleString(undefined, { maximumFractionDigits: 2 }) : totalValue.toFixed(4)}
          </div>
        )}
      </motion.div>

      {/* Token count */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="glass-card rounded-3xl p-5 md:p-6 flex flex-col gap-2 group relative overflow-hidden"
      >
        <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 rounded-full -mr-12 -mt-12 blur-3xl group-hover:bg-purple-500/10 transition-colors" />
        <div className="text-[10px] md:text-[11px] font-black text-text-muted uppercase tracking-[0.2em]">{isArabic ? "الرموز" : "Tokens"}</div>
        {loading ? <Skeleton /> : (
          <div className="text-2xl md:text-3xl font-black text-text-primary tracking-tighter">{tokenCount}</div>
        )}
        {dustCount > 0 && !loading && (
          <div className="text-[10px] font-bold text-amber-500/80 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            {dustCount} {t.dust}
          </div>
        )}
      </motion.div>

      {/* Dead tokens */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="glass-card rounded-3xl p-5 md:p-6 flex flex-col gap-2 group relative overflow-hidden"
      >
        <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/5 rounded-full -mr-12 -mt-12 blur-3xl group-hover:bg-orange-500/10 transition-colors" />
        <div className="text-[10px] md:text-[11px] font-black text-text-muted uppercase tracking-[0.2em]">{isArabic ? "سحب السيولة 🔍" : "DEX Scan 🔍"}</div>
        {loading ? <Skeleton /> : (
          <div className={`text-2xl md:text-3xl font-black tracking-tighter ${deadCount > 0 ? "text-orange-500" : "text-emerald-500"}`}>
            {deadCount}
          </div>
        )}
        {deadCount > 0 && !loading && (
          <div className="text-[10px] font-bold text-orange-500/80 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-500 status-pulse" />
            {isArabic ? "بانتظار الفحص" : "Awaiting Scan"}
          </div>
        )}
      </motion.div>

      {/* Selected */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className={`glass-card rounded-3xl p-5 md:p-6 flex flex-col gap-2 group relative overflow-hidden transition-all duration-500 ${
          selectedCount > 0 ? "border-accent/40 bg-accent/[0.03] scale-[1.02] shadow-[0_20px_50px_-20px_rgba(0,82,255,0.3)]" : ""
        }`}
      >
        <div className="absolute top-0 right-0 w-32 h-32 bg-accent/10 rounded-full -mr-12 -mt-12 blur-3xl opacity-50" />
        <div className="text-[10px] md:text-[11px] font-black text-text-muted uppercase tracking-[0.2em]">{isArabic ? "المحدد" : "Selected"}</div>
        {loading ? <Skeleton /> : (
          <div className={`text-2xl md:text-3xl font-black tracking-tighter ${selectedCount > 0 ? "text-accent" : "text-white"}`}>
            {selectedCount}
          </div>
        )}
        {selectedValue > 0 && !loading && (
          <div className="text-[10px] font-bold text-emerald-400 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            ~${selectedValue.toFixed(2)}
          </div>
        )}
      </motion.div>
    </div>
  );
}
