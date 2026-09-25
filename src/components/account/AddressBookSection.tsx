import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { MapPin, Plus, Pencil, Trash2, Star, StarOff, Loader2, Phone, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Address = {
  id: string;
  user_id: string;
  label: string | null;
  full_name: string | null;
  phone: string | null;
  line1: string;
  line2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country_code: string | null;
  country_name: string | null;
  is_default: boolean;
};

const empty = {
  label: "Home",
  full_name: "",
  phone: "",
  line1: "",
  line2: "",
  city: "",
  state: "",
  postal_code: "",
  country_code: "",
  country_name: "",
  is_default: false,
};

export function AddressBookSection({ userId, orders }: { userId: string; orders: any[] }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Address | null>(null);
  const [creating, setCreating] = useState(false);

  const { data: addresses = [], isLoading } = useQuery({
    queryKey: ["user-addresses", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_addresses" as any)
        .select("*")
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as Address[];
    },
  });

  const setDefault = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("user_addresses" as any)
        .update({ is_default: true } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Default address updated");
      qc.invalidateQueries({ queryKey: ["user-addresses", userId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("user_addresses" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Address deleted");
      qc.invalidateQueries({ queryKey: ["user-addresses", userId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const derived = (() => {
    const seen = new Set(addresses.map((a) => `${a.line1}|${a.city}|${a.postal_code}`));
    const map = new Map<string, any>();
    orders.forEach((o: any) => {
      if (!o.shipping_line1) return;
      const key = `${o.shipping_line1}|${o.shipping_city}|${o.shipping_postal_code}`;
      if (seen.has(key) || map.has(key)) return;
      map.set(key, {
        full_name: o.customer_name,
        phone: o.customer_phone,
        line1: o.shipping_line1,
        line2: o.shipping_line2,
        city: o.shipping_city,
        state: o.shipping_state,
        postal_code: o.shipping_postal_code,
        country_code: o.shipping_country,
        country_name: o.shipping_country_name || o.shipping_country,
      });
    });
    return Array.from(map.values());
  })();

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display font-bold text-lg text-foreground">Address book</h2>
          <p className="text-xs text-muted-foreground">Save addresses for faster checkout.</p>
        </div>
        <button
          onClick={() => setCreating(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:brightness-110"
        >
          <Plus className="w-4 h-4" /> Add address
        </button>
      </div>

      {isLoading ? (
        <div className="py-16 flex justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : addresses.length === 0 ? (
        <div className="text-center py-16 rounded-2xl border border-dashed border-border bg-card">
          <MapPin className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground">No saved addresses yet</p>
          <button
            onClick={() => setCreating(true)}
            className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:brightness-110"
          >
            <Plus className="w-4 h-4" /> Add your first address
          </button>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {addresses.map((a) => (
            <div key={a.id} className="p-5 rounded-2xl border border-border bg-card flex flex-col">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                    <MapPin className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="font-display font-semibold text-sm text-foreground">
                      {a.label || "Address"}
                    </p>
                    {a.is_default && (
                      <span className="inline-flex items-center gap-1 mt-0.5 text-[10px] uppercase tracking-wider text-primary font-semibold">
                        <Star className="w-3 h-3 fill-primary" /> Default
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="text-sm text-foreground/90 flex-1">
                {a.full_name && <p className="font-medium">{a.full_name}</p>}
                <p className="text-muted-foreground mt-1">
                  {a.line1}
                  {a.line2 && `, ${a.line2}`}
                </p>
                <p className="text-muted-foreground">
                  {[a.city, a.state, a.postal_code].filter(Boolean).join(", ")}
                </p>
                {a.country_name && <p className="text-muted-foreground">{a.country_name}</p>}
                {a.phone && (
                  <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1.5">
                    <Phone className="w-3 h-3" />
                    {a.phone}
                  </p>
                )}
              </div>
              <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-border">
                <button
                  onClick={() => setEditing(a)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium hover:bg-secondary"
                >
                  <Pencil className="w-3.5 h-3.5" /> Edit
                </button>
                {!a.is_default && (
                  <button
                    onClick={() => setDefault.mutate(a.id)}
                    disabled={setDefault.isPending}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium hover:bg-secondary disabled:opacity-50"
                  >
                    <StarOff className="w-3.5 h-3.5" /> Set default
                  </button>
                )}
                <button
                  onClick={() => {
                    if (confirm("Delete this address?")) del.mutate(a.id);
                  }}
                  disabled={del.isPending}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-destructive/30 text-xs font-medium text-destructive hover:bg-destructive/10 disabled:opacity-50 ml-auto"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {derived.length > 0 && (
        <details className="rounded-2xl border border-border bg-card p-5">
          <summary className="cursor-pointer text-sm font-medium text-foreground">
            Addresses from past orders ({derived.length})
          </summary>
          <div className="mt-4 grid sm:grid-cols-2 gap-3">
            {derived.map((d, i) => (
              <div key={i} className="p-4 rounded-xl border border-border bg-background">
                <p className="text-sm font-medium text-foreground">{d.full_name}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {d.line1}
                  {d.line2 && `, ${d.line2}`}
                </p>
                <p className="text-xs text-muted-foreground">
                  {[d.city, d.state, d.postal_code].filter(Boolean).join(", ")}
                </p>
                <button
                  onClick={() => {
                    setEditing({
                      ...empty,
                      ...d,
                      id: "",
                      user_id: userId,
                      is_default: false,
                      label: "Saved",
                    } as any);
                    setCreating(true);
                  }}
                  className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-primary/10 text-primary text-[11px] font-semibold hover:bg-primary/20"
                >
                  <Plus className="w-3 h-3" /> Save to address book
                </button>
              </div>
            ))}
          </div>
        </details>
      )}

      {(creating || editing) && (
        <AddressFormModal
          userId={userId}
          initial={editing && editing.id ? editing : (editing as any) || null}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ["user-addresses", userId] });
            setCreating(false);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function AddressFormModal({
  userId,
  initial,
  onClose,
  onSaved,
}: {
  userId: string;
  initial: Address | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!(initial && initial.id);
  const [form, setForm] = useState({
    label: initial?.label || "Home",
    full_name: initial?.full_name || "",
    phone: initial?.phone || "",
    line1: initial?.line1 || "",
    line2: initial?.line2 || "",
    city: initial?.city || "",
    state: initial?.state || "",
    postal_code: initial?.postal_code || "",
    country_code: initial?.country_code || "",
    country_name: initial?.country_name || "",
    is_default: initial?.is_default || false,
  });
  const [saving, setSaving] = useState(false);

  const set = (k: keyof typeof form) => (e: any) =>
    setForm((f) => ({
      ...f,
      [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value,
    }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.line1.trim()) return toast.error("Street address is required");
    setSaving(true);
    const payload: any = { ...form, user_id: userId };
    const { error } = isEdit
      ? await supabase
          .from("user_addresses" as any)
          .update(payload)
          .eq("id", initial!.id)
      : await supabase.from("user_addresses" as any).insert(payload);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(isEdit ? "Address updated" : "Address added");
    onSaved();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-card border border-border rounded-2xl shadow-xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b border-border sticky top-0 bg-card z-10">
          <h3 className="font-display font-bold text-foreground">
            {isEdit ? "Edit address" : "Add address"}
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Label">
              <input
                value={form.label}
                onChange={set("label")}
                placeholder="Home, Office..."
                className="input-base"
              />
            </Field>
            <Field label="Full name">
              <input value={form.full_name} onChange={set("full_name")} className="input-base" />
            </Field>
          </div>
          <Field label="Phone">
            <input value={form.phone} onChange={set("phone")} className="input-base" />
          </Field>
          <Field label="Street address *">
            <input required value={form.line1} onChange={set("line1")} className="input-base" />
          </Field>
          <Field label="Apartment, suite, etc.">
            <input value={form.line2} onChange={set("line2")} className="input-base" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="City">
              <input value={form.city} onChange={set("city")} className="input-base" />
            </Field>
            <Field label="State / Region">
              <input value={form.state} onChange={set("state")} className="input-base" />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Postal code">
              <input
                value={form.postal_code}
                onChange={set("postal_code")}
                className="input-base"
              />
            </Field>
            <Field label="Country">
              <input
                value={form.country_name}
                onChange={set("country_name")}
                placeholder="United States"
                className="input-base"
              />
            </Field>
          </div>
          <label className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              checked={form.is_default}
              onChange={set("is_default")}
              className="w-4 h-4 rounded border-border"
            />
            <span className="text-sm text-foreground">Set as default address</span>
          </label>
          <div className="flex gap-2 pt-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-border text-sm font-semibold hover:bg-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:brightness-110 disabled:opacity-50"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {isEdit ? "Save changes" : "Add address"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-muted-foreground mb-1.5 block">{label}</span>
      {children}
    </label>
  );
}
