import { RhythmAudioEngine } from './audio.js';
import { BEAT_PATTERNS, DEFAULT_BEAT_PATTERN_IDS } from './beat-patterns.js';
import { createPattern, regenerateAll, regenerateBar, replaceBeatWithPattern, resizePattern } from './generator.js';
import { TICKS_PER_QUARTER, barTicks, cleanInvalidTies, clonePattern, deleteEvent, orderedEvents, tieEligibility, toggleEventType } from './model.js';
import { beatPatternNotationHTML, notationEventHTML } from './notation.js';
import { exportPattern, importPattern, loadDraft, loadLibrary, saveDraft, savePattern, writeLibrary } from './storage.js';
const $ = (selector)=>document.querySelector(selector);
const engine = new RhythmAudioEngine();
let pattern = loadDraft() ?? createPattern();
let library = loadLibrary();
let selectedBar = 0, selectedEvent = null;
let position = {
    state: 'stopped',
    tick: 0,
    barIndex: 0,
    beatIndex: 0,
    eventId: null,
    loop: 1,
    countInBeat: null
};
let saveTimer = 0, continuous = true;
let patternCategory = 'all';
const loopLabel = (count)=>count === 'infinite' ? '∞' : String(count);
const dateText = (iso)=>new Intl.DateTimeFormat('zh-CN', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    }).format(new Date(iso));
const escapeHtml = (text)=>text.replace(/[&<>'"]/g, (c)=>({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            "'": '&#39;',
            '"': '&quot;'
        })[c]);
function toast(message) {
    const el = $('#toast');
    el.textContent = message;
    el.classList.add('show');
    setTimeout(()=>el.classList.remove('show'), 1800);
}
function draft() {
    saveDraft(pattern);
    $('#saveStatus').textContent = '● 已自动保存';
}
function changed() {
    $('#saveStatus').textContent = '● 正在保存';
    clearTimeout(saveTimer);
    saveTimer = window.setTimeout(draft, 180);
    render();
}
function renderBars() {
    const all = orderedEvents(pattern), previous = new Map(all.map((e, i)=>[
            e.id,
            all[i - 1]
        ]));
    const selected = selectedEvent ? all.find((event)=>event.id === selectedEvent) : null, selectedBeat = selected ? Math.floor(selected.startTick / TICKS_PER_QUARTER) : -1;
    $('#bars').innerHTML = pattern.bars.map((bar)=>`<article class="bar ${bar.index === position.barIndex && position.state === 'playing' ? 'active' : ''} ${bar.index === selectedBar ? 'selected' : ''}" data-bar="${bar.index}"><div class="bar-head"><b>第 ${bar.index + 1} 小节</b><span>${bar.locked ? '● 已锁定' : '○ 可随机'}</span></div><div class="staff">${bar.events.map((event)=>`<button class="event ${event.type} ${event.id === position.eventId ? 'active' : ''} ${event.id === selectedEvent ? 'selected' : ''} ${selected && event.barIndex === selected.barIndex && Math.floor(event.startTick / TICKS_PER_QUARTER) === selectedBeat ? 'edit-beat' : ''} ${event.startTick % TICKS_PER_QUARTER === 0 ? 'beat' : ''} ${event.tuplet && event.startTick % TICKS_PER_QUARTER === 0 ? 'tuplet-start' : ''} ${event.tieToNext ? 'tie-out' : ''} ${previous.get(event.id)?.tieToNext ? 'tie-in' : ''}" style="--grow:${event.durationTicks}" data-event="${event.id}" aria-label="${event.durationTicks} tick ${event.type === 'note' ? '音符' : '休止符'}">${event.tuplet && event.startTick % TICKS_PER_QUARTER === 0 ? '<span class="score-tuplet"><i></i><b>3</b><i></i></span>' : ''}${notationEventHTML(event)}<span class="duration">${event.durationTicks}t</span></button>`).join('')}</div></article>`).join('');
    document.querySelectorAll('[data-bar]').forEach((el)=>el.onclick = (e)=>{
            if (e.target.closest('[data-event]')) return;
            selectedBar = Number(el.dataset.bar);
            selectedEvent = null;
            render();
        });
    document.querySelectorAll('[data-event]').forEach((el)=>el.onclick = ()=>{
            selectedEvent = el.dataset.event;
            const event = all.find((e)=>e.id === selectedEvent);
            selectedBar = event.barIndex;
            render();
        });
}
function renderBeatPatterns() {
    const categories = [
        [
            'all',
            '全部'
        ],
        [
            'basic',
            '基础'
        ],
        [
            'subdivision',
            '细分'
        ],
        [
            'dotted',
            '附点'
        ],
        [
            'rest',
            '休止符'
        ],
        [
            'tuplet',
            '三连音'
        ]
    ];
    $('#patternCategories').innerHTML = categories.map(([id, label])=>`<button role="tab" aria-selected="${patternCategory === id}" class="${patternCategory === id ? 'active' : ''}" data-pattern-category="${id}">${label}</button>`).join('');
    const visible = BEAT_PATTERNS.filter((item)=>patternCategory === 'all' || item.category === patternCategory || patternCategory === 'rest' && item.tags.includes('休止符') || patternCategory === 'dotted' && item.tags.includes('附点')).sort((a, b)=>a.sourceOrder - b.sourceOrder);
    const target = selectedEvent ? orderedEvents(pattern).find((event)=>event.id === selectedEvent) : null;
    const targetBeat = target ? Math.floor(target.startTick / TICKS_PER_QUARTER) : -1;
    const activePattern = target && pattern.bars[target.barIndex]?.beatPatternIds[targetBeat];
    $('#beatPatterns').innerHTML = visible.map((item)=>{
        const pooled = pattern.selectedBeatPatternIds.includes(item.id), active = item.id === activePattern;
        return `<div class="pattern-item ${active ? 'current' : ''}"><button class="pattern-card" data-apply-pattern="${item.id}" ${target ? '' : 'disabled'} title="${target ? `用此模板替换第 ${target.barIndex + 1} 小节第 ${targetBeat + 1} 拍` : '请先在谱面中选择一个音符或休止符'}">${active ? '<span class="current-mark">当前</span>' : ''}${beatPatternNotationHTML(item.events)}<span><b>${item.name}</b><br><small>${item.description}</small></span></button><button class="pool-toggle" data-pattern-pool="${item.id}" aria-pressed="${pooled}" title="${pooled ? '从随机素材池移除' : '加入随机素材池'}"><span>${pooled ? '✓' : '＋'}</span> 随机</button></div>`;
    }).join('');
    const status = $('#patternSelectionStatus');
    status.textContent = pattern.selectedBeatPatternIds.length ? `已选择 ${pattern.selectedBeatPatternIds.length}/${BEAT_PATTERNS.length} 个节奏型` : '请至少选择一个节奏型，当前不能生成';
    status.classList.toggle('error', !pattern.selectedBeatPatternIds.length);
    document.querySelectorAll('[data-pattern-category]').forEach((button)=>button.onclick = ()=>{
            patternCategory = button.dataset.patternCategory;
            renderBeatPatterns();
        });
    $('#patternTarget').textContent = target ? `将替换：第 ${target.barIndex + 1} 小节 · 第 ${targetBeat + 1} 拍` : '请先在下方谱面中选择一个音符或休止符';
    document.querySelectorAll('[data-pattern-pool]').forEach((button)=>button.onclick = ()=>{
            const id = button.dataset.patternPool, selected = pattern.selectedBeatPatternIds.includes(id);
            pattern.selectedBeatPatternIds = selected ? pattern.selectedBeatPatternIds.filter((value)=>value !== id) : [
                ...pattern.selectedBeatPatternIds,
                id
            ];
            changed();
        });
    document.querySelectorAll('[data-apply-pattern]').forEach((button)=>button.onclick = ()=>applyBeatPattern(button.dataset.applyPattern));
}
function renderEditor() {
    const event = selectedEvent ? orderedEvents(pattern).find((e)=>e.id === selectedEvent) : null, eligibility = selectedEvent ? tieEligibility(pattern, selectedEvent) : {
        allowed: false,
        reason: '点击一个事件进行编辑'
    };
    $('#selectionHelp').textContent = event ? `第 ${event.barIndex + 1} 小节 · ${event.startTick} tick · ${event.type === 'note' ? '音符' : '休止符'}` : eligibility.reason;
    [
        '#toggleTypeBtn',
        '#deleteBtn'
    ].forEach((id)=>$(id).disabled = !event);
    $('#openPatternDrawerBtn').disabled = !event;
    const tieBtn = $('#tieBtn');
    tieBtn.disabled = !eligibility.allowed;
    tieBtn.textContent = event?.tieToNext ? '取消延音' : '连接到下一个音符';
    tieBtn.title = eligibility.reason;
}
function applyBeatPattern(beatPatternId) {
    const event = selectedEvent ? orderedEvents(pattern).find((item)=>item.id === selectedEvent) : null;
    if (!event) {
        toast('请先在谱面中选择要替换的一拍');
        return;
    }
    if (engine.getState() !== 'stopped') stop();
    const beatIndex = Math.floor(event.startTick / TICKS_PER_QUARTER);
    pattern = replaceBeatWithPattern(pattern, event.barIndex, beatIndex, beatPatternId);
    selectedEvent = pattern.bars[event.barIndex].events.find((item)=>item.startTick === beatIndex * TICKS_PER_QUARTER)?.id ?? null;
    changed();
    toast(`已替换第 ${event.barIndex + 1} 小节第 ${beatIndex + 1} 拍`);
}
function renderSettings() {
    $('#bpm').value = String(pattern.bpm);
    $('#bpmOut').textContent = String(pattern.bpm);
    $('#volume').value = String(Math.round(pattern.volume * 100));
    $('#volumeOut').textContent = `${Math.round(pattern.volume * 100)}%`;
    $('#metronomeEnabled').checked = pattern.metronomeSettings.enabled;
    $('#metronomeVolume').value = String(Math.round(pattern.metronomeSettings.volume * 100));
    $('#metronomeVolume').disabled = !pattern.metronomeSettings.enabled;
    $('#metronomeOut').textContent = `${Math.round(pattern.metronomeSettings.volume * 100)}%`;
    $('#barCount').value = String(pattern.barCount);
    $('#loopCount').value = String(pattern.loopSettings.count);
    $('#countIn').value = String(pattern.countInSettings.bars);
    $('#allowTies').checked = pattern.allowTies;
    $('#tieProbability').value = String(Math.round(pattern.tieProbability * 100));
    $('#tieProbability').disabled = !pattern.allowTies;
    $('#tieOut').textContent = `${Math.round(pattern.tieProbability * 100)}%`;
    document.querySelectorAll('[data-quick]').forEach((el)=>el.classList.toggle('active', Number(el.dataset.quick) === pattern.barCount));
    document.querySelectorAll('[data-mode]').forEach((el)=>el.classList.toggle('active', el.dataset.mode === pattern.playbackMode));
    $('#patternName').textContent = pattern.name;
    $('#lockBarBtn').textContent = pattern.bars[selectedBar]?.locked ? '解锁当前小节' : '锁定当前小节';
}
function renderTransport() {
    const playing = position.state === 'playing', paused = position.state === 'paused';
    $('#playBtn').textContent = playing ? 'Ⅱ' : '▶';
    $('#transportLabel').textContent = position.countInBeat ? `预备拍 ${position.countInBeat}` : playing ? '正在练习' : paused ? '已暂停' : '准备好了';
    $('#positionLabel').textContent = `第 ${position.barIndex + 1} 小节 · 第 ${position.beatIndex + 1} 拍`;
    const max = pattern.loopSettings.count, loopText = max === 'infinite' ? `第 ${position.loop} 次 · 无限循环` : `第 ${Math.min(position.loop, max)}/${max} 次`;
    $('#meterText').textContent = loopText;
    const progress = (position.barIndex * barTicks(pattern) + position.tick % barTicks(pattern)) / (pattern.barCount * barTicks(pattern)) * 100;
    $('#meterFill').style.width = `${Math.max(0, Math.min(100, progress))}%`;
}
function renderLibrary() {
    $('#libraryCount').textContent = String(library.length);
    const query = $('#search').value.trim().toLowerCase(), sort = $('#sort').value;
    const items = library.filter((p)=>!query || p.name.toLowerCase().includes(query) || p.tags.some((t)=>t.toLowerCase().includes(query))).sort((a, b)=>sort === 'name' ? a.name.localeCompare(b.name, 'zh-CN') : b.lastUsedAt.localeCompare(a.lastUsedAt));
    $('#libraryList').innerHTML = items.length ? items.map((p)=>`<article class="library-item"><p><b>${escapeHtml(p.name)}</b><br><small>${p.barCount} 小节 · ${p.bpm} BPM · ${dateText(p.lastUsedAt)}</small></p><div class="item-actions"><button data-load="${p.id}" title="加载">载入</button><button data-copy="${p.id}" title="复制">复制</button><button data-rename="${p.id}" title="重命名">改名</button><button data-delete="${p.id}" title="删除">删</button></div></article>`).join('') : '<p class="small">还没有保存的节奏。</p>';
    document.querySelectorAll('[data-load]').forEach((b)=>b.onclick = ()=>{
            pattern = clonePattern(library.find((p)=>p.id === b.dataset.load));
            pattern.lastUsedAt = new Date().toISOString();
            selectedBar = 0;
            selectedEvent = null;
            stop();
            changed();
            toast('已载入节奏');
        });
    document.querySelectorAll('[data-copy]').forEach((b)=>b.onclick = ()=>{
            const source = library.find((p)=>p.id === b.dataset.copy);
            const result = savePattern(source, library, true);
            library = result.patterns;
            writeLibrary(library);
            renderLibrary();
            toast('已复制');
        });
    document.querySelectorAll('[data-rename]').forEach((b)=>b.onclick = ()=>{
            const p = library.find((p)=>p.id === b.dataset.rename);
            const name = prompt('新的名称', p.name)?.trim();
            if (name) {
                p.name = name;
                p.updatedAt = new Date().toISOString();
                writeLibrary(library);
                renderLibrary();
            }
        });
    document.querySelectorAll('[data-delete]').forEach((b)=>b.onclick = ()=>{
            if (!confirm('删除这个节奏？此操作无法撤销。')) return;
            library = library.filter((p)=>p.id !== b.dataset.delete);
            writeLibrary(library);
            renderLibrary();
            toast('已删除');
        });
    $('#nameInput').value = pattern.name;
    $('#tagsInput').value = pattern.tags.join(', ');
    $('#notesInput').value = pattern.notes;
}
function render() {
    renderSettings();
    renderBeatPatterns();
    renderBars();
    renderEditor();
    renderTransport();
    renderLibrary();
}
function startContinuous(resume, skipCountIn) {
    const playable = {
        ...pattern,
        loopSettings: {
            count: 1
        }
    };
    engine.play(playable, (p)=>{
        position = p;
        renderBars();
        renderTransport();
    }, ()=>{
        pattern = regenerateAll(pattern);
        position = {
            ...position,
            state: 'stopped',
            loop: 1
        };
        changed();
        startContinuous(false, true);
    }, resume, skipCountIn);
}
function play() {
    if (engine.getState() === 'playing') {
        engine.pause();
        position = {
            ...position,
            state: 'paused'
        };
        render();
        return;
    }
    const resume = engine.getState() === 'paused';
    continuous = pattern.playbackMode === 'continuous';
    if (continuous) {
        startContinuous(resume, resume);
        return;
    }
    engine.play(pattern, (p)=>{
        position = p;
        renderBars();
        renderTransport();
    }, ()=>{
        position = {
            ...position,
            state: 'stopped',
            tick: 0,
            barIndex: 0,
            beatIndex: 0,
            eventId: null,
            loop: 1
        };
        render();
    }, resume, resume);
}
function stop() {
    engine.stop();
    position = {
        state: 'stopped',
        tick: 0,
        barIndex: 0,
        beatIndex: 0,
        eventId: null,
        loop: 1,
        countInBeat: null
    };
    render();
}
function generate() {
    if (!pattern.selectedBeatPatternIds.length) {
        toast('请至少选择一个节奏型');
        renderBeatPatterns();
        return;
    }
    stop();
    pattern = regenerateAll(pattern);
    selectedEvent = null;
    changed();
    toast('已按所选节奏型生成完整节奏');
}
function openLibrary(open = true) {
    $('#library').classList.toggle('open', open);
    $('#library').setAttribute('aria-hidden', String(!open));
    $('#scrim').classList.toggle('open', open);
    if (open) renderLibrary();
}
function openPatternDrawer(open = true) {
    $('#patternDrawer').classList.toggle('open', open);
    $('#patternDrawer').setAttribute('aria-hidden', String(!open));
    if (open) {
        renderBeatPatterns();
        $('#patternDrawer').focus();
    }
}
$('#barQuick').innerHTML = [
    1,
    2,
    4,
    8,
    12,
    16
].map((n)=>`<button data-quick="${n}">${n}</button>`).join('');
document.querySelectorAll('[data-quick]').forEach((b)=>b.onclick = ()=>{
        pattern = resizePattern(pattern, Number(b.dataset.quick));
        selectedBar = Math.min(selectedBar, pattern.barCount - 1);
        changed();
    });
document.querySelectorAll('[data-mode]').forEach((b)=>b.onclick = ()=>{
        pattern.playbackMode = b.dataset.mode;
        stop();
        changed();
    });
$('#bpm').oninput = (e)=>{
    pattern.bpm = Number(e.target.value);
    if (engine.getState() !== 'stopped') stop();
    changed();
};
$('#volume').oninput = (e)=>{
    pattern.volume = Number(e.target.value) / 100;
    changed();
};
$('#metronomeEnabled').onchange = (e)=>{
    pattern.metronomeSettings.enabled = e.target.checked;
    changed();
};
$('#metronomeVolume').oninput = (e)=>{
    pattern.metronomeSettings.volume = Number(e.target.value) / 100;
    changed();
};
$('#barCount').onchange = (e)=>{
    pattern = resizePattern(pattern, Number(e.target.value));
    selectedBar = Math.min(selectedBar, pattern.barCount - 1);
    changed();
};
$('#loopCount').onchange = (e)=>{
    pattern.loopSettings.count = e.target.value === 'infinite' ? 'infinite' : Number(e.target.value);
    stop();
    changed();
};
$('#countIn').onchange = (e)=>{
    pattern.countInSettings.bars = Number(e.target.value);
    changed();
};
$('#allowTies').onchange = (e)=>{
    pattern.allowTies = e.target.checked;
    if (!pattern.allowTies) {
        pattern.bars.forEach((b)=>b.events.forEach((ev)=>ev.tieToNext = false));
    }
    changed();
};
$('#tieProbability').oninput = (e)=>{
    pattern.tieProbability = Number(e.target.value) / 100;
    changed();
};
$('#generateBtn').onclick = generate;
$('#regenBarBtn').onclick = ()=>{
    if (!pattern.selectedBeatPatternIds.length) {
        toast('请至少选择一个节奏型');
        return;
    }
    pattern = regenerateBar(pattern, selectedBar);
    selectedEvent = null;
    changed();
};
$('#lockBarBtn').onclick = ()=>{
    pattern.bars[selectedBar].locked = !pattern.bars[selectedBar].locked;
    changed();
};
$('#playBtn').onclick = play;
$('#stopBtn').onclick = stop;
$('#toggleTypeBtn').onclick = ()=>{
    if (selectedEvent) {
        pattern = toggleEventType(pattern, selectedEvent);
        changed();
    }
};
$('#openPatternDrawerBtn').onclick = ()=>openPatternDrawer();
$('#tieBtn').onclick = ()=>{
    if (!selectedEvent) return;
    const eligible = tieEligibility(pattern, selectedEvent);
    if (!eligible.allowed) {
        toast(eligible.reason);
        return;
    }
    const e = orderedEvents(pattern).find((e)=>e.id === selectedEvent);
    e.tieToNext = !e.tieToNext;
    pattern = cleanInvalidTies(pattern);
    changed();
};
$('#deleteBtn').onclick = ()=>{
    if (selectedEvent) {
        pattern = deleteEvent(pattern, selectedEvent);
        selectedEvent = null;
        changed();
    }
};
$('#libraryBtn').onclick = ()=>openLibrary();
$('#closeLibrary').onclick = ()=>openLibrary(false);
$('#scrim').onclick = ()=>openLibrary(false);
$('#closePatternDrawer').onclick = ()=>openPatternDrawer(false);
$('#selectAllPatterns').onclick = ()=>{
    pattern.selectedBeatPatternIds = BEAT_PATTERNS.map((item)=>item.id);
    changed();
};
$('#clearPatterns').onclick = ()=>{
    pattern.selectedBeatPatternIds = [];
    changed();
};
$('#defaultPatterns').onclick = ()=>{
    pattern.selectedBeatPatternIds = [
        ...DEFAULT_BEAT_PATTERN_IDS
    ];
    changed();
};
$('#saveBtn').onclick = ()=>{
    const result = savePattern(pattern, library);
    pattern = result.pattern;
    library = result.patterns;
    writeLibrary(library);
    draft();
    render();
    toast('已保存');
};
$('#saveAsBtn').onclick = ()=>{
    const result = savePattern(pattern, library, true);
    pattern = result.pattern;
    library = result.patterns;
    writeLibrary(library);
    draft();
    render();
    toast('已另存为');
};
$('#exportBtn').onclick = ()=>{
    const blob = new Blob([
        exportPattern(pattern)
    ], {
        type: 'application/json'
    }), a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${pattern.name.replace(/[^\w\u4e00-\u9fa5-]+/g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
};
$('#importInput').onchange = async (e)=>{
    const file = e.target.files?.[0];
    if (!file) return;
    try {
        pattern = importPattern(await file.text());
        selectedBar = 0;
        selectedEvent = null;
        changed();
        toast('导入成功');
    } catch (err) {
        toast(err instanceof Error ? err.message : '导入失败');
    }
    e.target.value = '';
};
$('#search').oninput = renderLibrary;
$('#sort').onchange = renderLibrary;
$('#nameInput').oninput = (e)=>{
    pattern.name = e.target.value || '未命名节奏';
    changed();
};
$('#tagsInput').onchange = (e)=>{
    pattern.tags = e.target.value.split(',').map((x)=>x.trim()).filter(Boolean);
    changed();
};
$('#notesInput').onchange = (e)=>{
    pattern.notes = e.target.value;
    changed();
};
document.addEventListener('visibilitychange', ()=>{
    if (document.hidden && engine.getState() === 'playing') {
        engine.pause();
        position = {
            ...position,
            state: 'paused'
        };
        render();
        toast('切换标签页后已自动暂停');
    }
});
document.addEventListener('keydown', (e)=>{
    if (e.key === 'Escape' && $('#patternDrawer').classList.contains('open')) {
        openPatternDrawer(false);
        return;
    }
    if (e.code === 'Space' && ![
        'INPUT',
        'TEXTAREA',
        'SELECT'
    ].includes(e.target.tagName)) {
        e.preventDefault();
        play();
    }
});
document.fonts.load('48px Bravura').then(()=>document.body.classList.remove('music-font-loading')).catch(()=>{
    document.body.classList.remove('music-font-loading');
    $('#fontError').hidden = false;
});
render();
draft();
