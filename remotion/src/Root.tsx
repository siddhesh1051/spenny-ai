import "./index.css";
import { Composition } from "remotion";
import { SageTrailer } from "./SageTrailer";

// Duration = sum of scene frames - transition frames
// Scenes: 270 + 300 + 330 + 420 + 420 + 450 + 390 + 330 = 2910
// Transitions: 7 × 40 = 280
// Total: 2910 - 280 = 2630 frames ≈ 43.8s at 60fps
const TOTAL_FRAMES = 2630;

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="SageTrailer"
        component={SageTrailer}
        durationInFrames={TOTAL_FRAMES}
        fps={60}
        width={1920}
        height={1080}
      />
    </>
  );
};
