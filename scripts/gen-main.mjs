// Post-gen step: mounts the main Team screen (src/MainScreen.tsx: Snapshot / Pacing / CEO) into the generated Dashboard.tsx.
// Runs after gen-dashboard.mjs; patches only Team-tab wiring so the canvas template stays unchanged.
import fs from "fs";
const f = new URL("../src/Dashboard.tsx", import.meta.url);
let t = fs.readFileSync(f, "utf8");
const rep = (re, s) => { if (!re.test(t)) throw new Error("gen-main: pattern not found: " + re); t = t.replace(re, s); };
rep(/(const \[tab, setTab\] = useState<string>\("team"\);)/, '$1\n  const [mainTab, setMainTab] = useState<string>("snapshot");');
rep(/(return ALLOW\[tab\]\.includes\(String\(h\)\.split\(":"\)\[0\]\);\n    \}\);)/,
  '$1\n    if (tab === "team") { // main Team screen: Snapshot / Pacing / CEO; legacy sections live under Details\n' +
  '      const fi = kids.findIndex((c: any) => c.props && c.props.heading === "Filters");\n' +
  '      const keep = mainTab === "details" ? kids : kids.filter((c: any) => !(c.props && c.props.heading && c.props.heading !== "Filters"));\n' +
  '      kids.length = 0; kids.push(...keep);\n' +
  '      kids.splice(fi + 1, 0, <MainScreen key="main" data={D.main} lrOn={lrOn === "on"} tab={mainTab} setTab={setMainTab} />);\n    }');
rep(/(\nimport [^\n]*from "\.\/kit";\n)/, '$1import MainScreen from "./MainScreen";\n');
fs.writeFileSync(f, t);
console.log("gen-main: mounted MainScreen on the Team tab");
