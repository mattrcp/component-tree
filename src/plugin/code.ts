// 1. Initialize the UI
figma.showUI(__html__, { width: 400, height: 550, themeColors: false });

let includeDetails = true;
let exportFormat: "ascii" | "json" = "ascii"; // NEW: Track the active format

// --- ENGINE A: ASCII ATTRIBUTES & TREE (Your existing code) ---
const getNodeAttributes = (
  node: SceneNode,
  includeDetails: boolean,
): string => {
  if (!includeDetails) return "";
  const attributes: string[] = [];
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
  if ("layoutMode" in node && node.layoutMode !== "NONE") {
    const direction = node.layoutMode === "HORIZONTAL" ? "Row" : "Col";
    attributes.push(`AutoLayout: ${direction}`);
    if (
      "itemSpacing" in node &&
      typeof node.itemSpacing === "number" &&
      node.itemSpacing > 0
    )
      attributes.push(`Gap: ${node.itemSpacing}px`);
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
  if (node.type === "TEXT") {
    const cleanText = node.characters.replace(/\n/g, " ");
    const textPreview =
      cleanText.length > 20 ? cleanText.substring(0, 20) + "..." : cleanText;
    attributes.push(`Text: "${textPreview}"`);
    if (node.fontSize !== figma.mixed)
      attributes.push(`Size: ${node.fontSize}px`);
    if (node.fontName !== figma.mixed)
      attributes.push(`Weight: ${(node.fontName as FontName).style}`);
  }
  return attributes.length > 0 ? ` [${attributes.join(", ")}]` : "";
};

const generateTreeString = (
  node: SceneNode,
  prefix: string = "",
  isLast: boolean = true,
  isRoot: boolean = true,
): string => {
  if (!node.visible) return "";
  let result = "";
  const nodeName = node.name + getNodeAttributes(node, includeDetails);
  if (isRoot) result += nodeName + "\n";
  else result += prefix + (isLast ? "\\-- " : "|-- ") + nodeName + "\n";

  if ("children" in node && node.children.length > 0) {
    const visibleChildren = (node.children as SceneNode[]).filter(
      (c) => c.visible,
    );
    const newPrefix = isRoot ? "" : prefix + (isLast ? "    " : "|   ");
    visibleChildren.forEach((child, index) => {
      const isChildLast = index === visibleChildren.length - 1;
      result += generateTreeString(child, newPrefix, isChildLast, false);
    });
  }
  return result;
};

// --- ENGINE B: JSON TREE BUILDER ---
const generateJSONTree = (node: SceneNode): any => {
  if (!node.visible) return null;

  const obj: any = {
    name: node.name,
    type: node.type,
  };

  if (includeDetails) {
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
    // AutoLayout
    if ("layoutMode" in node && node.layoutMode !== "NONE") {
      obj.layout = { mode: node.layoutMode === "HORIZONTAL" ? "Row" : "Col" };
      if (
        "itemSpacing" in node &&
        typeof node.itemSpacing === "number" &&
        node.itemSpacing > 0
      )
        obj.layout.gap = `${node.itemSpacing}px`;
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
  }

  if ("children" in node && node.children.length > 0) {
    const children = (node.children as SceneNode[])
      .map((child) => generateJSONTree(child))
      .filter((child) => child !== null);
    if (children.length > 0) obj.children = children;
  }

  return obj;
};

// --- SELECTION ROUTER ---
const processSelection = () => {
  const selection = figma.currentPage.selection;
  if (selection.length === 0) {
    figma.ui.postMessage({ type: "SELECTION_CLEARED" });
    return;
  }

  const targetNode = selection[0];
  let payloadString = "";

  if (exportFormat === "json") {
    const jsonObj = generateJSONTree(targetNode);
    payloadString = JSON.stringify(jsonObj, null, 2); // Formats with 2 spaces and line breaks
  } else {
    payloadString = generateTreeString(targetNode, "", true, true);
  }

  figma.ui.postMessage({ type: "TREE_GENERATED", payload: payloadString });
};

figma.on("selectionchange", processSelection);
processSelection();

// --- UI MESSAGE HANDLER ---
figma.ui.on("message", async (msg: { type: string; payload?: any }) => {
  if (msg.type === "SET_INCLUDE_DETAILS") {
    includeDetails = msg.payload;
    processSelection();
  }
  if (msg.type === "SET_FORMAT") {
    exportFormat = msg.payload;
    processSelection();
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
