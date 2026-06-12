"use strict";

import * as THREE from "three";
import { OBJLoader } from "three/addons/loaders/OBJLoader.js";
import { mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";
import { normalizeObject, placeObjectOnSurface } from "./utils.js";
import { makeHelmetMaps, makeHelmetColorMap } from "./proceduralTextures.js";

// Reflet dynamique du casque (CubeCamera). Update 1 frame sur 3.
let helmetMesh = null;
let cubeCamera = null;
let cubeRT = null;
let frameCount = 0;

export function loadHelmet(scene, envMap) {
    const loader = new OBJLoader();
    loader.load(
        "object3D/casque_threejs.obj",
        (helmet) => {
            const maps = makeHelmetMaps(512);
            const colorMap = makeHelmetColorMap(512);
            // repeat (1, 1) : une seule passe autour du heaume. Avec >1 on
            // verrait les coutures (la texture n'est pas tilable).
            [maps.normalMap, maps.roughnessMap, maps.metalnessMap,
             maps.displacementMap, maps.specularMap,
             maps.aoMap, maps.emissiveMap, maps.clearcoatMap, maps.bumpMap,
             colorMap]
                .forEach(t => t.repeat.set(1, 1));

            cubeRT = new THREE.WebGLCubeRenderTarget(64, {
                generateMipmaps: true,
                minFilter: THREE.LinearMipmapLinearFilter,
                colorSpace: THREE.SRGBColorSpace
            });
            cubeCamera = new THREE.CubeCamera(0.5, 50, cubeRT);

            helmet.traverse((child) => {
                if (child.isMesh) {
                    let geom = child.geometry;
                    // L'OBJ a un atlas UV inutilisable (1740 UVs pour ~9000
                    // vertices). On strip tout, on soude les sommets sur les
                    // positions, on lisse les normales, puis on reprojette
                    // en cylindrique propre.
                    geom.deleteAttribute("uv");
                    geom.deleteAttribute("uv1");
                    geom.deleteAttribute("normal");

                    geom = mergeVertices(geom, 1e-4);
                    geom.computeVertexNormals();
                    // generateCylindricalUVs désindexe la géométrie pour
                    // casser la couture U=0/U=1 sans étirement. Les normales
                    // lissées sont dupliquées (pas de recompute après !).
                    geom = generateCylindricalUVs(geom);
                    geom.setAttribute("uv1", new THREE.BufferAttribute(
                        geom.attributes.uv.array, 2
                    ));
                    child.geometry = geom;

                    // 10 maps : color, normal, rough, metal, displacement,
                    // specular, ao, emissive, clearcoat, bump. envMap =
                    // CubeCamera dynamique = vraie reflectionMap.
                    child.material = new THREE.MeshPhysicalMaterial({
                        color: 0xb89878,
                        map: colorMap,
                        metalness: 1.0,
                        roughness: 1.0,
                        metalnessMap: maps.metalnessMap,
                        roughnessMap: maps.roughnessMap,
                        normalMap: maps.normalMap,
                        normalScale: new THREE.Vector2(0.8, 0.8),
                        bumpMap: maps.bumpMap,
                        bumpScale: 0.003,
                        // displacement à 0 : la projection cylindrique pince
                        // au sommet du dôme, le relief est porté par normalMap
                        displacementMap: maps.displacementMap,
                        displacementScale: 0.0,
                        displacementBias: 0.0,
                        specularIntensity: 1.0,
                        specularIntensityMap: maps.specularMap,
                        aoMap: maps.aoMap,
                        aoMapIntensity: 1.0,
                        emissive: 0xff8030,
                        emissiveMap: maps.emissiveMap,
                        emissiveIntensity: 0.30,
                        clearcoat: 0.45,
                        clearcoatMap: maps.clearcoatMap,
                        clearcoatRoughness: 0.25,
                        envMap: cubeRT.texture,
                        envMapIntensity: 2.2,
                        flatShading: false
                    });
                    child.material.needsUpdate = true;
                    child.castShadow = true;
                    child.receiveShadow = true;
                    helmetMesh = child;
                }
            });

            normalizeObject(helmet, 3.4);
            helmet.rotation.set(0.1, -0.40, 0.10);
            // Posé sur le glaive (manche à Y≈5.55 après scale)
            placeObjectOnSurface(helmet, 0.8, -2.2, 4.95);

            helmet.updateMatrixWorld(true);
            const bbox = new THREE.Box3().setFromObject(helmet);
            const center = bbox.getCenter(new THREE.Vector3());
            cubeCamera.position.copy(center);
            scene.add(cubeCamera);
            scene.add(helmet);
        },
        undefined,
        (error) => {
            console.error("Erreur de chargement du casque:", error);
        }
    );
}

export function updateHelmetReflection(renderer, scene) {
    if (!cubeCamera || !helmetMesh) return;
    if ((frameCount++ % 3) !== 0) return;
    const wasVisible = helmetMesh.visible;
    helmetMesh.visible = false;
    cubeCamera.update(renderer, scene);
    helmetMesh.visible = wasVisible;
}

// U = angle autour de Y, V = Y normalisé. On désindexe par triangle pour
// gérer la couture U=0/U=1 sans étirement.
function generateCylindricalUVs(geom) {
    if (geom.index) geom = geom.toNonIndexed();

    const pos = geom.attributes.position;
    const uvs = new Float32Array(pos.count * 2);

    geom.computeBoundingBox();
    const yMin = geom.boundingBox.min.y;
    const yMax = geom.boundingBox.max.y;
    const yRange = yMax - yMin || 1;

    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i += 3) {
        const us = [];
        const vs = [];
        for (let k = 0; k < 3; k++) {
            v.fromBufferAttribute(pos, i + k);
            us.push(0.5 + Math.atan2(v.z, v.x) / (2 * Math.PI));
            vs.push((v.y - yMin) / yRange);
        }
        const uMin = Math.min(...us), uMax = Math.max(...us);
        if (uMax - uMin > 0.5) {
            for (let k = 0; k < 3; k++) if (us[k] < 0.5) us[k] += 1.0;
        }
        for (let k = 0; k < 3; k++) {
            uvs[(i + k) * 2]     = us[k];
            uvs[(i + k) * 2 + 1] = vs[k];
        }
    }
    geom.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
    return geom;
}
