import { useEffect, useState } from "react";
import { db } from "../firebase";
import {
  collection,
  onSnapshot,
  updateDoc,
  doc,
  getDoc,
} from "firebase/firestore";

export default function PaymentRequests() {
  const [rows, setRows] = useState([]);
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "paymentRequests"), (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => {
        const ta = a.createdAt?.seconds ?? new Date(a.createdAt || 0).getTime() / 1000;
        const tb = b.createdAt?.seconds ?? new Date(b.createdAt || 0).getTime() / 1000;
        return tb - ta;
      });
      setRows(list);
    });
    return () => unsub();
  }, []);

  const setStatus = async (id, status) => {
    setBusyId(id);
    try {
      const ref = doc(db, "paymentRequests", id);
      const snap = await getDoc(ref);
      const data = snap.data() || {};
      await updateDoc(ref, { status, updatedAt: new Date().toISOString() });
      if (status === "approved") {
        const targetId = data.uid || data.studentId;
        if (targetId) {
          await updateDoc(doc(db, "users", targetId), { plan: "paid" });
        }
      }
    } finally {
      setBusyId(null);
    }
  };

  const pending = rows.filter((r) => !r.status || r.status === "pending");

  return (
    <div>
      <p style={{ fontSize:13, color:"var(--text3)", marginBottom:14, fontFamily:"var(--font-mono)" }}>
        {pending.length} pending request{pending.length !== 1 ? "s" : ""}
      </p>
      {rows.length === 0 ? (
        <div style={{ border:"1px dashed var(--border)", borderRadius:14, padding:"36px 24px", textAlign:"center" }}>
          <p style={{ color:"var(--text3)", fontSize:14, margin:0 }}>No payment requests yet.</p>
        </div>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          {rows.map((r) => (
            <div
              key={r.id}
              className="td-card"
              style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:16, flexWrap:"wrap" }}
            >
              <div style={{ flex:1, minWidth:200 }}>
                <p style={{ margin:0, fontWeight:600, fontSize:15, color:"var(--text)", fontFamily:"var(--font-head)" }}>
                  {r.studentName || "Student"}
                </p>
                <p style={{ margin:"4px 0 0", fontSize:12, color:"var(--text3)", fontFamily:"var(--font-mono)" }}>
                  {r.amount != null ? `₹${r.amount}` : "Amount not set"}
                  {r.note ? ` · ${r.note}` : ""}
                </p>
                <span
                  style={{
                    display:"inline-block",
                    marginTop:8,
                    fontSize:10,
                    fontWeight:700,
                    padding:"4px 10px",
                    borderRadius:20,
                    fontFamily:"var(--font-mono)",
                    background:
                      r.status === "approved"
                        ? "rgba(34,197,94,0.15)"
                        : r.status === "rejected"
                          ? "rgba(248,113,113,0.12)"
                          : "rgba(251,191,36,0.12)",
                    color:
                      r.status === "approved" ? "#22c55e" : r.status === "rejected" ? "#f87171" : "#fbbf24",
                  }}
                >
                  {(r.status || "pending").toUpperCase()}
                </span>
              </div>
              {(!r.status || r.status === "pending") && (
                <div style={{ display:"flex", gap:8, flexShrink:0 }}>
                  <button
                    type="button"
                    disabled={busyId === r.id}
                    onClick={() => setStatus(r.id, "approved")}
                    style={{
                      padding:"10px 16px",
                      borderRadius:10,
                      border:"none",
                      background:"linear-gradient(135deg,#22c55e,#16a34a)",
                      color:"#fff",
                      fontWeight:700,
                      cursor: busyId === r.id ? "wait" : "pointer",
                      fontFamily:"var(--font-body)",
                      fontSize:13,
                      opacity: busyId === r.id ? 0.7 : 1,
                    }}
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    disabled={busyId === r.id}
                    onClick={() => setStatus(r.id, "rejected")}
                    style={{
                      padding:"10px 16px",
                      borderRadius:10,
                      border:"1px solid var(--border)",
                      background:"transparent",
                      color:"var(--text2)",
                      fontWeight:600,
                      cursor: busyId === r.id ? "wait" : "pointer",
                      fontFamily:"var(--font-body)",
                      fontSize:13,
                    }}
                  >
                    Reject
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
