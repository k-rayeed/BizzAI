import { useEffect, useState } from "react";
import { supabase, BUSINESS_ID, configError } from "../supabaseClient";
import FinanceLogin from "./FinanceLogin";
import FinanceEntryForm from "./FinanceEntryForm";
import {
  previousRange,
  summarize,
  change,
  grouped,
} from "./calculations";
import "./finance.css";

function today() {
  return new Date().toLocaleDateString("en-CA", {
    timeZone: "Asia/Dhaka",
  });
}

function money(value, currency) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
  }).format(Number(value));
}

export default function Finance({ mode = "finance" }) {
  const [session, setSession] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [canWrite, setCanWrite] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editing, setEditing] = useState(null);

  const [start, setStart] = useState(today().slice(0, 7) + "-01");
  const [end, setEnd] = useState(today());
  const [currency, setCurrency] = useState("BDT");
  const [group, setGroup] = useState("day");
  const [category, setCategory] = useState("");

  useEffect(() => {
    if (!supabase) {
      setAuthReady(true);
      return;
    }

    let active = true;

    supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      setSession(data.session);
      setAuthReady(true);
      if (error) setError(error.message);
    });

    const { data } = supabase.auth.onAuthStateChange(
  (_event, nextSession) => {
    setSession(nextSession);
    setAuthReady(true);
  }
);
  

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
  setRows([]);
  setReady(false);
  setCanWrite(false);
  setEditing(null);

  if (session?.user?.id) {
    loadRecords();
  }
}, [session?.user?.id]);

  async function loadRecords() {
    setLoading(true);
    setReady(false);
    setError("");

    try {
      const access = await supabase.rpc("finance_access", {
        p_business_id: BUSINESS_ID,
        p_write: false,
      });

      if (access.error) throw access.error;

      if (!access.data) {
        throw new Error(
          "Your account needs VIEW_FINANCES or MANAGE_FINANCES for this business."
        );
      }

      const writeAccess = await supabase.rpc("finance_access", {
        p_business_id: BUSINESS_ID,
        p_write: true,
      });

      if (writeAccess.error) throw writeAccess.error;
      setCanWrite(Boolean(writeAccess.data));

      const all = [];
      let offset = 0;

      while (true) {
        const result = await supabase
          .from("finance_entries")
          .select("*")
          .eq("business_id", BUSINESS_ID)
          .order("entry_date", { ascending: false })
          .order("id")
          .range(offset, offset + 499);

        if (result.error) throw result.error;

        all.push(...result.data);

        if (result.data.length < 500) break;
        offset += 500;
      }

      setRows(all);
      setReady(true);
    } catch (err) {
      setError(err.message || "Could not load financial records.");
      setRows([]);
      setCanWrite(false);
    } finally {
      setLoading(false);
    }
  }

  async function saveRecord(form, receipt) {
    setSaving(true);
    setError("");
    setNotice("");

    let uploadedPath = null;

    try {
      if (receipt) {
        const extensions = {
          "image/jpeg": "jpg",
          "image/png": "png",
          "image/webp": "webp",
        };

        const extension = extensions[receipt.type];

        if (!extension || receipt.size > 5 * 1024 * 1024) {
          throw new Error("Choose a JPG, PNG or WebP photo up to 5 MB.");
        }

        uploadedPath =
          `${BUSINESS_ID}/${crypto.randomUUID()}.${extension}`;

        const upload = await supabase.storage
          .from("finance-receipts")
          .upload(uploadedPath, receipt);

        if (upload.error) throw upload.error;
      }

      const payload = {
        business_id: BUSINESS_ID,
        kind: form.kind,
        entry_date: form.entry_date,
        category: form.category,
        description: form.description,
        amount: form.amount,
        currency: form.currency,
        receipt_path: uploadedPath || form.receipt_path || null,
      };

      const result = form.id
        ? await supabase
            .from("finance_entries")
            .update(payload)
            .eq("id", form.id)
            .eq("business_id", BUSINESS_ID)
            .select("id")
            .single()
        : await supabase
            .from("finance_entries")
            .insert(payload)
            .select("id")
            .single();

      if (result.error) throw result.error;

      // The uploaded receipt is now referenced by the saved record.
      uploadedPath = null;

      let message = "Record saved successfully.";

      if (receipt && form.receipt_path) {
        const cleanup = await supabase.storage
          .from("finance-receipts")
          .remove([form.receipt_path]);

        if (cleanup.error) {
          message += " The old receipt could not be removed.";
        }
      }

      setEditing(null);
      setNotice(message);
      await loadRecords();
    } catch (err) {
      if (uploadedPath) {
        await supabase.storage
          .from("finance-receipts")
          .remove([uploadedPath]);
      }

      throw err;
    } finally {
      setSaving(false);
    }
  }

  async function deleteRecord(row) {
    if (!window.confirm(`Delete "${row.description}"?`)) return;

    setSaving(true);
    setError("");
    setNotice("");

    try {
      const result = await supabase
        .from("finance_entries")
        .delete()
        .eq("id", row.id)
        .eq("business_id", BUSINESS_ID)
        .select("id")
        .single();

      if (result.error) throw result.error;

      let message = "Record deleted.";

      if (row.receipt_path) {
        const cleanup = await supabase.storage
          .from("finance-receipts")
          .remove([row.receipt_path]);

        if (cleanup.error) {
          message += " The unused receipt could not be removed.";
        }
      }

      await loadRecords();
      setNotice(message);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function viewReceipt(path) {
    const { data, error } = await supabase.storage
      .from("finance-receipts")
      .createSignedUrl(path, 60);

    if (error) {
      setError(error.message);
      return;
    }

    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) setError(error.message);
  }

  if (configError) {
    return (
      <div className="page">
        <div className="alert alert-error">{configError}</div>
      </div>
    );
  }

  if (!authReady) {
    return <div className="page" role="status">Checking sign-in…</div>;
  }

  if (!session) {
    return <FinanceLogin onSignedIn={setSession} />;
  }

  const validRange = Boolean(start && end && start <= end);
  const summary = summarize(rows, start, end, currency);
  const prior = validRange ? previousRange(start, end) : null;
  const previous = prior
    ? summarize(rows, prior.start, prior.end, currency)
    : null;

  const chart = grouped(summary.selected, group);
  const maximum = Math.max(
    1,
    ...chart.flatMap((row) => [row.income, row.sales, row.expenses])
  );

  const expenseMode = mode === "expenses";

  const visibleRows = summary.selected.filter(
    (row) =>
      (!expenseMode || row.kind === "expense") &&
      (!expenseMode || !category || row.category === category)
  );

  const categories = [
    ...new Set(
      rows
        .filter((row) => row.kind === "expense")
        .map((row) => row.category)
    ),
  ].sort();

  return (
    <div className="page finance-page">
      <div className="page-heading">
        <div>
          <div className="eyebrow">FINANCE & PAYROLL</div>
          <h1>
            {expenseMode ? "Expense tracking" : "Financial dashboard"}
          </h1>
          <p>Monitor money received and expenses paid.</p>
        </div>

        <div className="finance-actions">
          <button
            className="button button-plain"
            disabled={loading || saving}
            onClick={loadRecords}
          >
            Refresh
          </button>

          <button
            className="button button-plain"
            disabled={saving}
            onClick={signOut}
          >
            Sign out
          </button>

          {canWrite && (
            <button
              className="button button-primary"
              disabled={loading || saving}
              onClick={() => {
                setEditing({ kind: "expense" });
                setError("");
                setNotice("");
              }}
            >
              + Add record
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="alert alert-error" role="alert">{error}</div>
      )}

      {notice && (
        <div className="alert alert-success" role="status">
          {notice}
        </div>
      )}

      <div className="finance-filters">
        <label>
          From
          <input
            type="date"
            value={start}
            onChange={(e) => setStart(e.target.value)}
          />
        </label>

        <label>
          To
          <input
            type="date"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
          />
        </label>

        <label>
          Currency
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
          >
            {["BDT", "USD", "EUR"].map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>

        {expenseMode && (
          <label>
            Category
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="">All categories</option>
              {categories.map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
        )}
      </div>

      {!validRange && (
        <p role="alert">
          Choose a start date on or before the end date.
        </p>
      )}

      {loading && <p role="status">Loading financial records…</p>}

      {ready && validRange && !expenseMode && (
        <>
          <p className="finance-note">
            Cash-basis report. Sales are included in income.
            Currencies are reported separately. Unpaid invoices and
            inventory valuation are excluded.
            Previous period: {prior.start} to {prior.end}.
          </p>

          <div className="stats-grid">
            {[
              ["income", "Total income"],
              ["sales", "Sales"],
              ["expenses", "Expenses"],
              ["profit", "Cash profit / loss"],
            ].map(([key, label]) => (
              <div className="stat-card" key={key}>
                <div className="stat-label">{label}</div>
                <div className="stat-value">
                  {money(summary[key], currency)}
                </div>
                <div className="stat-detail">
                  {change(summary[key], previous[key])}
                </div>
              </div>
            ))}
          </div>

          <section className="content-card finance-chart">
            <div className="section-heading">
              <h2>Financial performance</h2>
              <label>
                Group by{" "}
                <select
                  value={group}
                  onChange={(e) => setGroup(e.target.value)}
                >
                  <option value="day">Day</option>
                  <option value="month">Month</option>
                  <option value="category">Category</option>
                </select>
              </label>
            </div>

            <div className="finance-legend">
              <span>● Income</span>
              <span>● Sales — part of income</span>
              <span>● Expenses</span>
            </div>

            {chart.length === 0 && (
              <p>No records for this period and currency.</p>
            )}

            {chart.map((bucket) => (
              <div className="finance-chart-row" key={bucket.label}>
                <strong>{bucket.label}</strong>
                <div>
                  {["income", "sales", "expenses"].map((key) => (
                    <div className="finance-bar-line" key={key}>
                      <div
                        className={`finance-bar ${key}`}
                        style={{
                          width: `${(bucket[key] / maximum) * 100}%`,
                        }}
                      />
                      <span>
                        {key}: {money(bucket[key], currency)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </section>
        </>
      )}

      {ready && validRange && (
        <section className="content-card">
          <div className="section-heading">
            <h2>
              {expenseMode ? "Expense records" : "Financial records"}
            </h2>
            <span>{visibleRows.length} records</span>
          </div>

          <div className="table-scroll">
            <table className="employee-table">
              <thead>
                <tr>
                  {[
                    "Date",
                    "Type",
                    "Description",
                    "Category",
                    "Amount",
                    "Receipt",
                    "Actions",
                  ].map((heading) => (
                    <th key={heading}>{heading}</th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {visibleRows.map((row) => (
                  <tr key={row.id}>
                    <td>{row.entry_date}</td>
                    <td>{row.kind}</td>
                    <td>{row.description}</td>
                    <td>{row.category}</td>
                    <td>{money(row.amount, row.currency)}</td>
                    <td>
                      {row.receipt_path ? (
                        <button
                          className="button button-plain"
                          onClick={() => viewReceipt(row.receipt_path)}
                        >
                          View receipt
                        </button>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>
                      {canWrite && (
                        <div className="finance-actions">
                          <button
                            className="button button-plain"
                            disabled={saving}
                            onClick={() => setEditing({ ...row })}
                          >
                            Edit
                          </button>
                          <button
                            className="button button-plain"
                            disabled={saving}
                            onClick={() => deleteRecord(row)}
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}

                {visibleRows.length === 0 && (
                  <tr>
                    <td colSpan={7} className="table-message">
                      No records match these filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {editing && (
        <FinanceEntryForm
          key={editing.id || "new"}
          initial={editing}
          onSave={saveRecord}
          onCancel={() => setEditing(null)}
        />
      )}
    </div>
  );
}