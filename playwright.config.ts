import { defineConfig } from "@playwright/test";

/**
 * E2E 冒烟测试配置。
 * 首次运行前需安装浏览器：npx playwright install chromium
 */
export default defineConfig({
  testDir: "./tests",
  timeout: 30_000,
  fullyParallel: false,
  retries: 1,
  use: {
    baseURL: "http://localhost:3536/LittleJobHelper",
    headless: true,
    locale: "zh-CN",
  },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3536/LittleJobHelper",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
