export default function Auth({ setPage }) {
  return (
    <div style={{ color: "white", padding: "40px" }}>
      <h2>Welcome 👋</h2>

      <div style={{ marginTop: "20px" }}>
        <button 
          onClick={() => {
            console.log("going signup");
            setPage("signup");
          }}
          style={{ marginRight: "10px", padding: "10px" }}
        >
          Signup
        </button>

        <button 
          onClick={() => setPage("login")}
          style={{ padding: "10px" }}
        >
          Login
        </button>
      </div>
    </div>
  );
}