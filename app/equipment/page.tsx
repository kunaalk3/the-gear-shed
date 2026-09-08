import { Suspense } from "react";
import EquipmentBrowser from "./EquipmentBrowser";

export const metadata = {
  title: "Browse equipment | Community ShareSpace SA",
};

export default function EquipmentPage() {
  return (
    <Suspense fallback={null}>
      <EquipmentBrowser />
    </Suspense>
  );
}
