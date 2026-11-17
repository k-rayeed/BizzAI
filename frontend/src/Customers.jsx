import { useEffect, useMemo, useState } from "react";
import { Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { supabase, BUSINESS_ID, configError } from "./supabaseClient";

const emptyCustomer = { name: "", email: "", phone: "", notes: "" };

export default function Customers() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState(configError);
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyCustomer);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  async function loadCustomers() {
    if (!supabase) {
      setLoading(false);
      return;
    }
    const { data, error } = await supabase.rpc("list_customers", {
      p_business_id: BUSINESS_ID,
    });
    if (error) {
      setPageError(`Could not load customers: ${error.message}`);
    } else {
      setCustomers(data || []);
      setPageError("");
    }
    setLoading(false);
  }

  useEffect(() => {
    loadCustomers();
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 3500);
    return () => clearTimeout(timer);
  }, [notice]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return customers.filter((c) =>
      [c.name, c.email, c.phone].some((v) => (v || "").toLowerCase().includes(q)),
    );
  }, [customers, search]);

  function openCreate() {
    setForm(emptyCustomer);
    setFormError("");
    setModalOpen(true);
  }

  function openEdit(c) {
    setForm({ ...emptyCustomer, ...c });
    setFormError("");
    setModalOpen(true);
  }

  async function saveCustomer(e) {
    e.preventDefault();
    if (!supabase) return setFormError(configError);
    setSaving(true);
    setFormError("");
    const { error } = await supabase.rpc("save_customer", {
      p_business_id: BUSINESS_ID,
      p_customer: { ...form, id: form.id || null },
    });
    setSaving(false);
    if (error) return setFormError(error.message);
    setModalOpen(false);
    await loadCustomers();
    setNotice(form.id ? "Customer updated successfully." : "Customer added successfully.");
  }

  async function deleteCustomer(c) {
    if (!window.confirm(`Delete ${c.name}?`)) return;
    const { error } = await supabase.rpc("delete_customer", {
      p_business_id: BUSINESS_ID,
      p_customer_id: c.id,
    });
    if (error) return setPageError(`Could not delete customer: ${error.message}`);
    await loadCustomers();
    setNotice("Customer deleted.");
  }

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  return (
    <div className="page">
      <div className="page-heading">
        <div>
          <div className="eyebrow">CUSTOMERS & COMMUNICATION</div>
          <h1>Customer management</h1>
          <p>Keep customer records and internal notes in one place.</p>
        </div>
        <button className="button button-primary" onClick={openCreate}>
          <Plus size={17} /> Add customer
        </button>
      </div>

      {pageError && <div className="alert alert-error">{pageError}</div>}
      {notice && <div className="alert alert-success">{notice}</div>}

      <section className="content-card">
        <div className="section-heading">
          <div>
            <h2>Your customers</h2>
            <p>Search by name, email, or phone.</p>
          </div>
          <span className="record-count">{customers.length} total</span>
        </div>
        <div className="table-tools">
          <div className="search-box">
            <Search size={17} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, email, or phone..."
            />
          </div>
        </div>
        <div className="table-scroll">
          <table className="employee-table">
            <thead>
              <tr>
                <th>CUSTOMER</th>
                <th>EMAIL</th>
                <th>PHONE</th>
                <th>INTERNAL NOTES</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan="5" className="table-message">
                    {loading
                      ? "Loading customers..."
                      : customers.length
                        ? "No customers match your search."
                        : "No customers yet. Add your first one to get started."}
                  </td>
                </tr>
              ) : (
                filtered.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <strong>{c.name}</strong>
                    </td>
                    <td>{c.email || <span className="subtle">Not provided</span>}</td>
                    <td>{c.phone}</td>
                    <td>{c.notes}</td>
                    <td>
                      <div className="row-actions">
                        <button className="icon-button" title="Edit customer" onClick={() => openEdit(c)}>
                          <Pencil size={16} />
                        </button>
                        <button className="icon-button delete-action" title="Delete customer" onClick={() => deleteCustomer(c)}>
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {modalOpen && (
        <div
          className="modal-backdrop"
          onMouseDown={(e) => e.target === e.currentTarget && setModalOpen(false)}
        >
          <form className="employee-modal" onSubmit={saveCustomer}>
            <div className="modal-heading">
              <div>
                <div className="eyebrow">{form.id ? "UPDATE CUSTOMER" : "NEW CUSTOMER"}</div>
                <h2>{form.id ? "Edit customer" : "Add customer"}</h2>
              </div>
              <button type="button" className="icon-button" onClick={() => setModalOpen(false)}>
                <X size={19} />
              </button>
            </div>
            {formError && <div className="alert alert-error compact">{formError}</div>}
            <div className="form-grid">
              <label>
                Full name <input required maxLength="120" value={form.name} onChange={set("name")} />
              </label>
              <label>
                Email <input type="email" value={form.email || ""} onChange={set("email")} />
              </label>
              <label>
                Phone <input value={form.phone || ""} onChange={set("phone")} />
              </label>
              <label>
                Internal notes <input value={form.notes || ""} onChange={set("notes")} />
              </label>
            </div>
            <div className="modal-actions">
              <button type="button" className="button button-plain" onClick={() => setModalOpen(false)}>
                Cancel
              </button>
              <button className="button button-primary" disabled={saving}>
                {saving ? "Saving..." : form.id ? "Save changes" : "Add customer"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}