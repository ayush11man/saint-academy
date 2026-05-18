import { useState } from "react";
import { auth, db } from "../firebase";
import { signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider } from "firebase/auth";
import { doc, getDoc, collection, query, where, getDocs, setDoc } from "firebase/firestore";

export default function Login({ setPage, setUser, setRole, setProfile }) {
  const [identifier, setIdentifier] = useState("");
  const [password,   setPassword]   = useState("");
  const [showPass,   setShowPass]   = useState(false);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState("");

  const handle = async () => {
    setError("");
    if (!identifier.trim() || !password) {
      setError("Please fill in all fields.");
      return;
    }
    setLoading(true);

    try {
      let emailToUse = identifier.trim();

      // If not an email format, treat as username — look up in Firestore
      if (!emailToUse.includes("@")) {
        const usernameToFind = emailToUse.toLowerCase();
        try {
          const q = query(
            collection(db, "users"),
            where("username", "==", usernameToFind)
          );
          const snap = await getDocs(q);

          if (snap.empty) {
            // Also try without lowercasing in case it was stored differently
            const q2 = query(
              collection(db, "users"),
              where("username", "==", emailToUse)
            );
            const snap2 = await getDocs(q2);

            if (snap2.empty) {
              setError("No account found with that username.");
              setLoading(false);
              return;
            }
            emailToUse = snap2.docs[0].data().email;
          } else {
            emailToUse = snap.docs[0].data().email;
          }
        } catch (e) {
          console.error("Username lookup failed due to permissions:", e);
          if (e?.code === "permission-denied") {
            setError("For security, please log in with your email address instead of username.");
          } else {
            setError(`Login failed: ${e.message}`);
          }
          setLoading(false);
          return;
        }
      }

      const cred = await signInWithEmailAndPassword(auth, emailToUse, password);

      // Load profile from Firestore
      const snap = await getDoc(doc(db, "users", cred.user.uid));
      const d = snap.exists() ? snap.data() : { role: "student" };
      setUser(cred.user);
      setRole(d.role);
      setProfile(d);
      setPage(d.role === "teacher" ? "teacher" : "dashboard");

    } catch (err) {
      const c = err.code;
      if (["auth/user-not-found","auth/wrong-password","auth/invalid-credential"].includes(c)) {
        setError("Incorrect email/username or password.");
      } else if (c === "auth/invalid-email") {
        setError("Enter a valid email or username.");
      } else if (c === "auth/too-many-requests") {
        setError("Too many attempts. Try again later.");
      } else {
        setError(`Login failed: ${err.message}`);
      }
    } finally {
      setLoading(false);
    }
  };
  
  const handleGoogle = async () => {
    setError("");
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      // Check if user exists in Firestore
      const snap = await getDoc(doc(db, "users", user.uid));
      let d;
      if (!snap.exists()) {
        // Create default profile for new Google user
        d = {
          name: user.displayName || "Student",
          email: user.email,
          username: user.email.split("@")[0] + "_" + Math.floor(Math.random()*1000),
          role: "student",
          cls: "", // force them to fill it out
          plan: "free",
          createdAt: new Date().toISOString(),
        };
        await setDoc(doc(db, "users", user.uid), d);
      } else {
        d = snap.data();
      }

      setUser(user);
      setRole(d.role);
      setProfile(d);
      setPage(d.role === "teacher" ? "teacher" : "dashboard");
    } catch (err) {
      console.error(err);
      if (err.code !== "auth/popup-closed-by-user") {
        setError(`Google Sign-In failed: ${err.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <style>{`
        .li-in {
          width: 100%;
          padding: 12px 16px;
          background: rgba(255,255,255,0.02);
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 12px;
          color: var(--text);
          font-family: var(--font-body);
          font-size: 14px;
          outline: none;
          transition: all 0.25s ease;
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          box-shadow: inset 0 1px 1px rgba(255,255,255,0.01);
          box-sizing: border-box;
        }
        .li-in::placeholder { color: var(--text3); }
        .li-in:focus {
          border-color: rgba(0, 229, 255, 0.5);
          background-color: rgba(255,255,255,0.05);
          box-shadow: 0 0 15px rgba(0, 229, 255, 0.15), inset 0 1px 1px rgba(255,255,255,0.05);
        }
        .li-btn {
          width: 100%;
          padding: 13px;
          background: var(--grad);
          border: none;
          border-radius: 12px;
          color: #fff;
          font-weight: 700;
          font-size: 15px;
          font-family: var(--font-body);
          cursor: pointer;
          transition: all 0.25s ease;
          box-shadow: 0 4px 15px rgba(124,58,237,0.35);
        }
        .li-btn:hover:not(:disabled) {
          opacity: 0.95;
          transform: translateY(-1.5px);
          box-shadow: 0 6px 20px rgba(0, 229, 255, 0.45);
        }
        .li-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
          box-shadow: none;
        }
        .g-btn {
          width: 100%;
          padding: 12px;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 12px;
          color: var(--text);
          font-weight: 600;
          font-size: 14px;
          font-family: var(--font-body);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          transition: all 0.25s ease;
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
        }
        .g-btn:hover:not(:disabled) {
          background: rgba(255,255,255,0.07);
          border-color: rgba(255,255,255,0.15);
          transform: translateY(-1.5px);
          box-shadow: 0 6px 15px rgba(0,0,0,0.15);
        }
        @keyframes floatBlob1 {
          0% { transform: translate(0, 0) scale(1); }
          100% { transform: translate(40px, -60px) scale(1.1); }
        }
        @keyframes floatBlob2 {
          0% { transform: translate(0, 0) scale(1); }
          100% { transform: translate(-30px, 40px) scale(1.05); }
        }
        @keyframes floatBlob3 {
          0% { transform: translate(0, 0) scale(1); }
          100% { transform: translate(-30px, -30px) scale(1.15); }
        }
      `}</style>

      <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"var(--bg)",padding:"40px 16px",fontFamily:"var(--font-body)",position:"relative",overflow:"hidden"}}>
        {/* Colorful Animated Background Blobs for Visual Glassmorphic Pop */}
        <div style={{position:"absolute",width:600,height:600,borderRadius:"50%",background:"radial-gradient(circle,rgba(124,58,237,0.18) 0%,transparent 70%)",top:"-15%",left:"-15%",pointerEvents:"none",filter:"blur(50px)",animation:"floatBlob1 15s ease infinite alternate"}}/>
        <div style={{position:"absolute",width:500,height:500,borderRadius:"50%",background:"radial-gradient(circle,rgba(0,229,255,0.12) 0%,transparent 70%)",bottom:"-10%",right:"-10%",pointerEvents:"none",filter:"blur(50px)",animation:"floatBlob2 18s ease infinite alternate"}}/>
        <div style={{position:"absolute",width:400,height:400,borderRadius:"50%",background:"radial-gradient(circle,rgba(168,85,247,0.08) 0%,transparent 70%)",top:"35%",right:"25%",pointerEvents:"none",filter:"blur(40px)",animation:"floatBlob3 20s ease infinite alternate"}}/>

        <div style={{width:"100%",maxWidth:420,position:"relative",zIndex:1,animation:"fadeUp 0.5s ease"}}>
          <button onClick={()=>setPage("landing")} style={{display:"flex",alignItems:"center",gap:6,background:"none",border:"none",color:"var(--text2)",cursor:"pointer",fontSize:13,fontFamily:"var(--font-body)",marginBottom:28,padding:0,transition:"color 0.2s"}} onMouseEnter={e=>e.currentTarget.style.color="var(--text)"} onMouseLeave={e=>e.currentTarget.style.color="var(--text2)"}>
            ← Back to home
          </button>

          <div style={{
            background:"rgba(13,15,26,0.55)",
            border:"1px solid rgba(255,255,255,0.08)",
            borderRadius:24,
            overflow:"hidden",
            backdropFilter:"blur(24px)",
            WebkitBackdropFilter:"blur(24px)",
            boxShadow:"0 30px 70px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255, 255, 255, 0.1)"
          }}>
            <div style={{height:3,background:"var(--grad)",opacity:0.85}}/>
            <div style={{padding:"36px 32px 40px"}}>
              <div style={{marginBottom:28}}>
                <div style={{width:44,height:44,borderRadius:12,background:"var(--grad)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:700,color:"#fff",fontFamily:"var(--font-mono)",marginBottom:16}}>SA</div>
                <h1 style={{fontSize:24,fontWeight:700,fontFamily:"var(--font-head)",letterSpacing:"-0.02em",margin:"0 0 6px",color:"var(--text)"}}>Welcome back</h1>
                <p style={{color:"var(--text2)",fontSize:14,margin:0}}>Sign in with your email or username</p>
              </div>

              <div style={{display:"flex",flexDirection:"column",gap:14,marginBottom:20}}>
                <div>
                  <label style={lbl}>Email or Username</label>
                  <input className="li-in" type="text" placeholder="you@email.com or arjun_sharma"
                    value={identifier} onChange={e=>setIdentifier(e.target.value)}
                    onKeyDown={e=>e.key==="Enter"&&handle()} autoCapitalize="none" autoCorrect="off"/>
                </div>
                <div>
                  <label style={lbl}>Password</label>
                  <div style={{position:"relative"}}>
                    <input className="li-in" type={showPass?"text":"password"} placeholder="Your password"
                      value={password} onChange={e=>setPassword(e.target.value)}
                      onKeyDown={e=>e.key==="Enter"&&handle()} style={{paddingRight:64}}/>
                    <button onClick={()=>setShowPass(!showPass)} style={{position:"absolute",right:14,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",color:"var(--text3)",cursor:"pointer",fontSize:11,fontWeight:700,fontFamily:"var(--font-mono)"}}>
                      {showPass?"HIDE":"SHOW"}
                    </button>
                  </div>
                </div>
              </div>

              {error&&(
                <div style={{background:"rgba(248,113,113,0.08)",border:"1px solid rgba(248,113,113,0.2)",borderRadius:10,padding:"10px 14px",color:"#fca5a5",fontSize:13,marginBottom:16}}>
                  {error}
                </div>
              )}

              <button className="li-btn" onClick={handle} disabled={loading} style={{marginBottom:16}}>
                {loading?"Signing in...":"Sign In"}
              </button>

              <button className="g-btn" onClick={handleGoogle} disabled={loading} style={{marginBottom:20}}>
                <svg width="18" height="18" viewBox="0 0 18 18"><path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285f4"/><path d="M9 18c2.43 0 4.467-.806 5.956-2.184L12.048 13.56c-.413.277-.942.441-1.548.441-1.187 0-2.192-.801-2.551-1.876H4.96v2.336A8.995 8.995 0 0 0 9 18z" fill="#34a853"/><path d="M6.449 12.125c-.183-.547-.288-1.129-.288-1.733s.105-1.186.288-1.733V6.323H4.96A8.995 8.995 0 0 0 4 10.392c0 1.452.348 2.827.96 4.049l1.489-2.316z" fill="#fbbc05"/><path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.89 11.426 0 9 0 5.48 0 2.443 2.117 1.107 5.174L3.892 7.51c.359-1.075 1.364-1.876 2.551-1.876z" fill="#ea4335"/></svg>
                Sign in with Google
              </button>

              <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20}}>
                <div style={{flex:1,height:1,background:"var(--border)"}}/>
                <span style={{fontSize:12,color:"var(--text3)"}}>or</span>
                <div style={{flex:1,height:1,background:"var(--border)"}}/>
              </div>

              <p style={{textAlign:"center",fontSize:14,color:"var(--text2)",margin:0}}>
                New here?{" "}
                <span style={{color:"var(--cyan)",cursor:"pointer",fontWeight:600}} onClick={()=>setPage("signup")}>
                  Create an account
                </span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

const lbl = {
  display:"block",fontSize:11,fontWeight:600,color:"var(--text2)",
  textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:8
};