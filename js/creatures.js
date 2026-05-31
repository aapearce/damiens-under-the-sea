import { PLAY_HALF_X } from "./diver.js";

// Collectible species. `school` species spawn in flocks you swim through.
export const SPECIES = {
  sardine:   { kind: "schoolfish", points: 8,  weight: 0,  color: [0.85, 0.9, 1.0], glow: 0.25, size: 0.5, radius: 1.3 },
  clownfish: { kind: "fish", points: 15, weight: 38, color: [1.0, 0.55, 0.12], glow: 0.3, size: 0.85, radius: 1.5 },
  bluetang:  { kind: "fish", points: 28, weight: 24, color: [0.2, 0.5, 1.0], glow: 0.4, size: 0.9, radius: 1.5 },
  seahorse:  { kind: "seahorse", points: 45, weight: 12, color: [1.0, 0.85, 0.2], glow: 0.5, size: 0.9, radius: 1.5 },
  angler:    { kind: "angler", points: 95, weight: 5, color: [0.6, 1.0, 0.8], glow: 1.0, size: 1.0, radius: 1.7 },
};
export const HAZARDS = {
  shark:   { kind: "shark", radius: 2.6, detect: 20, chase: 7.8, patrol: 2.2 },
  octopus: { kind: "octopus", radius: 2.1, detect: 13, chase: 4.5, patrol: 1.0 },
  jelly:   { kind: "jelly", radius: 1.7 },
};

function mat(scene, name, c, em = 0, alpha = 1) {
  const m = new BABYLON.StandardMaterial(name, scene);
  m.diffuseColor = new BABYLON.Color3(c[0] * 0.7, c[1] * 0.7, c[2] * 0.7);
  m.emissiveColor = new BABYLON.Color3(c[0] * em, c[1] * em, c[2] * em);
  m.specularColor = new BABYLON.Color3(0.3, 0.4, 0.5);
  if (alpha < 1) m.alpha = alpha;
  return m;
}

export class Creature {
  constructor(scene, glow, typeKey, flock = null) {
    this.scene = scene;
    this.glow = glow;
    this.typeKey = typeKey;
    this.def = SPECIES[typeKey] || HAZARDS[typeKey];
    this.kind = this.def.kind;
    this.points = this.def.points || 0;
    this.radius = this.def.radius;
    this.hazard = !!HAZARDS[typeKey];
    this.pos = { x: 0, y: 0, z: 0 };
    this.phase = Math.random() * Math.PI * 2;
    this.driftDir = Math.random() < 0.5 ? -1 : 1;
    this.collected = false;
    // flock membership (schoolfish)
    this.flock = flock;
    this.fAngle = Math.random() * Math.PI * 2;
    this.fRadius = 1.5 + Math.random() * 3;
    this.fY = (Math.random() * 2 - 1) * 2;
    this.fSpeed = 0.6 + Math.random() * 0.8;
    this.root = this._build();
  }

  _glow(m) { if (this.glow) this.glow.addIncludedOnlyMesh(m); }
  _baseMat() { this._mat = mat(this.scene, "cm" + Math.random(), this.def.color, this.def.glow || 0); return this._mat; }

  _fishMesh(root, size, m) {
    const body = BABYLON.MeshBuilder.CreateSphere("fb", { diameterX: 1.4, diameterY: 0.8, diameterZ: 0.8, segments: 10 }, this.scene);
    body.scaling.set(size, size, size); body.material = m; body.parent = root;
    const tail = BABYLON.MeshBuilder.CreateCylinder("ft", { height: 0.6, diameterTop: 0.8, diameterBottom: 0.04, tessellation: 3 }, this.scene);
    tail.rotation.z = Math.PI / 2; tail.position.x = -0.85 * size; tail.scaling.set(size, size, size);
    tail.material = m; tail.parent = root; this.tail = tail;
    const fin = BABYLON.MeshBuilder.CreateCylinder("fdf", { height: 0.45, diameterTop: 0.45, diameterBottom: 0.04, tessellation: 3 }, this.scene);
    fin.position.y = 0.42 * size; fin.material = m; fin.parent = root;
    this._eye(root, 0.42 * size, 0.18 * size, 0.3 * size);
    this._glow(body);
  }

  _build() {
    const scene = this.scene, d = this.def, root = new BABYLON.TransformNode("creature", scene);

    if (this.kind === "schoolfish") {
      // lightweight single-mesh fish (many of these swim in a school)
      const m = this._baseMat();
      const body = BABYLON.MeshBuilder.CreateSphere("sf", { diameterX: 1.1, diameterY: 0.5, diameterZ: 0.5, segments: 6 }, this.scene);
      body.scaling.set(d.size, d.size, d.size); body.material = m; body.parent = root;
      this._glow(body);
    } else if (this.kind === "fish") {
      this._fishMesh(root, d.size, this._baseMat());
    } else if (this.kind === "seahorse") {
      const m = this._baseMat();
      const body = BABYLON.MeshBuilder.CreateCapsule("sh", { radius: 0.28, height: 1.3 }, scene);
      body.material = m; body.parent = root; body.rotation.z = 0.4;
      const head = BABYLON.MeshBuilder.CreateSphere("shh", { diameterX: 0.6, diameterY: 0.45, diameterZ: 0.45 }, scene);
      head.position.set(0.2, 0.7, 0); head.material = m; head.parent = root;
      const snout = BABYLON.MeshBuilder.CreateCylinder("shs", { height: 0.4, diameter: 0.12 }, scene);
      snout.position.set(0.5, 0.75, 0); snout.rotation.z = -1.2; snout.material = m; snout.parent = root;
      this._eye(root, 0.28, 0.78, 0.22);
      this._glow(body); this._glow(head);
    } else if (this.kind === "angler") {
      const m = mat(scene, "anglerm", [0.05, 0.12, 0.1], 0.12);
      const body = BABYLON.MeshBuilder.CreateSphere("ab", { diameterX: 1.5, diameterY: 1.2, diameterZ: 1.2, segments: 12 }, scene);
      body.scaling.set(d.size, d.size, d.size); body.material = m; body.parent = root;
      const stalk = BABYLON.MeshBuilder.CreateCylinder("as", { height: 0.9, diameter: 0.05 }, scene);
      stalk.position.set(0.4, 0.85, 0); stalk.rotation.z = -0.5; stalk.material = m; stalk.parent = root;
      const lure = BABYLON.MeshBuilder.CreateSphere("al", { diameter: 0.38 }, scene);
      lure.position.set(0.85, 1.2, 0);
      this.lureMat = mat(scene, "lurem", d.color, 2.0); lure.material = this.lureMat; lure.parent = root;
      const teeth = BABYLON.MeshBuilder.CreateCylinder("at", { height: 0.4, diameterTop: 0.9, diameterBottom: 0, tessellation: 8 }, scene);
      teeth.rotation.z = -Math.PI / 2; teeth.position.x = 0.8 * d.size;
      teeth.material = mat(scene, "tm", [1, 1, 1], 0.4); teeth.parent = root;
      this._eye(root, 0.4 * d.size, 0.35 * d.size, 0.4 * d.size);
      this._glow(lure);
    } else if (this.kind === "shark") {
      const m = mat(scene, "sharkm", [0.32, 0.38, 0.44], 0.04);
      const body = BABYLON.MeshBuilder.CreateSphere("sb", { diameterX: 4.6, diameterY: 1.5, diameterZ: 1.7, segments: 14 }, scene);
      body.material = m; body.parent = root;
      const tail = BABYLON.MeshBuilder.CreateCylinder("st", { height: 1.5, diameterTop: 1.5, diameterBottom: 0.04, tessellation: 3 }, scene);
      tail.rotation.z = Math.PI / 2; tail.position.x = -2.7; tail.material = m; tail.parent = root; this.tail = tail;
      const dorsal = BABYLON.MeshBuilder.CreateCylinder("sd", { height: 1.2, diameterTop: 1.0, diameterBottom: 0.04, tessellation: 3 }, scene);
      dorsal.position.y = 1.0; dorsal.material = m; dorsal.parent = root;
      for (const sx of [-1, 1]) {
        const pec = BABYLON.MeshBuilder.CreateCylinder("sp", { height: 1.2, diameterTop: 0.9, diameterBottom: 0.04, tessellation: 3 }, scene);
        pec.position.set(0.3, -0.35, sx * 0.8); pec.rotation.x = sx * 1.0; pec.material = m; pec.parent = root;
      }
      this._eye(root, 1.7, 0.4, 0.5, 1, [1, 0.1, 0.1]);
      this._eye(root, 1.7, 0.4, -0.5, 1, [1, 0.1, 0.1]);
      const mouth = BABYLON.MeshBuilder.CreateCylinder("sm", { height: 0.5, diameterTop: 1.1, diameterBottom: 0.15, tessellation: 10 }, scene);
      mouth.rotation.z = -Math.PI / 2; mouth.position.set(2.2, -0.25, 0);
      mouth.material = mat(scene, "smo", [1, 1, 1], 0.3); mouth.parent = root;
    } else if (this.kind === "octopus") {
      const m = mat(scene, "octom", [0.7, 0.2, 0.85], 0.4);
      const head = BABYLON.MeshBuilder.CreateSphere("oh", { diameterX: 1.9, diameterY: 2.1, diameterZ: 1.9, segments: 14 }, scene);
      head.material = m; head.parent = root;
      this.tentacles = [];
      for (let i = 0; i < 8; i++) {
        const t = BABYLON.MeshBuilder.CreateCylinder("ot", { height: 2.0, diameterTop: 0.45, diameterBottom: 0.08, tessellation: 6 }, scene);
        const a = (i / 8) * Math.PI * 2;
        t.position.set(Math.cos(a) * 0.6, -1.15, Math.sin(a) * 0.6);
        t.material = m; t.parent = root; this.tentacles.push({ mesh: t, a });
      }
      this._eye(root, 0.55, 0.4, 0.85, 0.9, [1, 1, 0.2]);
      this._eye(root, -0.55, 0.4, 0.85, 0.9, [1, 1, 0.2]);
      this._glow(head);
    } else if (this.kind === "jelly") {
      const m = mat(scene, "jellym", [1.0, 0.45, 0.7], 0.9, 0.65);
      const dome = BABYLON.MeshBuilder.CreateSphere("jd", { diameter: 1.8, slice: 0.55, segments: 14 }, scene);
      dome.material = m; dome.parent = root; this.dome = dome;
      for (let i = 0; i < 8; i++) {
        const t = BABYLON.MeshBuilder.CreateCylinder("jt", { height: 1.8, diameter: 0.07, tessellation: 5 }, scene);
        const a = (i / 8) * Math.PI * 2;
        t.position.set(Math.cos(a) * 0.5, -1.0, Math.sin(a) * 0.5);
        t.material = m; t.parent = root;
      }
      this._glow(dome);
    }
    return root;
  }

  _eye(root, x, y, z, size = 1, color = [0, 0, 0]) {
    const e = BABYLON.MeshBuilder.CreateSphere("eye", { diameter: 0.18 * size }, this.scene);
    e.position.set(x, y, z);
    const em = new BABYLON.StandardMaterial("eyem", this.scene);
    em.emissiveColor = new BABYLON.Color3(...color);
    em.diffuseColor = new BABYLON.Color3(0, 0, 0);
    e.material = em; e.parent = root;
    if (color[0] + color[1] + color[2] > 0.5) this._glow(e);
  }

  setPos(x, y, z) { this.pos.x = x; this.pos.y = y; this.pos.z = z; this.root.position.set(x, y, z); }

  _face(dx, dz) { this.root.rotation.y = Math.atan2(-dz, dx); }

  update(dt, ctx) {
    this.phase += dt;
    const p = this.phase, diver = ctx.diver;

    if (this.kind === "schoolfish") {
      // orbit the moving flock centre, with a swim wiggle
      this.fAngle += dt * this.fSpeed;
      const fc = this.flock;
      this.pos.x = fc.x + Math.cos(this.fAngle) * this.fRadius;
      this.pos.y = fc.y + this.fY + Math.sin(this.fAngle * 1.5) * 0.5;
      this.pos.z = fc.z + Math.sin(this.fAngle) * this.fRadius * 0.6;
      this.root.position.set(this.pos.x, this.pos.y, this.pos.z);
      this._face(-Math.sin(this.fAngle), Math.cos(this.fAngle));
      if (this.tail) this.tail.rotation.y = Math.sin(p * 12) * 0.5;
      return;
    }
    if (this.kind === "fish") {
      this.root.position.y = this.pos.y + Math.sin(p * 2) * 0.3;
      this.pos.x += Math.cos(p * 0.5) * dt * 0.6;
      this.root.position.x = this.pos.x;
      if (this.tail) this.tail.rotation.y = Math.sin(p * 9) * 0.5;
    } else if (this.kind === "seahorse") {
      this.root.position.y = this.pos.y + Math.sin(p * 1.5) * 0.5;
      this.root.rotation.z = Math.sin(p) * 0.15;
    } else if (this.kind === "angler") {
      if (this.lureMat) { const g = 1.4 + Math.sin(p * 4) * 0.8; this.lureMat.emissiveColor.set(this.def.color[0] * g, this.def.color[1] * g, this.def.color[2] * g); }
      this.root.position.y = this.pos.y + Math.sin(p * 1.2) * 0.3;
    } else if (this.kind === "jelly") {
      const s = 1 + Math.sin(p * 2.5) * 0.14;
      if (this.dome) this.dome.scaling.set(s, 1 / s, s);
      this.pos.y += 0.5 * dt;                       // drifts upward gently
      this.pos.x += this.driftDir * 0.5 * dt;
      this.root.position.set(this.pos.x, this.pos.y, this.pos.z);
    } else if (this.kind === "shark" || this.kind === "octopus") {
      const dx = diver.x - this.pos.x, dy = diver.y - this.pos.y, dz = diver.z - this.pos.z;
      const dist = Math.hypot(dx, dy, dz);
      if (dist < this.def.detect) {
        // HUNT: accelerate toward the diver
        const sp = this.def.chase;
        this.pos.x += (dx / dist) * sp * dt;
        this.pos.y += (dy / dist) * sp * dt * 0.8;
        this.pos.z += (dz / dist) * sp * dt;
        this._face(dx, dz);
        this.hunting = true;
      } else {
        // patrol horizontally
        this.pos.x += this.driftDir * this.def.patrol * dt;
        if (Math.abs(this.pos.x) > PLAY_HALF_X + 6) this.driftDir *= -1;
        this._face(this.driftDir, 0);
        this.hunting = false;
      }
      this.root.position.set(this.pos.x, this.pos.y, this.pos.z);
      if (this.tail) this.tail.rotation.y = Math.sin(p * (this.hunting ? 12 : 5)) * 0.6;
      if (this.tentacles) for (const t of this.tentacles) { t.mesh.rotation.x = Math.sin(p * 3 + t.a) * 0.5; t.mesh.rotation.z = Math.cos(p * 3 + t.a) * 0.5; }
    }
  }

  dispose() { this.root.dispose(); }
}

export function randomSpeciesKey(depthT) {
  const keys = Object.keys(SPECIES).filter((k) => SPECIES[k].weight > 0);
  const weights = keys.map((k) => {
    let w = SPECIES[k].weight;
    if (k === "angler") w += depthT * 9;
    if (k === "bluetang") w += depthT * 5;
    return w;
  });
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < keys.length; i++) { r -= weights[i]; if (r <= 0) return keys[i]; }
  return keys[0];
}
