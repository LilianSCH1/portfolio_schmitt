"use strict";

import * as THREE from "three";
import { makeWoodSet } from "./proceduralTextures.js";

// Maps PBR pour le bronze : color + roughness + normal (martelage léger)
function makeBronzeSet(size = 128) {
    const cC = document.createElement("canvas"); cC.width = cC.height = size;
    const hC = document.createElement("canvas"); hC.width = hC.height = size;
    const rC = document.createElement("canvas"); rC.width = rC.height = size;
    const cCtx = cC.getContext("2d");
    const hCtx = hC.getContext("2d");
    const rCtx = rC.getContext("2d");

    // Base bronze patiné — vert-brun chaud
    cCtx.fillStyle = "#9a6f2e"; cCtx.fillRect(0, 0, size, size);
    hCtx.fillStyle = "#888888"; hCtx.fillRect(0, 0, size, size);
    rCtx.fillStyle = "#5a5a5a"; rCtx.fillRect(0, 0, size, size);

    // Patine verte aléatoire (oxydation)
    for (let i = 0; i < 35; i++) {
        const x = Math.random() * size, y = Math.random() * size;
        const r = 5 + Math.random() * 18;
        const grd = cCtx.createRadialGradient(x, y, 0, x, y, r);
        if (Math.random() > 0.55) {
            grd.addColorStop(0, "rgba(60,90,55,0.55)");
            grd.addColorStop(1, "rgba(60,90,55,0)");
        } else {
            grd.addColorStop(0, "rgba(40,25,8,0.55)");
            grd.addColorStop(1, "rgba(40,25,8,0)");
        }
        cCtx.fillStyle = grd;
        cCtx.beginPath(); cCtx.arc(x, y, r, 0, Math.PI * 2); cCtx.fill();

        // Patine = creux légèrement rugueux
        const grdR = rCtx.createRadialGradient(x, y, 0, x, y, r);
        grdR.addColorStop(0, "rgba(255,255,255,0.4)");
        grdR.addColorStop(1, "rgba(255,255,255,0)");
        rCtx.fillStyle = grdR;
        rCtx.beginPath(); rCtx.arc(x, y, r, 0, Math.PI * 2); rCtx.fill();
    }

    // Martelage : petits dômes irréguliers
    const cell = 14;
    for (let y = 0; y < size; y += cell) {
        for (let x = 0; x < size; x += cell) {
            const cx = x + cell / 2 + (Math.random() - 0.5) * 3;
            const cy = y + cell / 2 + (Math.random() - 0.5) * 3;
            const r = cell * 0.45 + Math.random() * 2;
            const grad = hCtx.createRadialGradient(cx, cy, 0, cx, cy, r);
            grad.addColorStop(0, "#c0c0c0");
            grad.addColorStop(0.7, "#888888");
            grad.addColorStop(1, "#404040");
            hCtx.fillStyle = grad;
            hCtx.beginPath(); hCtx.arc(cx, cy, r, 0, Math.PI * 2); hCtx.fill();
        }
    }

    // Normal map dérivée du heightfield
    const nC = document.createElement("canvas"); nC.width = nC.height = size;
    const nCtx = nC.getContext("2d");
    const hImg = hCtx.getImageData(0, 0, size, size).data;
    const nImg = nCtx.createImageData(size, size);
    const strength = 2.5;
    for (let yy = 0; yy < size; yy++) {
        for (let xx = 0; xx < size; xx++) {
            const xL = (xx - 1 + size) % size, xR = (xx + 1) % size;
            const yU = (yy - 1 + size) % size, yD = (yy + 1) % size;
            const hL = hImg[(yy * size + xL) * 4] / 255;
            const hR = hImg[(yy * size + xR) * 4] / 255;
            const hU = hImg[(yU * size + xx) * 4] / 255;
            const hD = hImg[(yD * size + xx) * 4] / 255;
            let nx = (hL - hR) * strength;
            let ny = (hU - hD) * strength;
            let nz = 1.0;
            const inv = 1 / Math.sqrt(nx * nx + ny * ny + nz * nz);
            nx *= inv; ny *= inv; nz *= inv;
            const idx = (yy * size + xx) * 4;
            nImg.data[idx]     = Math.floor(128 + nx * 127);
            nImg.data[idx + 1] = Math.floor(128 + ny * 127);
            nImg.data[idx + 2] = Math.floor(128 + nz * 127);
            nImg.data[idx + 3] = 255;
        }
    }
    nCtx.putImageData(nImg, 0, 0);

    const colorTex = new THREE.CanvasTexture(cC);
    const normalTex = new THREE.CanvasTexture(nC);
    const roughTex = new THREE.CanvasTexture(rC);
    [colorTex, normalTex, roughTex].forEach(t => {
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
    });
    colorTex.colorSpace = THREE.SRGBColorSpace;
    return { colorTex, normalTex, roughTex };
}

export function addSword(scene, envMap) {
    const group = new THREE.Group();

    const bronzeSet = makeBronzeSet(128);
    const bronzeMat = () => new THREE.MeshStandardMaterial({
        map: bronzeSet.colorTex,
        normalMap: bronzeSet.normalTex,
        normalScale: new THREE.Vector2(0.8, 0.8),
        roughnessMap: bronzeSet.roughTex,
        roughness: 0.45,
        metalness: 0.85,
        color: 0xffffff,
        envMap: envMap || null,
        envMapIntensity: 1.1
    });

    // ===== MANCHE BOIS =====
    const woodSet = makeWoodSet(512);
    [woodSet.colorTex, woodSet.normalTex, woodSet.roughTex].forEach(t => t.repeat.set(1, 2));
    const woodMaterial = new THREE.MeshStandardMaterial({
        map: woodSet.colorTex,
        normalMap: woodSet.normalTex,
        normalScale: new THREE.Vector2(1.4, 1.4),
        roughnessMap: woodSet.roughTex,
        aoMap: woodSet.aoTex || null,
        aoMapIntensity: 0.85,
        color: 0x8a5028,
        roughness: 0.95,
        metalness: 0.05
    });
    
    const woodLength = 1.08;
    const woodSegments = 7;
    const woodStartX = -0.72;
    const growth = 1.9;
    const radiusAt = (t) => 0.07 + (0.13 * (Math.exp(growth * t) - 1)) / (Math.exp(growth) - 1);
    const segmentLength = woodLength / woodSegments;

    for (let i = 0; i < woodSegments; i++) {
        const t0 = i / woodSegments;
        const t1 = (i + 1) / woodSegments;
        
        // CORRECTION ICI : Inversion des rayons pour correspondre à l'orientation post-rotation Z
        const segment = new THREE.Mesh(
            new THREE.CylinderGeometry(radiusAt(t1), radiusAt(t0), segmentLength + 0.005, 22),
            woodMaterial
        );
        segment.rotation.z = Math.PI / 2;
        segment.position.x = woodStartX + segmentLength * (i + 0.5);
        segment.castShadow = true;
        segment.receiveShadow = true;
        group.add(segment);
    }

    // Extrémité de la partie bois
    const woodEndCap = new THREE.Mesh(
        new THREE.SphereGeometry(0.11, 18, 14),
        woodMaterial
    );
    woodEndCap.scale.set(1.15, 1.0, 1.0);
    woodEndCap.rotation.z = Math.PI / 2;
    woodEndCap.position.x = woodStartX - 0.02;
    woodEndCap.castShadow = true;
    woodEndCap.receiveShadow = true;
    group.add(woodEndCap);

    // Anneaux métalliques sur le manche
    for (let i = 0; i < 2; i++) {
        const ring = new THREE.Mesh(
            new THREE.TorusGeometry(0.055, 0.007, 8, 20),
            bronzeMat()
        );
        ring.rotation.y = Math.PI / 2;
        ring.position.x = -0.42 - i * 0.18;
        ring.castShadow = false;
        group.add(ring);
    }

    // ===== EMBOUT MÉTALLIQUE =====
    const cap = new THREE.Mesh(
        new THREE.CylinderGeometry(0.20, 0.28, 0.38, 20),
        bronzeMat()
    );
    cap.rotation.z = Math.PI / 2;
    cap.position.x = 0.50;
    cap.castShadow = true;
    group.add(cap);

    const metalRing = new THREE.Mesh(
        new THREE.TorusGeometry(0.250, 0.018, 10, 28),
        bronzeMat()
    );
    metalRing.rotation.y = Math.PI / 2;
    metalRing.position.x = 0.50;
    metalRing.castShadow = true;
    group.add(metalRing);

    const capTip = new THREE.Mesh(
        new THREE.SphereGeometry(0.20, 16, 12),
        bronzeMat()
    );
    capTip.position.x = 0.72;
    capTip.castShadow = true;
    group.add(capTip);

    const ferrule = new THREE.Mesh(
        new THREE.CylinderGeometry(0.09, 0.09, 0.07, 18),
        new THREE.MeshStandardMaterial({
            color: 0x5c4a3a,
            roughness: 0.85,
            metalness: 0.1,
            envMap: envMap || null,
            envMapIntensity: 0.25
        })
    );
    ferrule.rotation.z = Math.PI / 2;
    ferrule.position.x = 0.26;
    ferrule.castShadow = true;
    group.add(ferrule);

    group.rotation.set(-Math.PI / 2, Math.PI + 0.138, 0.8);
    group.scale.set(1.8, 1.5, 1.5);
    group.position.set(2.9, 5.3, -1.5);

    scene.add(group);
    return group;
}