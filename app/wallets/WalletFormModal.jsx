"use client";

import { useEffect, useId, useReducer } from "react";
import { Button, Field, Input, Modal, Select } from "../components/ui";
import { CHAIN_LIST, WALLET_COLORS, nextWalletColor } from "../lib/chain/constants";
import { validateAddress, validateLabel } from "../lib/chain/validate";

const INITIAL = {
  label: "",
  chain: "",
  address: "",
  color: "",
  include_in_balance: true,
  errors: {},
  submitting: false,
};

function reducer(state, action) {
  switch (action.type) {
    case "SET_FIELD":
      return { ...state, [action.field]: action.value, errors: { ...state.errors, [action.field]: null } };
    case "SET_ERRORS":
      return { ...state, errors: action.errors, submitting: false };
    case "SET_SUBMITTING":
      return { ...state, submitting: action.value };
    case "RESET":
      return { ...INITIAL, ...action.values };
    default:
      return state;
  }
}

export default function WalletFormModal({ open, onClose, onSave, wallet, usedColors = [] }) {
  const isEdit = Boolean(wallet?.id);
  const [state, dispatch] = useReducer(reducer, INITIAL);
  const formId = useId();

  useEffect(() => {
    if (open) {
      dispatch({
        type: "RESET",
        values: wallet
          ? {
              label: wallet.label ?? "",
              chain: wallet.chain ?? "",
              address: wallet.address ?? "",
              color: wallet.color ?? nextWalletColor(usedColors),
              include_in_balance: wallet.include_in_balance ?? true,
            }
          : { color: nextWalletColor(usedColors) },
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const set = (field) => (e) =>
    dispatch({ type: "SET_FIELD", field, value: typeof e === "string" ? e : e.target?.value ?? e });

  const handleSubmit = async (e) => {
    e?.preventDefault();
    const errs = {};

    const labelCheck = validateLabel(state.label);
    if (!labelCheck.ok) errs.label = labelCheck.error;

    const addrCheck = validateAddress(state.chain, state.address);
    if (!addrCheck.ok) errs.address = addrCheck.error;

    if (!state.chain) errs.chain = "Pick a chain.";

    if (Object.keys(errs).length) {
      dispatch({ type: "SET_ERRORS", errors: errs });
      return;
    }

    dispatch({ type: "SET_SUBMITTING", value: true });
    const result = await onSave({
      label: state.label.trim(),
      chain: state.chain,
      address: state.address.trim(),
      color: state.color || WALLET_COLORS[0],
      include_in_balance: state.include_in_balance,
    });
    if (result?.ok !== false) {
      onClose();
    } else {
      dispatch({ type: "SET_SUBMITTING", value: false });
    }
  };

  const selectedChain = CHAIN_LIST.find((c) => c.id === state.chain);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? "Edit wallet" : "Add wallet"}
      description={
        isEdit
          ? "Update the label, colour or balance inclusion."
          : "Connect a Solana or Hyperliquid address to track your on-chain equity."
      }
      size="md"
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose} disabled={state.submitting}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            loading={state.submitting}
            onClick={handleSubmit}
            form={formId}
            type="submit"
          >
            {isEdit ? "Save changes" : "Add wallet"}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={handleSubmit} className="space-y-4 py-1">
        {/* Label */}
        <Field label="Label" required error={state.errors.label}>
          {(id) => (
            <Input
              id={id}
              value={state.label}
              onChange={set("label")}
              placeholder="Phantom — main"
              maxLength={60}
              invalid={Boolean(state.errors.label)}
              autoFocus
            />
          )}
        </Field>

        {/* Chain */}
        <Field label="Chain" required error={state.errors.chain}
          hint={selectedChain?.description}
        >
          {(id) => (
            <Select
              id={id}
              value={state.chain}
              onChange={set("chain")}
              invalid={Boolean(state.errors.chain)}
            >
              <option value="">Select a chain…</option>
              {CHAIN_LIST.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </Select>
          )}
        </Field>

        {/* Address */}
        <Field
          label="Address"
          required
          error={state.errors.address}
          hint={selectedChain?.addressHint ?? "Select a chain first."}
        >
          {(id) => (
            <Input
              id={id}
              value={state.address}
              onChange={set("address")}
              placeholder={selectedChain?.addressPlaceholder ?? ""}
              spellCheck={false}
              autoComplete="off"
              invalid={Boolean(state.errors.address)}
              disabled={isEdit}
            />
          )}
        </Field>

        {/* Color picker */}
        <Field label="Colour">
          {() => (
            <div className="flex flex-wrap gap-2">
              {WALLET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={`Colour ${c}`}
                  onClick={() => dispatch({ type: "SET_FIELD", field: "color", value: c })}
                  className="relative h-7 w-7 rounded-full transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/60"
                  style={{ backgroundColor: c }}
                >
                  {state.color === c && (
                    <span className="absolute inset-0 flex items-center justify-center rounded-full ring-2 ring-white/80 ring-offset-1 ring-offset-surface" />
                  )}
                </button>
              ))}
              {/* Custom color via native color input */}
              <label className="relative flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border border-dashed border-line-strong text-2xs text-content-subtle hover:border-brand hover:text-brand transition-colors">
                <span aria-hidden>+</span>
                <input
                  type="color"
                  value={state.color || "#7c6cff"}
                  onChange={(e) =>
                    dispatch({ type: "SET_FIELD", field: "color", value: e.target.value })
                  }
                  className="absolute h-full w-full cursor-pointer opacity-0"
                  aria-label="Custom colour"
                />
              </label>
            </div>
          )}
        </Field>

        {/* Include in balance toggle */}
        <div className="flex items-center justify-between rounded-lg border border-line bg-surface-sunken px-4 py-3">
          <div>
            <p className="text-sm font-medium text-content">Include in total balance</p>
            <p className="text-xs text-content-muted">
              Toggle off to track without adding to your account equity.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={state.include_in_balance}
            onClick={() =>
              dispatch({
                type: "SET_FIELD",
                field: "include_in_balance",
                value: !state.include_in_balance,
              })
            }
            className={[
              "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border border-transparent p-0.5",
              "transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/60 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas",
              state.include_in_balance ? "bg-brand" : "bg-line-strong",
            ].join(" ")}
          >
            <span
              className={[
                "inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200",
                state.include_in_balance ? "translate-x-4" : "translate-x-0",
              ].join(" ")}
            />
          </button>
        </div>
      </form>
    </Modal>
  );
}
