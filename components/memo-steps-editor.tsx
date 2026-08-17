"use client";

import { useState } from "react";
import { MemoStep } from "@/types";
import { genId } from "@/lib/utils";

type MemoStepsEditorProps = {
  steps: MemoStep[];
  onChange: (steps: MemoStep[]) => void;
};

/**
 * checklist 步骤编辑器：动态增删步骤、完成勾选、易错点开关。
 */
export function MemoStepsEditor({ steps, onChange }: MemoStepsEditorProps) {
  const [newStep, setNewStep] = useState("");

  const updateStep = (id: string, patch: Partial<MemoStep>) => {
    onChange(steps.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  };

  const removeStep = (id: string) => {
    onChange(steps.filter((s) => s.id !== id));
  };

  const addStep = () => {
    const content = newStep.trim();
    if (!content) return;
    onChange([...steps, { id: genId("step"), content, completed: false }]);
    setNewStep("");
  };

  return (
    <div className="memo-steps-editor">
      {steps.length === 0 && (
        <p className="empty-note">还没有步骤，从下方添加第一条吧。</p>
      )}
      {steps.map((step, index) => (
        <div key={step.id} className={`memo-step-row ${step.isWarning ? "memo-step-warning" : ""}`}>
          <span className="memo-step-index">{index + 1}</span>
          <input
            type="checkbox"
            checked={step.completed}
            onChange={(e) => updateStep(step.id, { completed: e.target.checked })}
            aria-label={`步骤 ${index + 1} 完成`}
          />
          <input
            className="memo-step-input"
            value={step.content}
            onChange={(e) => updateStep(step.id, { content: e.target.value })}
            placeholder={`步骤 ${index + 1}`}
          />
          <button
            type="button"
            className={`chip-button ${step.isWarning ? "chip-tag-active" : ""}`}
            onClick={() => updateStep(step.id, { isWarning: !step.isWarning })}
            title="标记为易错点（红色高亮提示）"
          >
            {step.isWarning ? "⚠ 已标易错点" : "⚠ 易错点"}
          </button>
          <button
            type="button"
            className="memo-step-remove"
            onClick={() => removeStep(step.id)}
            aria-label="删除步骤"
            title="删除步骤"
          >
            ✕
          </button>
        </div>
      ))}
      <div className="memo-step-add">
        <input
          value={newStep}
          onChange={(e) => setNewStep(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addStep();
            }
          }}
          placeholder="输入步骤内容，回车添加"
        />
        <button type="button" className="ghost-button" onClick={addStep} disabled={!newStep.trim()}>
          添加步骤
        </button>
      </div>
    </div>
  );
}
