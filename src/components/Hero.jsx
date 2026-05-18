import { useEffect, useState } from "react";

export default function Hero({ setPage }) {
  const [blur, setBlur] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const value = window.scrollY * 0.2;
      setBlur(value);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div
      id="home"
      className="min-h-screen flex flex-col justify-center items-center text-center px-4 relative overflow-hidden"
    >
      {/* GLOW BACKGROUND */}
      <div className="absolute w-[500px] h-[500px] bg-pink-500/20 blur-[140px] rounded-full top-10 left-10"></div>
      <div className="absolute w-[400px] h-[400px] bg-blue-500/20 blur-[140px] rounded-full bottom-10 right-10"></div>

      {/* HERO CONTENT */}
      <div
        style={{ filter: `blur(${blur * 0.05}px)` }}
        className="transition-all duration-300"
      >
        <h1 className="text-6xl md:text-7xl font-extrabold leading-tight mb-6">
          Study Smart <br />
          <span className="text-pink-500">Not Hard</span>
        </h1>

        <p className="text-gray-400 text-lg mb-8 max-w-xl mx-auto">
          School teaches memorization. We teach thinking. Learn smarter, faster, and actually understand.
        </p>

        <button
          onClick={() => setPage("signup")}
          className="bg-gradient-to-r from-pink-500 to-orange-400 px-8 py-3 rounded-xl text-lg font-semibold hover:scale-110 transition shadow-lg hover:shadow-pink-500/40 active:scale-95"
        >
          Join Now
        </button>
      </div>
    </div>
  );
}