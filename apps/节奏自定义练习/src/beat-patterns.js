import { TICKS_PER_QUARTER, uid } from './model.js';
const n = (duration, dotted = false)=>({
        duration,
        type: 'note',
        dotted
    });
const r = (duration, dotted = false)=>({
        duration,
        type: 'rest',
        dotted
    });
const tn = ()=>({
        duration: 160,
        type: 'note',
        tuplet: true
    });
const tr = ()=>({
        duration: 160,
        type: 'rest',
        tuplet: true
    });
let sourceOrder = 0;
function pattern(id, name, category, segments, enabledByDefault = false) {
    let startTick = 0;
    const events = segments.map((segment)=>{
        const current = startTick;
        startTick += segment.duration;
        return {
            startTick: current,
            durationTicks: segment.duration,
            type: segment.type ?? 'note',
            dotted: segment.dotted ?? false,
            tuplet: segment.tuplet ? {
                actual: 3,
                normal: 2,
                groupId: 'triplet'
            } : null,
            accent: current === 0
        };
    });
    const tags = [
        category === 'tuplet' ? '三连音' : category === 'dotted' ? '附点' : category === 'rest' ? '休止符' : category === 'subdivision' ? '细分' : '基础'
    ];
    if (segments.some((item)=>item.type === 'rest') && !tags.includes('休止符')) tags.push('休止符');
    if (segments.some((item)=>item.dotted) && !tags.includes('附点')) tags.push('附点');
    if (segments.some((item)=>item.duration === 120)) tags.push('十六分');
    if (segments.some((item)=>item.duration === 240 || item.duration === 360)) tags.push('八分');
    return {
        id,
        name,
        description: `${segments.length} 个事件 · 总计 480 tick`,
        category,
        beatTicks: 480,
        events,
        enabledByDefault,
        sourceOrder: sourceOrder++,
        tags
    };
}
export const BEAT_PATTERNS = [
    pattern('quarter', '一个四分音符', 'basic', [
        n(480)
    ], true),
    pattern('four-sixteenths', '四个十六分音符', 'subdivision', [
        n(120),
        n(120),
        n(120),
        n(120)
    ], true),
    pattern('quarter-rest', '一个四分休止符', 'rest', [
        r(480)
    ], true),
    pattern('two-eighths', '两个八分音符', 'subdivision', [
        n(240),
        n(240)
    ], true),
    pattern('eighth-triplet', '八分音符三连音', 'tuplet', [
        tn(),
        tn(),
        tn()
    ], true),
    pattern('8th-8th-rest', '八分音符＋八分休止符', 'rest', [
        n(240),
        r(240)
    ]),
    pattern('8th-rest-8th', '八分休止符＋八分音符', 'rest', [
        r(240),
        n(240)
    ]),
    pattern('8th-16th-16th', '八分＋两个十六分', 'subdivision', [
        n(240),
        n(120),
        n(120)
    ]),
    pattern('16th-16th-8th', '两个十六分＋八分', 'subdivision', [
        n(120),
        n(120),
        n(240)
    ]),
    pattern('dotted-8th-16th', '附点八分＋十六分', 'dotted', [
        n(360, true),
        n(120)
    ]),
    pattern('16th-dotted-8th', '十六分＋附点八分', 'dotted', [
        n(120),
        n(360, true)
    ]),
    pattern('dotted-8th-16th-rest', '附点八分＋十六分休止', 'dotted', [
        n(360, true),
        r(120)
    ]),
    pattern('16th-rest-dotted-8th', '十六分休止＋附点八分', 'dotted', [
        r(120),
        n(360, true)
    ]),
    pattern('16th-16th-8th-rest', '两个十六分＋八分休止', 'rest', [
        n(120),
        n(120),
        r(240)
    ]),
    pattern('8th-rest-16th-16th', '八分休止＋两个十六分', 'rest', [
        r(240),
        n(120),
        n(120)
    ]),
    pattern('16th-8th-16th', '十六分＋八分＋十六分', 'subdivision', [
        n(120),
        n(240),
        n(120)
    ]),
    pattern('16th-rest-16th-8th', '十六分休止＋十六分＋八分', 'rest', [
        r(120),
        n(120),
        n(240)
    ]),
    pattern('16th-rest-8th-16th', '十六分休止＋八分＋十六分', 'rest', [
        r(120),
        n(240),
        n(120)
    ]),
    pattern('16th-8th-16th-rest', '十六分＋八分＋十六分休止', 'rest', [
        n(120),
        n(240),
        r(120)
    ]),
    pattern('8th-16th-16th-rest', '八分＋十六分＋十六分休止', 'rest', [
        n(240),
        n(120),
        r(120)
    ]),
    pattern('8th-16th-rest-16th', '八分＋十六分休止＋十六分', 'rest', [
        n(240),
        r(120),
        n(120)
    ]),
    pattern('16th-16th-rest-8th', '十六分＋十六分休止＋八分', 'rest', [
        n(120),
        r(120),
        n(240)
    ]),
    pattern('16th-rest-16th-16th-16th', '十六分休止＋三个十六分', 'rest', [
        r(120),
        n(120),
        n(120),
        n(120)
    ]),
    pattern('16th-16th-16th-16th-rest', '三个十六分＋十六分休止', 'rest', [
        n(120),
        n(120),
        n(120),
        r(120)
    ]),
    pattern('dotted-8th-rest-16th', '附点八分休止＋十六分', 'dotted', [
        r(360, true),
        n(120)
    ]),
    pattern('16th-dotted-8th-rest', '十六分＋附点八分休止', 'dotted', [
        n(120),
        r(360, true)
    ]),
    pattern('16th-16th-rest-16th-16th', '十六分＋休止＋两个十六分', 'rest', [
        n(120),
        r(120),
        n(120),
        n(120)
    ]),
    pattern('16th-16th-16th-rest-16th', '两个十六分＋休止＋十六分', 'rest', [
        n(120),
        n(120),
        r(120),
        n(120)
    ]),
    pattern('16th-8th-rest-16th', '十六分＋八分休止＋十六分', 'rest', [
        n(120),
        r(240),
        n(120)
    ]),
    pattern('8th-rest-16th-16th-rest', '八分休止＋十六分＋十六分休止', 'rest', [
        r(240),
        n(120),
        r(120)
    ]),
    pattern('16th-rest-16th-16th-rest-16th', '休止＋十六分＋休止＋十六分', 'rest', [
        r(120),
        n(120),
        r(120),
        n(120)
    ]),
    pattern('16th-16th-rest-16th-16th-rest', '十六分＋休止＋十六分＋休止', 'rest', [
        n(120),
        r(120),
        n(120),
        r(120)
    ]),
    pattern('3rd-3rd-rest-3rd', '三连音：音－休－音', 'tuplet', [
        tn(),
        tr(),
        tn()
    ]),
    pattern('3rd-3rd-3rd-rest', '三连音：音－音－休', 'tuplet', [
        tn(),
        tn(),
        tr()
    ]),
    pattern('3rd-rest-3rd-3rd', '三连音：休－音－音', 'tuplet', [
        tr(),
        tn(),
        tn()
    ]),
    pattern('3rd-3rd-rest-3rd-rest', '三连音：音－休－休', 'tuplet', [
        tn(),
        tr(),
        tr()
    ]),
    pattern('3rd-rest-3rd-3rd-rest', '三连音：休－音－休', 'tuplet', [
        tr(),
        tn(),
        tr()
    ]),
    pattern('3rd-rest-3rd-rest-3rd', '三连音：休－休－音', 'tuplet', [
        tr(),
        tr(),
        tn()
    ])
];
export const DEFAULT_BEAT_PATTERN_IDS = BEAT_PATTERNS.filter((p)=>p.enabledByDefault).map((p)=>p.id);
export function validateBeatPattern(pattern) {
    if (pattern.beatTicks !== TICKS_PER_QUARTER || !pattern.events.length) return false;
    const ordered = [
        ...pattern.events
    ].sort((a, b)=>a.startTick - b.startTick);
    let cursor = 0;
    for (const item of ordered){
        if (item.startTick !== cursor || item.durationTicks <= 0) return false;
        cursor += item.durationTicks;
    }
    return cursor === pattern.beatTicks;
}
export function instantiateBeatPattern(pattern, barIndex, beatIndex) {
    const offset = beatIndex * TICKS_PER_QUARTER;
    return pattern.events.map((item)=>({
            id: uid(),
            barIndex,
            startTick: offset + item.startTick,
            durationTicks: item.durationTicks,
            type: item.type,
            dotted: item.dotted,
            tuplet: item.tuplet ? {
                ...item.tuplet,
                groupId: `${barIndex}-${beatIndex}-${item.tuplet.groupId}`
            } : null,
            beatPatternId: pattern.id,
            tieToNext: false,
            accent: item.accent
        }));
}
