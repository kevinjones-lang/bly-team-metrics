import { useEffect, useId, useMemo, useRef, useState, type CSSProperties, type DragEvent, type ReactNode } from "react";
import { formatDay, isTouchDue, SIDES, sideLabel, STATUSES, statusLabel } from "./logic.ts";
import {
  BANDS, cardMatches, chipCount, compareCards, FEE_RATE_LABEL, filterKey, filterLabel, finerStatusLabel, initials,
  stageBlurb, stageLabel, stageOf, STAGES, toggleFilter, visibleStages,
  type BandId, type BoardCard, type BoardFilter, type SortKey, type Stage,
} from "./stages.ts";
import "./board.css";

const SORTS: { id: SortKey; label: string }[] = [
  { id: "updated", label: "Recently updated" },
  { id: "name", label: "Client name" },
  { id: "next", label: "Next follow-up" },
  { id: "emails", label: "Emails sent" },
];

function IconSearch() {
  return <svg className="rb-svg" viewBox="0 0 16 16" aria-hidden="true"><circle cx="7" cy="7" r="4.25" fill="none" stroke="currentColor" strokeWidth="1.4" /><path d="M10.4 10.4 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>;
}
function IconDots() {
  return <svg className="rb-svg" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="3.2" r="1.15" fill="currentColor" /><circle cx="8" cy="8" r="1.15" fill="currentColor" /><circle cx="8" cy="12.8" r="1.15" fill="currentColor" /></svg>;
}
function IconMove() {
  return <svg className="rb-svg" viewBox="0 0 16 16" aria-hidden="true"><path d="M2.5 5.5h8M8.5 3.2 11.2 5.5 8.5 7.8M13.5 10.5h-8M7.5 8.2 4.8 10.5 7.5 12.8" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
function IconMail() {
  return <svg className="rb-svg" viewBox="0 0 16 16" aria-hidden="true"><rect x="2" y="3.5" width="12" height="9" rx="1.4" fill="none" stroke="currentColor" strokeWidth="1.3" /><path d="M3 5l5 4 5-4" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" /></svg>;
}
function IconClose() {
  return <svg className="rb-svg" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>;
}
function IconPulse() {
  return <svg className="rb-svg" viewBox="0 0 16 16" aria-hidden="true"><path d="M1.5 8h3l1.5-3.2L8.2 11l1.6-3H14.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
function IconLink() {
  return <svg className="rb-svg" viewBox="0 0 16 16" aria-hidden="true"><path d="M6.6 9.4a2.6 2.6 0 0 0 3.7 0l1.8-1.8a2.6 2.6 0 0 0-3.7-3.7L7.4 4.9" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /><path d="M9.4 6.6a2.6 2.6 0 0 0-3.7 0L3.9 8.4a2.6 2.6 0 0 0 3.7 3.7l1-1" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>;
}
function IconCheck() {
  return <svg className="rb-svg" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="5.2" fill="none" stroke="currentColor" strokeWidth="1.4" /><path d="M5.2 8.2 7.1 10l3.7-4" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
function IconLeaf() {
  return <svg className="rb-svg" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 12.5C4 7 8.2 3.2 13.2 3.2 13 8.8 9.2 12.5 4 12.5Z" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" /><path d="M6.2 10.2c1.2-1.3 2.4-2.2 4.2-3.2" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>;
}

function BandIcon({ id }: { id: BandId }) {
  switch (id) {
    case "active": return <IconPulse />;
    case "connected": return <IconLink />;
    case "closed": return <IconCheck />;
    case "nurture": return <IconLeaf />;
    default: {
      const _n: never = id;
      return _n;
    }
  }
}

function Grip() {
  return <span className="rb-grip" aria-hidden="true"><i /><i /><i /><i /><i /><i /></span>;
}

function placeMenu(rect: DOMRect, wide: boolean): CSSProperties {
  const width = wide ? 224 : 192;
  const estimated = 260;
  const left = Math.min(Math.max(8, rect.left), window.innerWidth - width - 8);
  const top = rect.bottom + 6 + estimated > window.innerHeight && rect.top > estimated
    ? Math.max(8, rect.top - estimated)
    : rect.bottom + 6;
  return { top, left };
}

function MenuButton(props: { label: string; className?: string; wide?: boolean; icon?: ReactNode; children?: ReactNode; menu: (close: () => void) => ReactNode }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<CSSProperties>({ top: 0, left: 0 });
  const btn = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (event: MouseEvent) => {
      const node = event.target;
      if (!(node instanceof Node)) return;
      if (btn.current?.contains(node) || panel.current?.contains(node)) return;
      setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const onScroll = () => setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open]);
  return (
    <>
      <button
        ref={btn}
        type="button"
        className={props.className ?? "rb-icon-btn"}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={props.label}
        onClick={(event) => {
          event.stopPropagation();
          const rect = btn.current?.getBoundingClientRect();
          if (rect) setPos(placeMenu(rect, Boolean(props.wide)));
          setOpen((value) => !value);
        }}
      >
        {props.icon ?? props.children}
        {props.icon ? props.children : null}
      </button>
      {open ? (
        <div ref={panel} className={"rb-menu" + (props.wide ? " is-wide" : "")} style={pos} role="menu">
          {props.menu(() => setOpen(false))}
        </div>
      ) : null}
    </>
  );
}

function Meta({ label, value, title }: { label: string; value: string; title?: string }) {
  return <div><span>{label}</span><strong title={title ?? value}>{value}</strong></div>;
}

function CardView(props: { card: BoardCard; now: Date; onOpen: (id: string) => void; onMove: (id: string, stage: Stage) => void; onDragStart: (id: string, card: HTMLElement) => void; onDragEnd: (card: HTMLElement) => void }) {
  const { card } = props;
  const stage = stageOf(card.status);
  const finer = finerStatusLabel(card.status);
  const due = isTouchDue(card.nextTouchOn, card.status, props.now);
  const letters = initials(card.blyAgent);
  const last = formatDay(card.lastEmailAt);
  return (
    <article
      className="rb-card"
      data-card-id={card.id}
      aria-label={`${card.clientName}, ${stageLabel(stage)}`}
    >
      <div
        className="rb-handle"
        draggable
        aria-hidden="true"
        onDragStart={(event) => {
          event.stopPropagation();
          event.dataTransfer.setData("text/plain", card.id);
          event.dataTransfer.effectAllowed = "move";
          const shell = event.currentTarget.closest(".rb-card");
          if (shell instanceof HTMLElement) {
            event.dataTransfer.setDragImage(shell, 24, 24);
            props.onDragStart(card.id, shell);
          }
        }}
        onDragEnd={(event) => {
          const shell = event.currentTarget.closest(".rb-card");
          if (shell instanceof HTMLElement) props.onDragEnd(shell);
        }}
      >
        <Grip />
      </div>
      <div className="rb-card-body">
        <button type="button" className="rb-open" aria-label={`Open ${card.clientName}`} onClick={() => props.onOpen(card.id)}>
          {card.side || finer || due ? (
            <span className="rb-badges">
              {card.side ? <span className="rb-badge">{sideLabel(card.side)}</span> : null}
              {finer ? <span className="rb-badge">{finer}</span> : null}
              {due ? <span className="rb-badge is-warn">Follow-up due</span> : null}
            </span>
          ) : null}
          <span className="rb-name">{card.clientName}</span>
          <span className="rb-meta">
            <Meta label="Last follow-up" value={last} />
            <Meta label="Location" value={card.location?.trim() || "—"} />
            <Meta label="Receiving agent" value={card.receivingAgent?.trim() || "—"} />
            <Meta label="Bly agent on the lead" value={card.blyAgent?.trim() || "—"} />
            <Meta label="Fee" value={FEE_RATE_LABEL} title="Standard 25% referral fee. Referrals do not store a sale price." />
          </span>
        </button>
        <div className="rb-card-foot">
          <span className={"rb-avatar" + (letters ? "" : " is-empty")} title={card.blyAgent?.trim() ? `Bly agent ${card.blyAgent.trim()}` : "No Bly agent yet"}>{letters || "–"}</span>
          <span className="rb-card-actions">
            <MenuButton label={`Move ${card.clientName}`} icon={<IconMove />} menu={(close) => (
              <>
                <div className="rb-kicker">Move to</div>
                {STAGES.map((target) => (
                  <button key={target} type="button" role="menuitem" aria-current={target === stage ? "true" : undefined} onClick={() => { props.onMove(card.id, target); close(); }}>
                    {stageLabel(target)}
                  </button>
                ))}
              </>
            )} />
            <span className="rb-mail" title="Emails sent"><IconMail />{card.emailCount}</span>
          </span>
        </div>
      </div>
    </article>
  );
}

function ColumnFoot({ count }: { count: number }) {
  const text = count === 1 ? "1 referral" : `${count} referrals`;
  return <footer className="rb-foot" title="Referral count. No sale price is stored, so this is not a fee total.">{text}</footer>;
}

export function ReferralDrawer(props: { title: string; onClose: () => void; children: ReactNode }) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(props.onClose);
  onCloseRef.current = props.onClose;
  useEffect(() => {
    closeRef.current?.focus();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (document.querySelector(".rb-menu")) return;
      onCloseRef.current();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", onKey);
    };
  }, []);
  return (
    <>
      <button type="button" className="rb-scrim" aria-label="Close details" onClick={props.onClose} />
      <aside className="rb-drawer" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <header className="rb-drawer-head">
          <h2 id={titleId}>{props.title}</h2>
          <button ref={closeRef} type="button" className="rb-icon-btn" aria-label="Close" onClick={props.onClose}><IconClose /></button>
        </header>
        <div className="rb-drawer-body">{props.children}</div>
      </aside>
    </>
  );
}

export default function BoardView(props: {
  rows: readonly BoardCard[];
  addHref: string;
  nurtureMoved?: number;
  alert?: string;
  extras?: ReactNode;
  onOpen: (id: string) => void;
  onMove: (id: string, stage: Stage) => void;
}) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("updated");
  const [view, setView] = useState<"pipeline" | "list">("pipeline");
  const [filters, setFilters] = useState<BoardFilter[]>([]);
  const dragId = useRef<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const [now] = useState(() => new Date());
  const shown = useMemo(
    () => props.rows.filter((card) => cardMatches(card, filters, query, now)).sort((a, b) => compareCards(sort, a, b)),
    [props.rows, filters, query, now, sort],
  );
  const stages = visibleStages(filters);
  const due = props.rows.filter((card) => isTouchDue(card.nextTouchOn, card.status, now)).length;
  const dueOn = filters.some((filter) => filter.kind === "due");
  const toggle = (filter: BoardFilter) => setFilters((current) => toggleFilter(current, filter));
  const cardsFor = (stage: Stage) => shown.filter((card) => stageOf(card.status) === stage);

  const clearDrag = () => {
    dragId.current = null;
    rootRef.current?.classList.remove("is-dragging");
    rootRef.current?.querySelectorAll(".is-over, .is-dragging").forEach((node) => node.classList.remove("is-over", "is-dragging"));
  };
  const onDragOver = (event: DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    const col = event.currentTarget;
    if (col instanceof HTMLElement && !col.classList.contains("is-over")) {
      rootRef.current?.querySelectorAll(".is-over").forEach((node) => node.classList.remove("is-over"));
      col.classList.add("is-over");
    }
  };
  const onDrop = (event: DragEvent, stage: Stage) => {
    event.preventDefault();
    const id = event.dataTransfer.getData("text/plain") || dragId.current || "";
    clearDrag();
    if (id) props.onMove(id, stage);
  };

  const bandButtons = (layout: "grid" | "row") => {
    const cells: { id: BandId; label: string; start: number; span: number; count: number }[] = [];
    let cursor = 1;
    for (const band of BANDS) {
      const members = band.stages.filter((stage) => stages.includes(stage));
      if (!members.length && layout === "grid") continue;
      const rest = filters.filter((filter) => filter.kind !== "band");
      const count = props.rows.filter((card) => band.stages.includes(stageOf(card.status)) && cardMatches(card, rest, query, now)).length;
      cells.push({ id: band.id, label: band.label, start: cursor, span: Math.max(members.length, 1), count });
      cursor += Math.max(members.length, 1);
    }
    return cells.map((cell) => {
      const style: CSSProperties | undefined = layout === "grid" ? { gridColumn: `${cell.start} / span ${cell.span}`, gridRow: 1 } : undefined;
      const pressed = filters.some((filter) => filter.kind === "band" && filter.band === cell.id);
      return (
        <button key={cell.id} type="button" className="rb-band" data-band={cell.id} aria-pressed={pressed} style={style} onClick={() => toggle({ kind: "band", band: cell.id })}>
          <span className="rb-band-icon"><BandIcon id={cell.id} /></span>
          <span className="rb-serif">{cell.label}</span>
          <span className="rb-count-pill">{cell.count}</span>
        </button>
      );
    });
  };

  const cardProps = {
    now,
    onOpen: props.onOpen,
    onMove: props.onMove,
    onDragStart: (id: string, card: HTMLElement) => {
      dragId.current = id;
      card.classList.add("is-dragging");
      rootRef.current?.classList.add("is-dragging");
    },
    onDragEnd: (card: HTMLElement) => {
      card.classList.remove("is-dragging");
      rootRef.current?.classList.remove("is-dragging");
      rootRef.current?.querySelectorAll(".is-over").forEach((node) => node.classList.remove("is-over"));
      const id = dragId.current;
      queueMicrotask(() => { if (dragId.current === id) dragId.current = null; });
    },
  };

  return (
    <div className="rb-board" ref={rootRef}>
      <div className="rb-toolbar">
        <div className="rb-toolbar-main">
          <label className="rb-sr" htmlFor="rb-view">View</label>
          <select id="rb-view" className="rb-select" aria-label="View" value={view} onChange={(event) => setView(event.target.value === "list" ? "list" : "pipeline")}>
            <option value="pipeline">Pipeline</option>
            <option value="list">List</option>
          </select>
          <label className="rb-search">
            <span className="rb-sr">Search referrals</span>
            <IconSearch />
            <input type="search" placeholder="Search" value={query} onChange={(event) => setQuery(event.target.value)} />
          </label>
          <MenuButton className="rb-filter" wide label="Filter referrals" menu={(close) => (
            <>
              <div className="rb-kicker">Status</div>
              {STATUSES.map((status) => (
                <button key={status} type="button" role="menuitemcheckbox" aria-checked={filters.some((filter) => filter.kind === "status" && filter.status === status)} onClick={() => toggle({ kind: "status", status })}>
                  {statusLabel(status)}
                  <span className="rb-count-pill">{props.rows.filter((card) => card.status === status).length}</span>
                </button>
              ))}
              <div className="rb-kicker">Side</div>
              {SIDES.map((side) => (
                <button key={side} type="button" role="menuitemcheckbox" aria-checked={filters.some((filter) => filter.kind === "side" && filter.side === side)} onClick={() => toggle({ kind: "side", side })}>
                  {sideLabel(side)}
                  <span className="rb-count-pill">{props.rows.filter((card) => card.side === side).length}</span>
                </button>
              ))}
              <div className="rb-kicker">Follow-up</div>
              <button type="button" role="menuitemcheckbox" aria-checked={dueOn} onClick={() => { toggle({ kind: "due" }); close(); }}>
                Follow-up due
                <span className="rb-count-pill">{due}</span>
              </button>
              {filters.length ? <button type="button" role="menuitem" onClick={() => { setFilters([]); close(); }}>Clear filters</button> : null}
            </>
          )}>
            Filter
            {filters.length ? <span className="rb-count-pill">{filters.length}</span> : null}
          </MenuButton>
          {filters.length ? (
            <ul className="rb-chips">
              {filters.map((filter) => (
                <li key={filterKey(filter)} className="rb-chip">
                  <span>{filterLabel(filter)}</span>
                  <span className="rb-count-pill">{chipCount(props.rows, filter, now)}</span>
                  <button type="button" aria-label={`Remove ${filterLabel(filter)} filter`} onClick={() => toggle(filter)}>×</button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <div className="rb-toolbar-end">
          <label className="rb-sr" htmlFor="rb-sort">Sort</label>
          <select id="rb-sort" className="rb-select" aria-label="Sort referrals" value={sort} onChange={(event) => {
            const value = event.target.value;
            if (value === "updated" || value === "name" || value === "next" || value === "emails") setSort(value);
          }}>
            {SORTS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
          <a className="rb-add" href={props.addHref}>Add referral</a>
        </div>
      </div>
      <p className="rb-sr" aria-live="polite">{shown.length === 1 ? "1 referral showing" : `${shown.length} referrals showing`}</p>
      {(props.nurtureMoved ?? 0) > 0 ? <p className="rb-banner" role="status">{props.nurtureMoved === 1 ? "1 referral moved to Nurture" : `${props.nurtureMoved} referrals moved to Nurture`} after six months without a touch.</p> : null}
      {due > 0 && !dueOn ? <p className="rb-banner" role="status">{due === 1 ? "1 referral is due" : `${due} referrals are due`} for a follow-up. <button type="button" onClick={() => toggle({ kind: "due" })}>Show due</button></p> : null}
      {props.alert ? <p className="rb-banner is-alert" role="alert">{props.alert}</p> : null}
      {props.rows.length === 0 ? <p className="rb-banner">No referrals yet. Use Add referral to create the first one.</p> : null}
      {props.extras}
      <div className={"rb-scroll" + (view === "list" ? " is-list" : "")}>
        {view === "pipeline" ? (
          stages.length === 0 ? <p className="rb-empty">No column matches these filters.</p> : (
            <div className="rb-pipeline" style={{ gridTemplateColumns: `repeat(${stages.length}, var(--size-column))` }}>
              {bandButtons("grid")}
              {stages.map((stage, index) => {
                const cards = cardsFor(stage);
                const only = filters.some((filter) => filter.kind === "stage" && filter.stage === stage);
                return (
                  <section
                    key={stage}
                    className="rb-col"
                    style={{ gridColumn: index + 1, gridRow: 2 }}
                    aria-label={stageLabel(stage)}
                    data-stage={stage}
                    onDragOver={onDragOver}
                    onDragLeave={(event) => {
                      if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
                      event.currentTarget.classList.remove("is-over");
                    }}
                    onDrop={(event) => onDrop(event, stage)}
                  >
                    <header className="rb-col-head">
                      <h2>{stageLabel(stage)}</h2>
                      <span className="rb-count-pill">{cards.length}</span>
                      <MenuButton label={`${stageLabel(stage)} column menu`} icon={<IconDots />} menu={(close) => (
                        <>
                          <button type="button" role="menuitem" onClick={() => { toggle({ kind: "stage", stage }); close(); }}>{only ? "Show every stage" : `Show only ${stageLabel(stage)}`}</button>
                          <p>{stageBlurb(stage)}</p>
                        </>
                      )} />
                    </header>
                    <div className="rb-col-body">
                      {cards.length === 0 ? <p className="rb-empty"><span className="rb-empty-idle">Nothing in this stage</span><span className="rb-empty-drop">Drop here</span></p> : cards.map((card) => (
                        <CardView key={card.id} card={card} {...cardProps} />
                      ))}
                    </div>
                    <ColumnFoot count={cards.length} />
                  </section>
                );
              })}
            </div>
          )
        ) : (
          <div className="rb-list">
            <div className="rb-bands-inline">{bandButtons("row")}</div>
            {stages.map((stage) => {
              const cards = cardsFor(stage);
              return (
                <section key={stage} className="rb-list-stage" aria-label={stageLabel(stage)} data-stage={stage} onDragOver={onDragOver} onDrop={(event) => onDrop(event, stage)}>
                  <header className="rb-list-head">
                    <h2 className="rb-serif">{stageLabel(stage)}</h2>
                    <span className="rb-count-pill">{cards.length}</span>
                  </header>
                  <div className="rb-stack">
                    {cards.length === 0 ? <p className="rb-empty"><span className="rb-empty-idle">Nothing in this stage</span><span className="rb-empty-drop">Drop here</span></p> : cards.map((card) => (
                      <CardView key={card.id} card={card} {...cardProps} />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
