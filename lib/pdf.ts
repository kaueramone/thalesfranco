import { PDFDocument, StandardFonts, rgb, PDFString } from "pdf-lib";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Workout } from "./model";
export async function workoutPdf(w: Workout, url: string) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const logo = await doc.embedPng(
    await readFile(path.join(process.cwd(), "public/logo-black.png")),
  );
  const cover = doc.addPage([595, 842]);
  const photo = await doc.embedJpg(
    await readFile(path.join(process.cwd(), "public/cover-photo.jpeg")),
  );
  const whiteLogo = await doc.embedPng(
    await readFile(path.join(process.cwd(), "public/logo-white.png")),
  );
  const scale = Math.max(595 / photo.width, 842 / photo.height);
  cover.drawImage(photo, {
    x: (595 - photo.width * scale) / 2,
    y: (842 - photo.height * scale) / 2,
    width: photo.width * scale,
    height: photo.height * scale,
  });
  cover.drawRectangle({
    x: 0,
    y: 0,
    width: 595,
    height: 842,
    color: rgb(0.025, 0.025, 0.035),
    opacity: 0.66,
  });
  cover.drawImage(whiteLogo, { x: 117.5, y: 371, width: 360, height: 120 });
  cover.drawRectangle({
    x: 274,
    y: 336,
    width: 47,
    height: 3,
    color: rgb(0.91, 0.17, 0.22),
  });
  const coverLine = (label: string, y: number, size: number) =>
    cover.drawText(label, {
      x: (595 - bold.widthOfTextAtSize(label, size)) / 2,
      y,
      size,
      font: bold,
      color: rgb(1, 1, 1),
    });
  coverLine("HYROX TRAINING PROGRAM", 304, 10);
  coverLine(`WEEK ${String(w.week).padStart(2, "0")}`, 105, 22);
  coverLine(w.start.split("-").reverse().join(" / "), 82, 10);
  let page = doc.addPage([595, 842]),
    y = 735;
  const safe = (s: string) =>
    Array.from(s.replace(/[–—]/g, "-").replace(/\t/g, "  "))
      .map((c) => {
        try {
          font.encodeText(c);
          return c;
        } catch {
          return "?";
        }
      })
      .join("");
  function header() {
    page.drawImage(logo, { x: 42, y: 779, width: 120, height: 40 });
    page.drawText(`SEMANA ${w.week} / ${safe(w.phase).toUpperCase()}`, {
      x: 300,
      y: 795,
      size: 10,
      font: bold,
    });
    page.drawRectangle({
      x: 42,
      y: 762,
      width: 511,
      height: 2,
      color: rgb(0.86, 0.1, 0.14),
    });
    y = 735;
  }
  function newPage() {
    page = doc.addPage([595, 842]);
    header();
  }
  function line(text: string, size = 11, strong = false) {
    if (y < 62) newPage();
    page.drawText(safe(text), {
      x: 42,
      y,
      size,
      font: strong ? bold : font,
      color: rgb(0.12, 0.12, 0.14),
    });
    y -= size + 7;
  }
  function text(value: string, size = 11, strong = false) {
    for (const paragraph of safe(value).split("\n")) {
      let current = "";
      for (const word of paragraph.split(" ")) {
        const f = strong ? bold : font;
        if (f.widthOfTextAtSize(current + word, size) > 500 && current) {
          line(current, size, strong);
          current = "";
        }
        if (f.widthOfTextAtSize(word, size) > 500) {
          for (const c of word) {
            if (f.widthOfTextAtSize(current + c, size) > 500) {
              line(current, size, strong);
              current = "";
            }
            current += c;
          }
          current += " ";
        } else current += word + " ";
      }
      line(current.trimEnd(), size, strong);
    }
  }
  function link(label: string, target: string) {
    if (y < 62) newPage();
    page.drawText(label, {
      x: 42,
      y,
      size: 10,
      font,
      color: rgb(0.8, 0.08, 0.12),
    });
    const annotation = doc.context.obj({
      Type: "Annot",
      Subtype: "Link",
      Rect: [42, y - 2, 553, y + 13],
      Border: [0, 0, 0],
      A: { Type: "Action", S: "URI", URI: PDFString.of(target) },
    });
    page.node.addAnnot(doc.context.register(annotation));
    y -= 22;
  }
  let coverTitle = safe(w.title);
  let titleSize = 16;
  while (bold.widthOfTextAtSize(coverTitle, titleSize) > 490 && titleSize > 7)
    titleSize -= 0.5;
  coverLine(coverTitle, 153, titleSize);
  header();
  text(w.title, 24, true);
  text(`Início: ${w.start.split("-").reverse().join("/")}`, 11);
  y -= 10;
  text(w.intro);
  link("Abrir treino interativo e vídeos", url);
  for (const day of w.days) {
    newPage();
    text(day.name, 23, true);
    if (day.rest) {
      text("REST DAY", 16, true);
      text("Dia de descanso e recuperação.");
    } else if (!day.blocks.some((b) => b.exercises.length)) {
      text("Nenhum treino definido para este dia.");
    } else
      for (const block of day.blocks) {
        if (!block.exercises.length) continue;
        if (y < 145) newPage();
        y -= 12;
        text(block.name.toUpperCase(), 13, true);
        for (const e of block.exercises) {
          if (y < 115) newPage();
          y -= 5;
          text(e.name, 12, true);
          text(e.prescription);
          if (e.video) link("Assistir à demonstração", e.video);
        }
      }
    if (day.notes) {
      y -= 12;
      text("COACH’S NOTES", 12, true);
      text(day.notes);
    }
  }
  doc
    .getPages()
    .slice(1)
    .forEach((p, i) =>
      p.drawText(
        `THALES FRANCO  |  Treino com ciência. Resultado com constância.                       ${i + 2} / ${doc.getPageCount()}`,
        { x: 42, y: 30, font, size: 8, color: rgb(0.45, 0.45, 0.47) },
      ),
    );
  doc.setTitle(`${w.title} | Thales Franco`);
  doc.setAuthor("Thales Franco");
  return Buffer.from(await doc.save());
}
