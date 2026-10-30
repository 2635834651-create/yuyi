// 酒馆阅读助手 v15.4 - 自然段点击定位与正文过滤
// 作为 SillyTavern/TauriTavern UI 扩展运行，不是酒馆助手隔离全局脚本。
(() => {
  'use strict';
  const ID = 'mimo-reader-v15';
  const STYLE_ID = ID + '-style';
  const KEY = 'mimo_reader_v15_settings';
  if (window.__mimoReaderV15?.destroy) window.__mimoReaderV15.destroy();

  const defaults = { speed: 1, pitch: 1, volume: 1, subtitles: true, highlight: true,
    autoScroll: true, bubbleX: null, bubbleY: '22%', subtitleX: null, subtitleY: '78%' };
  let settings;
  try { settings = { ...defaults, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; }
  catch { settings = { ...defaults }; }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch {} };
  const state = { playing:false, paused:false, destroyed:false, queue:[], index:0, generation:0, ui:{} };
  const synth = window.speechSynthesis;
  const Utterance = window.SpeechSynthesisUtterance;
  const icons = {
    headphones:'<path d="M3 14v-3a9 9 0 0 1 18 0v3"/><rect x="3" y="13" width="4" height="7" rx="2"/><rect x="17" y="13" width="4" height="7" rx="2"/>',
    play:'<path d="m8 5 12 7-12 7z"/>', pause:'<path d="M8 5h3v14H8zM15 5h3v14h-3z"/>',
    stop:'<rect x="6" y="6" width="12" height="12" rx="2"/>', prev:'<path d="M6 5v14M19 5l-10 7 10 7z"/>',
    next:'<path d="M18 5v14M5 5l10 7-10 7z"/>', close:'<path d="m6 6 12 12M18 6 6 18"/>'
  };
  const icon = n => `<svg viewBox="0 0 24 24" aria-hidden="true">${icons[n] || ''}</svg>`;
  const css = `
#${ID}{--bg:rgba(19,20,31,.94);--card:rgba(255,255,255,.065);--line:rgba(255,255,255,.14);--txt:#f3f0ff;--muted:#aaa8bf;--orange:#ffad70;--purple:#a78bfa;color:var(--txt);font:14px/1.5 system-ui,-apple-system,sans-serif;color-scheme:dark}
#${ID} *{box-sizing:border-box}#${ID} button,#${ID} input{font:inherit;color:inherit}
#${ID} .glass{background:var(--bg);border:1px solid var(--line);box-shadow:0 18px 60px #0005,inset 0 1px #ffffff0d;backdrop-filter:blur(24px) saturate(145%);-webkit-backdrop-filter:blur(24px) saturate(145%)}
#${ID} .bubble{position:fixed;z-index:2147483000;width:58px;height:58px;border-radius:22px;display:grid;place-items:center;border:1px solid #ffffff38;background:linear-gradient(145deg,#c4a6ff,#8967ee 55%,#6d5bd0);box-shadow:0 8px 28px #785ce159;cursor:grab;user-select:none;touch-action:none}
#${ID} .bubble svg{width:27px;height:27px}#${ID} .bubble.active:after{content:"";position:absolute;inset:-5px;border:1px solid #a78bfa77;border-radius:26px;animation:mimoPulse 2.1s ease-out infinite;pointer-events:none}
#${ID} .panel{position:fixed;z-index:2147482999;width:min(360px,calc(100vw - 24px));height:410px;overflow:hidden;border-radius:24px;padding:18px;transform:translateY(8px) scale(.98);opacity:0;visibility:hidden;pointer-events:none;transition:opacity .2s,transform .2s,visibility .2s}
#${ID} .panel.open{transform:none;opacity:1;visibility:visible;pointer-events:auto}
#${ID} .top,#${ID} .row{display:flex;align-items:center;justify-content:space-between;gap:10px}#${ID} .top{margin-bottom:16px}
#${ID} .brand{display:flex;align-items:center;gap:10px}.logo{width:36px;height:36px;display:grid;place-items:center;border-radius:13px;background:linear-gradient(145deg,#b99bff,#8062dc)}
#${ID} .title{font-weight:700}.muted{color:var(--muted);font-size:12px}
#${ID} .iconbtn,#${ID} .control{border:1px solid var(--line);background:var(--card);display:grid;place-items:center;cursor:pointer}
#${ID} .iconbtn{width:34px;height:34px;border-radius:12px}#${ID} .control{width:42px;height:42px;border-radius:15px}
#${ID} svg{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
#${ID} .now{padding:13px;border:1px solid var(--line);background:linear-gradient(135deg,#a78bfa1f,#ffad7012);border-radius:17px;margin-bottom:14px;height:88px;overflow:hidden}
#${ID} .nowlabel{color:var(--muted);font-size:11px;margin-bottom:6px}#${ID} .nowtext{font-size:13px;line-height:1.7;overflow-wrap:anywhere;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
#${ID} .controls{display:flex;justify-content:center;align-items:center;gap:12px}#${ID} .primary{width:52px;height:52px;border:0;border-radius:18px;color:#241b35;background:linear-gradient(140deg,#ffcfaa,#ffa66e)}
#${ID} .primary svg{width:22px;height:22px}#${ID} .progress{margin:15px 0 7px}#${ID} .track{height:4px;border-radius:10px;background:#ffffff1f;overflow:hidden}#${ID} .fill{height:100%;width:0;background:linear-gradient(90deg,var(--purple),var(--orange))}
#${ID} .progressText{display:flex;justify-content:space-between;color:var(--muted);font-size:11px;margin-top:7px}
#${ID} .setting{border-top:1px solid var(--line);margin-top:14px;padding-top:13px}#${ID} .setting label{display:flex;align-items:center;justify-content:space-between;gap:12px;color:var(--muted);font-size:12px}#${ID} input[type=range]{width:130px;accent-color:var(--purple)}
#${ID} .toggles{display:flex;gap:7px;margin-top:12px}#${ID} .chip{flex:1;padding:8px 3px;border-radius:12px;border:1px solid var(--line);background:var(--card);color:var(--muted);font-size:11px;cursor:pointer}#${ID} .chip.on{color:#e6dfff;border-color:#a78bfa77;background:#a78bfa24}
#${ID} .status{color:var(--muted);font-size:11px;margin-top:12px;min-height:17px}
#${ID} .caption{position:fixed;z-index:2147482998;width:min(440px,calc(100vw - 24px));min-height:88px;max-height:150px;overflow:hidden;padding:14px 17px;border-radius:18px;cursor:grab;touch-action:none;user-select:none}
#${ID} .caption[hidden]{display:none}#${ID} .captionhead{color:var(--muted);font-size:11px;margin-bottom:6px}#${ID} .captiontext{font-size:15px;line-height:1.75;overflow-wrap:anywhere;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
::highlight(mimoReaderV15){color:#d85a55;background:transparent;text-decoration:none}
@keyframes mimoPulse{0%{transform:scale(.97);opacity:.7}100%{transform:scale(1.2);opacity:0}}
`;
  function addStyle(){document.getElementById(STYLE_ID)?.remove();const s=document.createElement('style');s.id=STYLE_ID;s.textContent=css;document.head.appendChild(s);}
  function createUI(){
    document.getElementById(ID)?.remove();
    const root=document.createElement('div');root.id=ID;
    root.innerHTML=`<button class="bubble" aria-label="打开阅读助手">${icon('headphones')}</button>
    <section class="panel glass" aria-label="阅读助手控制面板">
      <div class="top"><div class="brand"><div class="logo">${icon('headphones')}</div><div><div class="title">阅读助手</div><div class="muted">IMMERSIVE READER · V15.4</div></div></div><button class="iconbtn close" aria-label="关闭">${icon('close')}</button></div>
      <div class="now"><div class="nowlabel">正在朗读</div><div class="nowtext">点击播放，开始阅读当前 AI 回复。</div></div>
      <div class="controls"><button class="control prev" title="上一句">${icon('prev')}</button><button class="control primary play" title="播放">${icon('play')}</button><button class="control next" title="下一句">${icon('next')}</button><button class="control stop" title="停止">${icon('stop')}</button></div>
      <div class="progress"><div class="track"><div class="fill"></div></div><div class="progressText"><span class="count">未开始</span><span class="speedLabel">语速 1.0×</span></div></div>
      <div class="setting"><label><span>朗读速度</span><input class="speed" type="range" min=".6" max="5" step=".1"></label>
      <div class="toggles"><button class="chip sub">字幕：开</button><button class="chip high">高亮：开</button><button class="chip scroll">跟随：开</button></div></div>
      <div class="status" role="status">就绪 · 等待开始</div>
    </section>
    <div class="caption glass"><div class="captionhead">正在跟读</div><div class="captiontext">字幕将在朗读时显示</div></div>`;
    document.body.appendChild(root);
    const $=s=>root.querySelector(s);
    state.ui={root,bubble:$('.bubble'),panel:$('.panel'),close:$('.close'),play:$('.play'),prev:$('.prev'),next:$('.next'),stop:$('.stop'),now:$('.nowtext'),fill:$('.fill'),count:$('.count'),speed:$('.speed'),speedLabel:$('.speedLabel'),status:$('.status'),caption:$('.caption'),captionText:$('.captiontext'),sub:$('.sub'),high:$('.high'),scroll:$('.scroll')};
    state.ui.speed.value=String(settings.speed); restorePositions(); updateToggles(); bindUI();
  }
  const status=t=>{if(state.ui.status)state.ui.status.textContent=t;};
  function updateToggles(){const u=state.ui;u.sub.textContent=`字幕：${settings.subtitles?'开':'关'}`;u.high.textContent=`高亮：${settings.highlight?'开':'关'}`;u.scroll.textContent=`跟随：${settings.autoScroll?'开':'关'}`;u.sub.classList.toggle('on',settings.subtitles);u.high.classList.toggle('on',settings.highlight);u.scroll.classList.toggle('on',settings.autoScroll);u.caption.hidden=!settings.subtitles;u.speedLabel.textContent=`语速 ${Number(settings.speed).toFixed(1)}×`;}
  function bindUI(){const u=state.ui;
    u.bubble.addEventListener('click',()=>{u.panel.classList.toggle('open');if(u.panel.classList.contains('open'))positionPanel();});
    u.close.onclick=()=>u.panel.classList.remove('open');u.play.onclick=playPause;u.prev.onclick=()=>jump(-1);u.next.onclick=()=>jump(1);u.stop.onclick=stop;
    u.speed.addEventListener('input',()=>{settings.speed=+u.speed.value;save();updateToggles();});
    u.sub.onclick=()=>{settings.subtitles=!settings.subtitles;save();updateToggles();};
    u.high.onclick=()=>{settings.highlight=!settings.highlight;clearHighlight();save();updateToggles();if(settings.highlight)highlight();};
    u.scroll.onclick=()=>{settings.autoScroll=!settings.autoScroll;save();updateToggles();};
    draggable(u.bubble,'bubble');draggable(u.caption,'subtitle');
  }
  function positionPanel(){const b=state.ui.bubble.getBoundingClientRect(),w=Math.min(360,innerWidth-24),h=Math.min(410,innerHeight-24);let x=b.left+b.width-w,y=b.bottom+10;if(y+h>innerHeight)y=b.top-h-10;x=Math.max(12,Math.min(x,innerWidth-w-12));y=Math.max(12,Math.min(y,innerHeight-h-12));Object.assign(state.ui.panel.style,{left:x+'px',top:y+'px',right:'auto',bottom:'auto'});}
  function draggable(el,kind){let sx=0,sy=0,ox=0,oy=0,moved=false;
    el.addEventListener('pointerdown',e=>{if(e.button!==undefined&&e.button!==0)return;if(e.target.closest('button')&&kind!=='bubble')return;const r=el.getBoundingClientRect();sx=e.clientX;sy=e.clientY;ox=r.left;oy=r.top;moved=false;try{el.setPointerCapture(e.pointerId)}catch{}el.dataset.drag='1';});
    el.addEventListener('pointermove',e=>{if(el.dataset.drag!=='1')return;const dx=e.clientX-sx,dy=e.clientY-sy;if(Math.abs(dx)+Math.abs(dy)>4)moved=true;if(!moved)return;const r=el.getBoundingClientRect();Object.assign(el.style,{left:Math.max(4,Math.min(ox+dx,innerWidth-r.width-4))+'px',top:Math.max(4,Math.min(oy+dy,innerHeight-r.height-4))+'px',right:'auto',bottom:'auto'});});
    const end=()=>{if(el.dataset.drag!=='1')return;delete el.dataset.drag;const r=el.getBoundingClientRect();if(kind==='bubble'){settings.bubbleX=r.left+'px';settings.bubbleY=r.top+'px'}else{settings.subtitleX=r.left+'px';settings.subtitleY=r.top+'px'}save();};
    el.addEventListener('pointerup',end);el.addEventListener('pointercancel',end);
  }
  function setPos(el,x,y,side){if(x){el.style.left=x;el.style.right='auto'}else{el.style.left=side==='left'?'auto':'12px';el.style.right=side==='left'?'12px':'auto'}el.style.top=y||'22%';}
  function restorePositions(){setPos(state.ui.bubble,settings.bubbleX,settings.bubbleY,'left');setPos(state.ui.caption,settings.subtitleX,settings.subtitleY,'left');}
  function visible(el){if(!(el instanceof Element)||el.closest('script,style,textarea,input,[hidden],[aria-hidden="true"],.mes_reasoning,.reasoning,.thoughts,.thinking,.mes_thoughts,.extraMesButtons,.mes_buttons,.mes_edit_buttons'))return false;const s=getComputedStyle(el);return s.display!=='none'&&s.visibility!=='hidden'&&+s.opacity!==0;}
  function buildQueue(){const out=[];document.querySelectorAll('.mes').forEach(msg=>{if(!visible(msg)||msg.classList.contains('mes_user')||msg.classList.contains('mes_system')||msg.matches('[is_user="true"],[data-is-user="true"]'))return;const body=msg.querySelector('.mes_text');if(!body)return;const clone=body.cloneNode(true);clone.querySelectorAll('script,style,textarea,input,[hidden],[aria-hidden="true"],.mes_reasoning,.reasoning,.thoughts,.thinking,.mes_thoughts,.extraMesButtons,.mes_buttons,.mes_edit_buttons').forEach(n=>n.remove());const raw=(clone.innerText||clone.textContent||'').replace(/\r\n?/g,'\n').replace(/\n{3,}/g,'\n\n').trim();const text=clean(raw);if(!text)return;const sentences=splitSentences(text);sentences.forEach(s=>{s=s.trim();if(s)out.push({text:s,message:msg,body,source:raw});});});return out;}
  function splitSentences(text){
    // 统一按标点切分；不把长段落拆成随机长短的片段。
    const out=[];
    String(text||'').split(/\n+/).forEach(paragraph=>{
      const p=paragraph.trim(); if(!p)return;
      const parts=p.match(/[^。！？!?；;…]+(?:[。！？!?；;…]+|$)/g)||[p];
      parts.forEach(part=>{const s=part.trim();if(s)out.push(s);});
    });
    return out;
  }
  function clean(t){return String(t||'').replace(/```[\s\S]*?```/g,' ').replace(/!\[[^\]]*]\([^)]*\)/g,' ').replace(/\[([^\]]+)]\([^)]*\)/g,'$1').replace(/https?:\/\/\S+/g,' ').replace(/[ \t]+\n/g,'\n').replace(/\n{3,}/g,'\n\n').replace(/[ \t]{2,}/g,' ').trim();}
  function topIndex(q){const c=innerHeight*.45;let best=0,d=Infinity;q.forEach((it,i)=>{const r=it.message.getBoundingClientRect();if(r.bottom<0||r.top>innerHeight)return;const n=Math.abs(r.top-c);if(n<d){d=n;best=i}});return best;}
  const SKIP_READER = 'script,style,template,noscript,textarea,input,select,option,button,iframe,svg,canvas,video,audio,pre,code,[hidden],[aria-hidden="true"],[inert],.mes_reasoning,.reasoning,.thoughts,.thinking,.mes_thoughts,.extraMesButtons,.mes_buttons,.mes_edit_buttons';
  function excludedContent(el){
    if(!(el instanceof Element))return true;
    if(el.closest('#'+ID+','+SKIP_READER))return true;
    const tag=el.tagName.toLowerCase();
    if(tag.includes('-') || el.matches('[contenteditable="true"],[data-html],[data-raw-html],.html,.html-block,.rendered-html,.mes_html,.code-block,.language-html,.language-javascript'))return true;
    const s=getComputedStyle(el);
    return s.display==='none'||s.visibility==='hidden'||s.visibility==='collapse'||+s.opacity===0;
  }
  function flattenBody(body){
    const chars=[], map=[];
    function sep(){if(chars.length&&chars[chars.length-1]!=='\n'){chars.push('\n');map.push(null)}}
    function walk(node){
      if(node.nodeType===Node.TEXT_NODE){
        const value=node.nodeValue||'';
        for(let i=0;i<value.length;i++){chars.push(value[i]);map.push({node,offset:i})}
        return;
      }
      if(node.nodeType!==Node.ELEMENT_NODE)return;
      const el=node;
      if(el!==body&&excludedContent(el))return;
      const block=el!==body&&(/^(P|DIV|SECTION|ARTICLE|BLOCKQUOTE|LI|H[1-6]|UL|OL)$/.test(el.tagName));
      if(block)sep();
      if(el.tagName==='BR'){sep();return;}
      for(const child of el.childNodes)walk(child);
      if(block)sep();
    }
    walk(body);
    while(chars.length&&chars[chars.length-1]==='\n'){chars.pop();map.pop()}
    return {text:chars.join(''),map};
  }
  function paragraphAt(flat, clickNode, clickOffset){
    let clicked=-1;
    for(let i=0;i<flat.map.length;i++){const m=flat.map[i];if(m&&m.node===clickNode&&clickOffset>=m.offset&&clickOffset<=m.offset+1){clicked=i;break}}
    if(clicked<0)return null;
    const text=flat.text;
    // Paragraph boundaries: rendered block/BR line breaks, or the traditional two-space first-line indent.
    const bounds=[0];
    for(let i=0;i<text.length;i++){
      if(text[i]==='\n')bounds.push(i+1);
      else if(i>0&&(text[i]==='　'&&text[i-1]==='　'||text[i]===' '&&text[i-1]===' '))bounds.push(i-1);
    }
    bounds.push(text.length);
    let a=0,b=text.length;
    for(let i=0;i<bounds.length-1;i++){const x=bounds[i],y=bounds[i+1];if(clicked>=x&&clicked<y){a=x;b=y;break}}
    while(a<b&&/[\\s　]/.test(text[a]))a++;
    while(b>a&&/[\\s　]/.test(text[b-1]))b--;
    if(a>=b)return null;
    const range=document.createRange();
    let first=null,last=null;
    for(let i=a;i<b;i++){const m=flat.map[i];if(!m)continue;if(!first)first=m;last=m}
    if(!first||!last)return null;
    try{range.setStart(first.node,first.offset);range.setEnd(last.node,last.offset+1)}catch{return null}
    return {text:text.slice(a,b).replace(/\n/g,' ').replace(/[　 ]{2,}/g,' ').trim(),range};
  }
  function readParagraphFromElement(target,x,y){
    const body=target?.closest('.mes_text');
    if(!body)return false;
    const msg=body.closest('.mes');
    if(!msg||!visible(msg)||msg.classList.contains('mes_user')||msg.classList.contains('mes_system')||msg.matches('[is_user="true"],[data-is-user="true"]'))return false;
    let caret=null;
    try{caret=document.caretRangeFromPoint?.(x,y)||null;}catch{}
    if(!caret){try{const p=document.caretPositionFromPoint?.(x,y);if(p){caret=document.createRange();caret.setStart(p.offsetNode,p.offset);caret.collapse(true)}}catch{}}
    if(!caret||!body.contains(caret.startContainer))return false;
    const flat=flattenBody(body);
    const paragraph=paragraphAt(flat,caret.startContainer,caret.startOffset);
    if(!paragraph?.text)return false;
    const parts=splitSentences(paragraph.text);
    if(!parts.length)return false;
    state.queue=parts.map(s=>({text:s,message:msg,body,source:paragraph.text,range:paragraph.range}));
    state.index=0;state.playing=true;state.paused=false;state.generation++;
    status('已定位到所点自然段');render();highlight();speak(state.generation);buttonState();
    return true;
  }
  function playPause(){if(!synth||!Utterance)return status('当前环境不支持浏览器语音合成');if(state.playing&&!state.paused)return pause();if(state.paused)return resume();state.queue=buildQueue();state.index=topIndex(state.queue);if(!state.queue.length)return status('没有找到可朗读的 AI 正文');state.playing=true;state.paused=false;state.generation++;speak(state.generation);buttonState();}
  function speak(gen){if(state.destroyed||gen!==state.generation||!state.playing||state.paused)return;if(state.index>=state.queue.length){stop();status('本轮内容已读完');return;}const it=state.queue[state.index];if(!it?.text){state.index++;return speak(gen)}try{synth.cancel();const u=new Utterance(it.text);u.lang='zh-CN';u.rate=+settings.speed||1;u.pitch=+settings.pitch||1;u.volume=+settings.volume||1;state.utterance=u;state.activeMessage=it.message;
    u.onstart=()=>{if(gen!==state.generation)return;status('正在朗读');render();highlight();if(settings.autoScroll)scrollMsg(it.message)};
    u.onend=()=>{if(gen!==state.generation||state.paused)return;state.index++;render();speak(gen)};
    u.onerror=e=>{if(gen!==state.generation||['canceled','interrupted'].includes(e.error))return;status('语音异常：'+(e.error||'unknown'));state.index++;if(state.index<state.queue.length)speak(gen)};
    u.onboundary=e=>{if(gen===state.generation&&typeof e.charIndex==='number')render(e.charIndex)};
    synth.speak(u);render();buttonState();
  }catch(e){console.error('[阅读助手]',e);status('朗读启动失败，请重新播放')}}
  function pause(){state.paused=true;state.generation++;try{synth.cancel()}catch{}clearHighlight();status('已暂停 · 继续时从当前句重新开始');buttonState();}
  function resume(){if(!state.queue.length){state.paused=false;state.playing=false;return playPause()}state.paused=false;state.playing=true;state.generation++;speak(state.generation);buttonState();}
  function stop(){state.generation++;state.playing=false;state.paused=false;state.utterance=null;state.activeMessage=null;try{synth?.cancel()}catch{}clearHighlight();state.queue=[];state.index=0;render();buttonState();status('已停止');}
  function jump(d){if(!state.queue.length){state.queue=buildQueue();if(!state.queue.length)return status('没有找到可朗读的正文');state.index=topIndex(state.queue)}else state.index=Math.max(0,Math.min(state.queue.length-1,state.index+d));state.playing=true;state.paused=false;state.generation++;speak(state.generation);buttonState();}
  function buttonState(){const u=state.ui;if(!u.play)return;u.play.innerHTML=state.playing&&!state.paused?icon('pause'):icon('play');u.bubble.classList.toggle('active',state.playing&&!state.paused);}
  function render(){const u=state.ui;if(!u.root)return;const it=state.queue[state.index],t=it?.text||'点击播放，开始阅读当前 AI 回复。';u.now.textContent=t;u.captionText.textContent=t;u.caption.hidden=!settings.subtitles;if(state.queue.length){u.count.textContent=`${Math.min(state.index+1,state.queue.length)} / ${state.queue.length}`;u.fill.style.width=((state.index+1)/state.queue.length*100)+'%'}else{u.count.textContent='未开始';u.fill.style.width='0%'}}
  function scrollMsg(msg){if(!msg?.isConnected)return;try{msg.scrollIntoView({behavior:'smooth',block:'center'})}catch{}}
  const HNAME='mimoReaderV15';let mark=null;
  function clearHighlight(){try{window.CSS?.highlights?.delete(HNAME)}catch{}if(mark?.parentNode){const p=mark.parentNode;p.replaceChild(document.createTextNode(mark.textContent||''),mark);p.normalize()}mark=null;}
  function highlight(){
    clearHighlight();if(!settings.highlight)return;
    const it=state.queue[state.index];if(!it?.body?.isConnected||!it.text)return;
    try{
      if(it.range&&it.range.startContainer?.isConnected&&window.CSS?.highlights&&window.Highlight){
        CSS.highlights.set(HNAME,new Highlight(it.range.cloneRange()));return;
      }
      const walker=document.createTreeWalker(it.body,NodeFilter.SHOW_TEXT,{acceptNode(n){
        if(!n.nodeValue?.length||excludedContent(n.parentElement))return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }});
      const chars=[];let n;while(n=walker.nextNode())for(let i=0;i<n.nodeValue.length;i++)chars.push({ch:n.nodeValue[i],node:n,offset:i});
      const hay=chars.map(x=>x.ch).join(''),p=hay.indexOf(it.text);if(p<0)return;
      const first=chars[p],last=chars[p+it.text.length-1];if(!first||!last)return;
      const r=document.createRange();r.setStart(first.node,first.offset);r.setEnd(last.node,last.offset+1);
      if(window.CSS?.highlights&&window.Highlight)CSS.highlights.set(HNAME,new Highlight(r));
      else{const markEl=document.createElement('span');markEl.style.cssText='color:#d85a55!important;background:transparent!important;';r.surroundContents(markEl);mark=markEl;}
    }catch(e){console.debug('[阅读助手] 高亮失败',e)}
  }
  function resize(){for(const el of [state.ui.bubble,state.ui.caption]){if(!el)return;const r=el.getBoundingClientRect();Object.assign(el.style,{left:Math.max(4,Math.min(r.left,innerWidth-r.width-4))+'px',top:Math.max(4,Math.min(r.top,innerHeight-r.height-4))+'px',right:'auto',bottom:'auto'});}}
  function onDoubleClick(e){if(e.target.closest('#'+ID))return;const body=e.target.closest('.mes_text');if(!body)return;e.preventDefault();e.stopPropagation();readParagraphFromElement(e.target,e.clientX,e.clientY);}
  function visibility(){if(document.hidden&&state.playing&&!state.paused)status('页面已切到后台 · 播放状态由浏览器决定');}
  function destroy(){if(state.destroyed)return;state.destroyed=true;state.generation++;try{synth?.cancel()}catch{}clearHighlight();window.removeEventListener('resize',resize);document.removeEventListener('visibilitychange',visibility);document.removeEventListener('dblclick',onDoubleClick,true);document.getElementById(ID)?.remove();document.getElementById(STYLE_ID)?.remove();try{window.CSS?.highlights?.delete(HNAME)}catch{}}
  function init(){addStyle();createUI();window.addEventListener('resize',resize);document.addEventListener('visibilitychange',visibility);document.addEventListener('dblclick',onDoubleClick,true);window.__mimoReaderV15={destroy,stop,play:playPause,version:'15.4'};console.info('[阅读助手] v15.4 主页面扩展已初始化');}
  init();
})();
