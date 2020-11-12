var bar_pattern = /\]\s*\||\|\|\[?\d?|\|\]\d?|:\|:\[?\d?|:\|\]?\[?\d?|\[\|\d?|\|:\[?\d?|\[\d|\|\[?\d?|\]/g;
function parseContent(abc_str) {
  // TODO: extract the chord lines
  abc_str = abc_str.replace(/\\\r?\n?/g, '');
  console.log(abc_str);
  var lines = abc_str.split('\n');
  var lyrics_lines = lines.filter((v)=>v.match(/^\s*w:/));
  var meta_lines = lines.filter((v)=>v.match(/^%%.*/));
  var command_lines = lines.filter((v)=>v.match(/^\s*[TXMQKLPSA]:/));
  var in_chord_voice = false;
  var chord_lines = lines.filter((v)=>{
    var m = v.match(/\s*\[?V:\s*(?<voiceName>[^ \]]+)\s*[^\]]*\s*\]?/);
    if(m) {
      in_chord_voice = (m.groups.voiceName == 'chord');
    }
    return (in_chord_voice && ![lyrics_lines,meta_lines,command_lines].some(o=>o.includes(v)));
  });
  var melody_lines = lines.filter((v)=>(![lyrics_lines,meta_lines,command_lines,chord_lines].some(o=>o.includes(v))));
  var line_types = lines.map((l)=>(
        chord_lines.includes(l)?'chords':
        lyrics_lines.includes(l)?'lyrics':
        meta_lines.includes(l)?'meta':
        command_lines.includes(l)?'command':
        melody_lines.includes(l)?'melody':
        'other'));
  console.log(lyrics_lines);
  console.log(command_lines);
  console.log(melody_lines);
  console.log(chord_lines);
  console.log(line_types);
  return {lines, line_types, lyrics_lines, command_lines, chord_lines, melody_lines, meta_lines};
}

function extractLyrics(abc, type) {
  var {lyrics_lines, line_types,lines} = parseContent(abc);
  var verse_count = 1;
  lyrics_verse_index = line_types.map((l,i)=>{
    if(line_types[i] != 'lyrics') {
      verse_count = 0;
      return null;
    }
    else { // when line_types[i] == 'lyrics'
      verse_count ++;
      return verse_count;
    }
  });
  lyrics_verse_index = lyrics_verse_index.filter(l=>l);
  console.log(lyrics_verse_index);
  var staff_lyrics_lines = [];
  for(let i in lyrics_verse_index) {
    var last_staff_lyrics_lines = staff_lyrics_lines[staff_lyrics_lines.length - 1];
    var last_vi = (last_staff_lyrics_lines && last_staff_lyrics_lines.length || Infinity);
    var vi = lyrics_verse_index[i];
    var lyrics_line = lyrics_lines[i];
    if(vi == 1) {
      staff_lyrics_lines.push([lyrics_line]);
    }
    else if(vi == last_vi + 1){
      last_staff_lyrics_lines.push(lyrics_line);
    }
    else {
      throw new Error('Incorrect verse counter.' + lyrics_verse_index);
    }
  }
  console.log(staff_lyrics_lines);
  if(type == 'raw') {
    var output_lines = [];
    var part_verses = [];
    for(let si = 0; si <= staff_lyrics_lines.length; si ++) {
      if(si == staff_lyrics_lines.length || staff_lyrics_lines[si].length != part_verses.length) {
        // we enter a new part (or reach the end)
        // dump the previous part
        if(part_verses.length > 0) {
          for(let vi in part_verses) {
            if(part_verses.length > 1)
              output_lines.push(`[${Number(vi) + 1}]`);
            output_lines.push(...part_verses[vi]);
          }
          output_lines.push('');
        }
        if(si == staff_lyrics_lines.length )
          break;
        // init part_verses
        part_verses = [];
        for(let i = 0; i < staff_lyrics_lines[si].length; i ++)
          part_verses.push([]);
      }
      for(let vi in staff_lyrics_lines[si]) {
        part_verses[vi].push(staff_lyrics_lines[si][vi]);
      }
    }
    console.log(output_lines);
    var lyrics = output_lines.map(v=>v.replace(/^\s*w:\s*/, '').replace(/~|\*|\||_/g, '').replace(/(?<![a-zA-Z\.\,\!\?\:\;"'`]) /g, '')).join('\n');

  }
  else if(type == 'processed') {
    var lyrics = staff_lyrics_lines.map((staff,i)=>{
      return staff.map((v,i)=>{
        return v.replace(/^\s*w:\s*/, (i == 0 ? '> ' : '  '));
      }).join('\n');
    }).join('\n');
  }
  console.log(lyrics);
  return lyrics;
}

function extractMelodyLines(abc) {
  var {line_types,lines} = parseContent(abc);
  return lines.filter((l,i)=>(!['chords','lyrics'].includes(line_types[i]))).join('\n');
}
function extractChordLines(abc) {
  var {line_types,lines} = parseContent(abc);
  return lines.filter((l,i)=>(line_types[i]=='chords')).join('\n');
}

function removeOverlay(abc) {
  // tidy up the melody lines, remove overlay (&) from the melody lines
  var {line_types,lines} = parseContent(abc);
  lines = lines
    .filter((l,i)=>(line_types[i]!='lyrics'))
    .map(l=>{
      return parseMeasuresOfLine(l).merged.map(part=>{
        return (!part.includes('&') ? part : part.split('&').find(v=>!v.includes('x')));
      }).join('');
  });
  return lines.join('\n');
}
function removeMeta(abc) {
  return abc.replace(/^%%.*\n/gm, '');
}
function removeVoiceMark(abc) {
  return abc.replace(/\[V:[^\]]*\]\s*/g, '').replace(/^\s*V:.*\n/gm, '');
}
function removeMusicMarks(abc) {
  return abc.replace(/![^!]+!/g, '');
}
function removeChords(abc) {
  return abc.replace(/"[^"]*"/g, '');
}
function extract_bars(str) {
  return str.match(bar_pattern) || [];
}
function split_by_bars(str) {
  return str.split(bar_pattern);
}
function parseMeasuresOfLine(line) {
  line = line.trim();
  var bars = extract_bars(line);
  var measures = split_by_bars(line);
  if(measures[0].length == 0) {
    measures = measures.slice(1);
    console.log('remove first split of bars');
  }
  if(measures[measures.length - 1].length == 0) {
    measures.pop();
    console.log('remove last split of bars');
  }
  var merged = Array.from(bars.length > measures.length ?
    interleave(bars,measures) : interleave(measures,bars));
  console.log(merged);
  return {measures, bars, merged};
}

function parseMeasures(abc) {
  var {melody_lines,} = parseContent(abc);
  var lines_of_measures = melody_lines.map(l=>parseMeasuresOfLine(l));
  console.log(lines_of_measures);
  return lines_of_measures;
}

function extract_each_notes(str) {
  str = str.replace(/\^*_*=*[za-gA-G]'*,*/g, 'x');
  return str.match(/\(3::1x\d*\/*\d*|\(3::2(?:x\d*\/*\d*){2}|\(3(?:x\d*\/*\d*){3}|x\d*\/*\d*/g) || [];
}
function length_of_one_note(note){
  console.assert(note.startsWith('x'));
  var nums = note.replace('x','').split('/');
  var mul = nums[0].length ? parseInt(nums[0]) : 1;
  var div = Math.pow(2, nums.length - 1);
  if(nums.length > 1 && nums[nums.length - 1] != '')
    div = div * parseInt(nums[nums.length - 1]) / 2;
  console.log(note, mul / div);
  return mul / div;
}
function length_of_notes(notes){
  var lengths = notes.map(n=>{
    if(n.startsWith('(3'))
      return length_of_notes(extract_each_notes(n.slice(2))) * 2/3;
    return length_of_one_note(n);
  });
  return lengths.reduce((r,v)=>(r+v),0);
}
function segsAndMarks(abc) {
  var {melody_lines,} = parseContent(removeVoiceMark(abc));
  var x = melody_lines.join('\n');
  console.log(x = x.replace(/\{[^\}]*\}/g, ''))
  var cmds = x.match(/\[\S:[^\n\|\]]*\]/g) || [];
  console.log(x = x.replace(/\[\S:[^\n\|\]]*\]/g, '%cmd'))
  var bars = x.match(bar_pattern) || [];
  console.log(x = x.replace(bar_pattern, '%bar'))
  var ands = x.match(/&/g) || [];
  console.log(x = x.replace(/&/g, '%and'))
  var chords = x.match(/"[^"]+"/g) || [];
  console.log(x = x.replace(/"[^"]+"/g, '%chord'))
  var decorates = x.match(/(\+[^\+]+\+|\![^\!]+\!)/g) || [];
  console.log(x = x.replace(/(\+[^\+]+\+|\![^\!]+\!)/g, '%decorate'))
  var newlines = x.match(/\n/g) || [];
  console.log(x = x.replace(/\n/g, '%newline'))
  console.log(x = x.replace(/\(([^0-9][^\)]*)\)/g, '$1')) // remove slurs
  console.log(x = x.replace(/\-/g, '')) // remove ties
  console.log(x = x.replace(/ /g, ''))
  console.log(x = x.replace(/xXyY/g, ''))
  console.log(x = x.replace(/Z/g, 'X'))
  x = x.split(/%bar/g).map(measure=>{
    if(measure.includes('%and')) { // has two voice in this measure
      var firstVoiceWithChord = measure.split('%and').find(v=>v.includes('%chord'));
      return firstVoiceWithChord;
    }
    else
      return measure;
  }).join('%bar');
  console.log(x);
  var segs = x.split(/%cmd|%bar|%and|%chord|%decorate|%newline/g);
  var marks = x.match(/%cmd|%bar|%and|%chord|%decorate|%newline/g) || [];
  return {segs, marks, cmds, bars, ands, chords, decorates, newlines};
}
function getMergedSeg(segs) {
  var seg_notes = segs.map(extract_each_notes);
  var seg_lengths = seg_notes.map(length_of_notes);
  console.log(seg_notes);
  console.log(seg_lengths);
  var seg_merged = seg_lengths.map(v=>{
    if(v <= 0)
      return '';
    if(Math.round(v) - v > 0.01)
      throw `Some non-integer note length: ${v}`;
    return `x${Math.round(v)}`;
  });
  return seg_merged;
}
function getPieces(abc) {
  var {segs, marks, cmds, bars, ands, chords, decorates, newlines} = segsAndMarks(abc);
  var seg_merged = getMergedSeg(segs);
  var tags = Array.from(interleave(segs.map(()=>'%seg'), marks));
  var pieces = Array.from(weave(tags,{
    '%seg': seg_merged,
    '%cmd': cmds,
    '%bar': bars,
    '%chord': chords,
    '%decorate': decorates,
    '%newline': newlines,
  }));
  return {tags, pieces};
}
function getChordVoice(abc) {
  console.group('getChordVoice');
  var {pieces} = getPieces(abc);
  console.groupEnd('getChordVoice');
  return pieces.join('');
}
function getMeasures(abc) {
  var {tags, pieces} = getPieces(abc);
  var measures = [];
  var new_measure = true;
  for(let [t, p] of zip(tags, pieces)) {
    if(new_measure) {
      measures.push({tags: [], pieces: []});
      new_measure = false;
    }
    var measure = measures[measures.length - 1];
    if(t == '%seg' && p == '')
      continue;
    measure.tags.push(t);
    measure.pieces.push(p);
    if(t == '%bar') {
      if(measure.tags.indexOf('%seg') >= 0)
        new_measure = true;
      else {}// if this measure is empty
    }
  }
  if(measures[measures.length - 1].pieces.length == 0)
    measures.pop();
  return measures;
}
function getMeasureChords(measures) {
  measures = measures.map(Measure.removeEmptySeg);
  measures.forEach(m=>{m.length = Measure.getLength(m);});
  measures.forEach(m=>{m.chords = Measure.getChords(m);});
  return measures;
}
var Measure = {
  removeEmptySeg: function(m) {
    return {
      tags: m.tags.filter((v,i)=>(m.tags[i] != '%seg' || m.pieces[i] != '')),
      pieces: m.pieces.filter((v,i)=>(m.tags[i] != '%seg' || m.pieces[i] != '')),
    };
  },
  getLength: function(m) {
    return length_of_notes(m.pieces.filter((v,i)=>m.tags[i]=='%seg'));
  },
  getChords: function(m) {
    var chords = [];
    var currPos = 0;
    for(let [t, p] of zip(m.tags, m.pieces)) {
      if(t == '%seg') {
        currPos += length_of_one_note(p);
      }
      else if(t == '%chord') {
        chords.push({
          name: p.replace(/^\s*"/,'').replace(/"\s*$/,''), // remove quote marks
          pos: currPos,
        });
      }
    }
    return chords;
  },
};
class ChordEditor {
  constructor(textarea) {
    this.textarea = textarea;
    this.saved_content = this.textarea.value;
    this.measures = getMeasureChords(getMeasures(this.saved_content));
    this.cursor_pos = {measure: 0, beat: 0};
    this._editing = false;
  }
  get editing() {return this._editing;}
  set editing(value) {
    value = !!value;
    if(value)
      this.startEdit();
    else
      this.finishEdit();
  }
  startEdit() {
    if(this.textarea.value == '') {
      this.textarea.value = getChordVoice(document.querySelector('#abc-text').value);
      console.log('TODO: generate the chord lines');
    }
    this._editing = true;
    this.saved_content = this.textarea.value;
    this.measures = getMeasureChords(getMeasures(this.saved_content));
    this.display();
  }
  finishEdit() {
    this._editing = false;
    this.display();
  }
  setCursor(measure, beat) {
    if(measure == null)
      measure = 0;
    if(beat == null)
      beat = 0;
    this.cursor_pos.measure = measure;
    this.cursor_pos.beat = beat;
    this.display();
  }
  moveCursor(measure, beat) {
    // if(!this.editing)
      // throw 'Not in editing mode';
    if(measure) {
      this.cursor_pos.measure += measure;
      this.cursor_pos.beat = 0;
    }
    if(beat) {
      this.cursor_pos.beat += beat;
      while(this.measures[this.cursor_pos.measure] && this.cursor_pos.beat >= this.measures[this.cursor_pos.measure].length) {
        this.cursor_pos.beat -= this.measures[this.cursor_pos.measure].length;
        this.cursor_pos.measure ++;
      }
      while(this.cursor_pos.beat < 0 && this.measures[this.cursor_pos.measure - 1]) {
        this.cursor_pos.measure --;
        this.cursor_pos.beat += this.measures[this.cursor_pos.measure].length;
      }
    }
    if(this.cursor_pos.measure < 0 || this.cursor_pos.measure >= this.measures.length) {
      this.cursor_pos.measure = this.measures.length - 1;
      this.cursor_pos.beat = 0;
    }
    if(this.cursor_pos.beat < 0 || this.cursor_pos.beat >= this.measures[this.cursor_pos.measure].length)
      this.cursor_pos.beat = 0;
    this.display();
  }
  delChord(pos) {
    // if(!this.editing)
      // throw 'Not in editing mode';
    pos = pos || this.cursor_pos;
    if(pos instanceof Array){
      pos.map(p=>this.delChord(p))
      return;
    }
    var measure = this.measures[pos.measure];
    var chord_i = measure.chords.findIndex(c=>c.pos == pos.beat);
    if(chord_i >= 0) {
      measure.chords.splice(chord_i,1);
    }
    this.display();
  }
  setChord(chord_name, mode, pos) {
    // if(!this.editing)
      // throw 'Not in editing mode';
    pos = pos || this.cursor_pos;
    if(pos instanceof Array){
      pos.map(p=>this.setChord(chord_name, mode, p));
      return;
    }
    var measure = this.measures[pos.measure];
    var chord = measure.chords.find(c=>c.pos == pos.beat);
    if(!chord) {
      measure.chords.push({
        name: chord_name,
        pos: Number(pos.beat),
      });
    } else {
      if(mode == 'append')
        chord.name = chord.name + chord_name;
      else
        chord.name = chord_name;
    }
    this.display();
  }
  display() {
    this.textarea.value = this.content_string;
    this.textarea.onchange && this.textarea.onchange();
  }
  get content_string() {
    var s = '';
    for(let [mi, m] of enumerate(this.measures)) {
      // before first chord or seg
      for(let [tag, piece] of zip(m.tags, m.pieces)) {
          if(tag == '%chord' || tag == '%seg')
              break;
          if(tag == '%newline' || tag == '%bar' || tag == '%cmd')
              s += piece;
      }
      // print chords and seg len
      var last_pos = 0;
      var positions = new Set(m.chords.map(c=>c.pos));
      if(this.editing && this.cursor_pos.measure == mi)
          positions.add(this.cursor_pos.beat);
      for(let pos of Array.from(positions).sort()) {
          var prev_seg_len = pos - last_pos;
          if(prev_seg_len > 0) {
              s += 'x' + Math.round(prev_seg_len);
          }
          var chord = m.chords.find(chord=>chord.pos == pos);
          if(this.editing && this.cursor_pos.measure == mi && this.cursor_pos.beat == pos) {
              s += `"^<${chord ? chord.name : '|'}>"`;
              // s += `"${chord.name}"`;
          } else
              s += `"${chord.name}"`;
          last_pos = pos;
      }
      // after all segs
      var prev_seg_len = m.length - last_pos;
      if(prev_seg_len > 0) {
          s += 'x' + Math.round(prev_seg_len);
      }
      var last_seg = m.tags.lastIndexOf('%seg');
      for(let [tag, piece] of zip(m.tags.slice(last_seg + 1), m.pieces.slice(last_seg + 1))) {
          if(tag == '%newline' || tag == '%bar')
              s += piece;
      }
    }
    return s;
  }
};

class ChordVoiceProxy{
  constructor(textarea){
    textarea = (typeof textarea == 'string') ? document.querySelector(textarea) : textarea;
    this._textarea = textarea;
    var str = textarea.value;

    this._parts = {};
    if(str.split(/V:.*\n/).length > 1){
      this._parts.command = str.split(/V:.*\n/)[0];
      this._parts.melody = str.split(/V:\s*melody.*\n/)[1].split(/V:.*\n/)[0];
      this._parts.chord = str.split(/V:\s*chord.*\n/)[1].split(/V:.*\n/)[0];
    }
    else{
      this._parts.command = str.match(/^(([TXMQKLSA]:|%%).*\n)+/)[0];
      this._parts.melody = str.replace(this._parts.command, '');
      this._parts.chord = getChordVoice(this._parts.melody);
    }
    this._textarea.value = this.get_reorganized_abc();
  }
  get value() {return this._parts.chord;}
  set value(v) {
    this._parts.chord = v;
    this.onchange();
  }
  onchange(){
    this._textarea.value = this.get_reorganized_abc();
    this._textarea.onchange();
  }
  get_reorganized_abc(){
    var voice_instruct = '%%staves (chord melody)';
    return [
      this._parts.command,
      (this._parts.command.includes(voice_instruct) ? '' : voice_instruct + '\n'),
      'V: melody stem=solo\n',
      this._parts.melody + (this._parts.melody.slice(-1) != '\n' ? '\n' : ''),
      'V: chord\n',
      this._parts.chord,
    ].join('');
  }
};
chord_editor_text_buffer = new ChordVoiceProxy('#abc-text');
window.chord_editor = new ChordEditor(chord_editor_text_buffer);
