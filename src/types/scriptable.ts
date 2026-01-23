
// Scriptable Global Types
export declare class ListWidget {
  backgroundGradient: LinearGradient;
  url: string;
  addStack(): WidgetStack;
  addText(text: string): WidgetText;
  addSpacer(points?: number): void;
  presentSmall(): Promise<void>;
  presentMedium(): Promise<void>;
  presentLarge(): Promise<void>;
}

export declare class WidgetStack {
  layoutHorizontally(): void;
  layoutVertically(): void;
  centerAlignContent(): void;
  addText(text: string): WidgetText;
  addSpacer(points?: number): void;
  addStack(): WidgetStack;
  backgroundColor: Color;
  size: Size;
  cornerRadius: number;
}

export declare class WidgetText {
  font: Font;
  textColor: Color;
  leftAlignText(): void;
  rightAlignText(): void;
  centerAlignText(): void;
}

export declare class Color {
  constructor(hex: string, alpha?: number);
}

export declare class Font {
  static regularSystemFont(size: number): Font;
  static boldSystemFont(size: number): Font;
}

export declare class Size {
  constructor(width: number, height: number);
}

export declare class LinearGradient {
  locations: number[];
  colors: Color[];
}

export declare const config: {
  runsInWidget: boolean;
};

export declare const Script: {
  setWidget(widget: ListWidget): void;
  complete(): void;
};