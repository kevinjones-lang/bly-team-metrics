import { useState } from "react";
import { createRoot } from "react-dom/client";
import BoardView, { ReferralDrawer } from "./BoardView.tsx";
import { MOCK_CARDS } from "./mockBoard.ts";
import { stageLabel, stageOf, statusForStageMove, type BoardCard } from "./stages.ts";

function Preview() {
  const [rows, setRows] = useState<BoardCard[]>(MOCK_CARDS);
  const [openId, setOpenId] = useState<string | null>(null);
  const card = rows.find((item) => item.id === openId) ?? null;
  return (
    <div className="rb rb-preview">
      <BoardView
        rows={rows}
        addHref="#preview-add"
        nurtureMoved={0}
        onOpen={setOpenId}
        onMove={(id, stage) => {
          setRows((list) => list.map((item) => item.id === id ? { ...item, status: statusForStageMove(item.status, stage) } : item));
        }}
      />
      {card ? (
        <ReferralDrawer title={card.clientName} onClose={() => setOpenId(null)}>
          <p className="rb-preview-note">
            {card.clientName} is in {stageLabel(stageOf(card.status))}. Location {card.location || "unknown"}. Receiving agent {card.receivingAgent || "not chosen"}. Bly agent {card.blyAgent || "not named"}.
            The live record opens the existing editor: fields, PDF preview, the Outlook draft, and I sent it.
          </p>
          <button type="button" className="primary">Save</button>
        </ReferralDrawer>
      ) : null}
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<Preview />);
