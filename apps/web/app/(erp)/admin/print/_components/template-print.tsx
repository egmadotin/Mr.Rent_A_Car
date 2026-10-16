import { PrintButton } from "./print-button";
import { TemplatePicker } from "./template-picker";

/** A document printed with a staff-authored template (Settings > Rentals & Invoices), with the printout picker on top. */
export function TemplatePrint({ html, current, names, builtIn }: { html: string; current: string; names: string[]; builtIn?: string }) {
  return (
    <div className="bg-white text-black">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b p-3 print:hidden">
        <TemplatePicker current={current} names={names} builtIn={builtIn} />
        <PrintButton />
      </div>
      <div className="mx-auto max-w-[8.5in] p-4 print:p-0" dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}
