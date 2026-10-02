import * as THREE from 'three';
import './styles.css';

type SectorColor = 'gray' | 'red' | 'blue' | 'green' | 'violet';
type PlayColor = Exclude<SectorColor, 'gray'>;
type BonusColor = PlayColor | 'gold';
type RunPhase = 'playing' | 'results';

interface Config {
  floors: number;
  towerRotationSpeed: number;
  starSpawnRate: number;
  cloudSpawnRate: number;
  goldStarChance: number;
  gravity: number;
  bounceForce: number;
}

interface FloorData {
  group: THREE.Group;
  y: number;
  colors: SectorColor[];
  broken: boolean;
}

interface Pickup {
  group: THREE.Group;
  color: BonusColor;
  velocity: THREE.Vector3;
  radius: number;
}

interface Cloud {
  group: THREE.Group;
  velocity: THREE.Vector3;
  radius: number;
}

interface Character {
  name: string;
  body: number;
  accent: number;
  head: number;
}

interface RunStats {
  run: number;
  character: string;
  score: number;
  time: number;
  brokenFloors: number;
  stars: number;
  goldStars: number;
  combo: number;
  maxCombo: number;
  colorBreaks: number;
}

const SECTOR_COLORS: PlayColor[] = ['red', 'blue', 'green', 'violet'];
const COLOR_HEX: Record<SectorColor | 'gold', number> = {
  gray: 0x9ba3af,
  red: 0xef4444,
  blue: 0x38bdf8,
  green: 0x22c55e,
  violet: 0xa855f7,
  gold: 0xfbbf24,
};

const CHARACTERS: Character[] = [
  { name: 'Space Courier', body: 0xf8fafc, accent: 0xf97316, head: 0xffd6a5 },
  { name: 'Spring Robot', body: 0x94a3b8, accent: 0x22d3ee, head: 0xcbd5e1 },
  { name: 'Tiny Ninja', body: 0x111827, accent: 0xef4444, head: 0xf8d4b0 },
  { name: 'Super Jumper', body: 0x2563eb, accent: 0xfacc15, head: 0xffd6a5 },
  { name: 'Chef Hopper', body: 0xffffff, accent: 0xdc2626, head: 0xffd6a5 },
  { name: 'Office Hero', body: 0x475569, accent: 0x0ea5e9, head: 0xf1c27d },
  { name: 'Alien Tourist', body: 0x84cc16, accent: 0xfbbf24, head: 0xa3e635 },
  { name: 'Rookie Mage', body: 0x7c3aed, accent: 0xf59e0b, head: 0xffd6a5 },
];

function readConfig(): Config {
  const params = new URLSearchParams(window.location.search);
  const numberParam = (name: string, fallback: number) => {
    const value = params.get(name);
    if (!value) return fallback;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  return {
    floors: Math.max(1, Math.floor(numberParam('floors', numberParam('N', 100)))),
    towerRotationSpeed: numberParam('speed', 1.15),
    starSpawnRate: numberParam('stars', 0.85),
    cloudSpawnRate: numberParam('clouds', 0.28),
    goldStarChance: numberParam('gold', 0.12),
    gravity: numberParam('gravity', 12.5),
    bounceForce: numberParam('bounce', 8.9),
  };
}

function makeSectorGeometry(innerRadius: number, outerRadius: number, startAngle: number, endAngle: number) {
  const segments = 18;
  const vertices: number[] = [];
  const indices: number[] = [];

  for (let i = 0; i <= segments; i += 1) {
    const t = startAngle + (endAngle - startAngle) * (i / segments);
    vertices.push(Math.cos(t) * innerRadius, 0, Math.sin(t) * innerRadius);
    vertices.push(Math.cos(t) * outerRadius, 0, Math.sin(t) * outerRadius);
  }

  for (let i = 0; i < segments; i += 1) {
    const a = i * 2;
    indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function makeStarGeometry(radius = 0.22) {
  const shape = new THREE.Shape();
  const points = 10;
  for (let i = 0; i <= points; i += 1) {
    const angle = Math.PI / 2 + (i / points) * Math.PI * 2;
    const r = i % 2 === 0 ? radius : radius * 0.45;
    const x = Math.cos(angle) * r;
    const y = Math.sin(angle) * r;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  return new THREE.ShapeGeometry(shape);
}

function shuffle<T>(items: T[]) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

class YTTowerGame {
  private readonly config = readConfig();
  private readonly app = document.querySelector<HTMLDivElement>('#app')!;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 160);
  private readonly renderer = new THREE.WebGLRenderer({ antialias: true });
  private readonly tower = new THREE.Group();
  private readonly pickups = new THREE.Group();
  private readonly clouds = new THREE.Group();
  private readonly clock = new THREE.Clock();
  private readonly floorSpacing = 0.46;
  private readonly towerRadius = 1.55;
  private readonly jumperRadius = 0.26;
  private readonly hud = document.createElement('div');
  private readonly results = document.createElement('div');
  private readonly activeBonus = document.createElement('div');

  private floors: FloorData[] = [];
  private stars: Pickup[] = [];
  private cloudItems: Cloud[] = [];
  private jumper = new THREE.Group();
  private character: Character = CHARACTERS[0];
  private phase: RunPhase = 'playing';
  private runNumber = 0;
  private runStart = performance.now();
  private resultStart = 0;
  private velocityY = 0;
  private jumperY = 1.5;
  private brokenFloors = 0;
  private score = 0;
  private caughtStars = 0;
  private caughtGoldStars = 0;
  private combo = 0;
  private maxCombo = 0;
  private colorBreaks = 0;
  private bonus: BonusColor | null = null;
  private slowed = false;
  private bestTime = Number(localStorage.getItem('yttower.bestTime') ?? Number.POSITIVE_INFINITY);

  constructor() {
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.app.append(this.renderer.domElement);

    this.hud.className = 'hud';
    this.results.className = 'results hidden';
    this.activeBonus.className = 'active-bonus';
    document.body.append(this.hud, this.results, this.activeBonus);

    this.scene.background = new THREE.Color(0xbfe7ff);
    this.scene.fog = new THREE.Fog(0xbfe7ff, 10, 42);
    this.scene.add(this.tower, this.pickups, this.clouds);

    this.setupLights();
    this.setupSkyline();
    window.addEventListener('resize', () => this.resize());
    this.startRun();
    this.animate();
  }

  private setupLights() {
    const ambient = new THREE.HemisphereLight(0xffffff, 0x8fb2cf, 1.85);
    const sun = new THREE.DirectionalLight(0xffffff, 2.4);
    sun.position.set(4, 7, 5);
    sun.castShadow = true;
    this.scene.add(ambient, sun);
  }

  private setupSkyline() {
    const base = new THREE.Group();
    for (let i = 0; i < 32; i += 1) {
      const width = 0.35 + Math.random() * 0.75;
      const height = 1 + Math.random() * 4.8;
      const box = new THREE.Mesh(
        new THREE.BoxGeometry(width, height, width),
        new THREE.MeshLambertMaterial({ color: i % 2 ? 0x80b7ce : 0x6aa7c2 }),
      );
      const angle = (i / 32) * Math.PI * 2;
      const radius = 10 + Math.random() * 7;
      box.position.set(Math.cos(angle) * radius, -height * 0.5 - 2.5, Math.sin(angle) * radius);
      box.rotation.y = -angle;
      base.add(box);
    }
    this.scene.add(base);
  }

  private startRun() {
    this.phase = 'playing';
    this.runNumber += 1;
    this.runStart = performance.now();
    this.velocityY = -1;
    this.jumperY = 1.7;
    this.brokenFloors = 0;
    this.score = 0;
    this.caughtStars = 0;
    this.caughtGoldStars = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.colorBreaks = 0;
    this.bonus = null;
    this.slowed = false;
    this.results.classList.add('hidden');
    this.character = CHARACTERS[Math.floor(Math.random() * CHARACTERS.length)];

    this.clearGroup(this.tower);
    this.clearGroup(this.pickups);
    this.clearGroup(this.clouds);
    this.stars = [];
    this.cloudItems = [];
    this.floors = [];

    this.buildTower();
    this.buildJumper();
  }

  private buildTower() {
    const sectorSize = Math.PI / 2;
    const grayIndex = Math.floor(Math.random() * 4);
    for (let i = 0; i < this.config.floors; i += 1) {
      const group = new THREE.Group();
      group.position.y = -i * this.floorSpacing;
      const floorColors: SectorColor[] = shuffle(SECTOR_COLORS).slice(0, 4);
      floorColors[grayIndex] = 'gray';

      for (let s = 0; s < 4; s += 1) {
        const color = floorColors[s];
        const sector = new THREE.Mesh(
          makeSectorGeometry(0.32, this.towerRadius, s * sectorSize, (s + 1) * sectorSize - 0.03),
          new THREE.MeshToonMaterial({ color: COLOR_HEX[color], side: THREE.DoubleSide }),
        );
        sector.castShadow = true;
        sector.receiveShadow = true;
        group.add(sector);
      }

      const rim = new THREE.Mesh(
        new THREE.TorusGeometry(this.towerRadius, 0.015, 8, 80),
        new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.65 }),
      );
      rim.rotation.x = Math.PI / 2;
      group.add(rim);

      this.tower.add(group);
      this.floors.push({ group, y: group.position.y, colors: floorColors, broken: false });
    }
  }

  private buildJumper() {
    this.scene.remove(this.jumper);
    this.jumper = new THREE.Group();

    const bodyMaterial = new THREE.MeshToonMaterial({ color: this.character.body });
    const accentMaterial = new THREE.MeshToonMaterial({ color: this.character.accent });
    const skinMaterial = new THREE.MeshToonMaterial({ color: this.character.head });
    const blackMaterial = new THREE.MeshToonMaterial({ color: 0x111827 });

    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.18, 0.34, 6, 12), bodyMaterial);
    body.position.y = 0.08;
    body.castShadow = true;

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.19, 18, 18), skinMaterial);
    head.position.y = 0.48;
    head.castShadow = true;

    const belt = new THREE.Mesh(new THREE.TorusGeometry(0.185, 0.018, 8, 24), accentMaterial);
    belt.position.y = 0.13;
    belt.rotation.x = Math.PI / 2;

    const footA = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 12), accentMaterial);
    const footB = footA.clone();
    footA.position.set(-0.11, -0.25, 0.03);
    footB.position.set(0.11, -0.25, 0.03);

    const eyeA = new THREE.Mesh(new THREE.SphereGeometry(0.028, 8, 8), blackMaterial);
    const eyeB = eyeA.clone();
    eyeA.position.set(-0.065, 0.52, 0.16);
    eyeB.position.set(0.065, 0.52, 0.16);

    this.jumper.add(body, head, belt, footA, footB, eyeA, eyeB);
    this.scene.add(this.jumper);
  }

  private animate() {
    requestAnimationFrame(() => this.animate());
    const dt = Math.min(this.clock.getDelta(), 0.033);
    this.update(dt);
    this.renderer.render(this.scene, this.camera);
  }

  private update(dt: number) {
    if (this.phase === 'playing') {
      this.tower.rotation.y += this.config.towerRotationSpeed * dt;
      this.updateJumper(dt);
      this.spawnPickups(dt);
      this.updatePickups(dt);
      this.updateClouds(dt);
      this.updateHud();
      if (this.brokenFloors >= this.config.floors) {
        this.finishRun();
      }
    } else if (performance.now() - this.resultStart > 5000) {
      this.startRun();
    }

    this.updateCamera();
  }

  private updateJumper(dt: number) {
    const fallMultiplier = this.velocityY < 0 && this.slowed ? 0.5 : 1;
    this.velocityY -= this.config.gravity * fallMultiplier * dt;
    this.jumperY += this.velocityY * dt * fallMultiplier;
    this.jumper.position.set(0, this.jumperY, this.towerRadius + 0.38);
    this.jumper.rotation.y = Math.sin(performance.now() * 0.004) * 0.16;
    this.jumper.scale.y = THREE.MathUtils.lerp(this.jumper.scale.y, this.velocityY > 0 ? 1.06 : 0.96, 0.12);
    this.jumper.scale.x = THREE.MathUtils.lerp(this.jumper.scale.x, this.velocityY > 0 ? 0.96 : 1.04, 0.12);
    this.jumper.scale.z = this.jumper.scale.x;
    this.checkFloorCollision();
    this.updateBonusBadge();
  }

  private checkFloorCollision() {
    if (this.velocityY >= 0) return;
    const floor = this.floors.find((candidate) => !candidate.broken && this.jumperY <= candidate.y + 0.18);
    if (!floor) return;

    this.slowed = false;
    const color = this.getContactColor(floor);
    const canBreak = color === 'gray' || this.bonus === color || this.bonus === 'gold';

    if (canBreak) {
      floor.broken = true;
      floor.group.visible = false;
      this.brokenFloors += 1;
      this.combo += 1;
      this.maxCombo = Math.max(this.maxCombo, this.combo);
      this.score += 10 + Math.floor(this.combo * 4);
      if (color !== 'gray') {
        this.colorBreaks += 1;
        this.score += 25;
        this.bonus = null;
      } else if (this.bonus === 'gold') {
        this.bonus = null;
      }
      this.popBreakEffect(floor.y, color);
      return;
    }

    this.combo = 0;
    this.velocityY = this.config.bounceForce;
    this.jumperY = floor.y + 0.42;
    this.popBounceEffect(floor.y, color);
  }

  private getContactColor(floor: FloorData): SectorColor {
    const worldAngle = Math.PI / 2;
    const localAngle = THREE.MathUtils.euclideanModulo(worldAngle - this.tower.rotation.y, Math.PI * 2);
    const sector = Math.floor(localAngle / (Math.PI / 2)) % 4;
    return floor.colors[sector];
  }

  private spawnPickups(dt: number) {
    if (Math.random() < this.config.starSpawnRate * dt) this.createStar();
    if (Math.random() < this.config.cloudSpawnRate * dt) this.createCloud();
  }

  private createStar() {
    const isGold = Math.random() < this.config.goldStarChance;
    const color: BonusColor = isGold ? 'gold' : SECTOR_COLORS[Math.floor(Math.random() * SECTOR_COLORS.length)];
    const material = new THREE.MeshToonMaterial({
      color: COLOR_HEX[color],
      emissive: COLOR_HEX[color],
      emissiveIntensity: color === 'gold' ? 0.65 : 0.2,
      side: THREE.DoubleSide,
    });
    const star = new THREE.Mesh(makeStarGeometry(color === 'gold' ? 0.26 : 0.21), material);
    const group = new THREE.Group();
    group.add(star);
    group.position.set((Math.random() > 0.5 ? -1 : 1) * (2.9 + Math.random() * 1.2), this.jumperY + 1 + Math.random() * 2.6, this.towerRadius + 0.5 + Math.random() * 0.7);
    this.pickups.add(group);
    this.stars.push({
      group,
      color,
      velocity: new THREE.Vector3(group.position.x > 0 ? -1.4 : 1.4, -0.2 - Math.random() * 0.25, 0),
      radius: 0.34,
    });
  }

  private createCloud() {
    const cloud = new THREE.Group();
    const material = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.72 });
    for (let i = 0; i < 5; i += 1) {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(0.18 + Math.random() * 0.18, 12, 12), material);
      puff.position.set((i - 2) * 0.17, Math.random() * 0.1, Math.random() * 0.08);
      cloud.add(puff);
    }
    cloud.position.set((Math.random() > 0.5 ? -1 : 1) * (3.1 + Math.random() * 1.4), this.jumperY + 0.4 + Math.random() * 2.2, this.towerRadius + 0.45);
    this.clouds.add(cloud);
    this.cloudItems.push({
      group: cloud,
      velocity: new THREE.Vector3(cloud.position.x > 0 ? -0.55 : 0.55, -0.08, 0),
      radius: 0.55,
    });
  }

  private updatePickups(dt: number) {
    this.stars = this.stars.filter((star) => {
      star.group.position.addScaledVector(star.velocity, dt);
      star.group.rotation.z += dt * 4;
      star.group.quaternion.copy(this.camera.quaternion);
      star.group.rotateZ(performance.now() * 0.004);

      if (star.group.position.distanceTo(this.jumper.position) < star.radius + this.jumperRadius) {
        this.bonus = star.color;
        this.caughtStars += 1;
        this.score += star.color === 'gold' ? 50 : 15;
        if (star.color === 'gold') this.caughtGoldStars += 1;
        this.pickups.remove(star.group);
        return false;
      }

      if (Math.abs(star.group.position.x) > 5 || star.group.position.y < this.jumperY - 4) {
        this.pickups.remove(star.group);
        return false;
      }
      return true;
    });
  }

  private updateClouds(dt: number) {
    this.cloudItems = this.cloudItems.filter((cloud) => {
      cloud.group.position.addScaledVector(cloud.velocity, dt);

      if (cloud.group.position.distanceTo(this.jumper.position) < cloud.radius + this.jumperRadius) {
        this.slowed = true;
        this.clouds.remove(cloud.group);
        return false;
      }

      if (Math.abs(cloud.group.position.x) > 5 || cloud.group.position.y < this.jumperY - 4) {
        this.clouds.remove(cloud.group);
        return false;
      }
      return true;
    });
  }

  private finishRun() {
    this.phase = 'results';
    this.resultStart = performance.now();
    const time = (this.resultStart - this.runStart) / 1000;
    if (time < this.bestTime) {
      this.bestTime = time;
      localStorage.setItem('yttower.bestTime', String(time));
    }

    const stats: RunStats = {
      run: this.runNumber,
      character: this.character.name,
      score: this.score,
      time,
      brokenFloors: this.brokenFloors,
      stars: this.caughtStars,
      goldStars: this.caughtGoldStars,
      combo: this.combo,
      maxCombo: this.maxCombo,
      colorBreaks: this.colorBreaks,
    };
    this.showResults(stats);
  }

  private showResults(stats: RunStats) {
    this.results.innerHTML = `
      <div class="results-panel">
        <div class="label">Run #${stats.run}</div>
        <h1>${stats.time.toFixed(2)}s</h1>
        <div class="result-grid">
          <span>Character</span><strong>${stats.character}</strong>
          <span>Floors</span><strong>${stats.brokenFloors}/${this.config.floors}</strong>
          <span>Score</span><strong>${stats.score}</strong>
          <span>Stars</span><strong>${stats.stars}</strong>
          <span>Gold</span><strong>${stats.goldStars}</strong>
          <span>Max combo</span><strong>${stats.maxCombo}</strong>
          <span>Color breaks</span><strong>${stats.colorBreaks}</strong>
          <span>Best</span><strong>${Number.isFinite(this.bestTime) ? `${this.bestTime.toFixed(2)}s` : '-'}</strong>
        </div>
      </div>
    `;
    this.results.classList.remove('hidden');
  }

  private updateHud() {
    const time = (performance.now() - this.runStart) / 1000;
    const bonusText = this.bonus ? this.bonus.toUpperCase() : 'NONE';
    this.hud.innerHTML = `
      <div class="hud-row">
        <div><span>TIME</span><strong>${time.toFixed(2)}</strong></div>
        <div><span>FLOORS</span><strong>${this.brokenFloors}/${this.config.floors}</strong></div>
        <div><span>SCORE</span><strong>${this.score}</strong></div>
        <div><span>COMBO</span><strong>${this.combo}</strong></div>
        <div><span>BONUS</span><strong>${bonusText}</strong></div>
        <div><span>RUN</span><strong>#${this.runNumber}</strong></div>
      </div>
    `;
  }

  private updateBonusBadge() {
    if (!this.bonus) {
      this.activeBonus.classList.add('hidden');
      return;
    }

    this.activeBonus.classList.remove('hidden');
    this.activeBonus.style.borderColor = `#${COLOR_HEX[this.bonus].toString(16).padStart(6, '0')}`;
    this.activeBonus.style.background = `#${COLOR_HEX[this.bonus].toString(16).padStart(6, '0')}`;
  }

  private popBreakEffect(y: number, color: SectorColor) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.55, 0.018, 8, 32),
      new THREE.MeshBasicMaterial({ color: COLOR_HEX[color], transparent: true, opacity: 0.8 }),
    );
    ring.position.set(0, y + 0.02, this.towerRadius + 0.12);
    ring.rotation.x = Math.PI / 2;
    this.scene.add(ring);
    setTimeout(() => this.scene.remove(ring), 180);
  }

  private popBounceEffect(y: number, color: SectorColor) {
    const burst = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 12, 12),
      new THREE.MeshBasicMaterial({ color: COLOR_HEX[color], transparent: true, opacity: 0.9 }),
    );
    burst.position.set(0, y + 0.28, this.towerRadius + 0.3);
    this.scene.add(burst);
    setTimeout(() => this.scene.remove(burst), 160);
  }

  private updateCamera() {
    const targetY = this.jumperY - 0.3;
    this.camera.position.lerp(new THREE.Vector3(4.8, targetY + 2.2, 6.7), 0.08);
    this.camera.lookAt(0, targetY, 0);
  }

  private resize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  private clearGroup(group: THREE.Group) {
    while (group.children.length) {
      group.remove(group.children[0]);
    }
  }
}

new YTTowerGame();
