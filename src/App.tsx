import { useEffect, useState } from "react";

// ---- Inline SVG icons ----

const IconTree = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="#18A0FB"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="6" y1="3" x2="6" y2="15" />
    <circle cx="18" cy="6" r="3" />
    <circle cx="6" cy="18" r="3" />
    <path d="M18 9a9 9 0 0 1-9 9" />
  </svg>
);

const IconGenerate = () => (
  <svg
    width="13"
    height="13"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M12 5v14M5 12l7 7 7-7" />
  </svg>
);

const IconCheck = () => (
  <svg
    width="13"
    height="13"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const IconChevron = () => (
  <svg
    width="10"
    height="10"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="3"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

// ---- Main component ----

function App() {
  const [treeData, setTreeData] = useState<string | null>(null);
  const [generated, setGenerated] = useState(false);
  const [includeDetails, setIncludeDetails] = useState(true);

  // NEW: Dropdown states
  const [format, setFormat] = useState<"ascii" | "json">("ascii");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const msg = event.data.pluginMessage;
      if (!msg) return;
      if (msg.type === "TREE_GENERATED") {
        setTreeData(msg.payload);
        setGenerated(false);
      }
      if (msg.type === "SELECTION_CLEARED") {
        setTreeData(null);
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  const handleGenerate = () => {
    if (!treeData) return;
    parent.postMessage(
      { pluginMessage: { type: "PASTE_TO_CANVAS", payload: treeData } },
      "*",
    );
    setGenerated(true);
    setTimeout(() => setGenerated(false), 2000);
  };

  const handleToggleDetails = () => {
    const newValue = !includeDetails;
    setIncludeDetails(newValue);
    parent.postMessage(
      { pluginMessage: { type: "SET_INCLUDE_DETAILS", payload: newValue } },
      "*",
    );
  };

  // NEW: Format change handler
  const handleFormatChange = (newFormat: "ascii" | "json") => {
    setFormat(newFormat);
    setIsDropdownOpen(false); // Close dropdown on selection
    parent.postMessage(
      { pluginMessage: { type: "SET_FORMAT", payload: newFormat } },
      "*",
    );
  };

  const lineCount = treeData ? treeData.split("\n").filter(Boolean).length : 0;

  // Dynamic filename based on format
  const fileName =
    format === "json" ? "ComponentData.json" : "ComponentTree.txt";

  return (
    <div className="p-2 bg-[#F5F5F7] text-[#1D1D1F] h-screen flex flex-col gap-2 select-none font-sans">
      {/* ---- Content ---- */}
      <div className="flex flex-col flex-1 overflow-hidden relative animate-in fade-in duration-500 rounded-xl border border-[#D2D2D7] shadow-[0_4px_16px_rgba(0,0,0,0.04)]">
        {/* Header Shell: Persistently Visible */}
        <div className="flex items-center justify-between gap-1.5 px-3 py-2 border-b border-[#F5F5F7] bg-[#FAFAFA] z-10">
          <div className="flex gap-2">
            <div
              className={`w-2 h-2 rounded-full transition-colors duration-500 ${treeData ? "bg-[#FFBD2E]" : "bg-[#E8E8ED]"}`}
            />
            <div
              className={`w-2 h-2 rounded-full transition-colors duration-500 ${treeData ? "bg-[#28C840]" : "bg-[#E8E8ED]"}`}
            />
          </div>
          <div className="flex gap-2 items-center">
            <span className="text-[9px] font-mono text-[#A1A1A6] uppercase tracking-widest transition-all">
              {treeData ? fileName : "Awaiting_Selection.sys"}
            </span>
            <div className="h-2 w-[1px] bg-[#E8E8ED]" />
            <span className="text-[9px] font-mono font-bold text-[#86868B]">
              {treeData ? lineCount : "0"} NODES
            </span>
          </div>
        </div>

        {/* Scrollable Editor Area */}
        <div
          className="flex-1 bg-white relative overflow-hidden flex flex-col"
          onClick={() => setIsDropdownOpen(false)}
        >
          <textarea
            className={`w-full h-full p-4 pb-24 font-mono text-[11px] leading-relaxed outline-none resize-none scrollbar-hide select-text transition-colors duration-500
              ${treeData ? "text-[#005893] bg-transparent" : "text-[#747474] bg-[#FAFAFA]/30"}
            `}
            value={
              treeData ||
              "// Select a frame or component on the \n// canvas to analyze its architecture..."
            }
            readOnly
            spellCheck={false}
          />
        </div>

        {/* Absolute Floating Button Container */}
        <div className="absolute bottom-3 left-3 right-3 flex items-center p-2 bg-white/90 backdrop-blur-md rounded-2xl border border-[#E8E8ED] shadow-[0_8px_32px_rgba(0,0,0,0.08)] z-20">
          {/* Custom Toggle Switch */}
          <div
            onClick={treeData ? handleToggleDetails : undefined}
            className={`flex items-center gap-2 px-2 transition-opacity duration-300 ${treeData ? "cursor-pointer hover:opacity-80" : "cursor-not-allowed opacity-40"}`}
          >
            <div
              className={`relative w-8 h-4.5 rounded-full transition-all duration-200 border ${includeDetails && treeData ? "bg-[#18A0FB] border-[#18A0FB]" : "bg-[#E8E8ED] border-[#D2D2D7]"}`}
            >
              <div
                className={`absolute top-[2px] left-[2px] w-3 h-3 rounded-full bg-white shadow-sm transition-transform duration-200 ${includeDetails && treeData ? "translate-x-[14px]" : "translate-x-0"}`}
              />
            </div>
            <span className="text-[10px] font-bold text-[#86868B] uppercase tracking-tighter">
              Details
            </span>
          </div>

          <div className="w-[1px] h-6 bg-[#E8E8ED] mx-2" />

          {/* NEW: Custom Format Dropdown */}
          <div className="relative">
            <button
              onClick={() => treeData && setIsDropdownOpen(!isDropdownOpen)}
              disabled={!treeData}
              className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-tighter transition-all ${
                treeData
                  ? isDropdownOpen
                    ? "bg-[#E8E8ED] text-[#1D1D1F]"
                    : "text-[#86868B] hover:bg-[#F5F5F7] hover:text-[#1D1D1F]"
                  : "text-[#D2D2D7] cursor-not-allowed"
              }`}
            >
              {format}
              <div
                className={`transition-transform duration-200 ${isDropdownOpen ? "rotate-180" : "rotate-0"}`}
              >
                <IconChevron />
              </div>
            </button>

            {/* Dropdown Menu */}
            {isDropdownOpen && treeData && (
              <div className="absolute bottom-full left-0 mb-2 w-24 bg-white/95 backdrop-blur-md rounded-xl border border-[#E8E8ED] shadow-[0_8px_32px_rgba(0,0,0,0.12)] p-1 z-30 animate-in slide-in-from-bottom-2 fade-in duration-200">
                <button
                  onClick={() => handleFormatChange("ascii")}
                  className={`w-full flex items-center px-3 py-2 text-[10px] font-bold tracking-tighter uppercase text-left rounded-lg transition-colors ${format === "ascii" ? "bg-[#F5F5F7] text-[#1D1D1F]" : "text-[#86868B] hover:bg-[#FAFAFA] hover:text-[#1D1D1F]"}`}
                >
                  ASCII Tree
                </button>
                <button
                  onClick={() => handleFormatChange("json")}
                  className={`w-full flex items-center px-3 py-2 text-[10px] font-bold tracking-tighter uppercase text-left rounded-lg transition-colors ${format === "json" ? "bg-[#F5F5F7] text-[#1D1D1F]" : "text-[#86868B] hover:bg-[#FAFAFA] hover:text-[#1D1D1F]"}`}
                >
                  JSON Data
                </button>
              </div>
            )}
          </div>

          <div className="w-[1px] h-6 bg-[#E8E8ED] mx-2" />

          {/* Primary Action */}
          <button
            onClick={treeData ? handleGenerate : undefined}
            disabled={!treeData}
            className={`
              relative flex-1 flex items-center justify-center gap-2 h-10 rounded-xl text-[11px] font-bold tracking-tight transition-all duration-500
              ${
                !treeData
                  ? "bg-[#F5F5F7] text-[#D2D2D7] border border-[#E8E8ED] cursor-not-allowed"
                  : generated
                    ? "bg-[#34C759] text-white"
                    : "bg-[#1D1D1F] text-white hover:bg-black active:scale-[0.98] shadow-[0_4px_12px_rgba(0,0,0,0.15)]"
              }
            `}
          >
            {generated ? <IconCheck /> : <IconGenerate />}
            <span className="uppercase tracking-wider text-[10px]">
              {generated ? "Canvas Updated" : "Generate"}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;
