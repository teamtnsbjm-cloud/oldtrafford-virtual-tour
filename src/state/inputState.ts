/** Shared touch/virtual input (written by MobileControls, read by PlayerController). */
export const inputState = {
  /** virtual joystick, -1..1 (x = right, y = back) */
  joyX: 0,
  joyY: 0,
  /** sticky run toggle from the touch button */
  run: false,
  /** one-shot jump request (keyboard Space or touch button) */
  jumpQueued: false,
  /** one-shot slide-tackle request (F key or touch button) */
  tackleQueued: false,
}
