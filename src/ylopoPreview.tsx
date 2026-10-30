// Dev-only preview of the ops hub with a ylopo.v1 sample. Not a production entry, and not live snapshot data.
import { createRoot } from "react-dom/client";
import Layout from "./Layout";
import "./styles.css";
import sample from "./dev/ylopo.sample.json";

const params = new URLSearchParams(window.location.search);
const empty = params.get("empty") === "1";
const route = params.get("route") === "hub" ? "hub" : "ylopo";
const current = window.location.hash.replace(/^#\/?/, "").split(/[/?]/)[0];
if (!current) window.location.hash = "#/" + route;

function Unavailable() {
  return <p style={{ fontFamily: "Georgia, serif", padding: 24 }}>Ylopo preview is for local development only.</p>;
}

const root = document.getElementById("root");
if (!root) throw new Error("missing root");

if (!import.meta.env.DEV) {
  createRoot(root).render(<Unavailable />);
} else {
  const asOf = typeof sample.as_of === "string" ? sample.as_of.slice(0, 10) : undefined;
  createRoot(root).render(
    <Layout payload={empty ? {} : { ylopo: sample }} asOf={empty ? undefined : asOf} metricsPending={false} />,
  );
}
