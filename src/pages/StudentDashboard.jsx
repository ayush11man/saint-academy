import { useState, useEffect, useRef } from "react";
import { db, auth } from "../firebase";
import {
  doc, getDoc, updateDoc, collection, getDocs,
  deleteDoc, addDoc, serverTimestamp, query, orderBy, onSnapshot
} from "firebase/firestore";
import { reauthenticateWithCredential, EmailAuthProvider, deleteUser } from "firebase/auth";
import { getLiveSession, getTodaySchedule, getWeeklySchedule, SUBJECT_META } from "../schedule";
import { NCERT_SOLUTIONS, NCERT_TEXTBOOKS } from "../ncertLinks";
import { uploadFile } from "../supabase";
import PaymentPortal from "./PaymentPortal";

const SUBJECTS    = ["maths","science","social","hindi"];
const DAY_LABELS  = ["Mon","Tue","Wed","Thu","Fri"];
const HW_CAT_COLORS = {
  chapter:    { bg:"rgba(124,58,237,0.1)",  color:"var(--purple3)" },
  special:    { bg:"rgba(251,191,36,0.1)",  color:"#fbbf24" },
  integrated: { bg:"rgba(0,229,255,0.1)",   color:"var(--cyan)" },
};

export default function StudentDashboard({ user, profile: initProfile, onLogout }) {
  const [profile,      setProfile]      = useState(initProfile || {});
  const [material,     setMaterial]     = useState({});
  const [homework,     setHomework]     = useState([]);
  const [activeSubj,   setActiveSubj]   = useState(null);
  const [activeHW,     setActiveHW]     = useState(null); // selected homework item
  const [sidebar,      setSidebar]      = useState(false);
  const [sidebarTab,   setSidebarTab]   = useState("profile");
  const [loading,      setLoading]      = useState(true);
  const [liveSession,  setLive]         = useState(null);
  const [todaySched,   setToday]        = useState([]);

  // Doubt chat
  const [doubtOpen,    setDoubtOpen]    = useState(false);
  const [doubtSubj,    setDoubtSubj]    = useState(null);
  const [doubtMsgs,    setDoubtMsgs]    = useState([]);
  const [doubtInput,   setDoubtInput]   = useState("");
  const [doubtLoading, setDoubtLoading] = useState(false);
  const [uploadingDoubt, setUploadingDoubt] = useState(false);
  const doubtBottom = useRef(null);
  const unsubDoubt  = useRef(null);
  const unsubProfile = useRef(null);

  // AI chatbot
  const [chatOpen,    setChatOpen]    = useState(false);
  const [messages,    setMessages]    = useState([{ role:"assistant", content:"Hey! I'm your Saint Academy AI assistant. Ask me anything — academic doubts, concept explanations, or homework help. For paid students: describe your homework problem and I'll solve it step by step." }]);
  const [chatInput,   setChatInput]   = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatBottom = useRef(null);

  // Profile edit
  const [editForm,    setEditForm]    = useState({});
  const [editLoading, setEditLoading] = useState(false);
  const [editError,   setEditError]   = useState("");
  const [editSuccess, setEditSuccess] = useState("");

  // Delete account
  const [delPass,     setDelPass]     = useState("");
  const [delError,    setDelError]    = useState("");
  const [delLoading,  setDelLoading]  = useState(false);

  // Free class tracking
  const [freeJoinUsed, setFreeJoinUsed] = useState(false);
  const liveTimer = useRef(null);

  // Payment portal
  const [showPayment, setShowPayment] = useState(false);
  const openPayment = () => setShowPayment(true);

  const isPaid = profile?.plan === "paid";

  // Real-time profile sync (syncs plan/role/info immediately)
  useEffect(() => {
    if (!user) return;
    if (unsubProfile.current) unsubProfile.current();
    unsubProfile.current = onSnapshot(doc(db, "users", user.uid), (snap) => {
      if (snap.exists()) {
        const p = snap.data();
        setProfile(p);
        setFreeJoinUsed(p.freeClassUsed || false);
        setEditForm({ name: p.name || "", phone: p.phone || "", school: p.school || "", cls: p.cls || "" });
      }
    });
    return () => { if (unsubProfile.current) unsubProfile.current(); };
  }, [user]);

  useEffect(() => { if (user) loadAll(); }, [user]);
  useEffect(() => {
    const check = () => {
      if (profile?.cls) {
        setLive(getLiveSession(profile.cls));
        setToday(getTodaySchedule(profile.cls));
      }
    };
    check();
    liveTimer.current = setInterval(check, 60000);
    return () => clearInterval(liveTimer.current);
  }, [profile?.cls]);
  useEffect(() => { chatBottom.current?.scrollIntoView({ behavior:"smooth" }); }, [messages]);
  useEffect(() => { doubtBottom.current?.scrollIntoView({ behavior:"smooth" }); }, [doubtMsgs]);

  // Subscribe to doubt chat
  useEffect(() => {
    if (unsubDoubt.current) unsubDoubt.current();
    if (!doubtOpen || !doubtSubj) return;
    const q = query(collection(db,"doubts",user.uid,doubtSubj), orderBy("createdAt","asc"));
    unsubDoubt.current = onSnapshot(q, snap => {
      setDoubtMsgs(snap.docs.map(d=>({id:d.id,...d.data()})));
      setTimeout(()=>doubtBottom.current?.scrollIntoView({behavior:"smooth"}),100);
    });
    return () => { if (unsubDoubt.current) unsubDoubt.current(); };
  }, [doubtOpen, doubtSubj, user?.uid]);

  const loadAll = async () => {
    setLoading(true);
    try {
      // Profile is synced via onSnapshot above
      const cls = profile?.cls || "";
      if (cls) {
        const mat = {};
        for (const subj of SUBJECTS) {
          const mSnap = await getDocs(collection(db,"material",`class${cls}`,subj));
          mat[subj] = mSnap.docs.map(d=>({id:d.id,...d.data()}));
        }
        setMaterial(mat);
        const hSnap = await getDocs(collection(db,"homework",`class${cls}`,"assignments"));
        setHomework(hSnap.docs.map(d=>({id:d.id,...d.data()}))
          .sort((a,b)=>new Date(a.dueDate)-new Date(b.dueDate)));
      }
    } catch(e) { console.error(e); }
    finally { setLoading(false); }
  };

  const saveEdit = async () => {
    setEditError(""); setEditSuccess(""); setEditLoading(true);
    try {
      if (!editForm.name.trim()) { setEditError("Name cannot be empty."); return; }
      const newCls = String(editForm.cls || "").trim();
      if (!["6","7","8","9","10"].includes(newCls)) { setEditError("Class must be 6, 7, 8, 9 or 10."); return; }

      await updateDoc(doc(db,"users",user.uid), {
        name: editForm.name.trim(),
        phone: editForm.phone.trim(),
        school: editForm.school.trim(),
        cls: newCls,
      });
      setProfile(p=>({...p, name:editForm.name.trim(), phone:editForm.phone.trim(), school:editForm.school.trim(), cls:newCls}));
      setEditSuccess("Profile updated!");
    } catch(e) { setEditError("Failed to update. Try again."); }
    finally { setEditLoading(false); }
  };

  const deleteAccount = async () => {
    setDelError(""); setDelLoading(true);
    try {
      const cred = EmailAuthProvider.credential(user.email, delPass);
      await reauthenticateWithCredential(user, cred);
      // Clean up Firestore: user doc + any payment requests
      await deleteDoc(doc(db,"users",user.uid));
      const { collection: col, query: q, where: wh, getDocs: gd, deleteDoc: dd, doc: fd } = await import("firebase/firestore");
      const prSnap = await gd(q(col(db,"paymentRequests"), wh("studentId","==",user.uid)));
      await Promise.all(prSnap.docs.map(d => dd(fd(db,"paymentRequests",d.id))));
      await deleteUser(user);
      onLogout();
    } catch(e) {
      if (["auth/wrong-password","auth/invalid-credential"].includes(e.code)) setDelError("Incorrect password.");
      else setDelError("Failed to delete. Try again.");
    } finally { setDelLoading(false); }
  };

  const handleFreeJoin = async (meetLink) => {
    if (!freeJoinUsed) {
      await updateDoc(doc(db,"users",user.uid),{ freeClassUsed:true });
      setFreeJoinUsed(true);
      window.open(meetLink,"_blank");
    }
  };

  // Send doubt message (text or file)
  const sendDoubt = async (fileUrl=null, fileType=null) => {
    if (!doubtInput.trim() && !fileUrl) return;
    const payload = {
      text: doubtInput.trim(),
      sender: "student",
      createdAt: serverTimestamp(),
      readByTeacher: false,
    };
    if (fileUrl) {
      if (fileType?.startsWith("image")) payload.imageUrl = fileUrl;
      else payload.fileUrl = fileUrl;
      payload.text = payload.text || "Uploaded a file";
    }
    await addDoc(collection(db,"doubts",user.uid,doubtSubj), payload);
    setDoubtInput("");
  };

  const handleDoubtFile = async (file) => {
    if (!file) return;
    setUploadingDoubt(true);
    try {
      const url = await uploadFile(file, `doubts/${user.uid}/${doubtSubj}`);
      await sendDoubt(url, file.type);
    } catch(e) { console.error(e); }
    finally { setUploadingDoubt(false); }
  };

  // AI chatbot
  const sendChat = async () => {
    if (!chatInput.trim() || chatLoading) return;
    const userMsg = chatInput.trim();
    setChatInput("");
    setMessages(m=>[...m,{role:"user",content:userMsg}]);
    setChatLoading(true);
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body: JSON.stringify({
          model:"claude-sonnet-4-20250514",
          max_tokens:1000,
          system:`You are a dedicated academic assistant for Saint Academy, a coaching centre in Bengaluru for classes 6-10. The student is ${profile?.name||"a student"} in Class ${profile?.cls||"unknown"}. Help with any question — academic doubts, concept explanations, homework solutions, or study advice. For maths, show all steps clearly. For science, use real-world examples. For Hindi, respond in both English and Hindi when helpful. Be warm, encouraging, and student-friendly. If they describe a homework problem, walk through it step by step. Never just give the answer — explain the reasoning so they learn.`,
          messages:[...messages,{role:"user",content:userMsg}].map(m=>({role:m.role,content:m.content})),
        }),
      });
      const data = await res.json();
      setMessages(m=>[...m,{role:"assistant",content:data.content?.[0]?.text||"Sorry, try again."}]);
    } catch(e) {
      setMessages(m=>[...m,{role:"assistant",content:"Connection error. Please try again."}]);
    } finally { setChatLoading(false); }
  };

  const openDoubt = (subj) => {
    setDoubtSubj(subj);
    setDoubtOpen(true);
    setChatOpen(false);
  };

  const weekSched  = getWeeklySchedule(profile?.cls || "9");
  const initials   = profile?.name ? profile.name.split(" ").map(w=>w[0]).join("").toUpperCase().slice(0,2) : "ST";
  const firstName  = profile?.name?.split(" ")[0] || "Student";

  return (
    <>
      <style>{`
        .sd-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.65);backdrop-filter:blur(6px);z-index:40;opacity:0;pointer-events:none;transition:opacity 0.3s;}
        .sd-overlay.open{opacity:1;pointer-events:all;}
        .sd-sidebar{position:fixed;top:0;right:0;height:100vh;width:360px;background:#080a15;border-left:1px solid var(--border);z-index:50;transform:translateX(100%);transition:transform 0.35s cubic-bezier(0.4,0,0.2,1);display:flex;flex-direction:column;overflow:hidden;}
        .sd-sidebar.open{transform:translateX(0);}
        .sd-av{width:48px;height:48px;border-radius:50%;background:var(--grad);display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:700;color:#fff;cursor:pointer;font-family:var(--font-mono);flex-shrink:0;transition:box-shadow 0.2s;}
        .sd-av:hover{box-shadow:0 0 0 4px rgba(124,58,237,0.3);}
        .subj-tile{border-radius:18px;padding:22px;cursor:pointer;transition:all 0.25s;border:1px solid var(--border);background:var(--surface);position:relative;overflow:hidden;}
        .subj-tile:hover{transform:translateY(-3px);border-color:var(--border2);}
        .mat-card{background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:18px;transition:border-color 0.2s;}
        .mat-card:hover{border-color:var(--border2);}
        .hw-row{background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:16px 20px;cursor:pointer;transition:all 0.2s;}
        .hw-row:hover{border-color:var(--border2);transform:translateY(-1px);}
        .live-pulse{width:10px;height:10px;border-radius:50%;background:#22c55e;animation:livepulse 1.5s ease infinite;flex-shrink:0;}
        @keyframes livepulse{0%{box-shadow:0 0 0 0 rgba(34,197,94,0.4)}70%{box-shadow:0 0 0 10px rgba(34,197,94,0)}100%{box-shadow:0 0 0 0 rgba(34,197,94,0)}}
        .doubt-panel{position:fixed;bottom:88px;right:24px;width:380px;height:520px;background:#0a0c18;border:1px solid var(--border);border-radius:20px;display:flex;flex-direction:column;z-index:60;box-shadow:0 20px 60px rgba(0,0,0,0.6);overflow:hidden;animation:fadeUp 0.3s ease;}
        .chat-panel{position:fixed;bottom:88px;right:24px;width:380px;height:520px;background:#0a0c18;border:1px solid var(--border);border-radius:20px;display:flex;flex-direction:column;z-index:60;box-shadow:0 20px 60px rgba(0,0,0,0.6);overflow:hidden;animation:fadeUp 0.3s ease;}
        .chat-fab{position:fixed;bottom:24px;right:24px;width:56px;height:56px;border-radius:50%;background:var(--grad);border:none;cursor:pointer;z-index:60;box-shadow:0 4px 20px rgba(124,58,237,0.4);display:flex;align-items:center;justify-content:center;font-size:22px;transition:transform 0.2s;}
        .chat-fab:hover{transform:scale(1.08);}
        .doubt-fab{position:fixed;bottom:24px;right:92px;width:56px;height:56px;border-radius:50%;background:linear-gradient(135deg,#f472b6,#ec4899);border:none;cursor:pointer;z-index:60;box-shadow:0 4px 20px rgba(244,114,182,0.4);display:flex;align-items:center;justify-content:center;font-size:22px;transition:transform 0.2s;}
        .doubt-fab:hover{transform:scale(1.08);}
        .bubble-s{background:var(--grad);color:#fff;border-radius:18px 18px 4px 18px;padding:10px 14px;font-size:13px;max-width:75%;margin-left:auto;line-height:1.5;}
        .bubble-t{background:var(--bg3);border:1px solid var(--border);color:var(--text);border-radius:18px 18px 18px 4px;padding:10px 14px;font-size:13px;max-width:80%;line-height:1.5;}
        .bubble-ai{background:var(--bg3);border:1px solid var(--border);color:var(--text);border-radius:18px 18px 18px 4px;padding:10px 14px;font-size:13px;max-width:85%;line-height:1.6;white-space:pre-wrap;}
        .edit-in{width:100%;padding:10px 14px;background:rgba(255,255,255,0.05);border:1px solid var(--border);border-radius:10px;color:var(--text);font-family:var(--font-body);font-size:14px;outline:none;margin-top:6px;box-sizing:border-box;}
        .edit-in:focus{border-color:rgba(124,58,237,0.5);}
        .locked-field{padding:10px 14px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.05);border-radius:10px;color:var(--text3);font-size:14px;margin-top:6px;}
        .stab{padding:7px 12px;border-radius:8px;border:none;cursor:pointer;font-family:var(--font-body);font-size:11px;font-weight:700;transition:all 0.2s;white-space:nowrap;}
        .stab-active{background:var(--grad);color:#fff;}
        .stab-inactive{background:var(--surface);color:var(--text2);border:1px solid var(--border);}
        .tt-table{width:100%;border-collapse:collapse;}
        .tt-table th,.tt-table td{padding:8px 6px;text-align:center;border-bottom:1px solid var(--border);font-size:12px;}
        .tt-table th{font-family:var(--font-mono);font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:0.06em;}
        .chapter-tag{display:inline-flex;align-items:center;padding:2px 8px;border-radius:6px;font-size:10px;font-weight:700;font-family:var(--font-mono);}
        @keyframes bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}
        .hw-detail{background:var(--bg2);border:1px solid var(--border);border-radius:18px;padding:24px;margin-bottom:20px;animation:fadeUp 0.3s ease;}
      `}</style>

      <div style={{minHeight:"100vh",background:"var(--bg)",color:"var(--text)",fontFamily:"var(--font-body)",paddingBottom:100}}>
        {(!profile?.phone || !profile?.school || !profile?.cls) && !loading && (
          <div className="sd-overlay open" style={{ zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 20, padding: "32px 24px", width: "100%", maxWidth: 400, pointerEvents: "all", boxShadow: "0 40px 100px rgba(0,0,0,0.5)" }}>
              <h3 style={{ margin: "0 0 8px", fontSize: 22, fontFamily: "var(--font-head)" }}>Complete Profile</h3>
              <p style={{ color: "var(--text2)", fontSize: 13, marginBottom: 24 }}>Welcome! Please complete your profile to continue.</p>
              {[
                {label:"Full Name",key:"name",placeholder:"Your name"},
                {label:"Class",    key:"cls", placeholder:"6, 7, 8, 9 or 10"},
                {label:"School",   key:"school",placeholder:"School name"},
                {label:"Phone",    key:"phone",placeholder:"+91 98765 43210"},
              ].map(f=>(
                <div key={f.key} style={{marginBottom:14}}>
                  <label style={{fontSize:11,fontWeight:600,color:"var(--text2)",textTransform:"uppercase",letterSpacing:"0.07em",fontFamily:"var(--font-mono)"}}>{f.label}</label>
                  <input className="edit-in" value={editForm[f.key]||""} onChange={e=>setEditForm(ef=>({...ef,[f.key]:e.target.value}))} placeholder={f.placeholder}/>
                </div>
              ))}
              {editError&&<div style={{background:"rgba(248,113,113,0.08)",border:"1px solid rgba(248,113,113,0.2)",borderRadius:10,padding:"10px 14px",color:"#fca5a5",fontSize:13,marginBottom:12}}>{editError}</div>}
              <button onClick={saveEdit} disabled={editLoading} style={{width:"100%",padding:"12px",background:"var(--grad)",border:"none",borderRadius:10,color:"#fff",fontWeight:700,fontSize:14,cursor:"pointer",fontFamily:"var(--font-body)",marginTop:10,opacity:editLoading?0.6:1}}>
                {editLoading?"Saving...":"Save Profile"}
              </button>
            </div>
          </div>
        )}
        <div style={{maxWidth:1100,margin:"0 auto",padding:"28px 24px"}}>

          {/* Header */}
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:24}}>
            <div>
              <p style={{color:"var(--text3)",fontSize:11,fontWeight:700,fontFamily:"var(--font-mono)",textTransform:"uppercase",letterSpacing:"0.08em",margin:"0 0 4px"}}>Student Portal</p>
              <h1 style={{fontSize:"clamp(22px,3vw,30px)",fontWeight:700,fontFamily:"var(--font-head)",letterSpacing:"-0.02em",margin:0}}>
                {loading?"Loading...":<>Hey, <span style={{background:"var(--grad)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>{firstName}</span></>}
              </h1>
              {!loading&&<p style={{color:"var(--text2)",fontSize:13,margin:"4px 0 0"}}>Class {profile?.cls||"—"} · {profile?.school||"—"}</p>}
            </div>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              {isPaid&&<span style={{fontSize:11,fontWeight:700,padding:"4px 12px",borderRadius:20,background:"rgba(124,58,237,0.15)",color:"var(--purple3)",border:"1px solid rgba(124,58,237,0.3)",fontFamily:"var(--font-mono)"}}>PREMIUM</span>}
              <div className="sd-av" onClick={()=>{setSidebar(true);setSidebarTab("profile");}}>{initials}</div>
            </div>
          </div>

          {/* MAIN LAYOUT */}
          <div style={{ display: "flex", gap: "32px", alignItems: "flex-start", flexWrap: "wrap" }}>
            
            {/* SUBJECT SIDEBAR */}
            <div style={{ width: "240px", flexShrink: 0, position: "sticky", top: "24px" }}>
              <p style={{fontSize:11,fontWeight:700,color:"var(--text2)",fontFamily:"var(--font-mono)",textTransform:"uppercase",letterSpacing:"0.08em",margin:"0 0 16px"}}>Subjects</p>
              <div style={{display:"flex",flexDirection:"column",gap:12}}>
                {SUBJECTS.map(subj=>{
                  const meta=SUBJECT_META[subj];
                  const count=(material[subj]||[]).length;
                  const isActive=activeSubj===subj;
                  return(
                    <div key={subj} className="subj-tile" onClick={()=>{setActiveSubj(isActive?null:subj);setActiveHW(null);}}
                      style={{padding:"16px",borderColor:isActive?meta.color:"var(--border)",borderWidth:isActive?2:1,boxShadow:isActive?`0 0 24px ${meta.color}20`:"none"}}>
                      <div style={{position:"absolute",top:-10,right:-10,width:50,height:50,borderRadius:"50%",background:`${meta.color}10`,pointerEvents:"none"}}/>
                      <div style={{display:"flex", alignItems:"center", gap:"14px"}}>
                        <div style={{fontSize:24}}>{meta.icon}</div>
                        <div>
                          <p style={{margin:0,fontSize:15,fontWeight:700,color:"var(--text)",fontFamily:"var(--font-head)"}}>{meta.label}</p>
                          <p style={{margin:"2px 0 0",fontSize:11,color:"var(--text2)",fontFamily:"var(--font-mono)"}}>{count} items</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* CONTENT AREA */}
            <div style={{ flex: 1, minWidth: "300px" }}>
              
              {/* TIMETABLE (Always visible if no active subject) */}
              {!activeSubj && (
                <div style={{marginBottom:28}}>
                  <div style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:18,padding:"24px",overflowX:"auto",animation:"fadeUp 0.3s ease", boxShadow:"0 4px 20px rgba(0,0,0,0.2)"}}>
                    <p style={{fontSize:14,fontWeight:700,color:"var(--text)",fontFamily:"var(--font-head)",margin:"0 0 16px"}}>
                      Class {profile?.cls} Weekly Timetable
                    </p>
                    <table className="tt-table">
                      <thead>
                        <tr>
                          <th style={{textAlign:"left",width:120}}>Time</th>
                          {DAY_LABELS.map(d=><th key={d}>{d}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {["4:00–5:00 PM","5:00–6:00 PM","6:00–7:00 PM","7:00–8:00 PM"].map((tl,si)=>(
                          <tr key={si}>
                            <td style={{textAlign:"left",fontSize:11,color:"var(--cyan)",fontFamily:"var(--font-mono)",whiteSpace:"nowrap",paddingLeft:0}}>{tl}</td>
                            {weekSched.map((dd,di)=>{
                              const s=dd.slots[si];
                              const isFree=!s?.session;
                              const meta=s?.session?SUBJECT_META[s.session.subject]:null;
                              return(
                                <td key={di}>
                                  {isFree?<span style={{fontSize:10,color:"var(--text3)",fontFamily:"var(--font-mono)"}}>Free</span>:(
                                    <div style={{display:"inline-flex",flexDirection:"column",alignItems:"center",gap:2,padding:"6px 10px",borderRadius:8,background:`${meta.color}12`,border:`1px solid ${meta.color}25`}}>
                                      <span style={{fontSize:11,fontWeight:700,color:meta.color}}>{meta.label}</span>
                                      <span style={{fontSize:9,color:"var(--text3)"}}>{s.session.teacher.charAt(0).toUpperCase()+s.session.teacher.slice(1)}</span>
                                    </div>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <p style={{fontSize:11,color:"var(--text3)",margin:"16px 0 0"}}>Sat: Revision · Doubt solving · Tests &nbsp;|&nbsp; Sun: Mock tests · Quiz · Homework checking</p>
                  </div>
                </div>
              )}

              {/* LIVE CLASS BANNER */}
              {liveSession&&(
                liveSession.free?(
                  <div style={{background:"rgba(255,255,255,0.03)",border:"1px solid var(--border)",borderRadius:18,padding:"14px 22px",marginBottom:20,display:"flex",alignItems:"center",gap:10}}>
                    <span>☕</span>
                    <p style={{margin:0,fontSize:14,color:"var(--text2)"}}>Free period right now</p>
                  </div>
                ):(
                  <div style={{background:"rgba(34,197,94,0.08)",border:"2px solid rgba(34,197,94,0.3)",borderRadius:18,padding:"18px 24px",marginBottom:20,display:"flex",justifyContent:"space-between",alignItems:"center",gap:16,flexWrap:"wrap"}}>
                    <div style={{display:"flex",alignItems:"center",gap:14}}>
                      <div className="live-pulse"/>
                      <div>
                        <p style={{margin:0,fontSize:12,fontWeight:700,color:"#22c55e",fontFamily:"var(--font-mono)",textTransform:"uppercase",letterSpacing:"0.06em"}}>Live Now</p>
                        <p style={{margin:"2px 0 0",fontSize:16,fontWeight:700,color:"var(--text)",fontFamily:"var(--font-head)"}}>
                          {SUBJECT_META[liveSession.subject]?.label} with {liveSession.teacher.charAt(0).toUpperCase()+liveSession.teacher.slice(1)}
                        </p>
                        <p style={{margin:0,fontSize:12,color:"var(--text2)"}}>{liveSession.timeSlot}</p>
                      </div>
                    </div>
                    {isPaid?(
                      <a href={liveSession.meetLink} target="_blank" rel="noreferrer" style={{display:"flex",alignItems:"center",gap:8,padding:"12px 22px",borderRadius:12,background:"linear-gradient(135deg,#22c55e,#16a34a)",color:"#fff",fontWeight:700,fontSize:15,textDecoration:"none",fontFamily:"var(--font-body)"}}>
                        <div className="live-pulse" style={{background:"#fff",width:8,height:8}}/> Join Class
                      </a>
                    ):(
                      <div style={{display:"flex",flexDirection:"column",gap:8,alignItems:"flex-end"}}>
                        {!freeJoinUsed?(
                          <>
                            <button onClick={()=>handleFreeJoin(liveSession.meetLink)} style={{padding:"10px 18px",borderRadius:10,background:"rgba(34,197,94,0.15)",border:"1px solid rgba(34,197,94,0.3)",color:"#22c55e",fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:"var(--font-body)"}}>
                              Join Free (1 time only)
                            </button>
                            <button onClick={openPayment} style={{padding:"10px 18px",borderRadius:10,background:"var(--grad)",border:"none",color:"#fff",fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:"var(--font-body)"}}>
                              Upgrade to Join All
                            </button>
                          </>
                        ):(
                          <div style={{textAlign:"right"}}>
                            <p style={{margin:"0 0 6px",fontSize:12,color:"var(--text3)"}}>Free class used</p>
                            <button onClick={openPayment} style={{padding:"10px 18px",borderRadius:10,background:"var(--grad)",border:"none",color:"#fff",fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:"var(--font-body)"}}>
                              Upgrade · ₹200/week
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              )}

              {/* TODAY'S SCHEDULE */}
              {!activeSubj&&!loading&&(
                <div style={{marginBottom:28}}>
                  <p style={{fontSize:11,fontWeight:700,color:"var(--text2)",fontFamily:"var(--font-mono)",textTransform:"uppercase",letterSpacing:"0.08em",margin:"0 0 10px"}}>Today's Schedule</p>
                  {todaySched.length > 0 ? (
                    <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
                      {todaySched.map((s,i)=>{
                        const isLiveNow=liveSession&&!liveSession.free&&s.startHour===new Date().getHours();
                        const isNext=!isLiveNow&&new Date().getHours()<s.startHour;
                        const isFree=!s.session;
                        const meta=s.session?SUBJECT_META[s.session.subject]:null;
                        return(
                          <div key={i} style={{flex:"1 1 160px",padding:"14px 16px",borderRadius:14,background:"var(--surface)",border:`1px solid ${isLiveNow?"rgba(34,197,94,0.4)":meta?`${meta.color}30`:"var(--border)"}`,boxShadow:"0 2px 10px rgba(0,0,0,0.1)"}}>
                            <p style={{margin:0,fontSize:11,fontWeight:700,color:isFree?"var(--text3)":meta?.color,fontFamily:"var(--font-mono)",textTransform:"uppercase"}}>{isFree?"Free Period":meta?.label}</p>
                            <p style={{margin:"4px 0 0",fontSize:12,color:"var(--text3)"}}>{s.slotLabel}</p>
                            {isLiveNow&&<span style={{fontSize:10,color:"#22c55e",fontWeight:700,fontFamily:"var(--font-mono)"}}>● LIVE</span>}
                            {isNext&&!isFree&&<span style={{fontSize:10,color:meta?.color,fontWeight:700,fontFamily:"var(--font-mono)"}}>NEXT</span>}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div style={{border:"1px dashed var(--border)",borderRadius:14,padding:"20px",textAlign:"center",background:"rgba(255,255,255,0.02)"}}>
                      <p style={{color:"var(--text3)",fontSize:13,margin:0}}>No live classes scheduled for today. Take a break or review study materials!</p>
                    </div>
                  )}
                </div>
              )}

          {/* MATERIAL + HOMEWORK PANEL */}
          {activeSubj&&(
            <div style={{marginBottom:28,animation:"fadeUp 0.3s ease"}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <div style={{width:4,height:22,borderRadius:2,background:SUBJECT_META[activeSubj].color}}/>
                  <h2 style={{fontSize:19,fontWeight:700,fontFamily:"var(--font-head)",margin:0}}>{SUBJECT_META[activeSubj].label}</h2>
                </div>
                <div style={{display:"flex",gap:10,alignItems:"center"}}>
                  {isPaid&&(
                    <button onClick={()=>openDoubt(activeSubj)} style={{padding:"8px 16px",borderRadius:10,background:"rgba(244,114,182,0.1)",border:"1px solid rgba(244,114,182,0.3)",color:"#f472b6",fontWeight:600,fontSize:13,cursor:"pointer",fontFamily:"var(--font-body)"}}>
                      Ask a Doubt
                    </button>
                  )}
                  <button onClick={()=>setActiveSubj(null)} style={{background:"none",border:"none",color:"var(--text3)",cursor:"pointer",fontSize:20,lineHeight:1}}>✕</button>
                </div>
              </div>

              {/* FREE — NCERT */}
              <p style={{fontSize:11,fontWeight:700,color:"var(--text2)",fontFamily:"var(--font-mono)",textTransform:"uppercase",letterSpacing:"0.06em",margin:"0 0 10px"}}>Free — NCERT Resources</p>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(240px,1fr))",gap:12,marginBottom:20}}>
                {[
                  {label:"NCERT Textbook",desc:`Official Class ${profile?.cls} textbook`,icon:"📖",link:NCERT_TEXTBOOKS[activeSubj]?.[profile?.cls]},
                  {label:"NCERT Solutions",desc:"Chapter-wise Q&A",icon:"📝",link:NCERT_SOLUTIONS[activeSubj]?.[profile?.cls]},
                ].map(r=>(
                  <div key={r.label} className="mat-card">
                    <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
                      <div style={{width:38,height:38,borderRadius:10,background:`${SUBJECT_META[activeSubj].color}18`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>{r.icon}</div>
                      <div>
                        <p style={{margin:0,fontSize:14,fontWeight:700,color:"var(--text)",fontFamily:"var(--font-head)"}}>{r.label}</p>
                        <p style={{margin:0,fontSize:11,color:"var(--text2)"}}>{r.desc}</p>
                      </div>
                    </div>
                    {r.link?<a href={r.link} target="_blank" rel="noreferrer" style={{display:"inline-flex",alignItems:"center",gap:6,padding:"7px 14px",borderRadius:8,background:`${SUBJECT_META[activeSubj].color}18`,border:`1px solid ${SUBJECT_META[activeSubj].color}30`,color:SUBJECT_META[activeSubj].color,fontSize:12,fontWeight:600,textDecoration:"none"}}>Open →</a>:<p style={{fontSize:12,color:"var(--text3)",margin:0}}>Coming soon</p>}
                  </div>
                ))}
              </div>

              {/* Teacher free notes */}
              {(material[activeSubj]||[]).filter(m=>m.tier==="free"||!m.tier).length>0&&(
                <>
                  <p style={{fontSize:11,fontWeight:700,color:"var(--text2)",fontFamily:"var(--font-mono)",textTransform:"uppercase",letterSpacing:"0.06em",margin:"0 0 10px"}}>Teacher's Notes — Free</p>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(240px,1fr))",gap:12,marginBottom:20}}>
                    {(material[activeSubj]||[]).filter(m=>m.tier==="free"||!m.tier).map(m=><MatCard key={m.id} item={m} color={SUBJECT_META[activeSubj].color}/>)}
                  </div>
                </>
              )}

              {/* PAID */}
              {!isPaid?(
                <div style={{background:"rgba(124,58,237,0.08)",border:"1px solid rgba(124,58,237,0.2)",borderRadius:14,padding:"20px 24px",display:"flex",justifyContent:"space-between",alignItems:"center",gap:16,flexWrap:"wrap",marginBottom:20}}>
                  <div>
                    <p style={{margin:"0 0 4px",fontWeight:700,fontSize:15,color:"var(--text)",fontFamily:"var(--font-head)"}}>Premium Content Locked</p>
                    <p style={{margin:0,fontSize:13,color:"var(--text2)",lineHeight:1.6}}>Upgrade to access teacher's notes, homework, AI assistant and doubt chat.</p>
                  </div>
                  <button onClick={openPayment} style={{padding:"10px 22px",borderRadius:10,background:"var(--grad)",border:"none",color:"#fff",fontWeight:700,fontSize:14,cursor:"pointer",fontFamily:"var(--font-body)",whiteSpace:"nowrap"}}>Upgrade · ₹200/week</button>
                </div>
              ):(
                <>
                  {(material[activeSubj]||[]).filter(m=>m.tier==="paid").length>0&&(
                    <>
                      <p style={{fontSize:11,fontWeight:700,color:"var(--purple3)",fontFamily:"var(--font-mono)",textTransform:"uppercase",letterSpacing:"0.06em",margin:"0 0 10px"}}>Premium — Teacher's Notes</p>
                      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(240px,1fr))",gap:12,marginBottom:20}}>
                        {(material[activeSubj]||[]).filter(m=>m.tier==="paid").map(m=><MatCard key={m.id} item={m} color={SUBJECT_META[activeSubj].color} isPremium/>)}
                      </div>
                    </>
                  )}

                  {/* HOMEWORK */}
                  {homework.filter(h=>h.subject===activeSubj).length>0&&(
                    <>
                      <p style={{fontSize:11,fontWeight:700,color:"var(--purple3)",fontFamily:"var(--font-mono)",textTransform:"uppercase",letterSpacing:"0.06em",margin:"0 0 10px"}}>Homework</p>
                      {activeHW&&activeHW.subject===activeSubj&&(
                        <div className="hw-detail">
                          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14}}>
                            <div>
                              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6,flexWrap:"wrap"}}>
                                <h3 style={{margin:0,fontSize:17,fontFamily:"var(--font-head)"}}>{activeHW.title}</h3>
                                {activeHW.chapter&&<span className="chapter-tag" style={{background:"rgba(124,58,237,0.1)",color:"var(--purple3)"}}>{activeHW.chapter}</span>}
                                {activeHW.category&&<span className="chapter-tag" style={{...HW_CAT_COLORS[activeHW.category],textTransform:"capitalize"}}>{activeHW.category}</span>}
                              </div>
                              {activeHW.description&&<p style={{margin:0,fontSize:13,color:"var(--text2)",lineHeight:1.6}}>{activeHW.description}</p>}
                              <p style={{margin:"8px 0 0",fontSize:12,color:new Date(activeHW.dueDate)<new Date()?"#f87171":"#34d399",fontFamily:"var(--font-mono)",fontWeight:700}}>
                                Due: {new Date(activeHW.dueDate).toLocaleDateString("en-IN",{day:"numeric",month:"long"})}
                              </p>
                            </div>
                            <button onClick={()=>setActiveHW(null)} style={{background:"none",border:"none",color:"var(--text3)",cursor:"pointer",fontSize:18}}>✕</button>
                          </div>
                          {activeHW.link&&(
                            <a href={activeHW.link} target="_blank" rel="noreferrer" style={{display:"inline-flex",alignItems:"center",gap:6,padding:"8px 16px",borderRadius:10,background:"rgba(124,58,237,0.1)",border:"1px solid rgba(124,58,237,0.2)",color:"var(--purple3)",fontSize:13,fontWeight:600,textDecoration:"none",marginBottom:16}}>
                              View Questions →
                            </a>
                          )}
                          <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
                            <button onClick={()=>openDoubt(activeSubj)} style={{padding:"9px 18px",borderRadius:10,background:"rgba(244,114,182,0.1)",border:"1px solid rgba(244,114,182,0.3)",color:"#f472b6",fontWeight:600,fontSize:13,cursor:"pointer",fontFamily:"var(--font-body)"}}>
                              Ask Doubt About This
                            </button>
                          </div>
                        </div>
                      )}
                      <div style={{display:"flex",flexDirection:"column",gap:8}}>
                        {homework.filter(h=>h.subject===activeSubj).map(h=>{
                          const due=new Date(h.dueDate);const over=due<new Date();
                          const isSelected=activeHW?.id===h.id;
                          return(
                            <div key={h.id} className="hw-row" onClick={()=>setActiveHW(isSelected?null:h)}
                              style={{borderColor:isSelected?"var(--purple2)":"var(--border)"}}>
                              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:16}}>
                                <div>
                                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4,flexWrap:"wrap"}}>
                                    <p style={{margin:0,fontWeight:600,fontSize:15,color:"var(--text)",fontFamily:"var(--font-head)"}}>{h.title}</p>
                                    {h.chapter&&<span className="chapter-tag" style={{background:"rgba(124,58,237,0.1)",color:"var(--purple3)"}}>{h.chapter}</span>}
                                    {h.category&&<span className="chapter-tag" style={{...HW_CAT_COLORS[h.category]||HW_CAT_COLORS.chapter,textTransform:"capitalize"}}>{h.category}</span>}
                                  </div>
                                  {h.description&&<p style={{margin:0,fontSize:12,color:"var(--text2)"}}>{h.description}</p>}
                                </div>
                                <div style={{textAlign:"right",flexShrink:0}}>
                                  <p style={{fontSize:10,color:"var(--text3)",margin:"0 0 3px",fontFamily:"var(--font-mono)"}}>DUE</p>
                                  <p style={{fontSize:13,fontWeight:700,color:over?"#f87171":"#34d399",margin:0,fontFamily:"var(--font-mono)"}}>{due.toLocaleDateString("en-IN",{day:"numeric",month:"short"})}</p>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          )}

          {!activeSubj&&!liveSession&&!loading&&(
            <div style={{border:"1px dashed var(--border)",borderRadius:18,padding:"40px 24px",textAlign:"center"}}>
              <p style={{color:"var(--text3)",fontSize:14,margin:0}}>Select a subject from the left sidebar to view study material and homework</p>
            </div>
          )}

            </div>
          </div>
        </div>
      </div>

      {/* SIDEBAR OVERLAY */}
      <div className={`sd-overlay ${sidebar?"open":""}`} onClick={()=>setSidebar(false)}/>
      <div className={`sd-sidebar ${sidebar?"open":""}`}>
        <div style={{padding:"20px 20px 0",borderBottom:"1px solid var(--border)",paddingBottom:14,flexShrink:0}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <div className="sd-av" style={{width:38,height:38,fontSize:13,cursor:"default"}}>{initials}</div>
              <div>
                <p style={{fontWeight:700,fontSize:15,color:"var(--text)",margin:"0 0 1px",fontFamily:"var(--font-head)"}}>{profile?.name||"Student"}</p>
                <p style={{fontSize:11,color:isPaid?"var(--purple3)":"var(--text3)",margin:0,fontFamily:"var(--font-mono)"}}>{isPaid?"● PREMIUM":"● FREE"}</p>
              </div>
            </div>
            <button onClick={()=>setSidebar(false)} style={{width:32,height:32,borderRadius:8,background:"var(--surface)",border:"1px solid var(--border)",color:"var(--text2)",cursor:"pointer",fontSize:16,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>✕</button>
          </div>
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            {["profile","edit","delete"].map(t=>(
              <button key={t} className={`stab ${sidebarTab===t?"stab-active":"stab-inactive"}`} onClick={()=>setSidebarTab(t)} style={{textTransform:"capitalize"}}>
                {t==="delete"?"Delete Acct":t}
              </button>
            ))}
          </div>
        </div>

        <div style={{flex:1,overflowY:"auto",padding:"14px 20px"}}>
          {sidebarTab==="profile"&&(
            <>
              {[
                {label:"Class",   value:`Class ${profile?.cls||"—"}`},
                {label:"School",  value:profile?.school||"—"},
                {label:"Email",   value:profile?.email||user?.email||"—"},
                {label:"Phone",   value:profile?.phone||"—"},
                {label:"Username",value:`@${profile?.username||"—"}`},
                {label:"Joined",  value:profile?.createdAt?new Date(profile.createdAt).toLocaleDateString("en-IN",{day:"numeric",month:"long",year:"numeric"}):"—"},
              ].map(item=>(
                <div key={item.label} style={{padding:"11px 0",borderBottom:"1px solid var(--border)"}}>
                  <p style={{fontSize:10,fontWeight:600,color:"var(--text3)",textTransform:"uppercase",letterSpacing:"0.07em",margin:"0 0 3px",fontFamily:"var(--font-mono)"}}>{item.label}</p>
                  <p style={{fontSize:14,fontWeight:500,color:"var(--text)",margin:0}}>{item.value}</p>
                </div>
              ))}
              <div style={{marginTop:16,background:"rgba(124,58,237,0.08)",border:"1px solid rgba(124,58,237,0.2)",borderRadius:14,padding:16}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                  <span style={{fontSize:13,fontWeight:600,color:"var(--text2)"}}>Subscription</span>
                  <span style={{fontSize:11,fontWeight:700,padding:"3px 10px",borderRadius:20,background:isPaid?"rgba(124,58,237,0.2)":"rgba(255,255,255,0.06)",color:isPaid?"var(--purple3)":"var(--text3)",fontFamily:"var(--font-mono)"}}>
                    {isPaid?"PREMIUM":"FREE"}
                  </span>
                </div>
                {isPaid?<p style={{fontSize:13,color:"#34d399",margin:0,fontWeight:600}}>Full access active</p>:(
                  <>
                    <p style={{fontSize:12,color:"var(--text3)",margin:"0 0 10px",lineHeight:1.6}}>Upgrade to unlock notes, homework, AI assistant and live classes.</p>
                    <p style={{fontSize:20,fontWeight:700,fontFamily:"var(--font-head)",color:"var(--cyan)",margin:"0 0 10px"}}>₹200<span style={{fontSize:12,color:"var(--text3)",fontWeight:400}}>/week</span></p>
                    <button onClick={openPayment} style={{width:"100%",padding:"11px",background:"var(--grad)",border:"none",borderRadius:10,color:"#fff",fontWeight:700,fontSize:14,cursor:"pointer",fontFamily:"var(--font-body)"}}>Upgrade Now</button>
                  </>
                )}
              </div>
              <button onClick={onLogout} style={{width:"100%",padding:"11px",border:"1px solid var(--border)",borderRadius:12,background:"transparent",color:"var(--text2)",fontFamily:"var(--font-body)",fontSize:14,cursor:"pointer",marginTop:12}}>Sign Out</button>
            </>
          )}

          {sidebarTab==="edit"&&(
            <div>
              <p style={{fontSize:13,color:"var(--text2)",margin:"0 0 16px",lineHeight:1.6}}>Email and username cannot be changed.</p>
              {[
                {label:"Full Name",key:"name",placeholder:"Your name"},
                {label:"Class",    key:"cls", placeholder:"6, 7, 8, 9 or 10"},
                {label:"School",   key:"school",placeholder:"School name"},
                {label:"Phone",    key:"phone",placeholder:"+91 98765 43210"},
              ].map(f=>(
                <div key={f.key} style={{marginBottom:14}}>
                  <label style={{fontSize:11,fontWeight:600,color:"var(--text2)",textTransform:"uppercase",letterSpacing:"0.07em",fontFamily:"var(--font-mono)"}}>{f.label}</label>
                  <input className="edit-in" value={editForm[f.key]||""} onChange={e=>setEditForm(ef=>({...ef,[f.key]:e.target.value}))} placeholder={f.placeholder}/>
                </div>
              ))}
              {/* Locked fields */}
              {[
                {label:"Email (locked)",    value:profile?.email||user?.email||"—"},
                {label:"Username (locked)", value:`@${profile?.username||"—"}`},
              ].map(f=>(
                <div key={f.label} style={{marginBottom:14}}>
                  <label style={{fontSize:11,fontWeight:600,color:"var(--text3)",textTransform:"uppercase",letterSpacing:"0.07em",fontFamily:"var(--font-mono)"}}>{f.label}</label>
                  <div className="locked-field">{f.value}</div>
                </div>
              ))}
              {editError&&<div style={{background:"rgba(248,113,113,0.08)",border:"1px solid rgba(248,113,113,0.2)",borderRadius:10,padding:"10px 14px",color:"#fca5a5",fontSize:13,marginBottom:12}}>{editError}</div>}
              {editSuccess&&<div style={{background:"rgba(52,211,153,0.08)",border:"1px solid rgba(52,211,153,0.2)",borderRadius:10,padding:"10px 14px",color:"#34d399",fontSize:13,marginBottom:12}}>{editSuccess}</div>}
              <button onClick={saveEdit} disabled={editLoading} style={{width:"100%",padding:"11px",background:"var(--grad)",border:"none",borderRadius:10,color:"#fff",fontWeight:700,fontSize:14,cursor:"pointer",fontFamily:"var(--font-body)",opacity:editLoading?0.6:1}}>
                {editLoading?"Saving...":"Save Changes"}
              </button>
            </div>
          )}

          {sidebarTab==="delete"&&(
            <div>
              <div style={{background:"rgba(248,113,113,0.08)",border:"1px solid rgba(248,113,113,0.2)",borderRadius:14,padding:16,marginBottom:20}}>
                <p style={{margin:"0 0 6px",fontWeight:700,fontSize:15,color:"#f87171",fontFamily:"var(--font-head)"}}>Delete Account</p>
                <p style={{margin:0,fontSize:13,color:"var(--text2)",lineHeight:1.6}}>This permanently deletes your account and all data. Cannot be undone.</p>
              </div>
              <div style={{marginBottom:14}}>
                <label style={{fontSize:11,fontWeight:600,color:"var(--text2)",textTransform:"uppercase",letterSpacing:"0.07em",fontFamily:"var(--font-mono)"}}>Confirm Password</label>
                <input className="edit-in" type="password" placeholder="Enter your password" value={delPass} onChange={e=>setDelPass(e.target.value)}/>
              </div>
              {delError&&<div style={{background:"rgba(248,113,113,0.08)",border:"1px solid rgba(248,113,113,0.2)",borderRadius:10,padding:"10px 14px",color:"#fca5a5",fontSize:13,marginBottom:12}}>{delError}</div>}
              <button onClick={deleteAccount} disabled={delLoading||!delPass} style={{width:"100%",padding:"11px",background:"rgba(248,113,113,0.1)",border:"1px solid rgba(248,113,113,0.3)",borderRadius:12,color:"#f87171",fontFamily:"var(--font-body)",fontSize:14,fontWeight:700,cursor:"pointer",opacity:delPass?1:0.5}}>
                {delLoading?"Deleting...":"Delete My Account"}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* DOUBT CHAT PANEL */}
      {isPaid&&doubtOpen&&(
        <div className="doubt-panel">
          <div style={{padding:"14px 16px",borderBottom:"1px solid var(--border)",display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0}}>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <div style={{width:10,height:10,borderRadius:"50%",background:SUBJECT_META[doubtSubj]?.color}}/>
              <div>
                <p style={{margin:0,fontSize:14,fontWeight:700,color:"var(--text)",fontFamily:"var(--font-head)"}}>{SUBJECT_META[doubtSubj]?.label} Doubt</p>
                <p style={{margin:0,fontSize:11,color:"var(--text3)"}}>{SUBJECT_META[doubtSubj]?.teacher} will reply shortly</p>
              </div>
            </div>
            <button onClick={()=>setDoubtOpen(false)} style={{background:"none",border:"none",color:"var(--text3)",cursor:"pointer",fontSize:18,lineHeight:1}}>✕</button>
          </div>
          <div style={{flex:1,overflowY:"auto",padding:"14px",display:"flex",flexDirection:"column",gap:10}}>
            {doubtMsgs.length===0&&<p style={{color:"var(--text3)",fontSize:13,textAlign:"center",marginTop:40}}>No messages yet. Ask your doubt below.</p>}
            {doubtMsgs.map((m,i)=>(
              <div key={i} style={{display:"flex",justifyContent:m.sender==="student"?"flex-end":"flex-start",flexDirection:"column",alignItems:m.sender==="student"?"flex-end":"flex-start",gap:3}}>
                {m.sender!=="student"&&<p style={{fontSize:10,color:"var(--text3)",margin:0,fontFamily:"var(--font-mono)"}}>{m.teacherName||"Teacher"}</p>}
                <div className={m.sender==="student"?"bubble-s":"bubble-t"}>
                  {m.imageUrl&&<img src={m.imageUrl} alt="doubt" style={{maxWidth:"100%",borderRadius:8,marginBottom:6}}/>}
                  {m.fileUrl&&<a href={m.fileUrl} target="_blank" rel="noreferrer" style={{display:"block",color:"var(--cyan)",fontSize:12,marginBottom:4}}>View file →</a>}
                  {m.text}
                </div>
              </div>
            ))}
            <div ref={doubtBottom}/>
          </div>
          <div style={{padding:"10px 12px",borderTop:"1px solid var(--border)",display:"flex",gap:8,flexShrink:0}}>
            <input value={doubtInput} onChange={e=>setDoubtInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&sendDoubt()}
              placeholder="Type your doubt..." style={{flex:1,padding:"10px 12px",background:"rgba(255,255,255,0.05)",border:"1px solid var(--border)",borderRadius:10,color:"var(--text)",fontFamily:"var(--font-body)",fontSize:13,outline:"none"}}/>
            {/* Upload image/PDF */}
            <label title="Upload photo or PDF" style={{width:38,height:38,borderRadius:10,background:"rgba(244,114,182,0.1)",border:"1px solid rgba(244,114,182,0.2)",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:16,flexShrink:0}}>
              <input type="file" accept="image/*,.pdf" style={{display:"none"}} onChange={e=>handleDoubtFile(e.target.files[0])} disabled={uploadingDoubt}/>
              {uploadingDoubt?"⏳":"📎"}
            </label>
            <button onClick={()=>sendDoubt()} style={{width:38,height:38,borderRadius:10,background:"linear-gradient(135deg,#f472b6,#ec4899)",border:"none",cursor:"pointer",color:"#fff",fontSize:16,flexShrink:0}}>→</button>
          </div>
        </div>
      )}

      {/* DOUBT FAB — paid only, when a subject is active */}
      {isPaid&&activeSubj&&!doubtOpen&&(
        <button className="doubt-fab" onClick={()=>openDoubt(activeSubj)} title="Ask a doubt">
          ?
        </button>
      )}

      {/* AI CHATBOT — paid only */}
      {isPaid&&(
        <>
          {chatOpen&&(
            <div className="chat-panel">
              <div style={{padding:"14px 16px",borderBottom:"1px solid var(--border)",display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0}}>
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <div style={{width:32,height:32,borderRadius:"50%",background:"var(--grad)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14}}>✦</div>
                  <div>
                    <p style={{margin:0,fontSize:14,fontWeight:700,color:"var(--text)",fontFamily:"var(--font-head)"}}>AI Assistant</p>
                    <p style={{margin:0,fontSize:11,color:"var(--text3)"}}>Ask anything · homework help</p>
                  </div>
                </div>
                <button onClick={()=>setChatOpen(false)} style={{background:"none",border:"none",color:"var(--text3)",cursor:"pointer",fontSize:18,lineHeight:1}}>✕</button>
              </div>
              <div style={{flex:1,overflowY:"auto",padding:"14px",display:"flex",flexDirection:"column",gap:10}}>
                {messages.map((m,i)=>(
                  <div key={i} style={{display:"flex",justifyContent:m.role==="user"?"flex-end":"flex-start"}}>
                    <div className={m.role==="user"?"bubble-s":"bubble-ai"}>{m.content}</div>
                  </div>
                ))}
                {chatLoading&&(
                  <div style={{display:"flex",gap:4,padding:"12px 16px",background:"var(--bg3)",border:"1px solid var(--border)",borderRadius:"18px 18px 18px 4px",width:"fit-content"}}>
                    {[0,1,2].map(i=><div key={i} style={{width:6,height:6,borderRadius:"50%",background:"var(--text3)",animation:`bounce 1s ease ${i*0.2}s infinite`}}/>)}
                  </div>
                )}
                <div ref={chatBottom}/>
              </div>
              <div style={{padding:"10px 12px",borderTop:"1px solid var(--border)",display:"flex",gap:8,flexShrink:0}}>
                <input value={chatInput} onChange={e=>setChatInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&!e.shiftKey&&sendChat()}
                  placeholder="Ask a doubt or describe homework..." style={{flex:1,padding:"10px 12px",background:"rgba(255,255,255,0.05)",border:"1px solid var(--border)",borderRadius:10,color:"var(--text)",fontFamily:"var(--font-body)",fontSize:13,outline:"none"}}/>
                <button onClick={sendChat} disabled={chatLoading||!chatInput.trim()} style={{width:38,height:38,borderRadius:10,background:"var(--grad)",border:"none",cursor:"pointer",color:"#fff",fontSize:16,flexShrink:0,opacity:chatInput.trim()?1:0.4}}>→</button>
              </div>
            </div>
          )}
          <button className="chat-fab" onClick={()=>{setChatOpen(!chatOpen);setDoubtOpen(false);}} title="AI Assistant">
            {chatOpen?"✕":"✦"}
          </button>
        </>
      )}
      <style>{`@keyframes bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}`}</style>

      {/* PAYMENT PORTAL */}
      {showPayment&&(
        <PaymentPortal
          profile={profile}
          onClose={()=>setShowPayment(false)}
          onSuccess={()=>{}}
        />
      )}
    </>
  );
}

function MatCard({item,color,isPremium}){
  return(
    <div className="mat-card" style={{borderColor:isPremium?"rgba(124,58,237,0.2)":"var(--border)"}}>
      {isPremium&&<div style={{display:"inline-block",fontSize:10,fontWeight:700,color:"var(--purple3)",fontFamily:"var(--font-mono)",background:"rgba(124,58,237,0.1)",padding:"2px 8px",borderRadius:6,marginBottom:8}}>PREMIUM</div>}
      {item.chapter&&<div style={{display:"inline-block",fontSize:10,fontWeight:700,color:"var(--purple3)",fontFamily:"var(--font-mono)",background:"rgba(124,58,237,0.08)",padding:"2px 8px",borderRadius:6,marginBottom:6,marginLeft:isPremium?6:0}}>{item.chapter}</div>}
      <p style={{margin:"0 0 4px",fontWeight:700,fontSize:15,color:"var(--text)",fontFamily:"var(--font-head)"}}>{item.title}</p>
      {item.description&&<p style={{fontSize:12,color:"var(--text2)",margin:"0 0 12px",lineHeight:1.6}}>{item.description}</p>}
      {item.link&&<a href={item.link} target="_blank" rel="noreferrer" style={{display:"inline-flex",alignItems:"center",gap:6,padding:"7px 14px",borderRadius:8,background:`${color}18`,border:`1px solid ${color}30`,color:color,fontSize:12,fontWeight:600,textDecoration:"none"}}>Open →</a>}
    </div>
  );
}