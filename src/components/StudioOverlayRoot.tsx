import type {CSSProperties,ReactNode} from 'react';
import {createPortal} from 'react-dom';

/** Viewport-sized studios must not inherit the MAP dock's CSS zoom.
 * Theme tokens live on documentElement; font preference remains inherited here.
 * React context and events survive the portal, including project/undo handlers.
 */
export function StudioOverlayRoot({children,fontScale}:{children:ReactNode;fontScale:number}){
 return createPortal(<div className="studio-overlay-root" style={{'--ui-font-scale':fontScale} as CSSProperties}>{children}</div>,document.body);
}
