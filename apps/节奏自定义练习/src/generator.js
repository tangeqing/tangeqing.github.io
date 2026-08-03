import { BEAT_PATTERNS, DEFAULT_BEAT_PATTERN_IDS, instantiateBeatPattern } from './beat-patterns.js';
import { DATA_VERSION, TICKS_PER_QUARTER, cleanInvalidTies, clonePattern, orderedEvents, uid } from './model.js';
const choice = (items, random)=>items[Math.floor(random() * items.length)];
export function generateBar(pattern, index, random = Math.random) {
    const selected = BEAT_PATTERNS.filter((item)=>pattern.selectedBeatPatternIds.includes(item.id));
    if (!selected.length) throw new Error('请至少选择一个节奏型');
    const beatPatternIds = [], events = [];
    for(let beat = 0; beat < pattern.timeSignature.numerator; beat++){
        const template = choice(selected, random);
        beatPatternIds.push(template.id);
        events.push(...instantiateBeatPattern(template, index, beat));
    }
    return {
        index,
        locked: false,
        beatPatternIds,
        events
    };
}
function generateTies(pattern, random) {
    const next = clonePattern(pattern);
    if (!next.allowTies) return next;
    const events = orderedEvents(next);
    for(let i = 0; i < events.length - 1; i++){
        if (!next.bars[events[i].barIndex].locked && events[i].type === 'note' && events[i + 1].type === 'note' && random() < next.tieProbability) events[i].tieToNext = true;
    }
    return cleanInvalidTies(next);
}
export function createPattern(barCount = 4, random = Math.random) {
    const now = new Date().toISOString();
    const pattern = {
        id: uid(),
        name: '未命名节奏',
        version: DATA_VERSION,
        createdAt: now,
        updatedAt: now,
        lastUsedAt: now,
        bpm: 88,
        volume: .72,
        timeSignature: {
            numerator: 4,
            denominator: 4
        },
        barCount,
        enabledDurations: [
            TICKS_PER_QUARTER,
            TICKS_PER_QUARTER / 2,
            TICKS_PER_QUARTER / 4
        ],
        selectedBeatPatternIds: [
            ...DEFAULT_BEAT_PATTERN_IDS
        ],
        bars: [],
        loopSettings: {
            count: 4
        },
        countInSettings: {
            bars: 1
        },
        metronomeSettings: {
            enabled: true,
            volume: .55
        },
        playbackMode: 'fixed',
        allowTies: false,
        tieProbability: .15,
        tags: [],
        notes: ''
    };
    pattern.bars = Array.from({
        length: barCount
    }, (_, i)=>generateBar(pattern, i, random));
    return generateTies(pattern, random);
}
export function regenerateAll(pattern, random = Math.random) {
    const next = clonePattern(pattern);
    next.bars = Array.from({
        length: next.barCount
    }, (_, i)=>next.bars[i]?.locked ? next.bars[i] : generateBar(next, i, random));
    next.updatedAt = new Date().toISOString();
    return generateTies(cleanInvalidTies(next), random);
}
export function regenerateBar(pattern, index, random = Math.random) {
    const next = clonePattern(pattern);
    if (!next.bars[index]?.locked) next.bars[index] = generateBar(next, index, random);
    next.updatedAt = new Date().toISOString();
    return generateTies(cleanInvalidTies(next), random);
}
export function replaceBeatWithPattern(pattern, barIndex, beatIndex, beatPatternId) {
    const template = BEAT_PATTERNS.find((item)=>item.id === beatPatternId);
    const bar = pattern.bars[barIndex];
    if (!template || !bar) throw new Error('找不到要替换的节奏型或小节');
    if (beatIndex < 0 || beatIndex >= pattern.timeSignature.numerator) throw new Error('拍号位置无效');
    const next = clonePattern(pattern);
    const beatStart = beatIndex * TICKS_PER_QUARTER;
    const beatEnd = beatStart + TICKS_PER_QUARTER;
    const targetBar = next.bars[barIndex];
    targetBar.events = [
        ...targetBar.events.filter((event)=>event.startTick < beatStart || event.startTick >= beatEnd),
        ...instantiateBeatPattern(template, barIndex, beatIndex)
    ].sort((a, b)=>a.startTick - b.startTick);
    targetBar.beatPatternIds[beatIndex] = template.id;
    next.updatedAt = new Date().toISOString();
    return cleanInvalidTies(next);
}
export function resizePattern(pattern, count, random = Math.random) {
    const next = clonePattern(pattern);
    const bounded = Math.max(1, Math.min(32, Math.round(count)));
    next.bars = Array.from({
        length: bounded
    }, (_, i)=>next.bars[i] ?? generateBar(next, i, random));
    next.bars.forEach((bar, i)=>{
        bar.index = i;
        bar.events.forEach((e)=>e.barIndex = i);
    });
    next.barCount = bounded;
    next.updatedAt = new Date().toISOString();
    return cleanInvalidTies(next);
}
