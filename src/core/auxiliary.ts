import "./lib/actqueue.js";
import "./lib/durat.js";
import "./lib/typed_emitter.js";

export function debugLog(message: string): void {
  if (debugLog.enableDebug)
    console.debug("[DEBUG]", message);
}
debugLog.enableDebug = false;

export function stringifyCoordinates(
  coordsLike: { x?: number, y?: number, z?: number }
    | [x:number, y:number, z:number]
    | [x:number, z:number]
): string {
  if (!Array.isArray(coordsLike))
    return [
      (coordsLike.x !== undefined ? `X=${coordsLike.x}` : ''),
      (coordsLike.y !== undefined ? `Y=${coordsLike.y}` : ''),
      (coordsLike.z !== undefined ? `Z=${coordsLike.z}` : ''),
    ].join(" ");
  else if (Array.isArray(coordsLike)) {
    if (coordsLike.length === 3)
      return `X=${coordsLike[0]} Y=${coordsLike[1]} Z=${coordsLike[2]}`;
    else if (coordsLike.length === 2)
      return `X=${coordsLike[0]} Z=${coordsLike[1]}`;
  }
  return "<incorrect-coordinates>";
}
