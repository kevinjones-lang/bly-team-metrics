// Post-gen step: adds the Multi-Year Trends tab (src/Myt.tsx) to the generated Dashboard.tsx.
// Runs after gen-dashboard.mjs / gen-main.mjs; touches only tab wiring so the canvas template stays unchanged.
import fs from "fs";
const f = new URL("../src/Dashboard.tsx", import.meta.url);
let t = fs.readFileSync(f, "utf8");
const rep = (re, s) => { if (!re.test(t)) throw new Error("gen-myt: pattern not found: " + re); t = t.replace(re, s); };
rep(/(\{ value: "ask", label: "Ask" \})\];/, '$1, { value: "myt", label: "Multi-Year Trends" }];');
rep(/ask: \[\], attr:/, 'ask: [], myt: [], attr:');
rep(/const body = tab === "ask" \?/, 'const body = tab === "myt" ? [...kids.filter((c: any) => !(c.props && c.props.heading && c.props.heading !== "Filters")), <Myt key="myt" data={D.myt} lrOn={lrOn === "on"} />] : tab === "ask" ?');
rep(/(\nimport [^\n]*from "\.\/kit";\n)/, '$1import Myt from "./Myt";\n');
fs.writeFileSync(f, t);
console.log("gen-myt: added Multi-Year Trends tab");
