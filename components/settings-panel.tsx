"use client";

import { useCallback, useEffect, useState } from "react";
import {
  clearSettings,
  getLastSyncAt,
  getSyncError,
  getSyncStatus,
  initCloudSync,
  loadSettings,
  onSyncChange,
  pullFromCloud,
  pushToCloud,
  type GistSettings,
} from "@/lib/storage";
import type { EventItem, TodoItem } from "@/types";

type Props = {
  events: EventItem[];
  todos: TodoItem[];
  onDataLoaded: (events: EventItem[], todos: TodoItem[]) => void;
  onClose: () => void;
};

export function SettingsPanel({ events, todos, onDataLoaded, onClose }: Props) {
  const [token, setToken] = useState("");
  const [configured, setConfigured] = useState(false);
  const [syncStatus, setSyncStatus] = useState(getSyncStatus());
  const [syncError, setSyncError] = useState(getSyncError());
  const [lastSyncAt, setLastSyncAt] = useState(getLastSyncAt());
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // 监听外部同步状态变化
  useEffect(() => {
    return onSyncChange(() => {
      setSyncStatus(getSyncStatus());
      setSyncError(getSyncError());
      setLastSyncAt(getLastSyncAt());
    });
  }, []);

  // 初始化：检查是否已配置
  useEffect(() => {
    const settings = loadSettings();
    if (settings) {
      setConfigured(true);
      setToken(settings.token);
    }
  }, []);

  const handleConnect = useCallback(async () => {
    if (!token.trim()) {
      setMessage("请输入 GitHub Personal Access Token");
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      await initCloudSync(token.trim());
      setConfigured(true);
      setMessage("✅ 云同步已连接！以后每次修改数据都会自动同步到云端。");
    } catch (error) {
      setMessage(
        `❌ ${error instanceof Error ? error.message : "连接失败"}`,
      );
    } finally {
      setLoading(false);
    }
  }, [token]);

  const handleSyncNow = useCallback(async () => {
    setLoading(true);
    setMessage(null);

    try {
      await pushToCloud(events, todos);
      setMessage("✅ 数据已同步到云端");
    } catch (error) {
      setMessage(
        `❌ ${error instanceof Error ? error.message : "同步失败"}`,
      );
    } finally {
      setLoading(false);
    }
  }, [events, todos]);

  const handleLoadFromCloud = useCallback(async () => {
    if (
      !confirm(
        "从云端加载将覆盖当前本地数据，确定继续？\n\n建议先导出本地数据备份。",
      )
    ) {
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const data = await pullFromCloud();
      if (data) {
        onDataLoaded(data.events, data.todos);
        setMessage(
          `✅ 已从云端加载：${data.events.length} 条工作记录，${data.todos.length} 个待办任务`,
        );
      }
    } catch (error) {
      setMessage(
        `❌ ${error instanceof Error ? error.message : "加载失败"}`,
      );
    } finally {
      setLoading(false);
    }
  }, [onDataLoaded]);

  const handleDisconnect = useCallback(() => {
    if (confirm("断开云同步将移除本地保存的 Token，云端数据不受影响。确定断开？")) {
      clearSettings();
      setConfigured(false);
      setToken("");
      setMessage("云同步已断开。如需重新连接，请再次输入 Token。");
    }
  }, []);

  const statusLabel = (): string => {
    switch (syncStatus) {
      case "syncing":
        return "⏳ 同步中...";
      case "success":
        return lastSyncAt
          ? `✅ 上次同步: ${new Date(lastSyncAt).toLocaleString("zh-CN")}`
          : "✅ 已连接";
      case "error":
        return `⚠️ ${syncError ?? "同步出错"}`;
      default:
        return configured ? "📡 等待同步" : "⚪ 未配置";
    }
  };

  const maskToken = (t: string): string => {
    if (t.length <= 8) return "****";
    return t.slice(0, 4) + "****" + t.slice(-4);
  };

  return (
    <div
      className="modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label="云同步设置"
    >
      <div className="modal-panel settings-panel">
        <div className="modal-header">
          <h2>☁️ 云同步设置</h2>
          <button
            className="modal-close-button"
            type="button"
            onClick={onClose}
            aria-label="关闭"
          >
            ✕
          </button>
        </div>

        {/* 状态栏 */}
        <div className="settings-status-bar">
          <span className="settings-status-text">{statusLabel()}</span>
        </div>

        {/* Token 配置区 */}
        {!configured ? (
          <div className="settings-section">
            <label className="settings-label" htmlFor="github-token">
              GitHub Personal Access Token
            </label>
            <p className="settings-hint">
              需要一个具有 <code>gist</code> 权限的
              Fine-grained Token。
              <br />
              <a
                href="https://github.com/settings/tokens?type=beta"
                target="_blank"
                rel="noopener noreferrer"
              >
                点此创建 Token →
              </a>
              &nbsp;创建时选择 &quot;Only select repositories&quot; 并授予
              Read/Write Gist 权限。
            </p>
            <div className="settings-token-row">
              <input
                id="github-token"
                className="settings-token-input"
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="github_pat_xxxxxxxxxxxx"
                autoComplete="off"
              />
              <button
                className="primary-button"
                type="button"
                onClick={handleConnect}
                disabled={loading || !token.trim()}
              >
                {loading ? "连接中..." : "连接云同步"}
              </button>
            </div>
          </div>
        ) : (
          <div className="settings-section">
            <label className="settings-label">已配置 Token</label>
            <div className="settings-token-row">
              <input
                className="settings-token-input"
                type="text"
                value={maskToken(token)}
                disabled
              />
              <button
                className="ghost-button"
                type="button"
                onClick={handleDisconnect}
                style={{ color: "#dc2626", whiteSpace: "nowrap" }}
              >
                断开连接
              </button>
            </div>
          </div>
        )}

        {/* 操作区 */}
        {configured && (
          <div className="settings-section">
            <label className="settings-label">云端操作</label>
            <div className="settings-actions-row">
              <button
                className="ghost-button"
                type="button"
                onClick={handleSyncNow}
                disabled={loading}
              >
                ☁️ 立即同步到云端
              </button>
              <button
                className="ghost-button"
                type="button"
                onClick={handleLoadFromCloud}
                disabled={loading}
              >
                📥 从云端加载数据
              </button>
            </div>
            <p className="settings-hint">
              数据修改后会自动同步到云端。&quot;从云端加载&quot;会覆盖本地数据，请谨慎操作。
            </p>
          </div>
        )}

        {/* 消息 */}
        {message && (
          <div
            className={`settings-message ${
              message.startsWith("✅")
                ? "settings-message-success"
                : "settings-message-error"
            }`}
          >
            {message}
          </div>
        )}

        {/* 帮助 */}
        <details className="settings-help">
          <summary>💡 云同步原理与安全说明</summary>
          <ul>
            <li>数据存储在<strong>你的</strong> GitHub 账号下的私有 Gist 中，别人看不到</li>
            <li>Token 仅保存在当前浏览器 localStorage 中，不会上传到任何第三方服务器</li>
            <li>换一台电脑/浏览器后，重新输入同一个 Token 即可拉回所有数据</li>
            <li>Gist 每次更新会自动保留历史版本，可在 GitHub 上手动恢复旧版本</li>
            <li>Token 如需撤销，前往 GitHub Settings → Developer settings → Tokens</li>
          </ul>
        </details>
      </div>
    </div>
  );
}
