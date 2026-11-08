const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(`${__dirname}/../index.html`, 'utf8').match(/<script>([\s\S]*?)<\/script>/)[1];
function game({saved=null, blocked=false, random=Math.random}={}) {
  let listener;
  const timers=[];
  const storage=new Map(saved===null?[]:[['maths-quest.tables',saved]]);
  const el={innerHTML:'',addEventListener:(_,fn)=>listener=fn};
  const context={document:{getElementById:()=>el,activeElement:null,querySelector:()=>null},localStorage:{getItem:k=>{if(blocked)throw Error('blocked');return storage.get(k)??null},setItem:(k,v)=>{if(blocked)throw Error('blocked');storage.set(k,v)}},Math:Object.assign(Object.create(Math),{random}),setTimeout:fn=>timers.push(fn)};
  context.globalThis=context;
  vm.runInNewContext(source.replace(/render\(\);\s*\}\)\(\);\s*$/, 'globalThis.game={state,start,answer,cardClick,render};render();})();'),context);
  return {...context.game,el,storage,flush:()=>{while(timers.length)timers.shift()()},clickTable:n=>listener({target:{closest:()=>({dataset:{table:String(n)}})}})};
}
test('all twelve times tables are available',()=>{
 const g=game();
 assert.deepEqual([...g.el.innerHTML.matchAll(/data-table="(\d+)"/g)].map(m=>+m[1]),Array.from({length:12},(_,i)=>i+1));
});
test('selection survives a new visit; last table cannot be removed',()=>{
 const g=game(); g.clickTable(12); g.clickTable(1); g.clickTable(2); g.clickTable(5); g.clickTable(12);
 assert.deepEqual(Array.from(g.state.tables),[12]);
 const restored=game({saved:g.storage.get('maths-quest.tables')});
 assert.deepEqual(Array.from(restored.state.tables),[12]);
});
test('invalid or unavailable browser storage does not break play',()=>{
 for(const saved of ['bad JSON','null','{}','[]','[0,13,"12"]'])assert.deepEqual(Array.from(game({saved}).state.tables),[1,2,5]);
 assert.deepEqual(Array.from(game({saved:'[12,12,7,999]'}).state.tables),[12,7]);
 const g=game({blocked:true});g.clickTable(12);g.start('bubble');assert.equal(g.state.screen,'play');
});
test('multiplication and memory include the full table through twelve',()=>{
 const g=game({random:()=>0.999});g.state.tables=[12];g.start('bubble');assert.equal(g.state.question.answer,144);
 g.start('memory');assert.ok(g.state.memory.cards.some(c=>c.label==='12 × 12'));
});
test('wrong answers do not score, double clicks score once, all rounds and replay work',()=>{
 for(const mode of ['bubble','dino','rocket']){
  const g=game();g.start(mode);g.answer(-1);assert.equal(g.state.stars,0);
  for(let i=0;i<5;i++){g.answer(g.state.question.answer);g.answer(g.state.question.answer);g.flush()}
  assert.equal(g.state.screen,'win');assert.equal(g.state.stars,5);
  g.start(mode);assert.equal(g.state.round,0);assert.equal(g.state.earned,0);
 }
});
test('leaving a round cancels delayed changes to a new game',()=>{
 const g=game();g.start('bubble');g.answer(g.state.question.answer);g.start('rocket');g.flush();assert.equal(g.state.round,0);assert.equal(g.state.mode,'rocket');
});
test('memory handles mismatches, locks a third card, and finishes all pairs',()=>{
 const g=game();g.start('memory');const cards=g.state.memory.cards;
 const x=cards[0],y=cards.find(c=>c.pair!==x.pair);g.cardClick(x.id);g.cardClick(y.id);g.cardClick(cards[2].id);assert.equal(g.state.memory.flipped.length,2);g.flush();assert.equal(g.state.round,0);
 for(let i=0;i<3;i++){for(const c of cards.filter(c=>c.pair===i))g.cardClick(c.id);g.flush()}
 assert.equal(g.state.screen,'win');assert.equal(g.state.stars,3);
});
