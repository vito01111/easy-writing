# 易创 · 懒猫微服运行镜像：前端构建产物 + Node 同源服务 + 渲染抓取 worker
#
# Box 侧远程构建拉 docker.io / deb.debian.org / pypi 官方源都会直连超时
# （已验证的坑），基础镜像与 apt/pip 全部走国内镜像源；网络恢复后可改回官方源。
FROM docker.m.daocloud.io/library/node:22-bookworm-slim

RUN set -eux; \
    if [ -f /etc/apt/sources.list.d/debian.sources ]; then \
      sed -i -e 's|deb.debian.org|mirrors.aliyun.com|g' -e 's|security.debian.org|mirrors.aliyun.com|g' /etc/apt/sources.list.d/debian.sources; \
    fi; \
    if [ -f /etc/apt/sources.list ]; then \
      sed -i -e 's|deb.debian.org|mirrors.aliyun.com|g' -e 's|security.debian.org|mirrors.aliyun.com|g' /etc/apt/sources.list; \
    fi

# 起点全站 probe.js 反爬必须真实浏览器渲染才能过（纯 HTTP 拿到 202 探针页），
# 随包内置 chromium 由 DrissionPage 驱动（与桌面版隐藏窗口同语义）。
# 中文字体保证渲染环境与真实访问一致。
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      python3 python3-pip chromium fonts-wqy-zenhei ca-certificates \
 && rm -rf /var/lib/apt/lists/*

RUN pip3 install --no-cache-dir --break-system-packages \
      -i https://mirrors.aliyun.com/pypi/simple/ DrissionPage

WORKDIR /app

# build-pack 的构建上下文只收 flat 白名单文件，目录由 build.mjs 打成 tar 带入
COPY .build-context/dist.tar /tmp/dist.tar
COPY .build-context/server.tar /tmp/server.tar
RUN mkdir -p dist \
 && tar -xf /tmp/dist.tar -C dist \
 && tar -xf /tmp/server.tar -C . \
 && rm -f /tmp/dist.tar /tmp/server.tar

ENV NODE_ENV=production \
    PORT=3000 \
    STATIC_DIR=/app/dist \
    RENDER_PYTHON=python3 \
    RENDER_WORKER=/app/render_worker.py \
    CHROME_PATH=/usr/bin/chromium

EXPOSE 3000
CMD ["node", "server.mjs"]
