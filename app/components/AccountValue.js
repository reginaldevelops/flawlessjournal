"use client";

import styled from "styled-components";

export default function AccountValue({ phantom, hyper, lastUpdated }) {
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
      {lastUpdated && (
        <div className="updated">
          Last updated: {new Date(lastUpdated).toLocaleTimeString()}
        </div>
      )}
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

  .updated {
    margin-top: 1rem;
    font-size: 0.85rem;
    color: #6b7280;
  }
`;
