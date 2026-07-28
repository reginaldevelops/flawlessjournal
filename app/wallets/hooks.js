"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useToast } from "../components/ui";
import { nextWalletColor } from "../lib/chain/constants";
import { isMissingSchemaError } from "../lib/supabaseTrades";

const MISSING_TABLE_HINT =
  "The wallets table is missing. Run supabase/migrations/20260728_aaa_compat.sql in the Supabase SQL Editor.";

export function useWallets() {
  const [wallets, setWallets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [schemaMissing, setSchemaMissing] = useState(false);
  const toast = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase
      .from("wallets")
      .select("id, label, chain, address, color, include_in_balance, created_at")
      .order("created_at", { ascending: true });
    setLoading(false);
    if (err) {
      if (isMissingSchemaError(err)) {
        setSchemaMissing(true);
        setError(MISSING_TABLE_HINT);
        setWallets([]);
      } else {
        setSchemaMissing(false);
        setError(err.message ?? "Could not load wallets");
      }
    } else {
      setSchemaMissing(false);
      setWallets(data ?? []);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const add = useCallback(
    async (fields) => {
      if (schemaMissing) {
        toast.error("Wallets table missing", MISSING_TABLE_HINT);
        return { ok: false };
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      const color = fields.color || nextWalletColor(wallets.map((w) => w.color));
      const { data, error: err } = await supabase
        .from("wallets")
        .insert([
          {
            ...fields,
            color,
            include_in_balance: fields.include_in_balance ?? true,
            user_id: user?.id ?? null,
          },
        ])
        .select();
      if (err) {
        toast.error("Could not add wallet", { description: err.message });
        return { ok: false };
      }
      toast.success("Wallet added");
      setWallets((prev) => [...prev, ...(data ?? [])]);
      return { ok: true, wallet: data?.[0] };
    },
    [wallets, toast, schemaMissing]
  );

  const update = useCallback(
    async (id, fields) => {
      const { data, error: err } = await supabase
        .from("wallets")
        .update(fields)
        .eq("id", id)
        .select();
      if (err) {
        toast.error("Could not save changes", { description: err.message });
        return { ok: false };
      }
      toast.success("Wallet updated");
      setWallets((prev) =>
        prev.map((w) =>
          String(w.id) === String(id) ? { ...w, ...(data?.[0] ?? fields) } : w
        )
      );
      return { ok: true };
    },
    [toast]
  );

  const remove = useCallback(
    async (id) => {
      const { error: err } = await supabase.from("wallets").delete().eq("id", id);
      if (err) {
        toast.error("Could not delete wallet", { description: err.message });
        return { ok: false };
      }
      toast.success("Wallet removed");
      setWallets((prev) => prev.filter((w) => String(w.id) !== String(id)));
      return { ok: true };
    },
    [toast]
  );

  const toggleInclude = useCallback(
    async (id, current) => update(id, { include_in_balance: !current }),
    [update]
  );

  return {
    wallets,
    loading,
    error,
    schemaMissing,
    add,
    update,
    remove,
    toggleInclude,
    reload: load,
  };
}
