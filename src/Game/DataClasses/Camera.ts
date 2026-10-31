type CameraProps = {
  viewWidth: number; // the visible box, in screen pixels
  viewHeight: number;
  worldWidth: number; // the whole level, in world pixels
  worldHeight: number;
  zoom: number;
};

type Point = { x: number; y: number };

export const CAMERA = {
  // the camera leans toward the mouse, so the player can look ahead
  lookPan: 0.3, // with the mouse at the edge of the view, how far the view shifts, as a fraction of the view
  lookZoomStart: 0.7, // how far from the middle of the view the mouse gets before the camera eases out, from 0 to 1
  lookZoomOut: 0.2, // with the mouse at the edge of the view, how much of the zoom is given up
  edgeMargin: 0.42, // how close to the edge of the view a piece gets before the view pans, as a fraction of the view
  minMouseTilePx: 20, // with a mouse, zoom in until tiles are at least this wide
  minTouchTilePx: 50, // on touch screens, zoom in until tiles are at least this wide
  panTransitionMs: 200 // smooths the pan between game ticks
};

// the camera pulling out to show the whole scene at a key moment
export const WIDE_SHOT = {
  pullMs: 700 // the move out, and the move back in
};

export const EDGE_CARET = {
  margin: 0.03, // from the edge of the view, as a fraction of the view's width
  minSize: 0.018, // as a fraction of the view's width
  maxSize: 0.04,
  nearTiles: 16, // at this distance from the player, or closer, a caret is at its largest
  farTiles: 40 // at this distance, or further, a caret is at its smallest
};

/*
    Keeps the player in view. The view only moves when the player nears its edge,
    and it stops at the edges of the level.
*/
export class Camera {
  x = 0; // top-left corner of the view, in world pixels
  y = 0;
  zoom: number;
  private baseZoom: number;
  private minZoom: number;
  private viewPxWidth: number;
  private viewPxHeight: number;
  private viewWidth: number;
  private viewHeight: number;
  private worldWidth: number;
  private worldHeight: number;

  constructor({ viewWidth, viewHeight, worldWidth, worldHeight, zoom }: CameraProps) {
    this.baseZoom = zoom;
    this.minZoom = Math.min(zoom, viewWidth / worldWidth, viewHeight / worldHeight);
    this.viewPxWidth = viewWidth;
    this.viewPxHeight = viewHeight;
    this.viewWidth = viewWidth / zoom;
    this.viewHeight = viewHeight / zoom;
    this.worldWidth = worldWidth;
    this.worldHeight = worldHeight;
    this.zoom = zoom;
  }

  // a level smaller than the view sits in the middle of it
  private getClamped(position: number, viewSize: number, worldSize: number) {
    if (worldSize <= viewSize) return (worldSize - viewSize) / 2;
    return Math.max(Math.min(position, worldSize - viewSize), 0);
  }

  centerOn({ x, y }: Point) {
    this.x = this.getClamped(x - this.viewWidth / 2, this.viewWidth, this.worldWidth);
    this.y = this.getClamped(y - this.viewHeight / 2, this.viewHeight, this.worldHeight);
  }

  follow({ x, y }: Point) {
    const marginX = this.viewWidth * CAMERA.edgeMargin;
    const marginY = this.viewHeight * CAMERA.edgeMargin;
    let nextX = this.x;
    let nextY = this.y;
    if (x < nextX + marginX) nextX = x - marginX;
    if (x > nextX + this.viewWidth - marginX) nextX = x - this.viewWidth + marginX;
    if (y < nextY + marginY) nextY = y - marginY;
    if (y > nextY + this.viewHeight - marginY) nextY = y - this.viewHeight + marginY;
    this.x = this.getClamped(nextX, this.viewWidth, this.worldWidth);
    this.y = this.getClamped(nextY, this.viewHeight, this.worldHeight);
  }

  private setZoom(zoom: number) {
    this.zoom = zoom;
    this.viewWidth = this.viewPxWidth / zoom;
    this.viewHeight = this.viewPxHeight / zoom;
  }

  // 'aim' is where the mouse is in the view: from -1 to 1 across, and down, with 0 in the middle
  lookToward({ x, y }: Point, aim: Point) {
    const reach = Math.min(Math.max(Math.abs(aim.x), Math.abs(aim.y)), 1);
    const easeOut = Math.max((reach - CAMERA.lookZoomStart) / (1 - CAMERA.lookZoomStart), 0);
    this.setZoom(Math.max(this.baseZoom * (1 - CAMERA.lookZoomOut * easeOut), this.minZoom));
    this.follow({
      x: x + aim.x * this.viewWidth * CAMERA.lookPan,
      y: y + aim.y * this.viewHeight * CAMERA.lookPan
    });
  }

  getTransform() {
    return `scale(${this.zoom}) translate(${-this.x}px, ${-this.y}px)`;
  }

  // a point on the edge of the view that points at something outside of it. undefined if it is in view.
  getEdgeCaret({ x, y }: Point, playerLocation: Point, tilePx: number) {
    const viewX = x - this.x;
    const viewY = y - this.y;
    if (viewX >= 0 && viewX <= this.viewWidth && viewY >= 0 && viewY <= this.viewHeight) return undefined;

    const margin = this.viewWidth * EDGE_CARET.margin;
    const clamp = (value: number, size: number) => Math.max(Math.min(value, size - margin), margin);
    const left = clamp(viewX, this.viewWidth);
    const top = clamp(viewY, this.viewHeight);
    const tiles = Math.hypot(x - playerLocation.x, y - playerLocation.y) / tilePx;
    const nearness = Math.max(Math.min((EDGE_CARET.farTiles - tiles) / (EDGE_CARET.farTiles - EDGE_CARET.nearTiles), 1), 0);
    const size = EDGE_CARET.minSize + (EDGE_CARET.maxSize - EDGE_CARET.minSize) * nearness;
    return {
      left: left * this.zoom,
      top: top * this.zoom,
      size: size * this.viewWidth * this.zoom,
      degrees: (Math.atan2(viewY - top, viewX - left) * 180) / Math.PI
    };
  }
}

// shows the whole level
export const getFitZoom = ({ viewWidth, viewHeight, worldWidth, worldHeight }: {
  viewWidth: number;
  viewHeight: number;
  worldWidth: number;
  worldHeight: number;
}) => Math.min(viewWidth / worldWidth, viewHeight / worldHeight);

// shows as much of the level as fits, then zooms in further if tiles would be too small to click or tap
export const getCameraZoom = ({ hexWidthPx, isTouch, viewWidth, viewHeight, worldWidth, worldHeight }: {
  hexWidthPx: number;
  isTouch: boolean;
  viewWidth: number;
  viewHeight: number;
  worldWidth: number;
  worldHeight: number;
}) => {
  const minTilePx = isTouch ? CAMERA.minTouchTilePx : CAMERA.minMouseTilePx;
  return Math.max(getFitZoom({ viewWidth, viewHeight, worldWidth, worldHeight }), minTilePx / hexWidthPx);
};

// the view during play: the level's camera zoom, on top of fitting the whole level in the frame
export const getCloseZoom = ({ cameraZoom, ...props }: Parameters<typeof getCameraZoom>[0] & { cameraZoom: number }) =>
  Math.max(getCameraZoom(props), getFitZoom(props) * cameraZoom);
