const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");

const safe = (value) => {
  if (value === null || value === undefined) return "";
  return String(value);
};

const yesNo = (value) => (value ? "Yes" : "No");

const getSignatureBuffer = (signatureString) => {
  if (!signatureString || typeof signatureString !== "string") return null;

  try {
    const cleaned = signatureString.trim();

    // Handles any data:image/...;base64,... format
    if (cleaned.startsWith("data:image/")) {
      const base64Data = cleaned.split(",")[1];
      if (!base64Data) return null;
      return Buffer.from(base64Data, "base64");
    }

    // Handles raw base64 string
    return Buffer.from(cleaned, "base64");
  } catch (error) {
    return null;
  }
};

const drawBox = (doc, x, y, w, h, label, value = "", options = {}) => {
  const {
    labelWidth = 100,
    labelFont = 8,
    valueFont = 8,
    centerValue = false,
  } = options;

  doc.rect(x, y, w, h).stroke();

  if (label) {
    doc
      .font("Helvetica-Bold")
      .fontSize(labelFont)
      .text(label, x + 4, y + 5, {
        width: labelWidth - 8,
      });
  }

  doc
    .font("Helvetica")
    .fontSize(valueFont)
    .text(value || "", x + labelWidth, y + 5, {
      width: w - labelWidth - 8,
      align: centerValue ? "center" : "left",
    });
};

const drawSectionTitle = (doc, x, y, w, title) => {
  doc.rect(x, y, w, 18).stroke();
  doc
    .font("Helvetica-Bold")
    .fontSize(10)
    .text(title, x, y + 4, {
      width: w,
      align: "center",
    });
};

const generateApplicationPdf = (user) => {
  return new Promise((resolve, reject) => {
    try {
      const uploadsDir = path.join(__dirname, "../../uploads/applications");

      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }

      const safeName = (user.fullName || user.name || "member")
        .replace(/[^a-zA-Z0-9]/g, "_")
        .toLowerCase();

      const fileName = `${safeName}_${user._id}.pdf`;
      const filePath = path.join(uploadsDir, fileName);

      const doc = new PDFDocument({
        size: "A4",
        margin: 20,
      });

      const stream = fs.createWriteStream(filePath);
      doc.pipe(stream);

      const pageWidth = doc.page.width;
      const left = 20;
      const contentWidth = pageWidth - 40;

      let y = 20;

      // HEADER
      doc.font("Helvetica-Bold").fontSize(20).text("GYM RAVANA", left, y, {
        width: contentWidth,
        align: "center",
      });

      y += 22;

      doc.font("Helvetica").fontSize(8).text("No:69/F Siriwardana Road Ragama", left, y, {
        width: contentWidth,
        align: "center",
      });

      y += 10;

      doc.font("Helvetica").fontSize(8).text("Tell: 077 50 33333", left, y, {
        width: contentWidth,
        align: "center",
      });

      y += 14;

      doc.font("Helvetica-Bold").fontSize(11).text("MEMBERSHIP APPLICATION FORM", left, y, {
        width: contentWidth,
        align: "center",
        underline: true,
      });

      y += 18;

      // TOP ROW
      drawBox(doc, left, y, 180, 28, "Date", safe(user.date), {
        labelWidth: 55,
      });

      drawBox(doc, left + contentWidth - 180, y, 180, 28, "Membership No", safe(user.membershipNo), {
        labelWidth: 80,
      });

      y += 34;

      // PROGRAMS
      const progW = contentWidth / 4;

      drawBox(doc, left, y, progW, 22, "Power", yesNo(user.powerTraining), {
        labelWidth: 50,
      });
      drawBox(doc, left + progW, y, progW, 22, "Fat Burn", yesNo(user.fatBurning), {
        labelWidth: 55,
      });
      drawBox(doc, left + progW * 2, y, progW, 22, "Zumba", yesNo(user.zumba), {
        labelWidth: 45,
      });
      drawBox(doc, left + progW * 3, y, progW, 22, "Yoga", yesNo(user.yoga), {
        labelWidth: 40,
      });

      y += 28;

      // GENERAL INFO
      drawSectionTitle(doc, left, y, contentWidth, "General Information");
      y += 18;

      drawBox(doc, left, y, contentWidth, 22, "NIC / Passport", safe(user.nicPassport), {
        labelWidth: 90,
      });
      y += 22;

      drawBox(doc, left, y, contentWidth, 22, "Age", safe(user.age), {
        labelWidth: 90,
      });
      y += 22;

      drawBox(
        doc,
        left,
        y,
        contentWidth,
        26,
        "Full Name / Title",
        `${safe(user.fullName || user.name)}   ${safe(user.title)}`,
        {
          labelWidth: 90,
        }
      );
      y += 26;

      const dobWidth = contentWidth * 0.65;
      const sexWidth = contentWidth - dobWidth;

      drawBox(
        doc,
        left,
        y,
        dobWidth,
        22,
        "Date of Birth",
        `${safe(user.birthDay)} / ${safe(user.birthMonth)} / ${safe(user.birthYear)}`,
        {
          labelWidth: 90,
        }
      );

      drawBox(doc, left + dobWidth, y, sexWidth, 22, "Sex", safe(user.sex), {
        labelWidth: 45,
      });

      y += 28;

      // CONTACT INFO
      drawSectionTitle(doc, left, y, contentWidth, "Contact Information");
      y += 18;

      const half = contentWidth / 2;

      drawBox(doc, left, y, half, 24, "Address", safe(user.address), {
        labelWidth: 70,
      });
      drawBox(doc, left + half, y, half, 24, "Home No", safe(user.homeNumber), {
        labelWidth: 70,
      });
      y += 24;

      drawBox(doc, left, y, half, 24, "Facebook", safe(user.facebookId), {
        labelWidth: 70,
      });
      drawBox(doc, left + half, y, half, 24, "Mobile", safe(user.mobileNumber), {
        labelWidth: 70,
      });
      y += 24;

      drawBox(doc, left, y, half, 24, "Instagram", safe(user.instaId), {
        labelWidth: 70,
      });
      drawBox(doc, left + half, y, half, 24, "", "", {
        labelWidth: 0,
      });
      y += 30;

      // PROFESSIONAL
      drawSectionTitle(doc, left, y, contentWidth, "Professional Details");
      y += 18;

      drawBox(doc, left, y, half, 24, "Company", safe(user.company), {
        labelWidth: 70,
      });
      drawBox(doc, left + half, y, half, 24, "Profession", safe(user.profession), {
        labelWidth: 70,
      });
      y += 30;

      // BIO DATA
      drawSectionTitle(doc, left, y, contentWidth, "Bio Data");
      y += 18;

      drawBox(doc, left, y, half, 24, "Weight", safe(user.weight), {
        labelWidth: 70,
      });
      drawBox(doc, left + half, y, half, 24, "Height", safe(user.height), {
        labelWidth: 70,
      });
      y += 24;

      doc.rect(left, y, contentWidth, 42).stroke();
      doc
        .font("Helvetica-Bold")
        .fontSize(8)
        .text("Illnesses / injuries", left + 5, y + 5, {
          width: 90,
        });

      doc
        .font("Helvetica")
        .fontSize(8)
        .text(safe(user.medicalNotes), left + 100, y + 5, {
          width: contentWidth - 110,
          height: 32,
        });

      y += 48;

      // PAYMENT
      drawSectionTitle(doc, left, y, contentWidth, "Payment Details");
      y += 18;

      doc.rect(left, y, contentWidth, 28).stroke();
      doc.font("Helvetica").fontSize(8).text(safe(user.payment), left + 5, y + 6, {
        width: contentWidth - 10,
      });

      y += 34;

      // TERMS
      doc.rect(left, y, contentWidth, 50).stroke();
      doc.font("Helvetica").fontSize(7.5);
      doc.text("• We are not responsible for injuries caused by exercises not recommended by the instructor.", left + 5, y + 5, {
        width: contentWidth - 10,
      });
      doc.text("• Cash is non-refundable.", left + 5, y + 17, {
        width: contentWidth - 10,
      });
      doc.text("• You must follow all GYM RAVANA rules and regulations.", left + 5, y + 28, {
        width: contentWidth - 10,
      });
      doc.text("• Management decisions are final.", left + 5, y + 39, {
        width: contentWidth - 10,
      });

      y += 56;

      // CERTIFICATION
      doc.font("Helvetica-Bold").fontSize(8.5).text(
        "I certify that the above information is accurate to the best of my knowledge.",
        left,
        y,
        {
          width: contentWidth,
          align: "center",
        }
      );

      y += 16;

      // LOGIN DETAILS
      drawSectionTitle(doc, left, y, contentWidth, "System Login Details");
      y += 18;

      drawBox(doc, left, y, contentWidth / 2, 24, "Email", safe(user.email), {
        labelWidth: 55,
      });

      drawBox(doc, left + contentWidth / 2, y, contentWidth / 2, 24, "Password", "••••••••", {
        labelWidth: 60,
      });

      y += 30;

// SIGNATURE
drawSectionTitle(doc, left, y, contentWidth, "Member Signature");
y += 18;

const signatureBoxHeight = 75;
doc.rect(left, y, contentWidth, signatureBoxHeight).stroke();

const signatureBuffer = getSignatureBuffer(user.memberSignature);

if (signatureBuffer) {
  try {
    doc.image(signatureBuffer, left + 12, y + 8, {
      fit: [contentWidth - 24, 42],
      align: "center",
      valign: "center",
    });
  } catch (error) {
    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor("red")
      .text("Signature could not be loaded", left + 12, y + 28, {
        width: contentWidth - 24,
        align: "center",
      })
      .fillColor("black");
  }
} else {
  doc
    .font("Helvetica")
    .fontSize(8)
    .text("No signature provided", left + 12, y + 28, {
      width: contentWidth - 24,
      align: "center",
    });
}

doc.moveTo(left + 20, y + 58).lineTo(left + 170, y + 58).stroke();
doc.font("Helvetica").fontSize(8).text("Member Signature", left + 58, y + 61);

      doc.end();

      stream.on("finish", () => {
        resolve({
          fileName,
          filePath,
          publicUrl: `/uploads/applications/${fileName}`,
        });
      });

      stream.on("error", (err) => reject(err));
    } catch (error) {
      reject(error);
    }
  });
};

module.exports = generateApplicationPdf;