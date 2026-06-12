"use strict";

import * as THREE from "three";
import { placeObjectOnSurface } from "./utils.js";
import { makeFlameSpriteTexture, makeCandleNormalMap } from "./proceduralTextures.js";

export function addCandleLight(scene) {
    const candleGroup = new THREE.Group();

    const base = new THREE.Mesh(
        new THREE.CylinderGeometry(0.22, 0.28, 0.35, 24),
        new THREE.MeshStandardMaterial({ color: 0x2d2219, roughness: 0.85 })
    );
    base.position.y = 0.175;
    base.castShadow = true;
    base.receiveShadow = true;

    const dripNormal = makeCandleNormalMap(512);
    dripNormal.wrapS = dripNormal.wrapT = THREE.RepeatWrapping;
    dripNormal.repeat.set(1, 1);

    // Cire — emissive faible pour simuler le SSS
    const waxMat = new THREE.MeshPhysicalMaterial({
        color: 0xe5d4b0,
        roughness: 0.55,
        metalness: 0.0,
        normalMap: dripNormal,
        normalScale: new THREE.Vector2(2.5, 2.5),
        emissive: 0x3a1e08,
        emissiveIntensity: 0.18,
        clearcoat: 0.15,
        clearcoatRoughness: 0.6
    });

    const body = new THREE.Mesh(
        new THREE.CylinderGeometry(0.16, 0.2, 1.35, 48),
        waxMat
    );
    body.position.y = 1.02;
    body.castShadow = true;
    body.receiveShadow = true;

    // Coulures de cire au sommet — castShadow off (la PointLight proche
    // produisait des ombres dures sur le corps de la bougie)
    const dripCount = 5;
    const drips = [];
    for (let i = 0; i < dripCount; i++) {
        const ang = (i / dripCount) * Math.PI * 2 + Math.random() * 0.4;
        const len = 0.18 + Math.random() * 0.32;
        const drip = new THREE.Mesh(
            new THREE.CylinderGeometry(0.025, 0.06, len, 10),
            waxMat
        );
        const r = 0.165;
        drip.position.set(
            Math.cos(ang) * r,
            1.02 + 0.66 - len * 0.5,
            Math.sin(ang) * r
        );
        drip.castShadow = false;
        drip.receiveShadow = true;
        drips.push(drip);
    }

    // Goutte arrondie en bas de chaque coulure
    const dropMeshes = [];
    for (const d of drips) {
        const drop = new THREE.Mesh(
            new THREE.SphereGeometry(0.055, 12, 10),
            waxMat
        );
        drop.position.copy(d.position);
        drop.position.y -= d.geometry.parameters.height * 0.5;
        drop.castShadow = false;
        drop.receiveShadow = true;
        dropMeshes.push(drop);
    }

    // Petit creux sombre autour de la mèche (cire fondue)
    const meltedTop = new THREE.Mesh(
        new THREE.CylinderGeometry(0.13, 0.16, 0.04, 24),
        new THREE.MeshStandardMaterial({
            color: 0x8a6230,
            roughness: 0.4,
            metalness: 0.0,
            emissive: 0x6a3008,
            emissiveIntensity: 0.5
        })
    );
    meltedTop.position.y = 1.69;
    meltedTop.receiveShadow = true;

    const wick = new THREE.Mesh(
        new THREE.CylinderGeometry(0.012, 0.012, 0.16, 8),
        new THREE.MeshStandardMaterial({
            color: 0x1a1208,
            roughness: 1.0,
            emissive: 0x401800,
            emissiveIntensity: 0.6
        })
    );
    wick.position.y = 1.78;

    candleGroup.add(base, body, ...drips, ...dropMeshes, meltedTop, wick);

    const initialBounds = new THREE.Box3().setFromObject(candleGroup);
    const currentHeight = initialBounds.getSize(new THREE.Vector3()).y || 1;
    const targetHeight = 3.0;
    candleGroup.scale.y = targetHeight / currentHeight;

    // Position calée sur le tableau de référence
    const candleX = -3.3;
    const candleZ = -2.6;
    placeObjectOnSurface(candleGroup, candleX, candleZ, 5.03);

    const candleBounds = new THREE.Box3().setFromObject(candleGroup);
    const flameY = candleBounds.max.y + 0.12;

    // Cœur lumineux — toneMapped:false pour rester saturée
    const flame = new THREE.Mesh(
        new THREE.SphereGeometry(0.09, 16, 16),
        new THREE.MeshBasicMaterial({
            color: 0xfff8e0,
            toneMapped: false
        })
    );
    flame.position.set(candleX, flameY, candleZ);

    // Sprite du halo (face caméra, additif)
    const flameSpriteTex = makeFlameSpriteTexture(256);
    const flameSpriteMat = new THREE.SpriteMaterial({
        map: flameSpriteTex,
        color: 0xffc060,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending
    });
    flameSpriteMat.toneMapped = false;
    const flameSprite = new THREE.Sprite(flameSpriteMat);
    flameSprite.scale.set(0.85, 1.30, 1);
    flameSprite.position.set(candleX, flameY + 0.22, candleZ);

    // Halo plus large + plus diffus en arrière-plan
    const glowSpriteMat = new THREE.SpriteMaterial({
        map: flameSpriteTex,
        color: 0xff6a18,
        transparent: true,
        opacity: 0.75,
        depthWrite: false,
        blending: THREE.AdditiveBlending
    });
    glowSpriteMat.toneMapped = false;
    const glowSprite = new THREE.Sprite(glowSpriteMat);
    glowSprite.scale.set(3.2, 3.2, 1);
    glowSprite.position.set(candleX, flameY + 0.10, candleZ);

    const pointLight = new THREE.PointLight(0xffa040, 18, 18, 1.5);
    pointLight.position.copy(flame.position);
    pointLight.castShadow = true;
    // PointLight = 6 shadow maps → 1024 pour ne pas tuer le fps
    pointLight.shadow.mapSize.set(1024, 1024);
    pointLight.shadow.bias = -0.0005;
    pointLight.shadow.normalBias = 0.03;
    pointLight.shadow.camera.near = 0.1;
    pointLight.shadow.camera.far = 18;
    pointLight.shadow.radius = 8;
    pointLight.shadow.blurSamples = 24;

    scene.add(candleGroup, flame, glowSprite, flameSprite, pointLight);

    // Vacillement : somme de 3 sinusoïdes désynchronisées
    let baseIntensity = pointLight.intensity;
    const baseScale = flameSprite.scale.clone();
    const baseGlowScale = glowSprite.scale.clone();
    function update(elapsed) {
        const flicker = (Math.sin(elapsed * 11.3) * 0.5 + Math.sin(elapsed * 19.7) * 0.5
                       + Math.sin(elapsed * 7.1 + 1.2) * 0.3) * 0.4;
        pointLight.intensity = baseIntensity + flicker * (baseIntensity * 0.22);
        flameSprite.scale.set(
            baseScale.x * (1 + flicker * 0.10),
            baseScale.y * (1 + flicker * 0.16),
            1
        );
        glowSprite.scale.set(
            baseGlowScale.x * (1 + flicker * 0.07),
            baseGlowScale.y * (1 + flicker * 0.07),
            1
        );
        flame.position.x = candleX + flicker * 0.025;
        flame.position.z = candleZ + flicker * 0.015;
    }

    function setBaseIntensity(v) { baseIntensity = v; }

    return { candleGroup, update, setBaseIntensity, pointLight };
}
