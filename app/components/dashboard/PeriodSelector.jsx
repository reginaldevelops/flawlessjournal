"use client";

import { Segmented } from "../ui";
import { PERIOD_OPTIONS } from "./hooks";

const SHORT = PERIOD_OPTIONS.map((p) => ({ value: p.value, label: p.short, title: p.label }));

/** Full labels where there is room, initialisms on narrow screens. */
export default function PeriodSelector({ value, onChange }) {
  return (
    <>
      <Segmented
        className="hidden lg:inline-flex"
        options={PERIOD_OPTIONS}
        value={value}
        onChange={onChange}
        size="sm"
      />
      <Segmented className="lg:hidden" options={SHORT} value={value} onChange={onChange} size="sm" />
    </>
  );
}
