import "./index.css";
import { Composition, Still } from "remotion";
import { SageTrailer } from "./SageTrailer";
import { OgThumbnail } from "./OgThumbnail";
import { IconCoinChat, LockupCoinChat, SheetCoinChat } from "./LogoAll";
import { SubtleIconCompare } from "./SubtleIcons";

const FPS = 60;
const SCENE_SECONDS = [4.5, 5.0, 5.5, 7.0, 7.0, 7.5, 6.5, 5.5];
const TRANSITION_SECONDS = 40 / 60;
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
      <Still id="OgThumbnail"       component={OgThumbnail}       width={1200} height={630} />
      <Still id="IconCoinChat"      component={IconCoinChat}      width={512}  height={512} />
      <Still id="LockupCoinChat"    component={LockupCoinChat}    width={900}  height={260} />
      <Still id="SheetCoinChat"     component={SheetCoinChat}     width={1200} height={700} />
      <Still id="SubtleIconCompare" component={SubtleIconCompare} width={1200} height={420} />
    </>
  );
};
