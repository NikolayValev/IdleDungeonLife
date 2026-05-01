"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LOOT_TABLE_REGISTRY = exports.LOOT_TABLES = void 0;
const balance_1 = require("./balance");
const items_1 = require("./items");
function weightForTags(itemTags, focus) {
    let weight = 1;
    for (const tag of focus.tags) {
        if (itemTags.includes(tag)) {
            weight += 1.4;
        }
    }
    for (const tag of focus.secondaryTags ?? []) {
        if (itemTags.includes(tag)) {
            weight += 0.6;
        }
    }
    return weight;
}
function buildEntries(focus) {
    return items_1.ITEMS.map((item) => {
        const featuredBonus = focus.featuredIds?.includes(item.id) ? 2.5 : 1;
        const weight = Number((weightForTags(item.tags, focus) * featuredBonus).toFixed(2));
        return { itemId: item.id, weight };
    });
}
const table = (id, focus) => ({
    id,
    entries: buildEntries(focus),
    ...balance_1.BALANCE.loot.tables[id],
});
exports.LOOT_TABLES = [
    table("loot_chapel", {
        tags: ["holy", "shrine"],
        secondaryTags: ["vitality", "fate"],
        featuredIds: ["chapel_mace", "pilgrim_vestments", "chapel_token", "sanctum_mail", "censer_of_tithes"],
    }),
    table("loot_grave", {
        tags: ["unholy", "decay"],
        secondaryTags: ["vitality"],
        featuredIds: ["grave_dagger", "grave_shroud", "hollow_bone", "embalmer_habit", "black_lantern"],
    }),
    table("loot_archive", {
        tags: ["knowledge", "relic"],
        secondaryTags: ["fate"],
        featuredIds: ["archivist_wrap", "scribe_charm", "sunken_quill_knife", "scribe_lens", "oracle_veil"],
    }),
    table("loot_gilded", {
        tags: ["wealth", "relic"],
        secondaryTags: ["fate"],
        featuredIds: ["copper_tallyblade", "scavenger_coat", "pauper_beads", "gilded_hook", "broker_harness"],
    }),
    table("loot_ossuary", {
        tags: ["vitality", "decay"],
        secondaryTags: ["knowledge"],
        featuredIds: ["ossuary_hatchet", "briar_mail", "iron_talisman", "marrow_pike", "marrow_clock"],
    }),
    table("loot_vault", {
        tags: ["relic", "knowledge", "fate"],
        secondaryTags: ["holy"],
        featuredIds: ["vault_plate", "scribe_lens", "fate_coin", "relic_sovereign", "hourglass_of_saints"],
    }),
    table("loot_molting", {
        tags: ["abyss", "decay", "vitality"],
        secondaryTags: ["unholy"],
        featuredIds: ["abyss_brand", "thornbound_cuirass", "black_lantern", "borrowed_skin", "root_of_the_last_spring"],
    }),
    table("loot_abyss", {
        tags: ["abyss", "unholy", "fate"],
        secondaryTags: ["boss"],
        featuredIds: ["abyss_brand", "abyss_carapace", "black_lantern", "the_last_seal", "maw_of_tithes"],
    }),
    table("loot_prelate", {
        tags: ["boss", "holy", "fate"],
        secondaryTags: ["shrine", "relic"],
        featuredIds: ["shard_of_prelate", "sanctum_mail", "censer_of_tithes", "prelate_raiment", "eclipse_gavel"],
    }),
    table("loot_eclipsed", {
        tags: ["boss", "abyss", "holy", "unholy"],
        secondaryTags: ["fate", "decay"],
        featuredIds: ["the_last_seal", "borrowed_skin", "crown_of_the_hollow_market", "eclipse_gavel", "gilded_molt"],
    }),
];
exports.LOOT_TABLE_REGISTRY = new Map(exports.LOOT_TABLES.map((lootTable) => [lootTable.id, lootTable]));
