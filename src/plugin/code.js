"use strict";
// 1. Initialize the UI
figma.showUI(__html__, { width: 400, height: 550, themeColors: true });
// 2. The Attribute Engine: Extracts Variants, Auto-Layout, and Text Data
const getNodeAttributes = (node) => {
    const attributes = [];
    // A. Variant Properties (Instances & Components)
    if (node.type === "INSTANCE" || node.type === "COMPONENT") {
        // @ts-ignore - componentProperties exist but TS strict mode might flag it
        const props = node.componentProperties;
        if (props) {
            Object.entries(props)
                .filter(([_, value]) => value.type === "VARIANT")
                .forEach(([key, value]) => attributes.push(`${key}: ${value.value}`));
        }
    }
    // B. Auto-Layout (Flexbox) Properties
    if ("layoutMode" in node && node.layoutMode !== "NONE") {
        const direction = node.layoutMode === "HORIZONTAL" ? "Row" : "Col";
        attributes.push(`AutoLayout: ${direction}`);
        if ("itemSpacing" in node &&
            typeof node.itemSpacing === "number" &&
            node.itemSpacing > 0) {
            attributes.push(`Gap: ${node.itemSpacing}px`);
        }
        if ("paddingTop" in node && typeof node.paddingTop === "number") {
            const pt = node.paddingTop, pb = node.paddingBottom, pl = node.paddingLeft, pr = node.paddingRight;
            if (pt === pb && pt === pl && pt === pr && pt > 0) {
                attributes.push(`Padding: ${pt}px`);
            }
            else if (pt > 0 || pb > 0 || pl > 0 || pr > 0) {
                attributes.push(`Pad: ${pt}t ${pr}r ${pb}b ${pl}l`);
            }
        }
    }
    // C. Typography Data
    if (node.type === "TEXT") {
        // Clean up line breaks for the preview string
        const cleanText = node.characters.replace(/\n/g, " ");
        const textPreview = cleanText.length > 20 ? cleanText.substring(0, 20) + "..." : cleanText;
        attributes.push(`Text: "${textPreview}"`);
        if (node.fontSize !== figma.mixed) {
            attributes.push(`Size: ${node.fontSize}px`);
        }
        if (node.fontName !== figma.mixed) {
            attributes.push(`Weight: ${node.fontName.style}`);
        }
    }
    return attributes.length > 0 ? ` [${attributes.join(", ")}]` : "";
};
// 3. The Recursive Tree Builder
const generateTreeString = (node, prefix = "", isLast = true, isRoot = true) => {
    // CRITICAL FIX: Skip hidden layers so the AI doesn't hallucinate invisible UI elements
    if (!node.visible)
        return "";
    let result = "";
    const nodeName = node.name + getNodeAttributes(node);
    if (isRoot) {
        result += nodeName + "\n";
    }
    else {
        result += prefix + (isLast ? "└── " : "├── ") + nodeName + "\n";
    }
    if ("children" in node && node.children.length > 0) {
        // Filter out hidden children before we calculate who the "last" child is
        const visibleChildren = node.children.filter((c) => c.visible);
        const newPrefix = isRoot ? "" : prefix + (isLast ? "    " : "│   ");
        visibleChildren.forEach((child, index) => {
            const isChildLast = index === visibleChildren.length - 1;
            result += generateTreeString(child, newPrefix, isChildLast, false);
        });
    }
    return result;
};
// 4. The Selection Engine
const processSelection = () => {
    const selection = figma.currentPage.selection;
    if (selection.length === 0) {
        figma.ui.postMessage({ type: "SELECTION_CLEARED" });
        return;
    }
    const targetNode = selection[0];
    const treeString = generateTreeString(targetNode);
    figma.ui.postMessage({ type: "TREE_GENERATED", payload: treeString });
};
figma.on("selectionchange", processSelection);
processSelection();
