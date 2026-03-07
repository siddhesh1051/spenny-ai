import { staticFile, Img } from "remotion";

export const FaviconStill: React.FC = () => {
  return (
    <div
      style={{
        width: 512,
        height: 512,
        position: "relative",
        borderRadius: 120,
        overflow: "hidden",
        background: "#030c07",
      }}
    >
      {/* Background radial glow */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(circle at 60% 40%, rgba(26,138,90,0.22) 0%, transparent 65%)",
        }}
      />

      {/* Clover SVG centred */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <svg
          width={340}
          height={340}
          viewBox="0 0 512 512"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M256 32C256 32 256 144 256 144C256 144 144 144 144 256C144 256 144 368 256 368C256 368 256 480 256 480C256 480 368 480 368 368C368 368 480 368 480 256C480 256 480 144 368 144C368 144 368 32 256 32Z"
            fill="url(#fav-grad)"
            opacity="0.92"
          />
          <path
            d="M256 144C256 144 144 144 144 256C144 256 32 256 32 256C32 256 32 144 144 144C144 144 144 32 256 32C256 32 256 144 256 144Z"
            fill="url(#fav-grad2)"
            opacity="0.78"
          />
          <defs>
            <linearGradient id="fav-grad" x1="144" y1="32" x2="480" y2="480" gradientUnits="userSpaceOnUse">
              <stop stopColor="#3dd68c" />
              <stop offset="1" stopColor="#0f5e3c" />
            </linearGradient>
            <linearGradient id="fav-grad2" x1="32" y1="32" x2="256" y2="256" gradientUnits="userSpaceOnUse">
              <stop stopColor="#3dd68c" />
              <stop offset="1" stopColor="#1a8a5a" />
            </linearGradient>
          </defs>
        </svg>
      </div>
    </div>
  );
};
