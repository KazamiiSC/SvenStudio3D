/** Vertical MAP camera navigation: Q descends, E ascends.
 * Do not consume E while face extrusion is selected. Gameplay Test handles
 * E as interaction independently of this helper. */
export function keyboardVerticalDirection(pressed:ReadonlySet<string>,faceExtrudeActive=false):number{
  const down=pressed.has('KeyQ')||pressed.has('q');
  const up=!faceExtrudeActive&&(pressed.has('KeyE')||pressed.has('e'));
  return Number(up)-Number(down);
}
