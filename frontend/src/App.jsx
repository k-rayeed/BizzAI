import { useEffect, useMemo, useState } from "react";
import Products from "./Online_Store/Products";
import {
  Activity,
  BriefcaseBusiness,
  Building2,
  Package,
  ChevronDown,
  CircleHelp,
  LayoutDashboard,
  Menu,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  Trash2,
  UserRound,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { supabase, BUSINESS_ID, configError } from "./supabaseClient";
import Customers from "./Customers.jsx";


const emptyEmployee = {
  name: "",
  email: "",
  phone: "",
  jobTitle: "",
  role: "EMPLOYEE",
  salary: "",
  salaryCurrency: "BDT",
  department: "",
  employmentType: "",
  hireDate: "",
  permissions: [],
};

const permissionOptions = [
  ["VIEW_DASHBOARD", "View dashboard"],
  ["MANAGE_PRODUCTS", "Manage products"],
  ["MANAGE_ORDERS", "Manage orders"],
  ["MANAGE_CUSTOMERS", "Manage customers"],
  ["MANAGE_INVENTORY", "Manage inventory"],
  ["VIEW_FINANCES", "View finances"],
  ["MANAGE_FINANCES", "Manage finances"],
  ["MANAGE_TASKS", "Manage tasks"],
  ["MANAGE_DOCUMENTS", "Manage documents"],
  ["MANAGE_EMPLOYEES", "Manage employees"],
];

function formatSalary(value, currency = "BDT") {
  if (value === null || value === undefined || value === "") return "Not set";
  return `${currency} ${Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function getInitials(name = "") {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "EM"
  );
}

function App() {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState(configError);
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [mobileNav, setMobileNav] = useState(false);
  const [view, setView] = useState("employees");


  async function loadEmployees() {
    if (!supabase) {
      setLoading(false);
      return;
    }
    const { data, error } = await supabase.rpc("list_employees", {
      p_business_id: BUSINESS_ID,
    });
    if (error) {
      setPageError(`Could not load employees: ${error.message}`);
    } else {
      setEmployees(data || []);
      setPageError("");
    }
    setLoading(false);
  }

  useEffect(() => {
    loadEmployees();
  }, []);

  const filtered = useMemo(
    () =>
      employees.filter((employee) => {
        const query = search.toLowerCase();
        const matchesSearch = [
          employee.name,
          employee.email,
          employee.jobTitle,
        ].some((value) => (value || "").toLowerCase().includes(query));
        const matchesRole =
          roleFilter === "ALL" || employee.role === roleFilter;
        return matchesSearch && matchesRole;
      }),
    [employees, search, roleFilter],
  );

  const totalSalary = employees.reduce((sum, employee) => {
    if ((employee.salaryCurrency || "BDT") !== "BDT") return sum;
    return sum + Number(employee.salary || 0);
  }, 0);

  const counts = {
    total: employees.length,
    employees: employees.filter((e) => e.role === "EMPLOYEE").length,
    managers: employees.filter((e) => e.role === "MANAGER").length,
    admins: employees.filter((e) => e.role === "ADMIN").length,
  };

  function openCreate() {
    setEditing(null);
    setModalOpen(true);
  }

  function openEdit(employee) {
    setEditing(employee);
    setModalOpen(true);
  }

  async function saveEmployee(form) {
    if (!supabase) throw new Error(configError);
    const payload = {
      ...form,
      id: editing ? editing.id : null,
      salary: form.salary === "" ? null : Number(form.salary),
    };
    const { error } = await supabase.rpc("save_employee", {
      p_business_id: BUSINESS_ID,
      p_employee: payload,
    });
    if (error) throw new Error(error.message);

    await loadEmployees();
    setNotice(
      editing
        ? "Employee details updated successfully."
        : "Employee added successfully.",
    );
    setModalOpen(false);
    setEditing(null);
  }

  async function deleteEmployee(employee) {
    if (!window.confirm(`Delete ${employee.name}'s employee profile?`)) return;
    const { error } = await supabase.rpc("delete_employee", {
      p_business_id: BUSINESS_ID,
      p_employee_id: employee.id,
    });
    if (error) {
      setPageError(`Could not delete employee: ${error.message}`);
      return;
    }
    await loadEmployees();
    setNotice("Employee profile deleted.");
  }

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 3500);
    return () => clearTimeout(timer);
  }, [notice]);

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileNav ? "sidebar-open" : ""}`}>
        <div className="brand">
          <div className="brand-mark">B</div>
          <span>
            Bizz<span className="brand-ai">AI</span>
          </span>
          <button
            className="mobile-close icon-button"
            onClick={() => setMobileNav(false)}
            aria-label="Close menu"
          >
            <X size={18} />
          </button>
        </div>
        <div className="workspace-switch">
          <div className="workspace-icon">
            <Building2 size={17} />
          </div>
          <div>
            <strong>Acme Workspace</strong>
            <small>Business account</small>
          </div>
          <ChevronDown size={15} className="muted-icon" />
        </div>
        <div className="nav-label">WORKSPACE</div>
        <nav>
          <a className="nav-item" href="#dashboard">
            <LayoutDashboard size={18} /> Dashboard
          </a>
          <a
<a
  className={`nav-item ${view === "employees" ? "active" : ""}`}
  href="#employees"
  onClick={(e) => {
    e.preventDefault();
    setView("employees");
    setMobileNav(false);
  }}
>
  <Users size={18} /> Employees
  <span className="nav-count">{employees.length}</span>
</a>

<a
  className={`nav-item ${view === "customers" ? "active" : ""}`}
  href="#customers"
  onClick={(e) => {
    e.preventDefault();
    setView("customers");
    setMobileNav(false);
  }}
>
  <UserRound size={18} /> Customers
</a>

<a
  className={`nav-item ${view === "products" ? "active" : ""}`}
  href="#products"
  onClick={(e) => {
    e.preventDefault();
    setView("products");
    setMobileNav(false);
  }}
>
  <Package size={18} /> Products
</a>
          </a>
        </nav>
        <div className="sidebar-bottom">
          <a className="nav-item" href="#settings">
            <Settings size={18} /> Settings
          </a>
          <a className="nav-item" href="#help">
            <CircleHelp size={18} /> Help & support
          </a>
          <div className="profile-mini">
            <div className="profile-avatar">ZA</div>
            <div>
              <strong>Business Owner</strong>
              <small>Owner account</small>
            </div>
            <MoreHorizontal size={18} className="muted-icon" />
          </div>
        </div>
      </aside>

      {mobileNav && (
        <button
          className="nav-scrim"
          onClick={() => setMobileNav(false)}
          aria-label="Close navigation"
        />
      )}

      <main className="main-content">
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="mobile-menu icon-button"
              onClick={() => setMobileNav(true)}
              aria-label="Open menu"
            >
              <Menu size={20} />
            </button>
            <div className="breadcrumb">
              Workspace <span>/</span> <strong>{view === "customers" ? "Customer management" : "Employee management"}</strong>
            </div>
          </div>
          <div className="topbar-right">
            <span className="status-dot"></span>
            <span className="online-label">Workspace active</span>
            <div className="top-avatar">ZA</div>
          </div>
        </header>

{view === "products" ? (
  <Products />
) : view === "customers" ? (
  <Customers />
) : (
  <div className="page">
          <div className="page-heading">
            <div>
              <div className="eyebrow">TEAM WORKSPACE</div>
              <h1>Employee management</h1>
              <p>
                Manage your people, assign roles, and control access to your
                business.
              </p>
            </div>
            <button className="button button-primary" onClick={openCreate}>
              <Plus size={17} /> Add employee
            </button>
          </div>
          {pageError && <div className="alert alert-error">{pageError}</div>}
          {notice && <div className="alert alert-success">{notice}</div>}
          <section className="stats-grid">
            <StatCard
              icon={<Users size={19} />}
              label="Total employees"
              value={counts.total}
              detail="In your workspace"
              tone="violet"
            />
            <StatCard
              icon={<BriefcaseBusiness size={19} />}
              label="Managers"
              value={counts.managers}
              detail="Team leadership"
              tone="blue"
            />
            <StatCard
              icon={<ShieldCheck size={19} />}
              label="Administrators"
              value={counts.admins}
              detail="Elevated access"
              tone="orange"
            />
            <StatCard
              icon={<Wallet size={19} />}
              label="Monthly payroll · BDT"
              value={`৳${totalSalary.toLocaleString()}`}
              detail="Only BDT salaries included"
              tone="green"
            />
          </section>

          <section className="content-card">
            <div className="section-heading">
              <div>
                <h2>Your team</h2>
                <p>A directory of employees in your business.</p>
              </div>
              <span className="record-count">
                {employees.length}{" "}
                {employees.length === 1 ? "member" : "members"}
              </span>
            </div>
            <div className="table-tools">
              <div className="search-box">
                <Search size={17} />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search name, email, or job title..."
                />
              </div>
              <select
                className="filter-select"
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                aria-label="Filter by role"
              >
                <option value="ALL">All roles</option>
                <option value="EMPLOYEE">Employee</option>
                <option value="MANAGER">Manager</option>
                <option value="ADMIN">Administrator</option>
              </select>
            </div>

            <div className="table-scroll">
              <table className="employee-table">
                <thead>
                  <tr>
                    <th>EMPLOYEE</th>
                    <th>ROLE</th>
                    <th>JOB TITLE</th>
                    <th>SALARY</th>
                    <th>PERMISSIONS</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="table-message">
                        {loading
                          ? "Loading employees..."
                          : employees.length
                          ? "No employees match your search."
                          : "No employees yet. Add your first team member to get started."}
                      </td>
                    </tr>
                  ) : (
                    filtered.map((employee) => (
                      <tr key={employee.id}>
                        <td>
                          <div className="employee-cell">
                            <div className="employee-avatar">
                              {getInitials(employee.name)}
                            </div>
                            <div>
                              <strong>{employee.name}</strong>
                              <small>{employee.email}</small>
                            </div>
                          </div>
                        </td>
                        <td>
                          <RoleBadge role={employee.role} />
                        </td>
                        <td>
                          {employee.jobTitle || (
                            <span className="subtle">Not specified</span>
                          )}
                        </td>
                        <td className="salary-cell">
                          {formatSalary(
                            employee.salary,
                            employee.salaryCurrency,
                          )}
                        </td>
                        <td>
                          <span className="permission-count">
                            <ShieldCheck size={14} />
                            {(employee.permissions || []).length} assigned
                          </span>
                        </td>
                        <td>
                          <div className="row-actions">
                            <button
                              className="icon-button"
                              title="Edit employee"
                              onClick={() => openEdit(employee)}
                            >
                              <Pencil size={16} />
                            </button>
                            <button
                              className="icon-button delete-action"
                              title="Delete employee"
                              onClick={() => deleteEmployee(employee)}
                            >
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
            <div className="table-footer">
              <span>
                Showing {filtered.length} of {employees.length} employees
              </span>
              <span>Saved in Supabase</span>
            </div>
          </section>

          <div className="bottom-note">
            <ShieldCheck size={16} /> Employee changes are saved to your
            Supabase database and shared across devices.
          </div>
        </div>
        )}

      </main>
      {modalOpen && (
        <EmployeeModal
          employee={editing}
          onClose={() => setModalOpen(false)}
          onSave={saveEmployee}
        />
      )}
    </div>
  );
}

function StatCard({ icon, label, value, detail, tone }) {
  return (
    <div className="stat-card">
      <div className={`stat-icon ${tone}`}>{icon}</div>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      <div className="stat-detail">{detail}</div>
    </div>
  );
}

function RoleBadge({ role }) {
  const label =
    role === "ADMIN"
      ? "Administrator"
      : role === "MANAGER"
        ? "Manager"
        : "Employee";
  return (
    <span className={`role-badge ${role?.toLowerCase() || "employee"}`}>
      <span />
      {label}
    </span>
  );
}

function EmployeeModal({ employee, onClose, onSave }) {
  const [form, setForm] = useState(() =>
    employee
      ? {
          ...emptyEmployee,
          ...employee,
          salary: employee.salary ?? "",
          permissions: employee.permissions || [],
        }
      : { ...emptyEmployee },
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function update(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function togglePermission(permission) {
    update(
      "permissions",
      form.permissions.includes(permission)
        ? form.permissions.filter((item) => item !== permission)
        : [...form.permissions, permission],
    );
  }

  async function submit(event) {
    event.preventDefault();
    setError("");
    setSaving(true);
    try {
      await onSave(form);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <form className="employee-modal" onSubmit={submit}>
        <div className="modal-heading">
          <div>
            <div className="eyebrow">
              {employee ? "UPDATE TEAM MEMBER" : "NEW TEAM MEMBER"}
            </div>
            <h2>{employee ? "Edit employee" : "Add employee"}</h2>
            <p>Enter profile details, salary, and access permissions.</p>
          </div>
          <button type="button" className="icon-button" onClick={onClose}>
            <X size={19} />
          </button>
        </div>
        {error && <div className="alert alert-error compact">{error}</div>}
        <div className="form-section-title">Personal information</div>
        <div className="form-grid">
          <label>
            Full name{" "}
            <input
              required
              maxLength="120"
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
              placeholder="e.g. Ayesha Rahman"
            />
          </label>
          <label>
            Email address{" "}
            <input
              required
              type="email"
              maxLength="180"
              value={form.email}
              onChange={(e) => update("email", e.target.value)}
              placeholder="name@company.com"
            />
          </label>
          <label>
            Phone number{" "}
            <input
              value={form.phone || ""}
              onChange={(e) => update("phone", e.target.value)}
              placeholder="+880 1XXXXXXXXX"
            />
          </label>
          <label>
            Job title{" "}
            <input
              value={form.jobTitle || ""}
              onChange={(e) => update("jobTitle", e.target.value)}
              placeholder="e.g. Sales Executive"
            />
          </label>
        </div>
        <div className="form-section-title">Role & compensation</div>
        <div className="form-grid">
          <label>
            Employee role{" "}
            <select
              value={form.role}
              onChange={(e) => update("role", e.target.value)}
            >
              <option value="EMPLOYEE">Employee</option>
              <option value="MANAGER">Manager</option>
              <option value="ADMIN">Administrator</option>
            </select>
          </label>
          <label>
            Monthly salary{" "}
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.salary}
              onChange={(e) => update("salary", e.target.value)}
              placeholder="0.00"
            />
          </label>
          <label>
            Salary currency{" "}
            <select
              value={form.salaryCurrency || "BDT"}
              onChange={(e) => update("salaryCurrency", e.target.value)}
            >
              <option value="BDT">BDT — Bangladeshi Taka</option>
              <option value="USD">USD — US Dollar</option>
              <option value="EUR">EUR — Euro</option>
            </select>
          </label>
        </div>
        <div className="form-section-title permission-title">
          Feature permissions <span>{form.permissions.length} selected</span>
        </div>
        <p className="permission-help">
          Choose which areas this employee can access or manage.
        </p>
        <div className="permission-grid">
          {permissionOptions.map(([value, label]) => (
            <label className="permission-option" key={value}>
              <input
                type="checkbox"
                checked={form.permissions.includes(value)}
                onChange={() => togglePermission(value)}
              />
              <span className="custom-check">
                <span />
              </span>
              <span>{label}</span>
            </label>
          ))}
        </div>
        <div className="modal-actions">
          <button
            type="button"
            className="button button-plain"
            onClick={onClose}
          >
            Cancel
          </button>
          <button className="button button-primary" disabled={saving}>
            {saving ? "Saving..." : employee ? "Save changes" : "Add employee"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default App;