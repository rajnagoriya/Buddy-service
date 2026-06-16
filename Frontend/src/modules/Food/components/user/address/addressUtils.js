import { Home, Briefcase, MapPin, Building2 } from "lucide-react";

export const getAddressId = (address) => address?.id || address?._id || null;

export const formatAddressLine = (address) => {
  if (!address) return "";
  return [address.additionalDetails, address.street, address.city, address.state, address.zipCode]
    .filter(Boolean)
    .join(", ");
};

export const getAddressIcon = (address) => {
  const label = (address?.label || address?.additionalDetails || "").toLowerCase();
  if (label.includes("home")) return Home;
  if (label.includes("work") || label.includes("office")) return Briefcase;
  if (label.includes("building") || label.includes("apt")) return Building2;
  return MapPin;
};

export const normalizeLabelKey = (label) => {
  const v = String(label || "").toLowerCase();
  if (v === "home") return "home";
  if (v === "office" || v === "work") return "work";
  return "other";
};

export const QUICK_SLOTS = [
  { key: "home", label: "Home", emptyHint: "Add home" },
  { key: "work", label: "Work", emptyHint: "Add work" },
  { key: "other", label: "Other", emptyHint: "Add other" },
];

export function buildQuickSlotMap(addresses = []) {
  const map = { home: null, work: null, other: null };
  for (const addr of addresses) {
    const key = normalizeLabelKey(addr.label);
    if (!map[key]) map[key] = addr;
  }
  return map;
}
