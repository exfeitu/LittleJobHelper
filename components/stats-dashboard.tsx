"use client";

import { useMemo } from "react";
import { EventItem, TodoItem } from "@/types";

type StatsProps = {
  events: EventItem[];
  todos: TodoItem[];
};

/**
 * 数据统计概览：工作量、待办完成率、标签分布。
 * 纯展示组件，无副作用。
 */
export function StatsDashboard({ events, todos }: StatsProps) {
  const stats = useMemo(() => {
    const now = new Date();
    const pad2 = (n: number) => String(n).padStart(2, "0");
    const y = now.getFullYear();
    const m = pad2(now.getMonth() + 1);
    const d = pad2(now.getDate());
    const today = `${y}-${m}-${d}`;
    const monthStart = `${y}-${m}-01`;

    const dayOfWeek = now.getDay();
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(now);
    monday.setDate(monday.getDate() + diffToMonday);
    const weekStart = `${monday.getFullYear()}-${pad2(monday.getMonth() + 1)}-${pad2(monday.getDate())}`;

    const todayEvents = events.filter((e) => e.startTime.startsWith(today)).length;
    const weekEvents = events.filter((e) => e.startTime >= weekStart).length;
    const monthEvents = events.filter((e) => e.startTime >= monthStart).length;

    const totalTodos = todos.length;
    const completed = todos.filter((t) => t.status === "completed").length;
    const inProgress = todos.filter((t) => t.status === "in_progress").length;
    const pending = todos.filter((t) => t.status === "pending").length;
    const completionRate = totalTodos ? Math.round((completed / totalTodos) * 100) : 0;

    const tagCount = new Map<string, number>();
    [...events, ...todos].forEach((item) => {
      (item.tags ?? []).forEach((tag) =>
        tagCount.set(tag, (tagCount.get(tag) ?? 0) + 1),
      );
    });
    const topTags = Array.from(tagCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);
    const maxTag = topTags.length ? topTags[0][1] : 0;

    return {
      totalEvents: events.length,
      todayEvents,
      weekEvents,
      monthEvents,
      totalTodos,
      completed,
      inProgress,
      pending,
      completionRate,
      topTags,
      maxTag,
    };
  }, [events, todos]);

  return (
    <div className="stats-dashboard">
      <div className="stats-cards">
        <div className="stat-tile">
          <strong>{stats.totalEvents}</strong>
          <span>工作记录</span>
        </div>
        <div className="stat-tile">
          <strong>{stats.todayEvents} / {stats.weekEvents}</strong>
          <span>今日 / 本周记录</span>
        </div>
        <div className="stat-tile">
          <strong>{stats.totalTodos}</strong>
          <span>待办任务</span>
        </div>
        <div className="stat-tile">
          <strong>{stats.completionRate}%</strong>
          <span>完成率</span>
        </div>
      </div>

      <div className="stats-bars">
        <div className="stats-bar-block">
          <span className="stats-bar-label">待办状态</span>
          <div className="stats-bar-track">
            <span className="stats-bar-seg stats-bar-completed" style={{ width: `${stats.totalTodos ? (stats.completed / stats.totalTodos) * 100 : 0}%` }} title={`已完成 ${stats.completed}`} />
            <span className="stats-bar-seg stats-bar-inprogress" style={{ width: `${stats.totalTodos ? (stats.inProgress / stats.totalTodos) * 100 : 0}%` }} title={`进行中 ${stats.inProgress}`} />
            <span className="stats-bar-seg stats-bar-pending" style={{ width: `${stats.totalTodos ? (stats.pending / stats.totalTodos) * 100 : 0}%` }} title={`未开始 ${stats.pending}`} />
          </div>
          <div className="stats-legend">
            <span>已完成 {stats.completed}</span>
            <span>进行中 {stats.inProgress}</span>
            <span>未开始 {stats.pending}</span>
          </div>
        </div>

        <div className="stats-bar-block">
          <span className="stats-bar-label">标签分布</span>
          {stats.topTags.length > 0 ? (
            <div className="stats-tag-bars">
              {stats.topTags.map(([tag, count]) => (
                <div key={tag} className="stats-tag-row">
                  <span className="stats-tag-name">{tag}</span>
                  <div className="stats-tag-track">
                    <div className="stats-tag-fill" style={{ width: `${(count / stats.maxTag) * 100}%` }} />
                  </div>
                  <span className="stats-tag-count">{count}</span>
                </div>
              ))}
            </div>
          ) : (
            <span className="stats-empty">暂无标签数据</span>
          )}
        </div>
      </div>
    </div>
  );
}
