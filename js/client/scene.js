// Renderer, sky, lights, camera and post-processing.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

export const S = 0.01; // 100 WC3 units = 1 scene metre
export const toV = (x, y, z = 0) => new THREE.Vector3(x * S, z * S, -y * S);

export function createScene(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xbfe9ff, 30, 70);

  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 200);

  // sky dome: vertical gradient with a soft sun glow
  const skyU = { top: { value: new THREE.Color(0x5bc4ff) }, mid: { value: new THREE.Color(0xbfe9ff) }, bot: { value: new THREE.Color(0xffd6ec) }, sunDir: { value: new THREE.Vector3(0.4, 0.5, -0.7).normalize() }, night: { value: 0 } };
  const sky = new THREE.Mesh(new THREE.SphereGeometry(120, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false, uniforms: skyU,
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
    fragmentShader: `varying vec3 vP; uniform vec3 top, mid, bot, sunDir; uniform float night;
      void main(){ float h = vP.y; vec3 c = h > 0. ? mix(mid, top, smoothstep(0., .6, h)) : mix(mid, bot, smoothstep(0., .5, -h));
        float s = max(dot(vP, sunDir), 0.); c += vec3(1.,.95,.8) * pow(s, 60.) * (1.-night) * 1.2 + vec3(1.,.8,.9) * pow(s, 6.) * .15;
        vec3 n = mix(vec3(.10,.08,.28), vec3(.24,.18,.48), smoothstep(-.3,.8,h));
        float star = step(.9985, fract(sin(dot(floor(vP*220.), vec3(12.9898,78.233,37.719)))*43758.5453));
        n += star * .9 * smoothstep(0.,.3,h);
        gl_FragColor = vec4(mix(c, n, night), 1.); }`,
  }));
  sky.renderOrder = -1;
  scene.add(sky);

  const hemi = new THREE.HemisphereLight(0xffffff, 0xffb3d6, 1.0);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff3dd, 2.3);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -14; sun.shadow.camera.right = 14; sun.shadow.camera.top = 14; sun.shadow.camera.bottom = -14;
  sun.shadow.camera.near = 1; sun.shadow.camera.far = 60;
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02; sun.shadow.radius = 4;
  scene.add(sun); scene.add(sun.target);

  // fluffy clouds floating below and around the arena
  const clouds = new THREE.Group();
  const cloudMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, emissive: 0xffffff, emissiveIntensity: 0.25 });
  const puff = new THREE.SphereGeometry(1, 16, 12);
  for (let i = 0; i < 26; i++) {
    const c = new THREE.Group();
    const n = 3 + (i % 4);
    for (let k = 0; k < n; k++) { const m = new THREE.Mesh(puff, cloudMat); m.position.set((k - n / 2) * 1.1, Math.sin(k * 2.1) * 0.35, Math.cos(k * 1.7) * 0.5); const s = 0.9 + ((k * 37) % 7) / 10; m.scale.set(s, s * 0.75, s); c.add(m); }
    const a = (i / 26) * Math.PI * 2, r = 20 + (i % 5) * 6;
    c.position.set(Math.cos(a) * r, -5 - (i % 3) * 3, Math.sin(a) * r);
    c.scale.setScalar(1 + (i % 3) * 0.5);
    c.userData.spd = 0.02 + (i % 5) * 0.01;
    clouds.add(c);
  }
  scene.add(clouds);

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.45, 0.55, 0.86);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  const resize = () => {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false); composer.setSize(w, h);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    bloom.resolution.set(w / 2, h / 2);
  };
  window.addEventListener('resize', resize); resize();

  // camera rig: frames a WC3 rect, optionally following a unit
  const rig = { target: new THREE.Vector3(), dist: 14, want: new THREE.Vector3(), wantDist: 14, shake: 0 };
  const PITCH = 56 * Math.PI / 180;
  function frame(rect, follow, dt, snap, uncapped) {
    const w = (rect.x1 - rect.x0) * S, h = (rect.y1 - rect.y0) * S;
    const fov = camera.fov * Math.PI / 180, aspect = camera.aspect;
    const fitH = (h * Math.sin(PITCH) + 1.2) / 2 / Math.tan(fov / 2) * 1.05;
    const fitW = (w + 1.2) / 2 / Math.tan(fov / 2) / aspect * 1.05;
    let d = Math.max(fitH, fitW), cx = (rect.x0 + rect.x1) / 2 * S, cz = -(rect.y0 + rect.y1) / 2 * S;
    const maxD = aspect < 1 ? 24 : 19;
    if (d > maxD && follow) {
      d = maxD;
      const viewH = 2 * d * Math.tan(fov / 2) / Math.sin(PITCH), viewW = 2 * d * Math.tan(fov / 2) * aspect;
      const fx = follow.x * S, fz = -follow.y * S + 0.6;
      const hx = Math.max(0, (w - viewW) / 2 + 1.2), hz = Math.max(0, (h - viewH * 0.75) / 2 + 1.2);
      cx = Math.min(cx + hx, Math.max(cx - hx, fx));
      cz = Math.min(cz + hz, Math.max(cz - hz, fz));
    } else if (!uncapped) d = Math.min(d, maxD * 1.25);
    rig.want.set(cx, 0, cz); rig.wantDist = d;
    const k = snap ? 1 : 1 - Math.exp(-dt * 4);
    rig.target.lerp(rig.want, k); rig.dist += (rig.wantDist - rig.dist) * k;
    const sh = rig.shake;
    camera.position.set(rig.target.x + (Math.random() - 0.5) * sh, rig.target.y + Math.sin(PITCH) * rig.dist + (Math.random() - 0.5) * sh, rig.target.z + Math.cos(PITCH) * rig.dist);
    camera.lookAt(rig.target);
    sun.position.set(rig.target.x + 8, 18, rig.target.z + 6); sun.target.position.copy(rig.target);
    scene.fog.near = rig.dist + 6; scene.fog.far = rig.dist + 55;
    sky.position.copy(camera.position); clouds.position.set(rig.target.x, 0, rig.target.z);
  }

  function setNight(n) {
    skyU.night.value = n;
    hemi.intensity = 1.0 - n * 0.6; hemi.color.setRGB(1 - n * 0.4, 1 - n * 0.35, 1);
    sun.intensity = 2.3 - n * 1.9; sun.color.setRGB(1 - n * 0.35, 0.95 - n * 0.2, 0.87 + n * 0.1);
    scene.fog.color.setRGB(0.75 - n * 0.6, 0.91 - n * 0.75, 1 - n * 0.65);
    bloom.strength = 0.45 + n * 0.5;
    renderer.toneMappingExposure = 1.0 + n * 0.1;
  }

  function setSky(top, mid, bot) { skyU.top.value.set(top); skyU.mid.value.set(mid); skyU.bot.value.set(bot); }
  return { setSky, THREE, renderer, scene, camera, composer, rig, frame, setNight, clouds, sun, hemi, bloom };
}
