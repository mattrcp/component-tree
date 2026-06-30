// 1. Initialize the UI
figma.showUI(__html__, { width: 400, height: 550, themeColors: false });

let includeDetails = true;
let exportFormat: "ascii" | "json" = "ascii";

// --- COLOR HELPERS ---

const rgbToHex = (r: number, g: number, b: number): string => {
  const toHex = (v: number) =>
    Math.round(v * 255).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

/**
 * Resolve a Figma variable ID → CSS custom-property token name.
 * Uses getVariableByIdAsync (required for "documentAccess": "dynamic-page").
 */
const resolveVariableToken = async (
  variableId: string,
): Promise<string | null> => {
  try {
    const variable = await figma.variables.getVariableByIdAsync(variableId);
    if (!variable) return null;
    return "--" + variable.name.replace(/\//g, "-").toLowerCase();
  } catch {
    return null;
  }
};

/**
 * Return a color string for the first visible SOLID paint on fills/strokes.
 * Prefers a bound variable token; falls back to hex (#rrggbb).
 */
const getColorString = async (
  node: SceneNode,
  prop: "fills" | "strokes",
): Promise<string | null> => {
  const paints = (node as any)[prop] as Paint[] | typeof figma.mixed;
  if (!paints || paints === figma.mixed || (paints as Paint[]).length === 0)
    return null;

  const paint = (paints as Paint[]).find(
    (p) => p.type === "SOLID" && p.visible !== false,
  );
  if (!paint || paint.type !== "SOLID") return null;

  // Variable binding lives on the paint object: paint.boundVariables.color
  const colorAlias = (paint as any).boundVariables?.color;
  if (colorAlias?.type === "VARIABLE_ALIAS") {
    const token = await resolveVariableToken(colorAlias.id);
    if (token) return token;
  }

  // Fallback: hex + optional opacity
  const hex = rgbToHex(paint.color.r, paint.color.g, paint.color.b);
  const opacity =
    typeof paint.opacity === "number" && paint.opacity < 1
      ? ` / ${Math.round(paint.opacity * 100)}%`
      : "";
  return hex + opacity;
};

/** Collect color/style sub-lines for a node (bg, color, stroke, radius). */
const getColorAttributes = async (node: SceneNode): Promise<string[]> => {
  const attrs: string[] = [];

  if (node.type === "TEXT") {
    const color = await getColorString(node, "fills");
    if (color) attrs.push(`color: ${color}`);
  } else if ("fills" in node) {
    const bg = await getColorString(node, "fills");
    if (bg) attrs.push(`bg: ${bg}`);
  }

  if ("strokes" in node) {
    const stroke = await getColorString(node, "strokes");
    if (stroke) attrs.push(`stroke: ${stroke}`);
  }

  if (
    "cornerRadius" in node &&
    node.cornerRadius !== figma.mixed &&
    (node.cornerRadius as number) > 0
  ) {
    attrs.push(`radius: ${node.cornerRadius}px`);
  }

  // Effects
  if ("effects" in node) {
    const effects = ((node as any).effects as Effect[]).filter(
      (e) => e.visible !== false,
    );
    for (const e of effects) {
      if (e.type === "DROP_SHADOW" || e.type === "INNER_SHADOW") {
        const { r, g, b, a } = e.color;
        const hex = rgbToHex(r, g, b);
        const alpha = a < 1 ? ` / ${Math.round(a * 100)}%` : "";
        const label = e.type === "DROP_SHADOW" ? "shadow" : "inner-shadow";
        attrs.push(`${label}: ${hex}${alpha} blur:${e.radius}px`);
      } else if (e.type === "LAYER_BLUR") {
        attrs.push(`blur: ${e.radius}px`);
      } else if (e.type === "BACKGROUND_BLUR") {
        attrs.push(`bg-blur: ${e.radius}px`);
      }
    }
  }

  return attrs;
};

// --- ENGINE A: ASCII ATTRIBUTES & TREE ---

const getNodeAttributes = (
  node: SceneNode,
  includeDetails: boolean,
): string => {
  if (!includeDetails) return "";
  const attributes: string[] = [];

  // Size
  attributes.push(`${Math.round(node.width)}×${Math.round(node.height)}`);

  // Variant properties
  if (node.type === "INSTANCE" || node.type === "COMPONENT") {
    // @ts-ignore
    const props = node.componentProperties;
    if (props) {
      Object.entries(props)
        .filter(([_, value]: [string, any]) => value.type === "VARIANT")
        .forEach(([key, value]: [string, any]) =>
          attributes.push(`${key}: ${value.value}`),
        );
    }
  }

  // Auto-layout / Grid
  if ("layoutMode" in node && node.layoutMode !== "NONE") {
    if (node.layoutMode === "GRID") {
      const n = node as any;
      attributes.push(`Grid: ${n.gridColumnCount}col × ${n.gridRowCount}row`);
      const cg: number = n.gridColumnGap ?? 0;
      const rg: number = n.gridRowGap ?? 0;
      if (cg > 0 && rg > 0 && cg === rg) attributes.push(`Gap: ${cg}px`);
      else {
        if (cg > 0) attributes.push(`ColGap: ${cg}px`);
        if (rg > 0) attributes.push(`RowGap: ${rg}px`);
      }
    } else {
      attributes.push(node.layoutMode === "HORIZONTAL" ? "Row" : "Col");
      if ("layoutWrap" in node && node.layoutWrap === "WRAP")
        attributes.push("Wrap");
      if (
        "itemSpacing" in node &&
        typeof node.itemSpacing === "number" &&
        node.itemSpacing > 0
      )
        attributes.push(`Gap: ${node.itemSpacing}px`);
    }
    if ("paddingTop" in node && typeof node.paddingTop === "number") {
      const pt = node.paddingTop,
        pb = node.paddingBottom,
        pl = node.paddingLeft,
        pr = node.paddingRight;
      if (pt === pb && pt === pl && pt === pr && pt > 0)
        attributes.push(`Padding: ${pt}px`);
      else if (pt > 0 || pb > 0 || pl > 0 || pr > 0)
        attributes.push(`Pad: ${pt}t ${pr}r ${pb}b ${pl}l`);
    }
  }

  // Typography
  if (node.type === "TEXT") {
    const cleanText = node.characters.replace(/\n/g, " ");
    const textPreview =
      cleanText.length > 20 ? cleanText.substring(0, 20) + "..." : cleanText;
    attributes.push(`"${textPreview}"`);
    if (node.fontSize !== figma.mixed) attributes.push(`${node.fontSize}px`);
    if (node.fontName !== figma.mixed)
      attributes.push((node.fontName as FontName).style);
  }

  // Opacity
  if ("opacity" in node && typeof node.opacity === "number" && node.opacity < 1)
    attributes.push(`opacity: ${Math.round(node.opacity * 100)}%`);

  // Blend mode
  if (
    "blendMode" in node &&
    node.blendMode !== "NORMAL" &&
    node.blendMode !== "PASS_THROUGH"
  )
    attributes.push(`blend: ${node.blendMode}`);

  return attributes.length > 0 ? ` [${attributes.join(", ")}]` : "";
};

const generateTreeString = async (
  node: SceneNode,
  prefix: string = "",
  isLast: boolean = true,
  isRoot: boolean = true,
): Promise<string> => {
  if (!node.visible) return "";
  let result = "";
  const nodeLine = node.name + getNodeAttributes(node, includeDetails);

  if (isRoot) {
    result += nodeLine + "\n";
    if (includeDetails) {
      for (const attr of await getColorAttributes(node)) {
        result += `   ${attr}\n`;
      }
    }
  } else {
    result += prefix + (isLast ? "\\-- " : "|-- ") + nodeLine + "\n";
    if (includeDetails) {
      const attrPrefix = prefix + (isLast ? "    " : "|   ");
      for (const attr of await getColorAttributes(node)) {
        result += `${attrPrefix}   ${attr}\n`;
      }
    }
  }

  if ("children" in node && node.children.length > 0) {
    const visibleChildren = (node.children as SceneNode[]).filter(
      (c) => c.visible,
    );
    const newPrefix = isRoot ? "" : prefix + (isLast ? "    " : "|   ");
    for (let i = 0; i < visibleChildren.length; i++) {
      result += await generateTreeString(
        visibleChildren[i],
        newPrefix,
        i === visibleChildren.length - 1,
        false,
      );
    }
  }
  return result;
};

// --- ENGINE B: JSON TREE BUILDER ---

const generateJSONTree = async (node: SceneNode): Promise<any> => {
  if (!node.visible) return null;

  const obj: any = { name: node.name, type: node.type };

  if (includeDetails) {
    obj.size = `${Math.round(node.width)}×${Math.round(node.height)}`;

    // Variants
    if (node.type === "INSTANCE" || node.type === "COMPONENT") {
      // @ts-ignore
      const props = node.componentProperties;
      if (props) {
        obj.variants = {};
        Object.entries(props)
          .filter(([_, value]: [string, any]) => value.type === "VARIANT")
          .forEach(
            ([key, value]: [string, any]) => (obj.variants[key] = value.value),
          );
      }
    }

    // Auto-layout / Grid
    if ("layoutMode" in node && node.layoutMode !== "NONE") {
      if (node.layoutMode === "GRID") {
        const n = node as any;
        obj.layout = {
          mode: "Grid",
          columns: n.gridColumnCount,
          rows: n.gridRowCount,
        };
        const cg: number = n.gridColumnGap ?? 0;
        const rg: number = n.gridRowGap ?? 0;
        if (cg > 0 && rg > 0 && cg === rg) obj.layout.gap = `${cg}px`;
        else {
          if (cg > 0) obj.layout.columnGap = `${cg}px`;
          if (rg > 0) obj.layout.rowGap = `${rg}px`;
        }
      } else {
        obj.layout = { mode: node.layoutMode === "HORIZONTAL" ? "Row" : "Col" };
        if ("layoutWrap" in node && node.layoutWrap === "WRAP")
          obj.layout.wrap = true;
        if (
          "itemSpacing" in node &&
          typeof node.itemSpacing === "number" &&
          node.itemSpacing > 0
        )
          obj.layout.gap = `${node.itemSpacing}px`;
      }
      if ("paddingTop" in node && typeof node.paddingTop === "number") {
        const pt = node.paddingTop,
          pb = node.paddingBottom,
          pl = node.paddingLeft,
          pr = node.paddingRight;
        if (pt === pb && pt === pl && pt === pr && pt > 0)
          obj.layout.padding = `${pt}px`;
        else if (pt > 0 || pb > 0 || pl > 0 || pr > 0)
          obj.layout.padding = `${pt}t ${pr}r ${pb}b ${pl}l`;
      }
    }

    // Typography
    if (node.type === "TEXT") {
      obj.typography = { text: node.characters.replace(/\n/g, " ") };
      if (node.fontSize !== figma.mixed)
        obj.typography.size = `${node.fontSize}px`;
      if (node.fontName !== figma.mixed)
        obj.typography.weight = (node.fontName as FontName).style;
    }

    // Colors — background fills
    if (node.type !== "TEXT" && "fills" in node) {
      const bg = await getColorString(node, "fills");
      if (bg) obj.bg = bg;
    }
    // Colors — text color
    if (node.type === "TEXT") {
      const color = await getColorString(node, "fills");
      if (color) obj.color = color;
    }
    // Colors — stroke
    if ("strokes" in node) {
      const stroke = await getColorString(node, "strokes");
      if (stroke) obj.stroke = stroke;
    }
    // Border radius
    if (
      "cornerRadius" in node &&
      node.cornerRadius !== figma.mixed &&
      (node.cornerRadius as number) > 0
    ) {
      obj.radius = `${node.cornerRadius}px`;
    }

    // Opacity
    if (
      "opacity" in node &&
      typeof node.opacity === "number" &&
      node.opacity < 1
    )
      obj.opacity = `${Math.round(node.opacity * 100)}%`;

    // Blend mode
    if (
      "blendMode" in node &&
      node.blendMode !== "NORMAL" &&
      node.blendMode !== "PASS_THROUGH"
    )
      obj.blendMode = node.blendMode;

    // Effects
    if ("effects" in node) {
      const visibleEffects = ((node as any).effects as Effect[]).filter(
        (e) => e.visible !== false,
      );
      if (visibleEffects.length > 0) {
        obj.effects = visibleEffects.map((e) => {
          if (e.type === "DROP_SHADOW" || e.type === "INNER_SHADOW") {
            const { r, g, b, a } = e.color;
            return {
              type: e.type === "DROP_SHADOW" ? "shadow" : "inner-shadow",
              color: rgbToHex(r, g, b),
              ...(a < 1 && { alpha: `${Math.round(a * 100)}%` }),
              radius: `${e.radius}px`,
            };
          } else if (e.type === "LAYER_BLUR" || e.type === "BACKGROUND_BLUR") {
            const label = e.type === "LAYER_BLUR" ? "blur" : "bg-blur";
            return { type: label, radius: `${(e as BlurEffect).radius}px` };
          } else {
            return { type: e.type };
          }
        });
      }
    }
  }

  if ("children" in node && node.children.length > 0) {
    const children: any[] = [];
    for (const child of node.children as SceneNode[]) {
      const childObj = await generateJSONTree(child);
      if (childObj) children.push(childObj);
    }
    if (children.length > 0) obj.children = children;
  }

  return obj;
};

// --- SELECTION ROUTER ---

const processSelection = async () => {
  const selection = figma.currentPage.selection;
  if (selection.length === 0) {
    figma.ui.postMessage({ type: "SELECTION_CLEARED" });
    return;
  }

  const targetNode = selection[0];
  const payloadString =
    exportFormat === "json"
      ? JSON.stringify(await generateJSONTree(targetNode), null, 2)
      : await generateTreeString(targetNode, "", true, true);

  figma.ui.postMessage({ type: "TREE_GENERATED", payload: payloadString });
};

figma.on("selectionchange", () => { processSelection(); });
processSelection();

// --- UI MESSAGE HANDLER ---

figma.ui.on("message", async (msg: { type: string; payload?: any }) => {
  if (msg.type === "SET_INCLUDE_DETAILS") {
    includeDetails = msg.payload;
    await processSelection();
  }
  if (msg.type === "SET_FORMAT") {
    exportFormat = msg.payload;
    await processSelection();
  }

  if (msg.type === "PASTE_TO_CANVAS" && msg.payload) {
    try {
      const lines = msg.payload
        .split("\n")
        .filter((line: string) => line.trim().length > 0);
      if (lines.length === 0) return;

      await figma.loadFontAsync({ family: "Roboto Mono", style: "Regular" });

      const frame = figma.createFrame();
      frame.layoutMode = "VERTICAL";
      frame.itemSpacing = 4;
      frame.paddingTop = 16;
      frame.paddingBottom = 16;
      frame.paddingLeft = 16;
      frame.paddingRight = 16;
      frame.cornerRadius = 8;
      frame.fills = [
        { type: "SOLID", color: { r: 250 / 255, g: 250 / 255, b: 250 / 255 } },
      ];
      frame.primaryAxisSizingMode = "AUTO";
      frame.counterAxisSizingMode = "AUTO";

      const selection = figma.currentPage.selection;
      if (selection.length > 0) {
        const ref = selection[0];
        frame.name = `${ref.name} ${exportFormat === "json" ? "JSON" : "Tree"}`;
        frame.x = ref.x + ref.width + 48;
        frame.y = ref.y;
      } else {
        frame.name = "Canvas Tree";
        frame.x = figma.viewport.center.x;
        frame.y = figma.viewport.center.y;
      }

      lines.forEach((line: string) => {
        const textNode = figma.createText();
        textNode.fontName = { family: "Roboto Mono", style: "Regular" };
        textNode.characters = line;
        textNode.fontSize = 12;
        textNode.textAutoResize = "WIDTH_AND_HEIGHT";
        textNode.fills = [
          { type: "SOLID", color: { r: 0.15, g: 0.15, b: 0.15 } },
        ];
        frame.appendChild(textNode);
      });

      figma.currentPage.selection = [frame];
      figma.viewport.scrollAndZoomIntoView([frame]);
      figma.notify(`Generated ${frame.name} successfully.`);
    } catch (_err) {
      figma.notify("Could not generate text layers", { error: true });
    }
  }
});
