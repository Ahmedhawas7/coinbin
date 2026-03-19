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
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-10">
      {/* Total Portfolio */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="col-span-2 lg:col-span-1 v-card p-6 md:p-8 flex flex-col gap-3 group relative overflow-hidden active:scale-[0.98] transition-all"
      >
        <div className="absolute top-0 right-0 w-40 h-40 bg-accent/5 rounded-full -mr-16 -mt-16 blur-[60px] group-hover:bg-accent/10 transition-colors" />
        <div className="v-stat-label">{isArabic ? "إجمالي المحفظة" : "Wallet Total"}</div>
        {loading ? <Skeleton /> : (
          <div className="v-stat-value !text-3xl md:!text-4xl">
            ${totalValue >= 1 ? totalValue.toLocaleString(undefined, { maximumFractionDigits: 2 }) : totalValue.toFixed(4)}
          </div>
        )}
      </motion.div>

      {/* Token count */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="v-card p-6 md:p-8 flex flex-col gap-3 group relative overflow-hidden"
      >
        <div className="absolute top-0 right-0 w-40 h-40 bg-blue-500/5 rounded-full -mr-16 -mt-16 blur-[60px] group-hover:bg-blue-500/10 transition-colors" />
        <div className="v-stat-label">{isArabic ? "الرموز" : "Tokens"}</div>
        {loading ? <Skeleton /> : (
          <div className="v-stat-value !text-3xl md:!text-4xl text-text-primary">{tokenCount}</div>
        )}
        {dustCount > 0 && !loading && (
          <div className="text-[10px] font-black text-blue-500 flex items-center gap-2 uppercase tracking-widest mt-1">
            <span className="w-2 h-2 rounded-full bg-blue-500 shadow-lg shadow-blue-500/50" />
            {dustCount} {t.dust}
          </div>
        )}
      </motion.div>

      {/* DEX Scan */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="v-card p-6 md:p-8 flex flex-col gap-3 group relative overflow-hidden"
      >
        <div className="absolute top-0 right-0 w-40 h-40 bg-orange-500/5 rounded-full -mr-16 -mt-16 blur-[60px] group-hover:bg-orange-500/10 transition-colors" />
        <div className="v-stat-label">{isArabic ? "سحب السيولة 🔍" : "DEX Scan 🔍"}</div>
        {loading ? <Skeleton /> : (
          <div className={`v-stat-value !text-3xl md:!text-4xl ${deadCount > 0 ? "text-orange-500" : "text-emerald-500"}`}>
            {deadCount}
          </div>
        )}
        {deadCount > 0 && !loading && (
          <div className="text-[10px] font-black text-orange-500 flex items-center gap-2 uppercase tracking-widest mt-1">
            <span className="w-2 h-2 rounded-full bg-orange-500 status-pulse shadow-lg shadow-orange-500/50" />
            {isArabic ? "بانتظار الفحص" : "Awaiting Scan"}
          </div>
        )}
      </motion.div>

      {/* Selected */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className={`v-card p-6 md:p-8 flex flex-col gap-3 group relative overflow-hidden transition-all duration-500 ${
          selectedCount > 0 ? "!border-accent/50 bg-accent/[0.05] scale-[1.05] shadow-2xl" : ""
        }`}
      >
        <div className="absolute top-0 right-0 w-40 h-40 bg-accent/20 rounded-full -mr-16 -mt-16 blur-[60px] opacity-50" />
        <div className="v-stat-label">{isArabic ? "المحدد" : "Selected"}</div>
        {loading ? <Skeleton /> : (
          <div className={`v-stat-value !text-3xl md:!text-4xl ${selectedCount > 0 ? "text-accent" : "text-text-primary"}`}>
            {selectedCount}
          </div>
        )}
        {selectedValue > 0 && !loading && (
          <div className="text-[10px] font-black text-emerald-500 flex items-center gap-2 uppercase tracking-widest mt-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-lg shadow-emerald-500/50" />
            ~${selectedValue.toFixed(2)}
          </div>
        )}
      </motion.div>
    </div>
  );
}
