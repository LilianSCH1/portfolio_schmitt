"use strict";

import * as THREE from "three";
import { makeParchmentTexture, makeParchmentNormalMap } from "./proceduralTextures.js";

// alphaMap : bords irréguliers du parchemin (déchirures)
function makeParchmentAlphaMap(size = 256) {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext("2d");

    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, size, size);

    ctx.fillStyle = "white";
    const margin = size * 0.05;
    const steps = 120;
    ctx.beginPath();
    for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const x = margin + t * (size - margin * 2);
        const y = margin + (Math.sin(t * 14) + Math.sin(t * 31)) * 5;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }
    for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const y = margin + t * (size - margin * 2);
        const x = size - margin - (Math.cos(t * 13) + Math.cos(t * 27)) * 5;
        ctx.lineTo(x, y);
    }
    for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const x = size - margin - t * (size - margin * 2);
        const y = size - margin - (Math.sin(t * 15) + Math.sin(t * 29)) * 5;
        ctx.lineTo(x, y);
    }
    for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const y = size - margin - t * (size - margin * 2);
        const x = margin + (Math.cos(t * 12) + Math.cos(t * 25)) * 5;
        ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();

    // Petites déchirures internes (rares, opaques)
    ctx.fillStyle = "black";
    for (let i = 0; i < 2; i++) {
        const cx = margin + Math.random() * (size - 2 * margin);
        const cy = margin + Math.random() * (size - 2 * margin);
        ctx.beginPath();
        ctx.ellipse(cx, cy, 6, 2, Math.random() * Math.PI, 0, Math.PI * 2);
        ctx.fill();
    }

    return new THREE.CanvasTexture(canvas);
}

export function addTableProps(scene) {
    const parchmentMap = makeParchmentTexture(512);
    const parchmentAlpha = makeParchmentAlphaMap(256);
    const parchmentNormal = makeParchmentNormalMap(256);

    // Parchemin légèrement bombé : plane subdivisé + petite déformation
    // procédurale des Z pour éviter qu'il paraisse parfaitement plat.
    const parchGeom = new THREE.PlaneGeometry(7.8, 5.4, 32, 22);
    const pos = parchGeom.attributes.position;
    for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i), y = pos.getY(i);
        const dz = Math.sin(x * 0.45) * 0.04 + Math.sin(y * 0.6 + 1.3) * 0.03;
        pos.setZ(i, dz);
    }
    parchGeom.computeVertexNormals();

    const parchment = new THREE.Mesh(
        parchGeom,
        new THREE.MeshStandardMaterial({
            map: parchmentMap,
            alphaMap: parchmentAlpha,
            normalMap: parchmentNormal,
            normalScale: new THREE.Vector2(0.4, 0.4),
            transparent: true,
            roughness: 0.92,
            metalness: 0.0,
            side: THREE.DoubleSide,
            envMapIntensity: 0.2
        })
    );
    parchment.rotation.x = -Math.PI * 0.5;
    parchment.rotation.z = 0.55;
    // Centré sous le casque pour qu'il « pose » dessus comme dans la
    // référence : le parchemin déroulé tient toute la base de la scène.
    parchment.position.set(0.3, 5.04, -1.6);
    parchment.receiveShadow = true;
    parchment.castShadow = true;
    scene.add(parchment);

    return { parchment };
}
