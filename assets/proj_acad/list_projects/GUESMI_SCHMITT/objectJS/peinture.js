"use strict";

import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { Reflector } from "three/addons/objects/Reflector.js";
import { GUI } from "three/addons/libs/lil-gui.module.min.js";

import { addWall } from "./wall.js";
import { addTable } from "./table.js";
import { addTableProps } from "./props.js";
import { addCandleLight } from "./candle.js";
import { loadHelmet, updateHelmetReflection } from "./greathelm.js";
import { loadWineGlass } from "./wine_glass.js";
import { addSword } from "./sword.js";
import { makeSkyboxCubeTexture, makeWoodSet, makeFloorSet } from "./proceduralTextures.js";

let camera, renderer;
let cameraControls;
const scene = new THREE.Scene();
const clock = new THREE.Clock();
const updaters = [];
let candle, fog, ambientLight, directionalLight, stillLifeSpot, rimLight, skyLight, mirrorGroup;
let dustPoints, dustGeom;
let dustToggleController; // contrôleur lil-gui à synchroniser avec le bouton HUD
let vignetteScene, vignetteCamera, vignetteMesh, vignetteUniforms;
let sceneTarget, oilScene, oilCamera, oilMesh, oilUniforms;
let oilToggleController;

const params = {
    candleIntensity: 46,
    fogDensity: 0.024,
    fogColor: "#1a1008",
    ambient: 0.32,
    spotIntensity: 3.2,
    rimIntensity: 0.85,
    skyIntensity: 4.5,
    skyColor: "#3a78ff",
    exposure: 1.35,
    vignetteStrength: 0.60,
    vignetteSoftness: 0.85,
    rotateScene: true,
    showMirror: true,
    showDust: true,
    dustIntensity: 1.0,
    oilPaint: true,
    oilIntensity: 0.85,
    oilRadius: 4,
    bgColor: "#0a0604"
};

function fillScene() {
    // Skybox sombre/chaude → envMap pour les reflets du casque
    const procSky = makeSkyboxCubeTexture(256);
    scene.environment = procSky;
    scene.environmentIntensity = 0.55;
    scene.background = new THREE.Color(params.bgColor);

    fog = new THREE.FogExp2(new THREE.Color(params.fogColor).getHex(), params.fogDensity);
    scene.fog = fog;

    ambientLight = new THREE.AmbientLight(0xffb060, params.ambient);
    scene.add(ambientLight);

    // Frustum resserré sur la nature morte → shadowmap plus précise
    directionalLight = new THREE.DirectionalLight(0xffb070, 0.18);
    directionalLight.position.set(-5, 13, 7);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.set(2048, 2048);
    directionalLight.shadow.camera.left = -8;
    directionalLight.shadow.camera.right = 8;
    directionalLight.shadow.camera.top = 10;
    directionalLight.shadow.camera.bottom = -2;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 28;
    directionalLight.shadow.bias = -0.0004;
    directionalLight.shadow.normalBias = 0.035;
    directionalLight.shadow.radius = 6;
    directionalLight.shadow.blurSamples = 24;
    scene.add(directionalLight);

    // Spot principal du clair-obscur, chaud et serré sur le casque
    stillLifeSpot = new THREE.SpotLight(0xff9540, params.spotIntensity, 24, Math.PI / 11, 0.50, 1.9);
    stillLifeSpot.position.set(-2.2, 11.0, 3.5);
    stillLifeSpot.target.position.set(0.6, 5.5, -1.6);
    stillLifeSpot.castShadow = true;
    stillLifeSpot.shadow.mapSize.set(2048, 2048);
    stillLifeSpot.shadow.bias = -0.0004;
    stillLifeSpot.shadow.normalBias = 0.025;
    stillLifeSpot.shadow.camera.near = 0.5;
    stillLifeSpot.shadow.camera.far = 22;
    stillLifeSpot.shadow.radius = 8;
    stillLifeSpot.shadow.blurSamples = 32;
    scene.add(stillLifeSpot, stillLifeSpot.target);

    // Rim arrière — détache la silhouette du casque sur le fond sombre
    rimLight = new THREE.SpotLight(0xff5418, params.rimIntensity, 14, Math.PI / 7, 0.7, 1.3);
    rimLight.position.set(2.5, 8.5, -5.0);
    rimLight.target.position.set(0.5, 5.6, -1.6);
    scene.add(rimLight, rimLight.target);

    // Spot bleu froid à droite — effet vitrail, éclaire la moitié droite
    skyLight = new THREE.SpotLight(
        new THREE.Color(params.skyColor),
        params.skyIntensity,
        32,
        Math.PI / 4.2,
        0.55,
        1.2
    );
    skyLight.position.set(13, 11, 2.5);
    skyLight.target.position.set(0.5, 5.5, -2);
    skyLight.castShadow = true;
    skyLight.shadow.mapSize.set(2048, 2048);
    skyLight.shadow.bias = -0.0005;
    skyLight.shadow.normalBias = 0.025;
    skyLight.shadow.camera.near = 0.5;
    skyLight.shadow.camera.far = 30;
    skyLight.shadow.radius = 10;
    skyLight.shadow.blurSamples = 32;
    scene.add(skyLight, skyLight.target);

    addWall(scene);
    addTable(scene);
    addTableProps(scene);

    candle = addCandleLight(scene);
    if (candle && candle.update) updaters.push(candle.update);
    if (candle && candle.setBaseIntensity) candle.setBaseIntensity(params.candleIntensity);

    loadHelmet(scene, scene.environment);
    loadWineGlass(scene);
    addSword(scene, scene.environment);

    addFloor(scene);
    addMirror(scene);
    addDustParticles(scene);
}

function addFloor(scene) {
    const floorSet = makeFloorSet(512);
    [floorSet.colorTex, floorSet.normalTex, floorSet.roughTex].forEach(t => t.repeat.set(6, 4));
    const floor = new THREE.Mesh(
        new THREE.PlaneGeometry(40, 30),
        new THREE.MeshStandardMaterial({
            map: floorSet.colorTex,
            normalMap: floorSet.normalTex,
            normalScale: new THREE.Vector2(0.9, 0.9),
            roughnessMap: floorSet.roughTex,
            roughness: 1.0,
            metalness: 0.0,
            color: 0x2a2018,
            envMapIntensity: 0.10
        })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.01;
    floor.receiveShadow = true;
    scene.add(floor);
}

// Sprite circulaire flou pour les particules (gradient radial)
function makeDustSpriteTexture(size = 64) {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext("2d");
    const grd = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grd.addColorStop(0.0, "rgba(255, 240, 210, 1.0)");
    grd.addColorStop(0.4, "rgba(255, 220, 170, 0.55)");
    grd.addColorStop(1.0, "rgba(255, 200, 130, 0.0)");
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, size, size);
    return new THREE.CanvasTexture(canvas);
}

// Deux populations : ambiante (dérive aléatoire) + thermique (spirale
// au-dessus de la flamme). ShaderMaterial pour varier taille/opacité par
// particule (PointsMaterial ne le permet pas).

// Sync bouton HUD ↔ checkbox GUI ↔ params
function setDustVisible(visible) {
    params.showDust = visible;
    if (dustPoints) dustPoints.visible = visible;
    const btn = document.getElementById("dust-toggle");
    if (btn) {
        btn.classList.toggle("dust-toggle-off", !visible);
        btn.setAttribute("aria-pressed", String(visible));
        btn.textContent = visible ? "Poussières : ON" : "Poussières : OFF";
    }
    if (dustToggleController) dustToggleController.updateDisplay();
}

function addDustParticles(scene) {
    const count = 320;
    const positions = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const opacities = new Float32Array(count);
    const seeds = new Float32Array(count);
    const modes = new Uint8Array(count); // 0 = ambiente, 1 = thermique
    const velocities = new Float32Array(count * 3);

    // Position de la flamme (cf. addCandleLight) — sert de cible
    // au cône thermique.
    const flameX = -3.3, flameZ = -2.6, flameY = 6.5;

    for (let i = 0; i < count; i++) {
        const thermal = Math.random() < 0.30;
        modes[i] = thermal ? 1 : 0;

        if (thermal) {
            // Confiné dans un cylindre autour de la flamme
            const ang = Math.random() * Math.PI * 2;
            const r = Math.random() * 0.7;
            positions[i * 3]     = flameX + Math.cos(ang) * r;
            positions[i * 3 + 1] = flameY + Math.random() * 4;
            positions[i * 3 + 2] = flameZ + Math.sin(ang) * r;
            sizes[i] = 0.5 + Math.random() * 0.7;
            opacities[i] = 0.6 + Math.random() * 0.35;
        } else {
            positions[i * 3]     = (Math.random() - 0.5) * 13;
            positions[i * 3 + 1] = 4 + Math.random() * 6;
            positions[i * 3 + 2] = -5 + Math.random() * 8;
            sizes[i] = 0.25 + Math.random() * 0.9;
            opacities[i] = 0.25 + Math.random() * 0.55;
        }
        seeds[i] = Math.random() * 100;
        velocities[i * 3]     = (Math.random() - 0.5) * 0.04;
        velocities[i * 3 + 1] = (Math.random() - 0.5) * 0.03;
        velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.04;
    }

    dustGeom = new THREE.BufferGeometry();
    dustGeom.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    dustGeom.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
    dustGeom.setAttribute("aOpacity", new THREE.BufferAttribute(opacities, 1));

    const spriteTex = makeDustSpriteTexture(64);
    const dustMat = new THREE.ShaderMaterial({
        uniforms: {
            uMap:   { value: spriteTex },
            // Gris légèrement chaud — la poussière diffuse, elle ne brille pas
            uColor: { value: new THREE.Color(0xb5ada0) },
            uPixelRatio: { value: window.devicePixelRatio || 1 },
            uIntensity: { value: 1.0 }
        },
        vertexShader: `
            attribute float aSize;
            attribute float aOpacity;
            uniform float uPixelRatio;
            varying float vOpacity;
            void main() {
                vOpacity = aOpacity;
                vec4 mv = modelViewMatrix * vec4(position, 1.0);
                gl_PointSize = aSize * 90.0 * uPixelRatio / -mv.z;
                gl_Position = projectionMatrix * mv;
            }
        `,
        fragmentShader: `
            uniform sampler2D uMap;
            uniform vec3 uColor;
            uniform float uIntensity;
            varying float vOpacity;
            void main() {
                vec4 t = texture2D(uMap, gl_PointCoord);
                gl_FragColor = vec4(uColor, t.a * vOpacity * uIntensity * 0.55);
            }
        `,
        // Blending normal : les particules occultent, n'éclairent pas
        transparent: true,
        depthWrite: false,
        blending: THREE.NormalBlending
    });

    dustPoints = new THREE.Points(dustGeom, dustMat);
    dustPoints.renderOrder = 2;
    dustPoints.frustumCulled = false;
    dustPoints.userData.material = dustMat;
    scene.add(dustPoints);

    updaters.push(function (elapsed) {
        const arr = dustGeom.attributes.position.array;
        for (let i = 0; i < count; i++) {
            const s = seeds[i];
            const ix = i * 3, iy = i * 3 + 1, iz = i * 3 + 2;
            if (modes[i] === 1) {
                // Thermique : spirale qui monte au-dessus de la flamme
                const dx = arr[ix] - flameX;
                const dz = arr[iz] - flameZ;
                const cosT = Math.cos(0.020), sinT = Math.sin(0.020);
                const rx = dx * cosT - dz * sinT;
                const rz = dx * sinT + dz * cosT;
                const expand = 1.0 + 0.0008;
                arr[ix] = flameX + rx * expand;
                arr[iz] = flameZ + rz * expand;
                arr[iy] += 0.030 + Math.sin(elapsed * 2.1 + s) * 0.006;
                if (arr[iy] > flameY + 5) {
                    const ang = Math.random() * Math.PI * 2;
                    const r = Math.random() * 0.6;
                    arr[ix] = flameX + Math.cos(ang) * r;
                    arr[iy] = flameY;
                    arr[iz] = flameZ + Math.sin(ang) * r;
                }
            } else {
                // Ambiante : dérive aléatoire dans toute la pièce
                arr[ix] += velocities[ix] * 0.08 + Math.sin(elapsed * 0.35 + s) * 0.0035;
                arr[iy] += 0.0035 + Math.cos(elapsed * 0.42 + s) * 0.0018;
                arr[iz] += velocities[iz] * 0.08 + Math.cos(elapsed * 0.30 + s * 1.3) * 0.0035;
                if (arr[iy] > 12) arr[iy] = 4;
                if (arr[iy] < 3) arr[iy] = 12;
                if (arr[ix] > 7)  arr[ix] = -7;
                if (arr[ix] < -7) arr[ix] = 7;
                if (arr[iz] > 3)  arr[iz] = -5;
                if (arr[iz] < -5) arr[iz] = 3;
            }
        }
        dustGeom.attributes.position.needsUpdate = true;
    });
}

function addMirror(scene) {
    mirrorGroup = new THREE.Group();

    // Reflector — disque qui re-rend la scène. Texture cappée à 512²
    // pour ne pas exploser le coût (un miroir plein écran = un second
    // rendu complet de la scène à chaque frame).
    const mirrorGeom = new THREE.CircleGeometry(1.2, 64);
    const mirror = new Reflector(mirrorGeom, {
        color: 0xb8b0a0,
        textureWidth: 512,
        textureHeight: 512,
        clipBias: 0.003
    });
    mirror.position.set(0, 0, 0.04);
    mirrorGroup.add(mirror);

    const woodSet = makeWoodSet(256);
    const ringGeom = new THREE.TorusGeometry(1.25, 0.15, 24, 64);
    const ringUv = ringGeom.attributes.uv;
    ringGeom.setAttribute("uv1", new THREE.BufferAttribute(ringUv.array, 2));
    const ring = new THREE.Mesh(
        ringGeom,
        new THREE.MeshStandardMaterial({
            map: woodSet.colorTex,
            normalMap: woodSet.normalTex,
            normalScale: new THREE.Vector2(1.2, 1.2),
            roughnessMap: woodSet.roughTex,
            aoMap: woodSet.aoTex,
            aoMapIntensity: 0.6,
            metalness: 0.2,
            envMap: scene.environment,
            envMapIntensity: 0.4,
            color: 0xb88a52
        })
    );
    ring.castShadow = true;
    mirrorGroup.add(ring);

    // Patine légère (opacité 0.20) — quelques taches d'oxydation pour
    // casser l'aspect glace neuve sans masquer le reflet
    const patineCanvas = document.createElement("canvas");
    patineCanvas.width = patineCanvas.height = 256;
    const pCtx = patineCanvas.getContext("2d");
    pCtx.clearRect(0, 0, 256, 256);
    for (let i = 0; i < 25; i++) {
        const x = Math.random() * 256, y = Math.random() * 256;
        const r = 3 + Math.random() * 14;
        const grd = pCtx.createRadialGradient(x, y, 0, x, y, r);
        const oxidation = Math.random() > 0.5;
        if (oxidation) {
            grd.addColorStop(0, "rgba(50, 35, 20, 0.55)");
            grd.addColorStop(1, "rgba(50, 35, 20, 0)");
        } else {
            grd.addColorStop(0, "rgba(190, 170, 130, 0.35)");
            grd.addColorStop(1, "rgba(190, 170, 130, 0)");
        }
        pCtx.fillStyle = grd;
        pCtx.beginPath(); pCtx.arc(x, y, r, 0, Math.PI * 2); pCtx.fill();
    }
    // Anneau d'humidité sur la lisière
    const ringGrad = pCtx.createRadialGradient(128, 128, 95, 128, 128, 128);
    ringGrad.addColorStop(0, "rgba(40, 30, 22, 0)");
    ringGrad.addColorStop(0.9, "rgba(40, 30, 22, 0.20)");
    ringGrad.addColorStop(1, "rgba(40, 30, 22, 0.35)");
    pCtx.fillStyle = ringGrad;
    pCtx.fillRect(0, 0, 256, 256);

    const patineTex = new THREE.CanvasTexture(patineCanvas);
    patineTex.colorSpace = THREE.SRGBColorSpace;
    const dust = new THREE.Mesh(
        new THREE.CircleGeometry(1.18, 64),
        new THREE.MeshBasicMaterial({
            map: patineTex,
            transparent: true,
            depthWrite: false,
            opacity: 0.20
        })
    );
    dust.position.set(0, 0, 0.05);
    mirrorGroup.add(dust);

    // Orienté vers la scène. Mur arrière à z=-6 ; on s'éloigne de 0.6
    // pour qu'avec la rotation Y l'anneau (rayon 1.25 + tube 0.15) ne
    // clipe pas dans la pierre.
    mirrorGroup.position.set(6.5, 8.0, -5.4);
    mirrorGroup.rotation.y = -0.35;
    scene.add(mirrorGroup);
}

// Vignette : passe additionnelle dessinée par-dessus la scène. Un fullscreen
// quad avec un shader minimal qui assombrit les bords de l'image. Conserve
// la précision (pas de texture canvas) et supporte tous les ratios d'écran.
function setupVignette() {
    vignetteScene = new THREE.Scene();
    vignetteCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    vignetteUniforms = {
        uStrength: { value: params.vignetteStrength },
        uSoftness: { value: params.vignetteSoftness },
        uColor:    { value: new THREE.Color(0x000000) }
    };

    const mat = new THREE.ShaderMaterial({
        uniforms: vignetteUniforms,
        vertexShader: `
            varying vec2 vUv;
            void main() {
                vUv = uv;
                gl_Position = vec4(position.xy, 0.0, 1.0);
            }
        `,
        fragmentShader: `
            varying vec2 vUv;
            uniform float uStrength;
            uniform float uSoftness;
            uniform vec3 uColor;
            void main() {
                vec2 d = vUv - 0.5;
                d.x *= 1.6; // ellipse un peu plus large que haute
                float r = length(d);
                float v = smoothstep(uSoftness * 0.5, uSoftness, r) * uStrength;
                gl_FragColor = vec4(uColor, v);
            }
        `,
        transparent: true,
        depthTest: false,
        depthWrite: false
    });

    vignetteMesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
    vignetteScene.add(vignetteMesh);
}

// Filtre de Kuwahara : pour chaque pixel, 4 quadrants → on garde la
// moyenne du quadrant de plus faible variance. Zones lissées séparées
// par des arêtes nettes = "coups de pinceau" d'une peinture à l'huile.
function setupOilPaint() {
    const w = renderer.domElement.width;
    const h = renderer.domElement.height;

    // Target linéaire — on ré-encode sRGB nous-mêmes dans le shader
    sceneTarget = new THREE.WebGLRenderTarget(w, h, {
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        format: THREE.RGBAFormat,
        type: THREE.UnsignedByteType,
        colorSpace: THREE.LinearSRGBColorSpace
    });

    oilScene = new THREE.Scene();
    oilCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    oilUniforms = {
        uMap: { value: sceneTarget.texture },
        uResolution: { value: new THREE.Vector2(w, h) },
        uIntensity: { value: params.oilIntensity },
        uSaturation: { value: 1.18 }
    };

    const oilMat = new THREE.ShaderMaterial({
        uniforms: oilUniforms,
        vertexShader: `
            varying vec2 vUv;
            void main() {
                vUv = uv;
                gl_Position = vec4(position.xy, 0.0, 1.0);
            }
        `,
        fragmentShader: `
            precision highp float;
            varying vec2 vUv;
            uniform sampler2D uMap;
            uniform vec2 uResolution;
            uniform float uIntensity;
            uniform float uSaturation;

            // 4 → 100 samples/pixel total. Compromis perf/qualité.
            #define KRADIUS 4

            void main() {
                vec2 px = 1.0 / uResolution;

                vec3 m0 = vec3(0.0), m1 = vec3(0.0), m2 = vec3(0.0), m3 = vec3(0.0);
                vec3 s0 = vec3(0.0), s1 = vec3(0.0), s2 = vec3(0.0), s3 = vec3(0.0);

                // NW
                for (int j = -KRADIUS; j <= 0; j++) {
                    for (int i = -KRADIUS; i <= 0; i++) {
                        vec3 c = texture2D(uMap, vUv + vec2(float(i), float(j)) * px).rgb;
                        m0 += c; s0 += c * c;
                    }
                }
                // NE
                for (int j = -KRADIUS; j <= 0; j++) {
                    for (int i = 0; i <= KRADIUS; i++) {
                        vec3 c = texture2D(uMap, vUv + vec2(float(i), float(j)) * px).rgb;
                        m1 += c; s1 += c * c;
                    }
                }
                // SW
                for (int j = 0; j <= KRADIUS; j++) {
                    for (int i = -KRADIUS; i <= 0; i++) {
                        vec3 c = texture2D(uMap, vUv + vec2(float(i), float(j)) * px).rgb;
                        m2 += c; s2 += c * c;
                    }
                }
                // SE
                for (int j = 0; j <= KRADIUS; j++) {
                    for (int i = 0; i <= KRADIUS; i++) {
                        vec3 c = texture2D(uMap, vUv + vec2(float(i), float(j)) * px).rgb;
                        m3 += c; s3 += c * c;
                    }
                }

                float n = float((KRADIUS + 1) * (KRADIUS + 1));
                m0 /= n; m1 /= n; m2 /= n; m3 /= n;
                vec3 v0 = abs(s0 / n - m0 * m0);
                vec3 v1 = abs(s1 / n - m1 * m1);
                vec3 v2 = abs(s2 / n - m2 * m2);
                vec3 v3 = abs(s3 / n - m3 * m3);

                // Quadrant à variance minimale
                float k0 = v0.r + v0.g + v0.b;
                float k1 = v1.r + v1.g + v1.b;
                float k2 = v2.r + v2.g + v2.b;
                float k3 = v3.r + v3.g + v3.b;

                vec3 winner = m0;
                float minK = k0;
                if (k1 < minK) { minK = k1; winner = m1; }
                if (k2 < minK) { minK = k2; winner = m2; }
                if (k3 < minK) { minK = k3; winner = m3; }

                // Boost saturation = palette grasse d'huile
                float lum = dot(winner, vec3(0.299, 0.587, 0.114));
                vec3 saturated = mix(vec3(lum), winner, uSaturation);

                vec3 orig = texture2D(uMap, vUv).rgb;
                vec3 outc = mix(orig, saturated, uIntensity);

                // Encoding linéaire → sRGB (target linéaire, canvas attend sRGB)
                outc = pow(clamp(outc, 0.0, 1.0), vec3(1.0 / 2.2));

                gl_FragColor = vec4(outc, 1.0);
            }
        `,
        depthTest: false,
        depthWrite: false
    });

    oilMat.toneMapped = false;
    oilMesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), oilMat);
    oilScene.add(oilMesh);
}

// Sync bouton HUD ↔ checkbox GUI
function setOilEnabled(enabled) {
    params.oilPaint = enabled;
    const btn = document.getElementById("oil-toggle");
    if (btn) {
        btn.classList.toggle("oil-toggle-off", !enabled);
        btn.setAttribute("aria-pressed", String(enabled));
        btn.textContent = enabled ? "Peinture huile : ON" : "Peinture huile : OFF";
    }
    if (oilToggleController) oilToggleController.updateDisplay();
}

function init() {
    const canvasWidth = 846;
    const canvasHeight = 494;

    renderer = new THREE.WebGLRenderer({ antialias: true });
    // Cap à 1.5 : sur retina, devicePixelRatio = 2 ou 3 → on rend 4 à 9
    // fois plus de pixels. Le Kuwahara à 100 samples/px et la CubeCamera
    // tuent le framerate à pleine résolution. 1.5 reste net.
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.setSize(canvasWidth, canvasHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = params.exposure;

    // Champ serré 35° → cadrage portrait sur le casque
    camera = new THREE.PerspectiveCamera(35, canvasWidth / canvasHeight, 0.1, 2000);
    camera.position.set(-0.4, 6.9, 4.6);

    cameraControls = new OrbitControls(camera, renderer.domElement);
    cameraControls.target.set(0.5, 5.8, -1.6);
    cameraControls.minDistance = 3;
    cameraControls.maxDistance = 18;
    cameraControls.enableDamping = true;
    cameraControls.dampingFactor = 0.06;

    window.addEventListener("resize", onWindowResize);
}

function onWindowResize() {
    const container = document.getElementById("webGL");
    if (!container) return;
    const width = container.clientWidth || 846;
    const height = Math.max(360, Math.round(width * 0.58));
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);

    if (sceneTarget) {
        const w = renderer.domElement.width;
        const h = renderer.domElement.height;
        sceneTarget.setSize(w, h);
        if (oilUniforms) oilUniforms.uResolution.value.set(w, h);
    }
}

function addToDOM() {
    const container = document.getElementById("webGL");
    if (!container) {
        throw new Error("Le conteneur #webGL est introuvable dans index.html");
    }
    const existingCanvas = container.querySelector("canvas");
    if (existingCanvas) container.removeChild(existingCanvas);
    container.appendChild(renderer.domElement);
    onWindowResize();

    // Boutons HUD overlay : toggles directs accessibles sans ouvrir
    // le panneau lil-gui.
    const dustBtn = document.getElementById("dust-toggle");
    if (dustBtn) {
        dustBtn.addEventListener("click", () => setDustVisible(!params.showDust));
        setDustVisible(params.showDust);
    }
    const oilBtn = document.getElementById("oil-toggle");
    if (oilBtn) {
        oilBtn.addEventListener("click", () => setOilEnabled(!params.oilPaint));
        setOilEnabled(params.oilPaint);
    }
}

function setupGUI() {
    const gui = new GUI({ title: "Réglages", width: 280 });
    const guiContainer = document.getElementById("gui-container");
    if (guiContainer) guiContainer.appendChild(gui.domElement);

    const fLights = gui.addFolder("Éclairage");
    fLights.add(params, "candleIntensity", 0, 50, 0.5)
        .name("Bougie")
        .onChange(v => { if (candle && candle.setBaseIntensity) candle.setBaseIntensity(v); });
    fLights.add(params, "ambient", 0, 0.6, 0.005)
        .name("Ambiante")
        .onChange(v => ambientLight.intensity = v);
    fLights.add(params, "spotIntensity", 0, 5, 0.05)
        .name("Spot principal")
        .onChange(v => stillLifeSpot.intensity = v);
    fLights.add(params, "rimIntensity", 0, 4, 0.05)
        .name("Rim arrière")
        .onChange(v => rimLight.intensity = v);
    fLights.add(params, "skyIntensity", 0, 5, 0.05)
        .name("Lumière ciel (D)")
        .onChange(v => skyLight.intensity = v);
    fLights.addColor(params, "skyColor")
        .name("Couleur ciel")
        .onChange(v => skyLight.color.set(v));

    const fAtmo = gui.addFolder("Atmosphère");
    fAtmo.add(params, "fogDensity", 0, 0.15, 0.001)
        .name("Brouillard")
        .onChange(v => fog.density = v);
    fAtmo.addColor(params, "fogColor")
        .name("Couleur brouillard")
        .onChange(v => fog.color.set(v));
    fAtmo.addColor(params, "bgColor")
        .name("Fond (override)")
        .onChange(v => { scene.background = new THREE.Color(v); });
    dustToggleController = fAtmo.add(params, "showDust").name("Poussières")
        .onChange(v => { setDustVisible(v); });
    fAtmo.add(params, "dustIntensity", 0, 2.5, 0.05).name("Densité poussière")
        .onChange(v => {
            if (dustPoints && dustPoints.userData.material) {
                dustPoints.userData.material.uniforms.uIntensity.value = v;
            }
        });

    const fPost = gui.addFolder("Rendu");
    fPost.add(params, "exposure", 0.3, 1.6, 0.01)
        .name("Exposition")
        .onChange(v => renderer.toneMappingExposure = v);
    fPost.add(params, "vignetteStrength", 0, 1.5, 0.01)
        .name("Vignette force")
        .onChange(v => vignetteUniforms.uStrength.value = v);
    fPost.add(params, "vignetteSoftness", 0.1, 1.0, 0.01)
        .name("Vignette douceur")
        .onChange(v => vignetteUniforms.uSoftness.value = v);
    oilToggleController = fPost.add(params, "oilPaint")
        .name("Peinture à l'huile")
        .onChange(v => setOilEnabled(v));
    fPost.add(params, "oilIntensity", 0, 1, 0.01)
        .name("Intensité huile")
        .onChange(v => { if (oilUniforms) oilUniforms.uIntensity.value = v; });

    const fScene = gui.addFolder("Scène");
    fScene.add(params, "rotateScene").name("Rotation auto");
    fScene.add(params, "showMirror").name("Miroir visible")
        .onChange(v => { mirrorGroup.visible = v; });

    fLights.close();
    fAtmo.close();
    fPost.open();
    fScene.close();
}

function render() {
    const delta = clock.getDelta();
    const elapsed = clock.elapsedTime;

    cameraControls.update(delta);

    for (const fn of updaters) fn(elapsed);

    if (params.rotateScene) {
        // Va-et-vient devant la scène (sin sur l'angle)
        const r = 11;
        const targetX = 0.2, targetY = 5.7, targetZ = -1.5;
        const amplitude = THREE.MathUtils.degToRad(55);
        const angle = Math.sin(elapsed * 0.25) * amplitude;
        camera.position.x = targetX + Math.sin(angle) * r;
        camera.position.z = targetZ + Math.cos(angle) * r;
        camera.position.y = 8.0;
        camera.lookAt(targetX, targetY, targetZ);
    }

    updateHelmetReflection(renderer, scene);

    if (params.oilPaint && sceneTarget) {
        // Scène → RT, puis Kuwahara → écran
        renderer.setRenderTarget(sceneTarget);
        renderer.autoClear = true;
        renderer.clear();
        renderer.render(scene, camera);
        renderer.setRenderTarget(null);
        renderer.autoClear = true;
        renderer.render(oilScene, oilCamera);
    } else {
        renderer.autoClear = true;
        renderer.render(scene, camera);
    }
    // Vignette en dernière passe
    renderer.autoClear = false;
    renderer.clearDepth();
    renderer.render(vignetteScene, vignetteCamera);
    renderer.autoClear = true;
}

function animate() {
    requestAnimationFrame(animate);
    render();
}

try {
    init();
    fillScene();
    setupVignette();
    setupOilPaint();
    addToDOM();
    setupGUI();
    animate();
} catch (e) {
    console.error(e);
}
