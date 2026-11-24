// Screenshot polling loop. Runs concurrently with the step runner inside one ego script.
// Page.startScreencast is not usable under ego (frame ack is blocked), so we poll captureScreenshot.

export class Capture {
  constructor({ fs, framesDir, t0, quality = 70 }) {
    this.fs = fs;
    this.dir = framesDir;
    this.t0 = t0;
    this.quality = quality;
    this.page = null; // { name, page }
    this._blind = false; // true while a not-yet-redacted page may be on screen
    this.blindGen = 0; // bumps every time blind is switched on
    this.frames = [];
    this.errors = [];
    this.running = false;
    this.fatal = null;
  }

  get blind() {
    return this._blind;
  }

  set blind(v) {
    if (v && !this._blind) this.blindGen++;
    this._blind = v;
  }

  now() {
    return Date.now() - this.t0;
  }

  async shot(page) {
    return page.cdp(
      "Page.captureScreenshot",
      { format: "jpeg", quality: this.quality, optimizeForSpeed: true },
      { timeout: 8000 },
    );
  }

  async saveFrame(name, data, t) {
    const i = this.frames.length + 1;
    const file = `f${String(i).padStart(6, "0")}.jpg`;
    await this.fs.writeFile(`${this.dir}/${file}`, Buffer.from(data, "base64"));
    this.frames.push({ i, t, page: name, file });
  }

  start() {
    this.running = true;
    let failSince = null;
    this.loop = (async () => {
      while (this.running) {
        if (this.blind || !this.page) {
          await new Promise((r) => setTimeout(r, 15));
          continue;
        }
        const { name, page } = this.page;
        const s = this.now();
        const gen = this.blindGen;
        try {
          const shot = await this.shot(page);
          const e = this.now();
          // blind went on (even briefly) or the page changed while capturing: drop the frame
          if (this.blind || gen !== this.blindGen || this.page?.page !== page) continue;
          await this.saveFrame(name, shot.data, Math.round((s + e) / 2));
          failSince = null;
        } catch (err) {
          this.errors.push({ t: s, message: String(err).slice(0, 200) });
          failSince ??= s;
          if (this.now() - failSince > 3000) {
            this.fatal = new Error("화면 캡처가 3초 넘게 실패했습니다. ego 창이 화면 앞에 보이는지 확인하세요");
            this.running = false;
          }
        }
      }
    })();
  }

  async stop() {
    this.running = false;
    await this.loop;
  }
}
