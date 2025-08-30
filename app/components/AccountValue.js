"use client";

import styled from "styled-components";

export default function AccountValue({ phantom, hyper, lastUpdated }) {
  const total = phantom + hyper;

  return (
    <Card>
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
  background: transparent;
  padding: 15px 0px;
  text-align: left;

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
    color: #090ce0ff;
  }

  .hyper {
    font-weight: 500;
    color: #8fd613ff;
  }

  .updated {
    margin-top: 1rem;
    font-size: 0.85rem;
    color: #6b7280;
  }
`;
