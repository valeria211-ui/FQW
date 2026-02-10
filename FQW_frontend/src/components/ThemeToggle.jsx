import { Moon, Sun } from "lucide-react";

export const ThemeToggle = ({ theme, setTheme }) => {
  const isDark = theme === "dark";
  return (
    <button
      onClick={() => setTheme(isDark ? "light" : "dark")}
      style={{
        all: "unset",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        gap: "8px",
        padding: "8px 12px",
        borderRadius: "10px",
        background: isDark ? "#1a1c23" : "#ffffff",
        color: isDark ? "#e0e0e0" : "#222",
        border: isDark ? "1px solid #2d303a" : "1px solid #e0e0e0",
        boxShadow: isDark ? "0 6px 16px rgba(0,0,0,0.25)" : "0 6px 16px rgba(0,0,0,0.08)"
      }}
      title="Toggle theme"
    >
      {isDark ? <Moon size={16} /> : <Sun size={16} />}
      <span style={{ fontSize: "12px" }}>{isDark ? "Dark" : "Light"}</span>
    </button>
  );
};
