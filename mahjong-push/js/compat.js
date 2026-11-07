// Small compatibility shims, imported first by main.js.
// CanvasRenderingContext2D.roundRect only exists in Safari 16+ / Chrome 99+; CrazyGames disables games
// that break on Safari, so older iPhones/iPads get this equivalent path-based version.
if (typeof CanvasRenderingContext2D !== 'undefined' && !CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
    let rr = Array.isArray(r) ? r[0] || 0 : r || 0;
    if (w < 0) { x += w; w = -w; }
    if (h < 0) { y += h; h = -h; }
    rr = Math.max(0, Math.min(rr, w / 2, h / 2));
    this.moveTo(x + rr, y);
    this.arcTo(x + w, y, x + w, y + h, rr);
    this.arcTo(x + w, y + h, x, y + h, rr);
    this.arcTo(x, y + h, x, y, rr);
    this.arcTo(x, y, x + w, y, rr);
    this.closePath();
    return this;
  };
}
