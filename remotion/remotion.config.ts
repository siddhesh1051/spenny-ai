/**
 * Note: When using the Node.JS APIs, the config file
 * doesn't apply. Instead, pass options directly to the APIs.
 *
 * All configuration options: https://remotion.dev/docs/config
 */

import { Config } from "@remotion/cli/config";
import { enableTailwind } from '@remotion/tailwind-v4';

// Use PNG frames instead of JPEG — eliminates lossy compression artifacts
// on gradients, text edges, and dark backgrounds
Config.setVideoImageFormat("png");

// Lower CRF = higher quality (range 0–51, lower is better)
// 8 is near-visually-lossless for motion design content
Config.setOverwriteOutput(true);

// Full chroma resolution — prevents color banding on gradients and dark scenes
Config.setPixelFormat("yuv444p");

Config.overrideWebpackConfig(enableTailwind);
