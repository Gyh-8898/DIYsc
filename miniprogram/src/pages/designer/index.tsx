import { View, Text, ScrollView, Image, Input } from "@tarojs/components";
import Taro, { useDidShow, useLoad } from "@tarojs/taro";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { X, Plus, Minus, Trash2, Watch, Search, Settings } from "../../components/Icons";
import {
    BeadType,
    InventoryItem,
    SystemConfig,
    DEFAULT_CONFIG,
    TAG_OPTIONS,
    INITIAL_WRIST_SIZE
} from "../../constants";
import { api } from "../../services/api";
import { saveCheckoutPayload } from "../../services/checkout";
import "./index.scss";

function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }

export default function DesignerPage() {
    /* ═══ state ═══ */
    const [wristSize, setWristSize] = useState(INITIAL_WRIST_SIZE);
    const [showWristAdjuster, setShowWristAdjuster] = useState(false);
    const [systemConfig, setSystemConfig] = useState<SystemConfig>(DEFAULT_CONFIG);

    const [selectedMainCatId, setSelectedMainCatId] = useState("");
    const [selectedSubCatId, setSelectedSubCatId] = useState("");
    const [communityTag, setCommunityTag] = useState("");
    const [communityTagBeadIds, setCommunityTagBeadIds] = useState<string[] | null>(null);

    const [selectedBeads, setSelectedBeads] = useState<BeadType[]>([]);
    const [activeBeadIndex, setActiveBeadIndex] = useState<number | null>(null);

    const [showSaveModal, setShowSaveModal] = useState(false);
    const [selectedTags, setSelectedTags] = useState<string[]>([]);
    const [editingDesignId, setEditingDesignId] = useState<string | null>(null);
    const [designImageUrl, setDesignImageUrl] = useState("");

    /* ═══ search state ═══ */
    const [showSearch, setShowSearch] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [viewingMaterial, setViewingMaterial] = useState<InventoryItem | null>(null);

    /* ═══ drag state ═══ */
    const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
    const [isOverTrash, setIsOverTrash] = useState(false);
    const [swapTargetIndex, setSwapTargetIndex] = useState<number | null>(null);
    // Use refs for drag position to avoid re-renders every frame
    const dragOffset = useRef({ x: 0, y: 0 });
    const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const materialLongPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const dragStartPos = useRef<{ x: number; y: number } | null>(null);
    const isDragActive = useRef(false);
    // Force re-render counter for drag visual (minimal re-renders)
    const [, setDragTick] = useState(0);

    /* ═══ config helpers ═══ */
    const beadGapMm = systemConfig.designerUI?.beadGapMm ?? 1;
    const watermarkUrl = systemConfig.designerUI?.watermarkUrl || '';

    /* ═══ layout ═══ */
    const stageLayout = useMemo(() => {
        let windowWidth = 390;
        try {
            const info = Taro.getSystemInfoSync();
            windowWidth = Number(info?.windowWidth || 390);
        } catch (_error) {
            windowWidth = 390;
        }
        const leftRail = 76;
        const rightRail = 126;
        const available = clamp(windowWidth - leftRail - rightRail, 200, 290);
        const stageSize = clamp(available + 38, 248, 332);
        const stageCenter = stageSize / 2;
        const guideRadius = clamp(stageSize * 0.398, 94, 124);
        const offsetX = windowWidth <= 390 ? -6 : 0;
        const offsetY = windowWidth <= 390 ? -6 : -8;
        const beadScale = stageSize / 320;
        return { stageSize, stageCenter, guideRadius, offsetX, offsetY, beadScale };
    }, []);


    const communityTagIdSet = useMemo(() => new Set(communityTagBeadIds || []), [communityTagBeadIds]);    const mainCategories = useMemo(
        () => (Array.isArray(systemConfig?.inventoryTree?.mainCategories) ? systemConfig.inventoryTree.mainCategories : []),
        [systemConfig]
    );

    /* ═══ lifecycle ═══ */
    useLoad((options) => {
        if (options.designId) setEditingDesignId(String(options.designId));
        if (options.communityTag) {
            try {
                setCommunityTag(decodeURIComponent(String(options.communityTag)));
            } catch {
                setCommunityTag(String(options.communityTag));
            }
        } else {
            setCommunityTag("");
        }
    });

    useDidShow(() => {
        const tempDesign = Taro.getStorageSync("temp_design_copy") as any;
        if (tempDesign) {
            const safeWristSize =
                typeof tempDesign.wristSize === "number" && Number.isFinite(tempDesign.wristSize)
                    ? tempDesign.wristSize
                    : INITIAL_WRIST_SIZE;
            const sourceBeads = Array.isArray(tempDesign.beads)
                ? tempDesign.beads
                : Array.isArray(tempDesign.beadsData) ? tempDesign.beadsData : [];

            setWristSize(safeWristSize);
            setSelectedBeads(sourceBeads.length > 0
                ? sourceBeads.map((b: any, idx: number) => ({
                    id: `${b?.id || `bead-${idx}`}-${Date.now()}-${Math.random()}`,
                    name: b?.name || "珠子",
                    price: Number(b?.price) || 0,
                    sizeMm: Number(b?.sizeMm) || 8,
                    color: b?.color || "radial-gradient(circle at 30% 30%, rgba(180,180,190,0.9), rgba(30,30,40,1))",
                    inStock: b?.inStock !== false
                }))
                : []);
            setEditingDesignId(null);
            setDesignImageUrl(tempDesign.imageUrl || "");
            Taro.removeStorageSync("temp_design_copy");
        }

        if (mainCategories.length > 0 && !selectedMainCatId) {
            const first = mainCategories[0];
            setSelectedMainCatId(first.id);
            if (first.subCategories.length > 0) setSelectedSubCatId(first.subCategories[0].id);
        }
    });

    useEffect(() => {
        const loadConfig = async () => {
            try {
                const remote = await api.config.get();
                if (remote) {
                    setSystemConfig(remote);
                }
            } catch (_error) {
                setSystemConfig(DEFAULT_CONFIG);
            }
        };
        loadConfig();
    }, []);
    useEffect(() => {
        const tag = communityTag.trim();
        if (!tag) return;

        // Prefer admin-configured tag mapping (recommend API) when available.
        if (communityTagBeadIds && communityTagBeadIds.length > 0) {
            const hasId = (item: any) => communityTagIdSet.has(String(item?.id || ""));

            const current = mainCategories.find((c) => c.id === selectedMainCatId);
            const currentHas = current?.subCategories?.some((sub) => (sub.items || []).some(hasId));
            if (current && currentHas) return;

            for (const main of mainCategories) {
                const hit = main?.subCategories?.some((sub) => (sub.items || []).some(hasId));
                if (hit) {
                    setSelectedMainCatId(main.id);
                    return;
                }
            }
            return;
        }

        const t = tag.toLowerCase();
        const matches = (item: any) => {
            const element = String(item?.element || "").toLowerCase();
            const material = String(item?.material || "").toLowerCase();
            const name = String(item?.name || "").toLowerCase();
            const meaning = String(item?.meaning || "").toLowerCase();
            const description = String(item?.description || "").toLowerCase();
            return element.includes(t) || material.includes(t) || name.includes(t) || meaning.includes(t) || description.includes(t);
        };

        const current = mainCategories.find((c) => c.id === selectedMainCatId);
        const currentHas = current?.subCategories?.some((sub) => (sub.items || []).some(matches));
        if (current && currentHas) return;

        for (const main of mainCategories) {
            const hit = main?.subCategories?.some((sub) => (sub.items || []).some(matches));
            if (hit) {
                setSelectedMainCatId(main.id);
                return;
            }
        }
    }, [communityTag, communityTagBeadIds, communityTagIdSet, mainCategories, selectedMainCatId]);

    /* ═══ derived values ═══ */
    const totalGapMm = selectedBeads.length > 1 ? (selectedBeads.length - 1) * beadGapMm : 0;
    const currentLengthMm = selectedBeads.reduce((acc, b) => acc + b.sizeMm, 0) + totalGapMm;
    const totalPrice = selectedBeads.reduce((acc, b) => acc + b.price, 0);
    const estimatedWeight = selectedBeads.length * 0.37;
    const toleranceMm = systemConfig.wristValidation.toleranceMm;
    const targetLengthMm = wristSize * 10;
    const isLengthOutOfRange = currentLengthMm < targetLengthMm - toleranceMm || currentLengthMm > targetLengthMm + toleranceMm;
    const suitableWristCm = currentLengthMm / 10;
    const maxCircumferenceCm = wristSize + 1.6;

    /* ═══ bead position calculation ═══
     * KEY: always distribute around the FULL circle (2π).
     * Each bead's angular span = (sizeMm + gap) / totalWeightMm * 2π.
     * This ensures even 3 large beads spread evenly, not cluster on one side.
     */
    const beadPositions = useMemo(() => {
        const count = selectedBeads.length;
        if (count === 0) return [];

        const { stageCenter, guideRadius, beadScale } = stageLayout;

        // Total weight = sum of all sizes + all gaps (treat as "virtual bead spacing")
        const totalWeightMm = selectedBeads.reduce((s, b) => s + b.sizeMm, 0)
            + count * beadGapMm; // gap after each bead (wraps around)

        // Visual bead size: scale to fit nicely on the circle
        // Max bead pixel size = arc length available for that bead
        const positions: { x: number; y: number; sizePx: number; angle: number }[] = [];
        let runningAngle = -Math.PI / 2; // start at top

        for (let i = 0; i < count; i++) {
            const bead = selectedBeads[i];
            // This bead's share of the full circle (including its gap)
            const beadWeight = bead.sizeMm + beadGapMm;
            const angularSpan = (beadWeight / totalWeightMm) * 2 * Math.PI;

            // Bead visual size: proportional to its angular span, but only the bead part (not gap)
            const beadAngularPortion = (bead.sizeMm / totalWeightMm) * 2 * Math.PI;
            const arcLengthPx = beadAngularPortion * guideRadius;
            // Clamp visual size to reasonable bounds
            const sizePx = clamp(arcLengthPx * 0.85, 16 * beadScale, 50 * beadScale);

            // Center of this bead = halfway through its angular span (excluding half gap at end)
            const beadCenterAngle = runningAngle + (bead.sizeMm / beadWeight) * angularSpan * 0.5;

            const x = stageCenter + guideRadius * Math.cos(beadCenterAngle);
            const y = stageCenter + guideRadius * Math.sin(beadCenterAngle);

            positions.push({ x, y, sizePx, angle: beadCenterAngle });

            // Advance by the full span (bead + gap)
            runningAngle += angularSpan;
        }

        return positions;
    }, [selectedBeads, stageLayout, beadGapMm]);

    /* ═══ handlers ═══ */
    const handleAddBead = (item: InventoryItem) => {
        const { toleranceMm: tol, overflowMessage } = systemConfig.wristValidation;
        const target = wristSize * 10;
        const nextGap = selectedBeads.length > 0 ? beadGapMm : 0;
        if (currentLengthMm + item.sizeMm + nextGap > target + tol) {
            Taro.showToast({ title: overflowMessage, icon: "none" });
            return;
        }
        const newBead: BeadType = {
            id: `${item.id}-${Date.now()}`,
            name: item.name, price: item.price,
            sizeMm: item.sizeMm, color: item.color, inStock: item.inStock
        };
        setSelectedBeads((prev) => [...prev, newBead]);
    };

    /* ── Long-press drag (smooth, ref-based) ── */
    const handleTouchStart = useCallback((e: any, index: number) => {
        e.stopPropagation();
        setActiveBeadIndex(index);

        const touch = e.touches[0];
        dragStartPos.current = { x: touch.clientX, y: touch.clientY };
        dragOffset.current = { x: 0, y: 0 };
        isDragActive.current = false;

        // Long press 280ms to enter drag mode
        longPressTimer.current = setTimeout(() => {
            isDragActive.current = true;
            setDraggingIndex(index);
            setDragTick(t => t + 1);
        }, 280);
    }, []);

    const handleTouchMove = useCallback((e: any) => {
        const touch = e.touches[0];

        // Cancel long press if moved too far before timer
        if (!isDragActive.current && dragStartPos.current) {
            const dx = touch.clientX - dragStartPos.current.x;
            const dy = touch.clientY - dragStartPos.current.y;
            if (Math.abs(dx) > 6 || Math.abs(dy) > 6) {
                if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }
            }
            return;
        }

        if (!isDragActive.current || draggingIndex === null) return;

        // Update offset in ref (no re-render)
        if (dragStartPos.current) {
            dragOffset.current = {
                x: touch.clientX - dragStartPos.current.x,
                y: touch.clientY - dragStartPos.current.y
            };
            // Trigger minimal re-render for visual update
            setDragTick(t => t + 1);
        }

        // Check if finger is in the bottom panel area (delete zone)
        const { windowHeight } = Taro.getSystemInfoSync();
        const panelTop = windowHeight * 0.5; // panel starts at 50vh
        const overTrash = touch.clientY > panelTop;
        setIsOverTrash(overTrash);

        // If over trash, clear swap target
        if (overTrash) {
            setSwapTargetIndex(null);
            return;
        }

        // Swap target detection (highlight only, swap on release)
        if (beadPositions.length > 1 && dragStartPos.current) {
            const { stageCenter } = stageLayout;
            const basePos = beadPositions[draggingIndex];
            if (!basePos) return;
            const fingerX = basePos.x + dragOffset.current.x;
            const fingerY = basePos.y + dragOffset.current.y;
            const fingerAngle = Math.atan2(fingerY - stageCenter, fingerX - stageCenter);

            let closestIdx: number | null = null;
            let minAngleDist = Infinity;

            for (let i = 0; i < beadPositions.length; i++) {
                if (i === draggingIndex) continue;
                let angleDiff = Math.abs(fingerAngle - beadPositions[i].angle);
                if (angleDiff > Math.PI) angleDiff = 2 * Math.PI - angleDiff;
                if (angleDiff < minAngleDist && angleDiff < 0.45) {
                    minAngleDist = angleDiff;
                    closestIdx = i;
                }
            }

            setSwapTargetIndex(closestIdx);
        } else {
            setSwapTargetIndex(null);
        }
    }, [draggingIndex, beadPositions, stageLayout]);

    const handleTouchEnd = useCallback(() => {
        if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }

        if (isDragActive.current && draggingIndex !== null) {
            if (isOverTrash) {
                // Delete: finger was in the panel area
                setSelectedBeads((prev) => prev.filter((_, i) => i !== draggingIndex));
                setActiveBeadIndex(null);
                Taro.showToast({ title: "已删除", icon: "none", duration: 800 });
            } else if (swapTargetIndex !== null && swapTargetIndex !== draggingIndex) {
                // Swap: finger was over another bead
                const target = swapTargetIndex;
                setSelectedBeads((prev) => {
                    const arr = [...prev];
                    const temp = arr[draggingIndex];
                    arr[draggingIndex] = arr[target];
                    arr[target] = temp;
                    return arr;
                });
            }
        }

        isDragActive.current = false;
        dragStartPos.current = null;
        dragOffset.current = { x: 0, y: 0 };
        setDraggingIndex(null);
        setSwapTargetIndex(null);
        setIsOverTrash(false);
    }, [draggingIndex, isOverTrash, swapTargetIndex]);

    const openToolbox = () => {
        if (selectedBeads.length === 0) {
            Taro.showToast({ title: "暂无可操作珠子", icon: "none" });
            return;
        }
        const hasSelected = activeBeadIndex !== null;
        const itemList = hasSelected ? ["删除选中珠子", "清空珠串"] : ["清空珠串"];
        Taro.showActionSheet({
            itemList,
            success: ({ tapIndex }) => {
                if (hasSelected && tapIndex === 0 && activeBeadIndex !== null) {
                    setSelectedBeads((prev) => prev.filter((_, i) => i !== activeBeadIndex));
                    setActiveBeadIndex(null);
                    return;
                }
                setSelectedBeads([]);
                setActiveBeadIndex(null);
            }
        });
    };

    const handleSave = async () => {
        if (selectedBeads.length === 0) return;
        const designData = {
            id: editingDesignId || undefined,
            name: `${selectedTags[0] || "我的"}手串`,
            wristSize, totalPrice,
            beads: selectedBeads.map((b) => ({ id: b.id, name: b.name, sizeMm: b.sizeMm, price: b.price, color: b.color })),
            imageUrl: designImageUrl,
            isPublic: false
        };
        try {
            Taro.showLoading({ title: "保存中..." });
            if (editingDesignId) await api.designs.update(editingDesignId, designData as any);
            else await api.designs.create(designData as any);
            Taro.hideLoading();
            Taro.showToast({ title: "保存成功", icon: "success" });
            setShowSaveModal(false);
        } catch (e: any) {
            Taro.hideLoading();
            Taro.showToast({ title: e.message || "保存失败", icon: "none" });
        }
    };

    const handleComplete = async () => {
        if (selectedBeads.length === 0) return;
        const { toleranceMm: tol, underflowMessage } = systemConfig.wristValidation;
        if (currentLengthMm < wristSize * 10 - tol) {
            Taro.showToast({ title: underflowMessage, icon: "none" });
            return;
        }
        try {
            Taro.showLoading({ title: "跳转结算..." });
            if (!api.auth.isLoggedIn()) await api.auth.login();
            const designData = {
                id: editingDesignId || undefined,
                name: `定制手串-${wristSize}cm`,
                wristSize, totalPrice,
                beads: selectedBeads.map((b) => ({ id: b.id, name: b.name, sizeMm: b.sizeMm, price: b.price, color: b.color })),
                imageUrl: designImageUrl
            };
            saveCheckoutPayload({ source: "designer", designs: [designData], cartItemIds: [] });
            Taro.hideLoading();
            Taro.showToast({ title: "请确认订单", icon: "none" });
            setTimeout(() => Taro.navigateTo({ url: "/pages/order/confirm" }), 1200);
        } catch (e: any) {
            Taro.hideLoading();
            Taro.showToast({ title: e.message || "下单失败", icon: "none" });
        }
    };

    /* ═══ inventory ═══ */
    const activeMain = mainCategories.find((c) => c.id === selectedMainCatId);
    const activeItems = useMemo(() => {
        if (!activeMain) return [];
        const rawItems = selectedSubCatId
            ? activeMain.subCategories.find((s) => s.id === selectedSubCatId)?.items || []
            : activeMain.subCategories.flatMap((s) => s.items);

        const inStock = rawItems.filter((i) => i.inStock);
        const tag = communityTag.trim();
        if (!tag) return inStock;

        // If we have a server-side mapping result, filter by those ids first.
        if (communityTagBeadIds && communityTagBeadIds.length > 0) {
            return inStock.filter((item: any) => communityTagIdSet.has(String(item?.id || "")));
        }

        const t = tag.toLowerCase();
        return inStock.filter((item: any) => {
            const element = String(item?.element || "").toLowerCase();
            const material = String(item?.material || "").toLowerCase();
            const name = String(item?.name || "").toLowerCase();
            const meaning = String(item?.meaning || "").toLowerCase();
            const description = String(item?.description || "").toLowerCase();
            return element.includes(t) || material.includes(t) || name.includes(t) || meaning.includes(t) || description.includes(t);
        });
    }, [activeMain, selectedSubCatId, communityTag, communityTagBeadIds, communityTagIdSet]);

    /* ═══ search: flatten all subcategories ═══ */
    const searchResults = useMemo(() => {
        if (!searchQuery.trim()) return [];
        const q = searchQuery.trim().toLowerCase();
        const results: { mainCatId: string; mainCatName: string; subId: string; subName: string; itemCount: number }[] = [];
        for (const main of mainCategories) {
            for (const sub of main.subCategories) {
                if (sub.name.toLowerCase().includes(q)) {
                    results.push({
                        mainCatId: main.id,
                        mainCatName: main.name,
                        subId: sub.id,
                        subName: sub.name,
                        itemCount: sub.items.filter(i => i.inStock).length
                    });
                }
            }
        }
        return results;
    }, [searchQuery, mainCategories]);

    const isEmpty = selectedBeads.length === 0;

    /* ════════════════════ RENDER ════════════════════ */
    return (
        <View className="designer-root" catchMove>
            {/* ── Stage ── */}
            <View className="wb-stage" onClick={() => setActiveBeadIndex(null)}>
                {/* Left tools */}
                <View className="wb-left-tools">
                    <View className="tool-item" onClick={() => setShowWristAdjuster(true)}>
                        <View className="tool-icon"><Watch size={19} /></View>
                        <Text className="tool-label">手围设置</Text>
                    </View>
                    <View className="tool-item" onClick={openToolbox}>
                        <View className="tool-icon"><Settings size={19} /></View>
                        <Text className="tool-label">工具箱</Text>
                    </View>
                </View>

                {/* Right: actions + stats */}
                <View className="wb-right">
                    <View className="right-actions">
                        <View className={`action-pill finish ${isEmpty ? "disabled" : ""}`} onClick={handleComplete}>完成</View>
                        <View className={`action-pill save ${isEmpty ? "disabled" : ""}`} onClick={() => setShowSaveModal(true)}>保存</View>
                    </View>
                    <View className="right-stats">
                        <View className="stat-row"><Text className="stat-label">适用手围</Text><Text className="stat-val">{suitableWristCm.toFixed(1)}cm</Text></View>
                        <View className="stat-row"><Text className="stat-label">重量</Text><Text className="stat-val">{estimatedWeight.toFixed(2)}g</Text></View>
                        <View className="stat-row"><Text className="stat-label">价格</Text><Text className="stat-val">¥{totalPrice.toFixed(2)}</Text></View>
                        <View className="stat-row"><Text className="stat-label">手围</Text><Text className="stat-val">{wristSize}cm</Text></View>
                        <View className="stat-row"><Text className="stat-label">戴法</Text><Text className="stat-val">单圈</Text></View>
                        <View className="stat-row">
                            <Text className="stat-label">最大周长</Text>
                            <Text className={`stat-val ${isLengthOutOfRange ? "warn" : ""}`}>{maxCircumferenceCm.toFixed(1)}cm</Text>
                        </View>
                    </View>
                </View>

                {/* Bracelet */}
                <View
                    className="wb-bracelet"
                    style={{
                        width: `${stageLayout.stageSize}px`,
                        height: `${stageLayout.stageSize}px`,
                        transform: `translate(${stageLayout.offsetX}px, ${stageLayout.offsetY}px)`
                    }}
                >
                    {/* Watermark */}
                    <View className="wb-watermark">
                        {watermarkUrl ? (
                            <Image className="watermark-image" src={watermarkUrl} mode="aspectFit" />
                        ) : (
                            <>
                                <View className="watermark-mark" />
                                <Text className="watermark-text">Gem Oratopia</Text>
                            </>
                        )}
                    </View>

                    {/* Guide circle */}
                    <View
                        className="wb-guide"
                        style={{
                            width: `${stageLayout.guideRadius * 2}px`,
                            height: `${stageLayout.guideRadius * 2}px`
                        }}
                    />

                    {/* Beads */}
                    {beadPositions.map((pos, index) => {
                        const bead = selectedBeads[index];
                        if (!bead) return null;
                        const isSelected = activeBeadIndex === index;
                        const isDragging = draggingIndex === index;

                        // For dragged bead: use transform (GPU-accelerated, no layout thrash)
                        const tx = isDragging ? dragOffset.current.x : 0;
                        const ty = isDragging ? dragOffset.current.y : 0;

                        return (
                            <View
                                key={bead.id}
                                className={`bead-node ${isSelected ? "selected" : ""} ${isDragging ? "dragging" : ""} ${swapTargetIndex === index ? "swap-target" : ""}`}
                                style={{
                                    width: `${pos.sizePx}px`,
                                    height: `${pos.sizePx}px`,
                                    left: `${pos.x - pos.sizePx / 2}px`,
                                    top: `${pos.y - pos.sizePx / 2}px`,
                                    transform: isDragging ? `translate(${tx}px, ${ty}px) scale(1.18)` : 'none'
                                }}
                                onTouchStart={(e) => handleTouchStart(e, index)}
                                onTouchMove={handleTouchMove}
                                onTouchEnd={handleTouchEnd}
                                onClick={(e) => { e.stopPropagation(); setActiveBeadIndex(index); }}
                            >
                                <View className="bead-shadow" />
                                <View className="bead-core" style={{ background: bead.color }}>
                                    <View className="bead-rim" />
                                    <View className="bead-stripe" />
                                    <View className="bead-highlight" />
                                    <View className="bead-highlight2" />
                                </View>
                            </View>
                        );
                    })}
                    {isEmpty && <View className="empty-hint">从下方选择珠子开始设计</View>}
                </View>

                {/* No trash zone here — panel becomes delete zone */}
            </View>

            {/* ── Bottom Panel ── */}
            <View className={`wb-panel ${draggingIndex !== null ? "drag-active" : ""}`}>
                {/* Delete overlay when dragging */}
                {draggingIndex !== null && (
                    <View className={`panel-delete-overlay ${isOverTrash ? "active" : ""}`}>
                        <Trash2 size={24} color={isOverTrash ? "#fff" : "#ff3b30"} />
                        <Text className="panel-delete-text">{isOverTrash ? "松手删除" : "拖到此处删除"}</Text>
                    </View>
                )}
                <View className="panel-tabs-row">
                    <ScrollView scrollX showScrollbar={false} className="panel-main-scroll">
                        <View className="panel-main-tabs">
                            {mainCategories.map((cat) => (
                                <View
                                    key={cat.id}
                                    className={`main-tab ${selectedMainCatId === cat.id ? "active" : ""}`}
                                    onClick={() => setSelectedMainCatId(cat.id)}
                                >
                                    <Text>{cat.name}</Text>
                                    {selectedMainCatId === cat.id && <View className="main-tab-line" />}
                                </View>
                            ))}
                        </View>
                    </ScrollView>
                    <View className="panel-top-icons">
                        <View className="panel-icon" onClick={() => { setShowSearch(true); setSearchQuery(""); }}><Search size={18} /></View>
                    </View>
                </View>

                {/* Search overlay */}
                {showSearch && (
                    <View className="search-overlay">
                        <View className="search-header">
                            <View className="search-input-wrap">
                                <Search size={16} color="#999" />
                                <Input
                                    className="search-input"
                                    placeholder="搜索分类名称..."
                                    value={searchQuery}
                                    onInput={(e: any) => setSearchQuery(e.detail?.value || "")}
                                    focus
                                />
                                {searchQuery && (
                                    <View className="search-clear" onClick={() => setSearchQuery("")}><X size={14} /></View>
                                )}
                            </View>
                            <Text className="search-cancel" onClick={() => setShowSearch(false)}>取消</Text>
                        </View>
                        <ScrollView scrollY className="search-results">
                            {searchQuery.trim() === "" && (
                                <View className="search-hint">输入分类名称进行搜索</View>
                            )}
                            {searchQuery.trim() !== "" && searchResults.length === 0 && (
                                <View className="search-hint">未找到匹配的分类</View>
                            )}
                            {searchResults.map((r) => (
                                <View
                                    key={`${r.mainCatId}-${r.subId}`}
                                    className="search-result-item"
                                    onClick={() => {
                                        setSelectedMainCatId(r.mainCatId);
                                        setSelectedSubCatId(r.subId);
                                        setShowSearch(false);
                                        setSearchQuery("");
                                    }}
                                >
                                    <View className="search-result-main">
                                        <Text className="search-result-name">{r.subName}</Text>
                                        <Text className="search-result-count">{r.itemCount}件商品</Text>
                                    </View>
                                    <Text className="search-result-cat">{r.mainCatName}</Text>
                                </View>
                            ))}
                        </ScrollView>
                    </View>
                )}

                <View className="panel-content">
                    <ScrollView scrollY className="panel-side">
                        <View className={`side-item ${selectedSubCatId === "" ? "active" : ""}`} onClick={() => setSelectedSubCatId("")}>全部</View>
                        {activeMain?.subCategories.map((sub) => (
                            <View key={sub.id} className={`side-item ${selectedSubCatId === sub.id ? "active" : ""}`} onClick={() => setSelectedSubCatId(sub.id)}>
                                {sub.name}
                            </View>
                        ))}
                    </ScrollView>

                    {viewingMaterial ? (
                        <View className="inline-detail-container">
                            <View className="inline-detail-header-row">
                                <View className="inline-back" onClick={() => setViewingMaterial(null)}>
                                    <View className="inline-back-icon">←</View>
                                    <Text>后退</Text>
                                </View>
                            </View>
                            <ScrollView scrollY className="inline-detail-scroll">
                                <View className="inline-detail-body">
                                    <View className="inline-detail-top">
                                        <View className="inline-thumb-wrap">
                                            <View className="inline-thumb-circle" style={{ background: viewingMaterial.color }}>
                                                <View className="bead-stripe" style={{ opacity: 0.6 }} />
                                                <View className="bead-highlight" />
                                            </View>
                                        </View>
                                        <View className="inline-info-col">
                                            <Text className="inline-name">{viewingMaterial.name}</Text>
                                            <Text className="inline-price">¥{viewingMaterial.price}</Text>
                                            <View className="inline-tags">
                                                <Text className="inline-tag">{viewingMaterial.sizeMm}mm</Text>
                                                <Text className="inline-tag">{viewingMaterial.sizeMm * 0.15 + 0.3}g</Text>
                                            </View>
                                        </View>
                                        <View className="inline-add-btn" onClick={() => { handleAddBead(viewingMaterial); setViewingMaterial(null); }}>
                                            <Text>添加</Text>
                                        </View>
                                    </View>

                                    <View className="inline-props-row">
                                        <Text className="inline-prop">材质：{viewingMaterial.material || "天然水晶"}</Text>
                                        <Text className="inline-prop">属性：{viewingMaterial.element || "全"}</Text>
                                    </View>

                                    {viewingMaterial.meaning && (
                                        <View className="inline-section">
                                            <Text className="inline-label">寓意</Text>
                                            <Text className="inline-text">{viewingMaterial.meaning}</Text>
                                            {viewingMaterial.description && <Text className="inline-desc">{viewingMaterial.description}</Text>}
                                        </View>
                                    )}

                                    <View className="inline-section">
                                        <Text className="inline-label">实拍图</Text>
                                        <View className="inline-images-row">
                                            {(!viewingMaterial.images || viewingMaterial.images.length === 0) ? (
                                                <View className="inline-no-image">暂无实拍图</View>
                                            ) : (
                                                viewingMaterial.images.map((url, i) => (
                                                    <Image key={i} src={url} className="inline-real-img" mode="aspectFill" />
                                                ))
                                            )}
                                        </View>
                                    </View>
                                </View>
                                <View style={{ height: 40 }} />
                            </ScrollView>
                        </View>
                    ) : (
                        <View className="panel-grid-wrap">
                            <View className="panel-tip">
                                <Text className="tip-icon">💡</Text>
                                <Text className="tip-text">长按材料可查看实拍图</Text>
                                <Text className="tip-close">×</Text>
                            </View>
                            <ScrollView scrollY className="panel-grid-scroll">
                                <View className="panel-grid">
                                    {activeItems.map((item) => (
                                        <View
                                            key={item.id}
                                            className="material-card"
                                            onClick={() => handleAddBead(item)}
                                            onTouchStart={(e) => {
                                                e.stopPropagation();
                                                materialLongPressTimer.current = setTimeout(() => {
                                                    setViewingMaterial(item);
                                                    Taro.vibrateShort();
                                                }, 600); // 600ms long press for details
                                            }}
                                            onTouchEnd={() => {
                                                if (materialLongPressTimer.current) {
                                                    clearTimeout(materialLongPressTimer.current);
                                                    materialLongPressTimer.current = null;
                                                }
                                            }}
                                            onTouchMove={() => {
                                                if (materialLongPressTimer.current) {
                                                    clearTimeout(materialLongPressTimer.current);
                                                    materialLongPressTimer.current = null;
                                                }
                                            }}
                                        >
                                            <View className="material-thumb" style={{ background: item.color }}>
                                                <View className="material-thumb-stripe" />
                                                <View className="material-thumb-highlight" />
                                            </View>
                                            <Text className="material-name">{item.name}</Text>
                                            <Text className="material-price">¥{item.price}</Text>
                                            <Text className="material-size">{item.sizeMm}mm</Text>
                                        </View>
                                    ))}
                                    {activeItems.length === 0 && <View className="material-empty">暂无可用材料</View>}
                                </View>
                            </ScrollView>
                        </View>
                    )}
                </View>
            </View>



            {/* ── Save Modal ── */}
            {showSaveModal && (
                <View className="modal-overlay" onClick={() => setShowSaveModal(false)}>
                    <View className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <View className="modal-close" onClick={() => setShowSaveModal(false)}><X size={20} /></View>
                        <View className="modal-title">为作品添加标签</View>
                        <View className="tags-wrapper">
                            {TAG_OPTIONS.map((tag) => (
                                <View
                                    key={tag}
                                    className={`tag-item ${selectedTags.includes(tag) ? "active" : ""}`}
                                    onClick={() => {
                                        if (selectedTags.includes(tag)) setSelectedTags((p) => p.filter((t) => t !== tag));
                                        else setSelectedTags((p) => [...p, tag]);
                                    }}
                                >{tag}</View>
                            ))}
                        </View>
                        <View className="modal-btn" onClick={handleSave}>确认保存</View>
                    </View>
                </View>
            )}

            {/* ── Wrist Modal ── */}
            {showWristAdjuster && (
                <View className="modal-overlay" onClick={() => setShowWristAdjuster(false)}>
                    <View className="modal-content wrist-modal" onClick={(e) => e.stopPropagation()}>
                        <View className="modal-close" onClick={() => setShowWristAdjuster(false)}><X size={20} /></View>
                        <View className="modal-title">手围调整</View>
                        <View className="wrist-row">
                            <View className="adjust-btn" onClick={() => setWristSize((s) => Math.max(10, s - 0.5))}><Minus size={22} /></View>
                            <View className="wrist-display">
                                <View className="wrist-val">{wristSize}</View>
                                <View className="wrist-unit">cm</View>
                            </View>
                            <View className="adjust-btn" onClick={() => setWristSize((s) => Math.min(25, s + 0.5))}><Plus size={22} /></View>
                        </View>
                        <View className="modal-subtext">建议测量手腕最细处贴肤周长</View>
                        <View className="modal-btn" onClick={() => setShowWristAdjuster(false)}>完成设置</View>
                    </View>
                </View>
            )}
        </View>
    );
}



