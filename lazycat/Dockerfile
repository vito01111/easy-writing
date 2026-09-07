# 易创 · 懒猫微服运行镜像：前端构建产物 + 零依赖 Node 同源服务
#
# Box 侧远程构建拉 docker.io / deb.debian.org 官方源会直连超时（已验证的坑），
# 基础镜像走国内镜像源全路径；网络恢复后可改回官方源。
FROM docker.m.daocloud.io/library/node:22-alpine

WORKDIR /app

# build-pack 的构建上下文只收 flat 白名单文件，目录由 build.mjs 打成 tar 带入
COPY .build-context/dist.tar /tmp/dist.tar
COPY .build-context/server.tar /tmp/server.tar
RUN mkdir -p dist  && tar -xf /tmp/dist.tar -C dist  && tar -xf /tmp/server.tar -C .  && rm -f /tmp/dist.tar /tmp/server.tar

ENV NODE_ENV=production     PORT=3000     STATIC_DIR=/app/dist

EXPOSE 3000
CMD ["node", "server.mjs"]
