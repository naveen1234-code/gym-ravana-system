const PDFDocument = require("pdfkit");

const monthNames = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const formatCurrency = (value) => `LKR ${Number(value || 0).toLocaleString()}`;
const formatDate = (value) =>
  value ? new Date(value).toLocaleDateString("en-GB") : "-";

const drawFooter = (doc) => {
  const pageWidth = doc.page.width;
  const pageHeight = doc.page.height;
  const footerY = pageHeight - 32;

  doc.save();
  doc
    .moveTo(45, footerY)
    .lineTo(pageWidth - 45, footerY)
    .lineWidth(0.6)
    .strokeColor("#d1d5db")
    .stroke();
  doc.restore();
};

const drawTableHeader = (doc, startX, y, widths) => {
  const headers = ["#", "Member", "Plan", "Method", "Transaction", "Amount", "Date"];
  const aligns = ["center", "left", "left", "center", "left", "right", "center"];

  let x = startX;

  doc.save();
  doc
    .roundedRect(startX, y, widths.reduce((a, b) => a + b, 0), 26, 8)
    .fill("#111827");
  doc.restore();

  headers.forEach((header, index) => {
    doc
      .font("Helvetica-Bold")
      .fontSize(9)
      .fillColor("#f9fafb")
      .text(header, x + 6, y + 8, {
        width: widths[index] - 12,
        align: aligns[index],
      });

    x += widths[index];
  });

  return y + 32;
};

const drawSignatureSection = (doc, y, contentWidth) => {
  const sectionHeight = 120;

  doc.save();
  doc.roundedRect(45, y, contentWidth, sectionHeight, 16).fill("#f8fafc");
  doc.restore();

  doc
    .font("Helvetica-Bold")
    .fontSize(11)
    .fillColor("#111827")
    .text("Approval & Signature", 60, y + 16);

  doc
    .font("Helvetica")
    .fontSize(9.5)
    .fillColor("#6b7280")
    .text(
      "Use this section for final monthly verification, client confirmation, or internal settlement sign-off.",
      60,
      y + 34,
      { width: contentWidth - 30 }
    );

  doc
    .moveTo(70, y + 88)
    .lineTo(230, y + 88)
    .lineWidth(0.8)
    .strokeColor("#9ca3af")
    .stroke();

  doc
    .font("Helvetica")
    .fontSize(9)
    .fillColor("#6b7280")
    .text("Client / Verified By Signature", 70, y + 94, {
      width: 160,
      align: "center",
    });

  doc
    .moveTo(270, y + 88)
    .lineTo(410, y + 88)
    .lineWidth(0.8)
    .strokeColor("#9ca3af")
    .stroke();

  doc
    .font("Helvetica")
    .fontSize(9)
    .fillColor("#6b7280")
    .text("Authorized By", 270, y + 94, {
      width: 140,
      align: "center",
    });

  doc
    .moveTo(450, y + 88)
    .lineTo(540, y + 88)
    .lineWidth(0.8)
    .strokeColor("#9ca3af")
    .stroke();

  doc
    .font("Helvetica")
    .fontSize(9)
    .fillColor("#6b7280")
    .text("Date", 450, y + 94, {
      width: 90,
      align: "center",
    });

  return y + sectionHeight;
};

const generateMonthlyStatementPdf = ({
  res,
  year,
  month,
  payments,
  totalRevenue,
  totalPayments,
}) => {
  const monthLabel = `${monthNames[month - 1]} ${year}`;

  const doc = new PDFDocument({
    size: "A4",
    margins: { top: 50, bottom: 70, left: 45, right: 45 },
    autoFirstPage: true,
  });

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="gym-ravana-statement-${year}-${String(month).padStart(2, "0")}.pdf"`
  );

  doc.pipe(res);

  const pageWidth = doc.page.width;
  const contentWidth = pageWidth - 90;

  doc.save();
  doc.roundedRect(45, 45, contentWidth, 100, 20).fill("#0f172a");
  doc.restore();

  doc
    .font("Helvetica-Bold")
    .fontSize(12)
    .fillColor("#ef4444")
    .text("GYM RAVANA", 65, 68);

  doc
    .font("Helvetica-Bold")
    .fontSize(24)
    .fillColor("#ffffff")
    .text("Monthly Revenue Statement", 65, 88);

  doc
    .font("Helvetica")
    .fontSize(11)
    .fillColor("#d1d5db")
    .text(monthLabel, 65, 118);

  doc
    .font("Helvetica")
    .fontSize(10)
    .fillColor("#9ca3af")
    .text(
      "Prepared for internal revenue reconciliation and monthly settlement.",
      65,
      132
    );

  const cardsY = 170;
  const cardGap = 12;
  const cardWidth = (contentWidth - cardGap * 2) / 3;

  const cards = [
    { title: "Statement Month", value: monthLabel, accent: "#ef4444" },
    { title: "Successful Payments", value: String(totalPayments), accent: "#22c55e" },
    { title: "Total Revenue", value: formatCurrency(totalRevenue), accent: "#3b82f6" },
  ];

  cards.forEach((card, index) => {
    const x = 45 + index * (cardWidth + cardGap);

    doc.save();
    doc.roundedRect(x, cardsY, cardWidth, 74, 16).fill("#f8fafc");
    doc.restore();

    doc.save();
    doc.roundedRect(x, cardsY, 6, 74, 16).fill(card.accent);
    doc.restore();

    doc
      .font("Helvetica-Bold")
      .fontSize(9)
      .fillColor("#6b7280")
      .text(card.title.toUpperCase(), x + 18, cardsY + 16, {
        width: cardWidth - 28,
      });

    doc
      .font("Helvetica-Bold")
      .fontSize(15)
      .fillColor("#111827")
      .text(card.value, x + 18, cardsY + 36, {
        width: cardWidth - 28,
      });
  });

  const noteY = 262;
  doc.save();
  doc.roundedRect(45, noteY, contentWidth, 56, 14).fill("#fff7ed");
  doc.restore();

  doc
    .font("Helvetica-Bold")
    .fontSize(10)
    .fillColor("#c2410c")
    .text("Statement Scope", 60, noteY + 12);

  doc
    .font("Helvetica")
    .fontSize(9.5)
    .fillColor("#7c2d12")
    .text(
      "This statement includes only payments marked as paid within the selected month. Pending and failed payments are excluded.",
      60,
      noteY + 28,
      { width: contentWidth - 30 }
    );

  let y = 342;
  doc
    .font("Helvetica-Bold")
    .fontSize(14)
    .fillColor("#111827")
    .text("Payment Breakdown", 45, y);

  y += 24;

  const startX = 45;
  const widths = [28, 132, 90, 62, 95, 72, 52];
  y = drawTableHeader(doc, startX, y, widths);
  if (!payments.length) {
    doc
      .font("Helvetica")
      .fontSize(11)
      .fillColor("#6b7280")
      .text("No paid payments were found for this selected month.", 45, y + 10);
  } else {
    payments.forEach((payment, index) => {
      const rowPaddingY = 8;
      const memberText = `${payment.userName}\n${payment.userEmail}`;
      const planText = payment.planName || "-";
      const methodText = payment.paymentMethod || "-";
      const transactionText = payment.transactionId || "-";
      const amountText = formatCurrency(payment.amount);
      const dateText = formatDate(payment.createdAt);

      const memberHeight = doc.heightOfString(memberText, {
        width: widths[1] - 12,
        align: "left",
      });
      const planHeight = doc.heightOfString(planText, {
        width: widths[2] - 12,
        align: "left",
      });
      const transactionHeight = doc.heightOfString(transactionText, {
        width: widths[4] - 12,
        align: "left",
      });

      const rowHeight =
        Math.max(34, memberHeight, planHeight, transactionHeight) + rowPaddingY * 2;

      if (y + rowHeight > doc.page.height - 170) {
        drawFooter(doc);
        doc.addPage();
        y = 60;

        doc
          .font("Helvetica-Bold")
          .fontSize(14)
          .fillColor("#111827")
          .text("Payment Breakdown (Continued)", 45, y);

        y += 24;
        y = drawTableHeader(doc, startX, y, widths);
      }

      doc.save();
      doc
        .roundedRect(startX, y, widths.reduce((a, b) => a + b, 0), rowHeight, 8)
        .fill(index % 2 === 0 ? "#ffffff" : "#f8fafc");
      doc.restore();

      let x = startX;

      const cells = [
        {
          text: String(index + 1),
          width: widths[0],
          align: "center",
          font: "Helvetica-Bold",
          color: "#111827",
        },
        {
          text: memberText,
          width: widths[1],
          align: "left",
          font: "Helvetica",
          color: "#111827",
        },
        {
          text: planText,
          width: widths[2],
          align: "left",
          font: "Helvetica",
          color: "#111827",
        },
        {
          text: methodText,
          width: widths[3],
          align: "center",
          font: "Helvetica",
          color: "#111827",
        },
        {
          text: transactionText,
          width: widths[4],
          align: "left",
          font: "Helvetica",
          color: "#111827",
        },
        {
          text: amountText,
          width: widths[5],
          align: "right",
          font: "Helvetica-Bold",
          color: "#059669",
        },
        {
          text: dateText,
          width: widths[6],
          align: "center",
          font: "Helvetica",
          color: "#111827",
        },
      ];

      cells.forEach((cell) => {
        doc
          .font(cell.font)
          .fontSize(9)
          .fillColor(cell.color)
          .text(cell.text, x + 6, y + rowPaddingY, {
            width: cell.width - 12,
            align: cell.align,
          });

        x += cell.width;
      });

      y += rowHeight + 6;
    });
  }

  y += 20;

  if (y + 220 > doc.page.height - 120) {
    drawFooter(doc);
    doc.addPage();
    y = 60;
  }

  doc.save();
  doc.roundedRect(45, y, contentWidth, 88, 18).fill("#111827");
  doc.restore();

  doc
    .font("Helvetica-Bold")
    .fontSize(11)
    .fillColor("#9ca3af")
    .text("FINAL MONTHLY TOTAL", 60, y + 18);

  doc
    .font("Helvetica-Bold")
    .fontSize(24)
    .fillColor("#22c55e")
    .text(formatCurrency(totalRevenue), 60, y + 42);

  doc
    .font("Helvetica")
    .fontSize(10)
    .fillColor("#d1d5db")
    .text(
      `${totalPayments} successful payment${totalPayments !== 1 ? "s" : ""} recorded`,
      320,
      y + 48,
      {
        width: 180,
        align: "right",
      }
    );

  y += 108;

  if (y + 140 > doc.page.height - 120) {
    drawFooter(doc);
    doc.addPage();
    y = 60;
  }

  drawSignatureSection(doc, y, contentWidth);

  drawFooter(doc);
  doc.end();
};

module.exports = generateMonthlyStatementPdf;