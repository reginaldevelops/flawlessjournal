import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import CreatableSelect from "react-select/creatable";
import CumulativePnLChart from "./CumulativePnLChart";
import WinRateCard from "./WinRateCard";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  LineChart,
  Line,
} from "recharts";

export default function DeepDiveTab({ startDate, endDate }) {
  const [selectedVariable, setSelectedVariable] = useState("");
  const [selectedValues, setSelectedValues] = useState([]);
  const [rows, setRows] = useState([]);
  const [variableOptions, setVariableOptions] = useState([]);

  // derived data for charts
  const [chartData, setChartData] = useState([]);
  const [cumulativeSeries, setCumulativeSeries] = useState({});
  const [winrateData, setWinrateData] = useState([]);
  const [profitFactorData, setProfitFactorData] = useState([]);
  const [distributionData, setDistributionData] = useState([]);
  const [winsLossesData, setWinsLossesData] = useState([]);

  // haal trades
  useEffect(() => {
    async function fetchData() {
      let query = supabase.from("trades").select("trade_number, data");
      if (startDate) query = query.gte("data->>Datum", startDate);
      if (endDate) query = query.lte("data->>Datum", endDate);
      if (selectedVariable && selectedValues.length > 0) {
        query = query.in(`data->>${selectedVariable}`, selectedValues);
      }

      const { data: trades, error: tradesError } = await query;
      if (tradesError) {
        console.error(tradesError);
        return;
      }

      const cleanRows = (trades || []).map((d) => ({
        "Trade Number": d.trade_number,
        PnL: Number(d.data?.PNL) || 0,
        ...d.data,
      }));
      setRows(cleanRows);
      console.log("✅ rows", cleanRows);

      // grouping per variabele (NetPnL per categorie)
      if (selectedVariable) {
        const groups = {};
        cleanRows.forEach((r) => {
          const key = r[selectedVariable];
          if (!key || isNaN(r.PnL)) return;
          if (!groups[key]) groups[key] = { value: key, trades: 0, pnl: 0 };
          groups[key].trades++;
          groups[key].pnl += r.PnL;
        });
        setChartData(
          Object.values(groups).map((g) => ({
            name: g.value,
            Trades: g.trades,
            NetPnL: g.pnl,
          }))
        );
      } else {
        setChartData([]);
      }
    }

    fetchData();
  }, [startDate, endDate, selectedVariable, selectedValues]);

  // haal variabelen op uit tabel (alleen dropdowns)
  useEffect(() => {
    async function fetchVariables() {
      const { data: vars, error } = await supabase
        .from("variables")
        .select("*")
        .order("order", { ascending: true });

      if (error) {
        console.error(error);
        return;
      }
      const dropdowns = (vars || []).filter((v) => v.varType === "dropdown");
      setVariableOptions(dropdowns.map((v) => v.name));
    }

    fetchVariables();
  }, []);

  // bereken datasets voor categorie-grafieken
  useEffect(() => {
    if (!selectedVariable || rows.length === 0) {
      setCumulativeSeries({});
      setWinrateData([]);
      setProfitFactorData([]);
      setDistributionData([]);
      setWinsLossesData([]);
      return;
    }

    const groups = {};
    rows.forEach((r) => {
      const cat = r[selectedVariable];
      if (!cat) return;
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(r);
    });

    // cumulative
    const series = {};
    Object.keys(groups).forEach((cat) => {
      let cumulative = 0;
      series[cat] = groups[cat]
        .sort((a, b) => a["Trade Number"] - b["Trade Number"])
        .map((r) => {
          cumulative += r.PnL;
          return { trade: r["Trade Number"], pnl: cumulative };
        });
    });
    setCumulativeSeries(series);

    // winrate
    const wr = Object.keys(groups).map((cat) => {
      const wins = groups[cat].filter((r) => r.PnL > 0).length;
      const total = groups[cat].length;
      return { name: cat, Winrate: total ? (wins / total) * 100 : 0 };
    });
    setWinrateData(wr);

    // profit factor
    const pf = Object.keys(groups).map((cat) => {
      const winSum = groups[cat]
        .filter((r) => r.PnL > 0)
        .reduce((a, b) => a + b.PnL, 0);
      const lossSum = groups[cat]
        .filter((r) => r.PnL < 0)
        .reduce((a, b) => a + b.PnL, 0);
      return {
        name: cat,
        ProfitFactor: lossSum < 0 ? winSum / Math.abs(lossSum) : 0,
      };
    });
    setProfitFactorData(pf);

    // distributie (min, median, max)
    const dist = Object.keys(groups).map((cat) => {
      const values = groups[cat].map((r) => r.PnL).sort((a, b) => a - b);
      const min = values[0];
      const max = values[values.length - 1];
      const median = values.length ? values[Math.floor(values.length / 2)] : 0;
      return { name: cat, Min: min, Median: median, Max: max };
    });
    setDistributionData(dist);

    // wins vs losses
    const wl = Object.keys(groups).map((cat) => {
      const wins = groups[cat].filter((r) => r.PnL > 0).length;
      const losses = groups[cat].filter((r) => r.PnL < 0).length;
      return { name: cat, Wins: wins, Losses: losses };
    });
    setWinsLossesData(wl);

    // debug logs
    console.log("✅ Groups", groups);
    console.log("✅ cumulativeSeries", series);
    console.log("✅ winrateData", wr);
    console.log("✅ profitFactorData", pf);
    console.log("✅ distributionData", dist);
    console.log("✅ winsLossesData", wl);
  }, [rows, selectedVariable]);

  return (
    <div className="space-y-6">
      {/* Filters bovenaan */}
      <div className="flex gap-4 items-center">
        <select
          className="border rounded px-2 py-1"
          value={selectedVariable}
          onChange={(e) => {
            setSelectedVariable(e.target.value);
            setSelectedValues([]);
          }}
        >
          <option value="">Select variable...</option>
          {variableOptions.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>

        {selectedVariable && (
          <CreatableSelect
            isMulti
            placeholder="Filter values"
            value={selectedValues.map((v) => ({ value: v, label: v }))}
            onChange={(vals) => setSelectedValues(vals.map((v) => v.value))}
          />
        )}
      </div>

      {/* Vergelijkingsgrafieken per categorie */}
      {selectedVariable && (
        <div className="space-y-8">
          <div className="grid grid-cols-2 gap-1">
            {/* 1. NetPnL per categorie */}
            <div className="bg-white p-4 rounded-xl shadow">
              <h3 className="mb-2 text-slate-800 font-semibold">
                NetPnL per {selectedVariable}
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="NetPnL" fill="#3b82f6" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* 3. Winrate per categorie */}
            <div className="bg-white p-4 rounded-xl shadow">
              <h3 className="mb-2 text-slate-800 font-semibold">
                Winrate per {selectedVariable}
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={winrateData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis unit="%" />
                  <Tooltip />
                  <Bar dataKey="Winrate" fill="#10b981" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 2. Cumulative PnL per categorie */}
          <div className="bg-white p-4 rounded-xl shadow">
            <h3 className="mb-2 text-slate-800 font-semibold">
              Cumulative PnL per {selectedVariable}
            </h3>
            <ResponsiveContainer width="100%" height={350}>
              <LineChart data={[]}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="trade" />
                <YAxis />
                <Tooltip />
                {Object.keys(cumulativeSeries).map((cat, i) => (
                  <Line
                    key={cat}
                    data={cumulativeSeries[cat]}
                    dataKey="pnl"
                    name={cat}
                    stroke={
                      ["#3b82f6", "#ef4444", "#10b981", "#f59e0b", "#8b5cf6"][
                        i % 5
                      ]
                    }
                    dot={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* 4. Profit Factor per categorie */}
          <div className="bg-white p-4 rounded-xl shadow">
            <h3 className="mb-2 text-slate-800 font-semibold">
              Profit Factor per {selectedVariable}
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={profitFactorData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="ProfitFactor" fill="#f59e0b" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
