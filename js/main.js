import { Diver, PLAY_HALF_X, PLAY_HALF_Z, DIVER_RADIUS } from "./diver.js";
import { Creature, randomSpeciesKey, SPECIES } from "./creatures.js";
import { saveScore } from "./leaderboard.js";
import { SeaAudio } from "./audio.js";
import * as ui from "./ui.js";

const DEPTH = 300;
const MAX_METERS = 200;
const DESCENT_SPEED = 9;
const STEER = 17;
const ROW_GAP = 13;
const SPAWN_AHEAD = 115;
const HIT_INVULN = 1.6;
const SHARK_PENALTY = 60, OCTO_PENALTY = 40, JELLY_PENALTY = 35;
const MAGNET = 6, COLLECT_PAD = 0.6;
const COMBO_WINDOW = 2.6;

const SURFACE = new BABYLON.Color3(0.10, 0.50, 0.62);
const MID = new BABYLON.Color3(0.02, 0.17, 0.34);
const DEEP = new BABYLON.Color3(0.0, 0.02, 0.06);
const SPECIES_HEX = { sardine: "#dfeaff", clownfish: "#ff8c3f", bluetang: "#5aa0ff", seahorse: "#ffd84a", angler: "#9dffce" };

class Game {
  constructor() {
    this.canvas = document.getElementById("renderCanvas");
    this.engine = new BABYLON.Engine(this.canvas, true, { stencil: true });
    this.scene = this._createScene();

    this.state = "menu";
    this.creatures = [];
    this.flocks = [];
    this.keys = { left: false, right: false, up: false, down: false };
    this.isTouch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
    this.pointerActive = false;
    this.pointerTarget = { x: 0, z: 0 };
    this.audio = new SeaAudio();

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
    scene.clearColor = SURFACE.clone();
    scene.fogMode = BABYLON.Scene.FOGMODE_EXP2;
    scene.fogColor = SURFACE.clone();
    scene.fogDensity = 0.006;

    const cam = new BABYLON.UniversalCamera("cam", new BABYLON.Vector3(0, 7.5, -12.5), scene);
    cam.minZ = 0.1; cam.maxZ = 500; cam.fov = 1.2;
    this.camera = cam; this._updateFov();

    this.sun = new BABYLON.HemisphericLight("sun", new BABYLON.Vector3(0, 1, 0.15), scene);
    this.sun.diffuse = new BABYLON.Color3(0.7, 0.95, 1.0);
    this.sun.groundColor = new BABYLON.Color3(0.0, 0.08, 0.16);
    this.sun.intensity = 1.0;

    this.torch = new BABYLON.SpotLight("torch", new BABYLON.Vector3(0, 0, 0), new BABYLON.Vector3(0, -0.6, 1), Math.PI / 2.2, 6, scene);
    this.torch.diffuse = new BABYLON.Color3(1.0, 0.95, 0.8);
    this.torch.intensity = 0.3;

    this.glow = new BABYLON.GlowLayer("glow", scene);
    this.glow.intensity = 0.85;

    const pipe = new BABYLON.DefaultRenderingPipeline("pipe", true, scene, [cam]);
    pipe.bloomEnabled = true; pipe.bloomThreshold = 0.5; pipe.bloomWeight = 0.7; pipe.bloomKernel = 64; pipe.fxaaEnabled = true;
    pipe.imageProcessing.contrast = 1.2; pipe.imageProcessing.exposure = 1.05;
    pipe.imageProcessing.vignetteEnabled = true;
    pipe.imageProcessing.vignetteWeight = 0.7;
    pipe.imageProcessing.vignetteColor = new BABYLON.Color4(0, 0.04, 0.09, 1);

    this.diver = new Diver(scene);
    this._buildEnvironment(scene);
    return scene;
  }

  _updateFov() {
    if (!this.camera) return;
    const aspect = this.engine.getRenderWidth() / Math.max(1, this.engine.getRenderHeight());
    const BASE_V = 1.2, MIN_H = 1.5, MAX_V = 1.65;
    const hAtBase = 2 * Math.atan(Math.tan(BASE_V / 2) * aspect);
    let v = BASE_V;
    if (hAtBase < MIN_H) v = 2 * Math.atan(Math.tan(MIN_H / 2) / aspect);
    this.camera.fov = Math.min(v, MAX_V);
  }

  // ---------- environment ----------
  _buildEnvironment(scene) {
    // smooth light shafts near the surface (no per-frame jitter)
    const rayTex = this._gradientTexture(scene);
    const rayMat = new BABYLON.StandardMaterial("rayMat", scene);
    rayMat.diffuseTexture = rayTex; rayMat.opacityTexture = rayTex;
    rayMat.emissiveColor = new BABYLON.Color3(0.45, 0.7, 0.85);
    rayMat.disableLighting = true; rayMat.backFaceCulling = false;
    rayMat.alphaMode = BABYLON.Engine.ALPHA_ADD;
    // A few soft, scattered, far-away sunbeams from the surface — NOT a wall of planes
    // around the player. Spread wide and deep, randomly oriented so they read as beams.
    this.rays = [];
    for (let i = 0; i < 6; i++) {
      const s = BABYLON.MeshBuilder.CreatePlane("ray" + i, { width: 7 + Math.random() * 6, height: 230 }, scene);
      s.material = rayMat;
      s.position.set((Math.random() * 2 - 1) * 70, -70, 20 + Math.random() * 70);
      s.baseRot = (Math.random() * 2 - 1) * 0.2; s.seed = Math.random() * 10;
      s.rotation.z = s.baseRot; s.rotation.y = Math.random() * Math.PI;
      this.rays.push(s);
    }

    // WORLD-FIXED plankton motes — the camera glides past them, giving clear downward motion
    const moteMat = new BABYLON.StandardMaterial("moteMat", scene);
    moteMat.emissiveColor = new BABYLON.Color3(0.7, 0.9, 1.0);
    moteMat.disableLighting = true;
    const moteSrc = BABYLON.MeshBuilder.CreateSphere("moteSrc", { diameter: 1, segments: 4 }, scene);
    moteSrc.material = moteMat; moteSrc.isVisible = false;
    this.motes = [];
    for (let i = 0; i < 170; i++) {
      const m = moteSrc.createInstance("mote" + i);
      const sc = 0.05 + Math.random() * 0.16; m.scaling.set(sc, sc, sc);
      m.basePos = {
        x: (Math.random() * 2 - 1) * 95,
        y: -Math.random() * 120,
        z: (Math.random() * 2 - 1) * 65 + 15,
      };
      m.position.set(m.basePos.x, m.basePos.y, m.basePos.z);
      m.swim = Math.random() * Math.PI * 2;
      this.motes.push(m);
    }
    this.moteSrc = moteSrc;

    // bubble trail from the diver (local motion cue)
    const bubbles = new BABYLON.ParticleSystem("bubbles", 220, scene);
    bubbles.particleTexture = this._dotTexture(scene);
    bubbles.emitter = this.diver.root;
    bubbles.minEmitBox = new BABYLON.Vector3(-0.3, 0.6, 0.1);
    bubbles.maxEmitBox = new BABYLON.Vector3(0.3, 1.0, 0.3);
    bubbles.color1 = new BABYLON.Color4(0.8, 1, 1, 0.6);
    bubbles.color2 = new BABYLON.Color4(0.6, 0.9, 1, 0.4);
    bubbles.colorDead = new BABYLON.Color4(1, 1, 1, 0);
    bubbles.minSize = 0.06; bubbles.maxSize = 0.26;
    bubbles.minLifeTime = 1.0; bubbles.maxLifeTime = 2.0;
    bubbles.emitRate = 45;
    bubbles.gravity = new BABYLON.Vector3(0, 7, 0);
    bubbles.direction1 = new BABYLON.Vector3(-0.2, 1, -0.2);
    bubbles.direction2 = new BABYLON.Vector3(0.2, 1, 0.2);
    bubbles.start();
    this.bubbles = bubbles;

    // seabed with caustic shimmer
    const caustic = this._causticTexture(scene); this.causticTex = caustic;
    const seabed = BABYLON.MeshBuilder.CreateGround("seabed", { width: 240, height: 240 }, scene);
    seabed.position.y = -DEPTH - 2;
    const sbMat = new BABYLON.StandardMaterial("sbMat", scene);
    sbMat.diffuseColor = new BABYLON.Color3(0.1, 0.16, 0.18);
    sbMat.emissiveTexture = caustic; sbMat.emissiveColor = new BABYLON.Color3(0.35, 0.65, 0.75);
    seabed.material = sbMat;
    for (let i = 0; i < 16; i++) {
      const rock = BABYLON.MeshBuilder.CreateSphere("rock", { diameter: 3 + Math.random() * 7, segments: 5 }, scene);
      rock.position.set((Math.random() * 2 - 1) * 100, -DEPTH - 1, (Math.random() * 2 - 1) * 100);
      rock.scaling.y = 0.45;
      const rm = new BABYLON.StandardMaterial("rm", scene); rm.diffuseColor = new BABYLON.Color3(0.08, 0.12, 0.14);
      rock.material = rm;
    }
  }

  _gradientTexture(scene) {
    const t = new BABYLON.DynamicTexture("rayGrad", { width: 32, height: 256 }, scene, false);
    const ctx = t.getContext();
    const g = ctx.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, "rgba(255,255,255,0.3)");
    g.addColorStop(0.5, "rgba(200,240,255,0.08)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g; ctx.fillRect(0, 0, 32, 256);
    t.hasAlpha = true; t.update(); return t;
  }
  _dotTexture(scene) {
    const t = new BABYLON.DynamicTexture("dot", 32, scene, false);
    const ctx = t.getContext();
    const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    g.addColorStop(0, "rgba(255,255,255,1)"); g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g; ctx.fillRect(0, 0, 32, 32); t.hasAlpha = true; t.update(); return t;
  }
  _causticTexture(scene) {
    const S = 256, t = new BABYLON.DynamicTexture("caustic", S, scene, false), ctx = t.getContext();
    ctx.fillStyle = "#0a1416"; ctx.fillRect(0, 0, S, S);
    ctx.strokeStyle = "rgba(140,230,255,0.55)"; ctx.lineWidth = 2;
    for (let i = 0; i < 60; i++) { ctx.beginPath(); ctx.arc(Math.random() * S, Math.random() * S, 6 + Math.random() * 22, 0, Math.PI * 2); ctx.stroke(); }
    t.update(); t.uScale = 4; t.vScale = 4; t.wrapU = t.wrapV = BABYLON.Texture.WRAP_ADDRESSMODE; return t;
  }

  // ---------- run lifecycle ----------
  startRun() {
    this.audio.start(); this.audio.resume();
    for (const c of this.creatures) c.dispose();
    this.creatures = []; this.flocks = [];
    this.diver.setPos(0, 0, 0); this.diver.vx = 0; this.diver.vz = 0;
    this.camera.position.set(0, 7.5, -12.5);
    this.score = 0; this.hits = 0; this.invuln = 0; this.elapsed = 0;
    this.nextSpawnY = -16; this.milestones = 0;
    this.combo = 0; this.comboTimer = 0;
    this.keys = { left: false, right: false, up: false, down: false };
    this.pointerActive = false;

    this.state = "diving";
    ui.setDanger(false); ui.setCombo(1); ui.setScore(0); ui.setDepth(0, 0, MAX_METERS);
    ui.showScreen(null); ui.setHudVisible(true);
    this._prespawn(); this.canvas.focus();
  }

  _prespawn() { while (this.nextSpawnY > this.diver.pos.y - SPAWN_AHEAD) { this._spawnRow(this.nextSpawnY); this.nextSpawnY -= ROW_GAP; } }

  _spawnRow(y) {
    if (y < -DEPTH + 14) return;
    const depthT = Math.min(1, -y / DEPTH);

    // chance of a fish school (Abzû-style flock you swim through)
    if (Math.random() < 0.28) { this._spawnSchool(y); return; }

    const count = 1 + (Math.random() < 0.5 ? 1 : 0) + (Math.random() < 0.2 ? 1 : 0);
    let hazards = 0;
    const hazardChance = Math.min(0.4, 0.1 + depthT * 0.28);
    for (let i = 0; i < count; i++) {
      let key;
      if (hazards < 2 && Math.random() < hazardChance) {
        const r = Math.random();
        key = r < 0.45 ? "shark" : r < 0.75 ? "octopus" : "jelly";
        hazards++;
      } else key = randomSpeciesKey(depthT);
      const c = new Creature(this.scene, this.glow, key);
      c.setPos((Math.random() * 2 - 1) * PLAY_HALF_X, y + (Math.random() * 2 - 1) * 4, (Math.random() * 2 - 1) * PLAY_HALF_Z);
      this.creatures.push(c);
    }
  }

  _spawnSchool(y) {
    const flock = { x: (Math.random() * 2 - 1) * (PLAY_HALF_X - 4), y, z: (Math.random() * 2 - 1) * PLAY_HALF_Z, vx: (Math.random() * 2 - 1) * 1.5, alive: 0 };
    this.flocks.push(flock);
    const n = 8 + Math.floor(Math.random() * 6);
    for (let i = 0; i < n; i++) {
      const c = new Creature(this.scene, this.glow, "sardine", flock);
      c.setPos(flock.x, flock.y, flock.z);
      this.creatures.push(c); flock.alive++;
    }
  }

  // ---------- per-frame ----------
  _frame() {
    const dt = Math.min(this.engine.getDeltaTime() / 1000, 0.05);
    if (this.state === "diving") this._updateDiving(dt);

    const t = performance.now() / 1000;
    for (const r of this.rays) r.rotation.z = r.baseRot + Math.sin(t * 0.3 + r.seed) * 0.05;
    if (this.causticTex) { this.causticTex.uOffset = t * 0.02; this.causticTex.vOffset = t * 0.015; }
    this.scene.render();
  }

  _updateDiving(dt) {
    this.elapsed += dt;
    const diver = this.diver;
    const prevX = diver.pos.x, prevZ = diver.pos.z;

    diver.pos.y -= DESCENT_SPEED * dt;

    // steering
    if (this.isTouch && this.pointerActive) {
      diver.pos.x += (this.pointerTarget.x - diver.pos.x) * Math.min(1, dt * 6);
      diver.pos.z += (this.pointerTarget.z - diver.pos.z) * Math.min(1, dt * 6);
    }
    let mx = 0, mz = 0;
    if (this.keys.left) mx -= 1; if (this.keys.right) mx += 1;
    if (this.keys.up) mz += 1; if (this.keys.down) mz -= 1;
    diver.pos.x += mx * STEER * dt; diver.pos.z += mz * STEER * dt;
    diver.pos.x = clamp(diver.pos.x, -PLAY_HALF_X, PLAY_HALF_X);
    diver.pos.z = clamp(diver.pos.z, -PLAY_HALF_Z, PLAY_HALF_Z);
    diver.vx = (diver.pos.x - prevX) / Math.max(dt, 0.001);
    diver.vz = (diver.pos.z - prevZ) / Math.max(dt, 0.001);

    const depthT = clamp(-diver.pos.y / DEPTH, 0, 1);
    diver.update(dt, depthT);

    // smooth camera glide — pulled back & less steep so the sea feels wide open
    this.camera.position.x += (diver.pos.x * 0.45 - this.camera.position.x) * Math.min(1, dt * 4);
    this.camera.position.z += ((diver.pos.z - 12.5) - this.camera.position.z) * Math.min(1, dt * 4);
    this.camera.position.y = diver.pos.y + 7.5;
    this.camera.setTarget(new BABYLON.Vector3(diver.pos.x * 0.5, diver.pos.y - 3.5, diver.pos.z + 8));

    // torch + depth color grade
    this.torch.position.set(diver.pos.x, diver.pos.y + 0.5, diver.pos.z);
    this.torch.intensity = 0.3 + depthT * 1.8;
    const col = depthT < 0.5 ? BABYLON.Color3.Lerp(SURFACE, MID, depthT * 2) : BABYLON.Color3.Lerp(MID, DEEP, (depthT - 0.5) * 2);
    this.scene.clearColor = col; this.scene.fogColor = col;
    this.scene.fogDensity = 0.006 + depthT * 0.02;
    this.sun.intensity = 1.0 - depthT * 0.88;

    // recycle world-fixed motes around the camera
    const camY = this.camera.position.y, t = performance.now() / 1000;
    for (const m of this.motes) {
      if (m.basePos.y > camY + 16) m.basePos.y -= 150;
      else if (m.basePos.y < camY - 140) m.basePos.y += 150;
      m.position.x = m.basePos.x + Math.sin(t * 0.5 + m.swim) * 0.4;
      m.position.y = m.basePos.y;
      m.position.z = m.basePos.z;
    }

    // spawn ahead / despawn behind
    while (this.nextSpawnY > diver.pos.y - SPAWN_AHEAD) { this._spawnRow(this.nextSpawnY); this.nextSpawnY -= ROW_GAP; }
    // advance flock centres
    for (const f of this.flocks) { f.x += f.vx * dt; if (Math.abs(f.x) > PLAY_HALF_X) f.vx *= -1; }

    const ctx = { diver: diver.pos };
    let nearestHunt = Infinity;
    for (let i = this.creatures.length - 1; i >= 0; i--) {
      const c = this.creatures[i];
      c.update(dt, ctx);
      if (c.hunting) {
        const d = Math.hypot(diver.pos.x - c.pos.x, diver.pos.y - c.pos.y, diver.pos.z - c.pos.z);
        if (d < nearestHunt) nearestHunt = d;
      }
      const passed = c.pos.y > diver.pos.y + 22;
      if (passed) { if (c.flock) c.flock.alive--; c.dispose(); this.creatures.splice(i, 1); }
    }
    this.flocks = this.flocks.filter((f) => f.alive > 0);

    // danger audio swells as the nearest hunter closes in
    this.audio.setDanger(nearestHunt < 30 ? 1 - nearestHunt / 30 : 0);

    if (this.invuln > 0) this.invuln -= dt;
    if (this.comboTimer > 0) { this.comboTimer -= dt; if (this.comboTimer <= 0) { this.combo = 0; ui.setCombo(1); } }
    this._magnetAndCollide(dt);

    const ms = Math.floor(depthT / 0.2);
    if (ms > this.milestones) { this.score += 40 * (ms - this.milestones); this.milestones = ms; ui.setScore(this.score); }

    ui.setDepth(depthT, depthT * MAX_METERS, MAX_METERS);
    if (diver.pos.y <= -DEPTH) this._win();
  }

  _magnetAndCollide(dt) {
    const d = this.diver.pos;
    for (let i = this.creatures.length - 1; i >= 0; i--) {
      const c = this.creatures[i];
      if (c.collected) continue;
      let dx = d.x - c.pos.x, dy = d.y - c.pos.y, dz = d.z - c.pos.z;
      let dist = Math.hypot(dx, dy, dz);

      if (!c.hazard && !c.flock && dist < MAGNET) {
        // magnet pull for single collectibles
        const pull = (1 - dist / MAGNET) * 8 * dt;
        c.pos.x += dx * pull; c.pos.y += dy * pull; c.pos.z += dz * pull;
        c.root.position.set(c.pos.x, c.pos.y, c.pos.z);
        dx = d.x - c.pos.x; dy = d.y - c.pos.y; dz = d.z - c.pos.z; dist = Math.hypot(dx, dy, dz);
      }

      const reach = DIVER_RADIUS + c.radius + (c.hazard ? 0 : COLLECT_PAD);
      if (dist > reach) continue;

      if (c.hazard) {
        if (this.invuln > 0) continue;
        this.hits++; this.invuln = HIT_INVULN; this.combo = 0; this.comboTimer = 0; ui.setCombo(1);
        const pen = c.typeKey === "shark" ? SHARK_PENALTY : c.typeKey === "octopus" ? OCTO_PENALTY : JELLY_PENALTY;
        this.score = Math.max(0, this.score - pen); ui.setScore(this.score);
        if (c.typeKey === "octopus" || c.typeKey === "jelly") ui.flashInk(); else ui.flashDamage();
        this.audio.hit(c.typeKey);
        const sp = this._toScreen(c.pos.x, c.pos.y, c.pos.z);
        ui.popup("-" + pen, sp.x, sp.y, "#ff6b6b");
        if (this.hits >= 2) { this._gameOver(c.typeKey); return; }
        ui.setDanger(true);
      } else {
        c.collected = true;
        // combo
        this.combo = this.comboTimer > 0 ? this.combo + 1 : 1;
        this.comboTimer = COMBO_WINDOW;
        const mult = Math.min(5, 1 + Math.floor(this.combo / 3));
        ui.setCombo(mult);
        const gain = c.points * mult;
        this.score += gain; ui.setScore(this.score);
        this.audio.collect(this.combo);
        const sp = this._toScreen(c.pos.x, c.pos.y, c.pos.z);
        ui.popup("+" + gain, sp.x, sp.y, SPECIES_HEX[c.typeKey] || "#ffd27f");
        this._burst(c.pos, c.def.color);
        if (c.flock) c.flock.alive--;
        c.dispose(); this.creatures.splice(i, 1);
      }
    }
  }

  _toScreen(x, y, z) {
    const v = BABYLON.Vector3.Project(
      new BABYLON.Vector3(x, y, z), BABYLON.Matrix.Identity(),
      this.scene.getTransformMatrix(),
      this.camera.viewport.toGlobal(this.canvas.clientWidth, this.canvas.clientHeight)
    );
    return { x: v.x, y: v.y };
  }

  _burst(pos, color) {
    const ps = new BABYLON.ParticleSystem("burst", 30, this.scene);
    ps.particleTexture = this._dotTexture(this.scene);
    ps.emitter = new BABYLON.Vector3(pos.x, pos.y, pos.z);
    ps.color1 = new BABYLON.Color4(color[0], color[1], color[2], 1);
    ps.color2 = new BABYLON.Color4(1, 1, 1, 1); ps.colorDead = new BABYLON.Color4(0, 0, 0, 0);
    ps.minSize = 0.15; ps.maxSize = 0.5; ps.minLifeTime = 0.2; ps.maxLifeTime = 0.5;
    ps.createSphereEmitter(0.4); ps.minEmitPower = 3; ps.maxEmitPower = 6;
    ps.blendMode = BABYLON.ParticleSystem.BLENDMODE_ADD;
    ps.manualEmitCount = 30; ps.disposeOnStop = true; ps.targetStopDuration = 0.5; ps.start();
  }

  _gameOver(by) {
    this.state = "over"; ui.setHudVisible(false); ui.setDanger(false); this.audio.setDanger(0);
    ui.dom.overReason.textContent =
      by === "octopus" ? "An octopus inked you twice — the dive is lost." :
      by === "jelly" ? "Stung once too often — the dive is lost." :
      by === "shark" ? "A shark got you. Better luck on the next dive!" : "The dive is lost.";
    ui.showScreen(ui.dom.over);
  }

  _win() {
    this.state = "win"; ui.setHudVisible(false); ui.setDanger(false); this.audio.setDanger(0); this.audio.win();
    const flawless = this.hits === 0 ? 600 : this.hits === 1 ? 200 : 0;
    this.score += flawless;
    const final = Math.round(this.score);
    const stars = final >= 1400 ? 3 : final >= 800 ? 2 : 1;
    this.pendingScore = { score: final, stars };
    ui.showStars(stars);
    ui.setScoreLine(`Score ${final}  •  Flawless bonus ${flawless}  •  ${this.hits === 0 ? "No hits!" : this.hits + " hit"}`);
    ui.dom.nameInput.value = ""; ui.dom.nameEntry.style.display = "flex";
    ui.showScreen(ui.dom.win); setTimeout(() => ui.dom.nameInput.focus(), 50);
  }

  quitToMenu() { this.state = "menu"; this.audio.setDanger(0); ui.setHudVisible(false); ui.showScreen(ui.dom.menu); }

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
    const toTarget = (cx, cy) => {
      const nx = (cx / window.innerWidth) * 2 - 1, ny = (cy / window.innerHeight) * 2 - 1;
      this.pointerTarget.x = nx * PLAY_HALF_X; this.pointerTarget.z = -ny * PLAY_HALF_Z;
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
      ui.dom.nameEntry.style.display = "none"; ui.renderBoard(); ui.showScreen(ui.dom.board);
    });
  }
}

function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
window.addEventListener("DOMContentLoaded", () => new Game());
