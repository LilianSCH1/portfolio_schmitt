"use strict";

import * as THREE from "three";
import { makeStoneSet } from "./proceduralTextures.js";

// Génère un set de textures partageant le même canvas mais avec leurs
// propres repeat (clones légers — pas de re-render de canvas).
function cloneStoneTextures(stoneSet, repeat) {
    const out = {};
    for (const k of ["colorTex", "normalTex", "roughTex", "aoTex"]) {
        const t = stoneSet[k].clone();
        t.needsUpdate = true;
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        t.repeat.copy(repeat);
        if (k === "colorTex") t.colorSpace = THREE.SRGBColorSpace;
        out[k] = t;
    }
    return out;
}

function makeWallMesh(w, h, repeat, stoneSet) {
    const geom = new THREE.PlaneGeometry(w, h, 32, 26);
    // aoMap lit uv1 dans Three.js récent — on duplique uv0 pour le canal AO
    const uv = geom.attributes.uv;
    geom.setAttribute("uv1", new THREE.BufferAttribute(uv.array, 2));

    const tex = cloneStoneTextures(stoneSet, repeat);
    const mat = new THREE.MeshStandardMaterial({
        map: tex.colorTex,
        normalMap: tex.normalTex,
        normalScale: new THREE.Vector2(1.5, 1.5),
        roughnessMap: tex.roughTex,
        roughness: 1.0,
        metalness: 0.0,
        aoMap: tex.aoTex,
        aoMapIntensity: 1.2,
        // Tan/ocre saturé qui devient orange chaud sous la lumière de
        // la bougie — c'est le mur sandstone du tableau de référence.
        color: 0xc89568,
        envMapIntensity: 0.15
    });

    const m = new THREE.Mesh(geom, mat);
    m.receiveShadow = true;
    return m;
}

export function addWall(scene) {
    // Une seule génération du canvas → cloné pour chaque pan
    const stoneSet = makeStoneSet(512);

    // Pan du fond (mur arrière)
    const back = makeWallMesh(22, 18, new THREE.Vector2(2.5, 1.8), stoneSet);
    back.position.set(0, 10, -6);
    scene.add(back);

    // Pans latéraux : alcôve en U. Perpendiculaires au fond, rentrent
    // jusqu'à la limite avant de la table (z ≈ +1.2). Profondeur 7.5
    // calée pour que le bord avant ne sorte pas de la table.
    const sideDepth = 7.5;
    const sideRepeat = new THREE.Vector2(1.0, 1.8);
    const sideZ = -6 + sideDepth / 2;

    const left = makeWallMesh(sideDepth, 18, sideRepeat, stoneSet);
    left.rotation.y = Math.PI / 2;
    left.position.set(-11, 10, sideZ);
    scene.add(left);

    const right = makeWallMesh(sideDepth, 18, sideRepeat, stoneSet);
    right.rotation.y = -Math.PI / 2;
    right.position.set(11, 10, sideZ);
    scene.add(right);

    return { back, left, right };
}
