/**
 * Fixed ambient background: two faint purple/blue light blobs.
 * Colors follow the theme tokens so the glow softens in light mode.
 * Static on purpose — animating large blurred layers forces a repaint
 * every frame and costs GPU time for zero visual gain.
 */
export default function BackgroundFX() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <div className="absolute -left-40 top-[-15%] h-[480px] w-[480px] rounded-full bg-[var(--blob-a)] blur-[130px]" />
      <div className="absolute -right-48 top-[35%] h-[500px] w-[500px] rounded-full bg-[var(--blob-b)] blur-[140px]" />
    </div>
  )
}