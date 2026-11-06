// Composites the title logo onto the AI key art -> store/cover_*.jpg (rendered to PNG, then saved as JPG q92 via PIL)  (needs static server on :8123)
const { chromium } = require('playwright');
const covers = [
  { out: 'store/cover_1920x1080.png', w: 1920, h: 1080, bg: 'store/raw/keyart.png', top: '7%', scale: 1.0, pos: 'center' },
  { out: 'store/cover_800x1200.png', w: 800, h: 1200, bg: 'store/raw/cover_portrait.png', top: '7%', scale: 0.74, pos: 'center' },
  { out: 'store/cover_800x800.png', w: 800, h: 800, bg: 'store/raw/cover_square.png', top: '5%', scale: 0.72, pos: 'center' },
];
(async () => {
  const b = await chromium.launch();
  for (const c of covers) {
    const p = await b.newPage({ viewport: { width: c.w, height: c.h } });
    await p.goto('http://localhost:8123/index.html');
    await p.setContent(`<html><head><link rel="stylesheet" href="http://localhost:8123/css/style.css"><style>
      body{margin:0;width:${c.w}px;height:${c.h}px;background:url(http://localhost:8123/${c.bg}) ${c.pos}/cover;position:relative;overflow:hidden}
      .glow{position:absolute;left:0;right:0;top:0;height:55%;background:radial-gradient(ellipse 60% 60% at 50% 35%,rgba(40,15,0,.38),rgba(40,15,0,0) 70%)}
      .logo span{white-space:nowrap}.logo{position:absolute;width:max-content;left:50%;top:${c.top};transform:translateX(-50%) scale(${c.scale});transform-origin:50% 0}
      .logo .l1{font-size:110px;-webkit-text-stroke:6px #7a3b12}.logo .l2{font-size:190px;-webkit-text-stroke:8px #6b2a0c}.logo .l3{font-size:34px}
    </style></head><body><div class="glow"></div><div class="logo"><span class="l1">Teahouse</span><span class="l2">Tile Slide</span></div></body></html>`);
    await p.waitForTimeout(800);
    await p.screenshot({ path: c.out });
    require('child_process').execSync(`python3 -c "from PIL import Image; Image.open('${c.out}').convert('RGB').save('${c.out.replace('.png', '.jpg')}', quality=92, optimize=True)"`);
    require('fs').unlinkSync(c.out);
    await p.close();
    console.log('wrote', c.out);
  }
  await b.close();
})();
