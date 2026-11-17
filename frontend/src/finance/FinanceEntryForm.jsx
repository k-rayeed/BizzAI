import { useState } from "react";

function today() {
  return new Date().toLocaleDateString("en-CA", {
    timeZone: "Asia/Dhaka",
  });
}

export default function FinanceEntryForm({
  initial,
  onSave,
  onCancel,
}) {
  const [form, setForm] = useState({
    kind: "expense",
    entry_date: today(),
    category: "",
    description: "",
    amount: "",
    currency: "BDT",
    ...initial,
  });

  const [receipt, setReceipt] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function submit(event) {
    event.preventDefault();
    setError("");

    const amount = Number(form.amount);

    if (!form.category.trim() || !form.description.trim()) {
      setError("Enter a category and description.");
      return;
    }

    if (
      !Number.isFinite(amount) ||
      amount <= 0 ||
      amount > 999999999999.99
    ) {
      setError("Enter a valid positive amount.");
      return;
    }

    if (receipt) {
      const allowed = ["image/jpeg", "image/png", "image/webp"];

      if (!allowed.includes(receipt.type)) {
        setError("Choose a JPG, PNG or WebP receipt photo.");
        return;
      }

      if (receipt.size > 5 * 1024 * 1024) {
        setError("The receipt photo must be 5 MB or smaller.");
        return;
      }
    }

    setBusy(true);

    try {
      await onSave(
        {
          ...form,
          category: form.category.trim(),
          description: form.description.trim(),
          amount,
        },
        receipt
      );
    } catch (err) {
      setError(err.message || "Could not save the record.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop">
      <section
        className="employee-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="finance-form-title"
      >
        <div className="modal-heading">
          <div>
            <h2 id="finance-form-title">
              {form.id ? "Edit financial record" : "Add financial record"}
            </h2>
            <p>Record money received or expenses already paid.</p>
          </div>
        </div>

        <form onSubmit={submit}>
          <div className="form-grid">
            <label>
              Record type
              <select
                value={form.kind}
                onChange={(e) => update("kind", e.target.value)}
              >
                <option value="expense">Expense paid</option>
                <option value="sale">Sale received</option>
                <option value="income">Other income received</option>
              </select>
            </label>

            <label>
              Date
              <input
                type="date"
                required
                value={form.entry_date}
                onChange={(e) => update("entry_date", e.target.value)}
              />
            </label>

            <label>
              Category
              <input
                autoFocus
                required
                maxLength={80}
                placeholder="For example: Rent, Travel, Sales"
                value={form.category}
                onChange={(e) => update("category", e.target.value)}
              />
            </label>

            <label>
              Description
              <input
                required
                maxLength={500}
                placeholder="What was this payment for?"
                value={form.description}
                onChange={(e) => update("description", e.target.value)}
              />
            </label>

            <label>
              Amount
              <input
                type="number"
                required
                min="0.01"
                max="999999999999.99"
                step="0.01"
                value={form.amount}
                onChange={(e) => update("amount", e.target.value)}
              />
            </label>

            <label>
              Currency
              <select
                value={form.currency}
                onChange={(e) => update("currency", e.target.value)}
              >
                <option value="BDT">BDT</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
              </select>
            </label>

            <label>
              Receipt photo — optional
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) =>
                  setReceipt(e.target.files?.[0] || null)
                }
              />
              <small>JPG, PNG or WebP. Maximum 5 MB.</small>
              {form.receipt_path && (
                <small>
                  Your existing receipt will be kept unless replaced.
                </small>
              )}
            </label>
          </div>

          <p className="finance-note">
            Sales count toward total income. Do not enter the same
            sale again as other income.
          </p>

          {error && (
            <div className="alert alert-error" role="alert">
              {error}
            </div>
          )}

          <div className="modal-actions">
            <button
              type="button"
              className="button button-plain"
              disabled={busy}
              onClick={onCancel}
            >
              Cancel
            </button>

            <button
              type="submit"
              className="button button-primary"
              disabled={busy}
            >
              {busy ? "Saving…" : "Save record"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}