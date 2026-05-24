import { useState } from "react";
import pass from "../Components/password.png";

export default function PasswordInput() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (e) => {
    const value = e.target.value;
    setPassword(value);

    if (value.length < 8 || value.length > 16) {
      setError("Password must be 8 to 16 characters");
    } else {
      setError("");
    }
  };

  const togglePassword = () => {
    setShowPassword(!showPassword);
  };

  return (
    <div style={{ 
      display: "flex", 
      flexDirection: "column", 
      width: "100%",
      maxWidth: "420px"
    }}>
      <div style={{ 
        display: "flex", 
        alignItems: "center", 
        gap: "12px",
        background: "rgba(0, 0, 0, 0.4)",
        border: "2px solid rgba(255, 255, 255, 0.2)",
        borderRadius: "14px",
        padding: "14px 18px",
        transition: "all 0.3s ease"
      }}>
        <img 
          src={pass} 
          alt="password icon" 
          style={{ 
            width: "22px", 
            height: "22px",
            opacity: 0.9
          }} 
        />
        <input
          type={showPassword ? "text" : "password"}
          placeholder="Password"
          value={password}
          onChange={handleChange}
          style={{ 
            flex: 1, 
            padding: "0",
            fontSize: "16px",
            background: "transparent",
            border: "none",
            outline: "none",
            color: "#ffffff",
            fontFamily: "'Poppins', sans-serif",
            fontWeight: 500
          }}
        />
        <button
          type="button"
          onClick={togglePassword}
          style={{
            background: "transparent",
            border: "none",
            cursor: "pointer",
            padding: "0",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            opacity: 0.9,
            transition: "opacity 0.3s ease"
          }}
        >
          {showPassword ? (
            // Eye-off icon (hidden)
            <svg 
              width="22" 
              height="22" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="#ffffff" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round"
            >
              <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
              <line x1="1" y1="1" x2="23" y2="23"></line>
            </svg>
          ) : (
            // Eye icon (visible)
            <svg 
              width="22" 
              height="22" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="#ffffff" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round"
            >
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
              <circle cx="12" cy="12" r="3"></circle>
            </svg>
          )}
        </button>
      </div>
      {error && (
        <span style={{ 
          color: "#ff6b6b", 
          fontSize: "12px", 
          fontWeight: 500,
          marginTop: "6px",
          marginLeft: "4px"
        }}>
          {error}
        </span>
      )}
    </div>
  );
}
