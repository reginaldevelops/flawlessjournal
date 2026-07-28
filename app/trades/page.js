"use client";

import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import DynamicTable2 from "../components/DynamicTable2";
import { LoadingState, PageHeader, PageBody, Card } from "../components/ui";
import { extractTradeNumber } from "../lib/trades";

export default function TradeDataPage() {
  const [rows, setRows] = useState([]);
  const [variables, setVariables] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const { data: trades, error: tradesError } = await supabase
        .from("trades")
        .select("*");

      if (tradesError) {
        console.error("Error loading trades:", tradesError);
        setLoading(false);
        return;
      }

      const { data: tradeVars, error: varsError } = await supabase
        .from("variables")
        .select("*")
        .order("order", { ascending: true });

      if (varsError) {
        console.error("Error loading variables:", varsError);
      }

      setVariables(tradeVars || []);

      const mapped = (trades || []).map((d, index) => {
        const number = extractTradeNumber(d) ?? index + 1;
        const base = {
          id: d.id,
          trade_number: number,
          "Trade number": number,
          ...d.data,
        };
        if (base.PNL !== undefined && base.PnL === undefined) {
          base.PnL = base.PNL;
        }
        if (base["Trade number"] == null && base["Trade Number"] == null) {
          base["Trade number"] = number;
        }
        return base;
      });

      setRows(mapped);
      setLoading(false);
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <>
        <PageHeader
          eyebrow="Trading"
          title="Trades"
          description="Every trade you've taken — log, review, and spot patterns."
        />
        <PageBody>
          <Card>
            <LoadingState label="Loading trades…" />
          </Card>
        </PageBody>
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Trading"
        title="Trades"
        description="Every trade you've taken — log, review, and spot patterns."
      />
      <PageBody wide>
        <Card className="overflow-hidden">
          <DynamicTable2 rows={rows} variables={variables} />
        </Card>
      </PageBody>
    </>
  );
}
