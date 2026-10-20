// Scène 3D : l'imprimante à portique, le rouleau de papier et l'animation d'impression.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { makeCanvas, blankPaper, renderCard } from './cards.js';

export const PAGE_W = 1000; // unités logiques (identiques côté serveur)
export const PAGE_H = 1400;
const TEX_SCALE = 1.4; // pixels de texture par unité logique

const PW = 10; // largeur d'une page dans la scène
const PL = 14; // longueur d'une page dans la scène
const Z_TOP = -9; // bord lointain de la page en cours d'impression
const RAIL_X = PW / 2 + 0.95;
const RAIL_Y = 1.15;
const BAR_Y = 1.38;
const HOME_Z = Z_TOP + 0.55;
const PASS_SECONDS = 0.3; // durée d'un aller (ou retour) du chariot

const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

const pageToWorldX = (px) => (px / PAGE_W) * PW - PW / 2;
const pageToWorldZ = (py) => Z_TOP + (py / PAGE_H) * PL;

function woodTexture() {
  const size = 1024;
  const c = makeCanvas(size, size);
  const ctx = c.getContext('2d');
  const planks = 8;
  const ph = size / planks;
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let p = 0; p < planks; p++) {
    const y = p * ph;
    const offset = rand() * size;
    for (const start of [offset - size, offset]) {
      const hue = 22 + rand() * 9;
      const light = 30 + rand() * 12;
      ctx.fillStyle = `hsl(${hue}, ${52 + rand() * 12}%, ${light}%)`;
      ctx.fillRect(start, y, size, ph);
      for (let i = 0; i < 46; i++) {
        const gy = y + rand() * ph;
        ctx.strokeStyle = `hsla(${hue - 4}, 60%, ${light - 12 + rand() * 8}%, ${0.12 + rand() * 0.22})`;
        ctx.lineWidth = 0.6 + rand() * 2.2;
        ctx.beginPath();
        ctx.moveTo(start, gy);
        for (let x = 0; x <= size; x += 32) ctx.lineTo(start + x, gy + Math.sin(x * 0.012 + i) * (1 + rand() * 2.5));
        ctx.stroke();
      }
      ctx.fillStyle = 'rgba(25, 12, 4, 0.75)';
      ctx.fillRect(start + size - 3, y, 3, ph);
    }
    ctx.fillStyle = 'rgba(20, 10, 3, 0.85)';
    ctx.fillRect(0, y, size, 3);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(5, 6);
  return tex;
}

function glowTexture() {
  const c = makeCanvas(256, 256);
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.25, 'rgba(225,242,255,0.55)');
  g.addColorStop(0.6, 'rgba(180,220,255,0.12)');
  g.addColorStop(1, 'rgba(180,220,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class Booth {
  constructor(canvas, { t, onPass, onFeed, onPrintEnd } = {}) {
    this.t = t;
    this.onPass = onPass || (() => {});
    this.onFeed = onFeed || (() => {});
    this.onPrintEnd = onPrintEnd || (() => {});
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.toneMappingExposure = 0.95;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.localClippingEnabled = true;
    // le papier disparaît dans la fente du caisson
    this.paperClip = [new THREE.Plane(new THREE.Vector3(0, 0, 1), -(Z_TOP - 0.3))];

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x2a1a0f);
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.45;

    this.camera = new THREE.PerspectiveCamera(50, 9 / 16, 0.1, 200);
    this.clock = new THREE.Clock();
    this.anisotropy = this.renderer.capabilities.getMaxAnisotropy();

    this.blank = blankPaper(PAGE_W * TEX_SCALE, PAGE_H * TEX_SCALE);
    this.pages = [];
    this.job = null;
    this.feedAnim = null;
    this.gantry = { x: 0, z: HOME_Z };
    this.restoreToken = 0;

    this.buildLights();
    this.buildFloor();
    this.buildPaper();
    this.buildMachine();
    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.renderer.setAnimationLoop(() => this.frame());
  }

  // ---- construction ----------------------------------------------------------------------

  buildLights() {
    this.scene.add(new THREE.HemisphereLight(0xfff1dc, 0x5a3a20, 0.75));

    const sun = new THREE.DirectionalLight(0xffe6c4, 1.7);
    sun.position.set(-5, 16, 7);
    sun.target.position.set(0, 0, -2);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -10, right: 10, top: 16, bottom: -16, near: 1, far: 40 });
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.03;
    this.scene.add(sun, sun.target);

    const fill = new THREE.DirectionalLight(0xcfe4ff, 0.35);
    fill.position.set(6, 8, 12);
    this.scene.add(fill);

    // halo cyan au-dessus de la position de repos (comme dans la vidéo)
    this.housingLight = new THREE.PointLight(0x8fe9ff, 5, 6, 2);
    this.housingLight.position.set(0, 2.1, Z_TOP + 0.2);
    this.scene.add(this.housingLight);
  }

  buildFloor() {
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(70, 90),
      new THREE.MeshStandardMaterial({ map: woodTexture(), roughness: 0.62, metalness: 0.0 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, 0, 10);
    floor.receiveShadow = true;
    this.scene.add(floor);
  }

  buildPaper() {
    this.paperGroup = new THREE.Group();
    this.scene.add(this.paperGroup);
    // index -1 : page vierge sous le caisson ; 0 : sous l'imprimante ; 1, 2 : déjà sorties.
    for (let index = -1; index <= 2; index++) {
      const canvas = makeCanvas(PAGE_W * TEX_SCALE, PAGE_H * TEX_SCALE);
      const ctx = canvas.getContext('2d');
      ctx.drawImage(this.blank, 0, 0);
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = this.anisotropy;
      const material = new THREE.MeshStandardMaterial({
        map: texture,
        roughness: 1,
        metalness: 0,
        envMapIntensity: 0.35,
        clippingPlanes: this.paperClip,
      });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(PW, PL), material);
      mesh.rotation.x = -Math.PI / 2;
      mesh.receiveShadow = true;
      const page = { index, canvas, ctx, texture, mesh };
      this.placePage(page);
      this.paperGroup.add(mesh);
      this.pages.push(page);
    }
  }

  placePage(page) {
    page.mesh.position.set(0, 0.012, Z_TOP + PL / 2 + page.index * PL);
  }

  page(index) {
    return this.pages.find((p) => p.index === index);
  }

  buildMachine() {
    const chrome = new THREE.MeshStandardMaterial({ color: 0xe6e8eb, metalness: 1, roughness: 0.16 });
    const steel = new THREE.MeshStandardMaterial({ color: 0x8d9298, metalness: 0.85, roughness: 0.32 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x24272b, metalness: 0.55, roughness: 0.42 });
    const black = new THREE.MeshStandardMaterial({ color: 0x0d0e10, metalness: 0.2, roughness: 0.5 });
    const shadowy = (m) => ((m.castShadow = true), (m.receiveShadow = true), m);

    // caisson du fond (d'où sort le papier)
    const housing = shadowy(new THREE.Mesh(new RoundedBoxGeometry(2 * RAIL_X + 1.6, 1.5, 2.2, 3, 0.12), black));
    housing.position.set(0, 0.75, Z_TOP - 1.25);
    this.scene.add(housing);
    const lip = shadowy(new THREE.Mesh(new RoundedBoxGeometry(PW + 0.8, 0.22, 0.5, 2, 0.06), dark));
    lip.position.set(0, 0.11, Z_TOP - 0.2);
    this.scene.add(lip);
    const lamp = new THREE.Mesh(
      new THREE.BoxGeometry(2.2, 0.08, 0.08),
      new THREE.MeshStandardMaterial({ color: 0x9ff0ff, emissive: 0x6fe6ff, emissiveIntensity: 3 })
    );
    lamp.position.set(0, 1.42, Z_TOP - 0.14);
    this.scene.add(lamp);

    // rails + supports
    for (const side of [-1, 1]) {
      const rail = shadowy(new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 46, 32), chrome));
      rail.rotation.x = Math.PI / 2;
      rail.position.set(side * RAIL_X, RAIL_Y, Z_TOP + 21);
      this.scene.add(rail);
      const post = shadowy(new THREE.Mesh(new RoundedBoxGeometry(0.75, 1.9, 0.9, 2, 0.08), dark));
      post.position.set(side * RAIL_X, 0.95, Z_TOP - 0.55);
      this.scene.add(post);
    }

    // portique mobile : barre + blocs de glissement + chariot
    this.bar = new THREE.Group();
    const beam = shadowy(new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 2 * RAIL_X + 0.3, 32), chrome));
    beam.rotation.z = Math.PI / 2;
    beam.position.y = BAR_Y;
    this.bar.add(beam);
    for (const side of [-1, 1]) {
      const block = shadowy(new THREE.Mesh(new RoundedBoxGeometry(0.62, 0.62, 0.95, 2, 0.08), steel));
      block.position.set(side * RAIL_X, (RAIL_Y + BAR_Y) / 2 + 0.02, 0);
      this.bar.add(block);
    }
    this.scene.add(this.bar);

    this.carriage = new THREE.Group();
    const top = shadowy(new THREE.Mesh(new RoundedBoxGeometry(1.05, 0.6, 1.0, 3, 0.1), steel));
    top.position.y = BAR_Y + 0.12;
    const bottom = shadowy(new THREE.Mesh(new RoundedBoxGeometry(0.92, 0.55, 0.86, 3, 0.08), black));
    bottom.position.y = BAR_Y - 0.42;
    const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.11, 0.3, 16), steel);
    nozzle.position.y = BAR_Y - 0.82;
    this.led = new THREE.Mesh(
      new THREE.SphereGeometry(0.06, 12, 12),
      new THREE.MeshStandardMaterial({ color: 0x7fffd4, emissive: 0x7fffd4, emissiveIntensity: 2 })
    );
    this.led.position.set(0.32, BAR_Y + 0.3, 0.5);
    this.carriage.add(top, bottom, nozzle, this.led);

    this.headLight = new THREE.SpotLight(0xe6f3ff, 14, 5, 0.75, 0.85, 2);
    this.headLight.position.set(0, BAR_Y - 0.9, 0);
    this.headLight.target.position.set(0, 0, 0);
    this.carriage.add(this.headLight, this.headLight.target);
    this.scene.add(this.carriage);

    this.glow = new THREE.Mesh(
      new THREE.PlaneGeometry(2.6, 2.6),
      new THREE.MeshBasicMaterial({
        map: glowTexture(),
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        opacity: 0.35,
        color: 0xd8ecff,
      })
    );
    this.glow.rotation.x = -Math.PI / 2;
    this.glow.position.y = 0.03;
    this.scene.add(this.glow);
  }

  resize() {
    const w = window.innerWidth || 1080;
    const h = window.innerHeight || 1920;
    this.renderer.setSize(w, h, false);
    const aspect = w / h;
    this.camera.aspect = aspect;
    // Cadrage pensé pour le 9:16 ; en paysage on recule pour garder la page entière.
    // ?cam=x,y,z,cibleX,cibleY,cibleZ,fov : pour ajuster le cadrage à la main
    const custom = new URLSearchParams(location.search).get('cam');
    if (custom) {
      const [x, y, z, tx, ty, tz, fov] = custom.split(',').map(Number);
      this.camera.fov = fov;
      this.camera.position.set(x, y, z);
      this.camera.lookAt(tx, ty, tz);
    } else if (aspect < 1) {
      // valeurs calées sur les proportions de la vidéo de référence
      this.camera.fov = 69;
      this.camera.position.set(0, 9.8, 12.3);
      this.camera.lookAt(0, 0, 3.05);
    } else {
      this.camera.fov = 48;
      this.camera.position.set(0, 15, 9);
      this.camera.lookAt(0, 0, -2);
    }
    this.camera.updateProjectionMatrix();
  }

  // ---- boucle ----------------------------------------------------------------------------

  frame() {
    const dt = Math.min(0.1, this.clock.getDelta());
    if (this.feedAnim) this.updateFeed();
    else if (this.job) this.updatePrint();
    else this.updateIdle(dt);

    this.bar.position.z = this.gantry.z;
    this.carriage.position.set(this.gantry.x, 0, this.gantry.z);
    this.glow.position.x = this.gantry.x;
    this.glow.position.z = this.gantry.z;
    const printing = Boolean(this.job && this.job.phase === 'raster');
    const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 120);
    this.glow.material.opacity = printing ? 0.45 + pulse * 0.25 : 0.3;
    this.headLight.intensity = printing ? 18 : 10;
    this.led.material.emissive.setHex(printing ? 0x55ff88 : 0x6fe6ff);
    this.renderer.render(this.scene, this.camera);
  }

  updateIdle(dt) {
    const k = 1 - Math.exp(-dt * 3);
    this.gantry.x += (0 - this.gantry.x) * k;
    this.gantry.z += (HOME_Z - this.gantry.z) * k;
  }

  // ---- impression ------------------------------------------------------------------------

  startPrint(job, elapsed = 0) {
    if (this.job) this.finishPrint();
    if (this.feedAnim) this.finishFeed();
    const { rect } = job;
    const D = Math.max(2, job.duration);
    const approach = Math.min(0.9, D * 0.12);
    const back = Math.min(1.0, D * 0.12);
    const raster = D - approach - back;
    const passes = clamp(Math.round(raster / PASS_SECONDS), 6, 72);
    const anim = {
      job,
      rect,
      // horloge réelle : l'animation reste calée sur le serveur même si l'affichage rame
      start: performance.now() - clamp(elapsed, 0, D) * 1000,
      t: 0,
      D,
      approach,
      raster,
      back,
      passes,
      phase: 'approach',
      lastPass: -1,
      from: { ...this.gantry },
      x0: pageToWorldX(rect.x) - 0.15,
      x1: pageToWorldX(rect.x + rect.w) + 0.15,
      zA: pageToWorldZ(rect.y),
      zB: pageToWorldZ(rect.y + rect.h),
      uniforms: { uRows: { value: passes }, uRow: { value: -1 }, uProg: { value: 0 }, uDir: { value: 1 } },
      mesh: null,
      card: null,
      done: false,
    };
    this.job = anim;
    const page = this.page(0);
    renderCard(job, rect, page.canvas, TEX_SCALE, this.t).then((card) => {
      anim.card = card;
      if (anim.done) this.bake(page, card, rect);
      else this.attachCardMesh(anim, page);
    });
  }

  attachCardMesh(anim, page) {
    const { rect, card } = anim;
    const texture = new THREE.CanvasTexture(card);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = this.anisotropy;
    const material = new THREE.MeshStandardMaterial({
      map: texture,
      roughness: 1,
      metalness: 0,
      envMapIntensity: 0.35,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    material.customProgramCacheKey = () => 'print-reveal';
    material.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, anim.uniforms);
      shader.fragmentShader =
        'uniform float uRows;\nuniform float uRow;\nuniform float uProg;\nuniform float uDir;\n' +
        shader.fragmentShader.replace(
          '#include <clipping_planes_fragment>',
          `#include <clipping_planes_fragment>
          {
            float rowF = (1.0 - vMapUv.y) * uRows;
            float row = floor(rowF);
            if (row > uRow + 0.5) discard;
            if (abs(row - uRow) < 0.5) {
              float x = uDir > 0.0 ? vMapUv.x : 1.0 - vMapUv.x;
              float n = fract(sin(dot(floor(vMapUv * vec2(260.0, 120.0)), vec2(12.9898, 78.233))) * 43758.5453);
              if (x > uProg + n * 0.015) discard;
            }
          }`
        );
    };
    const w = (rect.w / PAGE_W) * PW;
    const h = (rect.h / PAGE_H) * PL;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), material);
    mesh.position.set(pageToWorldX(rect.x) + w / 2, PL / 2 - (rect.y / PAGE_H) * PL - h / 2, 0.004);
    mesh.receiveShadow = true;
    page.mesh.add(mesh);
    anim.mesh = mesh;
  }

  updatePrint() {
    const a = this.job;
    a.t = (performance.now() - a.start) / 1000;
    const { approach, raster, passes } = a;
    const passT = raster / passes;
    const rowZ = (k) => a.zA + ((k + 0.5) / passes) * (a.zB - a.zA);

    if (a.t < approach) {
      a.phase = 'approach';
      const p = ease(a.t / approach);
      this.gantry.x = lerp(a.from.x, a.x0, p);
      this.gantry.z = lerp(a.from.z, rowZ(0), p);
      a.uniforms.uRow.value = -1;
    } else if (a.t < approach + raster) {
      a.phase = 'raster';
      const tr = a.t - approach;
      const k = Math.min(passes - 1, Math.floor(tr / passT));
      const f = clamp((tr - k * passT) / passT, 0, 1);
      const dir = k % 2 === 0 ? 1 : -1;
      this.gantry.x = dir > 0 ? lerp(a.x0, a.x1, f) : lerp(a.x1, a.x0, f);
      // la barre glisse d'une rangée à l'autre pendant le demi-tour du chariot
      const step = clamp(f / 0.18, 0, 1);
      this.gantry.z = k === 0 ? rowZ(0) : lerp(rowZ(k - 1), rowZ(k), ease(step));
      a.uniforms.uRow.value = k;
      a.uniforms.uProg.value = (f * (a.x1 - a.x0) - 0.15) / (a.x1 - a.x0 - 0.3);
      a.uniforms.uDir.value = dir;
      if (k !== a.lastPass) {
        a.lastPass = k;
        this.onPass(passT);
      }
    } else if (a.t < a.D) {
      if (a.phase !== 'back') {
        a.phase = 'back';
        a.from = { ...this.gantry };
        a.uniforms.uRow.value = passes + 1;
      }
      const p = ease((a.t - approach - raster) / a.back);
      this.gantry.x = lerp(a.from.x, 0, p);
      this.gantry.z = lerp(a.from.z, HOME_Z, p);
    } else {
      this.finishPrint();
    }
  }

  // Termine l'impression en cours (normalement ou parce qu'une autre commence).
  finishPrint() {
    const a = this.job;
    if (!a) return;
    this.job = null;
    a.done = true;
    a.uniforms.uRow.value = a.passes + 1;
    if (a.mesh) {
      a.mesh.parent?.remove(a.mesh);
      a.mesh.geometry.dispose();
      a.mesh.material.map?.dispose();
      a.mesh.material.dispose();
    }
    if (a.card) this.bake(this.page(0), a.card, a.rect);
    this.onPrintEnd(a.job);
  }

  bake(page, card, rect) {
    page.ctx.drawImage(card, Math.round(rect.x * TEX_SCALE), Math.round(rect.y * TEX_SCALE));
    page.texture.needsUpdate = true;
  }

  // ---- avance papier -----------------------------------------------------------------------

  startFeed(duration, elapsed = 0) {
    if (this.job) this.finishPrint();
    if (this.feedAnim) this.finishFeed();
    const d = Math.max(0.3, duration);
    this.feedAnim = { start: performance.now() - clamp(elapsed, 0, d) * 1000, t: 0, d, from: { ...this.gantry } };
    this.onFeed(duration);
  }

  updateFeed() {
    const f = this.feedAnim;
    f.t = (performance.now() - f.start) / 1000;
    const p = ease(clamp(f.t / f.d, 0, 1));
    this.paperGroup.position.z = p * PL;
    const g = ease(clamp(f.t / (f.d * 0.4), 0, 1));
    this.gantry.x = lerp(f.from.x, 0, g);
    this.gantry.z = lerp(f.from.z, HOME_Z, g);
    if (f.t >= f.d) this.finishFeed();
  }

  finishFeed() {
    this.feedAnim = null;
    // la page la plus ancienne est recyclée en page vierge sous le caisson
    for (const page of this.pages) page.index++;
    const old = this.pages.find((p) => p.index === 3);
    old.index = -1;
    this.clearPage(old);
    this.paperGroup.position.z = 0;
    for (const page of this.pages) this.placePage(page);
  }

  clearPage(page) {
    page.ctx.drawImage(this.blank, 0, 0);
    page.texture.needsUpdate = true;
  }

  clearAll() {
    for (const page of this.pages) this.clearPage(page);
  }

  // Redessine instantanément les pages déjà imprimées (overlay rechargé en plein live).
  async restore(pages) {
    const token = ++this.restoreToken;
    this.clearAll();
    await Promise.all(
      pages.slice(0, 3).map(async (items, index) => {
        const page = this.page(index);
        for (const item of items || []) {
          const card = await renderCard(item, item.rect, page.canvas, TEX_SCALE, this.t);
          if (token !== this.restoreToken) return;
          this.bake(page, card, item.rect);
        }
      })
    );
  }
}
