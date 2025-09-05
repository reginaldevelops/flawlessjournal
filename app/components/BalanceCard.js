"use client";

import styled from "styled-components";
import AccountValue from "./AccountValue";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";

export default function BalanceCard({ phantom, hyper, lastUpdated }) {
  return (
    <div>
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
                <Cell fill="#0e20deff" />
                <Cell fill="#b7f51bff" />
              </Pie>
              <Tooltip formatter={(val) => `$${val.toLocaleString()}`} />
            </PieChart>
          </ResponsiveContainer>
        </PieWrapper>
      </BalanceWrapper>
    </div>
  );
}

/* ---------------- styled ---------------- */

const BalanceWrapper = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: start;
`;

const PieWrapper = styled.div`
  height: 139px;
  width: 139px;
  margin: auto;

  img {
    width: 100%;
    height: 100%;
    object-fit: fill;
  }
`;
