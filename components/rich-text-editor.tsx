"use client";

import { useCallback, useEffect, useRef } from "react";

/**
 * 富文本编辑器（所见即所得，基于 contentEditable + document.execCommand）。
 *
 * 关键约定：
 *  - DOM 是唯一事实源：innerHTML 只在 initialHtml 变化时写入一次，onInput 单向读入。
 *    父组件切到不同备忘时请传 key，强制重挂载，避免内容残留与光标跳动。
 *  - 工具栏按钮 onMouseDown 阻止默认，防止抢走编辑器焦点。
 *  - 粘贴图片自动压缩为 base64（≤900px / JPEG 0.82），避免撑爆 localStorage 与 Gist。
 *  - 保存前调用 sanitizeRichHtml 做白名单清洗。
 */

type RichTextEditorProps = {
  initialHtml: string;
  onChange: (html: string) => void;
  placeholder?: string;
};

// 允许保留的标签（其余全部剥离属性或解包）
const ALLOWED_TAGS = new Set([
  "P", "DIV", "BR", "B", "STRONG", "I", "EM", "U",
  "UL", "OL", "LI", "IMG", "H1", "H2", "H3", "BLOCKQUOTE", "A", "SPAN",
]);

/**
 * HTML 白名单清洗：剥离事件/样式属性、解包非法标签、拦截 javascript:/data: 协议。
 * 依赖浏览器 DOM，保存前与详情渲染前各调用一次。
 */
export function sanitizeRichHtml(html: string): string {
  if (!html) return "";
  const template = document.createElement("template");
  template.innerHTML = html;

  const cleanNode = (container: ParentNode) => {
    for (let i = 0; i < container.childNodes.length; i++) {
      const node = container.childNodes[i];
      if (node.nodeType !== Node.ELEMENT_NODE) continue;
      const el = node as Element;
      const tag = el.tagName.toUpperCase();

      if (!ALLOWED_TAGS.has(tag)) {
        // 解包：把子节点提升到父容器后删除自身
        while (el.firstChild) container.insertBefore(el.firstChild, el);
        container.removeChild(el);
        i--;
        continue;
      }

      // 剥属性
      const toRemove: string[] = [];
      for (const attr of Array.from(el.attributes)) {
        const name = attr.name.toLowerCase();
        if (name.startsWith("on")) toRemove.push(attr.name);
        else if (tag === "IMG" && name !== "src" && name !== "alt") toRemove.push(attr.name);
        else if (tag === "A" && name !== "href") toRemove.push(attr.name);
        else if (tag !== "IMG" && tag !== "A") toRemove.push(attr.name);
      }
      toRemove.forEach((n) => el.removeAttribute(n));

      if (tag === "A") {
        const href = el.getAttribute("href") ?? "";
        if (/^\s*javascript:/i.test(href) || href.startsWith("data:")) {
          el.removeAttribute("href");
        }
      }
      if (tag === "IMG") {
        const src = el.getAttribute("src") ?? "";
        if (/^\s*javascript:/i.test(src)) el.removeAttribute("src");
      }

      cleanNode(el);
    }
  };

  cleanNode(template.content);
  return template.innerHTML;
}

/** 图片压缩：等比缩到 maxWidth 内，转 JPEG base64 */
function compressImage(file: File, maxWidth = 900, quality = 0.82): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxWidth / img.width);
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(reader.result as string);
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = () => reject(new Error("图片解析失败"));
      img.src = reader.result as string;
    };
    reader.onerror = () => reject(new Error("读取图片失败"));
    reader.readAsDataURL(file);
  });
}

function ToolButton({
  title,
  onMouseDown,
  children,
}: {
  title: string;
  onMouseDown: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className="rich-text-tool-btn"
      title={title}
      aria-label={title}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onMouseDown}
    >
      {children}
    </button>
  );
}

export function RichTextEditor({ initialHtml, onChange, placeholder }: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // DOM 是唯一事实源：仅在 initialHtml 变化时写入一次（不把 onChange 读到的内容回灌）
  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.innerHTML = initialHtml;
    }
  }, [initialHtml]);

  const runCommand = useCallback(
    (command: string, value?: string) => {
      const el = editorRef.current;
      if (!el) return;
      el.focus();
      try {
        document.execCommand(command, false, value);
      } catch {
        // execCommand 在个别浏览器可能抛错，忽略即可
      }
      onChange(el.innerHTML);
    },
    [onChange],
  );

  const insertImage = useCallback(
    (dataUrl: string) => {
      const el = editorRef.current;
      if (!el) return;
      el.focus();
      document.execCommand("insertHTML", false, `<img src="${dataUrl}" alt="图片" />`);
      onChange(el.innerHTML);
    },
    [onChange],
  );

  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLDivElement>) => {
      const items = Array.from(e.clipboardData?.items ?? []);
      const images = items.filter((i) => i.type.startsWith("image/"));
      if (images.length > 0) {
        e.preventDefault();
        const file = images[0].getAsFile();
        if (!file) return;
        compressImage(file).then(insertImage).catch(() => {});
        return;
      }
      // 纯文本粘贴：插入纯文本，避免 Word 等富文本源的垃圾 HTML
      e.preventDefault();
      const text = e.clipboardData.getData("text/plain");
      document.execCommand("insertText", false, text);
      onChange(editorRef.current?.innerHTML ?? "");
    },
    [insertImage, onChange],
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (!file) return;
      compressImage(file).then(insertImage).catch(() => {});
    },
    [insertImage],
  );

  return (
    <div className="rich-text-editor">
      <div className="rich-text-toolbar" role="toolbar" aria-label="正文格式">
        <ToolButton title="加粗 (Ctrl+B)" onMouseDown={() => runCommand("bold")}>
          <b>B</b>
        </ToolButton>
        <ToolButton title="斜体 (Ctrl+I)" onMouseDown={() => runCommand("italic")}>
          <i>I</i>
        </ToolButton>
        <ToolButton title="下划线" onMouseDown={() => runCommand("underline")}>
          <u>U</u>
        </ToolButton>
        <span className="rich-text-tool-divider" />
        <ToolButton title="设为标题 (H3)" onMouseDown={() => runCommand("formatBlock", "H3")}>
          H
        </ToolButton>
        <ToolButton title="正文段落" onMouseDown={() => runCommand("formatBlock", "P")}>
          ¶
        </ToolButton>
        <span className="rich-text-tool-divider" />
        <ToolButton title="无序列表" onMouseDown={() => runCommand("insertUnorderedList")}>
          ≡
        </ToolButton>
        <ToolButton title="有序列表" onMouseDown={() => runCommand("insertOrderedList")}>
          1.
        </ToolButton>
        <span className="rich-text-tool-divider" />
        <ToolButton title="插入图片" onMouseDown={() => fileInputRef.current?.click()}>
          🖼
        </ToolButton>
      </div>
      <div
        ref={editorRef}
        className="rich-text-area"
        contentEditable
        suppressContentEditableWarning
        data-placeholder={placeholder}
        onInput={(e) => onChange(e.currentTarget.innerHTML)}
        onPaste={handlePaste}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={handleFileChange}
      />
    </div>
  );
}
