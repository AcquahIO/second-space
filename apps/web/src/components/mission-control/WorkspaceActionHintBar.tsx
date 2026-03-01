"use client";

import type { WorkspaceActionHint, WorkspaceActionType } from "@second-space/shared-types";

interface WorkspaceActionHintBarProps {
  hints: WorkspaceActionHint[];
  disabled?: boolean;
  onAction: (type: WorkspaceActionType) => void;
}

export default function WorkspaceActionHintBar({ hints, disabled = false, onAction }: WorkspaceActionHintBarProps) {
  if (!hints.length) {
    return null;
  }

  return (
    <div className="workspace-action-hint-bar">
      {hints.map((hint) => (
        <button
          className="btn workspace-action-hint"
          disabled={disabled}
          key={`${hint.type}-${hint.label}`}
          onClick={() => onAction(hint.type)}
          title={hint.description}
          type="button"
        >
          {hint.label}
        </button>
      ))}
    </div>
  );
}
