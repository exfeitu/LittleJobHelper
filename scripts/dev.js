const { spawn } = require('child_process');

const PORT = 10352;
const BASE_PATH = '/LittleJobHelper';
const URL = `http://localhost:${PORT}${BASE_PATH}`;

console.log(`▶ 启动 Next.js 开发服务器...\n`);

const child = spawn('npx', ['next', 'dev', '-p', String(PORT)], {
  stdio: ['inherit', 'pipe', 'inherit'],
});

child.stdout.on('data', (data) => {
  const text = data.toString();
  process.stdout.write(text);

  // Next.js 打印 Ready 后追加正确地址
  if (text.includes('Ready in')) {
    console.log(`  ▲ 打开:     ${URL}\n`);
  }
});

child.on('exit', (code) => {
  process.exit(code);
});
