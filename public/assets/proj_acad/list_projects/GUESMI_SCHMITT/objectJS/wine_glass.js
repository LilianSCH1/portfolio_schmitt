"use strict";

import * as THREE from "three";

// Verre construit avec LatheGeometry : on définit un profil 2D (x=rayon,
// y=hauteur) qui sera tourné autour de l'axe Y pour générer un solide de
// révolution. Avantages par rapport à charger un OBJ :
//  - taille zéro dans le dossier
//  - on connaît exactement les dimensions internes → le vin tombe pile dans
//    le calice
//  - pas de problème d'orientation/échelle inconnue

// Normal map subtile pour les imperfections du verre soufflé (bulles
// micro, ondulations). Très faible amplitude pour ne pas casser la
// transparence — on cherche juste à dévier légèrement les reflets.
function makeGlassNormalMap(size = 256) {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    const hCtx = canvas.getContext("2d");
    hCtx.fillStyle = "#888888";
    hCtx.fillRect(0, 0, size, size);

    // Bulles ovales très espacées (verre médiéval imparfait)
    for (let i = 0; i < 18; i++) {
        const x = Math.random() * size, y = Math.random() * size;
        const rx = 4 + Math.random() * 7, ry = 4 + Math.random() * 7;
        const grd = hCtx.createRadialGradient(x, y, 0, x, y, Math.max(rx, ry));
        grd.addColorStop(0, "#a0a0a0");
        grd.addColorStop(1, "#888888");
        hCtx.fillStyle = grd;
        hCtx.beginPath();
        hCtx.ellipse(x, y, rx, ry, Math.random() * Math.PI, 0, Math.PI * 2);
        hCtx.fill();
    }

    // Dérivation Sobel
    const nC = document.createElement("canvas");
    nC.width = nC.height = size;
    const nCtx = nC.getContext("2d");
    const hImg = hCtx.getImageData(0, 0, size, size).data;
    const nImg = nCtx.createImageData(size, size);
    const strength = 1.0; // très faible
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
    const tex = new THREE.CanvasTexture(nC);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    return tex;
}

export function loadWineGlass(scene) {
    const profile = [
        new THREE.Vector2(0.0, 0.0),
        new THREE.Vector2(0.45, 0.0),    // base du pied
        new THREE.Vector2(0.45, 0.04),
        new THREE.Vector2(0.40, 0.06),   // bord supérieur du pied
        new THREE.Vector2(0.06, 0.08),   // transition vers la tige
        new THREE.Vector2(0.05, 0.85),   // tige (longue)
        new THREE.Vector2(0.10, 0.92),
        new THREE.Vector2(0.30, 1.10),   // début du calice
        new THREE.Vector2(0.42, 1.40),   // expansion
        new THREE.Vector2(0.40, 1.55)    // lèvre du calice
    ];

    const glassGeom = new THREE.LatheGeometry(profile, 64);
    const glassNormal = makeGlassNormalMap(256);
    glassNormal.repeat.set(1.5, 2);
    // Verre : transmission physique sans transparent:true. La
    // transmission échantillonne le framebuffer déjà rendu, donc on
    // garde depthWrite et le tri par profondeur reste fiable —
    // sinon le vin pouvait disparaître selon l'angle.
    const glass = new THREE.Mesh(
        glassGeom,
        new THREE.MeshPhysicalMaterial({
            color: 0xffffff,
            roughness: 0.02,
            metalness: 0.0,
            ior: 1.52,
            transmission: 0.95,
            thickness: 0.4,
            attenuationColor: 0xfff0e0,
            attenuationDistance: 1.4,
            normalMap: glassNormal,
            normalScale: new THREE.Vector2(0.15, 0.15),
            side: THREE.DoubleSide,
            envMapIntensity: 1.4
        })
    );
    glass.castShadow = true;
    glass.receiveShadow = true;
    glass.position.set(-2.4, 5.03, -1.95);
    // Le verre se rend après le vin → transmission sample bien le rouge
    glass.renderOrder = 2;
    scene.add(glass);

    // Vin : cylindre opaque saturé rouge profond. L'emissive plus forte
    // (bord brûlé du vin chauffé par la bougie qui le traverse) donne
    // au liquide une luminosité « rétro-éclairée » lisible même en
    // pénombre — sans ça le vin disparaît en silhouette noire devant
    // le mur sombre.
    const wine = new THREE.Mesh(
        new THREE.CylinderGeometry(0.36, 0.18, 0.45, 48, 1, false),
        new THREE.MeshPhysicalMaterial({
            color: 0x901a18,
            roughness: 0.20,
            metalness: 0.0,
            emissive: 0x6a0a08,
            emissiveIntensity: 1.1,
            sheen: 0.5,
            sheenColor: 0xff5028,
            sheenRoughness: 0.4
        })
    );
    wine.position.y = 1.18;
    wine.receiveShadow = true;
    wine.renderOrder = 1;
    glass.add(wine);

    // Surface du vin : ménisque clearcoat très brillant (le reflet de
    // la flamme va s'attraper là-dessus). Couleur plus vive pour que
    // l'œil identifie immédiatement « du vin », même en mode oeil-de-bœuf.
    const wineSurface = new THREE.Mesh(
        new THREE.CircleGeometry(0.36, 48),
        new THREE.MeshPhysicalMaterial({
            color: 0xa42018,
            roughness: 0.05,
            metalness: 0.0,
            emissive: 0x501008,
            emissiveIntensity: 0.6,
            clearcoat: 1.0,
            clearcoatRoughness: 0.02,
            sheen: 0.5,
            sheenColor: 0xff7030,
            envMapIntensity: 1.8
        })
    );
    wineSurface.rotation.x = -Math.PI / 2;
    wineSurface.position.y = 1.41;
    glass.add(wineSurface);
}
