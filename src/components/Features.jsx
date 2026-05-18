import { useState, useEffect } from "react";

export default function Features() {
  const [activeBox, setActiveBox] = useState(null);

  // Click outside to close
  useEffect(() => {
    const handleClick = () => setActiveBox(null);
    window.addEventListener("click", handleClick);

    return () => window.removeEventListener("click", handleClick);
  }, []);

  const data = [
    {
      title: "Classes 6–10",
      desc: "Strong basics → Concept clarity → Board domination 🔥",
      extra: [
        "Class 6–7 → Foundation",
        "Class 8 → Concept clarity",
        "Class 9–10 → Exam mastery"
      ]
    },
    {
      title: "Core Subjects",
      desc: "Maths • Science • Social • Hindi — simplified",
      extra: [
        "Maths → Problem solving",
        "Science → Real understanding",
        "Social → Concept linking",
        "Hindi → Grammar + literature"
      ]
    },
    {
      title: "4PM – 8PM",
      desc: "After school. Focused learning. Zero distractions.",
      extra: [
        "4–5 → Class 6–7",
        "5–6 → Class 8",
        "6–7 → Class 9",
        "7–8 → Class 10"
      ]
    }
  ];

  return (
    <div
      id="features"
      className="py-32 text-center bg-gradient-to-b from-[#020617] via-[#0b1220] to-[#020617]"
    >
      <h2 className="text-4xl font-bold mb-3">Features</h2>

      <p className="text-gray-400 mb-16">
        You don’t hate studying. You hate boring teaching.
      </p>

      <div className="flex justify-center gap-10 flex-wrap items-start">

        {data.map((box, i) => (
          <div
            key={i}
            onClick={(e) => {
                e.stopPropagation();
                 setActiveBox(activeBox === i ? null : i);
            }}
            className={`w-[320px] p-8 rounded-2xl cursor-pointer backdrop-blur-xl border border-white/10 transition-all duration-300
            ${
              activeBox === i
                ? "bg-white/20 shadow-xl shadow-pink-500/20"
                : "bg-white/5 hover:bg-white/10 hover:shadow-lg hover:shadow-pink-500/10"
            }`}
          >
            <h3 className="text-xl font-semibold mb-2">{box.title}</h3>

            <p className="text-gray-400 text-sm">{box.desc}</p>

            {/* EXPANDED CONTENT */}
            {activeBox === i && (
              <div className="mt-5 text-sm text-pink-300 space-y-1 animate-fadeIn">
                {box.extra.map((line, index) => (
                  <p key={index}>• {line}</p>
                ))}
              </div>
            )}
          </div>
        ))}

      </div>
    </div>
  );
}