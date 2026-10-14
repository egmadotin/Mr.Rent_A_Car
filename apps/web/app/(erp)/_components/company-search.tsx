"use client";

import { SearchPicker } from "./search-picker";

type Company = { id: string; name: string; isUndesired?: boolean };

/** RentCentric "Company" field: a search box (type to find a company), not a dropdown. */
export function CompanySearch({ id = "companyId", companies, value, onChange }: { id?: string; companies: Company[]; value: string; onChange: (companyId: string) => void }) {
  return (
    <SearchPicker
      id={id}
      value={value}
      onChange={onChange}
      items={companies.map((c) => ({ id: c.id, label: c.name, hint: c.isUndesired ? <span className="text-destructive">(undesired)</span> : undefined }))}
    />
  );
}
