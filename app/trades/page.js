"use client";

import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import DynamicTable2 from "../components/DynamicTable2";
import { LoadingState, PageHeader, PageBody, Card } from "../components/ui";
import { fetchTrades } from "../lib/supabaseTrades";

export default function TradeDataPage() {
  const [rows, setRows] = useState([]);
  const [variables, setVariables] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const { raw, variables: tradeVars, error } = await fetchTrades(supabase, {
        withVariables: true,
      });

      if (error) {
        console.error("Error loading trades:", error);
        setLoading(false);
        return;
      }

      setVariables(tradeVars || []);

      const mapped = (raw || []).map((d) => {
        const number = d.trade_number;
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
