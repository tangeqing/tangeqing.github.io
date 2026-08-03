export const DATA_VERSION = 3;
export const TICKS_PER_QUARTER = 480;
export const uid = ()=>globalThis.crypto?.randomUUID?.() ?? `r-${Date.now()}-${Math.random().toString(36).slice(2)}`;
export const barTicks = (p)=>p.timeSignature.numerator * TICKS_PER_QUARTER * (4 / p.timeSignature.denominator);
export const orderedEvents = (p)=>p.bars.flatMap((bar)=>bar.events).sort((a, b)=>a.barIndex - b.barIndex || a.startTick - b.startTick);
export function clonePattern(pattern) {
    return JSON.parse(JSON.stringify(pattern));
}
export function cleanInvalidTies(pattern) {
    const next = clonePattern(pattern);
    const events = orderedEvents(next);
    events.forEach((event, index)=>{
        const following = events[index + 1];
        const eventEnd = event.barIndex * barTicks(next) + event.startTick + event.durationTicks;
        const followingStart = following ? following.barIndex * barTicks(next) + following.startTick : -1;
        if (event.tieToNext && (!following || event.type !== 'note' || following.type !== 'note' || eventEnd !== followingStart)) event.tieToNext = false;
    });
    return next;
}
export function tieEligibility(pattern, eventId) {
    const events = orderedEvents(pattern);
    const index = events.findIndex((e)=>e.id === eventId);
    const current = events[index], next = events[index + 1];
    if (!current) return {
        allowed: false,
        reason: '请先选择一个音符'
    };
    if (current.type !== 'note') return {
        allowed: false,
        reason: '休止符不能作为延音起点'
    };
    if (!next) return {
        allowed: false,
        reason: '最后一个事件不能跨循环边界延音'
    };
    if (next.type !== 'note') return {
        allowed: false,
        reason: '下一个事件是休止符'
    };
    const end = current.barIndex * barTicks(pattern) + current.startTick + current.durationTicks;
    const start = next.barIndex * barTicks(pattern) + next.startTick;
    if (end !== start) return {
        allowed: false,
        reason: '只能连接时间上相邻的两个音符'
    };
    return {
        allowed: true,
        reason: current.tieToNext ? '取消连接到下一个音符' : '连接到下一个音符'
    };
}
export function deleteEvent(pattern, eventId) {
    const next = clonePattern(pattern);
    next.bars.forEach((bar)=>bar.events = bar.events.filter((e)=>e.id !== eventId));
    next.updatedAt = new Date().toISOString();
    return cleanInvalidTies(next);
}
export function toggleEventType(pattern, eventId) {
    const next = clonePattern(pattern);
    const event = orderedEvents(next).find((e)=>e.id === eventId);
    if (event) event.type = event.type === 'note' ? 'rest' : 'note';
    next.updatedAt = new Date().toISOString();
    return cleanInvalidTies(next);
}
export function isRhythmPattern(value) {
    if (!value || typeof value !== 'object') return false;
    const p = value;
    if (p.version !== DATA_VERSION || typeof p.id !== 'string' || typeof p.name !== 'string') return false;
    if (!Number.isFinite(p.bpm) || Number(p.bpm) < 30 || Number(p.bpm) > 300) return false;
    if (!p.metronomeSettings || typeof p.metronomeSettings.enabled !== 'boolean' || !Number.isFinite(p.metronomeSettings.volume) || Number(p.metronomeSettings.volume) < 0 || Number(p.metronomeSettings.volume) > 1) return false;
    if (!Number.isInteger(p.barCount) || Number(p.barCount) < 1 || Number(p.barCount) > 32) return false;
    if (!Array.isArray(p.bars) || p.bars.length !== p.barCount) return false;
    if (!Array.isArray(p.selectedBeatPatternIds) || !p.selectedBeatPatternIds.every((id)=>typeof id === 'string')) return false;
    return p.bars.every((bar, bi)=>bar && bar.index === bi && Array.isArray(bar.beatPatternIds) && Array.isArray(bar.events) && bar.events.every((event)=>typeof event.id === 'string' && event.barIndex === bi && Number.isInteger(event.startTick) && event.startTick >= 0 && Number.isInteger(event.durationTicks) && event.durationTicks > 0 && (event.type === 'note' || event.type === 'rest') && typeof event.dotted === 'boolean' && (event.tuplet === null || typeof event.tuplet === 'object') && typeof event.beatPatternId === 'string' && typeof event.tieToNext === 'boolean'));
}
export function migrateRhythmPattern(value) {
    if (isRhythmPattern(value)) return cleanInvalidTies(value);
    if (!value || typeof value !== 'object' || ![
        1,
        2
    ].includes(Number(value.version))) return null;
    const legacy = clonePattern(value);
    const sourceVersion = Number(value.version);
    legacy.version = DATA_VERSION;
    legacy.metronomeSettings = {
        enabled: true,
        volume: .55
    };
    if (sourceVersion === 1) {
        legacy.selectedBeatPatternIds = [
            'quarter',
            'four-sixteenths',
            'quarter-rest',
            'two-eighths',
            'eighth-triplet'
        ];
        legacy.bars?.forEach((bar)=>{
            bar.beatPatternIds = Array.from({
                length: legacy.timeSignature?.numerator ?? 4
            }, ()=>'legacy');
            bar.events?.forEach((event)=>{
                event.dotted = false;
                event.tuplet = null;
                event.beatPatternId = 'legacy';
            });
        });
    }
    return isRhythmPattern(legacy) ? cleanInvalidTies(legacy) : null;
}
