"use client";

export default function OverviewTab() {
  const data = {
    totalTrades: 653,
    winRate: "65%",
    winningDays: "58%",
    profitFactor: 1.12,
    grossProfit: 1310,
    grossLoss: -1168,
    netPnl: 142,
    avgR: 0.18,
    balanceDD: "93.29 (1.85%)",
    equityDD: "96.58 (1.91%)",
    maxConsecWins: 3,
    maxConsecLosses: 9,
    recoveryFactor: 1.47,
    expectedPayoff: 0.22,
    sharpe: 0.03,
  };

  return (
    <div className="grid grid-cols-2 gap-6 text-sm text-gray-800">
      {/* Block 1 */}
      <table className="w-full border border-gray-300">
        <tbody>
          <tr className="border-b">
            <td className="p-2">Total Trades</td>
            <td className="p-2 text-right">{data.totalTrades}</td>
          </tr>
          <tr className="border-b">
            <td className="p-2">Win Rate</td>
            <td className="p-2 text-right">{data.winRate}</td>
          </tr>
          <tr className="border-b">
            <td className="p-2">Winning Days</td>
            <td className="p-2 text-right">{data.winningDays}</td>
          </tr>
          <tr>
            <td className="p-2">Profit Factor</td>
            <td className="p-2 text-right">{data.profitFactor}</td>
          </tr>
        </tbody>
      </table>

      {/* Block 2 */}
      <table className="w-full border border-gray-300">
        <tbody>
          <tr className="border-b">
            <td className="p-2">Balance DD Max</td>
            <td className="p-2 text-right">{data.balanceDD}</td>
          </tr>
          <tr className="border-b">
            <td className="p-2">Equity DD Max</td>
            <td className="p-2 text-right">{data.equityDD}</td>
          </tr>
          <tr className="border-b">
            <td className="p-2">Max Consecutive Wins</td>
            <td className="p-2 text-right">{data.maxConsecWins}</td>
          </tr>
          <tr>
            <td className="p-2">Max Consecutive Losses</td>
            <td className="p-2 text-right">{data.maxConsecLosses}</td>
          </tr>
        </tbody>
      </table>

      {/* Block 3 */}
      <table className="w-full border border-gray-300">
        <tbody>
          <tr className="border-b">
            <td className="p-2">Gross Profit</td>
            <td className="p-2 text-right">€{data.grossProfit}</td>
          </tr>
          <tr className="border-b">
            <td className="p-2">Gross Loss</td>
            <td className="p-2 text-right">€{data.grossLoss}</td>
          </tr>
          <tr className="border-b">
            <td className="p-2">Net PnL</td>
            <td className="p-2 text-right">€{data.netPnl}</td>
          </tr>
          <tr>
            <td className="p-2">Avg R/trade</td>
            <td className="p-2 text-right">{data.avgR}</td>
          </tr>
        </tbody>
      </table>

      {/* Block 4 */}
      <table className="w-full border border-gray-300">
        <tbody>
          <tr className="border-b">
            <td className="p-2">Recovery Factor</td>
            <td className="p-2 text-right">{data.recoveryFactor}</td>
          </tr>
          <tr className="border-b">
            <td className="p-2">Expected Payoff</td>
            <td className="p-2 text-right">{data.expectedPayoff}</td>
          </tr>
          <tr>
            <td className="p-2">Sharpe Ratio</td>
            <td className="p-2 text-right">{data.sharpe}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
