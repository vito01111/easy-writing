# -*- coding: utf-8 -*-
"""起点/番茄渲染抓取 worker（随 LPK 容器内 python3 + chromium 运行）。

协议：stdin 收 JSON 请求 {url, waitSelector, scrollRounds?, timeoutMs?}，
stdout 回 JSON {html}；任何失败写 stderr 并 exit 1。
一次调用 = 一次浏览器生命周期（启动→渲染→退出），与桌面版隐藏窗口同语义，
不常驻内存。抓的是公开榜单页，配合前端频控（每源每日一次）。
"""
import io
import json
import os
import sys
import time

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8")

MAX_SCROLL_ROUNDS = 30
SCROLL_PAUSE_MS = 700


def fail(message: str) -> None:
    print(json.dumps({"error": message}, ensure_ascii=False), file=sys.stderr)
    sys.exit(1)


def main() -> None:
    try:
        req = json.loads(sys.stdin.read() or "{}")
    except Exception as exc:  # noqa: BLE001
        fail(f"invalid request: {exc}")
        return
    url = str(req.get("url") or "")
    wait_selector = str(req.get("waitSelector") or "")
    scroll_rounds = max(0, min(int(req.get("scrollRounds") or 0), MAX_SCROLL_ROUNDS))
    timeout_ms = max(5_000, min(int(req.get("timeoutMs") or 45_000), 90_000))
    if not url.startswith(("http://", "https://")):
        fail("only http/https targets are allowed")
        return
    if not wait_selector or len(wait_selector) > 200:
        fail("waitSelector required")
        return

    try:
        from DrissionPage import ChromiumPage, ChromiumOptions
    except Exception as exc:  # noqa: BLE001
        fail(f"render engine missing: {exc}")
        return

    co = ChromiumOptions()
    co.headless(True)
    # 容器内 root 运行与 /dev/shm 偏小都是常规约束；zh-CN 保证页面语言与桌面版一致
    co.set_argument("--no-sandbox")
    co.set_argument("--disable-dev-shm-usage")
    co.set_argument("--disable-gpu")
    co.set_argument("--window-size=1280,900")
    co.set_argument("--lang=zh-CN")
    co.set_timeouts(page_load=timeout_ms / 1000)
    browser_path = os.environ.get("CHROME_PATH", "")
    if browser_path:
        co.set_browser_path(browser_path)

    try:
        page = ChromiumPage(co)
    except Exception as exc:  # noqa: BLE001
        fail(f"browser launch failed: {exc}")
        return

    try:
        page.get(url, timeout=timeout_ms / 1000, retry=1, interval=1.5)
        # 等待业务选择器出现即认为内容渲染完成（与桌面版同判定）；
        # DrissionPage 的 wait 超时不抛异常只返回 False，必须检查返回值
        appeared = page.wait.ele_displayed(f"css:{wait_selector}", timeout=timeout_ms / 1000)
        if not appeared:
            fail(f"wait selector not appeared: {wait_selector}")
            return
        for _ in range(scroll_rounds):
            page.scroll.to_bottom()
            time.sleep(SCROLL_PAUSE_MS / 1000)
        html = page.html or ""
        if not html.strip():
            fail("rendered page is empty")
            return
        print(json.dumps({"html": html}, ensure_ascii=False))
    except Exception as exc:  # noqa: BLE001
        fail(f"render failed: {exc}")
    finally:
        try:
            page.quit()
        except Exception:  # noqa: BLE001
            pass


if __name__ == "__main__":
    main()
