import { Diver, PLAY_HALF_X, PLAY_HALF_Z, DIVER_RADIUS } from "./diver.js";
import { Creature, randomSpeciesKey } from "./creatures.js";
import { saveScore } from "./leaderboard.js";
import * as ui from "./ui.js";

const DEPTH = 320;            // world units from surface (y=0) to seabed
const MAX_METERS = 200;       // displayed depth at the seabed
const DESCENT_SPEED = 11;     // units / second (fixed)
const STEER = 18;             // arrow-key steering speed
const ROW_GAP = 13;           // depth between spawn rows
const SPAWN_AHEAD = 140;      // how far below the diver we pre-spawn
const HIT_INVULN = 1.6;       // seconds of safety after a hit
const SHARK_PENALTY = 60, OCTO_PENALTY = 40;

class Game {
  constructor() {
    this.canvas = document.getElementById("renderCanvas");
    this.engine = new BABYLON.Engine(this.canvas, true, { stencil: true });
    this.scene = this._createScene();

    this.state = "menu";
    this.creatures = [];
    this.keys = { left: false, right: false, up: false, down: false };
    this.isTouch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
    this.pointerActive = false;
    this.pointerTarget = { x: 0, z: 0 };

    this._bindUI();
    this._bindInput();

    this.engine.runRenderLoop(() => this._frame());
    window.addEventListener("resize", () => { this.engine.resize(); this._updateFov(); });

    if (this.isTouch) document.body.classList.add("touch");
    ui.showScreen(ui.dom.menu);
    ui.setHudVisible(false);
  }

  _createScene() {
    const scene = new BABYLON.Scene(this.engine);
    scene.clearColor = new BABYLON.Color3(0.05, 0.35, 0.5);
    scene.fogMode = BABYLON.Scene.FOGMODE_EXP2;
    scene.fogColor = new BABYLON.Color3(0.05, 0.35, 0.5);
    scene.fogDensity = 0.012;

    const cam = new BABYLON.UniversalCamera("cam", new BABYLON.Vector3(0, 9, -14), scene);
    cam.minZ = 0.1; cam.maxZ = 400; cam.fov = 1.1;
    this.camera = cam;
    this._updateFov();

    // sunlight from the surface (fades with depth)
    this.sun = new BABYLON.HemisphericLight("sun", new BABYLON.Vector3(0, 1, 0.2), scene);
    this.sun.diffuse = new BABYLON.Color3(0.7, 0.95, 1.0);
    this.sun.groundColor = new BABYLON.Color3(0.0, 0.1, 0.2);
    this.sun.intensity = 1.0;

    // the diver's torch — barely matters up top, vital in the deep
    this.torch = new BABYLON.SpotLight("torch", new BABYLON.Vector3(0, 0, 0),
      new BABYLON.Vector3(0, -0.5, 1), Math.PI / 2.2, 8, scene);
    this.torch.diffuse = new BABYLON.Color3(1.0, 0.95, 0.8);
    this.torch.intensity = 0.3;

    this.glow = new BABYLON.GlowLayer("glow", scene);
    this.glow.intensity = 0.9;

    const pipe = new BABYLON.DefaultRenderingPipeline("pipe", true, scene, [cam]);
    pipe.bloomEnabled = true;
    pipe.bloomThreshold = 0.5;
    pipe.bloomWeight = 0.65;
    pipe.bloomKernel = 64;
    pipe.fxaaEnabled = true;
    pipe.imageProcessing.contrast = 1.15;
    pipe.imageProcessing.exposure = 1.05;

    this.diver = new Diver(scene);
    this._buildEnvironment(scene);

    return scene;
  }

  _updateFov() {
    if (!this.camera) return;
    const aspect = this.engine.getRenderWidth() / Math.max(1, this.engine.getRenderHeight());
    const BASE_V = 1.1, MIN_H = 1.4, MAX_V = 1.55;
    const hAtBase = 2 * Math.atan(Math.tan(BASE_V / 2) * aspect);
    let v = BASE_V;
    if (hAtBase < MIN_H) v = 2 * Math.atan(Math.tan(MIN_H / 2) / aspect);
    this.camera.fov = Math.min(v, MAX_V);
  }

  // ---------- environment ----------
  _buildEnvironment(scene) {
    // god-ray shafts near the surface
    const rayTex = this._gradientTexture(scene);
    const rayMat = new BABYLON.StandardMaterial("rayMat", scene);
    rayMat.diffuseTexture = rayTex;
    rayMat.opacityTexture = rayTex;
    rayMat.emissiveColor = new BABYLON.Color3(0.7, 0.95, 1.0);
    rayMat.disableLighting = true;
    rayMat.backFaceCulling = false;
    rayMat.alphaMode = BABYLON.Engine.ALPHA_ADD;
    this.rays = [];
    for (let i = 0; i < 8; i++) {
      const shaft = BABYLON.MeshBuilder.CreatePlane("ray" + i, { width: 6, height: 150 }, scene);
      shaft.material = rayMat;
      shaft.position.set((Math.random() * 2 - 1) * (PLAY_HALF_X + 8), -55, (Math.random() * 2 - 1) * 14 + 6);
      shaft.rotation.z = (Math.random() * 2 - 1) * 0.3;
      shaft.rotation.y = Math.random() * Math.PI;
      shaft.billboardMode = BABYLON.Mesh.BILLBOARDMODE_Y;
      this.rays.push(shaft);
    }

    // drifting marine snow / plankton for depth cue
    const snow = new BABYLON.ParticleSystem("snow", 500, scene);
    snow.particleTexture = this._dotTexture(scene);
    this.snowEmitter = new BABYLON.TransformNode("snowEmit", scene);
    snow.emitter = this.snowEmitter;
    snow.minEmitBox = new BABYLON.Vector3(-40, -30, -25);
    snow.maxEmitBox = new BABYLON.Vector3(40, 30, 40);
    snow.color1 = new BABYLON.Color4(0.8, 0.95, 1, 0.5);
    snow.color2 = new BABYLON.Color4(0.6, 0.8, 1, 0.3);
    snow.colorDead = new BABYLON.Color4(0, 0, 0, 0);
    snow.minSize = 0.05; snow.maxSize = 0.22;
    snow.minLifeTime = 3; snow.maxLifeTime = 6;
    snow.emitRate = 120;
    snow.direction1 = new BABYLON.Vector3(-0.2, 0.4, -0.2);
    snow.direction2 = new BABYLON.Vector3(0.2, 0.8, 0.2);
    snow.minEmitPower = 0.1; snow.maxEmitPower = 0.4;
    snow.blendMode = BABYLON.ParticleSystem.BLENDMODE_STANDARD;
    snow.start();
    this.snow = snow;

    // bubble trail from the diver
    const bubbles = new BABYLON.ParticleSystem("bubbles", 200, scene);
    bubbles.particleTexture = this._dotTexture(scene);
    bubbles.emitter = this.diver.root;
    bubbles.minEmitBox = new BABYLON.Vector3(-0.4, 1, 0.2);
    bubbles.maxEmitBox = new BABYLON.Vector3(0.4, 1.4, 0.4);
    bubbles.color1 = new BABYLON.Color4(0.8, 1, 1, 0.6);
    bubbles.color2 = new BABYLON.Color4(0.6, 0.9, 1, 0.4);
    bubbles.colorDead = new BABYLON.Color4(1, 1, 1, 0);
    bubbles.minSize = 0.08; bubbles.maxSize = 0.3;
    bubbles.minLifeTime = 1.2; bubbles.maxLifeTime = 2.2;
    bubbles.emitRate = 40;
    bubbles.gravity = new BABYLON.Vector3(0, 6, 0); // rise
    bubbles.direction1 = new BABYLON.Vector3(-0.2, 1, -0.2);
    bubbles.direction2 = new BABYLON.Vector3(0.2, 1, 0.2);
    bubbles.blendMode = BABYLON.ParticleSystem.BLENDMODE_STANDARD;
    bubbles.start();
    this.bubbles = bubbles;

    // the seabed (revealed at the end) with caustic shimmer
    const caustic = this._causticTexture(scene);
    this.causticTex = caustic;
    const seabed = BABYLON.MeshBuilder.CreateGround("seabed", { width: 220, height: 220 }, scene);
    seabed.position.y = -DEPTH - 2;
    const sbMat = new BABYLON.StandardMaterial("sbMat", scene);
    sbMat.diffuseColor = new BABYLON.Color3(0.12, 0.18, 0.2);
    sbMat.emissiveTexture = caustic;
    sbMat.emissiveColor = new BABYLON.Color3(0.4, 0.7, 0.8);
    seabed.material = sbMat;
    this.seabed = seabed;
    // a few rocks on the seabed
    for (let i = 0; i < 14; i++) {
      const rock = BABYLON.MeshBuilder.CreateSphere("rock", { diameter: 3 + Math.random() * 6, segments: 5 }, scene);
      rock.position.set((Math.random() * 2 - 1) * 90, -DEPTH - 1, (Math.random() * 2 - 1) * 90);
      rock.scaling.y = 0.5;
      const rm = new BABYLON.StandardMaterial("rm", scene);
      rm.diffuseColor = new BABYLON.Color3(0.1, 0.14, 0.16);
      rock.material = rm;
    }
  }

  _gradientTexture(scene) {
    const t = new BABYLON.DynamicTexture("rayGrad", { width: 32, height: 256 }, scene, false);
    const ctx = t.getContext();
    const g = ctx.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, "rgba(255,255,255,0.55)");
    g.addColorStop(0.5, "rgba(200,240,255,0.18)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g; ctx.fillRect(0, 0, 32, 256);
    t.hasAlpha = true; t.update();
    return t;
  }

  _dotTexture(scene) {
    const t = new BABYLON.DynamicTexture("dot", 32, scene, false);
    const ctx = t.getContext();
    const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g; ctx.fillRect(0, 0, 32, 32);
    t.hasAlpha = true; t.update();
    return t;
  }

  _causticTexture(scene) {
    const S = 256;
    const t = new BABYLON.DynamicTexture("caustic", S, scene, false);
    const ctx = t.getContext();
    ctx.fillStyle = "#0a1416"; ctx.fillRect(0, 0, S, S);
    ctx.strokeStyle = "rgba(140,230,255,0.6)";
    ctx.lineWidth = 2;
    for (let i = 0; i < 60; i++) {
      ctx.beginPath();
      const x = Math.random() * S, y = Math.random() * S, r = 6 + Math.random() * 22;
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.stroke();
    }
    t.update();
    t.uScale = 4; t.vScale = 4;
    t.wrapU = t.wrapV = BABYLON.Texture.WRAP_ADDRESSMODE;
    return t;
  }

  // ---------- run lifecycle ----------
  startRun() {
    // clear creatures
    for (const c of this.creatures) c.dispose();
    this.creatures = [];

    this.diver.setPos(0, 0, 0);
    this.score = 0;
    this.hits = 0;
    this.invuln = 0;
    this.elapsed = 0;
    this.nextSpawnY = -16;
    this.milestones = 0;
    this.keys = { left: false, right: false, up: false, down: false };
    this.pointerActive = false;

    this.state = "diving";
    ui.setDanger(false);
    ui.setScore(0);
    ui.setDepth(0, 0, MAX_METERS);
    ui.showScreen(null);
    ui.setHudVisible(true);
    this._prespawn();
    this.canvas.focus();
  }

  _prespawn() {
    // fill the shaft below the surface before diving starts
    while (this.nextSpawnY > this.diver.pos.y - SPAWN_AHEAD) {
      this._spawnRow(this.nextSpawnY);
      this.nextSpawnY -= ROW_GAP;
    }
  }

  _spawnRow(y) {
    if (y < -DEPTH + 12) return;
    const depthT = Math.min(1, -y / DEPTH);
    const count = 1 + (Math.random() < 0.55 ? 1 : 0) + (Math.random() < 0.25 ? 1 : 0);
    const hazardChance = Math.min(0.42, 0.1 + depthT * 0.32);
    let hazardsThisRow = 0;
    for (let i = 0; i < count; i++) {
      let key;
      if (hazardsThisRow < 1 && Math.random() < hazardChance) {
        key = Math.random() < 0.55 ? "shark" : "octopus";
        hazardsThisRow++;
      } else {
        key = randomSpeciesKey(depthT);
      }
      const c = new Creature(this.scene, this.glow, key);
      const x = (Math.random() * 2 - 1) * PLAY_HALF_X;
      const z = (Math.random() * 2 - 1) * PLAY_HALF_Z;
      c.setPos(x, y + (Math.random() * 2 - 1) * 4, z);
      this.creatures.push(c);
    }
  }

  // ---------- per-frame ----------
  _frame() {
    const dt = Math.min(this.engine.getDeltaTime() / 1000, 0.05);
    if (this.state === "diving") this._updateDiving(dt);

    // environment animations always run (nice on menus too)
    const t = performance.now() / 1000;
    for (const r of this.rays) r.rotation.z += Math.sin(t + r.position.x) * dt * 0.05;
    if (this.causticTex) { this.causticTex.uOffset = t * 0.02; this.causticTex.vOffset = t * 0.015; }

    this.scene.render();
  }

  _updateDiving(dt) {
    this.elapsed += dt;
    const diver = this.diver;

    // auto-descend
    diver.pos.y -= DESCENT_SPEED * dt;

    // steering
    if (this.isTouch && this.pointerActive) {
      diver.pos.x += (this.pointerTarget.x - diver.pos.x) * Math.min(1, dt * 6);
      diver.pos.z += (this.pointerTarget.z - diver.pos.z) * Math.min(1, dt * 6);
    }
    let mx = 0, mz = 0;
    if (this.keys.left) mx -= 1;
    if (this.keys.right) mx += 1;
    if (this.keys.up) mz += 1;
    if (this.keys.down) mz -= 1;
    diver.pos.x += mx * STEER * dt;
    diver.pos.z += mz * STEER * dt;
    diver.pos.x = clamp(diver.pos.x, -PLAY_HALF_X, PLAY_HALF_X);
    diver.pos.z = clamp(diver.pos.z, -PLAY_HALF_Z, PLAY_HALF_Z);
    diver.update(dt);

    // camera follows the descent
    const desired = new BABYLON.Vector3(diver.pos.x * 0.3, diver.pos.y + 9, diver.pos.z - 14);
    this.camera.position.x += (desired.x - this.camera.position.x) * Math.min(1, dt * 5);
    this.camera.position.z += (desired.z - this.camera.position.z) * Math.min(1, dt * 5);
    this.camera.position.y = diver.pos.y + 9;
    this.camera.setTarget(new BABYLON.Vector3(diver.pos.x * 0.5, diver.pos.y - 6, diver.pos.z + 5));

    // torch follows + brightens with depth
    const depthT = clamp(-diver.pos.y / DEPTH, 0, 1);
    this.torch.position.set(diver.pos.x, diver.pos.y + 1, diver.pos.z);
    this.torch.intensity = 0.3 + depthT * 1.7;

    // fog + light + clear colour darken with depth
    const surf = new BABYLON.Color3(0.05, 0.35, 0.5);
    const deep = new BABYLON.Color3(0.0, 0.02, 0.06);
    const col = BABYLON.Color3.Lerp(surf, deep, depthT);
    this.scene.clearColor = col;
    this.scene.fogColor = col;
    this.scene.fogDensity = 0.012 + depthT * 0.03;
    this.sun.intensity = 1.0 - depthT * 0.85;

    // follow emitter for marine snow
    this.snowEmitter.position.set(diver.pos.x, diver.pos.y, diver.pos.z + 5);

    // spawn ahead / despawn behind
    while (this.nextSpawnY > diver.pos.y - SPAWN_AHEAD) {
      this._spawnRow(this.nextSpawnY);
      this.nextSpawnY -= ROW_GAP;
    }
    for (let i = this.creatures.length - 1; i >= 0; i--) {
      const c = this.creatures[i];
      c.update(dt, this.elapsed);
      if (c.pos.y > diver.pos.y + 18) { c.dispose(); this.creatures.splice(i, 1); }
    }

    if (this.invuln > 0) this.invuln -= dt;
    this._checkCollisions();

    // depth milestone bonus (every 20%)
    const ms = Math.floor(depthT / 0.2);
    if (ms > this.milestones) { this.score += 40 * (ms - this.milestones); this.milestones = ms; ui.setScore(this.score); }

    // HUD
    ui.setDepth(depthT, depthT * MAX_METERS, MAX_METERS);

    // reached the seabed?
    if (diver.pos.y <= -DEPTH) this._win();
  }

  _checkCollisions() {
    const d = this.diver.pos;
    for (let i = this.creatures.length - 1; i >= 0; i--) {
      const c = this.creatures[i];
      if (c.collected) continue;
      const dx = d.x - c.pos.x, dy = d.y - c.pos.y, dz = d.z - c.pos.z;
      const reach = DIVER_RADIUS + c.radius;
      if (dx * dx + dy * dy + dz * dz > reach * reach) continue;

      if (c.hazard) {
        if (this.invuln > 0) continue;
        this.hits++;
        this.invuln = HIT_INVULN;
        if (c.typeKey === "octopus") { ui.flashInk(); this.score = Math.max(0, this.score - OCTO_PENALTY); }
        else { ui.flashDamage(); this.score = Math.max(0, this.score - SHARK_PENALTY); }
        ui.setScore(this.score);
        if (this.hits >= 2) { this._gameOver(c.typeKey); return; }
        ui.setDanger(true);
      } else {
        c.collected = true;
        this.score += c.points;
        ui.setScore(this.score);
        this._burst(c.pos, c.def.color);
        c.dispose();
        this.creatures.splice(i, 1);
      }
    }
  }

  _burst(pos, color) {
    const ps = new BABYLON.ParticleSystem("burst", 40, this.scene);
    ps.particleTexture = this._dotTexture(this.scene);
    ps.emitter = new BABYLON.Vector3(pos.x, pos.y, pos.z);
    ps.color1 = new BABYLON.Color4(color[0], color[1], color[2], 1);
    ps.color2 = new BABYLON.Color4(1, 1, 1, 1);
    ps.colorDead = new BABYLON.Color4(0, 0, 0, 0);
    ps.minSize = 0.2; ps.maxSize = 0.6;
    ps.minLifeTime = 0.2; ps.maxLifeTime = 0.5;
    ps.createSphereEmitter(0.5);
    ps.minEmitPower = 3; ps.maxEmitPower = 6;
    ps.blendMode = BABYLON.ParticleSystem.BLENDMODE_ADD;
    ps.manualEmitCount = 40;
    ps.disposeOnStop = true;
    ps.targetStopDuration = 0.5;
    ps.start();
  }

  _gameOver(by) {
    this.state = "over";
    ui.setHudVisible(false);
    ui.setDanger(false);
    ui.dom.overReason.textContent =
      by === "octopus" ? "An octopus inked you twice — the dive is lost." :
      by === "shark" ? "A shark got you. Better luck on the next dive!" :
      "The dive is lost.";
    ui.showScreen(ui.dom.over);
  }

  _win() {
    this.state = "win";
    ui.setHudVisible(false);
    ui.setDanger(false);

    const depthBonus = 0; // already folded into score during descent
    const flawless = this.hits === 0 ? 600 : this.hits === 1 ? 200 : 0;
    this.score += flawless;
    const final = Math.round(this.score);
    const stars = final >= 1300 ? 3 : final >= 750 ? 2 : 1;
    this.pendingScore = { score: final, stars };

    ui.showStars(stars);
    ui.setScoreLine(
      `Score ${final}  •  Flawless bonus ${flawless}  •  ${this.hits === 0 ? "No hits!" : this.hits + " hit"}`
    );
    ui.dom.nameInput.value = "";
    ui.dom.nameEntry.style.display = "flex";
    ui.showScreen(ui.dom.win);
    setTimeout(() => ui.dom.nameInput.focus(), 50);
  }

  quitToMenu() {
    this.state = "menu";
    ui.setHudVisible(false);
    ui.showScreen(ui.dom.menu);
  }

  // ---------- input / UI ----------
  _bindInput() {
    const set = (k, v) => {
      switch (k) {
        case "ArrowLeft": case "a": this.keys.left = v; return true;
        case "ArrowRight": case "d": this.keys.right = v; return true;
        case "ArrowUp": case "w": this.keys.up = v; return true;
        case "ArrowDown": case "s": this.keys.down = v; return true;
      }
      return false;
    };
    window.addEventListener("keydown", (e) => { if (set(e.key, true)) e.preventDefault(); });
    window.addEventListener("keyup", (e) => { if (set(e.key, false)) e.preventDefault(); });

    // pointer / touch follow
    const toTarget = (clientX, clientY) => {
      const nx = (clientX / window.innerWidth) * 2 - 1;
      const ny = (clientY / window.innerHeight) * 2 - 1;
      this.pointerTarget.x = nx * PLAY_HALF_X;
      this.pointerTarget.z = -ny * PLAY_HALF_Z;
    };
    this.canvas.addEventListener("pointerdown", (e) => { this.pointerActive = true; toTarget(e.clientX, e.clientY); });
    this.canvas.addEventListener("pointermove", (e) => { if (this.pointerActive) toTarget(e.clientX, e.clientY); });
    window.addEventListener("pointerup", () => { this.pointerActive = false; });
    window.addEventListener("pointercancel", () => { this.pointerActive = false; });
  }

  _bindUI() {
    document.getElementById("dive-btn").addEventListener("click", () => this.startRun());
    document.getElementById("retry-btn").addEventListener("click", () => this.startRun());
    document.getElementById("quit-btn").addEventListener("click", () => this.quitToMenu());
    document.getElementById("over-menu-btn").addEventListener("click", () => this.quitToMenu());
    document.getElementById("win-menu-btn").addEventListener("click", () => this.quitToMenu());
    document.getElementById("show-board-btn").addEventListener("click", () => { ui.renderBoard(); ui.showScreen(ui.dom.board); });
    document.getElementById("board-back-btn").addEventListener("click", () => ui.showScreen(ui.dom.menu));
    document.getElementById("save-score-btn").addEventListener("click", () => {
      const name = (ui.dom.nameInput.value || "Diver").trim().slice(0, 12) || "Diver";
      saveScore({ name, ...this.pendingScore, date: Date.now() });
      ui.dom.nameEntry.style.display = "none";
      ui.renderBoard();
      ui.showScreen(ui.dom.board);
    });
  }
}

function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

window.addEventListener("DOMContentLoaded", () => new Game());
