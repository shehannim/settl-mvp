import { useEffect, useState, useRef } from "react";
import axios from "axios";
import logo from "../assets/Settl Logo.png";

const API = import.meta.env.VITE_API_URL || "https://settl-backend-s3rc.onrender.com";

const TOTAL_TICKS = 48; // Total radial tick segments around the dial
const STAGES = [
  { threshold: 15, text: "Ingesting verified profile data..." },
  { threshold: 35, text: "Analyzing income stream telemetry..." },
  { threshold: 60, text: "Calibrating alternative underwriting baseline..." },
  { threshold: 85, text: "Generating cryptographically signed report..." },
  { threshold: 100, text: "Finalizing your Settl score..." },
];

export default function ScoreCalibration({ go, token }) {
  const [progress, setProgress] = useState(1);
  const [statusMessage, setStatusMessage] = useState("Our AI is calibrating your score");
  const [scoreReady, setScoreReady] = useState(false);
  const authToken = token || localStorage.getItem("token");
  const scoreReadyRef = useRef(false);

  // Trigger score computation asynchronously
  useEffect(() => {
    let isMounted = true;
    const compute = async () => {
      try {
        if (authToken) {
          await axios.post(
            `${API}/api/score/compute`,
            {},
            { headers: { Authorization: `Bearer ${authToken}` } }
          );
        }
      } catch (err) {
        console.warn("Score computation request finished with fallback:", err);
      } finally {
        if (isMounted) {
          setScoreReady(true);
          scoreReadyRef.current = true;
        }
      }
    };
    compute();
    return () => {
      isMounted = false;
    };
  }, [authToken]);

  // Smooth realistic progress animation
  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((prev) => {
        // If score is calculated and we reach or pass 100%, show 100% and pause for a full second before navigating
        if (scoreReadyRef.current) {
          if (prev >= 100) {
            clearInterval(interval);
            setTimeout(() => {
              go("dashboard");
            }, 1000);
            return 100;
          }
          const next = prev + Math.floor(Math.random() * 4) + 2;
          if (next >= 100) {
            clearInterval(interval);
            setTimeout(() => {
              go("dashboard");
            }, 1000);
            return 100;
          }
          return next;
        }

        // If score computation is still waiting, smoothly decelerate towards 90%
        if (prev < 30) {
          return prev + 2;
        } else if (prev < 65) {
          return prev + 1;
        } else if (prev < 88) {
          return Math.random() > 0.3 ? prev + 1 : prev;
        } else if (prev < 94) {
          // Slow creep while waiting for backend response
          return Math.random() > 0.7 ? prev + 1 : prev;
        }
        return prev;
      });
    }, 80);

    return () => clearInterval(interval);
  }, [go]);

  // Update status messages dynamically as progress advances
  useEffect(() => {
    const currentStage = STAGES.find((stage) => progress <= stage.threshold) || STAGES[STAGES.length - 1];
    setStatusMessage(currentStage.text);
  }, [progress]);

  // Radial tick generation
  const activeTicksCount = Math.round((progress / 100) * TOTAL_TICKS);

  return (
    <main className="relative flex min-h-screen w-full flex-col items-center justify-between overflow-hidden bg-gradient-to-br from-[#00388c] via-[#004fc5] to-[#042866] px-6 py-10 text-white select-none">
      {/* Dynamic ambient glow orbs */}
      <div className="pointer-events-none absolute -top-32 left-1/2 -translate-x-1/2 h-96 w-96 rounded-full bg-blue-400/20 blur-[120px]" />
      <div className="pointer-events-none absolute -bottom-32 left-1/2 -translate-x-1/2 h-96 w-96 rounded-full bg-indigo-500/25 blur-[120px]" />

      {/* Top Header / Settl Identity */}
      <header className="relative z-10 flex w-full max-w-md items-center justify-center pt-2">
        <img
          src={logo}
          alt="Settl"
          className="h-9 sm:h-10 w-auto object-contain drop-shadow-md"
        />
      </header>

      {/* Center: Radial Dial Loader matching user's reference mockup */}
      <section className="relative z-10 flex flex-col items-center justify-center my-auto">
        <div className="relative flex h-72 w-72 sm:h-80 sm:w-80 items-center justify-center">
          {/* Radial Tick Lines */}
          <svg className="absolute inset-0 h-full w-full" viewBox="0 0 300 300">
            <defs>
              <linearGradient id="activeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#ff8a65" />
                <stop offset="50%" stopColor="#ff5252" />
                <stop offset="100%" stopColor="#ffffff" />
              </linearGradient>
            </defs>

            {Array.from({ length: TOTAL_TICKS }).map((_, i) => {
              const angle = (i / TOTAL_TICKS) * 360; // 0deg is 12 o'clock
              const isActive = i < activeTicksCount;
              // Check if tick is near the leading edge of active progress for glow highlight
              const isLead = i >= activeTicksCount - 8 && i < activeTicksCount;

              let stroke = "rgba(255, 255, 255, 0.18)"; // Inactive ticks
              let strokeWidth = 3;

              if (isActive) {
                if (isLead) {
                  // Vibrant coral/orange-red accent on the active leading arc
                  stroke = "#ff6e54";
                  strokeWidth = 3.5;
                } else {
                  // Solid crisp white with high contrast
                  stroke = "rgba(255, 255, 255, 0.9)";
                  strokeWidth = 3;
                }
              }

              return (
                <line
                  key={i}
                  x1="150"
                  y1="22"
                  x2="150"
                  y2={isLead ? "46" : "42"}
                  stroke={stroke}
                  strokeWidth={strokeWidth}
                  strokeLinecap="round"
                  transform={`rotate(${angle} 150 150)`}
                  className="transition-all duration-150"
                />
              );
            })}
          </svg>

          {/* Center Info readout */}
          <div className="flex flex-col items-center justify-center text-center">
            <span className="font-sans text-5xl sm:text-6xl font-extrabold tracking-tight text-white drop-shadow-sm">
              {progress}%
            </span>
            <span className="mt-2 text-xs sm:text-sm font-medium lowercase tracking-wider text-blue-200">
              processing
            </span>
          </div>
        </div>
      </section>

      {/* Bottom Status text & AI Processing info */}
      <footer className="relative z-10 flex flex-col items-center text-center pb-4 sm:pb-8 max-w-sm px-4">
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
          Our AI is processing data
        </h2>
        <p className="mt-2 text-xs sm:text-sm font-normal leading-relaxed text-blue-100/90">
          Sit tight and relax, the process will take up to 30 seconds
        </p>

        <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3.5 py-1.5 backdrop-blur-md">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal-400 opacity-75"></span>
            <span className="relative inline-flex h-2 w-2 rounded-full bg-teal-400"></span>
          </span>
          <span className="text-[11px] font-medium tracking-wide text-blue-100">
            {statusMessage}
          </span>
        </div>
      </footer>
    </main>
  );
}
