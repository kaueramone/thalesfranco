import {
  PDFDocument,
  StandardFonts,
  rgb,
  PDFString,
  type PDFPage,
} from "pdf-lib";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Workout } from "./model";

type Line = {
  text: string;
  bold?: boolean;
  link?: string;
  gap?: boolean;
  rule?: boolean;
};
type Cell = { title: string; lines: Line[]; accent?: boolean };
const C = {
  ink: rgb(0.085, 0.085, 0.1),
  red: rgb(0.87, 0.12, 0.17),
  muted: rgb(0.43, 0.44, 0.48),
  border: rgb(0.83, 0.84, 0.86),
  pale: rgb(0.965, 0.965, 0.975),
  white: rgb(1, 1, 1),
};
const W = 595,
  H = 842,
  M = 34,
  INNER = W - M * 2,
  BOTTOM = 57,
  LINE = 12;

export async function workoutPdf(w: Workout, url: string) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const image = async (file: string) =>
    readFile(path.join(process.cwd(), "public", file));
  const logo = await doc.embedPng(await image("logo-black.png"));
  const whiteLogo = await doc.embedPng(await image("logo-white.png"));
  const photo = await doc.embedJpg(await image("cover-photo.jpeg"));
  const safe = (value: string) =>
    Array.from(value.replace(/[–—]/g, "-").replace(/\t/g, "  "))
      .map((c) => {
        if (c === "\n") return c;
        if (c === "\r") return "";
        try {
          font.encodeText(c);
          return c;
        } catch {
          return "?";
        }
      })
      .join("");
  function wrap(value: string, width: number, size = 9, strong = false) {
    const f = strong ? bold : font;
    const lines: string[] = [];
    for (const paragraph of safe(value).split("\n")) {
      let current = "";
      for (const word of paragraph.split(/ +/)) {
        const candidate = current ? current + " " + word : word;
        if (f.widthOfTextAtSize(candidate, size) <= width) {
          current = candidate;
          continue;
        }
        if (current) {
          lines.push(current);
          current = "";
        }
        for (const char of word) {
          if (f.widthOfTextAtSize(current + char, size) > width) {
            lines.push(current);
            current = "";
          }
          current += char;
        }
      }
      lines.push(current);
    }
    return lines;
  }
  function draw(
    p: PDFPage,
    text: string,
    x: number,
    top: number,
    size = 9,
    strong = false,
    color = C.ink,
  ) {
    p.drawText(safe(text), {
      x,
      y: H - top - size,
      size,
      font: strong ? bold : font,
      color,
    });
  }
  function rect(
    p: PDFPage,
    x: number,
    top: number,
    width: number,
    height: number,
    color = C.white,
    border = false,
  ) {
    p.drawRectangle({
      x,
      y: H - top - height,
      width,
      height,
      color,
      ...(border ? { borderColor: C.border, borderWidth: 0.6 } : {}),
    });
  }
  function link(
    p: PDFPage,
    target: string,
    x: number,
    top: number,
    width: number,
    height = 12,
  ) {
    p.node.addAnnot(
      doc.context.register(
        doc.context.obj({
          Type: "Annot",
          Subtype: "Link",
          Rect: [x, H - top - height, x + width, H - top],
          Border: [0, 0, 0],
          A: { Type: "Action", S: "URI", URI: PDFString.of(target) },
        }),
      ),
    );
  }

  // Preserve the photographic cover; the inner pages use the same modular grid as the reference.
  const cover = doc.addPage([W, H]);
  const scale = Math.max(W / photo.width, H / photo.height);
  cover.drawImage(photo, {
    x: (W - photo.width * scale) / 2,
    y: (H - photo.height * scale) / 2,
    width: photo.width * scale,
    height: photo.height * scale,
  });
  cover.drawRectangle({
    x: 0,
    y: 0,
    width: W,
    height: H,
    color: C.ink,
    opacity: 0.69,
  });
  cover.drawImage(whiteLogo, { x: 117.5, y: 371, width: 360, height: 120 });
  rect(cover, 274, 503, 47, 3, C.red);
  const centered = (text: string, top: number, size: number) =>
    draw(
      cover,
      text,
      (W - bold.widthOfTextAtSize(safe(text), size)) / 2,
      top,
      size,
      true,
      C.white,
    );
  centered("HYROX TRAINING PROGRAM", 525, 10);
  const titles = wrap(w.title, 475, 17, true);
  titles.forEach((t, i) => centered(t, 635 + i * 21, 17));
  centered(`WEEK ${String(w.week).padStart(2, "0")}`, 742, 22);
  centered(w.start.split("-").reverse().join(" / "), 776, 9);

  let page: PDFPage;
  let top = 0;
  let pageContentTop = 0;
  let pageTitle = "WEEKLY OVERVIEW";
  let continuation = 0;
  function newPage(title = pageTitle, continued = false) {
    pageTitle = title;
    continuation = continued ? continuation + 1 : 0;
    page = doc.addPage([W, H]);
    page.drawImage(logo, { x: M, y: H - 67, width: 111, height: 37 });
    draw(page, "HYROX / TRAINING PROGRAM", W - M - 173, 35, 8, true, C.muted);
    draw(
      page,
      `WEEK ${String(w.week).padStart(2, "0")}  /  ${w.start.split("-").reverse().join(".")}`,
      W - M - 173,
      50,
      8,
      false,
      C.muted,
    );
    const titleLines = wrap(title.toUpperCase(), INNER - 175, 17, true);
    const phaseLines = wrap(w.phase.toUpperCase(), 143, 9, true);
    const bandHeight = Math.max(
      48,
      titleLines.length * 20 + 18,
      phaseLines.length * 12 + 29,
    );
    rect(page, M, 86, INNER, bandHeight, C.ink);
    rect(page, M, 86, 166, bandHeight, C.red);
    draw(page, "TRAINING PHASE", M + 12, 95, 7, true, C.white);
    phaseLines.forEach((t, i) =>
      draw(page, t, M + 12, 108 + i * 12, 9, true, C.white),
    );
    titleLines.forEach((t, i) =>
      draw(page, t, M + 179, 99 + i * 20, 17, true, C.white),
    );
    top = 86 + bandHeight + 17;
    if (continued) {
      draw(page, `CONTINUED / ${continuation + 1}`, M, top, 7, true, C.muted);
      top += 17;
    }
    pageContentTop = top;
  }
  function textLines(text: string, width: number, strong = false): Line[] {
    return wrap(text, width, 9, strong).map((text) => ({ text, bold: strong }));
  }
  function exerciseCell(
    block: Workout["days"][number]["blocks"][number],
    width: number,
  ): Cell {
    const lines: Line[] = [];
    block.exercises.forEach((e, index) => {
      if (index) lines.push({ text: "", rule: true });
      lines.push(...textLines(e.name, width - 24, true));
      if (e.prescription)
        lines.push(
          { text: "", gap: true },
          ...textLines(e.prescription, width - 24),
        );
      if (e.video) lines.push({ text: "WATCH VIDEO  >", link: e.video });
    });
    return { title: block.name, lines };
  }
  const height = (l: Line) => (l.rule ? 12 : l.gap ? 4 : LINE);
  // Synchronized column pagination: headers repeat and each column resumes at its own cursor.
  function table(cells: Cell[], minimum = 0) {
    const width = INNER / cells.length;
    const headers = cells.map((c) =>
      wrap(c.title.toUpperCase(), width - 24, 9, true),
    );
    const headerHeight = Math.max(...headers.map((h) => h.length)) * 12 + 18;
    const queues = cells.map((c) => [...c.lines]);
    let continued = false;
    do {
      const needed =
        headerHeight +
        24 +
        Math.max(
          ...queues.map((q) => q.reduce((sum, l) => sum + height(l), 0)),
        );
      const available = H - BOTTOM - top;
      const target = Math.max(needed, continued ? 0 : minimum);
      if (
        available < headerHeight + 48 ||
        (top > pageContentTop &&
          target > available &&
          target <= H - BOTTOM - pageContentTop)
      ) {
        newPage(pageTitle, true);
      }
      const capacity = H - BOTTOM - top - headerHeight - 24;
      const chunks = queues.map((q) => {
        const lines: Line[] = [];
        let used = 0;
        while (q.length && used + height(q[0]) <= capacity) {
          if (q[0].bold && used > 0) {
            let keepTogether = 0;
            for (const next of q) {
              keepTogether += height(next);
              if (!next.bold && !next.gap) break;
            }
            if (used + keepTogether > capacity) break;
          }
          const l = q.shift()!;
          lines.push(l);
          used += height(l);
        }
        return { lines, used };
      });
      const more = queues.some((q) => q.length);
      const bodyHeight = Math.max(...chunks.map((c) => c.used)) + 24;
      const total = Math.min(
        H - BOTTOM - top,
        Math.max(headerHeight + bodyHeight, !continued && !more ? minimum : 0),
      );
      cells.forEach((cell, i) => {
        const x = M + i * width;
        rect(page, x, top, width, total, i % 2 ? C.pale : C.white, true);
        rect(page, x, top, width, headerHeight, cell.accent ? C.ink : C.red);
        headers[i].forEach((t, j) =>
          draw(page, t, x + 12, top + 9 + j * 12, 9, true, C.white),
        );
        let cursor = top + headerHeight + 12;
        for (const l of chunks[i].lines) {
          if (l.rule) {
            page.drawLine({
              start: { x: x + 12, y: H - cursor - 5 },
              end: { x: x + width - 12, y: H - cursor - 5 },
              color: C.border,
              thickness: 0.5,
            });
          } else if (!l.gap) {
            draw(
              page,
              l.text,
              x + 12,
              cursor,
              9,
              !!l.bold,
              l.link ? C.red : C.ink,
            );
            if (l.link) link(page, l.link, x + 12, cursor, width - 24);
          }
          cursor += height(l);
        }
      });
      top += total + 14;
      if (more) {
        newPage(pageTitle, true);
        continued = true;
      }
    } while (queues.some((q) => q.length));
  }

  newPage();
  table(
    [
      {
        title: "The program",
        lines: [
          ...textLines(w.title, INNER - 24, true),
          { text: "", rule: true },
          ...textLines(
            w.intro || "Confira a programação e as orientações de cada sessão.",
            INNER - 24,
          ),
        ],
      },
    ],
    115,
  );
  const scheduleLines: Line[] = [];
  w.days.forEach((d) => {
    scheduleLines.push(...textLines(d.name.toUpperCase(), INNER - 24, true));
    const blocks = d.blocks.filter((b) => b.exercises.length);
    scheduleLines.push(
      ...textLines(
        d.rest
          ? "REST DAY"
          : blocks.length
            ? blocks.map((b) => b.name).join("  /  ")
            : "Sem sessão definida.",
        INNER - 24,
      ),
      { text: "", rule: true },
    );
  });
  table([{ title: "Week at a glance", lines: scheduleLines }], 280);
  table([
    {
      title: "Your interactive program",
      accent: true,
      lines: [
        ...textLines(
          "Acesse os vídeos de demonstração e a versão digital do seu treino.",
          INNER - 24,
        ),
        { text: "OPEN TRAINING PROGRAM  >", link: url },
      ],
    },
  ]);

  for (const day of w.days) {
    const blocks = day.blocks.filter((b) => b.exercises.length);
    // Empty days remain visible in the weekly schedule without creating blank pages.
    if (!blocks.length && !day.notes) continue;
    newPage(day.name);
    if (day.rest) {
      table(
        [
          {
            title: "Rest day",
            lines: textLines("Dia de descanso e recuperação.", INNER - 24),
          },
        ],
        150,
      );
    } else {
      const first = blocks.slice(0, 3);
      if (first.length)
        table(
          first.map((b) => exerciseCell(b, INNER / first.length)),
          225,
        );
      const rest = blocks.slice(3);
      // The final block shares a row with notes, as in the reference PDF.
      const last = rest.pop();
      rest.forEach((b) => table([exerciseCell(b, INNER)], 175));
      if (last) {
        const cells = [exerciseCell(last, day.notes ? INNER / 2 : INNER)];
        if (day.notes)
          cells.push({
            title: "Coach's notes",
            accent: true,
            lines: textLines(day.notes, INNER / 2 - 24),
          });
        table(cells, 140);
        continue;
      }
    }
    if (day.notes)
      table(
        [
          {
            title: "Coach's notes",
            accent: true,
            lines: textLines(day.notes, INNER - 24),
          },
        ],
        115,
      );
  }
  doc
    .getPages()
    .slice(1)
    .forEach((p, i) => {
      rect(p, M, 803, INNER, 1, C.border);
      rect(p, M, 803, 54, 2, C.red);
      draw(
        p,
        "TREINO COM CIÊNCIA. RESULTADO COM CONSTÂNCIA.",
        M,
        814,
        6.5,
        true,
        C.muted,
      );
      const number = `${String(i + 2).padStart(2, "0")} / ${String(doc.getPageCount()).padStart(2, "0")}`;
      draw(
        p,
        number,
        W - M - font.widthOfTextAtSize(number, 7),
        813,
        7,
        false,
        C.muted,
      );
    });
  doc.setTitle(`${w.title} | Thales Franco`);
  doc.setAuthor("Thales Franco");
  return Buffer.from(await doc.save());
}
