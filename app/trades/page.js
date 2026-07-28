"use client";

import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import DynamicTable2 from "../components/DynamicTable2";
import { LoadingState, PageHeader, PageBody, Card } from "../components/ui";
import { BarChart2 } from "lucide-react";

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
        return;
      }

      const { data: tradeVars, error: varsError } = await supabase
        .from("variables")
        .select("*")
        .order("order", { ascending: true });

      if (varsError) {
        console.error("Error loading variables:", varsError);
        return;
      }

      setVariables(tradeVars || []);

      const mapped = trades.map((d) => {
        const base = { id: d.id, ...d.data };
        if (base.PNL !== undefined && base.PnL === undefined) {
          base.PnL = base.PNL;
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
