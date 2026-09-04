/**
 * 全局侧边滑动返回（从屏幕左缘右滑）。
 *
 * 手势在 DesktopShell 的壳节点上以 capture 阶段原生监听采集：capture 早于目标
 * 与冒泡阶段执行，APP 内部再怎么 stopPropagation 也拦不掉，这是它能"全局"生效
 * 的前提（曾经挂在 phone-workspace 的 React onPointerDown 上靠冒泡收手势，
 * 被各 APP 自己的滚动容器和 stopPropagation 吃掉，整个功能形同不存在）。
 *
 * 分发协议：壳先派发 EDGE_BACK_EVENT，谁能"退一层"谁把 detail.handled 置为 true；
 * 一圈下来没人认领，壳就关掉当前 APP 回桌面。这样 APP 内部的层级回退由 APP 自己
 * 决定，壳不需要知道任何 APP 的内部结构。
 */

export const EDGE_BACK_EVENT = "phone-edge-back";

export type EdgeBackDetail = {
    /** 监听方消费掉这次返回后置 true，壳便不再关闭 APP */
    handled: boolean;
};

/**
 * 派发一次侧边返回请求。
 * @returns true = 已被某个 APP 消费（退了一层）；false = 无人认领，调用方应关闭当前 APP
 */
export function dispatchEdgeBack(): boolean {
    const detail: EdgeBackDetail = { handled: false };
    window.dispatchEvent(new CustomEvent<EdgeBackDetail>(EDGE_BACK_EVENT, { detail }));
    return detail.handled;
}

/**
 * 订阅侧边返回请求。handler 返回 true 表示"我退了一层，别再往上传"。
 * 用法：useEffect(() => subscribeEdgeBack(() => {...; return true;}), [deps])
 */
export function subscribeEdgeBack(handler: () => boolean): () => void {
    const listener = (event: Event) => {
        const detail = (event as CustomEvent<EdgeBackDetail>).detail;
        if (!detail || detail.handled) return;
        if (handler()) detail.handled = true;
    };
    window.addEventListener(EDGE_BACK_EVENT, listener);
    return () => window.removeEventListener(EDGE_BACK_EVENT, listener);
}
