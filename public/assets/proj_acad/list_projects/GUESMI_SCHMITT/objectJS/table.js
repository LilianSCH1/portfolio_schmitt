"use strict";

import * as THREE from "three";
import { makeWoodSet } from "./proceduralTextures.js";

function cloneWoodTextures(woodSet, repeat) {
    const out = {};
    for (const k of ["colorTex", "normalTex", "roughTex", "aoTex"]) {
        if (!woodSet[k]) continue;
        const t = woodSet[k].clone();
        t.needsUpdate = true;
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        t.repeat.copy(repeat);
        if (k === "colorTex") t.colorSpace = THREE.SRGBColorSpace;
        out[k] = t;
    }
    return out;
}

function makeWoodMaterial(woodSet, repeat) {
    const tex = cloneWoodTextures(woodSet, repeat);
    return new THREE.MeshStandardMaterial({
        map: tex.colorTex,
        normalMap: tex.normalTex,
        normalScale: new THREE.Vector2(1.4, 1.4),
        roughnessMap: tex.roughTex,
        aoMap: tex.aoTex || null,
        aoMapIntensity: 0.85,
        roughness: 0.95,
        metalness: 0.05,
        // Brun chaud profond — le bois du tableau est très foncé,
        // presque noir dans l'ombre, et juste révélé en bordure par
        // la lumière. Une teinte plus saturée fait ressortir les
        // veines sans s'éclaircir.
        color: 0x8a5028,
        envMapIntensity: 0.30
    });
}

// aoMap se lit dans uv1 (Three.js récent) — duplique le canal UV0
// pour que les BoxGeometry de la table portent bien l'AO.
function withAoUv(geom) {
    const uv = geom.attributes.uv;
    geom.setAttribute("uv1", new THREE.BufferAttribute(uv.array, 2));
    return geom;
}

export function addTable(scene) {
    const woodSet = makeWoodSet(512);

    // Plateau central (entre les deux bras du U) — largeur réduite
    // de 20 à 14 pour ne pas chevaucher les bras (sinon z-fighting).
    const armWidth = 3;
    const centerWidth = 20 - 2 * armWidth;
    const top = new THREE.Mesh(
        withAoUv(new THREE.BoxGeometry(centerWidth, 1, 6)),
        makeWoodMaterial(woodSet, new THREE.Vector2(2, 1))
    );
    top.position.set(0, 4.5, -2);
    top.receiveShadow = true;
    top.castShadow = true;
    scene.add(top);

    // Bras gauche et droit du U : prolongements perpendiculaires qui
    // longent les murs latéraux jusqu'à l'avant.
    const armDepth = 6.5;

    const armLeft = new THREE.Mesh(
        withAoUv(new THREE.BoxGeometry(armWidth, 1, armDepth)),
        makeWoodMaterial(woodSet, new THREE.Vector2(0.6, 1.2))
    );
    armLeft.position.set(-(10 - armWidth / 2), 4.5, -2 + armDepth / 2 - 3);
    armLeft.receiveShadow = true;
    armLeft.castShadow = true;
    scene.add(armLeft);

    const armRight = new THREE.Mesh(
        withAoUv(new THREE.BoxGeometry(armWidth, 1, armDepth)),
        makeWoodMaterial(woodSet, new THREE.Vector2(0.6, 1.2))
    );
    armRight.position.set(10 - armWidth / 2, 4.5, -2 + armDepth / 2 - 3);
    armRight.receiveShadow = true;
    armRight.castShadow = true;
    scene.add(armRight);

    // Petite bordure avant (uniquement sur la partie centrale entre
    // les deux bras, pour suivre le creux du U).
    const edgeMat = makeWoodMaterial(woodSet, new THREE.Vector2(2, 0.3));
    edgeMat.color = new THREE.Color(0x9c6840);
    edgeMat.roughness = 1.0;
    const edge = new THREE.Mesh(
        new THREE.BoxGeometry(centerWidth, 0.15, 0.08),
        edgeMat
    );
    edge.position.set(0, 4.0, 1.0);
    edge.receiveShadow = true;
    scene.add(edge);

    return { top, armLeft, armRight };
}
