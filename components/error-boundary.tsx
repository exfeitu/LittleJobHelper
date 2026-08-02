"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = {
  children: ReactNode;
};

type State = {
  hasError: boolean;
  message: string | null;
};

/**
 * 顶层错误边界：捕获渲染异常，避免单个组件崩溃导致整页白屏。
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: null };

  static getDerivedStateFromError(error: unknown): State {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : "发生未知错误",
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("ErrorBoundary caught:", error, info);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "60vh",
            gap: "16px",
            padding: "40px",
            textAlign: "center",
            color: "var(--text)",
          }}
        >
          <h2>😵 页面出错了</h2>
          <p style={{ color: "var(--muted)", maxWidth: 420 }}>
            {this.state.message}
          </p>
          <button className="primary-button" type="button" onClick={this.handleReload}>
            重新加载
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
