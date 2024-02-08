import Image from "next/image";
import Sidebar from "../src/components/Sidebar";
import Charts from "../src/components/Charts";

export default function Home() {
  return (
    <main className="flex min-h-screen bg-ocf-gray-900 flex-row items-stretch justify-between pt-16">
      <Sidebar />
      <Charts />
    </main>
  );
}
