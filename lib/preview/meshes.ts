// Procedural meshes for the 3D parcel preview (ADR-0006): a reference wind
// turbine, a PV module table and a support post. Built from dimensions in
// lib/preview/reference-geometry.ts rather than loaded as glTF, for three
// reasons: nothing is licensed from a model library, every dimension on screen
// is one the interface names and lets the reader check, and changing the hub
// height is a function call rather than a new asset.
//
// This is model-space vertex construction — metres in a local x = east,
// y = north, z = up frame, as deck.gl's SimpleMeshLayer expects. It is not
// geospatial computation: where things *stand* comes from PostGIS
// (lib/db/queries/preview.ts), per ADR-0002.
//
// Deliberately plain: flat-shaded, matte, one neutral material per object.
// The register is an architect's white model, not a product render
// (design-language.md §2a).

export interface MeshData {
  readonly attributes: {
    readonly positions: { readonly value: Float32Array; readonly size: 3 };
    readonly normals: { readonly value: Float32Array; readonly size: 3 };
  };
}

type Vec3 = readonly [number, number, number];

class MeshBuilder {
  private readonly positions: number[] = [];
  private readonly normals: number[] = [];

  /**
   * One flat-shaded triangle. Every solid here is convex, so rather than
   * trusting hand-written winding the normal is simply pointed away from the
   * solid's centre — a face lit from inside would render black.
   */
  triangle(a: Vec3, b: Vec3, c: Vec3, centre: Vec3): void {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    let nx = uy * vz - uz * vy;
    let ny = uz * vx - ux * vz;
    let nz = ux * vy - uy * vx;
    const length = Math.hypot(nx, ny, nz) || 1;
    nx /= length;
    ny /= length;
    nz /= length;
    const ox = (a[0] + b[0] + c[0]) / 3 - centre[0];
    const oy = (a[1] + b[1] + c[1]) / 3 - centre[1];
    const oz = (a[2] + b[2] + c[2]) / 3 - centre[2];
    const outward = nx * ox + ny * oy + nz * oz >= 0;
    if (!outward) {
      nx = -nx;
      ny = -ny;
      nz = -nz;
    }
    for (const p of outward ? [a, b, c] : [a, c, b]) {
      this.positions.push(p[0], p[1], p[2]);
      this.normals.push(nx, ny, nz);
    }
  }

  quad(a: Vec3, b: Vec3, c: Vec3, d: Vec3, centre: Vec3): void {
    this.triangle(a, b, c, centre);
    this.triangle(a, c, d, centre);
  }

  /** A hexahedron from its eight corners: bottom face b0..b3 and top face t0..t3, in matching order. */
  hexahedron(b: readonly [Vec3, Vec3, Vec3, Vec3], t: readonly [Vec3, Vec3, Vec3, Vec3]): void {
    const corners = [...b, ...t];
    const centre: Vec3 = [0, 1, 2].map((k) => corners.reduce((sum, p) => sum + p[k]!, 0) / 8) as unknown as Vec3;
    this.quad(b[0], b[3], b[2], b[1], centre);
    this.quad(t[0], t[1], t[2], t[3], centre);
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4;
      this.quad(b[i]!, b[j]!, t[j]!, t[i]!, centre);
    }
  }

  box(cx: number, cy: number, cz: number, sx: number, sy: number, sz: number): void {
    const x0 = cx - sx / 2, x1 = cx + sx / 2;
    const y0 = cy - sy / 2, y1 = cy + sy / 2;
    const z0 = cz - sz / 2, z1 = cz + sz / 2;
    this.hexahedron(
      [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0]],
      [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]],
    );
  }

  /** A vertical truncated cone from z0 to z1, closed at the top. */
  taperedCylinder(r0: number, r1: number, z0: number, z1: number, segments: number): void {
    for (let i = 0; i < segments; i++) {
      const a0 = (i / segments) * Math.PI * 2;
      const a1 = ((i + 1) / segments) * Math.PI * 2;
      const p00: Vec3 = [Math.cos(a0) * r0, Math.sin(a0) * r0, z0];
      const p01: Vec3 = [Math.cos(a1) * r0, Math.sin(a1) * r0, z0];
      const p10: Vec3 = [Math.cos(a0) * r1, Math.sin(a0) * r1, z1];
      const p11: Vec3 = [Math.cos(a1) * r1, Math.sin(a1) * r1, z1];
      this.quad(p00, p01, p11, p10, [0, 0, (z0 + z1) / 2]);
      this.triangle([0, 0, z1], p10, p11, [0, 0, z0]);
    }
  }

  build(): MeshData {
    return {
      attributes: {
        positions: { value: new Float32Array(this.positions), size: 3 },
        normals: { value: new Float32Array(this.normals), size: 3 },
      },
    };
  }
}

/**
 * Proportions of the parts a reader does not see dimensioned — tower
 * diameter, nacelle size, blade chord. Scaled from the rotor so the silhouette
 * stays plausible across the slider range; stated here so none of it hides
 * inside a magic number.
 */
const TURBINE_PROPORTIONS = {
  towerBaseRadiusPerHub: 0.028,
  towerTopRadiusPerHub: 0.014,
  nacelleLengthPerRotor: 0.09,
  nacelleSizePerRotor: 0.028,
  hubRadiusPerRotor: 0.022,
  bladeRootChordPerRotor: 0.028,
  bladeTipChordPerRotor: 0.006,
  bladeThicknessPerRotor: 0.004,
  /** Distance from tower axis to rotor plane. */
  overhangPerRotor: 0.045,
} as const;

/** Tower and nacelle, with the rotor axis pointing along +x. The mast foot sits at the origin. */
export function turbineBodyMesh(hubHeightM: number, rotorDiameterM: number): MeshData {
  const p = TURBINE_PROPORTIONS;
  const m = new MeshBuilder();
  m.taperedCylinder(p.towerBaseRadiusPerHub * hubHeightM, p.towerTopRadiusPerHub * hubHeightM, 0, hubHeightM, 28);
  const nacelleLength = p.nacelleLengthPerRotor * rotorDiameterM;
  const nacelleSize = p.nacelleSizePerRotor * rotorDiameterM;
  m.box(nacelleLength * 0.15, 0, hubHeightM, nacelleLength, nacelleSize, nacelleSize);
  return m.build();
}

/** Where the rotor's centre sits relative to the mast foot, along the rotor axis. */
export function rotorOverhangM(rotorDiameterM: number): number {
  return TURBINE_PROPORTIONS.overhangPerRotor * rotorDiameterM + TURBINE_PROPORTIONS.nacelleLengthPerRotor * rotorDiameterM * 0.5;
}

/**
 * Three blades and a hub, centred on the origin, spinning about the x axis —
 * so deck.gl's `roll` turns it and `yaw` points it.
 */
export function rotorMesh(rotorDiameterM: number): MeshData {
  const p = TURBINE_PROPORTIONS;
  const radius = rotorDiameterM / 2;
  const hubRadius = p.hubRadiusPerRotor * rotorDiameterM;
  const rootChord = p.bladeRootChordPerRotor * rotorDiameterM;
  const tipChord = p.bladeTipChordPerRotor * rotorDiameterM;
  const thickness = p.bladeThicknessPerRotor * rotorDiameterM;
  const m = new MeshBuilder();

  m.box(0, 0, 0, hubRadius * 2.2, hubRadius * 2, hubRadius * 2);
  m.box(hubRadius * 1.4, 0, 0, hubRadius * 1.2, hubRadius * 1.3, hubRadius * 1.3);

  for (let blade = 0; blade < 3; blade++) {
    const angle = (blade / 3) * Math.PI * 2;
    // Radial and chord directions within the rotor plane (y–z).
    const ry = Math.cos(angle), rz = Math.sin(angle);
    const cy = -Math.sin(angle), cz = Math.cos(angle);
    const corner = (r: number, chord: number, x: number, side: -1 | 1): Vec3 => [
      x,
      ry * r + cy * (chord / 2) * side,
      rz * r + cz * (chord / 2) * side,
    ];
    const r0 = hubRadius * 0.8;
    const t = thickness / 2;
    m.hexahedron(
      [corner(r0, rootChord, -t, -1), corner(radius, tipChord, -t, -1), corner(radius, tipChord, t, -1), corner(r0, rootChord, t, -1)],
      [corner(r0, rootChord, -t, 1), corner(radius, tipChord, -t, 1), corner(radius, tipChord, t, 1), corner(r0, rootChord, t, 1)],
    );
  }
  return m.build();
}

/**
 * One module table, one metre long along x (scaled per row to the row's
 * length), rising towards north so the modules face south. Its lower edge
 * sits `lowerEdgeM` above the ground.
 */
export function moduleTableMesh(tableDepthM: number, tiltDeg: number, lowerEdgeM: number): MeshData {
  const tilt = (tiltDeg * Math.PI) / 180;
  const run = tableDepthM * Math.cos(tilt);
  const rise = tableDepthM * Math.sin(tilt);
  const thickness = 0.08;
  const y0 = -run / 2, y1 = run / 2;
  const z0 = lowerEdgeM, z1 = lowerEdgeM + rise;
  const m = new MeshBuilder();
  m.hexahedron(
    [[-0.5, y0, z0], [0.5, y0, z0], [0.5, y1, z1], [-0.5, y1, z1]],
    [[-0.5, y0, z0 + thickness], [0.5, y0, z0 + thickness], [0.5, y1, z1 + thickness], [-0.5, y1, z1 + thickness]],
  );
  return m.build();
}

/** Height of a module table's centre line above ground — where its supports meet it. */
export function moduleTableCentreHeightM(tableDepthM: number, tiltDeg: number, lowerEdgeM: number): number {
  return lowerEdgeM + (tableDepthM * Math.sin((tiltDeg * Math.PI) / 180)) / 2;
}

/** A square post from the ground to `heightM`. */
export function postMesh(heightM: number, widthM: number): MeshData {
  const m = new MeshBuilder();
  m.box(0, 0, heightM / 2, widthM, widthM, heightM);
  return m.build();
}
