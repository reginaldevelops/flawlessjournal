"use client";

export default function AvgWinLossCard({ rows = [] }) {
  const pnlValues = rows.map((r) => Number(r.PnL) || 0);
  const wins = pnlValues.filter((p) => p > 0);
  const losses = pnlValues.filter((p) => p < 0);

  const avgWin =
    wins.length > 0 ? wins.reduce((a, b) => a + b, 0) / wins.length : 0;
  const avgLoss =
    losses.length > 0
      ? Math.abs(losses.reduce((a, b) => a + b, 0)) / losses.length
      : 0;

  const ratio = avgLoss > 0 ? avgWin / avgLoss : 0;

  return (
    <div className="flex flex-col w-full h-full justify-center">
      <p className="text-sm text-gray-500">Avg win/loss trade</p>
      <p className="text-2xl font-bold text-gray-900">{ratio.toFixed(2)}</p>

      <div className="mt-3 flex items-center gap-2 text-sm font-medium">
        <span className="text-green-600">{avgWin.toFixed(0)}</span>
        <div className="flex-1 h-3 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-3 bg-green-500 inline-block"
            style={{ width: `${Math.min((ratio / (ratio + 1)) * 100, 100)}%` }}
          />
          <div
            className="h-3 bg-red-500 inline-block"
            style={{
              width: `${Math.min((1 / (ratio + 1)) * 100, 100)}%`,
            }}
          />
        </div>
        <span className="text-red-600">{avgLoss.toFixed(0)}</span>
      </div>
    </div>
  );
}
