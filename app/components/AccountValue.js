"use client";

import { useEffect, useState } from "react";
import styled from "styled-components";

export default function AccountValue() {
  const [phantom, setPhantom] = useState(0);
  const [hyper, setHyper] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        // ✅ Phantom (Solana wallet via jouw /api/portfolio)
        const resPhantom = await fetch("/api/portfolio", { cache: "no-store" });
        const dataPhantom = await resPhantom.json();
        setPhantom(dataPhantom?.totalUSD ?? 0);

        // ✅ Hyperliquid
        const resHyper = await fetch("/api/hyperliquid", { cache: "no-store" });
        const dataHyper = await resHyper.json();
        setHyper(dataHyper?.totalUSD ?? 0);
      } catch (err) {
        console.error("Error loading balances:", err);
        setPhantom(0);
        setHyper(0);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  if (loading) return <Card>Loading...</Card>;

  const total = phantom + hyper;

  return (
    <Card>
      <h3>Total Balance</h3>
      <div className="total">
        ${total.toLocaleString(undefined, { maximumFractionDigits: 2 })}
      </div>
      <div className="sub phantom">
        Phantom: $
        {phantom.toLocaleString(undefined, { maximumFractionDigits: 2 })}
      </div>
      <div className="sub hyper">
        Hyperliquid: $
        {hyper.toLocaleString(undefined, { maximumFractionDigits: 2 })}
      </div>
    </Card>
  );
}

/* ---------------- styled ---------------- */
const Card = styled.div`
  background: #ffffff;
  border-radius: 14px;
  padding: 1.8rem;
  box-shadow: 0 3px 10px rgba(0, 0, 0, 0.08);
  text-align: center;

  h3 {
    font-size: 1.1rem;
    color: #374151;
    margin-bottom: 1rem;
  }

  .total {
    font-size: 2rem;
    font-weight: 700;
    color: #111827;
    margin-bottom: 1.2rem;
  }

  .sub {
    font-size: 1rem;
    color: #4b5563;
    margin-top: 0.4rem;
  }

  .phantom {
    font-weight: 500;
  }

  .hyper {
    font-weight: 500;
    color: #2563eb;
  }
`;
