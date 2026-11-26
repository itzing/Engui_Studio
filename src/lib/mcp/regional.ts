import sharp from "sharp";
import { createHash } from "node:crypto";
import { fail, type RegionalMaskInput } from "./core";
import { readMask } from "./masks";

type Point = { x: number; y: number };
const cross = (a: Point, b: Point, c: Point) => (b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
const on = (a: Point,b: Point,p: Point) => Math.abs(cross(a,b,p)) < 1e-12 && p.x >= Math.min(a.x,b.x)-1e-12 && p.x <= Math.max(a.x,b.x)+1e-12 && p.y >= Math.min(a.y,b.y)-1e-12 && p.y <= Math.max(a.y,b.y)+1e-12;
function intersects(a:Point,b:Point,c:Point,d:Point) {
  return (cross(a,b,c)*cross(a,b,d)<0 && cross(c,d,a)*cross(c,d,b)<0) || on(a,b,c) || on(a,b,d) || on(c,d,a) || on(c,d,b);
}
export async function readRegionalMask(mask: RegionalMaskInput, width: number, height: number) {
  if (mask.kind !== "polygon") return readMask(mask, width, height);
  const p = mask.points;
  if (new Set(p.map(v => v.x + "," + v.y)).size !== p.length)
    fail("INVALID_MASK", "Polygon vertices must be distinct; the last point connects to the first automatically.");
  const area = p.reduce((sum,a,i) => { const b=p[(i+1)%p.length]; return sum+a.x*b.y-b.x*a.y; },0);
  if (Math.abs(area) < 1e-12) fail("INVALID_MASK","Polygon must have nonzero area.");
  for (let i=0;i<p.length;i++) for(let j=i+1;j<p.length;j++) {
    if (j===i+1 || (i===0 && j===p.length-1)) continue;
    if (intersects(p[i],p[(i+1)%p.length],p[j],p[(j+1)%p.length]))
      fail("INVALID_MASK","Polygon edges must not self-intersect.");
  }
  // All interpolated values are validated finite numbers, never user-authored SVG.
  const points=p.map(v => (v.x*width)+","+(v.y*height)).join(" ");
  const svg='<svg xmlns="http://www.w3.org/2000/svg" width="'+width+'" height="'+height+'"><rect width="100%" height="100%" fill="black"/><polygon points="'+points+'" fill="white"/></svg>';
  const bytes=await sharp(Buffer.from(svg)).greyscale().removeAlpha().png().toBuffer();
  const pixels=await sharp(bytes).raw().toBuffer();
  if (!pixels.some(v=>v>0)) fail("INVALID_MASK","Polygon is too small to cover output pixels.");
  return { bytes, snapshot: { input:mask, sha256:createHash("sha256").update(bytes).digest("hex"), sourceSha256:null as string|null, width,height,mimeType:"image/png" } };
}
