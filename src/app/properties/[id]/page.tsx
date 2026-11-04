import Link from "next/link";
import { PropertyDetails } from "@/components/property-details";
import { ThemeToggle } from "@/components/theme-toggle";
import { BrandLogo } from "@/components/brand-logo";

export default async function PropertyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <div>
    <header className="sticky top-0 z-30 border-b border-[#dedfd5] bg-[#f4f4ed]/90 backdrop-blur dark:border-[#38423b] dark:bg-[#171d1a]/90"><nav aria-label="Navegacion principal" className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4"><Link href="/dashboard" className="inline-flex items-center"><BrandLogo className="h-9 w-auto" /></Link><ThemeToggle /></nav></header>
    <main className="mx-auto max-w-6xl px-4 py-6 sm:py-8"><PropertyDetails propertyId={id} /></main>
  </div>;
}
