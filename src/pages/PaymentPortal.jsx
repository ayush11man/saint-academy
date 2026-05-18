import { useState, useEffect } from "react";
import { db, auth } from "../firebase";
import { collection, addDoc, serverTimestamp, updateDoc, doc } from "firebase/firestore";

export default function PaymentPortal({ profile, onClose, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMode, setSuccessMode] = useState(false);
  const [mockOrder, setMockOrder] = useState(null);

  const loadRazorpayScript = () => {
    return new Promise((resolve) => {
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const handlePayment = async () => {
    setLoading(true);
    setError("");
    setMockOrder(null);

    const res = await loadRazorpayScript();
    if (!res) {
      setError("Razorpay SDK failed to load. Are you online?");
      setLoading(false);
      return;
    }

    try {
      const orderResponse = await fetch("/api/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: 19900, currency: "INR" }) // ₹199
      });
      const orderData = await orderResponse.json();

      if (orderData.error) throw new Error(orderData.error);

      // Detect Sandbox/Mock order mode
      if (orderData.isMock) {
        setMockOrder(orderData);
        setLoading(false);
        return;
      }

      const options = {
        key: import.meta.env.VITE_RAZORPAY_KEY_ID,
        amount: orderData.amount,
        currency: orderData.currency,
        name: "Saint Academy",
        description: "Premium Upgrade",
        order_id: orderData.id,
        handler: async function (response) {
          try {
            setLoading(true);
            const verifyResponse = await fetch("/api/verify-payment", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(response)
            });
            const verifyData = await verifyResponse.json();

            if (verifyData.success) {
              const userId = auth.currentUser?.uid;
              if (userId) {
                // Automatically upgrade the user plan
                await updateDoc(doc(db, "users", userId), {
                  plan: "paid"
                });
                
                // Add an approved payment record
                await addDoc(collection(db, "paymentRequests"), {
                  uid: userId,
                  studentName: profile?.name || auth.currentUser?.displayName || "Student",
                  amount: 199,
                  status: "approved",
                  txnId: response.razorpay_payment_id,
                  createdAt: serverTimestamp(),
                });
              }

              setSuccessMode(true);
              setTimeout(() => {
                if (onSuccess) onSuccess();
                onClose();
              }, 2000);
            } else {
              setError("Payment verification failed.");
            }
          } catch (err) {
            console.error(err);
            setError("Error verifying payment.");
          } finally {
            setLoading(false);
          }
        },
        prefill: {
          name: profile?.name || auth.currentUser?.displayName || "",
          email: profile?.email || auth.currentUser?.email || "",
          contact: profile?.phone || ""
        },
        theme: {
          color: "#7c3aed"
        },
        modal: {
          ondismiss: function() {
            setError("Payment cancelled by user.");
            setLoading(false);
          }
        }
      };

      const paymentObject = new window.Razorpay(options);
      paymentObject.on("payment.failed", function (response) {
        setError("Payment failed: " + response.error.description);
      });
      paymentObject.open();
    } catch (err) {
      console.error(err);
      setError("Failed to initialize payment. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleMockSubmit = async (isSuccess) => {
    setLoading(true);
    setError("");

    if (!isSuccess) {
      setError("Payment failed: Simulated checkout cancellation.");
      setLoading(false);
      return;
    }

    try {
      const verifyResponse = await fetch("/api/verify-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          razorpay_order_id: mockOrder.id,
          razorpay_payment_id: `pay_mock_${Math.random().toString(36).slice(2, 10)}`
        })
      });
      const verifyData = await verifyResponse.json();

      if (verifyData.success) {
        const userId = auth.currentUser?.uid;
        if (userId) {
          // Automatically upgrade the user plan
          await updateDoc(doc(db, "users", userId), {
            plan: "paid"
          });
          
          // Add an approved payment record
          await addDoc(collection(db, "paymentRequests"), {
            uid: userId,
            studentName: profile?.name || auth.currentUser?.displayName || "Student",
            amount: 199,
            status: "approved",
            txnId: `pay_mock_${Math.random().toString(36).slice(2, 10)}`,
            createdAt: serverTimestamp(),
          });
        }

        setSuccessMode(true);
        setTimeout(() => {
          if (onSuccess) onSuccess();
          onClose();
        }, 2000);
      } else {
        setError("Payment verification failed.");
      }
    } catch (err) {
      console.error(err);
      setError("Error verifying simulated payment.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    handlePayment();
  }, []);

  return (
    <>
      <style>{`
        .pp-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.75);backdrop-filter:blur(10px);z-index:200;display:flex;align-items:center;justify-content:center;padding:20px;animation:ppIn 0.2s ease;}
        @keyframes ppIn{from{opacity:0}to{opacity:1}}
        .pp-modal{background:#0a0d1a;border:1px solid rgba(124,58,237,0.25);border-radius:28px;width:100%;max-width:420px;padding:32px 24px;text-align:center;box-shadow:0 40px 120px rgba(0,0,0,0.7),0 0 0 1px rgba(124,58,237,0.08);animation:ppUp 0.3s ease;}
        @keyframes ppUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
        .pp-btn{width:100%;padding:14px;background:linear-gradient(135deg,#7c3aed,#4f46e5);border:none;border-radius:14px;color:#fff;font-weight:700;font-size:15px;cursor:pointer;transition:all 0.25s ease;font-family:inherit;margin-top:20px;box-shadow: 0 4px 15px rgba(124,58,237,0.3);}
        .pp-btn:hover:not(:disabled){opacity:0.95;transform:translateY(-1px);box-shadow: 0 6px 20px rgba(124,58,237,0.4);}
        .pp-btn:disabled{opacity:0.4;cursor:not-allowed;box-shadow:none;}
        .pp-spinner{width:44px;height:44px;border:3px solid rgba(124,58,237,0.15);border-top-color:#7c3aed;border-radius:50%;animation:ppSpin 0.8s linear infinite;}
        @keyframes ppSpin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
      `}</style>

      <div className="pp-overlay" onClick={(e) => { if (e.target === e.currentTarget && !loading) onClose(); }}>
        <div className="pp-modal">
          {successMode ? (
            <>
              <div style={{ width: 56, height: 56, borderRadius: "50%", background: "rgba(34,197,94,0.1)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", color: "#22c55e", fontSize: 24 }}>✓</div>
              <h3 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 12px", color: "#f1f5f9" }}>Payment Successful!</h3>
              <p style={{ color: "rgba(255,255,255,0.7)", fontSize: 14, margin: "0 0 20px" }}>Your account has been upgraded to Premium.</p>
            </>
          ) : mockOrder ? (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                <h3 style={{ fontSize: 20, fontWeight: 700, margin: 0, color: "#f1f5f9" }}>🛠️ Sandbox Checkout</h3>
                <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--text3)", cursor: "pointer", fontSize: 20 }}>×</button>
              </div>
              <p style={{ color: "rgba(255,255,255,0.7)", fontSize: 13, margin: "0 0 16px", lineHeight: 1.5 }}>
                Your Razorpay keys are in **Sandbox Mode**. You can simulate a successful or failed payment below.
              </p>

              <div style={{ background: "rgba(0,229,255,0.03)", border: "1px solid rgba(0,229,255,0.15)", padding: "14px 16px", borderRadius: 16, marginBottom: 20, textAlign: "left" }}>
                <div style={{ fontSize: 11, color: "var(--text3)", fontFamily: "var(--font-mono)", textTransform: "uppercase" }}>Order ID</div>
                <div style={{ fontSize: 13, color: "var(--text)", fontFamily: "var(--font-mono)", wordBreak: "break-all", marginTop: 2 }}>{mockOrder.id}</div>
                
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12, borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 8 }}>
                  <span style={{ fontSize: 13, color: "var(--text2)" }}>Amount:</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: "var(--cyan)" }}>₹199.00</span>
                </div>
              </div>

              {error && <div style={{ color: "#f87171", fontSize: 13, marginBottom: 12 }}>{error}</div>}

              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <button 
                  className="pp-btn" 
                  style={{ background: "linear-gradient(135deg,#22c55e,#16a34a)", marginTop: 0, boxShadow: "0 4px 15px rgba(34,197,94,0.3)" }}
                  onClick={() => handleMockSubmit(true)}
                  disabled={loading}
                >
                  {loading ? "Processing..." : "✓ Simulate Payment Success"}
                </button>
                
                <button 
                  className="pp-btn" 
                  style={{ background: "linear-gradient(135deg,#ef4444,#dc2626)", marginTop: 0, boxShadow: "0 4px 15px rgba(239,68,68,0.25)", border: "1px solid rgba(255,255,255,0.05)" }}
                  onClick={() => handleMockSubmit(false)}
                  disabled={loading}
                >
                  {loading ? "Processing..." : "✗ Simulate Payment Failure"}
                </button>
              </div>
            </>
          ) : error ? (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                <h3 style={{ fontSize: 20, fontWeight: 700, margin: 0, color: "#f87171" }}>Payment Cancelled / Failed</h3>
                <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--text3)", cursor: "pointer", fontSize: 20 }}>×</button>
              </div>
              <p style={{ color: "rgba(255,255,255,0.7)", fontSize: 14, margin: "0 0 20px", lineHeight: 1.5 }}>
                {error}
              </p>
              <div style={{ display: "flex", gap: 12 }}>
                <button className="pp-btn" style={{ marginTop: 0, flex: 1 }} onClick={handlePayment}>
                  Try Again
                </button>
                <button className="pp-btn" style={{ marginTop: 0, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", flex: 1, boxShadow: "none" }} onClick={onClose}>
                  Close
                </button>
              </div>
            </>
          ) : (
            <>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "20px 0" }}>
                <div className="pp-spinner" style={{ marginBottom: 20 }}></div>
                <h3 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 8px", color: "#f1f5f9" }}>Connecting to secure gateway...</h3>
                <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, margin: 0 }}>Please do not close this window</p>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
