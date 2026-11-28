/**
 * 兼容性垫片：Node.js 23+ 移除了 util.isDate。
 * Hexo 3.9 依赖的 hexo-front-matter 在模块加载时缓存了 util.isDate，
 * 因此必须在启动 Hexo 之前通过 `node -r` 预加载本文件。
 *
 * 用法：
 *   node -r ./tools/compat-util-isdate.cjs ./node_modules/hexo/bin/hexo generate
 * 或：
 *   npm run generate
 */
'use strict';

const util = require('node:util');

if (typeof util.isDate !== 'function') {
  util.isDate = function isDate(value) {
    return value instanceof Date;
  };
}
