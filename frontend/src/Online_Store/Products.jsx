
import { useEffect, useState } from "react";
import { supabase, BUSINESS_ID } from "../supabaseClient";
import { Package, RefreshCw, AlertTriangle, Plus, X, Pencil, Trash2 } from "lucide-react";

export default function Products() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);

  const [formData, setFormData] = useState({
  name: "",
  description: "",
  price: "",
  stock_quantity: "",
  low_stock_threshold: "5",
  });
  const [editingProduct, setEditingProduct] = useState(null);

  async function fetchProducts() {
    setLoading(true);
    setError("");

    try {
      if (!supabase || !BUSINESS_ID) {
        throw new Error("Supabase or Business ID is not configured.");
      }

      const { data, error } = await supabase.rpc("list_products", {
        p_business_id: BUSINESS_ID,
      });

      if (error) throw error;

      setProducts(data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleAddProduct(e) {
    e.preventDefault();

    try {
        const { error } = await supabase.rpc("add_product", {
        p_business_id: BUSINESS_ID,
        p_name: formData.name,
        p_description: formData.description,
        p_price: Number(formData.price),
        p_stock_quantity: Number(formData.stock_quantity),
        p_low_stock_threshold: Number(formData.low_stock_threshold),
        });

        if (error) throw error;

        setFormData({
        name: "",
        description: "",
        price: "",
        stock_quantity: "",
        low_stock_threshold: "5",
        });

        setShowForm(false);
        fetchProducts();
    } catch (err) {
        alert("Could not add product: " + err.message);
    }
  }
  function handleEditClick(product) {
    setEditingProduct(product);

    setFormData({
        name: product.name || "",
        description: product.description || "",
        price: String(product.price ?? ""),
        stock_quantity: String(product.stock_quantity ?? ""),
        low_stock_threshold: String(product.low_stock_threshold ?? 5),
    });

    setShowForm(true);
    }

    async function handleUpdateProduct(e) {
        e.preventDefault();

        try {
            const { error } = await supabase.rpc("update_product", {
            p_product_id: editingProduct.id,
            p_business_id: BUSINESS_ID,
            p_name: formData.name,
            p_description: formData.description,
            p_price: Number(formData.price),
            p_stock_quantity: Number(formData.stock_quantity),
            p_low_stock_threshold: Number(formData.low_stock_threshold),
            });

            if (error) throw error;

            setEditingProduct(null);
            setShowForm(false);

            setFormData({
            name: "",
            description: "",
            price: "",
            stock_quantity: "",
            low_stock_threshold: "5",
            });

            await fetchProducts();
        } catch (err) {
            alert("Could not update product: " + err.message);
        }
    }
    async function handleDeleteProduct(productId) {
        const confirmed = window.confirm(
            "Are you sure you want to delete this product?"
        );

        if (!confirmed) return;

        try {
            const { error } = await supabase.rpc("delete_product", {
            p_product_id: productId,
            p_business_id: BUSINESS_ID,
            });

            if (error) throw error;

            await fetchProducts();
            alert("Product deleted successfully!");
        } catch (err) {
            alert("Could not delete product: " + err.message);
        }
    }

  useEffect(() => {
    fetchProducts();
  }, []);

  const lowStockCount = products.filter(
    (product) =>
      product.stock_quantity <= (product.low_stock_threshold ?? 5)
  ).length;

  if (loading) {
    return <div style={{ padding: "30px" }}>Loading products...</div>;
  }

  return (
    <div style={{ padding: "30px", color: "#000000" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1>Product Management</h1>
          <p style={{ color: "#999" }}>Manage your products and inventory.</p>
        </div>

        <div style={{ display: "flex", gap: "10px" }}>
            <button onClick={() => setShowForm(true)}>
                <Plus size={16} /> Add Product
            </button>

            <button onClick={fetchProducts}>
                <RefreshCw size={16} /> Refresh
            </button>
        </div>
      </div>

      {error && (
        <p style={{ color: "#ff6b6b" }}>
          Error: {error}
        </p>
      )}
      {showForm && (
        <form
            onSubmit={editingProduct ? handleUpdateProduct : handleAddProduct}
            style={{
            background: "#f2f2f2",
            color: "#000",
            padding: "20px",
            borderRadius: "10px",
            marginBottom: "25px",
            maxWidth: "500px",
            }}
        >
            <div style={{ display: "flex", justifyContent: "space-between" }}>
            <h2>{editingProduct ? "Edit Product" : "Add New Product"}</h2>
            <button type="button" onClick={() => setShowForm(false)}>
                <X size={18} />
            </button>
            </div>

            <label>Product Name</label>
            <input
            required
            type="text"
            value={formData.name}
            onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
            }
            style={{ width: "100%", padding: "10px", margin: "8px 0 15px" }}
            />

            <label>Description</label>
            <textarea
            value={formData.description}
            onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
            }
            style={{ width: "100%", padding: "10px", margin: "8px 0 15px" }}
            />

            <label>Price</label>
            <input
            required
            type="number"
            min="0"
            step="0.01"
            value={formData.price}
            onChange={(e) =>
                setFormData({ ...formData, price: e.target.value })
            }
            style={{ width: "100%", padding: "10px", margin: "8px 0 15px" }}
            />

            <label>Stock Quantity</label>
            <input
            required
            type="number"
            min="0"
            step="1"
            value={formData.stock_quantity}
            onChange={(e) =>
                setFormData({ ...formData, stock_quantity: e.target.value })
            }
            style={{ width: "100%", padding: "10px", margin: "8px 0 15px" }}
            />

            <label>Low Stock Warning Level</label>
            <input
            required
            type="number"
            min="0"
            step="1"
            value={formData.low_stock_threshold}
            onChange={(e) =>
                setFormData({ ...formData, low_stock_threshold: e.target.value })
            }
            style={{ width: "100%", padding: "10px", margin: "8px 0 15px" }}
            />

            <button type="submit">
                {editingProduct ? "Update Product" : "Save Product"}
            </button>
        </form>
        )}

      <div style={{ display: "flex", gap: "20px", margin: "25px 0" }}>
        <div>
          <Package size={20} />
          <h2>{products.length}</h2>
          <p>Total Products</p>
        </div>

        <div>
          <AlertTriangle size={20} color="#f1c40f" />
          <h2>{lowStockCount}</h2>
          <p>Low Stock Products</p>
        </div>
      </div>

      {products.length === 0 ? (
        <p>No products found for this business.</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
            <thead>
              <tr>
                <th style={{ padding: "12px" }}>Product</th>
                <th style={{ padding: "12px" }}>Category</th>
                <th style={{ padding: "12px" }}>Price</th>
                <th style={{ padding: "12px" }}>Stock</th>
                <th style={{ padding: "12px" }}>Status</th>
                <th style={{ padding: "12px" }}>Actions</th>
              </tr>
            </thead>

            <tbody>
              {products.map((product) => {
                const lowStock =
                  product.stock_quantity <= (product.low_stock_threshold ?? 5);

                return (
                  <tr key={product.id} style={{ borderTop: "1px solid #333" }}>
                    <td style={{ padding: "12px" }}>
                      <strong>{product.name}</strong>
                    </td>
                    <td style={{ padding: "12px" }}>
                      {product.category_name || "Uncategorized"}
                    </td>
                    <td style={{ padding: "12px" }}>
                      {Number(product.price).toFixed(2)}
                    </td>
                    <td style={{ padding: "12px" }}>
                      {product.stock_quantity}
                    </td>
                    <td style={{ padding: "12px" }}>
                      {lowStock ? (
                        <span style={{ color: "#f1c40f" }}>Low Stock</span>
                      ) : (
                        <span style={{ color: "#2ecc71" }}>In Stock</span>
                      )}
                    </td>
                    <td style={{ padding: "12px" }}>
                        <div style={{ display: "flex", gap: "8px" }}>
                            <button onClick={() => handleEditClick(product)}>
                                <Pencil size={15} /> Edit
                            </button>

                            <button onClick={() => handleDeleteProduct(product.id)}>
                                <Trash2 size={15} /> Delete
                            </button>
                        </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
