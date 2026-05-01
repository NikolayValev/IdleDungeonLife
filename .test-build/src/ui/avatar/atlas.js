"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildCharacterVisualInputFromRun = void 0;
exports.exportAvatarAtlas = exportAvatarAtlas;
exports.createAvatarTextureKey = createAvatarTextureKey;
exports.generateAvatarDebugSamples = generateAvatarDebugSamples;
exports.exportAvatarDebugAtlas = exportAvatarDebugAtlas;
const buildCharacterSvg_1 = require("./buildCharacterSvg");
const deriveVisualState_1 = require("./deriveVisualState");
Object.defineProperty(exports, "buildCharacterVisualInputFromRun", { enumerable: true, get: function () { return deriveVisualState_1.buildCharacterVisualInputFromRun; } });
const rasterizeSvg_1 = require("./rasterizeSvg");
function clampPositiveInteger(value, fallback) {
    if (value === undefined) {
        return fallback;
    }
    if (!Number.isInteger(value) || value <= 0) {
        throw new Error(`Expected a positive integer, received ${value}`);
    }
    return value;
}
function buildAtlasSvg(items, cellSize, cols, paddingPx) {
    const step = cellSize + paddingPx * 2;
    const rows = Math.max(1, Math.ceil(items.length / cols));
    const width = cols * step;
    const height = rows * step;
    const frames = {};
    const nodes = [];
    items.forEach((item, index) => {
        const col = index % cols;
        const row = Math.floor(index / cols);
        const x = col * step + paddingPx;
        const y = row * step + paddingPx;
        frames[item.key] = { x, y, w: cellSize, h: cellSize };
        nodes.push(`<g transform="translate(${x} ${y})">${item.svg}</g>`);
    });
    return {
        svg: [
            `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
            nodes.join(""),
            "</svg>",
        ].join(""),
        frames,
    };
}
async function exportAvatarAtlas(items, options = {}) {
    if (items.length === 0) {
        return [];
    }
    const cellSize = clampPositiveInteger(options.cellSize, 512);
    const cols = clampPositiveInteger(options.cols, 4);
    const paddingPx = clampPositiveInteger(options.paddingPx, 2);
    const { svg, frames } = buildAtlasSvg(items, cellSize, cols, paddingPx);
    const png = await (0, rasterizeSvg_1.svgToPngBufferWithFallback)(svg, cols * (cellSize + paddingPx * 2));
    return [{ png, frames }];
}
async function createAvatarTextureKey(scene, key, input) {
    if (scene.textures.exists(key)) {
        return key;
    }
    const state = (0, deriveVisualState_1.deriveCharacterVisualState)(input);
    const svg = (0, buildCharacterSvg_1.buildCharacterSvg)(state);
    const canvas = await (0, rasterizeSvg_1.drawSvgToCanvas)(svg, 512);
    if (!scene.textures.exists(key)) {
        scene.textures.addCanvas(key, canvas);
    }
    return key;
}
function generateAvatarDebugSamples() {
    const seeds = ["1001", "1002", "1003", "1004", "1005", "1006", "1007", "1008", "1009", "1010"];
    const alignments = ["holy", "neutral", "unholy"];
    const vitalityValues = [0.85, 0.5, 0.15];
    const traitSets = [
        [],
        ["marked_by_light"],
        ["abyss_drawn"],
        ["grave_touched", "frail_body"],
        ["consecrated_blood", "fated"],
    ];
    const samples = [];
    for (const seed of seeds) {
        for (const alignment of alignments) {
            for (const vitality01 of vitalityValues) {
                for (const forcedTraits of traitSets) {
                    const traitKey = forcedTraits.length > 0 ? forcedTraits.join("+") : "base";
                    const key = `${seed}_${alignment}_${Math.round(vitality01 * 100)}_${traitKey}`;
                    const input = {
                        seed,
                        alignment,
                        vitality01,
                        visibleTraitIds: [...forcedTraits],
                        hiddenTraitIds: [],
                        equippedItemTags: alignment === "holy"
                            ? ["holy", "shrine"]
                            : alignment === "unholy"
                                ? ["unholy", "abyss"]
                                : ["neutral", "fate"],
                    };
                    const state = (0, deriveVisualState_1.deriveCharacterVisualState)(input);
                    const svg = (0, buildCharacterSvg_1.buildCharacterSvg)(state);
                    samples.push({ key, input, state, svg });
                }
            }
        }
    }
    return samples;
}
async function exportAvatarDebugAtlas(options) {
    const items = generateAvatarDebugSamples().map((sample) => ({
        key: sample.key,
        svg: sample.svg,
    }));
    return exportAvatarAtlas(items, options);
}
