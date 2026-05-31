// The player's scuba diver: a head-down diving figure built from primitives,
// with kicking fins and a rising bubble trail. Descends automatically; steers in X/Z.
export const PLAY_HALF_X = 16;
export const PLAY_HALF_Z = 10;
export const DIVER_RADIUS = 1.5;

export class Diver {
  constructor(scene) {
    this.scene = scene;
    this.pos = { x: 0, y: 0, z: 0 };
    this.kick = 0;
    this.root = this._build(scene);
  }

  _build(scene) {
    const root = new BABYLON.TransformNode("diver", scene);

    const mat = (name, r, g, b, em = 0) => {
      const m = new BABYLON.StandardMaterial(name, scene);
      m.diffuseColor = new BABYLON.Color3(r, g, b);
      m.emissiveColor = new BABYLON.Color3(r * em, g * em, b * em);
      m.specularColor = new BABYLON.Color3(0.4, 0.5, 0.6);
      return m;
    };
    const suit = mat("suit", 0.08, 0.1, 0.16);
    const skin = mat("skin", 0.85, 0.65, 0.5);
    const glass = mat("glass", 0.4, 0.8, 0.9, 0.35);
    const tankMat = mat("tank", 0.7, 0.75, 0.2, 0.1);
    const finMat = mat("fin", 0.95, 0.45, 0.1, 0.15);

    // body (wetsuit)
    const body = BABYLON.MeshBuilder.CreateCapsule("body", { radius: 0.55, height: 2.1 }, scene);
    body.material = suit; body.parent = root;

    // head + mask
    const head = BABYLON.MeshBuilder.CreateSphere("head", { diameter: 0.85 }, scene);
    head.position.y = 1.35; head.material = skin; head.parent = root;
    const mask = BABYLON.MeshBuilder.CreateBox("mask", { width: 0.7, height: 0.4, depth: 0.35 }, scene);
    mask.position.set(0, 1.4, 0.32); mask.material = glass; mask.parent = root;

    // air tank
    const tank = BABYLON.MeshBuilder.CreateCylinder("tank", { height: 1.2, diameter: 0.5 }, scene);
    tank.position.set(0, 0.5, -0.6); tank.material = tankMat; tank.parent = root;

    // arms reaching forward (toward the deep)
    for (const sx of [-1, 1]) {
      const arm = BABYLON.MeshBuilder.CreateCapsule("arm", { radius: 0.16, height: 1.3 }, scene);
      arm.material = suit; arm.parent = root;
      arm.position.set(sx * 0.45, 1.0, 0.5);
      arm.rotation.x = -0.9;
    }

    // legs + flippers (animated)
    this.fins = [];
    for (const sx of [-1, 1]) {
      const leg = BABYLON.MeshBuilder.CreateCapsule("leg", { radius: 0.2, height: 1.2 }, scene);
      leg.material = suit; leg.parent = root;
      leg.position.set(sx * 0.28, -1.5, 0);
      const fin = BABYLON.MeshBuilder.CreateBox("fin", { width: 0.5, height: 0.9, depth: 0.12 }, scene);
      fin.material = finMat; fin.parent = root;
      fin.position.set(sx * 0.28, -2.25, 0.1);
      this.fins.push(fin);
    }

    // dive into the deep: tilt head-down/forward
    root.rotation.x = 1.15;
    return root;
  }

  setPos(x, y, z) {
    this.pos.x = x; this.pos.y = y; this.pos.z = z;
    this.root.position.set(x, y, z);
  }

  update(dt) {
    // flutter-kick the fins and gently sway the body
    this.kick += dt * 9;
    const k = Math.sin(this.kick) * 0.5;
    if (this.fins) {
      this.fins[0].rotation.x = k;
      this.fins[1].rotation.x = -k;
    }
    this.root.rotation.z = Math.sin(this.kick * 0.5) * 0.08;
    this.root.position.set(this.pos.x, this.pos.y, this.pos.z);
  }

  dispose() { this.root.dispose(); }
}
