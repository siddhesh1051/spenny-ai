// All scenes are authored at this fixed design resolution.
// SageTrailer.tsx wraps them in a scaled container so the actual render
// resolution (e.g. 1920×1080) does not affect scene layout at all.
export const DESIGN_WIDTH = 1280;
export const DESIGN_HEIGHT = 720;

export function useDesignConfig() {
  return { width: DESIGN_WIDTH, height: DESIGN_HEIGHT };
}
