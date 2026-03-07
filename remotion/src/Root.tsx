import "./index.css";
import { Composition, Still } from "remotion";
import { SageTrailer } from "./SageTrailer";
import { OgThumbnail } from "./OgThumbnail";
import { FaviconStill } from "./FaviconStill";

const FPS = 60;

// Scene durations in seconds (fps-independent)
// 4.5 + 5.0 + 5.5 + 7.0 + 7.0 + 7.5 + 6.5 + 5.5 = 48.5s of scenes
// 7 transitions × (40/60)s ≈ 4.67s removed
// Total wall-clock ≈ 43.8s
const SCENE_SECONDS = [4.5, 5.0, 5.5, 7.0, 7.0, 7.5, 6.5, 5.5];
const TRANSITION_SECONDS = 40 / 60; // transition was 40 frames at 60fps
const TOTAL_FRAMES =
  Math.round(SCENE_SECONDS.reduce((a, b) => a + b, 0) * FPS) -
  Math.round(7 * TRANSITION_SECONDS * FPS);

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="SageTrailer"
        component={SageTrailer}
        durationInFrames={TOTAL_FRAMES}
        fps={FPS}
        width={2560}
        height={1440}
      />
      <Still
        id="OgThumbnail"
        component={OgThumbnail}
        width={1200}
        height={630}
      />
      <Still
        id="Favicon"
        component={FaviconStill}
        width={512}
        height={512}
      />
    </>
  );
};
