export const SMUFL_GLYPHS = {
    restWhole: '\uE4E3',
    restHalf: '\uE4E4',
    restQuarter: '\uE4E5',
    rest8th: '\uE4E6',
    rest16th: '\uE4E7',
    rest32nd: '\uE4E8',
    noteWhole: '\uE1D2',
    noteHalf: '\uE1D3',
    noteQuarter: '\uE1D5',
    note8th: '\uE1D7',
    note16th: '\uE1D9',
    note32nd: '\uE1DB',
    augmentationDot: '\uE1E7'
};
export function glyphName(event) {
    if (event.type === 'rest') {
        if (event.tuplet) return 'rest8th';
        if (event.durationTicks >= 1920) return 'restWhole';
        if (event.durationTicks >= 960) return 'restHalf';
        if (event.durationTicks >= 480) return 'restQuarter';
        if (event.durationTicks >= 240) return 'rest8th';
        if (event.durationTicks >= 120) return 'rest16th';
        return 'rest32nd';
    }
    if (event.tuplet) return 'note8th';
    if (event.durationTicks >= 1920) return 'noteWhole';
    if (event.durationTicks >= 960) return 'noteHalf';
    if (event.durationTicks >= 480) return 'noteQuarter';
    if (event.durationTicks >= 240) return 'note8th';
    if (event.durationTicks >= 120) return 'note16th';
    return 'note32nd';
}
export function notationEventHTML(event) {
    const name = glyphName(event), dot = event.dotted ? `<span class="smufl augmentation-dot" aria-hidden="true">${SMUFL_GLYPHS.augmentationDot}</span>` : '';
    return `<span class="notation-symbol ${event.type}" data-glyph="${name}"><span class="smufl smufl-glyph" aria-hidden="true">${SMUFL_GLYPHS[name]}</span>${dot}</span>`;
}
export function beatPatternNotationHTML(events) {
    const triplet = events.some((event)=>event.tuplet);
    return `<span class="beat-notation ${triplet ? 'has-tuplet' : ''}">${triplet ? '<span class="tuplet-bracket"><i></i><b>3</b><i></i></span>' : ''}${events.map(notationEventHTML).join('')}</span>`;
}
