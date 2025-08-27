"use client";

import styled from "styled-components";
import AccountValue from "./AccountValue";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";

export default function BalanceCard({ phantom, hyper, lastUpdated }) {
  return (
    <Card>
      <h3>Total Balance</h3>
      <BalanceWrapper>
        <AccountValue
          phantom={phantom}
          hyper={hyper}
          lastUpdated={lastUpdated}
        />
        <PieWrapper>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                dataKey="value"
                data={[
                  { name: "Phantom", value: phantom },
                  { name: "Hyperliquid", value: hyper },
                ]}
                cx="50%"
                cy="50%"
                innerRadius={40}
                outerRadius={70}
                paddingAngle={4}
              >
                <Cell fill="#3b82f6" />
                <Cell fill="#f59e0b" />
              </Pie>
              <Tooltip formatter={(val) => `$${val.toLocaleString()}`} />
            </PieChart>
          </ResponsiveContainer>
        </PieWrapper>
      </BalanceWrapper>
    </Card>
  );
}

/* ---------------- styled ---------------- */
const Card = styled.div`
  background: #ffffff;
  padding: 1rem 2rem;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);

  h3 {
    margin-bottom: 0.5rem;
    color: #1e293b;
    font-size: 1.1rem;
  }
`;

const BalanceWrapper = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const PieWrapper = styled.div`
  width: 150px;
  height: 150px;

  img {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }
`;
