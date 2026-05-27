const multer = require("multer");

const BodyProgressEntry = require("../models/BodyProgressEntry");
const User = require("../models/User");

const {
  uploadBodyProgressPhoto,
  deleteCloudinaryImageIfExists,
  safeUnlink,
} = require("../utils/cloudinaryBodyProgress");

const upload = multer({ dest: "uploads/tmp/body-progress" });

const parseNumberOrNull = (value) => {
  if (value === undefined || value === null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const normalizeRecordedAt = (value) => {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

const pickActor = (req) => {
  return req.user?.role === "admin" ? "admin" : "member";
};

const toPhotoKind = (fieldname = "") => {
  // Accept flexible names from the client: front/side/back or photosFront etc.
  const v = String(fieldname).toLowerCase();
  if (v.includes("front")) return "front";
  if (v.includes("side")) return "side";
  if (v.includes("back")) return "back";
  return null;
};

const readEntryBody = (req) => {
  return {
    recordedAt: normalizeRecordedAt(req.body.recordedAt),
    weightKg: parseNumberOrNull(req.body.weightKg),
    chestCm: parseNumberOrNull(req.body.chestCm),
    waistCm: parseNumberOrNull(req.body.waistCm),
    hipsCm: parseNumberOrNull(req.body.hipsCm),
    armCm: parseNumberOrNull(req.body.armCm),
    thighCm: parseNumberOrNull(req.body.thighCm),
  };
};

const listEntriesForUser = async (req, res) => {
  try {
    const userId = req.params.userId || req.user?.id;
    if (!userId) return res.status(400).json({ message: "User ID is required" });

    const entries = await BodyProgressEntry.find({ userId }).sort({ recordedAt: -1, createdAt: -1 });
    return res.status(200).json({ entries });
  } catch (error) {
    return res.status(500).json({ message: "Failed to load body progress entries", error: error.message });
  }
};

const getStatusForUser = async (req, res) => {
  try {
    const userId = req.params.userId || req.user?.id;
    if (!userId) return res.status(400).json({ message: "User ID is required" });

    const baseline = await BodyProgressEntry.findOne({ userId }).sort({ recordedAt: 1, createdAt: 1 });
    const latest = await BodyProgressEntry.findOne({ userId }).sort({ recordedAt: -1, createdAt: -1 });

    return res.status(200).json({
      baseline: baseline || null,
      latest: latest || null,
      hasAny: !!latest,
      hasBaseline: !!baseline,
      sameEntry:
        baseline && latest ? String(baseline._id) === String(latest._id) : false,
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to load body progress status", error: error.message });
  }
};

const createEntryForUser = async (req, res) => {
  let uploadedFiles = [];

  try {
    const userId = req.params.userId || req.user?.id;
    if (!userId) return res.status(400).json({ message: "User ID is required" });

    // Validate user exists (helps admin flows too).
    const user = await User.findById(userId).select("_id role");
    if (!user) return res.status(404).json({ message: "User not found" });

    const actor = pickActor(req);
    const body = readEntryBody(req);

    const photos = [];

    uploadedFiles = req.files || [];
    for (const file of uploadedFiles) {
      const kind = toPhotoKind(file.fieldname);
      if (!kind) continue;

      const uploaded = await uploadBodyProgressPhoto({
        filePath: file.path,
        userId,
        kind,
      });

      photos.push({ kind, ...uploaded });
    }

    // cleanup tmp files
    await Promise.all(uploadedFiles.map((f) => safeUnlink(f.path)));

    const entry = await BodyProgressEntry.create({
      userId,
      recordedAt: body.recordedAt || new Date(),
      weightKg: body.weightKg,
      chestCm: body.chestCm,
      waistCm: body.waistCm,
      hipsCm: body.hipsCm,
      armCm: body.armCm,
      thighCm: body.thighCm,
      photos,
      createdBy: { actor, userId: req.user?.id },
    });

    return res.status(201).json({ message: "Body progress entry created", entry });
  } catch (error) {
    // cleanup tmp files
    try {
      await Promise.all((uploadedFiles || []).map((f) => safeUnlink(f.path)));
    } catch {}

    return res.status(500).json({ message: "Failed to create body progress entry", error: error.message });
  }
};

const updateEntryForUser = async (req, res) => {
  let uploadedFiles = [];

  try {
    const userId = req.params.userId || req.user?.id;
    const entryId = req.params.entryId;

    if (!userId || !entryId) {
      return res.status(400).json({ message: "User ID and entryId are required" });
    }

    const actor = pickActor(req);

    const entry = await BodyProgressEntry.findOne({ _id: entryId, userId });
    if (!entry) return res.status(404).json({ message: "Body progress entry not found" });

    // Member can only edit own entry; admin routes already scoped by userId.
    // For safety, if member tries to edit another userId, this query won't match.

    const body = readEntryBody(req);

    if (body.recordedAt) entry.recordedAt = body.recordedAt;
    if (body.weightKg !== null || req.body.weightKg === "" || req.body.weightKg === 0) entry.weightKg = body.weightKg;
    if (req.body.chestCm !== undefined) entry.chestCm = body.chestCm;
    if (req.body.waistCm !== undefined) entry.waistCm = body.waistCm;
    if (req.body.hipsCm !== undefined) entry.hipsCm = body.hipsCm;
    if (req.body.armCm !== undefined) entry.armCm = body.armCm;
    if (req.body.thighCm !== undefined) entry.thighCm = body.thighCm;

    // Photo replacements: if a kind is uploaded, replace that kind.
    uploadedFiles = req.files || [];
    for (const file of uploadedFiles) {
      const kind = toPhotoKind(file.fieldname);
      if (!kind) continue;

      const existing = (entry.photos || []).find((p) => p.kind === kind);
      if (existing?.publicId) {
        await deleteCloudinaryImageIfExists(existing.publicId);
      }

      const uploaded = await uploadBodyProgressPhoto({
        filePath: file.path,
        userId,
        kind,
      });

      entry.photos = (entry.photos || []).filter((p) => p.kind !== kind);
      entry.photos.push({ kind, ...uploaded });
    }

    await Promise.all(uploadedFiles.map((f) => safeUnlink(f.path)));

    entry.updatedBy = {
      actor,
      userId: req.user?.id || null,
      at: new Date(),
    };

    await entry.save();

    return res.status(200).json({ message: "Body progress entry updated", entry });
  } catch (error) {
    try {
      await Promise.all((uploadedFiles || []).map((f) => safeUnlink(f.path)));
    } catch {}

    return res.status(500).json({ message: "Failed to update body progress entry", error: error.message });
  }
};

const deleteEntry = async (req, res) => {
  try {
    const entryId = req.params.entryId;
    if (!entryId) return res.status(400).json({ message: "entryId is required" });

    const entry = await BodyProgressEntry.findById(entryId);
    if (!entry) return res.status(404).json({ message: "Body progress entry not found" });

    // Admin-only route will enforce permissions in router.
    const photos = entry.photos || [];
    await Promise.all(photos.map((p) => deleteCloudinaryImageIfExists(p.publicId)));

    await BodyProgressEntry.deleteOne({ _id: entryId });

    return res.status(200).json({ message: "Body progress entry deleted" });
  } catch (error) {
    return res.status(500).json({ message: "Failed to delete body progress entry", error: error.message });
  }
};

module.exports = {
  upload,
  listEntriesForUser,
  getStatusForUser,
  createEntryForUser,
  updateEntryForUser,
  deleteEntry,
};

