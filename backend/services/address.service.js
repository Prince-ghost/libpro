import { AppError } from "../lib/http.js";
import { runInTransaction } from "../lib/db.js";
import { Address } from "../models/index.js";

const MAX_ADDRESSES = 10;
const notFound = () => new AppError(404, "NOT_FOUND", "Address not found.");

export function toAddressDto(a) {
  return {
    id: String(a._id),
    recipientName: a.recipientName,
    phone: a.phone,
    line1: a.line1,
    line2: a.line2 ?? null,
    city: a.city,
    state: a.state,
    postalCode: a.postalCode,
    country: a.country,
    isDefault: a.isDefault,
  };
}

function assertAddressRules({ country, postalCode }) {
  if (country === "IN" && !/^[1-9][0-9]{5}$/.test(postalCode)) {
    throw new AppError(400, "VALIDATION_ERROR", "Please correct the highlighted fields.", [
      { field: "postalCode", issue: "Indian PIN codes have 6 digits" },
    ]);
  }
}

export async function listAddresses(actor) {
  const list = await Address.find({ userId: actor.id }).sort({ isDefault: -1, createdAt: -1 }).lean();
  return list.map(toAddressDto);
}

export async function createAddress(actor, input) {
  const country = input.country ?? "IN";
  assertAddressRules({ country, postalCode: input.postalCode });

  const count = await Address.countDocuments({ userId: actor.id });
  if (count >= MAX_ADDRESSES) {
    throw new AppError(409, "ADDRESS_LIMIT", `You can save at most ${MAX_ADDRESSES} addresses.`);
  }

  const makeDefault = input.isDefault === true || count === 0;
  const { isDefault, ...fields } = input; // isDefault is decided here, not copied blindly

  try {
    const created = await runInTransaction(async (session) => {
      if (makeDefault) {
        await Address.updateMany({ userId: actor.id, isDefault: true }, { $set: { isDefault: false } }, { session });
      }
      // userId comes from the session and is set last, so nothing in the input can override it.
      const [doc] = await Address.create(
        [{ ...fields, country, userId: actor.id, isDefault: makeDefault }],
        { session }
      );
      return doc;
    });
    return toAddressDto(created);
  } catch (err) {
    if (err?.code === 11000) throw new AppError(409, "CONFLICT", "Please try again.");
    throw err;
  }
}

export async function updateAddress(actor, id, input) {
  const existing = await Address.findOne({ _id: id, userId: actor.id }).lean();
  if (!existing) throw notFound(); // someone else's address looks exactly like a missing one

  const { isDefault, ...fields } = input;
  assertAddressRules({
    country: fields.country ?? existing.country,
    postalCode: fields.postalCode ?? existing.postalCode,
  });

  try {
    const updated = await runInTransaction(async (session) => {
      const set = { ...fields };
      if (isDefault === true) {
        await Address.updateMany({ userId: actor.id, isDefault: true }, { $set: { isDefault: false } }, { session });
        set.isDefault = true;
      }
      return Address.findOneAndUpdate(
        { _id: id, userId: actor.id },
        { $set: set },
        { new: true, runValidators: true, session }
      );
    });
    if (!updated) throw notFound();
    return toAddressDto(updated);
  } catch (err) {
    if (err?.code === 11000) throw new AppError(409, "CONFLICT", "Please try again.");
    throw err;
  }
}

export async function deleteAddress(actor, id) {
  const removed = await Address.findOneAndDelete({ _id: id, userId: actor.id }).lean();
  if (!removed) throw notFound();

  if (removed.isDefault) {
    try {
      // Promote the newest remaining address so the user keeps a default.
      await Address.findOneAndUpdate({ userId: actor.id }, { $set: { isDefault: true } }, { sort: { createdAt: -1 } });
    } catch (err) {
      if (err?.code !== 11000) throw err; // a default was created at the same moment: nothing to do
    }
  }
  return { id: String(removed._id), deleted: true };
}