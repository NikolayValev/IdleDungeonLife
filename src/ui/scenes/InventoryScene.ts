import { BaseScene } from "./BaseScene";
import { COLORS, FONTS, LAYOUT } from "../theme";
import { ITEM_REGISTRY } from "../../content/items";

const P = LAYOUT.padding;
const RARITY_COLORS = {
  common: COLORS.common,
  rare: COLORS.rare,
  legendary: COLORS.legendary,
};

export class InventoryScene extends BaseScene {
  constructor() {
    super({ key: "InventoryScene" });
  }

  create(): void {
    this.cameras.main.setBackgroundColor(COLORS.background);
    this.add.text(P, LAYOUT.hudHeight + 8, "INVENTORY", {
      fontFamily: FONTS.heading,
      fontSize: "20px",
      color: COLORS.accent,
    });

    const run = this.saveFile.currentRun;
    if (!run) {
      this.add.text(P, LAYOUT.hudHeight + 48, "No active run.", {
        fontFamily: FONTS.body,
        fontSize: "13px",
        color: COLORS.textMuted,
      });
      return;
    }

    // Equipped section
    let y = LAYOUT.hudHeight + 40;
    this.add.text(P, y, "Equipped:", {
      fontFamily: FONTS.body,
      fontSize: "14px",
      color: COLORS.textSecondary,
    });
    y += 20;

    const slots: Array<"weapon" | "armor" | "artifact"> = ["weapon", "armor", "artifact"];
    for (const slot of slots) {
      const instanceId = run.equipment[slot];
      const inst = instanceId
        ? run.inventory.items.find((i) => i.instanceId === instanceId)
        : null;
      const def = inst ? ITEM_REGISTRY.get(inst.itemId) : null;

      const label = def ? def.name : `[empty ${slot}]`;
      const color = def
        ? RARITY_COLORS[def.rarity]
        : COLORS.textMuted;

      this.add.text(P + 8, y, `${slot}: ${label}`, {
        fontFamily: FONTS.body,
        fontSize: "13px",
        color,
      });

      if (def && instanceId) {
        const unequipBtn = this.add
          .text(LAYOUT.width - P - 8, y, "[ Unequip ]", {
            fontFamily: FONTS.body,
            fontSize: "12px",
            color: COLORS.textSecondary,
          })
          .setOrigin(1, 0)
          .setInteractive({ useHandCursor: true });
        unequipBtn.on("pointerup", () => {
          this.dispatch({ type: "UNEQUIP_ITEM", slot });
          this.refresh();
        });
      }

      y += 20;
    }

    y += 12;
    this.add.text(P, y, "Backpack:", {
      fontFamily: FONTS.body,
      fontSize: "14px",
      color: COLORS.textSecondary,
    });
    y += 20;

    if (run.inventory.items.length === 0) {
      this.add.text(P + 8, y, "No items.", {
        fontFamily: FONTS.body,
        fontSize: "13px",
        color: COLORS.textMuted,
      });
      return;
    }

    for (const inst of run.inventory.items) {
      const def = ITEM_REGISTRY.get(inst.itemId);
      if (!def) continue;

      const isEquipped = [
        run.equipment.weapon,
        run.equipment.armor,
        run.equipment.artifact,
      ].includes(inst.instanceId);

      const rarityColor = RARITY_COLORS[def.rarity];

      // Item name
      this.add.text(P + 8, y, `${def.name}`, {
        fontFamily: FONTS.body,
        fontSize: "13px",
        color: rarityColor,
      });

      this.add.text(P + 8 + 180, y, `[${def.slot}]`, {
        fontFamily: FONTS.body,
        fontSize: "11px",
        color: COLORS.textMuted,
      });

      if (!isEquipped && run.alive) {
        const equipBtn = this.add
          .text(LAYOUT.width - P - 8, y, "[ Equip ]", {
            fontFamily: FONTS.body,
            fontSize: "12px",
            color: COLORS.accent,
          })
          .setOrigin(1, 0)
          .setInteractive({ useHandCursor: true });
        equipBtn.on("pointerup", () => {
          this.dispatch({ type: "EQUIP_ITEM", itemInstanceId: inst.instanceId });
          this.refresh();
        });
      } else if (isEquipped) {
        this.add.text(LAYOUT.width - P - 8, y, "equipped", {
          fontFamily: FONTS.body,
          fontSize: "11px",
          color: COLORS.vitalityHigh,
        }).setOrigin(1, 0);
      }

      y += 20;
      if (y > LAYOUT.height - LAYOUT.tabBarHeight - 20) break;
    }
  }
}
