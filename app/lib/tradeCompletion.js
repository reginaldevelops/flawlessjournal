/**
 * Trade completion helpers: missing fields + intentional "check done".
 */

export function getCheckedEmpty(trade) {
  const map = trade?._fj?.completion?.checkedEmpty;
  return map && typeof map === "object" ? map : {};
}

export function isFieldValueFilled(value) {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim() !== "";
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

export function isFieldComplete(trade, fieldName) {
  if (isFieldValueFilled(trade?.[fieldName])) return true;
  return Boolean(getCheckedEmpty(trade)?.[fieldName]?.checkedAt);
}

/** Visible journal variables that still block Completed. */
export function getIncompleteFields(trade, variables = []) {
  return (variables || []).filter((v) => {
    if (!v?.visible) return false;
    if (v.varType === "calculated") return false;
    if (v.name === "Trade number" || v.name === "trade_number") return false;
    return !isFieldComplete(trade, v.name);
  });
}

export function markFieldCheckedEmpty(trade, fieldName) {
  const fj = trade?._fj && typeof trade._fj === "object" ? trade._fj : {};
  const completion = fj.completion && typeof fj.completion === "object" ? fj.completion : {};
  const checkedEmpty = {
    ...(completion.checkedEmpty && typeof completion.checkedEmpty === "object"
      ? completion.checkedEmpty
      : {}),
    [fieldName]: { checkedAt: new Date().toISOString() },
  };
  return {
    ...trade,
    _fj: {
      ...fj,
      completion: {
        ...completion,
        checkedEmpty,
      },
    },
  };
}

export function clearFieldCheckedEmpty(trade, fieldName) {
  const fj = trade?._fj && typeof trade._fj === "object" ? trade._fj : {};
  const completion = fj.completion && typeof fj.completion === "object" ? fj.completion : {};
  const prev =
    completion.checkedEmpty && typeof completion.checkedEmpty === "object"
      ? { ...completion.checkedEmpty }
      : {};
  delete prev[fieldName];
  return {
    ...trade,
    _fj: {
      ...fj,
      completion: {
        ...completion,
        checkedEmpty: prev,
      },
    },
  };
}

/**
 * Status for journal completeness (ignores Solana live/closed).
 */
export function getJournalCompletionStatus(trade, variables = []) {
  const preVars = variables.filter((v) => v.phase === "pre" && v.visible);
  const postVars = variables.filter((v) => v.phase === "post" && v.visible);
  const incompletePre = preVars.filter((v) => !isFieldComplete(trade, v.name));
  const incompletePost = postVars.filter((v) => !isFieldComplete(trade, v.name));

  const pnlKey =
    variables.find((v) => v.type === "system" && /pnl/i.test(v.name))?.name ||
    Object.keys(trade || {}).find((k) => k.toLowerCase() === "pnl");
  const pnlFilled = pnlKey ? isFieldValueFilled(trade?.[pnlKey]) : false;

  if (incompletePre.length) {
    return {
      key: "incomplete",
      label: "Pre-trade incomplete",
      incomplete: [...incompletePre, ...incompletePost],
    };
  }
  if (incompletePost.length && !pnlFilled) {
    return {
      key: "open",
      label: "Open",
      incomplete: incompletePost,
    };
  }
  if (incompletePost.length && pnlFilled) {
    return {
      key: "in_progress",
      label: "In progress",
      incomplete: incompletePost,
    };
  }
  return {
    key: "completed",
    label: "Completed",
    incomplete: [],
  };
}
