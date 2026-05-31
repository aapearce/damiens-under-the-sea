import { PLAY_HALF_X } from "./diver.js";

// Collectible species (with spawn weight + points) and the two hazards.
export const SPECIES = {
  clownfish:   { kind: "fish", points: 10, weight: 40, color: [1.0, 0.55, 0.12], stripe: true, glow: 0.25, size: 1.0, radius: 1.4 },
  lanternfish: { kind: "fish", points: 25, weight: 26, color: [0.5, 0.9, 1.0], glow: 0.7, size: 0.95, radius: 1.4 },
  jellyfish:   { kind: "jelly", points: 45, weight: 16, color: [0.78, 0.6, 1.0], glow: 0.9, size: 1.2, radius: 1.7 },
  angler:      { kind: "angler", points: 90, weight: 5, color: [0.6, 1.0, 0.8], glow: 1.0, size: 1.3, radius: 2.0 },
};
export const HAZARDS = {
  shark:   { kind: "shark", radius: 3.0 },
  octopus: { kind: "octopus", radius: 2.3 },
};

function mat(scene, name, c, em = 0, alpha = 1) {
  const m = new BABYLON.StandardMaterial(name, scene);
  m.diffuseColor = new BABYLON.Color3(c[0] * 0.7, c[1] * 0.7, c[2] * 0.7);
  m.emissiveColor = new BABYLON.Color3(c[0] * em, c[1] * em, c[2] * em);
  m.specularColor = new BABYLON.Color3(0.3, 0.4, 0.5);
  if (alpha < 1) { m.alpha = alpha; }
  return m;
}

export class Creature {
  constructor(scene, glow, typeKey) {
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
    this.root = this._build();
  }

  _glow(m) { if (this.glow) this.glow.addIncludedOnlyMesh(m); }

  _build() {
    const scene = this.scene;
    const root = new BABYLON.TransformNode("creature", scene);
    const d = this.def;

    if (this.kind === "fish") {
      const m = mat(scene, "fishm", d.color, d.glow);
      const body = BABYLON.MeshBuilder.CreateSphere("fb", { diameterX: 1.6, diameterY: 0.9, diameterZ: 0.9, segments: 10 }, scene);
      body.scaling.set(d.size, d.size, d.size); body.material = m; body.parent = root;
      const tail = BABYLON.MeshBuilder.CreateCylinder("ft", { height: 0.7, diameterTop: 0.9, diameterBottom: 0.05, tessellation: 3 }, scene);
      tail.rotation.z = Math.PI / 2; tail.position.x = -0.95 * d.size; tail.scaling.set(d.size, d.size, d.size);
      tail.material = m; tail.parent = root; this.tail = tail;
      const topfin = BABYLON.MeshBuilder.CreateCylinder("fdf", { height: 0.5, diameterTop: 0.5, diameterBottom: 0.05, tessellation: 3 }, scene);
      topfin.position.y = 0.5 * d.size; topfin.material = m; topfin.parent = root;
      this._eye(root, 0.5 * d.size, 0.2 * d.size, 0.32 * d.size);
      this._glow(body);
    } else if (this.kind === "jelly") {
      const m = mat(scene, "jellym", d.color, d.glow, 0.7);
      const dome = BABYLON.MeshBuilder.CreateSphere("jd", { diameter: 1.7 * d.size, slice: 0.55, segments: 14 }, scene);
      dome.material = m; dome.parent = root; this.dome = dome;
      for (let i = 0; i < 7; i++) {
        const t = BABYLON.MeshBuilder.CreateCylinder("jt", { height: 1.6, diameter: 0.08, tessellation: 5 }, scene);
        const a = (i / 7) * Math.PI * 2;
        t.position.set(Math.cos(a) * 0.45 * d.size, -0.9, Math.sin(a) * 0.45 * d.size);
        t.material = m; t.parent = root;
      }
      this._glow(dome);
    } else if (this.kind === "angler") {
      const m = mat(scene, "anglerm", [0.05, 0.12, 0.1], 0.15);
      const body = BABYLON.MeshBuilder.CreateSphere("ab", { diameterX: 1.8, diameterY: 1.4, diameterZ: 1.4, segments: 12 }, scene);
      body.scaling.set(d.size, d.size, d.size); body.material = m; body.parent = root;
      // glowing lure
      const stalk = BABYLON.MeshBuilder.CreateCylinder("as", { height: 1.1, diameter: 0.07 }, scene);
      stalk.position.set(0.5, 1.0, 0); stalk.rotation.z = -0.5; stalk.material = m; stalk.parent = root;
      const lure = BABYLON.MeshBuilder.CreateSphere("al", { diameter: 0.45 }, scene);
      lure.position.set(1.0, 1.4, 0);
      const lm = mat(scene, "lurem", d.color, 2.0); lure.material = lm; lure.parent = root;
      this.lure = lure; this.lureMat = lm;
      // jagged mouth
      const teeth = BABYLON.MeshBuilder.CreateCylinder("at", { height: 0.5, diameterTop: 1.0, diameterBottom: 0.0, tessellation: 8 }, scene);
      teeth.rotation.z = -Math.PI / 2; teeth.position.x = 0.9 * d.size;
      teeth.material = mat(scene, "teethm", [1, 1, 1], 0.4); teeth.parent = root;
      this._glow(lure);
    } else if (this.kind === "shark") {
      const m = mat(scene, "sharkm", [0.35, 0.4, 0.46], 0.05);
      const body = BABYLON.MeshBuilder.CreateSphere("sb", { diameterX: 5.2, diameterY: 1.7, diameterZ: 1.9, segments: 14 }, scene);
      body.material = m; body.parent = root; this.body = body;
      const tail = BABYLON.MeshBuilder.CreateCylinder("st", { height: 1.7, diameterTop: 1.7, diameterBottom: 0.05, tessellation: 3 }, scene);
      tail.rotation.z = Math.PI / 2; tail.position.x = -3.0; tail.material = m; tail.parent = root; this.tail = tail;
      const dorsal = BABYLON.MeshBuilder.CreateCylinder("sd", { height: 1.4, diameterTop: 1.1, diameterBottom: 0.05, tessellation: 3 }, scene);
      dorsal.position.y = 1.1; dorsal.material = m; dorsal.parent = root;
      for (const sx of [-1, 1]) {
        const pec = BABYLON.MeshBuilder.CreateCylinder("sp", { height: 1.4, diameterTop: 1.0, diameterBottom: 0.05, tessellation: 3 }, scene);
        pec.position.set(0.4, -0.4, sx * 0.9); pec.rotation.x = sx * 1.0; pec.material = m; pec.parent = root;
      }
      this._eye(root, 1.9, 0.45, 0.55, 1.0, [1, 0.1, 0.1]);
      this._eye(root, 1.9, 0.45, -0.55, 1.0, [1, 0.1, 0.1]);
      // toothy mouth
      const mouth = BABYLON.MeshBuilder.CreateCylinder("sm", { height: 0.6, diameterTop: 1.3, diameterBottom: 0.2, tessellation: 10 }, scene);
      mouth.rotation.z = -Math.PI / 2; mouth.position.set(2.5, -0.3, 0);
      mouth.material = mat(scene, "smouth", [1, 1, 1], 0.3); mouth.parent = root;
    } else if (this.kind === "octopus") {
      const m = mat(scene, "octom", [0.7, 0.2, 0.85], 0.4);
      const head = BABYLON.MeshBuilder.CreateSphere("oh", { diameterX: 2.2, diameterY: 2.4, diameterZ: 2.2, segments: 14 }, scene);
      head.material = m; head.parent = root; this.head = head;
      this.tentacles = [];
      for (let i = 0; i < 8; i++) {
        const t = BABYLON.MeshBuilder.CreateCylinder("ot", { height: 2.2, diameterTop: 0.5, diameterBottom: 0.1, tessellation: 6 }, scene);
        const a = (i / 8) * Math.PI * 2;
        t.position.set(Math.cos(a) * 0.7, -1.3, Math.sin(a) * 0.7);
        t.rotation.x = Math.sin(a) * 0.4; t.rotation.z = Math.cos(a) * 0.4;
        t.material = m; t.parent = root; this.tentacles.push({ mesh: t, a });
      }
      this._eye(root, 0.7, 0.4, 0.95, 0.9, [1, 1, 0.2]);
      this._eye(root, -0.7, 0.4, 0.95, 0.9, [1, 1, 0.2]);
      this._glow(head);
    }
    return root;
  }

  _eye(root, x, y, z, size = 1, color = [0, 0, 0]) {
    const e = BABYLON.MeshBuilder.CreateSphere("eye", { diameter: 0.22 * size }, this.scene);
    e.position.set(x, y, z);
    const em = new BABYLON.StandardMaterial("eyem", this.scene);
    em.emissiveColor = new BABYLON.Color3(...color);
    em.diffuseColor = new BABYLON.Color3(0, 0, 0);
    e.material = em; e.parent = root;
    if (color[0] + color[1] + color[2] > 0.5) this._glow(e);
  }

  setPos(x, y, z) {
    this.pos.x = x; this.pos.y = y; this.pos.z = z;
    this.root.position.set(x, y, z);
    // face direction of travel for swimmers
    if (this.kind === "shark") this.root.rotation.y = this.driftDir > 0 ? 0 : Math.PI;
    else this.root.rotation.y = Math.random() * Math.PI * 2;
  }

  update(dt, t) {
    this.phase += dt;
    const p = this.phase;

    if (this.kind === "fish") {
      this.root.position.y = this.pos.y + Math.sin(p * 2) * 0.3;
      if (this.tail) this.tail.rotation.y = Math.sin(p * 8) * 0.5;
    } else if (this.kind === "jelly") {
      const s = 1 + Math.sin(p * 2.5) * 0.12;
      if (this.dome) this.dome.scaling.set(s, 1 / s, s);
      this.root.position.y = this.pos.y + Math.sin(p * 1.5) * 0.4;
    } else if (this.kind === "angler") {
      if (this.lureMat) {
        const g = 1.4 + Math.sin(p * 4) * 0.8;
        this.lureMat.emissiveColor.set(this.def.color[0] * g, this.def.color[1] * g, this.def.color[2] * g);
      }
      this.root.position.y = this.pos.y + Math.sin(p * 1.2) * 0.3;
    } else if (this.kind === "shark") {
      // patrol horizontally across the play area (does NOT track the diver)
      this.pos.x += this.driftDir * 4.5 * dt;
      if (this.pos.x > PLAY_HALF_X + 4) this.driftDir = -1;
      if (this.pos.x < -PLAY_HALF_X - 4) this.driftDir = 1;
      this.root.rotation.y = this.driftDir > 0 ? 0 : Math.PI;
      this.root.position.x = this.pos.x;
      if (this.tail) this.tail.rotation.y = Math.sin(p * 6) * 0.6;
      this.root.position.y = this.pos.y + Math.sin(p * 1.5) * 0.25;
    } else if (this.kind === "octopus") {
      this.pos.x += this.driftDir * 1.6 * dt;
      if (Math.abs(this.pos.x) > PLAY_HALF_X) this.driftDir *= -1;
      this.root.position.x = this.pos.x;
      this.root.position.y = this.pos.y + Math.sin(p * 1.8) * 0.5;
      if (this.tentacles) for (const t of this.tentacles) {
        t.mesh.rotation.x = Math.sin(p * 3 + t.a) * 0.5;
        t.mesh.rotation.z = Math.cos(p * 3 + t.a) * 0.5;
      }
    }
  }

  dispose() { this.root.dispose(); }
}

// Weighted random collectible type by depth (rarer species more likely deeper).
export function randomSpeciesKey(depthT) {
  const keys = Object.keys(SPECIES);
  const weights = keys.map((k) => {
    let w = SPECIES[k].weight;
    if (k === "angler") w += depthT * 8;      // legendary slightly more common deep
    if (k === "jellyfish") w += depthT * 6;
    return w;
  });
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < keys.length; i++) { r -= weights[i]; if (r <= 0) return keys[i]; }
  return keys[0];
}
