
get = document.querySelector.bind(document);
getAll = document.querySelectorAll.bind(document);

var abc_textarea_elem_id = 'abc-text';
var render_paper_elem_id = 'paper';
var editor_paper_elem_id = 'editor';


var abc_render_params = {
	responsive: 'resize',
};
var editor_params = {
	paper_id: editor_paper_elem_id,
	abcjsParams: abc_render_params,
};
var chord_editor_settings = {
	measure_split: 1,
};


function editor_onchange(event){
	var paper = get('#'+editor_paper_elem_id);
	var paper_svg = paper.firstChild;
	var rect = document.createElementNS("http://www.w3.org/2000/svg", 'rect');
	rect.setAttribute('height', '20');
	rect.setAttribute('width', '20');
	rect.setAttribute('x', '20');
	rect.setAttribute('y', '20');
	rect.setAttribute('stroke', 'red');
	rect.setAttribute('stroke-width', '1');
	rect.setAttribute('stroke-opacity', '1');
	rect.setAttribute('fill', 'none');
	rect.setAttribute('fill-opacity', '0.3');
	paper_svg.append(rect);
}

function render_my_abc(){
	ABCJS.renderAbc(render_paper_elem_id, get('#'+abc_textarea_elem_id).value, abc_render_params);
}


editor_mutation_observer = new MutationObserver(editor_onchange);
window.addEventListener('load', function(event){
	editor_mutation_observer.observe(get('#'+editor_paper_elem_id), {childList: true});
	window.editor = new ABCJS.Editor(abc_textarea_elem_id, editor_params);
})
