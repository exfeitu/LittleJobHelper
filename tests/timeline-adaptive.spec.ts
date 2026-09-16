import { expect, test, type Page } from "@playwright/test";
import type { EventItem, TodoItem } from "../types";

const date = "2026-09-14";
const stamp = (time: string) => `${date}T${time}:00`;
const task = (id: string, time: string, priority: TodoItem["priority"] = "medium"): TodoItem => ({
  id, title: `任务${id} · 完整标题验证`, startTime: stamp(time), priority, status: "pending", parentId: null,
  tags: ["测试"], department: "技术部", contactPerson: "小林", remarks: "核对时间位置", updatedAt: stamp("08:00"),
});
const todos: TodoItem[] = [task("A", "08:00", "high"), { ...task("B", "08:10"), status: "in_progress" },
  task("C", "12:00"), task("D", "12:10", "low"), { ...task("E", "12:20", "low"), status: "completed" },
  ...["F", "G", "H", "I"].map(id => task(id, "16:00", "high")),
  task("晚", "23:59"), { ...task("未定", "00:00"), startTime: undefined }];
const events: EventItem[] = ["a", "b", "c", "d"].map((id, index) => ({
  id, title: `工作记录${id}`, startTime: stamp("09:00"), endTime: stamp(index === 0 ? "11:00" : "10:00"),
  detail: "详情不会常驻时间块", tags: ["测试"], linkedTodoIds: index === 0 ? ["A"] : [], updatedAt: stamp("08:00"),
}));

async function loadFixture(page: Page) {
  await page.goto("/LittleJobHelper");
  await page.getByRole("button", { name: "📊 导出", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "导出数据", exact: true });
  // 使用产品导入入口，在 Playwright 隔离浏览器中装载，不直接操作存储。
  await dialog.locator('input[type="file"]').setInputFiles({ name: "timeline.json", mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify({ version: 3, events, todos, memos: [], customTags: [] })) });
  await expect(dialog.getByText(/导入成功/)).toBeVisible();
  await dialog.getByRole("button", { name: "关闭", exact: true }).click();
  await page.getByLabel("跳转日期", { exact: true }).fill(date);
}

test.use({ viewport: { width: 1600, height: 1000 } });

test("详细视图：真实时间、2/3 错层、4 项聚合、记录溢出和详情编辑", async ({ page }, info) => {
  await loadFixture(page);
  const root = page.locator(".at-root");
  await expect(root).toHaveAttribute("data-view", "day");
  await expect(root.locator(".at-todo")).toHaveCount(6);
  const a = root.getByRole("button", { name: /任务A.*08:00/ });
  const b = root.getByRole("button", { name: /任务B.*08:10/ });
  expect((await b.boundingBox())!.y - (await a.boundingBox())!.y).toBe(48);
  const tops = await root.locator(".at-todo-label").evaluateAll(nodes => nodes.map(node => {
    const r = node.getBoundingClientRect(); return { x: r.x, y: r.y, right: r.right, bottom: r.bottom };
  }));
  for (let i = 0; i < tops.length; i++) for (let j = i + 1; j < tops.length; j++) {
    const a = tops[i], b = tops[j];
    expect(a.right <= b.x || b.right <= a.x || a.bottom <= b.y || b.bottom <= a.y).toBe(true);
  }
  await expect(root.locator(".at-event")).toHaveCount(3);
  expect(await root.locator(".at-event").evaluateAll(nodes => nodes.map(n => n.getAttribute("data-lane")))).toEqual(["0", "1", "2"]);
  const canvasWidth = await root.locator(".at-day").evaluate(node => node.getBoundingClientRect().width);
  expect((await root.locator('[data-event-id="a"]').boundingBox())!.width).toBeCloseTo(canvasWidth * 2 / 24, 0);
  await a.click();
  const details = page.getByRole("complementary", { name: "时间轴详情" });
  await expect(details.getByText("技术部")).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await details.getByRole("button", { name: "工作记录a", exact: true }).click();
  await expect(details.getByText("详情不会常驻时间块")).toBeVisible();
  await details.getByRole("button", { name: "编辑", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await root.getByRole("button", { name: "+1记录", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "+1记录" }).getByText("工作记录d")).toBeVisible();
  await page.keyboard.press("Escape");
  await root.getByRole("button", { name: "4项待办", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "4项待办" }).locator("div > button")).toHaveCount(4);
  await page.keyboard.press("Escape");
  await a.click();
  await root.screenshot({ path: info.outputPath("timeline-day.png") });
});

test("3/7/30 天降低密度、月视图回到当天、日期导航和滚轮阈值", async ({ page }, info) => {
  await loadFixture(page);
  const root = page.locator(".at-root");
  await root.getByRole("button", { name: "3天", exact: true }).click();
  await expect(root.locator(".at-day")).toHaveCount(3);
  await expect(root.locator(".at-todo-label")).toHaveCount(0);
  await root.screenshot({ path: info.outputPath("timeline-three.png") });
  await root.getByRole("button", { name: "7天", exact: true }).click();
  const first = root.locator(".at-week-day").first();
  await expect(first.getByText("高 5", { exact: true })).toBeVisible();
  await expect(first.getByText("中 3", { exact: true })).toBeVisible();
  await expect(first.getByText("低 2", { exact: true })).toBeVisible();
  await expect(first.getByText("4 条", { exact: true })).toBeVisible();
  await expect(first.getByText("5.0h", { exact: true })).toBeVisible();
  await root.screenshot({ path: info.outputPath("timeline-week.png") });
  await root.getByRole("button", { name: "30天", exact: true }).click();
  await expect(root.locator(".at-month-day")).toHaveCount(30);
  await root.locator(".at-month-day").first().hover();
  await expect(root.getByRole("status")).toContainText("高 5 / 中 3 / 低 2");
  await expect(root.locator(".at-heat-todo.level-5")).toHaveCount(1);
  await root.screenshot({ path: info.outputPath("timeline-month.png") });
  await root.locator(".at-month-day").nth(2).click();
  await expect(root).toHaveAttribute("data-view", "day");
  await expect(root.getByLabel("跳转日期")).toHaveValue("2026-09-16");
  await root.getByRole("button", { name: "后一时间段" }).click();
  await expect(root.getByLabel("跳转日期")).toHaveValue("2026-09-17");
  await root.getByRole("button", { name: "前一时间段" }).click();
  await expect(root.getByLabel("跳转日期")).toHaveValue("2026-09-16");
  for (const mode of ["three", "week", "month"]) {
    await root.locator(".at-scroll").dispatchEvent("wheel", { deltaY: 400 });
    await expect(root).toHaveAttribute("data-view", mode);
  }
  await root.locator(".at-scroll").dispatchEvent("wheel", { deltaY: -2000 });
  await expect(root).toHaveAttribute("data-view", "day");
  const scroll = root.locator(".at-scroll");
  const before = await scroll.evaluate(n => n.scrollLeft);
  const bounds = (await scroll.boundingBox())!;
  await page.mouse.move(bounds.x + 250, bounds.y + 220);
  await page.mouse.down(); await page.mouse.move(bounds.x + 150, bounds.y + 220); await page.mouse.up();
  expect(await scroll.evaluate(n => n.scrollLeft)).toBeGreaterThan(before);
});

test("窄屏不溢出页面，聚合列表可键盘关闭", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await loadFixture(page);
  const root = page.locator(".at-root");
  await root.getByRole("button", { name: "4项待办", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "4项待办" });
  await expect(dialog).toBeVisible();
  const box = (await dialog.boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(0); expect(box.x + box.width).toBeLessThanOrEqual(390);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});
