// @ts-nocheck
// Landing showcase: a looping fan of mini stories with sample names (never real data).
export function mountShowcase(stage: HTMLElement, dotsEl: HTMLElement) {
  const av = (t, h) => `<span class="av" style="background:hsl(${h} 55% 68%)">${t}</span>`;
  const row = (i, n, h, me, th, v, top) => `<div class="r ${top ? "top" : ""}"><span class="n">${i}</span>${av(n[0], h)}<span class="nm">${n}<span class="gb" style="width:${me + th}%;animation-delay:${0.1 + i * 0.12}s"><i class="me" style="width:${Math.round(100 * me / (me + th))}%"></i><i class="th" style="flex:1"></i></span></span><span class="val">${v}</span></div>`;
  const pts = a => a.map((v, i) => `${8 + i * 25},${90 - v}`).join(" ");
  const line = (a, c, d) => `<polyline points="${pts(a)}" fill="none" stroke="${c}" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round" style="animation-delay:${d}s"/>`;
  const cards = [
    { icon: "★", title: "Your top 20", sub: "1:1 chats only", script: [
      { t: "Your 20 people, ranked 👇" },
      { w: 1, t: row(1, "Sam", 260, 52, 48, "4,942", 1) + row(2, "Léa", 350, 36, 34, "3,513") + row(3, "Max", 60, 20, 24, "2,162") + row(4, "Mum", 150, 10, 15, "1,077") + row(5, "Noah", 200, 8, 10, "941") },
      { t: "<b>Sam</b> is number one. 14 messages a day, every day." },
      { o: 1, t: "not surprised 😅" } ] },
    { icon: "⚡", title: "Fastest replies", sub: "median, both ways", script: [
      { t: "Who answers you fastest ⚡" },
      { w: 1, t: row(1, "Léa", 350, 50, 0, "24 s", 1) + row(2, "Max", 60, 40, 0, "36 s") + row(3, "Noah", 200, 22, 0, "2.3 min") },
      { t: `<div class="bigs" data-count="7.5">0</div>people answer you, on median` },
      { o: 1, t: "speed 🏎️" } ] },
    { icon: "🕒", title: "Slowest replies", sub: "who makes who wait", script: [
      { t: "Who leaves you waiting 🐢" },
      { w: 1, t: row(1, "Max", 60, 64, 0, "1 h 04", 1) + row(2, "Léa", 350, 34, 0, "34 min") + row(3, "Noah", 200, 19, 0, "19 min") },
      { t: "<b>Mum</b> answers you in 4 min. You take 24 min." },
      { o: 1, t: "oops 🙈" } ] },
    { icon: "📈", title: "Your year", sub: "top people, month by month", script: [
      { t: "Your top 4 across the year 📅" },
      { w: 1, t: `<svg class="ch" viewBox="0 0 290 96"><g style="stroke:var(--tint2)"><line x1="8" x2="285" y1="25" y2="25"/><line x1="8" x2="285" y1="55" y2="55"/><line x1="8" x2="285" y1="85" y2="85"/></g>${line([30,70,60,40,45,50,48,52,46,75,58,30], "#25d366", 0)}${line([20,30,35,30,40,62,40,45,42,38,50,32], "#53bdeb", .2)}${line([10,55,45,40,20,10,8,6,5,4,3,2], "#ff7a7a", .4)}${line([5,8,10,12,30,45,28,20,40,30,26,15], "#ffd279", .6)}</svg>` },
      { t: "<b>Léa</b> faded after January. <b>Max</b> came out of nowhere in May." },
      { o: 1, t: "interesting 👀" } ] },
    { icon: "👥", title: "The squad", sub: "group · 5 members", script: [
      { t: "Who runs <b>The squad</b> 👑" },
      { w: 1, t: row(1, "You", 140, 40, 0, "802", 1) + row(2, "Sam", 260, 39, 0, "774") + row(3, "Léa", 350, 37, 0, "748") + row(4, "Max", 60, 37, 0, "741") },
      { w: 1, t: `<div class="aw"><div>${av("M", 60)}<div><span>Starter</span><b>Max</b></div></div><div>${av("S", 260)}<div><span>Night owl</span><b>Sam</b></div></div><div>${av("L", 350)}<div><span>Killer</span><b>Léa</b></div></div><div>${av("N", 200)}<div><span>Voice king</span><b>Noah</b></div></div></div>` },
      { o: 1, t: "go to sleep Sam 😴" } ] },
  ];
  const dots = [...dotsEl.querySelectorAll("i")];
  const els = cards.map(c => { const d = document.createElement("div"); d.className = "card"; d.innerHTML = `<div class="mh"><i>${c.icon}</i><div><b>${c.title}</b><span>${c.sub}</span></div></div><div class="mb"></div>`; stage.appendChild(d); return d; });
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const bubble = (s) => { const d = document.createElement("div"); d.className = "bub" + (s.o ? " o" : "") + (s.w ? " w" : ""); d.innerHTML = s.t; return d; };
  const fill = (k) => { const mb = els[k].querySelector(".mb"); mb.innerHTML = ""; cards[k].script.forEach(s => mb.appendChild(bubble(s))); mb.querySelectorAll("[data-count]").forEach(n => n.textContent = n.dataset.count + " min"); };
  let front = 0, timers = [];
  const N = cards.length;
  const place = () => { els.forEach((el, k) => { const rel = (k - front + N) % N; el.className = "card " + (rel === 0 ? "front" : rel === 1 ? "right" : rel === N - 1 ? "left" : "hidden"); }); dots.forEach((d, k) => d.classList.toggle("on", k === front)); };
  const later = (fn, ms) => timers.push(setTimeout(fn, ms));
  const play = () => {
    timers.forEach(clearTimeout); timers = [];
    place();
    const mb = els[front].querySelector(".mb"); mb.innerHTML = "";
    let t = 700;
    cards[front].script.forEach(s => {
      later(() => { const ty = document.createElement("div"); ty.className = "typing" + (s.o ? " o" : ""); ty.innerHTML = "<i></i><i></i><i></i>"; mb.appendChild(ty); }, t);
      t += 550;
      later(() => {
        mb.querySelector(".typing")?.remove();
        const b = bubble(s); mb.appendChild(b);
        b.querySelectorAll("[data-count]").forEach(n => { const end = +n.dataset.count, t0 = performance.now(); const tick = now => { const k = Math.min(1, (now - t0) / 900); n.textContent = (end * (1 - Math.pow(1 - k, 3))).toFixed(1) + " min"; if (k < 1) requestAnimationFrame(tick); }; requestAnimationFrame(tick); });
      }, t);
      t += s.w ? 1100 : 650;
    });
    later(() => { front = (front + 1) % N; play(); }, t + 1800);
  };
  // back cards show their finished state
  cards.forEach((_, k) => fill(k));
  if (reduced) { place(); return; }
  play();
}
