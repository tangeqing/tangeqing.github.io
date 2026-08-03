import { DATA_VERSION, cleanInvalidTies, clonePattern, isRhythmPattern, migrateRhythmPattern, uid } from './model.js';
export const LIBRARY_KEY = 'pulsecraft-library-v1';
export const DRAFT_KEY = 'pulsecraft-draft-v1';
function safeParse(raw) {
    try {
        return raw ? JSON.parse(raw) : null;
    } catch  {
        return null;
    }
}
export function loadLibrary(storage = localStorage) {
    const value = safeParse(storage.getItem(LIBRARY_KEY));
    if (!value || ![
        1,
        2,
        DATA_VERSION
    ].includes(Number(value.version)) || !Array.isArray(value.patterns)) return [];
    return value.patterns.map(migrateRhythmPattern).filter((p)=>p !== null);
}
export function writeLibrary(patterns, storage = localStorage) {
    storage.setItem(LIBRARY_KEY, JSON.stringify({
        version: DATA_VERSION,
        patterns: patterns.filter(isRhythmPattern)
    }));
}
export function savePattern(pattern, patterns, asCopy = false) {
    const saved = clonePattern(pattern), now = new Date().toISOString();
    if (asCopy) {
        saved.id = uid();
        saved.name = `${saved.name} 副本`;
        saved.createdAt = now;
    }
    saved.updatedAt = now;
    saved.lastUsedAt = now;
    const others = patterns.filter((p)=>p.id !== saved.id);
    return {
        pattern: saved,
        patterns: [
            saved,
            ...others
        ]
    };
}
export function saveDraft(pattern, storage = localStorage) {
    storage.setItem(DRAFT_KEY, JSON.stringify(pattern));
}
export function loadDraft(storage = localStorage) {
    const value = safeParse(storage.getItem(DRAFT_KEY));
    return migrateRhythmPattern(value);
}
export function exportPattern(pattern) {
    return JSON.stringify({
        schema: 'pulsecraft-rhythm',
        version: DATA_VERSION,
        pattern
    }, null, 2);
}
export function importPattern(raw) {
    const parsed = safeParse(raw);
    if (!parsed || parsed.schema !== 'pulsecraft-rhythm' || ![
        1,
        2,
        DATA_VERSION
    ].includes(Number(parsed.version))) throw new Error('文件格式或数据版本无效');
    const migrated = migrateRhythmPattern(parsed.pattern);
    if (!migrated) throw new Error('节奏数据损坏，无法导入');
    return migrated;
}
