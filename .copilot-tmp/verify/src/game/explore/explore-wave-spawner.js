export function createInitialExploreWaveTimers(firstWaveDelay) {
    return {
        wave: 0,
        waveActive: false,
        nextWaveDelay: firstWaveDelay,
        spawnRemaining: 0,
        spawnCooldown: 0,
        currentWaveSpawned: 0,
        upgradePending: false,
        allWavesCleared: false,
    };
}
/** 获取指定波次的所有规则 */
export function getExploreWaveRulesForWave(rules, wave) {
    if (!rules?.length)
        return [];
    return rules
        .filter((r) => r.waveNumber === wave)
        .map((r) => ({
        ...r,
        count: Math.max(1, Math.round(Number(r.count) || 1)),
        interval: Math.max(0.15, Number(r.interval) || 1),
    }));
}
/** 无自定义规则时的默认波次参数 */
function defaultWaveParams(wave) {
    // 渐进曲线：前几波少且慢，后期多且快
    const count = Math.min(40, Math.round(3 + wave * 1.8 + Math.pow(wave, 1.35) * 0.4));
    const interval = Math.max(0.3, 1.4 - wave * 0.04);
    return { count, interval };
}
/** 波次清完奖励 */
function waveReward(wave) {
    return {
        money: Math.round(30 + wave * 15 + Math.pow(wave, 1.2) * 3),
        xp: Math.round(20 + wave * 12),
    };
}
export function advanceExploreWaveState(input) {
    if (input.upgradePending) {
        return { timers: { ...input.timers, upgradePending: true }, effects: [] };
    }
    let t = { ...input.timers, upgradePending: false };
    const effects = [];
    if (t.allWavesCleared) {
        return { timers: t, effects };
    }
    // ── 波次完成判定 ──
    if (t.waveActive && t.spawnRemaining <= 0 && input.aliveEnemyCount === 0) {
        const completedWave = t.wave;
        const reward = waveReward(completedWave);
        effects.push({ kind: "grantMoney", amount: reward.money });
        effects.push({ kind: "grantXp", amount: reward.xp });
        effects.push({ kind: "toastWaveClear", wave: completedWave, reward: reward.money });
        if (completedWave >= input.totalWaves) {
            t.allWavesCleared = true;
            t.waveActive = false;
            if (completedWave >= input.bossUnlockWave) {
                effects.push({ kind: "bossPhaseBegin" });
            }
            effects.push({ kind: "allWavesCleared", wave: completedWave });
            return { timers: t, effects };
        }
        // 进入波间暂停：弹出升级选择
        t.waveActive = false;
        t.nextWaveDelay = input.wavePauseSec;
        t.currentWaveSpawned = 0;
        effects.push({ kind: "showUpgradeChoice", wave: completedWave });
        return { timers: t, effects };
    }
    // ── 波间倒计时 ──
    if (!t.waveActive) {
        t.nextWaveDelay -= input.dt;
        if (t.nextWaveDelay <= 0) {
            t.wave += 1;
            t.waveActive = true;
            t.currentWaveSpawned = 0;
            const authored = getExploreWaveRulesForWave(input.waveRules, t.wave);
            if (authored.length) {
                t.spawnRemaining = authored.reduce((s, r) => s + r.count, 0);
                t.spawnCooldown = authored[0]?.interval ?? 1;
            }
            else {
                const defaults = defaultWaveParams(t.wave);
                t.spawnRemaining = defaults.count;
                t.spawnCooldown = defaults.interval;
            }
            effects.push({ kind: "toastWaveBegins", wave: t.wave });
        }
        return { timers: t, effects };
    }
    // ── 出怪节拍 ──
    if (t.spawnRemaining <= 0) {
        return { timers: t, effects };
    }
    t.spawnCooldown -= input.dt;
    if (t.spawnCooldown <= 0) {
        const authored = getExploreWaveRulesForWave(input.waveRules, t.wave);
        const ordinal = t.currentWaveSpawned;
        const activeRule = selectRuleForOrdinal(authored, ordinal);
        effects.push({
            kind: "spawnEnemy",
            waveRuleId: activeRule?.id,
            spawnerId: activeRule?.spawnerId,
        });
        t.spawnRemaining -= 1;
        t.currentWaveSpawned = ordinal + 1;
        // 下次出怪间隔
        const nextRule = selectRuleForOrdinal(authored, ordinal + 1);
        const nextInterval = nextRule?.interval
            ?? (authored.length ? authored[0]?.interval ?? 1 : defaultWaveParams(t.wave).interval);
        t.spawnCooldown = nextInterval;
    }
    return { timers: t, effects };
}
function selectRuleForOrdinal(rules, ordinal) {
    if (!rules.length)
        return undefined;
    let seen = 0;
    for (const rule of rules) {
        const count = Math.max(1, Math.round(Number(rule.count) || 1));
        if (ordinal < seen + count)
            return rule;
        seen += count;
    }
    return rules[rules.length - 1];
}
