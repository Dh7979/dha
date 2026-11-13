// Local preview only: dist/mock.html = the built page plus a fake claude.ai runtime with sample rows.
import {readFileSync, writeFileSync} from 'node:fs';

const today = new Intl.DateTimeFormat('en-CA', {timeZone: 'Asia/Seoul'}).format(new Date());
const docs = {
  todos: {items: [
    {id: 'a', title: '예시: 보고서 초안', done: false, created: today, doneDate: null, due: today},
    {id: 'b', title: '예시: 운동', done: false, created: today, doneDate: null, repeat: 'daily', lastDone: today},
    {id: 'c', title: '예시: 장보기', done: false, created: '2026-01-01', doneDate: null},
  ]},
  ddays: {items: [{id: 'd', name: '예시 여행', date: '2099-01-01'}]},
  habits: {items: [
    {id: 'h', name: '예시: 물 2L', log: {[today]: true, '2026-11-13': true, '2026-11-12': true}, slot: 'morning'},
    {id: 'h2', name: '예시: 스픽', log: {[today]: 20}, slot: 'morning', timed: true, weeklyGoal: 150},
    {id: 'h3', name: '예시: 헬스', log: {}, slot: 'evening', timed: true},
  ]},
  sleep: {days: {'2026-01-01': {bed: '00:40', wake: '07:10', q: 3}}},
  budget: {monthly: 800000},
  ['expenses-2026-10']: {items: [{id: 'p1', date: '2026-10-05', amount: 420000, cat: 'living', createdAt: 1}]},
  ['expenses-' + today.slice(0, 7)]: {items: [
    {id: 'e1', date: today, amount: 12500, cat: 'food', memo: '예시 점심', createdAt: Date.now()},
    {id: 'e2', date: today, amount: 4800, cat: 'cafe', createdAt: Date.now() - 1000},
    {id: 'e3', date: today.slice(0, 8) + '01', amount: 350000, cat: 'living', memo: '예시 월세', createdAt: 1},
  ]},
  news: {date: today, generatedAt: Date.now(), categories: {economy: [
    {title: '예시 경제 뉴스 제목이 들어가는 자리', summary: '한 줄 요약 예시예요.', source: '예시일보', url: 'https://example.com'},
    {title: '두 번째 예시 뉴스', summary: '요약 예시', source: '예시뉴스', url: 'https://example.com'},
  ]}},
};
const journal = [{kind: 'journal', date: today, mood: 4, text: '예시 한 줄 일기', updatedAt: Date.now()}];
const mock = `<script>
(() => {
  const docs = ${JSON.stringify(docs)};
  const journal = ${JSON.stringify(journal)};
  const snap = (d) => ({exists: !!d, data: () => d, metadata: {fromCache: false, hasPendingWrites: false}});
  const docRef = (id) => ({onSnapshot: (n) => { setTimeout(() => n(snap(docs[id])), 50); return () => {}; }, set: async () => {}});
  const q = {where: () => q, orderBy: () => q, limit: () => q,
    onSnapshot: (n) => { setTimeout(() => n({docs: journal.map((j) => snap(j))}), 50); return () => {}; }};
  const col = Object.assign({doc: docRef}, q);
  const events = {events: [{summary: '예시 회의', location: '회의실', start: {dateTime: new Date().toISOString()}}, {summary: '예시 공휴일', start: {date: '${today}'}}]};
  const caps = {
    db: {collection: () => col},
    user: {id: async () => 'u_mock'},
    mcp: {callTool: async () => ({payload: {calendars: [{id: 'me@x.com', summary: 'me@x.com'}, {id: 'h@group.v.calendar.google.com', summary: '대한민국의 휴일'}]}}),
          watchTool: (s, t, i, h) => { setTimeout(() => h({type: 'data', result: {payload: events}}), 80); return () => {}; }},
    sample: Object.assign(async () => ({text: '예시 회고'}), {}),
  };
  window.claude = {use: async (n) => caps[n] || null};
})();
</script>`;
const html = readFileSync(new URL('../dist/index.html', import.meta.url), 'utf8').replace('<head>', '<head>' + mock);
writeFileSync(new URL('../dist/mock.html', import.meta.url), html);
console.log('wrote dist/mock.html');
