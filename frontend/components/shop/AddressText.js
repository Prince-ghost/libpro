import { countryName } from "@/lib/order-labels";

// Always plain text: names and street lines are never treated as HTML.
export default function AddressText({ address }) {
  return (
    <div className="text-sm leading-relaxed">
      <span className="block break-words font-medium">{address.recipientName}</span>
      <span className="block break-words">{address.line1}</span>
      {address.line2 && <span className="block break-words">{address.line2}</span>}
      <span className="block break-words">
        {address.city}, {address.state} {address.postalCode}
      </span>
      <span className="block">{countryName(address.country)}</span>
      <span className="block text-muted">Phone: {address.phone}</span>
    </div>
  );
}