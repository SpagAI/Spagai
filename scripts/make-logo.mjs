// Generates the Spag AI mark as a precisely symmetric SVG.
// The S is one solid white shape; two identical arcs sit on each side.
// The right/bottom half is the left/top half rotated 180 degrees, so the logo is point-symmetric.
import { writeFileSync } from "node:fs";

const W = 1000, H = 1200, CX = 500, CY = 600;
const HALF_H = 400;      // half height of the S
const BULGE = 150;       // how far the S swings sideways
const SLANT = 90;        // tips sit on opposite sides of centre
const S_WIDTH = 210;     // thickness of the S body

// centreline of the S, t in [0,1], top -> bottom
const centre = (t) => ({
  x: CX + SLANT * (1 - 2 * t) - BULGE * Math.sin(2 * Math.PI * t),
  y: CY - HALF_H + 2 * HALF_H * t,
});
const tangent = (t) => {
  const e = 1e-4, a = centre(t - e), b = centre(t + e);
  const dx = b.x - a.x, dy = b.y - a.y, l = Math.hypot(dx, dy);
  return { x: dx / l, y: dy / l };
};
const normal = (t) => { const d = tangent(t); return { x: d.y, y: -d.x }; }; // points left of travel direction... (screen: toward -x when going down)

// a crescent/ribbon along the centreline between t0 and t1, offset sideways by `off`,
// with thickness tapering to a point at both ends
function ribbon(t0, t1, off, width, taper = 0.75, n = 80) {
  const left = [], right = [];
  for (let i = 0; i <= n; i++) {
    const u = i / n, t = t0 + (t1 - t0) * u;
    const w = (width / 2) * Math.pow(Math.sin(Math.PI * u), taper);
    const c = centre(t), nm = normal(t);
    const cx = c.x + nm.x * off, cy = c.y + nm.y * off;
    left.push([cx + nm.x * w, cy + nm.y * w]);
    right.push([cx - nm.x * w, cy - nm.y * w]);
  }
  const pts = [...left, ...right.reverse()];
  return "M" + pts.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join("L") + "Z";
}

// S body: full length, solid
const body = ribbon(0.0, 1.0, 0, S_WIDTH, 0.55, 200);
// two identical arcs on the upper-left side, same length, same thickness, evenly spaced
const GAP = 36, ARC_W = 44, ARC_OFF0 = S_WIDTH / 2 + 40;
const arcs = [0, 1].map((k) => ribbon(0.04, 0.46, -(ARC_OFF0 + k * (GAP + ARC_W)) , ARC_W, 0.7));
// NOTE: normal() points toward +x when travelling down at the top; negative offset pushes to the left side

const half = arcs.map((d) => `<path d="${d}"/>`).join("");
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}">
<g fill="#fff"><path d="${body}"/>${half}<g transform="rotate(180 ${CX} ${CY})">${half}</g></g>
</svg>`;
writeFileSync(process.argv[2] ?? "spag-logo.svg", svg);
console.log("ok", svg.length);
