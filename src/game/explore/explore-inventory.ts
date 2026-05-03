import type { InventoryItem } from "../core/types";

function isHealConsumable(item: InventoryItem): boolean {
  const name = item.name;
  return (
    item.type === "consumable" ||
    name.includes("\u836f") ||
    name.includes("HP") ||
    name.includes("\u6062\u590d")
  );
}

export function buildExploreInventoryGridHtml(items: InventoryItem[]): string {
  if (!items.length) {
    return '<div class="inventory-empty">\u80cc\u5305\u7a7a\u7a7a\u5982\u4e5f\uff0c\u53bb\u63a2\u7d22\u6a21\u5f0f\u4e2d\u6536\u96c6\u9053\u5177\u5427\uff01</div>';
  }
  return items
    .map((item, idx) => {
      const consumable = isHealConsumable(item);
      const useBtn = consumable
        ? `<button class="inventory-item-use" data-idx="${idx}">\u4f7f\u7528</button>`
        : "";
      return `<div class="inventory-item" data-idx="${idx}">${useBtn}<div class="inventory-item-icon">${item.icon}</div><div class="inventory-item-name">${item.name}</div><div class="inventory-item-qty">\u00d7${item.quantity}</div></div>`;
    })
    .join("");
}

/**
 * Lightweight stack-merge inventory; rendering stays in Host (DOM refs).
 */
export class ExploreInventory {
  private readonly items: InventoryItem[] = [];

  getItemsSnapshot(): InventoryItem[] {
    return [...this.items];
  }

  reset(): void {
    this.items.length = 0;
  }

  mergeAdd(item: InventoryItem): void {
    const existing = this.items.find((i) => i.name === item.name);
    if (existing) {
      existing.quantity += item.quantity;
      return;
    }
    this.items.push(item);
  }

  /**
   * Applies HP consumable semantics; mutates stacks. Returns false if invalid index or not usable.
   */
  tryHealFromItem(idx: number, progress: { hp: number; maxHp: number; clampHeal: (amount: number) => void }): {
    consumed: boolean;
    message: string;
  } {
    const item = this.items[idx];
    if (!item || item.quantity <= 0) {
      return { consumed: false, message: "" };
    }
    let used = false;
    const restore =
      item.name.includes("\u5f3a\u6548") || item.name.includes("\u5927") ? 150 : 50;
    if (
      item.name.includes("HP") ||
      item.name.includes("\u6062\u590d") ||
      item.name.includes("\u836f") ||
      item.type === "consumable"
    ) {
      progress.clampHeal(restore);
      used = true;
    }
    if (!used) {
      return {
        consumed: false,
        message: `${item.icon}${item.name} \u65e0\u6cd5\u76f4\u63a5\u4f7f\u7528`,
      };
    }
    item.quantity -= 1;
    if (item.quantity <= 0) {
      this.items.splice(idx, 1);
    }
    return {
      consumed: true,
      message: `\u4f7f\u7528 ${item.icon}${item.name}\uff01HP +${restore}`,
    };
  }
}
