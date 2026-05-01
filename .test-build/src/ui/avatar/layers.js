"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VARIANT_COUNTS = exports.LAYER_ORDER = void 0;
exports.renderLayer = renderLayer;
function rect(x, y, width, height, fill) {
    return `<rect class="${fill}" x="${x}" y="${y}" width="${width}" height="${height}"/>`;
}
function circle(cx, cy, radius, fill) {
    return `<circle class="${fill}" cx="${cx}" cy="${cy}" r="${radius}"/>`;
}
function polygon(points, fill) {
    const serialized = points.map(([x, y]) => `${x},${y}`).join(" ");
    return `<polygon class="${fill}" points="${serialized}"/>`;
}
function group(children, transform) {
    if (transform) {
        return `<g transform="${transform}">${children}</g>`;
    }
    return `<g>${children}</g>`;
}
function bodyMetrics(state) {
    if (state.body === 0) {
        return {
            shoulderLeft: 200,
            shoulderRight: 312,
            waistLeft: 222,
            waistRight: 290,
            hipLeft: 206,
            hipRight: 306,
            armLeft: 170,
            armRight: 316,
            legLeft: 214,
            legRight: 264,
            legWidth: 34,
        };
    }
    return {
        shoulderLeft: 188,
        shoulderRight: 324,
        waistLeft: 212,
        waistRight: 300,
        hipLeft: 194,
        hipRight: 318,
        armLeft: 156,
        armRight: 312,
        legLeft: 204,
        legRight: 258,
        legWidth: 42,
    };
}
function renderBody(state) {
    if (state.body === 0) {
        return group([
            rect(240, 184, 32, 20, "c0"),
            polygon([
                [206, 212],
                [306, 212],
                [292, 330],
                [220, 330],
            ], "c0"),
        ].join(""));
    }
    return group([
        rect(232, 182, 48, 22, "c0"),
        polygon([
            [194, 210],
            [318, 210],
            [302, 338],
            [210, 338],
        ], "c0"),
    ].join(""));
}
function renderLegs(state) {
    const metrics = bodyMetrics(state);
    if (state.legs === 1) {
        return group([
            polygon([
                [metrics.hipLeft + 12, 332],
                [metrics.hipRight - 12, 332],
                [metrics.hipRight - 22, 430],
                [metrics.hipLeft + 22, 430],
            ], "c0"),
            rect(224, 430, 30, 20, "c0"),
            rect(258, 430, 30, 20, "c0"),
        ].join(""));
    }
    return group([
        rect(metrics.legLeft, 334, metrics.legWidth, 108, "c0"),
        rect(metrics.legRight, 334, metrics.legWidth, 108, "c0"),
        rect(metrics.legLeft - 4, 438, metrics.legWidth + 8, 18, "c0"),
        rect(metrics.legRight - 4, 438, metrics.legWidth + 8, 18, "c0"),
    ].join(""));
}
function renderArms(state) {
    const metrics = bodyMetrics(state);
    const width = state.arms === 0 ? 26 : 40;
    const leftX = state.arms === 0 ? metrics.armLeft : metrics.armLeft - 8;
    const rightX = state.arms === 0 ? metrics.armRight : metrics.armRight - 2;
    const bottomRadius = state.arms === 0 ? 12 : 16;
    return group([
        rect(leftX, 220, width, 118, "c0"),
        rect(rightX, 220, width, 118, "c0"),
        circle(leftX + (width / 2), 344, bottomRadius, "c0"),
        circle(rightX + (width / 2), 344, bottomRadius, "c0"),
    ].join(""), `translate(0 ${state.armsOffsetY})`);
}
function renderTorso(state) {
    const metrics = bodyMetrics(state);
    if (state.torso === 0) {
        return group(polygon([
            [metrics.shoulderLeft, 210],
            [metrics.shoulderRight, 210],
            [metrics.waistRight, 300],
            [metrics.hipRight - 8, 392],
            [metrics.hipLeft + 8, 392],
            [metrics.waistLeft, 300],
        ], "c1"));
    }
    if (state.torso === 1) {
        return group([
            rect(metrics.waistLeft - 8, 216, metrics.waistRight - metrics.waistLeft + 16, 132, "c1"),
            polygon([
                [metrics.shoulderLeft, 220],
                [metrics.waistLeft - 8, 220],
                [metrics.waistLeft - 8, 256],
                [metrics.shoulderLeft + 12, 278],
            ], "c1"),
            polygon([
                [metrics.shoulderRight, 220],
                [metrics.waistRight + 8, 220],
                [metrics.waistRight + 8, 256],
                [metrics.shoulderRight - 12, 278],
            ], "c1"),
            rect(metrics.waistLeft, 348, metrics.waistRight - metrics.waistLeft, 44, "c1"),
        ].join(""));
    }
    return group(polygon([
        [metrics.shoulderLeft - 8, 208],
        [metrics.shoulderRight + 8, 208],
        [metrics.hipRight + 12, 382],
        [metrics.hipLeft - 12, 382],
    ], "c1"));
}
function renderHead(state) {
    if (state.head === 0) {
        return group(circle(256, 148, 58, "c0"), `translate(0 ${state.headOffsetY})`);
    }
    return group([
        rect(204, 94, 104, 108, "c0"),
        rect(214, 84, 84, 20, "c0"),
    ].join(""), `translate(0 ${state.headOffsetY})`);
}
function renderHoodHair(state) {
    if (state.hoodHair === 2) {
        return group("", `translate(0 ${state.headOffsetY})`);
    }
    if (state.hoodHair === 1) {
        return group([
            rect(214, 90, 84, 18, "c1"),
            rect(206, 104, 18, 38, "c1"),
            rect(288, 104, 18, 38, "c1"),
        ].join(""), `translate(0 ${state.headOffsetY})`);
    }
    return group([
        polygon([
            [194, 188],
            [218, 104],
            [256, 74],
            [294, 104],
            [318, 188],
            [286, 212],
            [226, 212],
        ], "c1"),
        rect(208, 188, 96, 22, "c1"),
    ].join(""), `translate(0 ${state.headOffsetY})`);
}
function renderHorns(state) {
    if (state.horns === 0) {
        return group("", `translate(0 ${state.headOffsetY})`);
    }
    if (state.horns === 1) {
        return group([
            polygon([
                [208, 110],
                [194, 76],
                [218, 92],
            ], "c1"),
            polygon([
                [304, 110],
                [318, 76],
                [294, 92],
            ], "c1"),
        ].join(""), `translate(0 ${state.headOffsetY})`);
    }
    return group([
        polygon([
            [210, 118],
            [178, 72],
            [184, 42],
            [204, 58],
            [220, 94],
        ], "c1"),
        polygon([
            [302, 118],
            [334, 72],
            [328, 42],
            [308, 58],
            [292, 94],
        ], "c1"),
    ].join(""), `translate(0 ${state.headOffsetY})`);
}
function renderEyes(state) {
    if (state.eyes === 0) {
        return group([circle(232, 150, 8, "c2"), circle(280, 150, 8, "c2")].join(""), `translate(0 ${state.headOffsetY})`);
    }
    if (state.eyes === 1) {
        return group([rect(222, 146, 20, 6, "c2"), rect(270, 146, 20, 6, "c2")].join(""), `translate(0 ${state.headOffsetY})`);
    }
    return group([circle(228, 150, 10, "c2"), circle(284, 150, 10, "c2")].join(""), `translate(0 ${state.headOffsetY})`);
}
function renderMarkings(state) {
    if (state.markings === 0) {
        return group("");
    }
    if (state.markings === 1) {
        return group([
            polygon([
                [256, 252],
                [274, 270],
                [256, 288],
                [238, 270],
            ], "c2"),
            rect(252, 286, 8, 34, "c2"),
        ].join(""));
    }
    if (state.markings === 2) {
        return group([
            rect(252, 126 + state.headOffsetY, 8, 52, "c2"),
            rect(236, 146 + state.headOffsetY, 16, 8, "c2"),
        ].join(""));
    }
    return group([
        rect(176, 228, 22, 40, "c2"),
        rect(314, 228, 22, 40, "c2"),
        rect(182, 238, 10, 20, "c1"),
        rect(320, 238, 10, 20, "c1"),
    ].join(""));
}
function renderOverlays(state) {
    if (state.overlays === 0) {
        return group("");
    }
    if (state.overlays === 1) {
        return group([
            circle(214, 264, 8, "c2"),
            circle(286, 246, 10, "c2"),
            circle(238, 344, 7, "c2"),
            circle(292, 364, 9, "c2"),
        ].join(""));
    }
    return group([
        polygon([
            [230, 120 + state.headOffsetY],
            [238, 120 + state.headOffsetY],
            [246, 148 + state.headOffsetY],
            [238, 148 + state.headOffsetY],
        ], "c2"),
        polygon([
            [278, 150 + state.headOffsetY],
            [286, 150 + state.headOffsetY],
            [296, 184 + state.headOffsetY],
            [288, 184 + state.headOffsetY],
        ], "c2"),
        polygon([
            [244, 246],
            [252, 246],
            [266, 304],
            [258, 304],
        ], "c2"),
        polygon([
            [284, 286],
            [292, 286],
            [304, 354],
            [296, 354],
        ], "c2"),
    ].join(""));
}
exports.LAYER_ORDER = [
    "body",
    "legs",
    "arms",
    "torso",
    "head",
    "hoodHair",
    "horns",
    "eyes",
    "markings",
    "overlays",
];
exports.VARIANT_COUNTS = {
    body: 2,
    head: 2,
    hoodHair: 3,
    torso: 3,
    arms: 2,
    legs: 2,
    eyes: 3,
    horns: 3,
    markings: 4,
    overlays: 3,
};
function renderLayer(layer, state) {
    switch (layer) {
        case "body":
            return renderBody(state);
        case "legs":
            return renderLegs(state);
        case "arms":
            return renderArms(state);
        case "torso":
            return renderTorso(state);
        case "head":
            return renderHead(state);
        case "hoodHair":
            return renderHoodHair(state);
        case "horns":
            return renderHorns(state);
        case "eyes":
            return renderEyes(state);
        case "markings":
            return renderMarkings(state);
        case "overlays":
            return renderOverlays(state);
    }
}
