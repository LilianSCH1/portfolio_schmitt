"use strict";

import * as THREE from "three";

// Normalisation des objets 3D pour les adapter à la scène
export function normalizeObject(object, targetMaxDimension) {
    const initialBox = new THREE.Box3().setFromObject(object);
    const center = initialBox.getCenter(new THREE.Vector3());

    object.position.sub(center);

    const centeredBox = new THREE.Box3().setFromObject(object);
    const size = centeredBox.getSize(new THREE.Vector3());
    const maxDimension = Math.max(size.x, size.y, size.z) || 1;
    const scale = targetMaxDimension / maxDimension;
    object.scale.multiplyScalar(scale);

    const finalBox = new THREE.Box3().setFromObject(object);
    return finalBox.getSize(new THREE.Vector3());
}

export function placeObjectOnSurface(object, x, z, surfaceY) {
    object.position.set(x, 0, z);
    const bbox = new THREE.Box3().setFromObject(object);
    object.position.y += surfaceY - bbox.min.y;
}