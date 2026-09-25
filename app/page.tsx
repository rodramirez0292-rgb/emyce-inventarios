"use client";
import dynamic from "next/dynamic";
const Application = dynamic(() => import("@/components/application"), {
  ssr: false,
  loading: () => (
    <div className="boot">
      <b>
        EMYCE<span>•</span>
      </b>
      <p>Abriendo inventarios…</p>
    </div>
  ),
});
export default function Page() {
  return <Application />;
}
