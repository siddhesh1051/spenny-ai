import "./index.css";
import { Composition, Still } from "remotion";
import { SageTrailer } from "./SageTrailer";
import { OgThumbnail } from "./OgThumbnail";
import { IconCoinChat, LockupCoinChat, SheetCoinChat } from "./LogoAll";
import { SubtleIconCompare } from "./SubtleIcons";
import { LogoOptionG } from "./LogoOptions2";
import {
  LogoV2Dark, LogoV2Light, LogoV2BlackWhite,
  LogoV2WhiteBlack, LogoV2Transparent,
  LogoV2Sheet, LogoV2Lockup, LogoV2LockupTransparent, LogoV2LockupFullTransparent,
} from "./LogoV2";

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

      {/* ── Logo V2 ─────────────────────────────────────────────────────── */}
      <Still id="LogoOptionG"        component={LogoOptionG}        width={512}  height={512} />
      <Still id="LogoV2Dark"         component={LogoV2Dark}         width={512}  height={512} />
      <Still id="LogoV2Light"        component={LogoV2Light}        width={512}  height={512} />
      <Still id="LogoV2BlackWhite"   component={LogoV2BlackWhite}   width={512}  height={512} />
      <Still id="LogoV2WhiteBlack"   component={LogoV2WhiteBlack}   width={512}  height={512} />
      <Still id="LogoV2Transparent"  component={LogoV2Transparent}  width={512}  height={512} />
      <Still id="LogoV2Sheet"        component={LogoV2Sheet}        width={1300} height={440} />
      <Still id="LogoV2Lockup"            component={LogoV2Lockup}            width={960} height={260} />
      <Still id="LogoV2LockupTransparent"     component={LogoV2LockupTransparent}     width={960} height={260} />
      <Still id="LogoV2LockupFullTransparent" component={LogoV2LockupFullTransparent} width={960} height={260} />
    </>
  );
};
