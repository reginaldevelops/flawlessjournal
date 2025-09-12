"use client";

import { useState } from "react";
import ConditionalBuilder from "../components/ConditionalBuilder";

export default function TestConditionalPage() {
  const [formula, setFormula] = useState("");

  // fake variables
  const variables = [
    { id: 1, name: "pnl", varType: "number" },
    { id: 2, name: "fees", varType: "number" },
    { id: 3, name: "direction", varType: "calculated" },
  ];

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-xl font-bold">Test Conditional Builder</h1>

      <ConditionalBuilder variables={variables} onChange={setFormula} />

      <div className="mt-6 p-3 bg-gray-100 rounded">
        <p className="font-semibold">Generated Formula:</p>
        <code className="text-sm">{formula}</code>
      </div>
    </div>
  );
}
