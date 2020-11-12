function iter(iterable) {
  return iterable[Symbol.iterator]();
}

function* enumerate(iterable, start=0) {
  var i = start;
  for(let v of iterable)
    yield [i++, v];
}

function* repeat(iterable, count=null) {
  console.assert(Array.from(iterable).length > 0);
  while(count == null || --count >= 0)
    for(let v of iterable)
      yield v;
}

function* concat(...iterables) {
  for(let it of iterables)
    for(let v of it)
      yield v;
}

function* zip(...iterables) {
  var iters = iterables.map(i=>iter(i));
  while(true) {
    var outputs = iters.map(i=>i.next());
    var done = outputs.map(o=>o.done).some(v=>v);
    if(done) return;
    yield outputs.map(o=>o.value);
  }
}


function get_zip_longest_with_fill(fill){
  function* _zip_longest(...iterables) {
    var iters = iterables.map(i=>iter(i));
    while(true) {
      var outputs = iters.map((it,i)=>{
        if(it == null) {
          return {value: fill, done: true};
        }
        var {value, done} = it.next();
        if(done) {
          iters[i] = null;
          return {value: fill, done: true};
        }
        return {value, done};
      });
      var all_done = outputs.map(o=>o.done).every(v=>v);
      if(all_done) return;
      yield outputs.map(o=>o.value);
    }
  }
  return _zip_longest;
}

zip_longest = get_zip_longest_with_fill(null);

function* interleave(...iterables){
  var iters = iterables.map(i=>iter(i));
  while(true)
    for(let it of iters) {
      var {value, done} = it.next();
      if(done) return;
      yield value;
    }
}

function* weave(keys, dict){
  for(let key in dict) {
    console.log(key);
    dict[key] = iter(dict[key]);
  }
  for(let key of keys) {
    var {value, done} = dict[key].next();
    if(done) return;
    yield value;
  }
}

function gcd(a,b) {
    a = Math.abs(a);
    b = Math.abs(b);
    if (b > a) {var temp = a; a = b; b = temp;}
    while (true) {
        if (b == 0) return a;
        a %= b;
        if (a == 0) return b;
        b %= a;
    }
}
async function timeout(time_length=0){
  return new Promise((ok)=>{
    setTimeout(()=>{
      ok();
    }, time_length);
  });
}
