import Phaser from "phaser";

export interface ScrollablePanelConfig {
  x: number;
  y: number;
  width: number;
  height: number;
  children?: Phaser.GameObjects.GameObject[];
  padding?: number;
}

export class ScrollablePanel extends Phaser.GameObjects.Container {
  private contentContainer: Phaser.GameObjects.Container;
  private maskGraphics: Phaser.GameObjects.Graphics | null = null;
  private isDragging = false;
  private dragStartY = 0;
  private contentStartY = 0;
  private maxScrollY = 0;
  private minScrollY = 0;

  constructor(scene: Phaser.Scene, config: ScrollablePanelConfig) {
    super(scene, config.x, config.y);

    // Create the content container
    this.contentContainer = scene.add.container(0, 0);
    this.add(this.contentContainer);

    // Add children to content container
    if (config.children) {
      for (const child of config.children) {
        this.contentContainer.add(child);
      }
    }

    // Create rectangular mask for the panel
    this.maskGraphics = scene.make.graphics({ x: config.x, y: config.y }, false);
    this.maskGraphics.fillStyle(0xffffff, 1);
    this.maskGraphics.fillRect(0, 0, config.width, config.height);

    // Apply mask to content container
    this.contentContainer.setMask(new Phaser.Display.Masks.GeometryMask(scene, this.maskGraphics));

    // Set up interaction (drag to scroll)
    this.setInteractive(
      new Phaser.Geom.Rectangle(-config.width / 2, -config.height / 2, config.width, config.height),
      Phaser.Geom.Rectangle.Contains
    );

    this.on("pointerdown", this.onDragStart, this);
    scene.input.on("pointermove", this.onDragMove, this);
    scene.input.on("pointerup", this.onDragEnd, this);

    // Calculate scrollable bounds
    this.updateScrollBounds(config.height);
  }

  /**
   * Add a child to the scrollable content
   */
  addContent(child: Phaser.GameObjects.GameObject): void {
    this.contentContainer.add(child);
  }

  /**
   * Clear all content
   */
  clearContent(): void {
    this.contentContainer.removeAll(true);
  }

  /**
   * Update scroll bounds based on content height
   */
  private updateScrollBounds(panelHeight: number): void {
    const bounds = this.contentContainer.getBounds();
    const contentHeight = bounds.height;

    if (contentHeight > panelHeight) {
      this.maxScrollY = 0; // Top
      this.minScrollY = -(contentHeight - panelHeight); // Bottom
    } else {
      this.maxScrollY = 0;
      this.minScrollY = 0; // No scroll needed if content fits
    }
  }

  /**
   * Handle drag start
   */
  private onDragStart = (pointer: Phaser.Input.Pointer): void => {
    if (!this.isPointInBounds(pointer)) return;
    this.isDragging = true;
    this.dragStartY = pointer.y;
    this.contentStartY = this.contentContainer.y;
  };

  /**
   * Handle drag move
   */
  private onDragMove = (pointer: Phaser.Input.Pointer): void => {
    if (!this.isDragging) return;

    const deltaY = pointer.y - this.dragStartY;
    let newY = this.contentStartY + deltaY;

    // Clamp to bounds with elastic feel at edges
    if (newY > this.maxScrollY) {
      newY = this.maxScrollY + (newY - this.maxScrollY) * 0.2; // Slow down
    } else if (newY < this.minScrollY) {
      newY = this.minScrollY + (newY - this.minScrollY) * 0.2;
    }

    this.contentContainer.setY(newY);
  };

  /**
   * Handle drag end
   */
  private onDragEnd = (): void => {
    this.isDragging = false;

    // Snap to bounds if over-scrolled
    if (this.contentContainer.y > this.maxScrollY) {
      this.scene.tweens.add({
        targets: this.contentContainer,
        y: this.maxScrollY,
        duration: 200,
        ease: Phaser.Math.Easing.Back.Out,
      });
    } else if (this.contentContainer.y < this.minScrollY) {
      this.scene.tweens.add({
        targets: this.contentContainer,
        y: this.minScrollY,
        duration: 200,
        ease: Phaser.Math.Easing.Back.Out,
      });
    }
  };

  /**
   * Check if pointer is within panel bounds
   */
  private isPointInBounds(pointer: Phaser.Input.Pointer): boolean {
    const bounds = this.getBounds();
    return bounds.contains(pointer.x, pointer.y);
  }

  /**
   * Scroll to a target Y position (animated)
   */
  scrollTo(y: number, duration: number = 300): void {
    const clampedY = Phaser.Math.Clamp(y, this.minScrollY, this.maxScrollY);
    this.scene.tweens.add({
      targets: this.contentContainer,
      y: clampedY,
      duration,
      ease: Phaser.Math.Easing.Cubic.InOut,
    });
  }

  /**
   * Reset scroll position to top
   */
  reset(): void {
    this.contentContainer.setY(0);
  }

  /**
   * Cleanup
   */
  destroy(fromScene?: boolean): void {
    this.scene.input.off("pointermove", this.onDragMove, this);
    this.scene.input.off("pointerup", this.onDragEnd, this);
    this.maskGraphics?.destroy();
    super.destroy(fromScene);
  }
}
