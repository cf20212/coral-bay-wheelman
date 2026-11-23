// Keyboard and mouse state for the game. One shared object the rest of the game reads;
// the window owns the listeners so the page never scrolls or selects while playing.

export class Input {
  constructor(canvas) {
    this.keys = new Set();
    this.pressed = new Set(); // keys that went down since the last frame read
    this.mouseX = 0;
    this.mouseY = 0;
    this.mouseDown = false;
    this.mouseClicked = false; // a fresh click since the last frame read
    this.enabled = true;

    window.addEventListener('keydown', (event) => {
      if (!this.enabled) return;
      const code = event.code;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(code)) event.preventDefault();
      if (!this.keys.has(code)) this.pressed.add(code);
      this.keys.add(code);
    });
    window.addEventListener('keyup', (event) => {
      this.keys.delete(event.code);
    });
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.mouseDown = false;
    });
    canvas.addEventListener('mousemove', (event) => {
      const rect = canvas.getBoundingClientRect();
      this.mouseX = (event.clientX - rect.left) * (canvas.width / rect.width);
      this.mouseY = (event.clientY - rect.top) * (canvas.height / rect.height);
    });
    canvas.addEventListener('mousedown', (event) => {
      if (!this.enabled) return;
      if (event.button === 0) {
        if (!this.mouseDown) this.mouseClicked = true;
        this.mouseDown = true;
      }
    });
    window.addEventListener('mouseup', (event) => {
      if (event.button === 0) this.mouseDown = false;
    });
    canvas.addEventListener('contextmenu', (event) => event.preventDefault());
  }

  down(...codes) {
    return codes.some((code) => this.keys.has(code));
  }

  /** True once per physical press; consumes the press. */
  hit(...codes) {
    for (const code of codes) {
      if (this.pressed.has(code)) {
        this.pressed.delete(code);
        return true;
      }
    }
    return false;
  }

  /** Call at the end of each frame: clears the per-frame latches. */
  endFrame() {
    this.pressed.clear();
    this.mouseClicked = false;
  }

  axisX() {
    return (this.down('KeyD', 'ArrowRight') ? 1 : 0) - (this.down('KeyA', 'ArrowLeft') ? 1 : 0);
  }

  axisY() {
    return (this.down('KeyS', 'ArrowDown') ? 1 : 0) - (this.down('KeyW', 'ArrowUp') ? 1 : 0);
  }
}
