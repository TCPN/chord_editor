// html utils
get = function (selector){return document.querySelector(selector);}
getAll = function (selector){return Array.from(document.querySelectorAll(selector));}
// math utils
function range(n){return Array(n).fill(0).map((v,i)=>i)};
function sum(...args){return args.reduce((p,v)=>p + v, 0)};
function accum(array, init){
	var ret = init === undefined ? [] : [init];
	for(let v of array){
		var last = ret[ret.length - 1] || 0;
		ret.push(last + v);
	}
	return ret;
}

var song_db_address = 'https://script.google.com/macros/s/AKfycbz9hK1JFPf7YrKrK-tdRc4grD2bTFdmKWmTt47ZhmKl4f3mB8U/exec';

var abc_textarea_elem_id = 'abc-text';
var render_paper_elem_id = 'paper';
var editor_paper_elem_id = 'editor';
var setting_measure_divide = 'measure-divide';

//TODO
var measure_beats = 4;
var beat_unit = 1/4;
var score_unit = 1/8;

var abc_render_params = {
	responsive: 'resize',
	add_classes: true,
};
var editor_params = {
	paper_id: editor_paper_elem_id,
	abcjsParams: abc_render_params,
	indicate_changed: true,
	onchange: enable_save_btn_if_dirty,
};
var chord_editor_settings = {
	measure_split: 1,
};

var selected_spans = new Set();


function create_rect(params={}){
	var rect = document.createElementNS("http://www.w3.org/2000/svg", 'rect');
	params = Object.assign({
		'height': '20',
		'width': '20',
		'x': '20',
		'y': '20',
		'stroke': 'red',
		'stroke-width': '1',
		'stroke-opacity': '1',
		'fill': 'none',
		'fill-opacity': '0.3',
	}, params);
	for(let key in params){
		rect.setAttribute(key, params[key]);
	}
	return rect;
}

function add_to_paper(elem){ get('#'+editor_paper_elem_id).firstChild.append(elem);}

function editor_onchange(event){
	replot_chord_spans();
}

function editor_onclick(event){
	if(event.target.tagName.toLowerCase() == 'rect' && event.target.classList.contains('chord-span')){
		chord_span_onclick.call(this, event);
		event.cancelBubble = true;
		event.preventDefault();
	}
	else{
		chord_span_selection_clear();
	}
}
function chord_span_onclick(event){
	if(!event.ctrlKey){
		chord_span_selection_clear();
	}
	if(event.target.dataset.selected == 'true')
		chord_span_selection_remove(event.target);
	else
		chord_span_selection_add(event.target);
}
/// chord spans selection control
function chord_span_selection_add(elem){
	selected_spans.add(elem.dataset.pos);
	elem.dataset.selected = 'true';
}
function chord_span_selection_remove(elem){
	selected_spans.delete(elem.dataset.pos);
	elem.dataset.selected = 'false';
}
function chord_span_selection_clear(){
	selected_spans.clear();
	for(let elem of getAll('rect.chord-span')){
		elem.dataset.selected = false;
	}
}
function chord_span_get_selection(){
	return Array.from(selected_spans).map(pos=>({
		measure: Number(pos.split(',')[0]),
		beat: Number(pos.split(',')[1]) * (beat_unit / score_unit),
	}));
	// return getAll('rect.chord-span[data-selected="true"]').map(e=>({
	// 	measure: e.dataset.measure,
	// 	beat: e.dataset.span * (beat_unit / score_unit),
	// }));
}


function render_my_abc(){
	window.rendered = ABCJS.renderAbc(render_paper_elem_id, get('#'+abc_textarea_elem_id).value, abc_render_params);
}

function replot_chord_spans(){
	clear_chord_spans();
	plot_chord_spans(get_measure_divide());
}

function get_measure_divide(){
	return Number(Array.from(get('#'+setting_measure_divide).elements).find(e=>e.checked).value);
}

function clear_chord_spans(){
	getAll('rect.chord-span').forEach(e=>e.remove());
}

function plot_chord_spans(per_measure=1){
	if(!window.editor) return;

	var measure_counts = 0;
	for(var l = 0; ; l ++){
		if(!get(`.abcjs-l${l}`))
			break;
		// get measure num
		for(var m = 0; ; m ++){
			if(!get(`.abcjs-l${l}.abcjs-m${m}`))
				break;
			try{

				let span_beats = Math.round(measure_beats / per_measure);
				let beat_positions = get_beat_position(l,m).map(toBBox);
				let span_positions = range(per_measure).map(i=>{
					var start = i * span_beats;
					return group_boxes(beat_positions.slice(start, start + span_beats));
				});
				for(let i in span_positions){
					var span_box = span_positions[i];
					if(i == 0){
						var measure = get_measure_position(l,m);
						span_box.left = measure.left;
						delete span_box.width;
					}
					var rect_params = toBBox(span_box);;
					var rect = create_rect(rect_params);
					rect.classList.add('chord-span');
					rect.dataset.line = l;
					rect.dataset.measure = measure_counts + m;
					rect.dataset.span = i * span_beats;
					rect.dataset.pos = rect.dataset.measure + ',' + rect.dataset.span;
					rect.dataset.selected = selected_spans.has(rect.dataset.pos);
					add_to_paper(rect);
				}
			}
			catch(e){
				console.error(e);
			}
		}
		measure_counts += m;
	}
}

//////////////
function group_boxes(boxes){
	var top = Math.min(...boxes.map(r=>r.y));
	var bottom = Math.max(...boxes.map(r=>r.y + r.height));
	var left = Math.min(...boxes.map(r=>r.x));
	var right = Math.max(...boxes.map(r=>r.x + r.width));
	var position = {top, bottom, left, right, height: bottom - top, width: right - left};
	return position;
}
function toBBox(position){
	position = Object.assign({}, position); // clone
	if(position.x == null && position.left != null) position.x = position.left;
	if(position.y == null && position.top != null) position.y = position.top;
	if(position.height == null && position.top != null && position.bottom != null) position.height = position.bottom - position.top;
	if(position.width == null && position.left != null && position.right != null) position.width = position.right - position.left;
	return position;
}

function get_staff_lines(line, kind='long'){
	var path_array = Array.from(document.querySelectorAll('svg .abcjs-staff'));
	if(line != null)
		path_array = path_array.filter(p=>p.classList.contains(`abcjs-l` + line));
	if(kind == 'short')
		path_array = path_array.filter(p=>p.className.baseVal.match('abcjs-m'));
	if(kind == 'long')
		path_array = path_array.filter(p=>!p.className.baseVal.match('abcjs-m'));
	return path_array;
}

function get_staff_position(line){
	var staff_lines = get_staff_lines(line, kind='long');
	var line_boxes = staff_lines.map(p=>p.getBBox());
	var position = group_boxes(line_boxes);
	return position;
}

function get_measure_position(line, measure){
	var staff_pos = get_staff_position(line);
	var measure_sigs = getAll(`.abcjs-l${line}.abcjs-m${measure}.abcjs-staff-extra`);
	var measure_bars = getAll(`.abcjs-l${line}.abcjs-m${measure}.abcjs-bar`);
	var measure_notes = getAll(`.abcjs-l${line}.abcjs-m${measure}.abcjs-note`);
	var measure_rests = getAll(`.abcjs-l${line}.abcjs-m${measure}.abcjs-rest`);
	var notes_position = group_boxes(measure_notes.concat(measure_rests).map(p=>p.getBBox()));
	// left outer edge
	if(measure_sigs.length > 0){
		var left_outer = group_boxes(measure_sigs.map(p=>p.getBBox()));
	}
	else if(measure_bars.length == 2){
		var left_outer = group_boxes([measure_bars[0].getBBox()]);
	}
	else if(measure == 0){
		var staff_sigs = getAll(`.abcjs-l${line}.abcjs-staff-extra`).filter(p=>!p.className.baseVal.match('abcjs-m'));
		var left_outer = group_boxes(staff_sigs.map(p=>p.getBBox()));
	}
	else {// (measure > 0)
		var prev_bars = getAll(`.abcjs-l${line}.abcjs-m${measure - 1}.abcjs-bar`);
		var left_outer = group_boxes(prev_bars.map(p=>p.getBBox()));
	}
	// right outer edge
	var right_outer = group_boxes([measure_bars[measure_bars.length - 1].getBBox()]);
	////// debug
	// var notes_rect = create_rect(toBBox(notes_position));
	// var left_rect = create_rect(toBBox(left_outer));
	// var right_rect = create_rect(toBBox(right_outer));
	// get('#'+editor_paper_elem_id).firstChild.append(notes_rect);
	// get('#'+editor_paper_elem_id).firstChild.append(left_rect);
	// get('#'+editor_paper_elem_id).firstChild.append(right_rect);

	var position = {
		top: staff_pos.top,
		bottom: staff_pos.bottom,
		left: Math.min(left_outer.right + 5, (notes_position.left + left_outer.right) / 2),
		right: Math.max(right_outer.left - 5, (notes_position.right + right_outer.left) / 2),
	};
	return position;
}


function get_beat_position(line, measure){
	var staff_pos = get_staff_position(line);
	var measure_sigs = getAll(`.abcjs-l${line}.abcjs-m${measure}.abcjs-staff-extra`);
	var measure_bars = getAll(`.abcjs-l${line}.abcjs-m${measure}.abcjs-bar`);
	var measure_notes = getAll(`.abcjs-l${line}.abcjs-m${measure}`).filter(p=>p.classList.contains('abcjs-note') || p.classList.contains('abcjs-rest'));

	// find beats
	var num_beat = 4;
	var measure_time = 1.0;
	var beat_t = Array(num_beat).fill(0).map((v,i)=>i * measure_time / num_beat);

	// find note time boundaries
	var note_time_span = measure_notes
		.map(n=>n.className.baseVal.match(/abcjs-d\d(-\d+)?/)[0])
		.map(s=>Number(s.replace('abcjs-d', '').replace('-', '.')));
	var note_tbound = accum(note_time_span, 0);
	// var note_tbound = note_time_span.map((v,i)=>sum(...note_time_span.slice(0, i + 1)));
	// note_tbound.unshift(0);

	// compute the beat timing with notes as reference points
	var beat_on_note_offset = beat_t.map(t=>{
		var note_i = note_tbound.findIndex((v,i)=>note_tbound[i] <= t && note_tbound[i + 1] > t);
		var offset = (t - note_tbound[note_i]) / note_time_span[note_i];
		return {note_i, offset};
	});
	var beat_lefts = beat_on_note_offset.map(function({note_i, offset}){
		var note_span = get_note_visual_span(line, measure, note_i);
		return note_span.left + (offset && (offset * (note_span.right - note_span.left)));
	});
	var right_boundary = get_note_visual_span(line, measure, measure_notes.length - 1).right;

	return beat_lefts.map((left,i)=>{
		return {
			top: staff_pos.top,
			bottom: staff_pos.bottom,
			left: left,
			right: beat_lefts[i + 1] || right_boundary,
		};
	});
}

function get_note_visual_span(line, measure, note_i){
	var staff_pos = get_staff_position(line);
	var measure_sigs = getAll(`.abcjs-l${line}.abcjs-m${measure}.abcjs-staff-extra`);
	var measure_bars = getAll(`.abcjs-l${line}.abcjs-m${measure}.abcjs-bar`);
	var measure_notes = getAll(`.abcjs-l${line}.abcjs-m${measure}`).filter(p=>p.classList.contains('abcjs-note') || p.classList.contains('abcjs-rest'));
	// right outer edge
	var right_outer = group_boxes([measure_bars[measure_bars.length - 1].getBBox()]);

	var note_box = group_boxes([measure_notes[note_i].getBBox()]);
	var right_box = (note_i == measure_notes.length - 1) ? right_outer : group_boxes([measure_notes[note_i + 1].getBBox()]);
	var position = {
		top: staff_pos.top,
		bottom: staff_pos.bottom,
		left: note_box.left - 2,
		right: right_box.left - 2,
	};
	return position;
}

//////////////

async function api_load_song(target='list'){
	var url = new URL(song_db_address);
	if(target == 'list')
		var response = await fetch(song_db_address);
	else{
		url.searchParams.set('id', target);
		var response = await fetch(url.href);
	}
	return response.json();
}
async function api_save_song(song_id, abc){
  console.log('saveing', song_id, abc);
	var response = await fetch(song_db_address, {
		body: JSON.stringify({
			id: song_id,
			abc,
		}),
		method: 'POST',
	});
	return await response.text();
}
async function append_song_list(song_list){
	song_list = song_list || await api_load_song('list');
	var song_list_elem = get('#song-list');
	song_list_elem.innerHTML = '';
	for(let song of song_list){
    var option = document.createElement('option');
    Object.assign(option.dataset, song);
		option.value = song.id;
		option.innerText = song.id + '. ' + song.name;
		song_list_elem.append(option);
	}
}
function lookup_song_list(search_str){
	var song_list_elem = get('#song-list');
	for(let option of song_list_elem.children){
    if(option.innerText.match(search_str))
      return option;
	}
}
function filter_song_list(search_str){
	var song_list_elem = get('#song-list');
	for(let option of song_list_elem.children){
		option.dataset.match = !!option.innerText.match(search_str);
	}
}
function display_song(song_data){
	var abc_text = get('#abc-text');
  abc_text.value = song_data.abc;
  search_song_update();
	editor.setNotDirty();
	editor.paramChanged();
	setup_chord_editor('#abc-text');
	enable_save_btn_if_dirty();
}
function enable_save_btn_if_dirty(){
	var is_not_dirty = !editor.isDirty();
	var save_btn = get('#save-song');
	save_btn.disabled = is_not_dirty;
}
function search_song_update(){
  var song_id = get('#current-song').value;
  var found_elem = lookup_song_list(song_id);
	get('#search-song').value = (found_elem && found_elem.innerText) || song_id;
}
function search_song_onfocus(){
  var search_bar = this;
  setTimeout(()=>search_bar.select(),0);
}
async function load_song_btn_onclick(){
  await load_and_display_song();
}
async function load_and_display_song(song_id){
  if(song_id == null)
    song_id = get('#current-song').value;
  else{
    if(get('#current-song').value == song_id) return;
    get('#current-song').value = song_id;
  }
  search_song_update();

	var load_btn = get('#load-song');
	load_btn.dataset.status = 'loading';
	load_btn.disabled = true;
	try{
    var song_data = await api_load_song(song_id);
    display_song(song_data);
	}
	catch(e){
		console.log('載入失敗:' + e);
		alert('載入失敗:' + e);
	}
	finally{
		load_btn.dataset.status = 'ready';
		load_btn.disabled = false;
	}
}
async function save_song_btn_onclick(){
	var save_btn = get('#save-song');
	save_btn.dataset.status = 'saving';
	save_btn.disabled = true;
	try{
		var song_id = get('#current-song').value;
		var response = await api_save_song(song_id, get('#abc-text').value);
		console.log('已存檔', response);
		editor.setNotDirty();
		enable_save_btn_if_dirty();
	}
	catch(e){
		console.log('存檔失敗:' + e);
		alert('存檔失敗:' + e);
	}
	finally{
		save_btn.dataset.status = 'ready';
	}
}
function search_song_oninput(){
  var search_bar = this;
  if(search_bar.dataset.lock) return;
  search_bar.dataset.lock = true;
	setTimeout(()=>{
    filter_song_list(this.value);
    delete search_bar.dataset.lock;
  },0);
}
function song_list_onclick(event){
	if(event.target.value){
	  load_and_display_song(event.target.value);
  }
	this.blur();
}
function display_by_url_hash(){
	var hash_params = get_url_hash_params();
	if(hash_params.song_id){
    load_and_display_song(hash_params.song_id);
	}
}

////////////////////

editor_mutation_observer = new MutationObserver(editor_onchange);
window.addEventListener('load', function(event){
	editor_mutation_observer.observe(get('#'+editor_paper_elem_id), {childList: true});
	get('#'+editor_paper_elem_id).addEventListener('click', editor_onclick);
	get('#'+setting_measure_divide).addEventListener('change', replot_chord_spans);
	window.editor = new ABCJS.Editor(abc_textarea_elem_id, editor_params);
	get('#song-list').addEventListener('mousedown', song_list_onclick);
	get('#song-list').addEventListener('click', song_list_onclick);
	get('#search-song').addEventListener('input', search_song_oninput);
	get('#search-song').addEventListener('blur', search_song_update);
	get('#search-song').addEventListener('focus', search_song_onfocus);
	get('#load-song').addEventListener('click', load_song_btn_onclick);
	get('#save-song').addEventListener('click', save_song_btn_onclick);
	display_by_url_hash();
	setup_chord_editor('#abc-text');
})
append_song_list().then(search_song_update);
