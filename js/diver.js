// The player's scuba diver: a slim, streamlined figure that descends head-first,
// with kicking fins, a torch beam that strengthens with depth, and a bubble trail.
export const PLAY_HALF_X = 17;
export const PLAY_HALF_Z = 10;
export const DIVER_RADIUS = 0.95;

export class Diver {
  constructor(scene) {
    this.scene = scene;
    this.pos = { x: 0, y: 0, z: 0 };
    this.vx = 0; this.vz = 0;
    this.kick = 0;
    this.root = this._build(scene);
  }

  _build(scene) {
    const root = new BABYLON.TransformNode("diver", scene);
    const rig = new BABYLON.TransformNode("rig", scene);
    rig.parent = root;

    const mk = (name, r, g, b, em = 0) => {
      const m = new BABYLON.StandardMaterial(name, scene);
      m.diffuseColor = new BABYLON.Color3(r, g, b);
      m.emissiveColor = new BABYLON.Color3(r * em, g * em, b * em);
      m.specularColor = new BABYLON.Color3(0.5, 0.6, 0.7);
      return m;
    };
    const suit = mk("suit", 0.07, 0.09, 0.14);
    const skin = mk("skin", 0.8, 0.6, 0.46);
    const glass = mk("glass", 0.35, 0.8, 0.95, 0.4);
    const tankMat = mk("tank", 0.2, 0.7, 0.7, 0.15);
    const finMat = mk("fin", 0.95, 0.5, 0.12, 0.2);

    const body = BABYLON.MeshBuilder.CreateCapsule("body", { radius: 0.32, height: 1.5 }, scene);
    body.material = suit; body.parent = rig;

    const head = BABYLON.MeshBuilder.CreateSphere("head", { diameter: 0.5 }, scene);
    head.position.y = 0.95; head.material = skin; head.parent = rig;
    const mask = BABYLON.MeshBuilder.CreateBox("mask", { width: 0.42, height: 0.24, depth: 0.22 }, scene);
    mask.position.set(0, 0.98, 0.2); mask.material = glass; mask.parent = rig;

    const tank = BABYLON.MeshBuilder.CreateCylinder("tank", { height: 0.8, diameter: 0.3 }, scene);
    tank.position.set(0, 0.35, -0.36); tank.material = tankMat; tank.parent = rig;

    // arms reaching toward the deep
    for (const sx of [-1, 1]) {
      const arm = BABYLON.MeshBuilder.CreateCapsule("arm", { radius: 0.1, height: 0.95 }, scene);
      arm.material = suit; arm.parent = rig;
      arm.position.set(sx * 0.3, 0.7, 0.42); arm.rotation.x = -1.0;
    }

    // legs + flippers (animated)
    this.fins = [];
    for (const sx of [-1, 1]) {
      const leg = BABYLON.MeshBuilder.CreateCapsule("leg", { radius: 0.12, height: 0.9 }, scene);
      leg.material = suit; leg.parent = rig;
      leg.position.set(sx * 0.18, -1.05, 0);
      const fin = BABYLON.MeshBuilder.CreateBox("fin", { width: 0.34, height: 0.62, depth: 0.08 }, scene);
      fin.material = finMat; fin.parent = rig;
      fin.position.set(sx * 0.18, -1.6, 0.06);
      this.fins.push(fin);
    }

    // torch beam (a soft additive cone that brightens with depth)
    const beam = BABYLON.MeshBuilder.CreateCylinder("beam", { height: 9, diameterTop: 0.2, diameterBottom: 6, tessellation: 20 }, scene);
    const beamMat = new BABYLON.StandardMaterial("beamMat", scene);
    beamMat.emissiveColor = new BABYLON.Color3(0.9, 0.95, 0.8);
    beamMat.disableLighting = true; beamMat.backFaceCulling = false;
    beamMat.alpha = 0.0; beamMat.alphaMode = BABYLON.Engine.ALPHA_ADD;
    beam.material = beamMat; beam.parent = rig;
    beam.position.set(0, -5.0, 1.2); beam.rotation.x = 0.25;
    this.beamMat = beamMat;

    // head-first dive pose
    rig.rotation.x = 1.2;
    this.rig = rig;
    return root;
  }

  setPos(x, y, z) { this.pos.x = x; this.pos.y = y; this.pos.z = z; this.root.position.set(x, y, z); }

  update(dt, depthT) {
    this.kick += dt * 10;
    const k = Math.sin(this.kick) * 0.5;
    if (this.fins) { this.fins[0].rotation.x = k; this.fins[1].rotation.x = -k; }
    // bank into horizontal movement for a lively feel
    const targetRoll = -this.vx * 0.05;
    this.rig.rotation.z += (targetRoll - this.rig.rotation.z) * Math.min(1, dt * 6);
    this.rig.rotation.y += (this.vx * 0.04 - this.rig.rotation.y) * Math.min(1, dt * 6);
    this.root.position.set(this.pos.x, this.pos.y, this.pos.z);
    if (this.beamMat) this.beamMat.alpha = 0.04 + depthT * 0.22;
  }

  dispose() { this.root.dispose(); }
}
