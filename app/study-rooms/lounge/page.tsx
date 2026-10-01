"use client";

// Lounge = a cartolina Caderno (coworking). O componente vive em components/lounge e é
// reusado também na ABA "lounge" do research-lab (research-lab/page.tsx).
import LoungeCartolina from "@/components/lounge/LoungeCartolina";

export default function LoungeRoom() {
  return <LoungeCartolina />;
}
