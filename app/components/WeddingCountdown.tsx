"use client";

import { useState, useEffect } from "react";

// ── Types ──────────────────────────────────────────────────────────────────

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  arrived: boolean;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function defaultTargetDate(): string {
  const d = new Date();
  d.setMonth(d.getMonth() + 6);
  return d.toISOString().split("T")[0];
}

function daysFromNow(dateStr: string): number {
  const diff = new Date(dateStr + "T00:00:00").getTime() - new Date().setHours(0, 0, 0, 0);
  return Math.max(0, Math.round(diff / 86_400_000));
}

function dateFromDays(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().split("T")[0];
}

function calcTimeLeft(target: string): TimeLeft {
  const diff = new Date(target).getTime() - Date.now();
  if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0, arrived: true };
  return {
    days:    Math.floor(diff / 86_400_000),
    hours:   Math.floor((diff % 86_400_000) / 3_600_000),
    minutes: Math.floor((diff % 3_600_000)  / 60_000),
    seconds: Math.floor((diff % 60_000)     / 1_000),
    arrived: false,
  };
}

// ── Botanical petals (purely CSS-animated, no React state needed) ──────────

const PETAL_SYMBOLS = ["✿", "❀", "✦", "◦", "✾"];
const PETAL_COLORS  = [
  "rgba(196,122,90,0.42)",
  "rgba(201,169,155,0.48)",
  "rgba(180,145,125,0.36)",
  "rgba(215,185,165,0.44)",
  "rgba(195,155,130,0.40)",
];

const PETALS = Array.from({ length: 15 }, (_, i) => ({
  id:       i,
  symbol:   PETAL_SYMBOLS[i % 5],
  color:    PETAL_COLORS[i % 5],
  left:     `${(i * 6.8 + 2.5) % 95}%`,
  fontSize: 11 + (i % 4) * 4,
  duration: 9 + (i % 7) * 1.6,
  // negative delay so petals are already mid-flight on page load
  delay:    -((i * 2.7) % 18),
}));

// ── CountBlock ─────────────────────────────────────────────────────────────

function CountBlock({
  value,
  label,
  isSeconds,
}: {
  value: number;
  label: string;
  isSeconds?: boolean;
}) {
  const numStr = String(value).padStart(2, "0");

  return (
    <div
      className="count-block"
      style={{
        background: "#ffffff",
        border: "1px solid #ede8e3",
        borderRadius: 16,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "26px 8px 22px",
      }}
    >
      {/* Number — seconds gets key trick so tickPop restarts every second */}
      {isSeconds ? (
        <span
          key={value}
          className="font-playfair tick-pop"
          style={{
            fontSize: 46,
            fontStyle: "italic",
            fontWeight: 700,
            color: "#2c1a14",
            lineHeight: 1,
          }}
        >
          {numStr}
        </span>
      ) : (
        <span
          className="font-playfair"
          style={{
            fontSize: 46,
            fontStyle: "italic",
            fontWeight: 700,
            color: "#2c1a14",
            lineHeight: 1,
          }}
        >
          {numStr}
        </span>
      )}

      {/* Thin rule */}
      <div
        style={{
          width: 28,
          height: 1,
          background: "#ede8e3",
          margin: "14px 0 12px",
          flexShrink: 0,
        }}
      />

      {/* Label */}
      <span
        className="font-dm-sans"
        style={{
          fontSize: 10,
          letterSpacing: "2.5px",
          color: "#c9a99b",
          textTransform: "uppercase",
          fontWeight: 400,
        }}
      >
        {label}
      </span>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

type InputMode = "date" | "days";

export default function WeddingCountdown() {
  const [targetDate, setTargetDate] = useState("");
  const [daysInput, setDaysInput] = useState("");
  const [inputMode, setInputMode] = useState<InputMode>("date");
  const [timeLeft, setTimeLeft] = useState<TimeLeft>({
    days: 0, hours: 0, minutes: 0, seconds: 0, arrived: false,
  });

  // On mount: show localStorage instantly, then sync the real date from the server
  useEffect(() => {
    const cached = localStorage.getItem("weddingDate") ?? defaultTargetDate();
    setTargetDate(cached);
    setDaysInput(String(daysFromNow(cached)));
    setTimeLeft(calcTimeLeft(cached));

    fetch("/api/date")
      .then((r) => r.json())
      .then(({ date }: { date: string | null }) => {
        const resolved = date ?? defaultTargetDate();
        localStorage.setItem("weddingDate", resolved);
        setTargetDate(resolved);
        setDaysInput(String(daysFromNow(resolved)));
        setTimeLeft(calcTimeLeft(resolved));
      })
      .catch(() => {/* keep cached value on network error */});
  }, []);

  // Tick every second
  useEffect(() => {
    if (!targetDate) return;
    const id = setInterval(() => setTimeLeft(calcTimeLeft(targetDate)), 1000);
    return () => clearInterval(id);
  }, [targetDate]);

  function applyDate(val: string) {
    // Optimistic update
    setTargetDate(val);
    setDaysInput(String(daysFromNow(val)));
    localStorage.setItem("weddingDate", val);
    setTimeLeft(calcTimeLeft(val));
    // Persist to server so all visitors see the change
    fetch("/api/date", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: val }),
    }).catch(() => {/* fail silently; local state already updated */});
  }

  function handleDaysChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value;
    setDaysInput(raw);
    const n = parseInt(raw, 10);
    if (!isNaN(n) && n >= 0) {
      applyDate(dateFromDays(n));
    }
  }

  const formattedDate = targetDate
    ? new Date(targetDate + "T00:00:00").toLocaleDateString("en-US", {
        weekday: "long",
        month:   "long",
        day:     "numeric",
        year:    "numeric",
      })
    : "";

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#faf8f5",
        overflow: "hidden",
        position: "relative",
      }}
      className="flex items-center justify-center px-6 py-16"
    >
      {/* ── Floating botanical symbols ── */}
      {PETALS.map((p) => (
        <span
          key={p.id}
          className="float-petal"
          style={{
            left:            p.left,
            fontSize:        p.fontSize,
            color:           p.color,
            animationDuration: `${p.duration}s`,
            animationDelay:    `${p.delay}s`,
          }}
        >
          {p.symbol}
        </span>
      ))}

      {/* ── Content column ── */}
      <div
        className="relative z-10 flex flex-col items-center text-center w-full"
        style={{ maxWidth: 540, gap: 36 }}
      >
        {/* SAVE THE DATE */}
        <p
          className="font-dm-sans fade-up"
          style={{
            fontSize:      11,
            letterSpacing: "4.5px",
            textTransform: "uppercase",
            color:         "#c9a99b",
            fontWeight:    400,
            animationDelay: "0s",
          }}
        >
          Save the Date
        </p>

        {/* Title */}
        <h1
          className="font-playfair fade-up"
          style={{
            fontSize:       "clamp(36px, 6vw, 52px)",
            fontStyle:      "italic",
            fontWeight:     700,
            lineHeight:     1.15,
            color:          "#2c1a14",
            animationDelay: "0.1s",
          }}
        >
          Until We Say{" "}
          <span style={{ color: "#c47a5a" }}>I Do</span>
        </h1>

        {/* Divider */}
        <div
          className="fade-up flex items-center w-full"
          style={{ gap: 16, animationDelay: "0.18s" }}
        >
          <div
            style={{
              flex: 1,
              height: 1,
              background: "linear-gradient(to right, transparent, #c9a99b55)",
            }}
          />
          <span style={{ fontSize: 18, lineHeight: 1 }}>🌿</span>
          <div
            style={{
              flex: 1,
              height: 1,
              background: "linear-gradient(to left, transparent, #c9a99b55)",
            }}
          />
        </div>

        {/* Tagline */}
        <p
          className="font-dm-sans fade-up"
          style={{
            fontSize:       12,
            letterSpacing:  "3.5px",
            color:          "#c9a99b",
            fontWeight:     300,
            animationDelay: "0.26s",
            marginTop: -12,
          }}
        >
          Every second is a gift ✦
        </p>

        {/* Countdown or arrived */}
        {timeLeft.arrived ? (
          <p
            className="font-playfair fade-up"
            style={{
              fontSize:       "clamp(28px, 5vw, 40px)",
              fontStyle:      "italic",
              fontWeight:     700,
              color:          "#c47a5a",
              animationDelay: "0.32s",
            }}
          >
            Today is the day ✦
          </p>
        ) : (
          <div
            className="fade-up grid grid-cols-2 sm:grid-cols-4 gap-3 w-full"
            style={{ animationDelay: "0.32s" }}
          >
            <CountBlock value={timeLeft.days}    label="Days"    />
            <CountBlock value={timeLeft.hours}   label="Hours"   />
            <CountBlock value={timeLeft.minutes} label="Minutes" />
            <CountBlock value={timeLeft.seconds} label="Seconds" isSeconds />
          </div>
        )}

        {/* Formatted date */}
        {formattedDate && !timeLeft.arrived && (
          <p
            className="font-dm-sans fade-up"
            style={{
              fontSize:       13,
              color:          "#b8a090",
              fontWeight:     300,
              letterSpacing:  "0.5px",
              marginTop:      -8,
              animationDelay: "0.4s",
            }}
          >
            {formattedDate}
          </p>
        )}

        {/* Input section */}
        <div
          className="fade-up flex flex-col items-center"
          style={{ gap: 12, animationDelay: "0.46s" }}
        >
          {/* Mode toggle */}
          <div className="flex items-center" style={{ gap: 20 }}>
            {(["date", "days"] as InputMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => setInputMode(mode)}
                className="font-dm-sans"
                style={{
                  fontSize:       10,
                  letterSpacing:  "3px",
                  textTransform:  "uppercase",
                  fontWeight:     400,
                  background:     "none",
                  border:         "none",
                  cursor:         "pointer",
                  padding:        "2px 0",
                  color:          inputMode === mode ? "#c47a5a" : "#c9a99b",
                  borderBottom:   inputMode === mode ? "1px solid #c47a5a" : "1px solid transparent",
                  transition:     "color 0.18s, border-color 0.18s",
                }}
              >
                {mode === "date" ? "Pick a date" : "Days from now"}
              </button>
            ))}
          </div>

          {/* Date picker */}
          {inputMode === "date" && (
            <input
              type="date"
              value={targetDate}
              onChange={(e) => applyDate(e.target.value)}
              className="date-input font-dm-sans"
              style={{
                border:        "1px solid #ede8e3",
                borderRadius:  10,
                padding:       "10px 18px",
                fontSize:      13,
                color:         "#2c1a14",
                background:    "#ffffff",
                cursor:        "pointer",
                fontWeight:    400,
                letterSpacing: "0.3px",
              }}
            />
          )}

          {/* Days input */}
          {inputMode === "days" && (
            <div className="flex items-center" style={{ gap: 10 }}>
              <input
                type="number"
                min="0"
                max="9999"
                value={daysInput}
                onChange={handleDaysChange}
                placeholder="180"
                className="date-input font-dm-sans"
                style={{
                  border:        "1px solid #ede8e3",
                  borderRadius:  10,
                  padding:       "10px 14px",
                  fontSize:      13,
                  color:         "#2c1a14",
                  background:    "#ffffff",
                  fontWeight:    400,
                  width:         80,
                  textAlign:     "center",
                  letterSpacing: "0.3px",
                }}
              />
              <span
                className="font-dm-sans"
                style={{ fontSize: 12, color: "#c9a99b", fontWeight: 300, letterSpacing: "0.5px" }}
              >
                days from today
              </span>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
