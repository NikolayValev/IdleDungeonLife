import { BaseScene } from "./BaseScene";
import { COLORS, FONTS, LAYOUT } from "../theme";
import { ITEM_REGISTRY } from "../../content/items";
import { BALANCE } from "../../content/balance";

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
        ? run.inventory.items.find((item) => item.instanceId === instanceId)
        : null;
      const def = inst ? ITEM_REGISTRY.get(inst.itemId) : null;
      const label = def ? def.name : `[empty ${slot}]`;
      const color = def ? RARITY_COLORS[def.rarity] : COLORS.textMuted;

      this.add.text(P + 8, y, `${slot}: ${label}`, {
        fontFamily: FONTS.body,
        fontSize: "13px",
        color,
      });

      if (def && instanceId) {
        let actionRight = LAYOUT.width - P - 8;
        actionRight = this.drawActionChip(
          actionRight,
          y + 7,
          "Break",
          "#ffd7d7",
          0x3a171c,
          () => {
            this.dispatch({ type: "BREAK_ITEM", itemInstanceId: instanceId });
            this.refresh();
          }
        );

        this.drawActionChip(
          actionRight,
          y + 7,
          "Unequip",
          COLORS.textPrimary,
          0x252538,
          () => {
            this.dispatch({ type: "UNEQUIP_ITEM", slot });
            this.refresh();
          }
        );
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

    this.add.text(
      P + 8,
      y,
      "Break items into essence. Common +1, Rare +3, Legendary +8.",
      {
        fontFamily: FONTS.body,
        fontSize: "11px",
        color: COLORS.textMuted,
        wordWrap: { width: LAYOUT.cardWidth - 16 },
      }
    );
    y += 26;

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

      this.add.text(P + 8, y, def.name, {
        fontFamily: FONTS.body,
        fontSize: "13px",
        color: RARITY_COLORS[def.rarity],
      });

      let actionRight = LAYOUT.width - P - 8;

      if (run.alive) {
        const breakReward = BALANCE.itemBreakEssence[def.rarity];
        actionRight = this.drawActionChip(
          actionRight,
          y + 7,
          `+${breakReward}e`,
          "#ffd7d7",
          0x3a171c,
          () => {
            this.dispatch({ type: "BREAK_ITEM", itemInstanceId: inst.instanceId });
            this.refresh();
          }
        );
      }

      if (!isEquipped && run.alive) {
        actionRight = this.drawActionChip(
          actionRight,
          y + 7,
          "Equip",
          COLORS.textPrimary,
          0x4a3918,
          () => {
            this.dispatch({ type: "EQUIP_ITEM", itemInstanceId: inst.instanceId });
            this.refresh();
          }
        );
      } else if (isEquipped) {
        actionRight = this.drawBadgeChip(
          actionRight,
          y + 7,
          "Equipped",
          COLORS.vitalityHigh,
          0x15311f,
          0x2e6a46
        );
      }

      this.add.text(actionRight - 4, y, `[${def.slot}]`, {
        fontFamily: FONTS.body,
        fontSize: "11px",
        color: COLORS.textMuted,
      }).setOrigin(1, 0);

      y += 20;
      if (y > LAYOUT.height - LAYOUT.tabBarHeight - 20) break;
    }
  }

  private drawActionChip(
    rightX: number,
    centerY: number,
    label: string,
    textColor: string,
    fillColor: number,
    onClick: () => void
  ): number {
    const text = this.add.text(0, 0, label, {
      fontFamily: FONTS.body,
      fontSize: "12px",
      fontStyle: "bold",
      color: textColor,
      resolution: 2,
      stroke: "#08080d",
      strokeThickness: 1,
    });
    const width = text.width + 14;
    const height = 20;

    const bg = this.add
      .rectangle(rightX - width / 2, centerY, width, height, fillColor, 1)
      .setStrokeStyle(1, 0x6a6a7f, 1)
      .setInteractive({ useHandCursor: true });

    text.setPosition(rightX - 7, centerY).setOrigin(1, 0.5).setDepth(bg.depth + 1);
    text.setInteractive({ useHandCursor: true });

    const hoverIn = () => {
      bg.setFillStyle(fillColor + 0x141414, 1);
    };
    const hoverOut = () => {
      bg.setFillStyle(fillColor, 1);
    };

    bg.on("pointerup", onClick);
    text.on("pointerup", onClick);
    bg.on("pointerover", hoverIn);
    text.on("pointerover", hoverIn);
    bg.on("pointerout", hoverOut);
    text.on("pointerout", hoverOut);

    return rightX - width - 8;
  }

  private drawBadgeChip(
    rightX: number,
    centerY: number,
    label: string,
    textColor: string,
    fillColor: number,
    borderColor: number
  ): number {
    const text = this.add.text(0, 0, label, {
      fontFamily: FONTS.body,
      fontSize: "12px",
      fontStyle: "bold",
      color: textColor,
      resolution: 2,
      stroke: "#08080d",
      strokeThickness: 1,
    });
    const width = text.width + 14;
    const height = 20;

    const bg = this.add
      .rectangle(rightX - width / 2, centerY, width, height, fillColor, 1)
      .setStrokeStyle(1, borderColor, 1);

    text.setPosition(rightX - 7, centerY).setOrigin(1, 0.5).setDepth(bg.depth + 1);

    return rightX - width - 8;
  }
}
