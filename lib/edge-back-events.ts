/**
 * 全局侧边滑动返回（从屏幕左缘右滑）。
 *
 * 手势在 DesktopShell 的壳节点上以 capture 阶段原生监听采集：capture 早于目标
 * 与冒泡阶段执行，APP 内部再怎么 stopPropagation 也拦不掉，这是它能"全局"生效
 * 的前提（曾经挂在 phone-workspace 的 React onPointerDown 上靠冒泡收手势，
 * 被各 APP 自己的滚动容器和 stopPropagation 吃掉，整个功能形同不存在）。
 *
 * 两套协议：
 *
 * 1) 探询（PROBE）——手势起手时问："现在返回的话，该怎么演？"
 *    结果分三种（见 EdgeBackProbeDetail）：推走某一层、只淡出、推整页退出 APP。
 *    最理想的是第一种：谁在最上层谁把自己那一层的 DOM 节点报上来，壳只对这个
 *    节点做位移，它底下本来就挂载着的上一层便自然露出（聊天室滑走 → 露出会话列表）。
 *    ——不做探询、一律滑整个工作区的话，"上一层"也在工作区内部、会被一起推走，
 *    露出来的就只有壁纸，观感完全不是侧滑返回（曾经就是这个 bug）。
 *
 * 2) 提交（BACK）——松手且滑过裁决线后问："谁能退一层？"
 *    谁能退谁把 detail.handled 置为 true；一圈下来没人认领，壳就关掉当前 APP
 *    回桌面。这样 APP 内部的层级回退由 APP 自己决定，壳不需要知道任何 APP
 *    的内部结构。
 */

export const EDGE_BACK_EVENT = "phone-edge-back";
export const EDGE_BACK_PROBE_EVENT = "phone-edge-back-probe";

export type EdgeBackDetail = {
    /** 监听方消费掉这次返回后置 true，壳便不再关闭 APP */
    handled: boolean;
};

export type EdgeBackProbeDetail = {
    /** 订阅方把"自己这一层"的 DOM 节点放进来 */
    layer: HTMLElement | null;
    /**
     * 订阅方是否会自行处理这次返回。
     * 与 layer 组合出三种情形，壳据此选不同的动效：
     * - layer 有值：推走这一层，露出它底下已挂载的上一层（最理想）
     * - layer 为 null 且 claimed=true：APP 内部靠切 state 换页、没有可推走的层
     *   （如联系人→加好友页、切 tab），此时推整页会露出壁纸、观感割裂，
     *   壳改用轻微淡出
     * - layer 为 null 且 claimed=false：无人认领，语义是"退出 APP 回桌面"，
     *   推整个工作区、露出壁纸才是对的
     */
    claimed: boolean;
};

export type EdgeBackProbeResult = {
    layer: HTMLElement | null;
    claimed: boolean;
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

/**
 * 探询"这次返回该滑走哪个元素、以及有没有人认领"。
 * @returns layer = 要推走的层（null 表示没有可推走的层）；claimed = 是否有 APP 认领
 */
export function probeEdgeBackLayer(): EdgeBackProbeResult {
    const detail: EdgeBackProbeDetail = { layer: null, claimed: false };
    window.dispatchEvent(new CustomEvent<EdgeBackProbeDetail>(EDGE_BACK_PROBE_EVENT, { detail }));
    return { layer: detail.layer, claimed: detail.claimed };
}

/**
 * 订阅探询。provider 返回：
 * - HTMLElement：推走这一层（它底下已挂载的上一层会露出来）
 * - "claimed"：我会处理这次返回，但没有可推走的层（同容器切 state 换页），
 *   壳会改用淡出动效，避免露出壁纸
 * - null：这次不该我管
 * 判断顺序须与 subscribeEdgeBack 保持一致：能退一层的那一层，就是要滑走的那一层。
 */
export function subscribeEdgeBackProbe(
    provider: () => HTMLElement | "claimed" | null,
): () => void {
    const listener = (event: Event) => {
        const detail = (event as CustomEvent<EdgeBackProbeDetail>).detail;
        if (!detail || detail.layer || detail.claimed) return;
        const result = provider();
        if (result === "claimed") {
            detail.claimed = true;
        } else if (result) {
            detail.layer = result;
            detail.claimed = true;
        }
    };
    window.addEventListener(EDGE_BACK_PROBE_EVENT, listener);
    return () => window.removeEventListener(EDGE_BACK_PROBE_EVENT, listener);
}
