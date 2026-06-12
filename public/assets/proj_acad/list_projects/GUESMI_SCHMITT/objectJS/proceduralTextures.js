"use strict";

import * as THREE from "three";

// Textures procédurales (CanvasTexture). Pour chaque matériau, color +
// normal + roughness sont calculés depuis le même heightfield → le relief
// tombe pile sur les motifs de couleur.

function createCanvas(size) {
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    return canvas;
}

function mulberry32(seed) {
    return function () {
        seed |= 0;
        seed = (seed + 0x6d2b79f5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

// PIERRE — palette tan/ocre, blocs maçonnés, normal dérivée par Sobel
// sur le heightfield (relief bombé, pas de biseau plat).
export function makeStoneSet(size = 512) {
    const colorC = createCanvas(size);
    const heightC = createCanvas(size);
    const roughC = createCanvas(size);
    const aoC = createCanvas(size);
    const cCtx = colorC.getContext("2d");
    const hCtx = heightC.getContext("2d");
    const rCtx = roughC.getContext("2d");
    const aoCtx = aoC.getContext("2d");
    const rand = mulberry32(42);

    cCtx.fillStyle = "#15100a"; cCtx.fillRect(0, 0, size, size);
    hCtx.fillStyle = "#000000"; hCtx.fillRect(0, 0, size, size);
    rCtx.fillStyle = "#f0f0f0"; rCtx.fillRect(0, 0, size, size);
    aoCtx.fillStyle = "#202020"; aoCtx.fillRect(0, 0, size, size);

    const blocks = [];
    let y = 0;
    let row = 0;
    while (y < size) {
        const baseH = size / (4 + (row % 2) * 0.5);
        const rowH = baseH * (0.85 + rand() * 0.4);
        const offset = (rand() - 0.3) * (size / 5);
        let x = -offset;
        while (x < size) {
            const w = (size / 4.2) + rand() * (size / 6);
            blocks.push({ x, y, w, h: rowH });
            x += w;
        }
        y += rowH;
        row++;
    }

    for (const b of blocks) {
        const family = rand();
        let baseR, baseG, baseB;
        if (family < 0.55) {
            baseR = 165 + rand() * 35; baseG = 140 + rand() * 30; baseB = 105 + rand() * 25;
        } else if (family < 0.85) {
            baseR = 135 + rand() * 30; baseG = 100 + rand() * 25; baseB = 70 + rand() * 20;
        } else {
            baseR = 125 + rand() * 25; baseG = 115 + rand() * 20; baseB = 100 + rand() * 18;
        }

        const grad = cCtx.createLinearGradient(b.x, b.y, b.x + b.w * 0.7, b.y + b.h);
        grad.addColorStop(0, `rgb(${baseR + 20}, ${baseG + 15}, ${baseB + 8})`);
        grad.addColorStop(0.5, `rgb(${baseR}, ${baseG}, ${baseB})`);
        grad.addColorStop(1, `rgb(${baseR - 35}, ${baseG - 28}, ${baseB - 22})`);
        cCtx.fillStyle = grad;
        cCtx.fillRect(b.x + 3, b.y + 3, b.w - 6, b.h - 6);

        // Heightfield : dôme radial doux par bloc → relief bombé naturel
        // (le centre dépasse, les bords plongent dans le joint).
        const hGrad = hCtx.createRadialGradient(
            b.x + b.w / 2, b.y + b.h / 2, 0,
            b.x + b.w / 2, b.y + b.h / 2, Math.max(b.w, b.h) * 0.55
        );
        hGrad.addColorStop(0, `rgb(${200 + Math.floor(rand() * 30)},${200 + Math.floor(rand() * 30)},${200 + Math.floor(rand() * 30)})`);
        hGrad.addColorStop(0.75, "#969696");
        hGrad.addColorStop(1, "#1a1a1a");
        hCtx.fillStyle = hGrad;
        hCtx.fillRect(b.x + 1, b.y + 1, b.w - 2, b.h - 2);

        if (rand() < 0.5) {
            const tx = b.x + rand() * b.w;
            const ty = b.y + b.h * (0.55 + rand() * 0.4);
            const tr = b.h * (0.3 + rand() * 0.4);
            const tg = cCtx.createRadialGradient(tx, ty, 0, tx, ty, tr);
            tg.addColorStop(0, `rgba(40, 28, 18, 0.55)`);
            tg.addColorStop(1, `rgba(40, 28, 18, 0)`);
            cCtx.fillStyle = tg;
            cCtx.beginPath(); cCtx.arc(tx, ty, tr, 0, Math.PI * 2); cCtx.fill();
        }

        // Pittings : creux + sombres en couleur, creux dans le heightfield aussi
        for (let i = 0; i < 70; i++) {
            const px = b.x + 4 + rand() * (b.w - 8);
            const py = b.y + 4 + rand() * (b.h - 8);
            const rr = rand() * 3.5 + 0.6;
            const lighten = rand() > 0.55;
            cCtx.fillStyle = lighten
                ? `rgba(${baseR + 40}, ${baseG + 30}, ${baseB + 20}, 0.5)`
                : `rgba(${Math.max(0, baseR - 60)}, ${Math.max(0, baseG - 50)}, ${Math.max(0, baseB - 40)}, 0.55)`;
            cCtx.beginPath(); cCtx.arc(px, py, rr, 0, Math.PI * 2); cCtx.fill();

            if (!lighten) {
                hCtx.fillStyle = `rgba(0,0,0,${0.35 + rand() * 0.3})`;
                hCtx.beginPath(); hCtx.arc(px, py, rr, 0, Math.PI * 2); hCtx.fill();
            }
        }

        // Fissures : trace partagée color + height (creux net)
        if (rand() < 0.45) {
            const path = [];
            const sx = b.x + 8 + rand() * (b.w - 16);
            const sy = b.y + 8 + rand() * (b.h - 16);
            path.push([sx, sy]);
            let cx2 = sx, cy2 = sy;
            const nseg = 5 + Math.floor(rand() * 4);
            for (let s = 0; s < nseg; s++) {
                cx2 += (rand() - 0.5) * b.w * 0.3;
                cy2 += (rand() - 0.5) * b.h * 0.3;
                path.push([cx2, cy2]);
            }
            cCtx.strokeStyle = "rgba(20, 12, 6, 0.85)";
            cCtx.lineWidth = 0.8 + rand() * 0.6;
            cCtx.beginPath();
            path.forEach(([px, py], k) => k === 0 ? cCtx.moveTo(px, py) : cCtx.lineTo(px, py));
            cCtx.stroke();

            hCtx.strokeStyle = "rgba(0, 0, 0, 0.85)";
            hCtx.lineWidth = 1.4;
            hCtx.beginPath();
            path.forEach(([px, py], k) => k === 0 ? hCtx.moveTo(px, py) : hCtx.lineTo(px, py));
            hCtx.stroke();
        }

        // Roughness : intérieur du bloc moyennement rugueux
        rCtx.fillStyle = "#7a7a7a";
        rCtx.fillRect(b.x + 4, b.y + 4, b.w - 8, b.h - 8);

        // AO : éclaircit l'intérieur, laisse le joint sombre
        const aoGrad = aoCtx.createRadialGradient(
            b.x + b.w / 2, b.y + b.h / 2, 0,
            b.x + b.w / 2, b.y + b.h / 2, Math.max(b.w, b.h) * 0.6
        );
        aoGrad.addColorStop(0, "#f0f0f0");
        aoGrad.addColorStop(0.7, "#b0b0b0");
        aoGrad.addColorStop(1, "#404040");
        aoCtx.fillStyle = aoGrad;
        aoCtx.fillRect(b.x + 3, b.y + 3, b.w - 6, b.h - 6);
    }

    // Bruit de micro-relief sur tout le heightfield (granulation pierre)
    const grainImg = hCtx.getImageData(0, 0, size, size);
    for (let i = 0; i < grainImg.data.length; i += 4) {
        const n = (rand() - 0.5) * 18;
        grainImg.data[i]     = Math.max(0, Math.min(255, grainImg.data[i]     + n));
        grainImg.data[i + 1] = Math.max(0, Math.min(255, grainImg.data[i + 1] + n));
        grainImg.data[i + 2] = Math.max(0, Math.min(255, grainImg.data[i + 2] + n));
    }
    hCtx.putImageData(grainImg, 0, 0);

    // Normal map : gradient Sobel sur le heightfield → micro-relief 2D
    const normalC = createCanvas(size);
    const nCtx = normalC.getContext("2d");
    const hImg = hCtx.getImageData(0, 0, size, size).data;
    const nImg = nCtx.createImageData(size, size);
    const strength = 5.0;
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

    const colorTex = new THREE.CanvasTexture(colorC);
    const normalTex = new THREE.CanvasTexture(normalC);
    const roughTex = new THREE.CanvasTexture(roughC);
    const aoTex = new THREE.CanvasTexture(aoC);
    [colorTex, normalTex, roughTex, aoTex].forEach(t => {
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
    });
    colorTex.colorSpace = THREE.SRGBColorSpace;
    return { colorTex, normalTex, roughTex, aoTex };
}

// BOIS — veines verticales, modulation horizontale, nœuds. Normales par Sobel.
export function makeWoodSet(size = 512) {
    const colorC = createCanvas(size);
    const heightC = createCanvas(size);
    const roughC = createCanvas(size);
    const cCtx = colorC.getContext("2d");
    const hCtx = heightC.getContext("2d");
    const rCtx = roughC.getContext("2d");
    const rand = mulberry32(7);

    // Profondeur de veine par colonne — base de la couleur du bois
    const depth = new Float32Array(size);
    for (let x = 0; x < size; x++) {
        const v1 = Math.sin(x * 0.04) * 25;
        const v2 = Math.sin(x * 0.12 + 1.5) * 15;
        const v3 = (rand() - 0.5) * 35;
        depth[x] = v1 + v2 + v3;
    }

    // Couleur de base — bois chaud reddish-brown
    for (let x = 0; x < size; x++) {
        const v = depth[x];
        const r = Math.max(35, 115 + v * 1.1);
        const g = Math.max(22, 68 + v * 0.7);
        const b = Math.max(12, 36 + v * 0.4);
        cCtx.fillStyle = `rgb(${r}, ${g}, ${b})`;
        cCtx.fillRect(x, 0, 1, size);
    }
    // Modulation horizontale (bandes claires/sombres dans le sens de la fibre)
    for (let y = 0; y < size; y += 1) {
        const a = (rand() - 0.5) * 0.12;
        if (a > 0) cCtx.fillStyle = `rgba(140, 80, 40, ${a})`;
        else cCtx.fillStyle = `rgba(20, 10, 4, ${-a})`;
        cCtx.fillRect(0, y, size, 1);
    }

    // Heightfield base — convertit la profondeur de veine en gris
    // (veines sombres = creux, intervalles clairs = saillies).
    for (let x = 0; x < size; x++) {
        const v = depth[x];
        const h = Math.max(40, Math.min(220, 130 + v * 1.6));
        hCtx.fillStyle = `rgb(${h},${h},${h})`;
        hCtx.fillRect(x, 0, 1, size);
    }

    // Roughness alignée sur la veine (sombre = rugueux)
    for (let x = 0; x < size; x++) {
        const v = depth[x];
        const rough = 180 - v * 1.8;
        const cl = Math.max(80, Math.min(230, rough));
        rCtx.fillStyle = `rgb(${cl}, ${cl}, ${cl})`;
        rCtx.fillRect(x, 0, 1, size);
    }

    // Veines noires marquées (color + height creux + rough fort)
    for (let i = 0; i < 16; i++) {
        const cx = rand() * size;
        const w = 1 + rand() * 3;
        const pts = [];
        for (let t = 0; t <= 1; t += 0.012) {
            const py = t * size;
            const px = cx + Math.sin(t * 12 + i) * 8 + Math.sin(t * 4 + i) * 4;
            pts.push([px, py]);
        }
        const drawPath = (ctx, style, lw) => {
            ctx.strokeStyle = style; ctx.lineWidth = lw;
            ctx.beginPath();
            pts.forEach(([px, py], k) => k === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py));
            ctx.stroke();
        };
        drawPath(cCtx, `rgba(15, 8, 3, ${0.5 + rand() * 0.4})`, w);
        drawPath(hCtx, "rgba(20, 20, 20, 0.85)", w + 0.5);
        drawPath(rCtx, "rgba(255, 255, 255, 0.4)", w);
    }

    // Petites stries transversales aléatoires (cassent le côté rayé pur)
    for (let i = 0; i < 25; i++) {
        const cy = rand() * size;
        const cxStart = rand() * size;
        const len = 20 + rand() * 60;
        cCtx.strokeStyle = `rgba(30, 18, 8, ${0.15 + rand() * 0.2})`;
        cCtx.lineWidth = 0.6;
        cCtx.beginPath();
        cCtx.moveTo(cxStart, cy);
        cCtx.lineTo(cxStart + len, cy + (rand() - 0.5) * 4);
        cCtx.stroke();

        hCtx.strokeStyle = `rgba(60, 60, 60, 0.4)`;
        hCtx.lineWidth = 0.6;
        hCtx.beginPath();
        hCtx.moveTo(cxStart, cy);
        hCtx.lineTo(cxStart + len, cy + (rand() - 0.5) * 4);
        hCtx.stroke();
    }

    // Nœuds (color + height + rough)
    for (let i = 0; i < 3; i++) {
        const cx = rand() * size;
        const cy = rand() * size;
        const r = 8 + rand() * 14;

        const cgrad = cCtx.createRadialGradient(cx, cy, 1, cx, cy, r);
        cgrad.addColorStop(0, "rgba(25, 12, 5, 0.95)");
        cgrad.addColorStop(0.6, "rgba(50, 25, 12, 0.4)");
        cgrad.addColorStop(1, "rgba(50, 25, 12, 0)");
        cCtx.fillStyle = cgrad;
        cCtx.beginPath(); cCtx.arc(cx, cy, r, 0, Math.PI * 2); cCtx.fill();

        const hgrad = hCtx.createRadialGradient(cx, cy, 1, cx, cy, r);
        hgrad.addColorStop(0, "rgba(0, 0, 0, 0.85)");
        hgrad.addColorStop(0.5, "rgba(60, 60, 60, 0.5)");
        hgrad.addColorStop(1, "rgba(128, 128, 128, 0)");
        hCtx.fillStyle = hgrad;
        hCtx.beginPath(); hCtx.arc(cx, cy, r, 0, Math.PI * 2); hCtx.fill();

        rCtx.fillStyle = `rgba(255, 255, 255, 0.6)`;
        rCtx.beginPath(); rCtx.arc(cx, cy, r, 0, Math.PI * 2); rCtx.fill();
    }

    // Granulation (bruit de micro-relief)
    const grainImg = hCtx.getImageData(0, 0, size, size);
    for (let i = 0; i < grainImg.data.length; i += 4) {
        const n = (rand() - 0.5) * 14;
        grainImg.data[i]     = Math.max(0, Math.min(255, grainImg.data[i]     + n));
        grainImg.data[i + 1] = Math.max(0, Math.min(255, grainImg.data[i + 1] + n));
        grainImg.data[i + 2] = Math.max(0, Math.min(255, grainImg.data[i + 2] + n));
    }
    hCtx.putImageData(grainImg, 0, 0);

    // Normal map dérivée par Sobel sur le heightfield
    const normalC = createCanvas(size);
    const nCtx = normalC.getContext("2d");
    const hImg = hCtx.getImageData(0, 0, size, size).data;
    const nImg = nCtx.createImageData(size, size);
    const strength = 4.5;
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

    // AO map dérivée du heightfield : creux (veines) → sombres,
    // bosses → claires. On floute légèrement et on remappe la
    // dynamique pour que l'effet soit subtil mais lisible.
    const aoC = createCanvas(size);
    const aoCtx = aoC.getContext("2d");
    const aoImg = aoCtx.createImageData(size, size);
    for (let i = 0; i < hImg.length; i += 4) {
        // h ∈ [0..255] : déjà l'inverse de l'occlusion. On compresse vers 0.55..1.0
        // pour ne pas trop assombrir.
        const h = hImg[i];
        const ao = Math.floor(140 + (h / 255) * 115);
        aoImg.data[i]     = ao;
        aoImg.data[i + 1] = ao;
        aoImg.data[i + 2] = ao;
        aoImg.data[i + 3] = 255;
    }
    aoCtx.putImageData(aoImg, 0, 0);

    const colorTex = new THREE.CanvasTexture(colorC);
    const normalTex = new THREE.CanvasTexture(normalC);
    const roughTex = new THREE.CanvasTexture(roughC);
    const aoTex = new THREE.CanvasTexture(aoC);
    [colorTex, normalTex, roughTex, aoTex].forEach(t => {
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
    });
    colorTex.colorSpace = THREE.SRGBColorSpace;
    return { colorTex, normalTex, roughTex, aoTex };
}

// Parchemin — fond crème jauni avec taches d'âge, brûlures de bord,
// écriture manuscrite dense (deux colonnes simulées) et capitales rouges.
export function makeParchmentTexture(size = 512) {
    const canvas = createCanvas(size);
    const ctx = canvas.getContext("2d");
    const rand = mulberry32(99);

    // Fond : dégradé radial crème → ocre → brun aux bords
    const grad = ctx.createRadialGradient(size / 2, size / 2, size * 0.15, size / 2, size / 2, size * 0.75);
    grad.addColorStop(0, "#f3e3b8");
    grad.addColorStop(0.55, "#dcc28a");
    grad.addColorStop(0.85, "#a8854a");
    grad.addColorStop(1, "#6b4a22");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);

    // Brûlures sur les bords
    for (let i = 0; i < 14; i++) {
        const edge = Math.floor(rand() * 4);
        let bx, by;
        if (edge === 0) { bx = rand() * size; by = rand() * size * 0.08; }
        else if (edge === 1) { bx = size - rand() * size * 0.08; by = rand() * size; }
        else if (edge === 2) { bx = rand() * size; by = size - rand() * size * 0.08; }
        else { bx = rand() * size * 0.08; by = rand() * size; }
        const br = 18 + rand() * 28;
        const bg = ctx.createRadialGradient(bx, by, 0, bx, by, br);
        bg.addColorStop(0, "rgba(60, 30, 10, 0.85)");
        bg.addColorStop(0.6, "rgba(110, 70, 30, 0.5)");
        bg.addColorStop(1, "rgba(110, 70, 30, 0)");
        ctx.fillStyle = bg;
        ctx.beginPath(); ctx.arc(bx, by, br, 0, Math.PI * 2); ctx.fill();
    }

    // Taches d'âge brunes
    for (let i = 0; i < 80; i++) {
        const x = rand() * size, y = rand() * size;
        const r = rand() * 25 + 4;
        const a = rand() * 0.22 + 0.05;
        ctx.fillStyle = `rgba(${90 + rand() * 40}, ${55 + rand() * 25}, ${22 + rand() * 18}, ${a})`;
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    }

    // Petites mouchetures sombres
    for (let i = 0; i < 600; i++) {
        ctx.fillStyle = `rgba(40, 22, 8, ${rand() * 0.3})`;
        ctx.fillRect(rand() * size, rand() * size, 1 + rand() * 1.5, 1 + rand() * 1.5);
    }

    // Lettrine rouge en haut à gauche (carré décoratif)
    const lx = size * 0.13, ly = size * 0.18, ls = size * 0.10;
    ctx.fillStyle = "rgba(120, 25, 18, 0.85)";
    ctx.fillRect(lx, ly, ls, ls);
    ctx.strokeStyle = "rgba(40, 12, 5, 0.95)";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(lx, ly, ls, ls);
    // Faux glyphe central
    ctx.fillStyle = "rgba(30, 10, 5, 0.9)";
    ctx.font = `${Math.floor(ls * 0.7)}px serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("E", lx + ls / 2, ly + ls / 2 + 2);

    // Écriture : lignes ondulées de "texte" sur deux colonnes simulées,
    // avec pseudo-mots de longueurs variables.
    const lineColor = "rgba(30, 18, 8, 0.85)";
    const lineH = size * 0.038;
    const startY = size * 0.31;
    const endY = size * 0.92;
    const colMargin = size * 0.13;
    const colGap = size * 0.05;
    const colW = (size - 2 * colMargin - colGap) / 2;

    for (let col = 0; col < 2; col++) {
        const xStart = colMargin + col * (colW + colGap);
        let y2 = startY;
        // La lettrine occupe le haut de la colonne 0
        if (col === 0) y2 = ly + ls + size * 0.025;
        while (y2 < endY) {
            // Texte simulé : suite de petits segments inégaux pour évoquer des mots
            let x2 = xStart;
            const lineEnd = xStart + colW * (0.85 + rand() * 0.15);
            ctx.strokeStyle = lineColor;
            while (x2 < lineEnd) {
                const wordW = 8 + rand() * 26;
                const wordH = lineH * (0.45 + rand() * 0.2);
                ctx.lineWidth = 1.4 + rand() * 0.8;
                ctx.beginPath();
                // Petite ondulation par mot
                for (let s = 0; s < 4; s++) {
                    const sx = x2 + (s / 3) * wordW;
                    const sy = y2 + Math.sin(s * 1.4 + col + rand()) * 1.5;
                    if (s === 0) ctx.moveTo(sx, sy);
                    else ctx.lineTo(sx, sy);
                }
                ctx.stroke();

                // Hampes verticales aléatoires (ascendants/descendants)
                if (rand() < 0.35) {
                    const hx = x2 + rand() * wordW;
                    const up = rand() < 0.6;
                    ctx.beginPath();
                    ctx.moveTo(hx, y2);
                    ctx.lineTo(hx + (rand() - 0.5) * 2, y2 + (up ? -wordH : wordH));
                    ctx.stroke();
                }
                x2 += wordW + 4 + rand() * 4;
            }
            y2 += lineH;
        }
    }

    // Quelques "rubrications" rouges (mots en rouge éparpillés)
    ctx.strokeStyle = "rgba(130, 30, 18, 0.85)";
    for (let i = 0; i < 8; i++) {
        const ry = startY + rand() * (endY - startY);
        const rx = colMargin + rand() * (colW * 0.6);
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        for (let s = 0; s < 5; s++) {
            const sx = rx + s * 4;
            const sy = ry + Math.sin(s) * 1.5;
            if (s === 0) ctx.moveTo(sx, sy);
            else ctx.lineTo(sx, sy);
        }
        ctx.stroke();
    }

    // Plis usés : lignes très fines plus claires (effet de relief)
    ctx.strokeStyle = "rgba(255, 230, 180, 0.18)";
    ctx.lineWidth = 1;
    for (let i = 0; i < 5; i++) {
        ctx.beginPath();
        const sx = rand() * size;
        const sy = rand() * size;
        const ex = sx + (rand() - 0.5) * size * 0.6;
        const ey = sy + (rand() - 0.5) * size * 0.6;
        ctx.moveTo(sx, sy);
        ctx.lineTo(ex, ey);
        ctx.stroke();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
}

// Normal map du parchemin : froissures douces (faible amplitude)
export function makeParchmentNormalMap(size = 256) {
    const canvas = createCanvas(size);
    const ctx = canvas.getContext("2d");
    const rand = mulberry32(33);
    ctx.fillStyle = "rgb(128,128,255)";
    ctx.fillRect(0, 0, size, size);

    // Plis : bandes à orientations aléatoires
    for (let i = 0; i < 40; i++) {
        const cx = rand() * size, cy = rand() * size;
        const ang = rand() * Math.PI;
        const len = 30 + rand() * 90;
        const w = 4 + rand() * 8;
        const dx = Math.cos(ang), dy = Math.sin(ang);
        const nx = -dy * 0.6, ny = dx * 0.6; // perpendiculaire
        const r = Math.floor(128 + nx * 90);
        const g = Math.floor(128 + ny * 90);
        ctx.strokeStyle = `rgb(${r},${g},230)`;
        ctx.lineWidth = w;
        ctx.beginPath();
        ctx.moveTo(cx - dx * len / 2, cy - dy * len / 2);
        ctx.lineTo(cx + dx * len / 2, cy + dy * len / 2);
        ctx.stroke();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    return tex;
}

// Sprite de flamme — gradient radial transparent
export function makeFlameSpriteTexture(size = 256) {
    const canvas = createCanvas(size);
    const ctx = canvas.getContext("2d");
    const cx = size / 2, cy = size * 0.55;
    const grad = ctx.createRadialGradient(cx, cy, 2, cx, cy, size * 0.45);
    grad.addColorStop(0.0, "rgba(255,255,220,1)");
    grad.addColorStop(0.25, "rgba(255,210,120,0.9)");
    grad.addColorStop(0.55, "rgba(255,140,50,0.6)");
    grad.addColorStop(0.85, "rgba(180,60,20,0.2)");
    grad.addColorStop(1.0, "rgba(0,0,0,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
}

// CASQUE — 10 maps PBR. Fente de visière + rebord saillant + rivets +
// rainure axiale + arc décoratif sur le dôme. Tout dérivé du heightfield.
export function makeHelmetMaps(size = 512) {
    const heightC = createCanvas(size);
    const roughC  = createCanvas(size);
    const metalC  = createCanvas(size);
    const specC   = createCanvas(size);
    const aoC     = createCanvas(size);
    const emisC   = createCanvas(size);
    const clearC  = createCanvas(size);
    const hCtx = heightC.getContext("2d");
    const rCtx = roughC.getContext("2d");
    const mCtx = metalC.getContext("2d");
    const sCtx = specC.getContext("2d");
    const aoCtx = aoC.getContext("2d");
    const emCtx = emisC.getContext("2d");
    const clCtx = clearC.getContext("2d");
    const rand = mulberry32(123);

    // Bases acier : poli moyen, full métal, spéculaire forte
    hCtx.fillStyle = "#7a7a7a"; hCtx.fillRect(0, 0, size, size);
    rCtx.fillStyle = "#666666"; rCtx.fillRect(0, 0, size, size);
    mCtx.fillStyle = "#f0f0f0"; mCtx.fillRect(0, 0, size, size);
    sCtx.fillStyle = "#cfcfcf"; sCtx.fillRect(0, 0, size, size);
    aoCtx.fillStyle = "#e0e0e0"; aoCtx.fillRect(0, 0, size, size);
    emCtx.fillStyle = "#000000"; emCtx.fillRect(0, 0, size, size);
    clCtx.fillStyle = "#404040"; clCtx.fillRect(0, 0, size, size);

    // Martelage forgé : grosses bosses espacées, gradient doux
    const cell = 64;
    for (let y = 0; y < size; y += cell) {
        for (let x = 0; x < size; x += cell) {
            const cx = x + cell / 2 + (rand() - 0.5) * 12;
            const cy = y + cell / 2 + (rand() - 0.5) * 12;
            const r = cell * 0.42 + rand() * 6;
            const grad = hCtx.createRadialGradient(cx, cy, 0, cx, cy, r);
            grad.addColorStop(0, "#8e8e8e");
            grad.addColorStop(0.7, "#7a7a7a");
            grad.addColorStop(1, "#6e6e6e");
            hCtx.fillStyle = grad;
            hCtx.beginPath(); hCtx.arc(cx, cy, r, 0, Math.PI * 2); hCtx.fill();
        }
    }

    // Fente des yeux — creux sombre fin (V≈0.57)
    const slitY = size * 0.43;
    const slitH = 8;
    hCtx.fillStyle = "#101010";
    hCtx.fillRect(0, slitY - slitH / 2, size, slitH);
    rCtx.fillStyle = "rgba(255, 255, 255, 0.45)";
    rCtx.fillRect(0, slitY - slitH / 2, size, slitH);
    sCtx.fillStyle = "rgba(60, 60, 60, 0.8)";
    sCtx.fillRect(0, slitY - slitH / 2, size, slitH);

    // Rebord saillant juste au-dessus — la lèvre du masque
    const ridgeY = slitY - 7;
    const ridgeH = 5;
    const ridgeGrad = hCtx.createLinearGradient(0, ridgeY - ridgeH / 2, 0, ridgeY + ridgeH / 2);
    ridgeGrad.addColorStop(0, "#8a8a8a");
    ridgeGrad.addColorStop(0.5, "#d8d8d8");
    ridgeGrad.addColorStop(1, "#8a8a8a");
    hCtx.fillStyle = ridgeGrad;
    hCtx.fillRect(0, ridgeY - ridgeH / 2, size, ridgeH);
    rCtx.fillStyle = "#4a4a4a"; // arête polie, plus lisse
    rCtx.fillRect(0, ridgeY - ridgeH / 2, size, ridgeH);
    sCtx.fillStyle = "#ffffff";
    sCtx.fillRect(0, ridgeY - ridgeH / 2, size, ridgeH);
    clCtx.fillStyle = "#f0f0f0";
    clCtx.fillRect(0, ridgeY - ridgeH / 2 + 1, size, ridgeH - 2);
    // Lèvre chaude — reflet de bougie qui accroche l'arête
    const ridgeEm = emCtx.createLinearGradient(0, ridgeY - ridgeH / 2, 0, ridgeY + ridgeH / 2);
    ridgeEm.addColorStop(0, "rgba(0, 0, 0, 0)");
    ridgeEm.addColorStop(0.5, "rgba(120, 55, 20, 0.7)");
    ridgeEm.addColorStop(1, "rgba(0, 0, 0, 0)");
    emCtx.fillStyle = ridgeEm;
    emCtx.fillRect(0, ridgeY - ridgeH / 2, size, ridgeH);

    // Rivets de fixation de la visière (sous la fente)
    function placeRivet(x, y, r) {
        const hg = hCtx.createRadialGradient(x - r * 0.35, y - r * 0.35, 0, x, y, r);
        hg.addColorStop(0, "#ffffff");
        hg.addColorStop(0.55, "#c8c8c8");
        hg.addColorStop(1, "#404040");
        hCtx.fillStyle = hg;
        hCtx.beginPath(); hCtx.arc(x, y, r, 0, Math.PI * 2); hCtx.fill();
        hCtx.strokeStyle = "rgba(20, 20, 20, 0.55)";
        hCtx.lineWidth = 1.2;
        hCtx.beginPath(); hCtx.arc(x, y, r + 0.8, 0, Math.PI * 2); hCtx.stroke();
        rCtx.fillStyle = "#1a1a1a";
        rCtx.beginPath(); rCtx.arc(x, y, r, 0, Math.PI * 2); rCtx.fill();
        mCtx.fillStyle = "#ffffff";
        mCtx.beginPath(); mCtx.arc(x, y, r, 0, Math.PI * 2); mCtx.fill();
        sCtx.fillStyle = "#ffffff";
        sCtx.beginPath(); sCtx.arc(x, y, r, 0, Math.PI * 2); sCtx.fill();
    }
    // 6 rivets espacés sur le tour, juste sous la fente
    const rivetRowY = slitY + slitH / 2 + 8;
    for (let i = 0; i < 6; i++) {
        const rx = (i + 0.5) * (size / 6);
        placeRivet(rx, rivetRowY, 4);
    }

    // Rainure axiale du protège-menton — centrée sur le FRONT visible du
    // heaume (U≈0.71 après la rotation Y=-0.40). Pleine hauteur du heaume,
    // bien marquée avec lèvres claires sur les bords.
    const frontX = size * 0.71;
    const grooveW2 = 10;
    const grooveTop = size * 0.02;  // tout en haut du heaume
    const grooveBot = size * 0.98;  // tout en bas
    hCtx.fillStyle = "#000000";
    hCtx.fillRect(frontX - grooveW2 / 2, grooveTop, grooveW2, grooveBot - grooveTop);
    hCtx.fillStyle = "#e0e0e0";
    hCtx.fillRect(frontX - grooveW2 / 2 - 2, grooveTop, 2, grooveBot - grooveTop);
    hCtx.fillRect(frontX + grooveW2 / 2,     grooveTop, 2, grooveBot - grooveTop);
    rCtx.fillStyle = "rgba(255, 255, 255, 0.6)";
    rCtx.fillRect(frontX - grooveW2 / 2, grooveTop, grooveW2, grooveBot - grooveTop);
    sCtx.fillStyle = "rgba(40, 40, 40, 0.8)";
    sCtx.fillRect(frontX - grooveW2 / 2, grooveTop, grooveW2, grooveBot - grooveTop);

    // Deux arcs en parenthèses )( — TRÈS étroits en U (canvas X) et étendus
    // en V (canvas Y) pour qu'ils se lisent comme verticaux sur le heaume.
    // Centrés autour du front (U=0.71).
    function drawHelmetArc(ctx, x0, y0, cx, cy, x1, y1, style, width) {
        ctx.strokeStyle = style;
        ctx.lineWidth = width;
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.quadraticCurveTo(cx, cy, x1, y1);
        ctx.stroke();
    }
    const archW2 = 5;
    const archGap = size * 0.06;
    const archTopY = size * 0.06;
    const archMidY = size * 0.20;
    const archEndY = ridgeY - 8;
    const archCenterX = frontX;
    // Arc gauche : start (front - 0.10, top) → ctrl (front - 0.13, mid)
    //              → end (front - gap, near visor)
    [["#000000", hCtx],
     ["rgba(255, 255, 255, 0.55)", rCtx],
     ["rgba(50, 50, 50, 0.75)", sCtx]].forEach(([style, ctx]) => {
        drawHelmetArc(ctx,
            archCenterX - size * 0.10, archTopY,
            archCenterX - size * 0.13, archMidY,
            archCenterX - archGap, archEndY,
            style, archW2);
        // Arc droit miroir
        drawHelmetArc(ctx,
            archCenterX + size * 0.10, archTopY,
            archCenterX + size * 0.13, archMidY,
            archCenterX + archGap, archEndY,
            style, archW2);
    });

    // Griffures de combat
    for (let i = 0; i < 18; i++) {
        const x = rand() * size, y = rand() * size;
        const len = 30 + rand() * 70;
        const ang = rand() * Math.PI;
        const x2 = x + Math.cos(ang) * len;
        const y2 = y + Math.sin(ang) * len;
        const lw = 0.9 + rand() * 1.3;

        hCtx.strokeStyle = "#202020"; hCtx.lineWidth = lw;
        hCtx.beginPath(); hCtx.moveTo(x, y); hCtx.lineTo(x2, y2); hCtx.stroke();

        rCtx.strokeStyle = "#d8d8d8"; rCtx.lineWidth = lw + 0.5;
        rCtx.beginPath(); rCtx.moveTo(x, y); rCtx.lineTo(x2, y2); rCtx.stroke();

        sCtx.strokeStyle = "#808080"; sCtx.lineWidth = lw + 0.5;
        sCtx.beginPath(); sCtx.moveTo(x, y); sCtx.lineTo(x2, y2); sCtx.stroke();
    }

    // Normal map dérivée par Sobel
    const normalC = createCanvas(size);
    const nCtx = normalC.getContext("2d");
    const hImg = hCtx.getImageData(0, 0, size, size).data;
    const nImg = nCtx.createImageData(size, size);
    const strength = 5.0;
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const xL = (x - 1 + size) % size, xR = (x + 1) % size;
            const yU = (y - 1 + size) % size, yD = (y + 1) % size;
            const hL = hImg[(y * size + xL) * 4] / 255;
            const hR = hImg[(y * size + xR) * 4] / 255;
            const hU = hImg[(yU * size + x) * 4] / 255;
            const hD = hImg[(yD * size + x) * 4] / 255;
            let nx = (hL - hR) * strength;
            let ny = (hU - hD) * strength;
            let nz = 1.0;
            const inv = 1 / Math.sqrt(nx * nx + ny * ny + nz * nz);
            nx *= inv; ny *= inv; nz *= inv;
            const idx = (y * size + x) * 4;
            nImg.data[idx]     = Math.floor(128 + nx * 127);
            nImg.data[idx + 1] = Math.floor(128 + ny * 127);
            nImg.data[idx + 2] = Math.floor(128 + nz * 127);
            nImg.data[idx + 3] = 255;
        }
    }
    nCtx.putImageData(nImg, 0, 0);

    // AO dérivée : les creux assombrissent. Compression vers [120..255]
    // pour ne pas noircir complètement.
    const aoImg = aoCtx.createImageData(size, size);
    for (let i = 0; i < hImg.length; i += 4) {
        const h = hImg[i];
        const ao = Math.floor(120 + (h / 255) * 135);
        aoImg.data[i]     = ao;
        aoImg.data[i + 1] = ao;
        aoImg.data[i + 2] = ao;
        aoImg.data[i + 3] = 255;
    }
    aoCtx.putImageData(aoImg, 0, 0);

    // Bump = grain de surface qui accroche la lumière rasante
    const bumpC = createCanvas(size);
    const bumpCtx = bumpC.getContext("2d");
    const bumpImg = bumpCtx.createImageData(size, size);
    for (let i = 0; i < bumpImg.data.length; i += 4) {
        const g = Math.floor(hImg[i] * 0.5 + rand() * 128);
        bumpImg.data[i]     = g;
        bumpImg.data[i + 1] = g;
        bumpImg.data[i + 2] = g;
        bumpImg.data[i + 3] = 255;
    }
    bumpCtx.putImageData(bumpImg, 0, 0);

    const normalMap       = new THREE.CanvasTexture(normalC);
    const roughnessMap    = new THREE.CanvasTexture(roughC);
    const metalnessMap    = new THREE.CanvasTexture(metalC);
    const displacementMap = new THREE.CanvasTexture(heightC);
    const specularMap     = new THREE.CanvasTexture(specC);
    const aoMap           = new THREE.CanvasTexture(aoC);
    const emissiveMap     = new THREE.CanvasTexture(emisC);
    const clearcoatMap    = new THREE.CanvasTexture(clearC);
    const bumpMap         = new THREE.CanvasTexture(bumpC);

    emissiveMap.colorSpace = THREE.SRGBColorSpace;

    [normalMap, roughnessMap, metalnessMap, displacementMap, specularMap,
     aoMap, emissiveMap, clearcoatMap, bumpMap].forEach(t => {
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
    });

    return { normalMap, roughnessMap, metalnessMap, displacementMap, specularMap,
             aoMap, emissiveMap, clearcoatMap, bumpMap };
}

// CASQUE — color map alignée sur les ornements de makeHelmetMaps
export function makeHelmetColorMap(size = 512) {
    const canvas = createCanvas(size);
    const ctx = canvas.getContext("2d");
    const rand = mulberry32(89);

    // Acier sombre de base
    const baseGrad = ctx.createLinearGradient(0, 0, 0, size);
    baseGrad.addColorStop(0, "#5a5560");
    baseGrad.addColorStop(0.5, "#4a4650");
    baseGrad.addColorStop(1, "#3a3640");
    ctx.fillStyle = baseGrad;
    ctx.fillRect(0, 0, size, size);

    // Fente d'observation (creux sombre)
    const slitY = size * 0.43;
    const slitH = 8;
    ctx.fillStyle = "rgba(10, 6, 4, 0.95)";
    ctx.fillRect(0, slitY - slitH / 2, size, slitH);

    // Rebord saillant — métal clair au-dessus de la fente
    const ridgeY = slitY - 7;
    const ridgeH = 5;
    const ridgeGrad = ctx.createLinearGradient(0, ridgeY - ridgeH / 2, 0, ridgeY + ridgeH / 2);
    ridgeGrad.addColorStop(0, "rgba(80, 78, 88, 0)");
    ridgeGrad.addColorStop(0.5, "rgba(180, 175, 188, 0.9)");
    ridgeGrad.addColorStop(1, "rgba(80, 78, 88, 0)");
    ctx.fillStyle = ridgeGrad;
    ctx.fillRect(0, ridgeY - ridgeH / 2, size, ridgeH);

    // Rivets clairs sous la fente
    function lightRivet(x, y, r) {
        const grd = ctx.createRadialGradient(x - r * 0.35, y - r * 0.35, 0, x, y, r);
        grd.addColorStop(0, "rgba(220, 215, 225, 0.95)");
        grd.addColorStop(0.5, "rgba(170, 165, 175, 0.7)");
        grd.addColorStop(1, "rgba(60, 55, 65, 0.4)");
        ctx.fillStyle = grd;
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    }
    const rivetRowY = slitY + slitH / 2 + 8;
    for (let i = 0; i < 6; i++) {
        const rx = (i + 0.5) * (size / 6);
        lightRivet(rx, rivetRowY, 4);
    }

    // Rainure verticale sombre, sur le front du heaume (U≈0.71)
    const frontX = size * 0.71;
    const grooveW2 = 10;
    const grooveTop = size * 0.02;
    const grooveBot = size * 0.98;
    ctx.fillStyle = "rgba(10, 5, 4, 0.92)";
    ctx.fillRect(frontX - grooveW2 / 2, grooveTop, grooveW2, grooveBot - grooveTop);

    // Deux arcs sombres autour du front, étroits et hauts
    function drawHelmetArc(x0, y0, cx, cy, x1, y1) {
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.quadraticCurveTo(cx, cy, x1, y1);
        ctx.stroke();
    }
    ctx.strokeStyle = "rgba(10, 5, 4, 0.92)";
    ctx.lineWidth = 5;
    const archGap = size * 0.06;
    const archTopY = size * 0.06;
    const archMidY = size * 0.20;
    const archEndY = ridgeY - 8;
    drawHelmetArc(frontX - size * 0.10, archTopY,
                  frontX - size * 0.13, archMidY,
                  frontX - archGap, archEndY);
    drawHelmetArc(frontX + size * 0.10, archTopY,
                  frontX + size * 0.13, archMidY,
                  frontX + archGap, archEndY);

    // Patine de rouille
    for (let i = 0; i < 22; i++) {
        const x = rand() * size, y = rand() * size;
        const r = 18 + rand() * 40;
        const grd = ctx.createRadialGradient(x, y, 0, x, y, r);
        grd.addColorStop(0, `rgba(110, 55, 25, ${0.35 + rand() * 0.3})`);
        grd.addColorStop(0.6, `rgba(70, 40, 20, ${0.18 + rand() * 0.2})`);
        grd.addColorStop(1, `rgba(70, 40, 20, 0)`);
        ctx.fillStyle = grd;
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    }

    // Suie et poussière
    for (let i = 0; i < 30; i++) {
        const x = rand() * size, y = rand() * size;
        const r = 8 + rand() * 22;
        const grd = ctx.createRadialGradient(x, y, 0, x, y, r);
        grd.addColorStop(0, `rgba(15, 10, 8, ${0.3 + rand() * 0.3})`);
        grd.addColorStop(1, `rgba(15, 10, 8, 0)`);
        ctx.fillStyle = grd;
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    }

    // Granulation
    for (let i = 0; i < 1500; i++) {
        const a = rand() * 0.25;
        const dark = rand() > 0.5;
        ctx.fillStyle = dark ? `rgba(0,0,0,${a})` : `rgba(220,210,200,${a * 0.6})`;
        ctx.fillRect(rand() * size, rand() * size, 1, 1);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    return tex;
}

// SOL — dalles sombres en quinconce
export function makeFloorSet(size = 512) {
    const cC = createCanvas(size);
    const hC = createCanvas(size);
    const rC = createCanvas(size);
    const cCtx = cC.getContext("2d");
    const hCtx = hC.getContext("2d");
    const rCtx = rC.getContext("2d");
    const rand = mulberry32(217);

    cCtx.fillStyle = "#0a0805"; cCtx.fillRect(0, 0, size, size);
    hCtx.fillStyle = "#000000"; hCtx.fillRect(0, 0, size, size);
    rCtx.fillStyle = "#e0e0e0"; rCtx.fillRect(0, 0, size, size);

    // Dalles carrées 4×4 avec décalage en quinconce
    const tilesPerSide = 4;
    const t = size / tilesPerSide;
    for (let row = 0; row < tilesPerSide; row++) {
        const offset = (row % 2) * t * 0.5;
        for (let col = -1; col < tilesPerSide + 1; col++) {
            const x = col * t + offset + 4;
            const y = row * t + 4;
            const w = t - 8 + (rand() - 0.5) * 4;
            const h = t - 8 + (rand() - 0.5) * 4;
            if (x + w < 0 || x > size) continue;

            // Couleur : gris sombre avec variations chaudes
            const tone = 30 + Math.floor(rand() * 25);
            cCtx.fillStyle = `rgb(${tone + 8}, ${tone + 4}, ${tone})`;
            cCtx.fillRect(x, y, w, h);

            // Heightfield : dalle bombée légèrement
            const grad = hCtx.createRadialGradient(x + w / 2, y + h / 2, 0, x + w / 2, y + h / 2, Math.max(w, h) * 0.7);
            grad.addColorStop(0, `rgb(${180 + Math.floor(rand() * 30)},${180 + Math.floor(rand() * 30)},${180 + Math.floor(rand() * 30)})`);
            grad.addColorStop(0.85, "#707070");
            grad.addColorStop(1, "#101010");
            hCtx.fillStyle = grad;
            hCtx.fillRect(x, y, w, h);

            // Roughness — dalles usées au centre, plus rugueuses sur les bords
            rCtx.fillStyle = `rgb(${130 + Math.floor(rand() * 40)},${130 + Math.floor(rand() * 40)},${130 + Math.floor(rand() * 40)})`;
            rCtx.fillRect(x + 2, y + 2, w - 4, h - 4);

            // Pittings sombres sur la couleur
            for (let i = 0; i < 30; i++) {
                const px = x + rand() * w, py = y + rand() * h;
                const rr = rand() * 2 + 0.5;
                cCtx.fillStyle = `rgba(0,0,0,${0.2 + rand() * 0.3})`;
                cCtx.beginPath(); cCtx.arc(px, py, rr, 0, Math.PI * 2); cCtx.fill();
            }
        }
    }

    // Granulation
    const grainImg = hCtx.getImageData(0, 0, size, size);
    for (let i = 0; i < grainImg.data.length; i += 4) {
        const n = (rand() - 0.5) * 14;
        grainImg.data[i]     = Math.max(0, Math.min(255, grainImg.data[i]     + n));
        grainImg.data[i + 1] = Math.max(0, Math.min(255, grainImg.data[i + 1] + n));
        grainImg.data[i + 2] = Math.max(0, Math.min(255, grainImg.data[i + 2] + n));
    }
    hCtx.putImageData(grainImg, 0, 0);

    // Normal map dérivée
    const nC = createCanvas(size);
    const nCtx = nC.getContext("2d");
    const hImg = hCtx.getImageData(0, 0, size, size).data;
    const nImg = nCtx.createImageData(size, size);
    const strength = 4.0;
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

// BOUGIE — normal map de coulures de cire
export function makeCandleNormalMap(size = 512) {
    const canvas = createCanvas(size);
    const ctx = canvas.getContext("2d");
    const rand = mulberry32(57);

    ctx.fillStyle = "rgb(128,128,255)";
    ctx.fillRect(0, 0, size, size);

    // 18 coulures bien séparées sur le tour de la bougie
    const drips = 18;
    for (let i = 0; i < drips; i++) {
        const cx = (i / drips) * size + (rand() - 0.5) * (size / drips) * 0.7;
        const startY = rand() * size * 0.15;
        const length = size * (0.35 + rand() * 0.6);
        const w = 8 + rand() * 18;

        // Corps de la coulure
        for (let y = startY; y < startY + length; y++) {
            const wobble = Math.sin(y * 0.08 + i) * 2.5;
            const localCx = cx + wobble;
            const ww = w * (1 - (y - startY) / length * 0.3);
            for (let dx = -ww; dx <= ww; dx++) {
                const t = dx / ww;
                // Profil cylindrique : nx = sin(angle de la surface)
                const nx = Math.sin(t * Math.PI / 2);
                const r = Math.floor(128 + nx * 110);
                const g = 128;
                const b = Math.floor(255 - Math.abs(nx) * 60);
                ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
                ctx.fillRect(localCx + dx, y, 1, 1);
            }
        }
        // Goutte arrondie en bas
        const dropY = startY + length;
        const dropR = w * 1.1;
        const dropX = cx + Math.sin((dropY) * 0.08 + i) * 2.5;
        for (let py = -dropR; py <= dropR; py++) {
            for (let px = -dropR; px <= dropR; px++) {
                const d = Math.sqrt(px * px + py * py);
                if (d > dropR) continue;
                const nx = px / dropR, ny = py / dropR;
                const r = Math.floor(128 + nx * 100);
                const g = Math.floor(128 + ny * 100);
                const b = Math.floor(255 - (Math.abs(nx) + Math.abs(ny)) * 50);
                ctx.fillStyle = `rgb(${r},${g},${b})`;
                ctx.fillRect(dropX + px, dropY + py, 1, 1);
            }
        }
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    return tex;
}

// Skybox — 6 faces gradient crépusculaire + étoiles sur le haut
export function makeSkyboxCubeTexture(size = 256) {
    const rand = mulberry32(311);

    function face(topColor, bottomColor, withStars) {
        const c = createCanvas(size);
        const g = c.getContext("2d");
        const grad = g.createLinearGradient(0, 0, 0, size);
        grad.addColorStop(0, topColor);
        grad.addColorStop(1, bottomColor);
        g.fillStyle = grad;
        g.fillRect(0, 0, size, size);
        if (withStars) {
            for (let i = 0; i < 20; i++) {
                const a = 0.3 + rand() * 0.5;
                g.fillStyle = `rgba(220, 200, 170, ${a})`;
                g.fillRect(rand() * size, rand() * (size * 0.6), 1, 1);
            }
        }
        return c;
    }

    const sideWarm = face("#2a1f17", "#0d0a07", false);
    const sideCold = face("#1a1722", "#0a0a0d", false);
    const top = face("#0e0b18", "#1a1410", true);
    const bottom = face("#050402", "#020100", false);
    const front = face("#221710", "#0a0805", false);
    const back = face("#1a1218", "#0a0506", false);

    const cubeTex = new THREE.CubeTexture([sideWarm, sideCold, top, bottom, front, back]);
    cubeTex.needsUpdate = true;
    cubeTex.colorSpace = THREE.SRGBColorSpace;
    return cubeTex;
}
