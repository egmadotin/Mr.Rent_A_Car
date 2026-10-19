import { LegacyDocument } from "../../../_components/legacy-document";
import { PrintButton } from "./print-button";
import { TemplatePicker } from "./template-picker";

/**
 * One Letter page with 1cm margins (LegacyDocument scales to it), only the document, on white — no full-height body or
 * patterned background adding a blank page.
 */
const PRINT_CSS = `@page { size: letter; margin: 1cm; }
@media print { html, body { min-height: 0 !important; height: auto !important; margin: 0 !important; padding: 0 !important; background: #fff !important; } }`;

/** A document printed with a staff-authored template (Settings > Rentals & Invoices), with the printout picker on top. */
export function TemplatePrint({ html, current, names, builtIn }: { html: string; current: string; names: string[]; builtIn?: string }) {
  return (
    <div className="min-h-dvh bg-white text-black print:min-h-0">
      <style>{PRINT_CSS}</style>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b p-3 print:hidden">
        <TemplatePicker current={current} names={names} builtIn={builtIn} />
        <PrintButton />
      </div>
      <div className="mx-auto max-w-[8in] p-4 print:max-w-none print:p-0">
        <LegacyDocument html={html} fitPage />
      </div>
    </div>
  );
}
