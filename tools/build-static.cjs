#!/usr/bin/env node
/**
 * 静态构建兜底脚本（Node.js 23+）
 * ---------------------------------------------------------------
 * Hexo 3.9 的 generate 命令依赖旧版 stream 行为：CacheStream 在 finish 后
 * 会被现代 Node 自动 destroy，导致写出的文件为 0 字节。
 * 本脚本直接读取 Hexo 的 route 流并写入 public/，行为与 hexo generate 一致。
 *
 * 用法：
 *   node -r ./tools/compat-util-isdate.cjs tools/build-static.cjs
 * 或：
 *   npm run build:static
 *
 * 推荐生产环境仍使用 Node.js 18 LTS + `hexo generate`。
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const Hexo = require('hexo');

async function readStream(stream) {
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

async function main() {
  const hexo = new Hexo(process.cwd(), { silent: false });
  await hexo.init();
  await hexo.load();

  const publicDir = hexo.public_dir;
  fs.mkdirSync(publicDir, { recursive: true });

  const routes = hexo.route.list();
  let written = 0;

  for (const route of routes) {
    const dest = path.join(publicDir, route);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    const data = await readStream(hexo.route.get(route));
    fs.writeFileSync(dest, data);
    written += 1;
    console.log('Generated: %s (%d bytes)', route, data.length);
  }

  console.log('%d files generated in %s', written, publicDir);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
