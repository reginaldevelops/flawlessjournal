import DynamicTable2 from "../components/DynamicTable2";
import { supabase } from "../lib/supabaseClient";
import CumulativePnLChart from "../components/CumulativePnLChart";
import ProfitFactorCard from "../components/ProfitFactorCard";
import WinRateCard from "../components/WinRateCard";
import AvgWinLossCard from "../components/AvgWinLossCard";
import LayoutWrapper from "../components/LayoutWrapper";

export default async function TradeDataPage() {
  const { data: trades } = await supabase.from("trades").select("*");
  const { data: tradeVars } = await supabase
    .from("trade_variables")
    .select("*");

  const variables = tradeVars?.map((v) => v.name) || [];

  function StatCard({ children }) {
    return (
      <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-200 flex flex-col h-full">
        <div className="flex-1 flex items-center justify-center h-full w-full">
          {children}
        </div>
      </div>
    );
  }

  const rows = trades.map((d) => {
    const base = {
      id: d.id,
      "Trade Number": d.trade_number,
      Coins: d.data?.Coins,
      Datum: d.data?.Datum,
      Entreetijd: d.data?.Entreetijd,
      "Time exit": d.data?.["Time exit"],
      Chart: d.data?.Chart,
      "USDT.D chart": d.data?.["USDT.D chart"],
      Confidence: d.data?.Confidence,
      "Target Win": d.data?.["Target Win"],
      "Target loss": d.data?.["Target loss"],
      "Reasons for entry": d.data?.["Reasons for entry"],
      PnL: d.data?.PNL,
      Result: d.data?.Result,
      Tags: d.data?.tags || [],
    };
    variables.forEach((v) => {
      base[v] = d.data?.[v] || "";
    });
    return base;
  });

  // ✅ Profit factor berekenen
  const pnlValues = rows.map((r) => Number(r.PnL) || 0);
  const totalWins = pnlValues.filter((p) => p > 0).reduce((a, b) => a + b, 0);
  const totalLosses = pnlValues.filter((p) => p < 0).reduce((a, b) => a + b, 0);

  const profitFactor = totalLosses < 0 ? totalWins / Math.abs(totalLosses) : 0;

  return (
    <LayoutWrapper>
      <div className="p-8 space-y-8">
        <header className="text-center">
          <h1 className="text-4xl font-bold tracking-tight text-gray-900">
            Tradelist
          </h1>
        </header>

        {/* Grid met analytics cards */}
        <div className="grid gap-6 md:grid-cols-2 auto-rows-[200px]">
          <StatCard>
            <CumulativePnLChart rows={rows} />
          </StatCard>
          <StatCard>
            <ProfitFactorCard value={profitFactor} />
          </StatCard>
          <StatCard>
            <WinRateCard rows={rows} />
          </StatCard>
          <StatCard>
            <AvgWinLossCard rows={rows} />
          </StatCard>
        </div>

        {/* Tabel */}
        <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
          <DynamicTable2 rows={rows} variables={variables} />
        </div>
      </div>
    </LayoutWrapper>
  );
}
