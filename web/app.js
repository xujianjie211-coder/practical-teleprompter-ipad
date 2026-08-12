const STORAGE_KEY = 'practical_teleprompter_documents'
const SETTINGS_KEY = 'practical_teleprompter_settings_v2'
const POSITIONS_KEY = 'practical_teleprompter_positions'
const app = document.querySelector('#app')
const toastElement = document.querySelector('#toast')
let installPromptEvent = null
let screenWakeLock = null

const defaultSettings = {
  dark: true, speed: 24, fontSize: 46,
  guideLine: true, outlineMode: false, mirror: false
}

const state = {
  view: 'home', editingId: null, activeDocument: null, paragraphs: [],
  ...defaultSettings, playing: false, offset: 0, maxOffset: 0,
  animationFrame: 0, lastFrame: 0, lastUiAt: 0, savePositionAt: 0,
  dragging: false, dragMoved: false, dragX: 0, dragY: 0,
  dragOffset: 0, resumeAfterDrag: false,
  controlsHidden: false, controlsTimer: 0, tapTimer: 0, lastTapAt: 0
}

function readJSON(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback } catch { return fallback }
}
function writeJSON(key, value) { localStorage.setItem(key, JSON.stringify(value)) }
function loadSettings() { Object.assign(state, defaultSettings, readJSON(SETTINGS_KEY, {})) }
function saveSettings() {
  writeJSON(SETTINGS_KEY, {
    dark: state.dark, speed: state.speed, fontSize: state.fontSize,
    guideLine: state.guideLine, outlineMode: state.outlineMode, mirror: state.mirror
  })
}
function getDocuments() { const value = readJSON(STORAGE_KEY, []); return Array.isArray(value) ? value : [] }
function saveDocuments(documents) { writeJSON(STORAGE_KEY, documents) }
function escapeHtml(value = '') { return String(value).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])) }
function formatTime(timestamp) { return new Intl.DateTimeFormat('zh-CN',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(timestamp).replaceAll('/','-') }
function toast(message) { toastElement.textContent=message; toastElement.classList.add('show'); clearTimeout(toast.timer); toast.timer=setTimeout(()=>toastElement.classList.remove('show'),1600) }
function splitParagraphs(content) { return content.split(/\n\s*\n+/).map(p=>p.trim()).filter(Boolean) }
function firstSentence(text) {
  if (/^#\s*/.test(text)) return text.replace(/^#\s*/, '')
  const match=text.match(/^.*?[。！？!?；;](?:[”’」』])?/) 
  return (match ? match[0] : text).trim()
}
function cleanText(text) {
  return text.replace(/\r\n/g,'\n').replace(/[ \t]+/g,' ').replace(/ *\n */g,'\n').replace(/\n{3,}/g,'\n\n').trim()
}
function isStandaloneApp() { return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true }
function isNativeApp() { return window.__TELEPROMPTER_NATIVE_APP__ === true }
function postNativeMessage(action, payload={}) {
  const handler=window.webkit?.messageHandlers?.nativeApp
  if(!handler)return false
  handler.postMessage({action,...payload})
  return true
}
function isAppleMobile() { return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) }
function installCard() {
  if(isStandaloneApp()||isNativeApp())return ''
  return `<button class="install-card" data-action="install-app"><span class="install-icon">⇩</span><span><strong>安装到 iPad，断网也能用</strong><small>添加到主屏幕后，就像普通软件一样打开</small></span><span class="install-arrow">›</span></button>`
}
function showInstallHelp() {
  document.querySelector('.install-help')?.remove()
  const apple=isAppleMobile()
  document.body.insertAdjacentHTML('beforeend',`<div class="install-help" role="dialog" aria-modal="true"><div class="install-sheet"><header><span class="install-sheet-icon">稿</span><div><strong>安装实用提词器</strong><small>安装后可全屏打开，并支持离线使用</small></div><button data-action="close-install" aria-label="关闭">×</button></header>${apple?`<ol><li><b>1</b><span>请用 <strong>Safari</strong> 打开这个网址</span></li><li><b>2</b><span>点击 Safari 顶部或底部的 <strong>分享按钮 ⎋</strong></span></li><li><b>3</b><span>向下找到并点击 <strong>“添加到主屏幕”</strong></span></li><li><b>4</b><span>点击右上角 <strong>“添加”</strong></span></li></ol>`:`<p class="install-copy">在浏览器菜单中选择“安装应用”或“添加到主屏幕”。第一次安装前请保持联网，让离线文件完成缓存。</p>`}<div class="offline-note"><span>✓</span><p><strong>文稿只保存在这台设备</strong><br>安装完成并成功打开一次后，没有网络也可以编辑和提词。</p></div><button class="primary install-done" data-action="close-install">我知道了</button></div></div>`)
}
async function installApp() {
  if(isStandaloneApp())return toast('已经安装到主屏幕')
  if(!installPromptEvent)return showInstallHelp()
  installPromptEvent.prompt()
  await installPromptEvent.userChoice
  installPromptEvent=null
}
async function requestScreenWakeLock() {
  if(postNativeMessage('screenAwake',{enabled:true}))return
  if(!('wakeLock' in navigator)||document.visibilityState!=='visible')return
  try { screenWakeLock=await navigator.wakeLock.request('screen') } catch {}
}
function releaseScreenWakeLock() { postNativeMessage('screenAwake',{enabled:false});if(screenWakeLock){screenWakeLock.release().catch(()=>{});screenWakeLock=null} }

function renderHome() {
  stopPlayback(false); state.view='home'; const docs=getDocuments().sort((a,b)=>b.updatedAt-a.updatedAt)
  app.innerHTML=`<section class="app-layout"><aside class="side-rail"><div class="side-brand"><span class="brand-mark"><i></i><i></i><i></i></span><strong>实用提词器</strong></div><div class="side-nav"><span class="nav-icon">▤</span>我的文稿</div><div class="side-foot">所有数据仅保存在<br>当前浏览器中</div></aside><div class="workspace"><section class="shell"><header class="hero"><div class="brand"><h1>实用提词器</h1><p>让每一次表达都从容清晰</p></div><button class="primary new-button" data-action="new"><span class="button-plus">＋</span>新建文稿</button></header>${installCard()}${docs.length?`<div class="section-head"><div><h2>我的文稿</h2><p class="section-note">管理你的演讲稿与视频台词</p></div><span class="count">共 ${docs.length} 篇</span></div><div class="list-labels"><span>标题 / 预览</span><span>更新信息</span><span>操作</span></div><div class="document-list">${docs.map(doc=>`<article class="document-card"><div class="document-copy" data-action="play" data-id="${doc.id}" tabindex="0"><h3 class="document-title">${escapeHtml(doc.title)}</h3><p class="document-preview">${escapeHtml(doc.content.replace(/\s+/g,' ').slice(0,80))}</p></div><span class="document-meta">${formatTime(doc.updatedAt)}<br>${doc.content.replace(/\s/g,'').length} 字</span><div class="actions"><button class="action" data-action="edit" data-id="${doc.id}">编辑</button><button class="action danger" data-action="delete" data-id="${doc.id}">删除</button><button class="action play" data-action="play" data-id="${doc.id}">开始提词</button></div></article>`).join('')}</div>`:`<div class="empty"><div><div class="empty-mark">稿</div><h2>还没有文稿</h2><p>新建一篇文稿，开始你的从容表达</p><button class="primary" data-action="new">新建第一篇文稿</button></div></div>`}</section></div></section>`
}

function renderEditor(id=null) {
  state.view='editor'; state.editingId=id; const doc=id?getDocuments().find(item=>item.id===id):null
  app.innerHTML=`<section class="editor-page"><header class="editor-toolbar"><div class="editor-title-group"><button class="back editor-back" data-action="home" aria-label="返回">‹</button><h1>${doc?'编辑文稿':'新建文稿'}</h1></div><div class="editor-actions"><button class="editor-tool" data-action="import-txt">导入 TXT</button><button class="editor-tool" data-action="clean-text">清理格式</button><button class="editor-tool" data-action="copy-text">复制全文</button><button class="editor-tool" data-action="export-txt">导出 TXT</button><button class="cancel-button" data-action="home">取消</button><button class="primary toolbar-save" data-action="save">保存文稿</button></div></header><div class="editor-canvas"><input id="fileInput" type="file" accept=".txt,text/plain" hidden><label class="editor-field"><span class="editor-label"><strong>文稿标题</strong><small class="counter" id="titleCount">${doc?.title.length||0} / 50</small></span><input id="title" class="editor-title-input" maxlength="50" placeholder="给这篇文稿起个名字" value="${escapeHtml(doc?.title||'')}"></label><label class="editor-field body-editor-field"><span class="editor-label body-label"><span><strong>提词正文</strong><small class="writing-tip">空行用于分段；段落以 # 开头可作为提纲关键词</small></span><small class="counter mobile-hidden" id="bodyCount">${doc?.content.length||0} / 20000</small></span><textarea id="content" class="editor-body-input" maxlength="20000" placeholder="从这里开始写下你的演讲内容…">${escapeHtml(doc?.content||'')}</textarea><small class="counter body-count-mobile" id="bodyCountMobile">${doc?.content.length||0} / 20000</small></label></div></section>`
  const title=document.querySelector('#title'), content=document.querySelector('#content'); title.focus()
  const updateCounts=()=>{document.querySelector('#titleCount').textContent=`${title.value.length} / 50`;document.querySelector('#bodyCount').textContent=`${content.value.length} / 20000`;document.querySelector('#bodyCountMobile').textContent=`${content.value.length} / 20000`}
  title.addEventListener('input',updateCounts);content.addEventListener('input',updateCounts)
  document.querySelector('#fileInput').addEventListener('change',importTxtFile)
}

function saveEditor() {
  const title=document.querySelector('#title').value.trim(), content=document.querySelector('#content').value.trim()
  if(!title)return toast('请输入标题'); if(!content)return toast('请输入正文')
  const docs=getDocuments(),now=Date.now(),index=docs.findIndex(item=>item.id===state.editingId)
  const doc={id:state.editingId||`${now}-${Math.random().toString(36).slice(2,8)}`,title,content,createdAt:index>=0?docs[index].createdAt:now,updatedAt:now}
  if(index>=0)docs[index]=doc;else docs.unshift(doc);saveDocuments(docs);toast('保存成功');setTimeout(renderHome,300)
}
function importTxtFile(event) {
  const file=event.target.files?.[0];if(!file)return
  const reader=new FileReader();reader.onload=()=>{const content=document.querySelector('#content');content.value=String(reader.result||'').slice(0,20000);if(!document.querySelector('#title').value)document.querySelector('#title').value=file.name.replace(/\.txt$/i,'').slice(0,50);content.dispatchEvent(new Event('input'));toast('TXT 已导入')};reader.readAsText(file,'UTF-8')
}
function exportTxt() {
  const content=document.querySelector('#content')?.value||'';if(!content)return toast('正文为空')
  if(postNativeMessage('exportText',{title:document.querySelector('#title')?.value.trim()||'未命名文稿',content}))return
  const blob=new Blob([content],{type:'text/plain;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`${document.querySelector('#title')?.value.trim()||'未命名文稿'}.txt`;a.click();URL.revokeObjectURL(url);toast('TXT 已导出')
}
window.receiveNativeText=payload=>{
  const title=document.querySelector('#title'),content=document.querySelector('#content')
  if(!title||!content)return
  content.value=String(payload?.content||'').slice(0,20000)
  if(!title.value)title.value=String(payload?.title||'导入文稿').slice(0,50)
  title.dispatchEvent(new Event('input'));content.dispatchEvent(new Event('input'));toast('TXT 已导入')
}
window.receiveNativeResult=(name,success)=>{if(name==='copyText')toast(success?'全文已复制':'复制失败')}
async function copyEditorText(){const text=document.querySelector('#content')?.value||'';if(!text)return toast('正文为空');if(postNativeMessage('copyText',{content:text}))return;try{await navigator.clipboard.writeText(text);toast('全文已复制')}catch{toast('复制失败，请手动复制')}}

function renderPrompter(id) {
  const doc=getDocuments().find(item=>item.id===id);if(!doc)return renderHome()
  state.view='prompter';state.activeDocument=doc;state.paragraphs=splitParagraphs(doc.content);state.playing=false;state.controlsHidden=false
  const positions=readJSON(POSITIONS_KEY,{});state.offset=Number(positions[id])||0
  app.innerHTML=`<section class="prompter ${state.dark?'':'light'} ${state.guideLine?'guide-on':''} ${state.mirror?'mirror':''}"><header class="prompter-top"><div class="prompter-info"><button class="back" data-action="home" aria-label="返回">‹</button><span class="prompter-name">${escapeHtml(doc.title)}</span><span class="remaining">剩余 <b id="remaining">--:--</b></span></div><input id="progress" class="progress" type="range" min="0" max="100" step="0.1" value="0" aria-label="阅读进度"></header><div id="viewport" class="viewport"><div class="focus-band" aria-hidden="true"></div><div class="center-guide" aria-hidden="true"></div><div id="track" class="track"><div class="lead-space"></div><div id="script" class="script" style="font-size:${state.fontSize}px">${renderScriptParagraphs()}</div><div class="script-end">— 文稿结束 —</div><div class="tail-space"></div></div></div><footer class="controls"><button class="controls-toggle" data-action="hide-controls" aria-label="隐藏控制栏">⌄</button><nav class="stage-tools" aria-label="舞台工具"><button data-action="previous-paragraph" title="上一段">‹ 上一段</button><button data-action="reset" title="回到开头 (R)">↺ 开头</button><button data-action="next-paragraph" title="下一段">下一段 ›</button><button data-action="outline" class="${state.outlineMode?'active':''}">提纲</button><button data-action="guide" class="${state.guideLine?'active':''}">参考线</button><button data-action="mirror" class="${state.mirror?'active':''}">镜像</button><button data-action="fullscreen">全屏</button><button data-action="shortcuts">快捷键</button></nav><div class="control-main"><button class="play-button" data-action="toggle"><span id="playSymbol" class="play-symbol">▶</span><span id="playLabel">继续</span></button><div class="adjust speed"><div class="adjust-head"><span>速度</span><span id="speedValue" class="numeric">${state.speed} px/s</span></div><div class="adjust-row"><button class="step" data-action="speed" data-delta="-2">−</button><input id="speed" class="range" type="range" min="8" max="80" step="2" value="${state.speed}"><button class="step" data-action="speed" data-delta="2">＋</button></div></div><div class="adjust font"><div class="adjust-head"><span>字号</span><span id="fontValue" class="numeric">${state.fontSize} px</span></div><div class="adjust-row"><button class="step" data-action="font" data-delta="-2">−</button><input id="font" class="range" type="range" min="26" max="120" step="2" value="${state.fontSize}"><button class="step" data-action="font" data-delta="2">＋</button></div></div><button class="theme-button" data-action="theme"><span class="theme-a">A</span><span>${state.dark?'白底':'黑底'}</span></button></div></footer><button class="controls-reveal" data-action="show-controls" aria-label="显示控制栏"><span>⌃</span><small>控制</small></button></section>`
  requestAnimationFrame(()=>{measureTrack(false);state.offset=Math.min(state.offset,state.maxOffset);applyOffset();bindPrompterControls();updatePrompterUI()})
}
function renderScriptParagraphs(){return state.paragraphs.map((p,i)=>`<p class="script-paragraph" data-paragraph="${i}">${escapeHtml(state.outlineMode?firstSentence(p):p.replace(/^#\s*/,''))}</p>`).join('')}
function measureTrack(preserve=true){const v=document.querySelector('#viewport'),t=document.querySelector('#track');if(!v||!t)return;const ratio=preserve&&state.maxOffset?state.offset/state.maxOffset:0;state.maxOffset=Math.max(0,t.scrollHeight-v.clientHeight);if(preserve)state.offset=state.maxOffset*ratio;else state.offset=Math.min(state.offset,state.maxOffset);applyOffset()}
function applyOffset(){const t=document.querySelector('#track');if(t)t.style.transform=`translate3d(0,${-state.offset}px,0)`;updatePrompterUI();saveReadingPosition()}
function updatePrompterUI(){if(state.view!=='prompter')return;const ratio=state.maxOffset?state.offset/state.maxOffset:0,seconds=Math.ceil(Math.max(0,state.maxOffset-state.offset)/Math.max(1,state.speed));document.querySelector('#progress').value=(ratio*100).toFixed(1);document.querySelector('#remaining').textContent=`${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;document.querySelector('#playSymbol').textContent=state.playing?'Ⅱ':'▶';document.querySelector('#playLabel').textContent=state.playing?'暂停':'继续';updateCurrentParagraph()}
function updateCurrentParagraph(){const v=document.querySelector('#viewport');if(!v)return;const y=v.getBoundingClientRect().top+v.clientHeight/2;let best=null,distance=Infinity;document.querySelectorAll('.script-paragraph').forEach(el=>{const r=el.getBoundingClientRect(),d=y<r.top?r.top-y:y>r.bottom?y-r.bottom:0;if(d<distance){distance=d;best=el}});document.querySelector('.script-paragraph.current')?.classList.remove('current');best?.classList.add('current')}
function saveReadingPosition(force=false){if(!state.activeDocument)return;const now=Date.now();if(!force&&now-state.savePositionAt<1000)return;state.savePositionAt=now;const positions=readJSON(POSITIONS_KEY,{});positions[state.activeDocument.id]=Math.round(state.offset);writeJSON(POSITIONS_KEY,positions)}
function playbackFrame(now){if(!state.playing)return;if(!state.lastFrame)state.lastFrame=now;state.offset=Math.min(state.maxOffset,state.offset+state.speed*(now-state.lastFrame)/1000);state.lastFrame=now;const track=document.querySelector('#track');if(track)track.style.transform=`translate3d(0,${-state.offset}px,0)`;if(now-state.lastUiAt>120){state.lastUiAt=now;updatePrompterUI();saveReadingPosition()}if(state.offset>=state.maxOffset){state.playing=false;setControlsHidden(false);updatePrompterUI();saveReadingPosition(true);return}state.animationFrame=requestAnimationFrame(playbackFrame)}
function startPlayback(){if(state.offset>=state.maxOffset-1)state.offset=0;state.playing=true;state.lastFrame=0;requestScreenWakeLock();cancelAnimationFrame(state.animationFrame);state.animationFrame=requestAnimationFrame(playbackFrame);updatePrompterUI();scheduleControlsHide()}
function stopPlayback(show=true){state.playing=false;releaseScreenWakeLock();clearTimeout(state.controlsTimer);cancelAnimationFrame(state.animationFrame);state.animationFrame=0;state.lastFrame=0;if(state.view==='prompter'){if(show)setControlsHidden(false);updatePrompterUI();saveReadingPosition(true)}}
function togglePlayback(){state.playing?stopPlayback():startPlayback()}
function setControlsHidden(hidden){if(state.view!=='prompter')return;state.controlsHidden=hidden;document.querySelector('.prompter')?.classList.toggle('controls-hidden',hidden)}
function scheduleControlsHide(){clearTimeout(state.controlsTimer);if(state.playing&&!state.controlsHidden)state.controlsTimer=setTimeout(()=>setControlsHidden(true),3500)}
function setSpeed(value){state.speed=Math.max(8,Math.min(80,Number(value)||24));const el=document.querySelector('#speed');if(el)el.value=state.speed;const label=document.querySelector('#speedValue');if(label)label.textContent=`${state.speed} px/s`;saveSettings();updatePrompterUI()}
function setFontSize(value){state.fontSize=Math.max(26,Math.min(120,Number(value)||46));const el=document.querySelector('#font');if(el)el.value=state.fontSize;const script=document.querySelector('#script');if(script)script.style.fontSize=`${state.fontSize}px`;const label=document.querySelector('#fontValue');if(label)label.textContent=`${state.fontSize} px`;saveSettings();measureTrack()}
function jumpParagraph(direction){const elements=[...document.querySelectorAll('.script-paragraph')];if(!elements.length)return;const targetY=document.querySelector('#viewport').getBoundingClientRect().top+document.querySelector('#viewport').clientHeight/2;let index=elements.findIndex(el=>{const r=el.getBoundingClientRect();return targetY>=r.top&&targetY<=r.bottom});if(index<0)index=0;index=Math.max(0,Math.min(elements.length-1,index+direction));const target=elements[index];state.offset=Math.max(0,Math.min(state.maxOffset,target.offsetTop-document.querySelector('#viewport').clientHeight/2+target.offsetHeight/2));applyOffset();toast(`第 ${index+1} / ${elements.length} 段`)}
function resetToStart(){state.offset=0;applyOffset();toast('已回到开头')}
function toggleOutline(){const ratio=state.maxOffset?state.offset/state.maxOffset:0;state.outlineMode=!state.outlineMode;saveSettings();document.querySelector('#script').innerHTML=renderScriptParagraphs();document.querySelector('[data-action=outline]').classList.toggle('active',state.outlineMode);measureTrack(false);state.offset=state.maxOffset*ratio;applyOffset();toast(state.outlineMode?'已切换到提纲模式':'已显示全文')}
async function toggleFullscreen(){try{if(!document.fullscreenElement)await document.documentElement.requestFullscreen();else await document.exitFullscreen()}catch{toast('当前浏览器不支持全屏')}}
function showShortcutHelp(){document.querySelector('.shortcut-help')?.remove();document.querySelector('.prompter').insertAdjacentHTML('beforeend',`<div class="shortcut-help" role="dialog" aria-modal="true"><div><header><strong>键盘快捷键</strong><button data-action="close-shortcuts" aria-label="关闭">×</button></header><p><kbd>Space</kbd><span>暂停 / 继续</span></p><p><kbd>↑</kbd><span>提高速度</span></p><p><kbd>↓</kbd><span>降低速度</span></p><p><kbd>+</kbd><span>增大字号</span></p><p><kbd>−</kbd><span>减小字号</span></p><p><kbd>R</kbd><span>回到开头</span></p><p><kbd>F</kbd><span>进入 / 退出全屏</span></p><p><kbd>M</kbd><span>开启 / 关闭镜像</span></p></div></div>`)}

function bindPrompterControls(){
  const viewport=document.querySelector('#viewport'),progress=document.querySelector('#progress'),speed=document.querySelector('#speed'),font=document.querySelector('#font')
  const move=e=>{if(!state.dragging)return;e.preventDefault();const dx=e.clientX-state.dragX,dy=e.clientY-state.dragY;if(Math.hypot(dx,dy)>10&&!state.dragMoved){state.dragMoved=true;setControlsHidden(true)}if(Math.abs(dx)>Math.abs(dy)){return}state.offset=Math.max(0,Math.min(state.maxOffset,state.dragOffset-dy));applyOffset()}
  const end=e=>{if(!state.dragging)return;const dx=e.clientX-state.dragX,dy=e.clientY-state.dragY;state.dragging=false;viewport.classList.remove('dragging');window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',end);if(state.dragMoved&&Math.abs(dx)>70&&Math.abs(dx)>Math.abs(dy)*1.2)jumpParagraph(dx<0?1:-1);else if(!state.dragMoved)handleStageTap();if(state.resumeAfterDrag)startPlayback()}
  const start=e=>{state.resumeAfterDrag=state.playing;if(state.playing)stopPlayback(false);clearTimeout(state.controlsTimer);state.dragging=true;state.dragMoved=false;state.dragX=e.clientX;state.dragY=e.clientY;state.dragOffset=state.offset;viewport.classList.add('dragging');viewport.setPointerCapture?.(e.pointerId);window.addEventListener('pointermove',move);window.addEventListener('pointerup',end)}
  viewport.addEventListener('pointerdown',start)
  let resume=false;progress.addEventListener('pointerdown',()=>{resume=state.playing;stopPlayback()});progress.addEventListener('input',()=>{state.offset=state.maxOffset*progress.value/100;applyOffset()});progress.addEventListener('change',()=>{if(resume)startPlayback()})
  speed.addEventListener('input',()=>setSpeed(speed.value));font.addEventListener('input',()=>setFontSize(font.value))
}
function handleStageTap(){const now=Date.now();if(now-state.lastTapAt<280){clearTimeout(state.tapTimer);state.lastTapAt=0;setControlsHidden(!state.controlsHidden)}else{state.lastTapAt=now;state.tapTimer=setTimeout(()=>{togglePlayback();state.lastTapAt=0},280)}}

app.addEventListener('click',event=>{
  const target=event.target.closest('[data-action]');if(!target)return;const {action,id,delta}=target.dataset
  if(action==='new')renderEditor();if(action==='edit')renderEditor(id);if(action==='play')renderPrompter(id);if(action==='home')renderHome();if(action==='save')saveEditor();if(action==='toggle')togglePlayback()
  if(action==='install-app')installApp();if(action==='close-install')target.closest('.install-help')?.remove()
  if(action==='delete'){const docs=getDocuments(),doc=docs.find(x=>x.id===id);if(confirm(`确定删除“${doc?.title||'这篇文稿'}”吗？`)){saveDocuments(docs.filter(x=>x.id!==id));renderHome();toast('已删除')}}
  if(action==='import-txt'){if(!postNativeMessage('importText'))document.querySelector('#fileInput').click()}if(action==='export-txt')exportTxt();if(action==='copy-text')copyEditorText();if(action==='clean-text'){const el=document.querySelector('#content');el.value=cleanText(el.value);el.dispatchEvent(new Event('input'));toast('格式已清理')}
  if(action==='hide-controls')setControlsHidden(true);if(action==='show-controls'){setControlsHidden(false);scheduleControlsHide()}
  if(action==='speed')setSpeed(state.speed+Number(delta));if(action==='font')setFontSize(state.fontSize+Number(delta));if(action==='previous-paragraph')jumpParagraph(-1);if(action==='next-paragraph')jumpParagraph(1);if(action==='reset')resetToStart();if(action==='outline')toggleOutline();if(action==='fullscreen')toggleFullscreen()
  if(action==='shortcuts')showShortcutHelp();if(action==='close-shortcuts')target.closest('.shortcut-help')?.remove()
  if(action==='theme'){state.dark=!state.dark;document.querySelector('.prompter').classList.toggle('light',!state.dark);target.innerHTML=`<span class="theme-a">A</span><span>${state.dark?'白底':'黑底'}</span>`;saveSettings()}
  if(action==='guide'){state.guideLine=!state.guideLine;document.querySelector('.prompter').classList.toggle('guide-on',state.guideLine);target.classList.toggle('active',state.guideLine);saveSettings()}
  if(action==='mirror'){state.mirror=!state.mirror;document.querySelector('.prompter').classList.toggle('mirror',state.mirror);target.classList.toggle('active',state.mirror);saveSettings()}
})

window.addEventListener('keydown',event=>{
  if(state.view!=='prompter'||['INPUT','TEXTAREA'].includes(document.activeElement?.tagName))return
  const key=event.key.toLowerCase();if([' ','arrowup','arrowdown','+','=','-','r','f','m'].includes(key))event.preventDefault()
  if(key===' ')togglePlayback();if(key==='arrowup')setSpeed(state.speed+2);if(key==='arrowdown')setSpeed(state.speed-2);if(key==='+'||key==='=')setFontSize(state.fontSize+2);if(key==='-')setFontSize(state.fontSize-2);if(key==='r')resetToStart();if(key==='f')toggleFullscreen();if(key==='m')document.querySelector('[data-action=mirror]')?.click();if(event.key==='Escape'&&!document.fullscreenElement)renderHome()
})
window.addEventListener('resize',()=>{if(state.view==='prompter')measureTrack()})
window.addEventListener('beforeunload',()=>saveReadingPosition(true))
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&state.view==='prompter'&&state.playing)requestScreenWakeLock()})

loadSettings();renderHome()
window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();installPromptEvent=event})
window.addEventListener('appinstalled',()=>{installPromptEvent=null;document.querySelector('.install-card')?.remove();toast('安装成功，可以从主屏幕打开')})
if('serviceWorker'in navigator&&location.protocol.startsWith('http'))navigator.serviceWorker.register('./sw.js').then(registration=>registration.update()).catch(()=>{})
