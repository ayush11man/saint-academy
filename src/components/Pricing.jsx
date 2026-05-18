export default function Pricing() {
  return (
    <div id="pricing" className="py-28 px-6">

      {/* Divider */}
      <div className="w-full flex justify-center mb-20">
        <div className="w-2/3 h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
      </div>

      {/* Pricing */}
      <div className="text-center mb-24">
        <h2 className="text-4xl font-bold mb-4">Pricing</h2>

        <div className="flex justify-center mt-10">
          <div className="p-10 rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 shadow-xl hover:scale-105 transition duration-300">

            <h3 className="text-2xl font-semibold mb-4">₹200 / week</h3>

            <p className="text-gray-400 mb-6">
              Affordable. Effective. Worth it.
            </p>

            <button className="px-6 py-2 rounded-lg bg-gradient-to-r from-pink-500 to-orange-400 hover:scale-105 transition">
              Join Now 🚀
            </button>

          </div>
        </div>
      </div>

      {/* Divider */}
      <div className="w-full flex justify-center mb-20">
        <div className="w-2/3 h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
      </div>

      {/* Contact */}
      <div id="contact" className="text-center">
        <h2 className="text-3xl font-bold mb-6">Contact</h2>

        <p className="text-gray-400 mb-2">
          Email:{" "}
          <a
            href="mailto:saintacademy365@email.com?subject=Inquiry&body=Hello Saint Academy,"
            className="text-pink-400 hover:underline"
          >
            saintacademy@email.com
          </a>
        </p>

        <p className="text-gray-400">
          Phone: +91 9876543210
        </p>
      </div>

    </div>
  );
}
