import { TICKS_PER_QUARTER, barTicks, orderedEvents } from './model.js';
export function buildAttackPlan(pattern) {
    const events = orderedEvents(pattern), attacks = [];
    for(let i = 0; i < events.length; i++){
        if (events[i].type === 'rest' || i > 0 && events[i - 1].tieToNext) continue;
        let duration = events[i].durationTicks, cursor = i;
        while(events[cursor]?.tieToNext && events[cursor + 1]?.type === 'note'){
            duration += events[cursor + 1].durationTicks;
            cursor++;
        }
        attacks.push({
            event: events[i],
            durationTicks: duration
        });
    }
    return attacks;
}
export function buildMetronomePlan(pattern) {
    if (!pattern.metronomeSettings.enabled) return [];
    const total = pattern.barCount * barTicks(pattern), clicks = [];
    for(let tick = 0; tick < total; tick += TICKS_PER_QUARTER)clicks.push({
        tick,
        downbeat: tick % barTicks(pattern) === 0
    });
    return clicks;
}
export class RhythmAudioEngine {
    context = null;
    timer = null;
    frame = null;
    origin = 0;
    absoluteStartTick = 0;
    scheduledUntil = 0;
    pausedTick = 0;
    state = 'stopped';
    pattern = null;
    onPosition = ()=>{};
    onEnd = ()=>{};
    scheduledNodes = new Set();
    async play(pattern, onPosition, onEnd, resume = false, skipCountIn = false) {
        this.stopTimers();
        this.pattern = pattern;
        this.onPosition = onPosition;
        this.onEnd = onEnd;
        this.context ??= new AudioContext();
        await this.context.resume();
        const countInTicks = skipCountIn ? 0 : pattern.countInSettings.bars * barTicks(pattern);
        this.absoluteStartTick = resume ? this.pausedTick : -countInTicks;
        this.scheduledUntil = this.absoluteStartTick;
        this.origin = this.context.currentTime;
        this.state = 'playing';
        this.pump();
        this.paint();
    }
    pause() {
        if (this.state !== 'playing' || !this.context || !this.pattern) return;
        this.pausedTick = this.nowTick();
        this.state = 'paused';
        this.stopTimers();
        this.onPosition(this.position(this.pausedTick));
    }
    stop() {
        this.state = 'stopped';
        this.pausedTick = 0;
        this.stopTimers();
        this.onPosition({
            state: 'stopped',
            tick: 0,
            barIndex: 0,
            beatIndex: 0,
            eventId: null,
            loop: 1,
            countInBeat: null
        });
    }
    getState() {
        return this.state;
    }
    secondsPerTick() {
        return 60 / (this.pattern.bpm * TICKS_PER_QUARTER);
    }
    nowTick() {
        return this.absoluteStartTick + (this.context.currentTime - this.origin) / this.secondsPerTick();
    }
    maxLoops() {
        const count = this.pattern.loopSettings.count;
        return count === 'infinite' ? Number.POSITIVE_INFINITY : count;
    }
    position(tick) {
        const p = this.pattern, total = p.barCount * barTicks(p);
        if (tick < 0) return {
            state: this.state,
            tick,
            barIndex: 0,
            beatIndex: 0,
            eventId: null,
            loop: 1,
            countInBeat: Math.floor((tick + p.countInSettings.bars * barTicks(p)) / TICKS_PER_QUARTER) + 1
        };
        const local = (tick % total + total) % total, loop = Math.floor(tick / total) + 1;
        const barIndex = Math.min(p.barCount - 1, Math.floor(local / barTicks(p))), inBar = local - barIndex * barTicks(p);
        const event = orderedEvents(p).find((e)=>e.barIndex === barIndex && inBar >= e.startTick && inBar < e.startTick + e.durationTicks);
        return {
            state: this.state,
            tick: local,
            barIndex,
            beatIndex: Math.floor(inBar / TICKS_PER_QUARTER),
            eventId: event?.id ?? null,
            loop,
            countInBeat: null
        };
    }
    paint = ()=>{
        if (this.state !== 'playing' || !this.pattern) return;
        const tick = this.nowTick(), total = this.pattern.barCount * barTicks(this.pattern);
        if (tick >= total * this.maxLoops()) {
            this.state = 'stopped';
            this.stopTimers();
            this.onEnd();
            return;
        }
        this.onPosition(this.position(tick));
        this.frame = requestAnimationFrame(this.paint);
    };
    pump = ()=>{
        if (this.state !== 'playing' || !this.pattern || !this.context) return;
        const from = this.scheduledUntil, horizon = this.nowTick() + TICKS_PER_QUARTER * .6;
        this.scheduleRange(from, horizon);
        this.scheduledUntil = horizon;
        this.timer = window.setTimeout(this.pump, 25);
    };
    scheduleRange(from, to) {
        const p = this.pattern, total = p.barCount * barTicks(p), max = this.maxLoops();
        const firstBeat = Math.ceil(from / TICKS_PER_QUARTER) * TICKS_PER_QUARTER;
        for(let t = firstBeat; t < Math.min(to, 0); t += TICKS_PER_QUARTER)this.clickAt(t, t % barTicks(p) === 0, .85);
        const metronome = buildMetronomePlan(p);
        const clickStartCycle = Math.max(0, Math.floor(Math.max(0, from) / total));
        const clickEndCycle = Math.min(max - 1, Math.floor(Math.max(0, to) / total));
        for(let cycle = clickStartCycle; cycle <= clickEndCycle; cycle++)for (const click of metronome){
            const global = cycle * total + click.tick;
            if (global < from || global >= to) continue;
            this.clickAt(global, click.downbeat, p.metronomeSettings.volume);
        }
        const attacks = buildAttackPlan(p);
        const startCycle = Math.max(0, Math.floor(Math.max(0, from) / total));
        const endCycle = Math.min(max - 1, Math.floor(Math.max(0, to) / total));
        for(let cycle = startCycle; cycle <= endCycle; cycle++)for (const attack of attacks){
            const event = attack.event, global = cycle * total + event.barIndex * barTicks(p) + event.startTick;
            if (global < from || global >= to) continue;
            this.noteAt(global, attack.durationTicks, event);
        }
    }
    at(tick) {
        return this.origin + (tick - this.absoluteStartTick) * this.secondsPerTick();
    }
    clickAt(tick, downbeat, scale) {
        this.tone(this.at(tick), downbeat ? 1320 : 880, .06 * this.pattern.volume * scale * (downbeat ? 1.25 : 1), .05);
    }
    noteAt(tick, duration, event) {
        this.tone(this.at(tick), event.accent ? 330 : 294, .12 * this.pattern.volume, Math.max(.06, duration * this.secondsPerTick() * .82));
    }
    tone(time, frequency, volume, duration) {
        const ctx = this.context, osc = ctx.createOscillator(), gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(frequency, time);
        gain.gain.setValueAtTime(Math.max(.0001, volume), time);
        gain.gain.exponentialRampToValueAtTime(.0001, time + duration);
        osc.connect(gain).connect(ctx.destination);
        this.scheduledNodes.add(osc);
        osc.onended = ()=>this.scheduledNodes.delete(osc);
        osc.start(time);
        osc.stop(time + duration + .01);
    }
    stopTimers() {
        if (this.timer !== null) clearTimeout(this.timer);
        if (this.frame !== null) cancelAnimationFrame(this.frame);
        for (const node of this.scheduledNodes){
            try {
                node.stop();
            } catch  {}
        }
        this.scheduledNodes.clear();
        this.timer = null;
        this.frame = null;
    }
}
